import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPassportOcrConfigured, extractPassportFromImages, type PassportOcrResult } from "./passport-ocr.server";

const KIOSK_SESSION_NAME = "kiosk-gate";
const KIOSK_MAX_AGE = 60 * 60 * 12; // 12h

type KioskSession = { unlocked?: boolean; company_id?: string; user_id?: string };

function sessionConfig() {
  const password = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "kiosk-dev-secret-please-set-SESSION_SECRET-32chars";
  return {
    password: password.padEnd(32, "x"),
    name: KIOSK_SESSION_NAME,
    maxAge: KIOSK_MAX_AGE,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function hashPin(pin: string): string {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

async function assertOwner(supabase: any, userId: string): Promise<string> {
  const { data: company } = await supabase
    .from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
  if (!company) throw new Error("Танҳо соҳиби ширкат метавонад");
  return company.id;
}

// ---------- Owner: setup ----------
export const setKioskPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    pin: z.string().regex(/^\d{4,6}$/, "PIN 4-6 рақам"),
    enabled: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e1 } = await (supabaseAdmin as any)
      .from("company_kiosk_secrets")
      .upsert({ company_id: companyId, kiosk_pin_hash: hashPin(data.pin) }, { onConflict: "company_id" });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await (supabaseAdmin as any)
      .from("companies")
      .update({ kiosk_enabled: data.enabled ?? true })
      .eq("id", companyId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const setKioskEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("companies").update({ kiosk_enabled: data.enabled }).eq("id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantKioskAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("company_kiosk_access")
      .upsert({ company_id: companyId, user_id: data.user_id, granted_by: context.userId }, { onConflict: "company_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeKioskAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("company_kiosk_access")
      .delete().eq("company_id", companyId).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getKioskSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: c } = await admin.from("companies")
      .select("kiosk_enabled").eq("id", companyId).maybeSingle();
    // Ensure a kiosk-secrets row exists (auto-generates the kiosk_token)
    await admin.from("company_kiosk_secrets")
      .upsert({ company_id: companyId }, { onConflict: "company_id", ignoreDuplicates: true });
    const { data: sec } = await admin.from("company_kiosk_secrets")
      .select("kiosk_pin_hash, kiosk_token").eq("company_id", companyId).maybeSingle();
    const { data: access } = await admin.from("company_kiosk_access")
      .select("user_id, created_at").eq("company_id", companyId);
    const userIds = (access ?? []).map((a: any) => a.user_id);
    let profiles: any[] = [];
    if (userIds.length) {
      const { data: pf } = await admin.from("profiles")
        .select("id, fullname, phone").in("id", userIds);
      profiles = pf ?? [];
    }
    return {
      enabled: !!c?.kiosk_enabled,
      pin_set: !!sec?.kiosk_pin_hash,
      kiosk_token: sec?.kiosk_token ?? null,
      access: (access ?? []).map((a: any) => ({
        user_id: a.user_id,
        created_at: a.created_at,
        profile: profiles.find((p: any) => p.id === a.user_id) ?? null,
      })),
    };
  });

// ---------- Kiosk unlock ----------
export const kioskUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pin: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Determine the user's company: owner or member with kiosk access
    const { data: owned } = await admin.from("companies")
      .select("id, kiosk_enabled").eq("owner_user_id", context.userId).maybeSingle();
    let companyRow: any = owned;
    if (!companyRow) {
      const { data: acc } = await admin.from("company_kiosk_access")
        .select("company_id").eq("user_id", context.userId).limit(1).maybeSingle();
      if (!acc) return { ok: false as const, reason: "no_access" };
      const { data: c } = await admin.from("companies")
        .select("id, kiosk_enabled").eq("id", acc.company_id).maybeSingle();
      companyRow = c;
    }
    if (!companyRow || !companyRow.kiosk_enabled) return { ok: false as const, reason: "disabled" };
    const { data: sec } = await admin.from("company_kiosk_secrets")
      .select("kiosk_pin_hash").eq("company_id", companyRow.id).maybeSingle();
    if (!sec?.kiosk_pin_hash) return { ok: false as const, reason: "no_pin" };

    const inputHash = Buffer.from(hashPin(data.pin), "hex");
    const storedHash = Buffer.from(sec.kiosk_pin_hash, "hex");
    if (inputHash.length !== storedHash.length || !timingSafeEqual(inputHash, storedHash)) {
      return { ok: false as const, reason: "bad_pin" };
    }

    const session = await useSession<KioskSession>(sessionConfig());
    await session.update({ unlocked: true, company_id: companyRow.id, user_id: context.userId });
    return { ok: true as const, company_id: companyRow.id };
  });

// Public unlock via kiosk link token + PIN (no login required — for standalone kiosk screens)
export const kioskPublicUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().uuid(),
    pin: z.string().min(1),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: sec } = await admin.from("company_kiosk_secrets")
      .select("company_id, kiosk_pin_hash").eq("kiosk_token", data.token).maybeSingle();
    if (!sec) return { ok: false as const, reason: "no_access" };
    const { data: companyRow } = await admin.from("companies")
      .select("id, kiosk_enabled").eq("id", sec.company_id).maybeSingle();
    if (!companyRow) return { ok: false as const, reason: "no_access" };
    if (!companyRow.kiosk_enabled) return { ok: false as const, reason: "disabled" };
    if (!sec.kiosk_pin_hash) return { ok: false as const, reason: "no_pin" };

    const inputHash = Buffer.from(hashPin(data.pin), "hex");
    const storedHash = Buffer.from(sec.kiosk_pin_hash, "hex");
    if (inputHash.length !== storedHash.length || !timingSafeEqual(inputHash, storedHash)) {
      return { ok: false as const, reason: "bad_pin" };
    }

    const session = await useSession<KioskSession>(sessionConfig());
    await session.update({ unlocked: true, company_id: companyRow.id });
    return { ok: true as const, company_id: companyRow.id };
  });

