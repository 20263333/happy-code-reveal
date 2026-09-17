import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_MODULE_KEYS } from "@/lib/constants";

const RequestSchema = z.object({
  email: z.string().email().max(255),
  company_name: z.string().min(2).max(150),
  fullname: z.string().min(2).max(120),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(6).max(72),
});

export const submitCompanyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RequestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: userRes, error: userErr } = await (supabaseAdmin as any).auth.admin.getUserById(userId);
    if (userErr || !userRes?.user) throw new Error(userErr?.message ?? "Корбар ёфт нашуд");
    const user = userRes.user;
    const userEmail = (user.email ?? "").toLowerCase();
    if (!userEmail || userEmail !== data.email.toLowerCase()) {
      throw new Error("Email бояд бо аккаунти Google якхела бошад");
    }

    const { data: existingProfile, error: profileErr } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (existingProfile?.company_id) throw new Error("Шумо аллакай ба ширкат пайваст ҳастед");

    const { error: passwordErr } = await (supabaseAdmin as any).auth.admin.updateUserById(userId, {
      password: data.password,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        fullname: data.fullname,
        full_name: data.fullname,
        phone: data.phone ?? null,
      },
    });
    if (passwordErr) throw new Error(passwordErr.message);

    const { error: upsertErr } = await (supabaseAdmin as any).from("profiles").upsert({
      id: userId,
      fullname: data.fullname,
      phone: data.phone ?? null,
    });
    if (upsertErr) throw new Error(upsertErr.message);

    const { data: existing } = await (supabaseAdmin as any)
      .from("company_requests")
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true, duplicate: true };

    const { error } = await (supabaseAdmin as any).from("company_requests").insert({
      user_id: userId,
      email: data.email,
      company_name: data.company_name,
      fullname: data.fullname,
      phone: data.phone ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super Admin creates company owner directly with email + password.
const CreateCompanySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  fullname: z.string().min(2).max(120),
  company_name: z.string().min(2).max(150),
  phone: z.string().max(40).optional().nullable(),
});

export const createCompanyByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateCompanySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create the user
    let targetUserId: string | null = null;
    const { data: list } = await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = (list?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (found) {
      targetUserId = found.id;
      // Update password
      await (supabaseAdmin as any).auth.admin.updateUserById(found.id, {
        password: data.password,
        email_confirm: true,
      });
    } else {
      const { data: created, error: cErr } = await (supabaseAdmin as any).auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { fullname: data.fullname },
      });
      if (cErr) throw new Error(cErr.message || cErr.msg || JSON.stringify(cErr) || "createUser failed");
      targetUserId = created.user?.id ?? null;
    }
    if (!targetUserId) throw new Error("Корбар сохта нашуд");

    // Create company
    const { data: company, error: coErr } = await (supabaseAdmin as any)
      .from("companies")
      .insert({
        name: data.company_name,
        owner_user_id: targetUserId,
        phone: data.phone ?? null,
        enabled_modules: ALL_MODULE_KEYS,
      })
      .select().single();
    if (coErr) throw new Error(coErr.message);

    // Profile
    await (supabaseAdmin as any).from("profiles").upsert({
      id: targetUserId, fullname: data.fullname, phone: data.phone ?? null, company_id: company.id,
    });

    // Owner role
    await (supabaseAdmin as any).from("user_roles").delete().eq("user_id", targetUserId);
    const { error: rErr } = await (supabaseAdmin as any)
      .from("user_roles").insert({ user_id: targetUserId, role: "owner" });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, company_id: company.id, user_id: targetUserId };
  });

async function requireAdmin(_supabase: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message || "Admin check failed");
  if (!data) throw new Error("Только Super Admin");
}

export const approveCompanyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: rErr } = await (supabaseAdmin as any)
      .from("company_requests").select("*").eq("id", data.request_id).single();
    if (rErr || !req) throw new Error(rErr?.message ?? "Дархост ёфт нашуд");
    if (req.status !== "pending") throw new Error("Аллакай коркард шудааст");

    // Create company
    const { data: company, error: cErr } = await (supabaseAdmin as any)
      .from("companies")
      .insert({
        name: req.company_name,
        owner_user_id: req.user_id,
        phone: req.phone,
        enabled_modules: ALL_MODULE_KEYS,
      })
      .select().single();
    if (cErr) throw new Error(cErr.message);

    // Link profile
    const { error: pErr } = await (supabaseAdmin as any)
      .from("profiles").update({ company_id: company.id }).eq("id", req.user_id);
    if (pErr) throw new Error(pErr.message);

    // Owner role
    await (supabaseAdmin as any).from("user_roles").delete().eq("user_id", req.user_id);
    const { error: roleErr } = await (supabaseAdmin as any)
      .from("user_roles").insert({ user_id: req.user_id, role: "owner" });
    if (roleErr) throw new Error(roleErr.message);

    // Mark request approved
    await (supabaseAdmin as any).from("company_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("id", req.id);

    return { ok: true, company_id: company.id };
  });

