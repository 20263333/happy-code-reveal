import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, userId: string) {
  const { data: owns } = await supabase.from("companies")
    .select("id").eq("owner_user_id", userId).maybeSingle();
  const { data: role } = await supabase.from("user_roles")
    .select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!owns && !role) throw new Error("Только владелец компании");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Только Super Admin");
}

export const requestCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    package_size: z.number().int().min(1).max(10000),
    amount: z.number().min(0),
    receipt_path: z.string().max(500).optional().nullable(),
    note: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const { data: owned } = await supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
    const companyId = prof?.company_id ?? owned?.id;
    if (!companyId) throw new Error("Ширкат ёфт нашуд");
    const { error } = await supabase.from("ai_credit_purchases").insert({
      company_id: companyId,
      requested_by: userId,
      package_size: data.package_size,
      amount: data.amount,
      receipt_path: data.receipt_path ?? null,
      note: data.note ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCreditPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).from("ai_credit_purchases")
      .select("*, company:companies(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const approveCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: p, error: pErr } = await admin.from("ai_credit_purchases").select("*").eq("id", data.id).single();
    if (pErr || !p) throw new Error(pErr?.message ?? "Дархост ёфт нашуд");
    if (p.status !== "pending") throw new Error("Аллакай коркард шудааст");

    await admin.from("ai_credits").upsert({ company_id: p.company_id }, { onConflict: "company_id", ignoreDuplicates: true });
    const { data: cur } = await admin.from("ai_credits").select("paid_balance").eq("company_id", p.company_id).single();
    const newBal = (cur?.paid_balance ?? 0) + p.package_size;
    await admin.from("ai_credits").update({ paid_balance: newBal, updated_at: new Date().toISOString() }).eq("company_id", p.company_id);
    await admin.from("ai_credit_purchases").update({
      status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    return { ok: true, new_balance: newBal };
  });

export const rejectCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("ai_credit_purchases").update({
      status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString(),
      rejection_reason: data.reason ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCompanyAiFreeLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    company_id: z.string().uuid(),
    free_limit: z.number().int().min(0).max(100000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    await admin.from("ai_credits").upsert({ company_id: data.company_id, free_limit: data.free_limit }, { onConflict: "company_id" });
    return { ok: true };
  });

export const getReceiptSignedUrlAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await (supabaseAdmin as any).storage
      .from("subscription-receipts").createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl };
  });
