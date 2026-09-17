import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_DIRECTORS_PER_COMPANY = 10;

// Ensure the caller owns the company (or is a platform admin).
async function requireCompanyOwner(supabase: any, userId: string) {
  const [{ data: company, error: companyError }, { data: platformAdmin, error: adminError }] = await Promise.all([
    supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (companyError) throw new Error(companyError.message);
  if (adminError) throw new Error(adminError.message);

  // A company owner may also be a platform admin. In that case this page must
  // stay scoped to the company they own instead of returning an empty list.
  if (company) return { isAdmin: !!platformAdmin, companyId: company.id as string };
  if (platformAdmin) return { isAdmin: true, companyId: null as string | null };
  throw new Error("Танҳо соҳиби ширкат метавонад директор илова кунад");
}

export const listCompanyDirectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId, isAdmin } = await requireCompanyOwner(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pure platform admins manage companies elsewhere and have no implicit
    // company scope. Owner-admin accounts keep their owned company above.
    if (isAdmin && !companyId) return { directors: [] as any[] };
    const { data, error } = await (supabaseAdmin as any)
      .from("company_directors")
      .select("id, user_id, email, fullname, is_active, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { directors: data ?? [] };
  });

const CreateDirectorSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  fullname: z.string().min(2).max(120),
});

export const createCompanyDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateDirectorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await requireCompanyOwner(supabase, userId);
    if (!companyId) throw new Error("company_id талаб карда мешавад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Limit
    const { count } = await admin.from("company_directors")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("is_active", true);
    if ((count ?? 0) >= MAX_DIRECTORS_PER_COMPANY) {
      throw new Error(`Ҳадди аксар ${MAX_DIRECTORS_PER_COMPANY} директор барои як ширкат`);
    }

    // Find or create the auth user
    let targetUserId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = (list?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (found) {
      targetUserId = found.id;
      await admin.auth.admin.updateUserById(found.id, { password: data.password, email_confirm: true });
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { fullname: data.fullname },
      });
      if (cErr) throw new Error(cErr.message);
      targetUserId = created.user?.id ?? null;
    }
    if (!targetUserId) throw new Error("Корбар сохта нашуд");

    // Profile → attach to company
    await admin.from("profiles").upsert({
      id: targetUserId, fullname: data.fullname, company_id: companyId,
    });

    // Role: director (replace any existing role)
    await admin.from("user_roles").delete().eq("user_id", targetUserId);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: targetUserId, role: "director" });
    if (rErr) throw new Error(rErr.message);

    // Registry
    const { error: dErr } = await admin.from("company_directors").upsert({
      company_id: companyId, user_id: targetUserId, email: data.email, fullname: data.fullname, is_active: true,
    }, { onConflict: "company_id,user_id" });
    if (dErr) throw new Error(dErr.message);

    return { ok: true, user_id: targetUserId };
  });

export const deleteCompanyDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ director_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await requireCompanyOwner(supabase, userId);
    if (!companyId) throw new Error("company_id талаб карда мешавад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: rec } = await admin.from("company_directors")
      .select("id, user_id, company_id").eq("id", data.director_id).maybeSingle();
    if (!rec || rec.company_id !== companyId) throw new Error("Директор ёфт нашуд");

    // Remove role + profile link + registry + auth user
    await admin.from("user_roles").delete().eq("user_id", rec.user_id);
    await admin.from("profiles").update({ company_id: null }).eq("id", rec.user_id);
    await admin.from("company_directors").delete().eq("id", rec.id);
    try { await admin.auth.admin.deleteUser(rec.user_id); } catch { /* ignore */ }

    return { ok: true };
  });

export const resetDirectorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    director_id: z.string().uuid(),
    password: z.string().min(6).max(72),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await requireCompanyOwner(supabase, userId);
    if (!companyId) throw new Error("company_id талаб карда мешавад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: rec } = await admin.from("company_directors")
      .select("user_id, company_id").eq("id", data.director_id).maybeSingle();
    if (!rec || rec.company_id !== companyId) throw new Error("Директор ёфт нашуд");

    const { error } = await admin.auth.admin.updateUserById(rec.user_id, {
      password: data.password, email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