export const kioskLock = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<KioskSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const kioskStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<KioskSession>(sessionConfig());
  return {
    unlocked: !!session.data.unlocked,
    company_id: session.data.company_id ?? null,
  };
});

export const kioskExtractPassport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    front: z.string().min(10),
    back: z.string().min(10).optional().nullable(),
  }).parse(d))
  .handler(async ({ data }): Promise<PassportOcrResult> => {
    const s = await requireUnlockedSession();
    assertPassportOcrConfigured();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("consume_scan_credit", { _company_id: s.company_id });
    if (error) {
      if (error.message?.includes("no_scan_credits")) throw new Error("no_scan_credits");
      throw new Error(error.message);
    }
    return extractPassportFromImages(data);
  });

// ---------- Kiosk data (unlocked only) ----------
async function requireUnlockedSession() {
  const session = await useSession<KioskSession>(sessionConfig());
  if (!session.data.unlocked || !session.data.company_id) {
    throw new Error("kiosk_locked");
  }
  return session.data as { unlocked: true; company_id: string; user_id: string };
}

export const kioskListProjects = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireUnlockedSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data, error } = await admin.from("projects")
    .select("id, name, parent_id, location, cover_url")
    .eq("company_id", s.company_id).is("parent_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const kioskGetProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await requireUnlockedSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: project } = await admin.from("projects")
      .select("id, name, location, parent_id, company_id")
      .eq("id", data.project_id).maybeSingle();
    if (!project || project.company_id !== s.company_id) throw new Error("Not found");

    // Blocks: if this is a top-level, list its blocks. Otherwise use this project as the only "block".
    let blocks: any[] = [];
    if (project.parent_id === null) {
      const { data: b } = await admin.from("projects")
        .select("id, name").eq("parent_id", project.id).order("name");
      blocks = b ?? [];
      if (blocks.length === 0) blocks = [project];
    } else {
      blocks = [project];
    }

    const blockIds = blocks.map((b) => b.id);
    const { data: floors } = await admin.from("floors")
      .select("id, project_id, floor_number").in("project_id", blockIds)
      .order("floor_number", { ascending: true });
    const { data: apartments } = await admin.from("apartments")
      .select("id, project_id, floor_id, apartment_number, area, price, price_per_sqm, status, plan_image_path, tour_url, tour_media_paths")
      .in("project_id", blockIds);

    return { project, blocks, floors: floors ?? [], apartments: apartments ?? [] };
  });

