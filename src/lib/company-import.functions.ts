import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Воридкунии ширкати нав аз файли JSON-и экспорт (формати «BINO SOZ export»).
 * Танҳо Super Admin. Ҳамаи ID-ҳои кӯҳна бо UUID-ҳои нав иваз мешаванд,
 * ширкат ва соҳиби нав сохта мешаванд — маълумоти мавҷуда даст намехӯрад.
 */

// Тартиби гузоштан: аввал ҷадвалҳои мустақил, баъд вобастагиҳо.
const TABLE_ORDER = [
  "projects",
  "floors",
  "apartments",
  "customers",
  "suppliers",
  "warehouse_items",
  "workers",
  "materials",
  "subcontractors",
  "cash_registers",
  "contract_templates",
  "company_directors",
  "estimates",
  "estimate_items",
  "estimate_documents",
  "sales",
  "payment_schedule",
  "payments",
  "expenses",
  "payables",
  "payable_payments",
  "warehouse_receipts",
  "warehouse_issues",
  "material_movements",
  "customer_documents",
  "customer_interactions",
  "attendance",
  "salary_accruals",
  "worker_payments",
  "subcontract_works",
  "subcontract_acts",
  "subcontract_payments",
  "permits",
  "hidden_work_acts",
  "equipment",
  "equipment_usage",
  "equipment_maintenance",
  "car_damages",
  "cash_shifts",
  "cash_operations",
  "tax_reports",
  "barter_deals",
  "resettlements",
  "project_stages",
  "stage_updates",
  "quality_checks",
  "site_incidents",
  "project_budgets",
  "partner_shares",
  "partner_payouts",
  "partner_distributions",
] as const;

