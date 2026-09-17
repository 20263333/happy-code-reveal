import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemRow = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(20).default("шт"),
  quantity: z.number().min(0).max(1_000_000_000).default(0),
  unit_price: z.number().min(0).max(1_000_000_000).default(0),
});

const Schema = z.object({
  rows: z.array(ItemRow).min(1).max(3000),
});

export const importWarehouseItemsFromExcel = createServerFn({ method: "POST" })
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

    const { data: existing } = await admin
      .from("warehouse_items").select("id, name, unit").eq("company_id", prof.company_id);

    const key = (n: string, u: string) => `${n.trim().toLowerCase()}::${u.trim().toLowerCase()}`;
    const idByKey = new Map<string, string>(
      (existing ?? []).map((x: any) => [key(x.name, x.unit), x.id]),
    );

    let created = 0;
    let updated = 0;
    const inserts: any[] = [];

    for (const r of data.rows) {
      const k = key(r.name, r.unit);
      const existingId = idByKey.get(k);
      if (existingId) {
        const upd: any = { quantity: r.quantity };
        if (r.unit_price > 0) upd.unit_price = r.unit_price;
        const { error } = await admin.from("warehouse_items").update(upd).eq("id", existingId);
        if (error) throw new Error("Навсозӣ: " + error.message);
        updated++;
      } else {
        inserts.push({
          company_id: prof.company_id,
          name: r.name.trim(),
          unit: r.unit.trim(),
          quantity: r.quantity,
          unit_price: r.unit_price,
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await admin.from("warehouse_items").insert(inserts);
      if (error) throw new Error("Илова: " + error.message);
      created = inserts.length;
    }

    return { ok: true as const, created, updated };
  });
