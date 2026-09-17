import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Танҳо Super Admin");
}

export const approveSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: pay, error } = await admin.from("subscription_payments")
      .select("*").eq("id", data.payment_id).single();
    if (error || !pay) throw new Error(error?.message ?? "Заявка не найдена");
    if (pay.status !== "pending") throw new Error("Уже обработано");

    const { data: tariff } = await admin.from("tariffs").select("billing_period, duration_days").eq("id", pay.tariff_id).single();
    const { tariffDurationDays } = await import("@/lib/constants");
    const days = tariff ? tariffDurationDays(tariff) : null;
    const expires = days
      ? new Date(Date.now() + days * 86400_000).toISOString()
      : null; // unlimited

    await admin.from("subscription_payments").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      activated_until: expires,
    }).eq("id", pay.id);

    await admin.from("companies").update({
      subscription_tariff_id: pay.tariff_id,
      subscription_expires_at: expires,
      status: "active",
    }).eq("id", pay.company_id);

    return { ok: true };
  });

export const rejectSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    payment_id: z.string().uuid(),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("subscription_payments").update({
      status: "rejected",
      reject_reason: data.reason ?? null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", data.payment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: req, error } = await admin.from("company_change_requests")
      .select("*").eq("id", data.request_id).single();
    if (error || !req) throw new Error("Заявка не найдена");
    if (req.status !== "pending") throw new Error("Уже обработано");

    const allowed: Record<string, true> = { name: true, phone: true };
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.requested_changes ?? {})) {
      if (allowed[k] && v !== null && v !== undefined && v !== "") patch[k] = v;
    }
    if (Object.keys(patch).length) {
      const { error: uErr } = await admin.from("companies").update(patch).eq("id", req.company_id);
      if (uErr) throw new Error(uErr.message);
    }
    await admin.from("company_change_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", req.id);
    return { ok: true };
  });

export const rejectChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    request_id: z.string().uuid(),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("company_change_requests").update({
      status: "rejected",
      reject_reason: data.reason ?? null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", data.request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Either admin or owner of the file's company
    const { data: pa } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (!pa) {
      const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
      const folder = data.path.split("/")[0];
      if (!prof?.company_id || prof.company_id !== folder) throw new Error("Доступ запрещён");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await (supabaseAdmin as any).storage
      .from("subscription-receipts").createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl as string };
  });