// Майдонҳои ишора ба корбарон — бо соҳиби нав пур мешаванд.
const USER_FIELDS = new Set([
  "created_by",
  "confirmed_by",
  "reviewed_by",
  "assigned_to",
  "issued_by",
  "received_by",
  "recorded_by",
  "approved_by",
  "updated_by",
  "closed_by",
  "opened_by",
  "sold_by",
  "accepted_by",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Сутунҳои GENERATED ALWAYS — гузоштан мумкин нест, ҳазф мешаванд.
const GENERATED_COLS: Record<string, Set<string>> = {
  sales: new Set(["remaining_amount"]),
  warehouse_receipts: new Set(["total"]),
  barter_deals: new Set(["remaining"]),
  resettlements: new Set(["total_payable"]),
  subcontract_works: new Set(["contract_amount"]),
  material_acceptance_acts: new Set(["variance", "variance_pct", "loss_amount"]),
};

const ImportSchema = z.object({
  payload: z.object({
    _meta: z.object({ company: z.string().max(200).optional() }).passthrough().optional(),
    data: z.record(z.string(), z.any()),
  }).passthrough(),
  company_name: z.string().min(2).max(150),
  owner_email: z.string().email().max(255),
  owner_password: z.string().min(6).max(72),
  owner_fullname: z.string().min(1).max(120),
});

export const importCompanyExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ImportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pa } = await supabase
      .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (!pa) throw new Error("Только Super Admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const src = data.payload.data as Record<string, unknown>;
    const srcCompany = (src.company ?? null) as Record<string, any> | null;
    if (!srcCompany?.id) throw new Error("Файл нодуруст аст: ширкат ёфт нашуд");
    const oldCompanyId = String(srcCompany.id);

    // 1) Соҳиби нав: ё корбари мавҷуда ё нав сохта мешавад.
    let ownerId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
    const found = existing?.users?.find(
      (u: any) => u.email?.toLowerCase() === data.owner_email.toLowerCase(),
    );
    if (found) {
      ownerId = found.id;
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: data.owner_email,
        password: data.owner_password,
        email_confirm: true,
        user_metadata: { fullname: data.owner_fullname },
      });
      if (cErr) throw new Error(cErr.message);
      ownerId = created.user?.id ?? null;
    }
    if (!ownerId) throw new Error("Соҳиб сохта нашуд");

    // 2) Ширкати нав.
    const { data: company, error: compErr } = await admin
      .from("companies")
      .insert({
        name: data.company_name,
        owner_user_id: ownerId,
        phone: srcCompany.phone ?? null,
        enabled_modules: Array.isArray(srcCompany.enabled_modules)
          ? srcCompany.enabled_modules
          : [],
        kiosk_enabled: srcCompany.kiosk_enabled ?? false,
        max_staff: srcCompany.max_staff ?? 10,
        max_projects: srcCompany.max_projects ?? 5,
        max_blocks: srcCompany.max_blocks ?? 50,
      })
      .select("id")
      .single();
    if (compErr) throw new Error(compErr.message);
    const newCompanyId: string = company.id;

    try {
      // Профил + нақши соҳиб.
      await admin.from("profiles").upsert({
        id: ownerId,
        fullname: data.owner_fullname,
        company_id: newCompanyId,
      });
      const { data: hasOwnerRole } = await admin
        .from("user_roles").select("id").eq("user_id", ownerId).eq("role", "owner").maybeSingle();
      if (!hasOwnerRole) {
        await admin.from("user_roles").insert({ user_id: ownerId, role: "owner" });
      }

      // 3) Харитаи ID-ҳо: ҳар ID-и кӯҳна → UUID-и нав.
      const idMap = new Map<string, string>();
      idMap.set(oldCompanyId, newCompanyId);
      for (const [key, val] of Object.entries(src)) {
        if (!Array.isArray(val)) continue;
        for (const row of val as Record<string, any>[]) {
          const id = row?.id;
          if (typeof id === "string" && UUID_RE.test(id) && !idMap.has(id)) {
            idMap.set(id, crypto.randomUUID());
          }
        }
      }

      // 4) Ивазкунии рекурсивии ишораҳо.
      const remapValue = (key: string, value: any): any => {
        if (value == null) return value;
        if (typeof value === "string") {
          if (UUID_RE.test(value)) {
            if (idMap.has(value)) return idMap.get(value);
            if (USER_FIELDS.has(key) || key === "user_id") return ownerId;
            return value;
          }
          // Масирҳои файлҳо (storage): префикси ширкати кӯҳна → нав.
          if (value.includes(oldCompanyId)) return value.split(oldCompanyId).join(newCompanyId);
          return value;
        }
        if (Array.isArray(value)) return value.map((v) => remapValue(key, v));
        if (typeof value === "object") {
          const out: Record<string, any> = {};
          for (const [k, v] of Object.entries(value)) out[k] = remapValue(k, v);
          return out;
        }
        return value;
      };

      const remapRow = (row: Record<string, any>): Record<string, any> => {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (k === "company_id") { out[k] = newCompanyId; continue; }
          out[k] = remapValue(k, v);
        }
        return out;
      };

      // 5) Сутунҳои ҳақиқии ҳар ҷадвал — сутунҳои кӯҳнаи файл ҳазф мешаванд.
      const { data: colMap, error: colErr } = await admin.rpc("list_public_columns");
      if (colErr) throw new Error(colErr.message);
      const tableCols = new Map<string, Set<string>>();
      for (const [t, cols] of Object.entries((colMap ?? {}) as Record<string, string[]>)) {
        tableCols.set(t, new Set(cols));
      }

      // 6) Гузоштан ба тартиб, дастаҳои 200-та.
      const inserted: Record<string, number> = {};
      for (const table of TABLE_ORDER) {
        const rows = src[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const genCols = GENERATED_COLS[table];
        let list = (rows as Record<string, any>[]).map((r) => {
          const mapped = remapRow(r);
          if (genCols) for (const c of genCols) delete mapped[c];
          const allowed = tableCols.get(table);
          if (allowed) for (const k of Object.keys(mapped)) if (!allowed.has(k)) delete mapped[k];
          return mapped;
        });
        // apartments: рақами хона ҳатмӣ аст — агар холӣ бошад, рақами автоматӣ.
        if (table === "apartments") {
          list = list.map((r, i) => ({
            ...r,
            apartment_number: r.apartment_number ?? String(i + 1),
          }));
        }
        // projects: аввал падарҳо (parent_id = null).
        if (table === "projects") {
          list = [...list].sort((a, b) => Number(a.parent_id != null) - Number(b.parent_id != null));
        }
        for (let i = 0; i < list.length; i += 200) {
          const chunk = list.slice(i, i + 200);
          const { error } = await admin.from(table).insert(chunk);
          if (error) throw new Error(`${table}: ${error.message}`);
        }
        inserted[table] = list.length;
      }

      return { ok: true, company_id: newCompanyId, owner_id: ownerId, inserted };
    } catch (e) {
      // Баргашт: ширкати нав ва пайвандҳоро тоза мекунем.
      await admin.from("companies").delete().eq("id", newCompanyId);
      throw e;
    }
  });
