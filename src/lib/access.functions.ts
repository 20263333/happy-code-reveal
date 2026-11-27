import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateAccessSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  fullname: z.string().min(1).max(120),
  project_id: z.string().uuid(),
  // Additional projects to grant access to in the same step (multi-select).
  project_ids: z.array(z.string().uuid()).max(100).optional(),
});

async function resolveOwnerAndCompany(admin: any, userId: string) {
  const [profRes, ownedRes, roleRes, paRes] = await Promise.all([
    admin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
    admin.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle(),
    admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  const ownedCompanyId = (ownedRes.data as any)?.id ?? null;
  const profileCompanyId = ((profRes.data as any)?.company_id as string | null) ?? null;
  const companyId = ownedCompanyId ?? profileCompanyId;
  const isOwner = !!ownedCompanyId || !!roleRes.data || !!paRes.data;

  return { companyId, isOwner };
}

export const grantProjectAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateAccessSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, userId);
    if (!isOwner) throw new Error("Только владелец может выдавать доступ");
    if (!companyId) throw new Error("У вас нет компании");

    // Try to find existing user by email
    let targetUserId: string | null = null;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (found) {
      targetUserId = found.id;
    } else {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { fullname: data.fullname },
      });
      if (cErr) throw new Error(cErr.message);
      targetUserId = created.user?.id ?? null;
    }
    if (!targetUserId) throw new Error("Не удалось создать пользователя");

    // Ensure profile + manager role exists (trigger usually does, but for safety)
    await admin.from("profiles").upsert({
      id: targetUserId,
      fullname: data.fullname,
      company_id: companyId,
    }, { onConflict: "id" });

    const { data: hasRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!hasRole) {
      await admin.from("user_roles").insert({ user_id: targetUserId, role: "manager" });
    }

    const requestedIds = Array.from(new Set([data.project_id, ...(data.project_ids ?? [])]));
    const { data: companyProjects } = await admin
      .from("projects")
      .select("id, parent_id")
      .eq("company_id", companyId);
    const allCompanyProjects = (companyProjects ?? []) as { id: string; parent_id: string | null }[];
    const companyIds = new Set(allCompanyProjects.map((p) => p.id));
    const validIds = requestedIds.filter((id) => companyIds.has(id));

    for (const pid of validIds) {
      const { data: psExists } = await admin
        .from("project_staff")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("project_id", pid)
        .maybeSingle();
      if (!psExists) {
        const { error: psErr } = await admin
          .from("project_staff")
          .insert({ user_id: targetUserId, project_id: pid });
        if (psErr) throw new Error(psErr.message);
      }
    }

    return { ok: true, user_id: targetUserId };
  });

export const revokeProjectAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ user_id: z.string().uuid(), project_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { isOwner } = await resolveOwnerAndCompany(admin, userId);
    if (!isOwner) throw new Error("Только владелец");

    const { error } = await admin
      .from("project_staff")
      .delete()
      .eq("user_id", data.user_id)
      .eq("project_id", data.project_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Assign an EXISTING staff member (one account / email) to an additional project,
// so a single login can access several projects.
export const addStaffToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ user_id: z.string().uuid(), project_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, userId);
    if (!isOwner) throw new Error("Только владелец может выдавать доступ");
    if (!companyId) throw new Error("У вас нет компании");

    // The target user must belong to the owner's company.
    const { data: targetProf } = await admin
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Сотрудник не найден в вашей компании");
    }

    const { data: companyProjects } = await admin
      .from("projects")
      .select("id, parent_id, company_id")
      .eq("company_id", companyId);
    const allCompanyProjects = (companyProjects ?? []) as { id: string; parent_id: string | null; company_id: string }[];
    const selected = allCompanyProjects.find((p) => p.id === data.project_id);
    if (!selected) throw new Error("Проект не найден");

    const { data: existing } = await admin
      .from("project_staff")
      .select("id")
      .eq("user_id", data.user_id)
      .eq("project_id", selected.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin
        .from("project_staff")
        .insert({ user_id: data.user_id, project_id: selected.id });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