export const kioskSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    bucket: z.enum(["apartment-plans", "apartment-tours"]),
    path: z.string().min(1),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlockedSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await (supabaseAdmin as any).storage
      .from(data.bucket).createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

// ---------- Kiosk: create sale ----------
export const kioskCreateSale = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    apartment_id: z.string().uuid(),
    customer: z.object({
      fullname: z.string().min(1),
      first_name: z.string().optional().nullable(),
      last_name: z.string().optional().nullable(),
      middle_name: z.string().optional().nullable(),
      phone: z.string().min(1),
      passport_series: z.string().optional().nullable(),
      passport_number: z.string().optional().nullable(),
      personal_id: z.string().optional().nullable(),
      birth_date: z.string().optional().nullable(),
      gender: z.string().optional().nullable(),
      nationality: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      passport_issued_by: z.string().optional().nullable(),
      issuing_authority: z.string().optional().nullable(),
      passport_issued_date: z.string().optional().nullable(),
      passport_expiry_date: z.string().optional().nullable(),
      inn: z.string()
        .optional()
        .nullable()
        .transform((v) => (v ? v.replace(/\D/g, "") : v))
        .refine((v) => !v || /^\d{9}$/.test(v), { message: "ИНН бояд аз 9 рақам иборат бошад" }),
    }),
    payment_type: z.enum(["cash", "installment"]),
    down_payment: z.number().nonnegative().optional(),
    installment_months: z.number().int().positive().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const s = await requireUnlockedSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: apt, error: aErr } = await admin.from("apartments")
      .select("id, project_id, price, status").eq("id", data.apartment_id).maybeSingle();
    if (aErr || !apt) throw new Error("Хонагӣ ёфт нашуд");

    // Confirm apartment belongs to this company via project
    const { data: proj } = await admin.from("projects")
      .select("id, company_id, parent_id").eq("id", apt.project_id).maybeSingle();
    if (!proj) throw new Error("Проект ёфт нашуд");
    let projCompanyId = proj.company_id;
    if (!projCompanyId && proj.parent_id) {
      const { data: parent } = await admin.from("projects")
        .select("company_id").eq("id", proj.parent_id).maybeSingle();
      projCompanyId = parent?.company_id;
    }
    if (projCompanyId !== s.company_id) throw new Error("Дастрасӣ нест");

    const price = Number(apt.price ?? 0);
    const isCash = data.payment_type === "cash";
    const down = isCash ? price : Number(data.down_payment ?? 0);
    const months = isCash ? 0 : Number(data.installment_months ?? 12);

    const nullIfEmpty = (v?: string | null) => (v && v.length ? v : null);

    // Try to find existing customer by (company + phone) to avoid duplicates
    let customerId: string | null = null;
    const { data: existing } = await admin.from("customers")
      .select("id").eq("company_id", s.company_id).eq("phone", data.customer.phone).maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: cust, error: cErr } = await admin.from("customers").insert({
        fullname: data.customer.fullname,
        first_name: nullIfEmpty(data.customer.first_name),
        last_name: nullIfEmpty(data.customer.last_name),
        middle_name: nullIfEmpty(data.customer.middle_name),
        phone: data.customer.phone,
        company_id: s.company_id,
        passport_series: nullIfEmpty(data.customer.passport_series),
        passport_number: nullIfEmpty(data.customer.passport_number),
        personal_id: nullIfEmpty(data.customer.personal_id),
        birth_date: nullIfEmpty(data.customer.birth_date),
        gender: nullIfEmpty(data.customer.gender),
        nationality: nullIfEmpty(data.customer.nationality),
        address: nullIfEmpty(data.customer.address),
        passport_issued_by: nullIfEmpty(data.customer.passport_issued_by),
        issuing_authority: nullIfEmpty(data.customer.issuing_authority) ?? nullIfEmpty(data.customer.passport_issued_by),
        passport_issued_date: nullIfEmpty(data.customer.passport_issued_date),
        passport_expiry_date: nullIfEmpty(data.customer.passport_expiry_date),
        inn: nullIfEmpty(data.customer.inn),
      }).select("id").single();
      if (cErr) throw new Error(cErr.message);
      customerId = cust.id;
    }

    const { data: sale, error: sErr } = await admin.from("sales").insert({
      customer_id: customerId,
      apartment_id: apt.id,
      project_id: apt.project_id,
      full_price: price,
      paid_amount: down,
      installment_months: months,
      currency: "TJS",
      status: "active",
    }).select("id").single();
    if (sErr) throw new Error(sErr.message);

    if (down > 0) {
      const { error: pErr } = await admin.from("payments").insert({
        sale_id: sale.id,
        amount: down,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: "cash",
        currency: "TJS",
        status: "confirmed",
      });
      if (pErr) throw new Error(pErr.message);
    }

    // Auto-generate installment payment schedule so it shows in owner's Clients section
    const remaining = Math.max(price - down, 0);
    if (months > 0 && remaining > 0) {
      const monthlyAmt = Math.floor(remaining / months);
      const baseDate = new Date();
      baseDate.setMonth(baseDate.getMonth() + 1);
      const rows = [];
      for (let i = 0; i < months; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        rows.push({
          sale_id: sale.id,
          due_date: d.toISOString().slice(0, 10),
          amount: i === months - 1 ? remaining - monthlyAmt * (months - 1) : monthlyAmt,
        });
      }
      await admin.from("payment_schedule").insert(rows);
    }

    await admin.from("apartments")
      .update({ status: isCash ? "sold" : "installment" })
      .eq("id", apt.id);

    return { ok: true as const, sale_id: sale.id, customer_id: customerId };
  });

