import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delete a worker and refund every salary payment he received:
 * salary expenses are removed (money returns to the project/company balance),
 * worker_payments + accruals cascade away, and the cash-register operations
 * are reversed by the existing delete trigger.
 */
export const deleteWorkerWithRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ worker_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Танҳо соҳиби ширкат корманд нест карда метавонад");

    const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = (prof as any)?.company_id;
    if (!companyId) throw new Error("Ширкат ёфт нашуд");

    const { data: worker, error: wErr } = await supabase
      .from("workers").select("id, company_id, fullname").eq("id", data.worker_id).maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!worker || (worker as any).company_id !== companyId) throw new Error("Корманд ёфт нашуд");

    // 1) salary expenses of this worker -> refunded
    const { data: exp, error: eErr } = await supabase
      .from("expenses").select("id, amount").eq("worker_id", data.worker_id).eq("category", "salary");
    if (eErr) throw new Error(eErr.message);
    const refunded = (exp ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

    if ((exp ?? []).length > 0) {
      const { error: dErr } = await supabase
        .from("expenses").delete().in("id", (exp ?? []).map((r: any) => r.id));
      if (dErr) throw new Error(dErr.message);
    }

    // 2) worker payments (cash operations reversed by trigger)
    const { error: pErr } = await supabase.from("worker_payments").delete().eq("worker_id", data.worker_id);
    if (pErr) throw new Error(pErr.message);

    // 3) the worker himself (attendance + accruals cascade)
    const { error: delErr } = await supabase.from("workers").delete().eq("id", data.worker_id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true, refunded, payments: (exp ?? []).length };
  });
