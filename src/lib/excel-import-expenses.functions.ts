import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExpenseRow = z.object({
  amount: z.number().min(0).max(1_000_000_000_000),
  category: z.string().max(50).default("other"),
  description: z.string().max(500).optional().nullable(),
  expense_date: z.string().max(20),
  employee_name: z.string().max(200).optional().nullable(),
});

const Schema = z.object({
  project_id: z.string().uuid(),
  rows: z.array(ExpenseRow).min(1).max(5000),
});

export const importExpensesFromExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Шумо ба ягон ширкат тааллуқ надоред");

    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!role) throw new Error("Танҳо соҳиби ширкат метавонад импорт кунад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: project } = await admin
      .from("projects").select("id, company_id").eq("id", data.project_id).maybeSingle();
    if (!project || project.company_id !== prof.company_id) {
      throw new Error("Лоиҳа ёфт нашуд");
    }

    const inserts = data.rows.map((r) => ({
      project_id: data.project_id,
      amount: r.amount,
      category: r.category || "other",
      description: r.description?.trim() || null,
      expense_date: r.expense_date,
      employee_name: r.employee_name?.trim() || null,
      currency: "TJS",
      created_by: userId,
    }));

    const { error } = await admin.from("expenses").insert(inserts);
    if (error) throw new Error("Илова: " + error.message);

    return { ok: true as const, created: inserts.length };
  });