export const kioskGetSaleByApartment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ apartment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await requireUnlockedSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: sale } = await admin.from("sales")
      .select("id, customer_id, apartment_id, project_id, full_price, paid_amount, installment_months, created_at")
      .eq("apartment_id", data.apartment_id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    if (!sale) return { sale: null, customer: null, schedule: [] as any[] };
    const { data: proj } = await admin.from("projects").select("company_id, parent_id").eq("id", sale.project_id).maybeSingle();
    let companyId = proj?.company_id;
    if (!companyId && proj?.parent_id) {
      const { data: parent } = await admin.from("projects").select("company_id").eq("id", proj.parent_id).maybeSingle();
      companyId = parent?.company_id;
    }
    if (companyId !== s.company_id) return { sale: null, customer: null, schedule: [] as any[] };
    const { data: customer } = await admin.from("customers")
      .select("fullname, phone, passport_series, passport_number, birth_date, address, passport_issued_by, passport_issued_date, passport_expiry_date")
      .eq("id", sale.customer_id).maybeSingle();
    const { data: schedule } = await admin.from("payment_schedule")
      .select("id, due_date, amount, paid_amount, status")
      .eq("sale_id", sale.id)
      .order("due_date", { ascending: true });
    return { sale, customer, schedule: schedule ?? [] };
  });

export const kioskGetContractTemplate = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireUnlockedSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: template } = await admin.from("contract_templates")
    .select("*").eq("company_id", s.company_id).maybeSingle();
  const { data: company } = await admin.from("companies")
    .select("name, phone").eq("id", s.company_id).maybeSingle();
  return { template, company };
});
