import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  user_id: z.string().uuid(),
  extra_pages: z.array(z.string().max(100)).max(200),
  denied_pages: z.array(z.string().max(100)).max(200),
});

export const setStaffPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be owner.
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Только владелец может менять доступ");

    // Owner's company.
    const { data: ownerProf } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = (ownerProf as any)?.company_id;
    if (!companyId) throw new Error("Компания не найдена");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Target must belong to owner's company.
    const { data: targetProf } = await (supabaseAdmin as any)
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Сотрудник не найден в вашей компании");
    }

    const { error } = await (supabaseAdmin as any)
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
    const { supabase, userId } = context;

    // Caller must be owner.
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Танҳо соҳиб метавонад паролро иваз кунад");

    // Owner's company.
    const { data: ownerProf } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = (ownerProf as any)?.company_id;
    if (!companyId) throw new Error("Компания не найдена");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Target must belong to owner's company.
    const { data: targetProf } = await (supabaseAdmin as any)
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