export const rejectCompanyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ request_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("company_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", data.request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const suspendCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ company_id: z.string().uuid(), suspend: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("companies")
      .update({ status: data.suspend ? "suspended" : "active" })
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super Admin sets how many staff and projects a company owner may create.
export const setCompanyLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
    max_staff: z.number().int().min(0).max(1000),
    max_projects: z.number().int().min(0).max(1000),
    max_blocks: z.number().int().min(0).max(10000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("companies")
      .update({ max_staff: data.max_staff, max_projects: data.max_projects, max_blocks: data.max_blocks })
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super Admin edits a company's display name and phone. This name is what
// appears on all printed documents (receipts, warehouse issues, etc.).
export const updateCompanyInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
    name: z.string().min(2).max(150),
    phone: z.string().max(40).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("companies")
      .update({ name: data.name, phone: data.phone ?? null })
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super Admin sets which menu modules a company can access.
export const setCompanyModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
    modules: z.array(z.string().max(40)).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("companies")
      .update({ enabled_modules: data.modules })
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



// Super Admin assigns a tariff to a company. Applies the tariff's limits and
// computes the subscription start/end dates from the tariff duration.
export const assignCompanyTariff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
    tariff_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: tariff, error: tErr } = await admin.from("tariffs")
      .select("*").eq("id", data.tariff_id).single();
    if (tErr || !tariff) throw new Error(tErr?.message ?? "Тариф не найден");

    const now = new Date();
    const { tariffDurationDays } = await import("@/lib/constants");
    const days = tariffDurationDays(tariff);
    const expires = days
      ? new Date(now.getTime() + days * 86400_000).toISOString()
      : null; // unlimited

    const patch: Record<string, any> = {
      subscription_tariff_id: tariff.id,
      subscription_started_at: now.toISOString(),
      subscription_expires_at: expires,
      status: "active",
    };
    if (tariff.max_staff != null) patch.max_staff = tariff.max_staff;
    if (tariff.max_projects != null) patch.max_projects = tariff.max_projects;
    if (tariff.max_blocks != null) patch.max_blocks = tariff.max_blocks;

    const { error } = await admin.from("companies").update(patch).eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super Admin extends a company's subscription by N days from the later of
// "now" and the current expiry date.
export const extendCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
    days: z.number().int().min(1).max(3650),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: company, error: cErr } = await admin.from("companies")
      .select("subscription_expires_at").eq("id", data.company_id).single();
    if (cErr || !company) throw new Error(cErr?.message ?? "Компания не найдена");

    const base = company.subscription_expires_at && new Date(company.subscription_expires_at) > new Date()
      ? new Date(company.subscription_expires_at)
      : new Date();
    const expires = new Date(base.getTime() + data.days * 86400_000).toISOString();

    const { error } = await admin.from("companies")
      .update({ subscription_expires_at: expires, status: "active" }).eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super Admin makes a company's subscription unlimited (no expiry).
export const makeCompanyUnlimited = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { error } = await admin.from("companies")
      .update({ subscription_expires_at: null, status: "active" })
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Hard delete a company and ALL of its data, including auth users (emails/logins).
export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    company_id: z.string().uuid(),
    delete_users: z.boolean().optional().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Collect user ids for auth cleanup BEFORE deleting the company.
    const { data: profiles } = await admin.from("profiles").select("id").eq("company_id", data.company_id);
    const userIds = (profiles ?? []).map((p: any) => p.id);

    if (userIds.length) {
      await admin.from("user_roles").delete().in("user_id", userIds);
      await admin.from("company_requests").delete().in("user_id", userIds);
    }

    // Single-transaction cascade delete with triggers disabled (session_replication_role=replica).
    // Handles every project-scoped and company-scoped table in the correct order.
    const { error: rpcErr } = await admin.rpc("admin_delete_company", { _company_id: data.company_id });
    if (rpcErr) throw new Error(rpcErr.message);

    if (userIds.length) {
      await admin.from("profiles").delete().in("id", userIds);
    }

    if (data.delete_users && userIds.length) {
      for (const uid of userIds) {
        try { await admin.auth.admin.deleteUser(uid); } catch { /* ignore */ }
      }
    }

    return { ok: true, deleted_users: userIds.length };
  });

