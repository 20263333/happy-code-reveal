import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const admin = () => supabaseAdmin as any;

export async function isOwnerOrAdmin(supabase: any, userId: string) {
  const [{ data: pa }, { data: role }] = await Promise.all([
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle(),
  ]);
  return { isAdmin: !!pa, isOwner: !!role };
}

/** Planned amount and already-spent fact for one project+floor+category. */
export async function budgetState(
  db: any,
  projectId: string,
  floorId: string | null,
  category: string,
) {
  let bq = db.from("project_budgets").select("planned_amount")
    .eq("project_id", projectId).eq("category", category);
  bq = floorId ? bq.eq("floor_id", floorId) : bq.is("floor_id", null);
  const { data: budget } = await bq.maybeSingle();

  let eq_ = db.from("expenses").select("amount")
    .eq("project_id", projectId).eq("category", category);
  eq_ = floorId ? eq_.eq("floor_id", floorId) : eq_.is("floor_id", null);
  const { data: exps } = await eq_;

  const planned = budget ? Number(budget.planned_amount || 0) : null;
  const spent = (exps ?? []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  return { planned, spent, remaining: planned == null ? null : planned - spent };
}
