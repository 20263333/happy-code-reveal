import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  user_id: z.string().uuid(),
  extra_pages: z.array(z.string().max(100)).max(200),
  denied_pages: z.array(z.string().max(100)).max(200),
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

export const setStaffPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Schema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, userId);
    if (!isOwner) throw new Error("Только владелец может менять доступ");
    if (!companyId) throw new Error("Компания не найдена");

    // Target must belong to owner's company.
    const { data: targetProf } = await admin
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Сотрудник не найден в вашей компании");
    }

    const { error } = await admin
      .from("profiles")
      .update({ extra_pages: data.extra_pages, denied_pages: data.denied_pages })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const setStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, userId);
    if (!isOwner) throw new Error("Танҳо соҳиб метавонад паролро иваз кунад");
    if (!companyId) throw new Error("Компания не найдена");

    // Target must belong to owner's company.
    const { data: targetProf } = await admin
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Сотрудник не найден в вашей компании");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
