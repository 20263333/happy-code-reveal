import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WorkerRow = z.object({
  fullname: z.string().min(1).max(200),
  position: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  passport_number: z.string().max(50).optional().nullable(),
  daily_rate: z.number().min(0).max(1_000_000).default(0),
});

const Schema = z.object({
  rows: z.array(WorkerRow).min(1).max(3000),
});

export const importWorkersFromExcel = createServerFn({ method: "POST" })
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
      .from("workers").select("id, fullname, phone").eq("company_id", prof.company_id);

    const norm = (s: string | null | undefined) =>
      (s ?? "").toString().trim().toLowerCase();
    const digits = (s: string | null | undefined) => (s ?? "").toString().replace(/\D/g, "");

    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const w of existing ?? []) {
      const p = digits(w.phone);
      if (p) byPhone.set(p, w.id);
      if (w.fullname) byName.set(norm(w.fullname), w.id);
    }

    let created = 0;
    let updated = 0;
    const inserts: any[] = [];

    for (const r of data.rows) {
      const p = digits(r.phone);
      const nameKey = norm(r.fullname);
      const existingId = (p && byPhone.get(p)) || byName.get(nameKey);
      const payload: any = {
        fullname: r.fullname.trim(),
        position: r.position?.trim() || null,
        phone: r.phone?.trim() || null,
        passport_number: r.passport_number?.trim() || null,
        daily_rate: r.daily_rate ?? 0,
      };
      if (existingId) {
        const { error } = await admin.from("workers").update(payload).eq("id", existingId);
        if (error) throw new Error("Навсозӣ: " + error.message);
        updated++;
      } else {
        inserts.push({ ...payload, company_id: prof.company_id, is_active: true });
        if (p) byPhone.set(p, "pending");
        byName.set(nameKey, "pending");
      }
    }

    if (inserts.length > 0) {
      const { error } = await admin.from("workers").insert(inserts);
      if (error) throw new Error("Илова: " + error.message);
      created = inserts.length;
    }

    return { ok: true as const, created, updated };
  });
