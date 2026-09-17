import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SupplierRow = z.object({
  name: z.string().min(1).max(200),
  contact_person: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

const SuppliersSchema = z.object({
  rows: z.array(SupplierRow).min(1).max(3000),
});

export const importSuppliersFromExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SuppliersSchema.parse(d))
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
      .from("suppliers").select("id, name, phone").eq("company_id", prof.company_id);

    const norm = (s: string | null | undefined) => (s ?? "").toString().trim().toLowerCase();
    const digits = (s: string | null | undefined) => (s ?? "").toString().replace(/\D/g, "");

    const byName = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const s of existing ?? []) {
      if (s.name) byName.set(norm(s.name), s.id);
      const p = digits(s.phone);
      if (p) byPhone.set(p, s.id);
    }

    let created = 0;
    let updated = 0;
    const inserts: any[] = [];

    for (const r of data.rows) {
      const p = digits(r.phone);
      const existingId = byName.get(norm(r.name)) || (p && byPhone.get(p));
      const payload: any = {
        name: r.name.trim(),
        contact_person: r.contact_person?.trim() || null,
        phone: r.phone?.trim() || null,
        address: r.address?.trim() || null,
        note: r.note?.trim() || null,
      };
      if (existingId) {
        const { error } = await admin.from("suppliers").update(payload).eq("id", existingId);
        if (error) throw new Error("Навсозӣ: " + error.message);
        updated++;
      } else {
        inserts.push({ ...payload, company_id: prof.company_id, created_by: userId, archived: false });
        byName.set(norm(r.name), "pending");
        if (p) byPhone.set(p, "pending");
      }
    }

    if (inserts.length > 0) {
      const { error } = await admin.from("suppliers").insert(inserts);
      if (error) throw new Error("Илова: " + error.message);
      created = inserts.length;
    }

    return { ok: true as const, created, updated };
  });
