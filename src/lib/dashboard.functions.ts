import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardStats = {
  projects: number;
  customers: number;
  apartmentsTotal: number;
  sold: number;
  available: number;
  revenue: number;
  paymentsSum: number;
  expensesSum: number;
  totalDebt: number;
  warehouse: number;
  workers: number;
  payingCustomers: number;
  payFull: number;
  payInst: number;
};

const inputSchema = z.object({
  project_ids: z.array(z.string().uuid()).max(500).nullable().optional(),
  from_date: z.string().date().nullable().optional(),
  to_date: z.string().date().nullable().optional(),
});

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: stats, error } = await context.supabase.rpc("dashboard_company_stats", {
      _project_ids: data.project_ids ?? undefined,
      _from_date: data.from_date ?? undefined,
      _to_date: data.to_date ?? undefined,
    });
    if (error) throw new Error(error.message);
    return stats as unknown as DashboardStats;
  });