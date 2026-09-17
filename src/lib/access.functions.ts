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

export const grantProjectAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateAccessSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Only owner can grant access
    const { supabase, userId } = context;
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Только владелец может выдавать доступ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    // Get owner's company_id and assign staff to it
    const { data: ownerProf } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = (ownerProf as any)?.company_id;
    if (!companyId) throw new Error("У вас нет компании");

    // Enforce the staff quota set by the Super Admin — only when adding a NEW member.
    const { data: alreadyStaff } = await (supabaseAdmin as any)
      .from("profiles").select("id, company_id").eq("id", targetUserId).maybeSingle();
    const isNewToCompany = !alreadyStaff || alreadyStaff.company_id !== companyId;
    if (isNewToCompany) {
      const { data: company } = await (supabaseAdmin as any)
        .from("companies").select("max_staff, owner_user_id").eq("id", companyId).maybeSingle();
      const { count: staffCount } = await (supabaseAdmin as any)
        .from("profiles").select("id", { count: "exact", head: true })
        .eq("company_id", companyId).neq("id", company?.owner_user_id ?? companyId);
      const maxStaff = company?.max_staff ?? 0;
      if ((staffCount ?? 0) >= maxStaff) {
        throw new Error(`Лимити кормандон пур шуд (${maxStaff}). Бо Super Admin тамос гиред.`);
      }
    }

    // Ensure profile + manager role exists (trigger usually does, but for safety)
    await (supabaseAdmin as any).from("profiles").upsert({
      id: targetUserId,
      fullname: data.fullname,
      company_id: companyId,
    });


    const { data: hasRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!hasRole) {
      await supabaseAdmin.from("user_roles").insert({ user_id: targetUserId, role: "manager" });
    }

    // Build the list of projects to assign (primary + any extra selected),
    // de-duplicated. Assign EXACTLY what the owner selected — no parent/child
    // expansion. RLS already lets a block-only employee read the parent ЖК
    // row, while sibling blocks stay hidden.
    const requestedIds = Array.from(new Set([data.project_id, ...(data.project_ids ?? [])]));
    const { data: companyProjects } = await (supabaseAdmin as any)
      .from("projects")
      .select("id, parent_id")
      .eq("company_id", companyId);
    const allCompanyProjects = (companyProjects ?? []) as { id: string; parent_id: string | null }[];
    const companyIds = new Set(allCompanyProjects.map((p) => p.id));
    const validIds = requestedIds.filter((id) => companyIds.has(id));


    for (const pid of validIds) {
      const { data: psExists } = await supabaseAdmin
        .from("project_staff")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("project_id", pid)
        .maybeSingle();
      if (!psExists) {
        const { error: psErr } = await supabaseAdmin
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
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Только владелец");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
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
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Только владелец может выдавать доступ");

    // Owner's company
    const { data: ownerProf } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = (ownerProf as any)?.company_id;
    if (!companyId) throw new Error("У вас нет компании");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The target user must belong to the owner's company.
    const { data: targetProf } = await (supabaseAdmin as any)
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Сотрудник не найден в вашей компании");
    }

    // The project must belong to the owner's company. Grant access ONLY to the
    // selected project (ЖК or block) — no parent/child expansion, so a block
    // assignment never exposes sibling blocks.
    const { data: companyProjects } = await (supabaseAdmin as any)
      .from("projects")
      .select("id, parent_id, company_id")
      .eq("company_id", companyId);
    const allCompanyProjects = (companyProjects ?? []) as { id: string; parent_id: string | null; company_id: string }[];
    const selected = allCompanyProjects.find((p) => p.id === data.project_id);
    if (!selected) throw new Error("Проект не найден");

    // Idempotent assignment
    const rows = [{ user_id: data.user_id, project_id: selected.id }];

    const { error } = await (supabaseAdmin as any)
      .from("project_staff")
      .upsert(rows, { onConflict: "project_id,user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
