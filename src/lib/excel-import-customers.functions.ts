import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerRow = z.object({
  fullname: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  passport: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  birth_date: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.string().max(30).optional().nullable(),
});

const Schema = z.object({
  rows: z.array(CustomerRow).min(1).max(5000),
});

function normPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export const importCustomersFromExcel = createServerFn({ method: "POST" })
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
      .from("customers").select("id, fullname, phone").eq("company_id", prof.company_id);

    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const c of existing ?? []) {
      const np = normPhone(c.phone);
      if (np) byPhone.set(np, c.id);
      if (c.fullname) byName.set(c.fullname.trim().toLowerCase(), c.id);
    }

    let created = 0;
    let updated = 0;
    const inserts: any[] = [];

    for (const r of data.rows) {
      const np = normPhone(r.phone);
      const nameKey = r.fullname.trim().toLowerCase();
      const existingId = (np && byPhone.get(np)) || byName.get(nameKey);
      const payload: any = {
        fullname: r.fullname.trim(),
        phone: r.phone?.trim() || null,
        passport: r.passport?.trim() || null,
        address: r.address?.trim() || null,
        birth_date: r.birth_date?.trim() || null,
        notes: r.notes?.trim() || null,
        status: r.status?.trim() || "new",
      };

      if (existingId) {
        const { error } = await admin.from("customers").update(payload).eq("id", existingId);
        if (error) throw new Error("Навсозӣ: " + error.message);
        updated++;
      } else {
        inserts.push({ ...payload, company_id: prof.company_id, created_by: userId });
        if (np) byPhone.set(np, "pending");
        byName.set(nameKey, "pending");
      }
    }

    if (inserts.length > 0) {
      const { error } = await admin.from("customers").insert(inserts);
      if (error) throw new Error("Илова: " + error.message);
      created = inserts.length;
    }

    return { ok: true as const, created, updated };
  });
