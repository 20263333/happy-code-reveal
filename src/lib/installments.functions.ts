import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InstallmentDashboardRow = {
  id: string;
  due_date: string;
  amount: number | string;
  paid_amount: number | string;
  status: string | null;
  sales: {
    project_id: string | null;
    customers: { fullname: string | null; phone: string | null } | null;
  } | null;
};

export const getCompanyInstallments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: ownedCompany }, { data: platformAdmin }] = await Promise.all([
      supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
      supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
      supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);

    const companyId = profile?.company_id ?? ownedCompany?.id ?? null;
    if (!companyId) return [] as InstallmentDashboardRow[];

    if (!platformAdmin && profile?.company_id !== companyId && ownedCompany?.id !== companyId) {
      throw new Error("Дастрасӣ манъ аст");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: schedules, error: schedulesError } = await (supabaseAdmin as any)
      .from("payment_schedule")
      .select("id, due_date, amount, paid_amount, status, sales!inner(project_id, company_id, status, customers(fullname, phone))")
      .eq("sales.company_id", companyId)
      .neq("sales.status", "cancelled")
      .order("due_date", { ascending: true })
      .limit(20000);
    if (schedulesError) throw new Error(schedulesError.message);
    return (schedules ?? []) as InstallmentDashboardRow[];
  });