import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Танҳо Super Admin");
}

export const submitSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tariff_id: z.string().uuid(),
    payment_method_id: z.string().uuid().nullable(),
    receipt_path: z.string().min(3).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [{ data: owned, error: ownedError }, { data: profile, error: profileError }, { data: ownerRole, error: roleError }] = await Promise.all([
      admin.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
      admin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "owner").maybeSingle(),
    ]);
    if (ownedError || profileError || roleError) {
      throw new Error(ownedError?.message ?? profileError?.message ?? roleError?.message ?? "Маълумоти ширкат хонда нашуд");
    }

    const companyId = owned?.id ?? (ownerRole ? profile?.company_id : null);
    if (!companyId) throw new Error("Танҳо соҳиби ширкат метавонад пардохт фиристад");
    if (!data.receipt_path.startsWith(`${companyId}/`)) throw new Error("Роҳи чек нодуруст аст");

    const [{ data: tariff, error: tariffError }, methodResult] = await Promise.all([
      admin.from("tariffs").select("id,price,currency").eq("id", data.tariff_id).eq("is_active", true).maybeSingle(),
      data.payment_method_id
        ? admin.from("payment_methods").select("id").eq("id", data.payment_method_id).eq("is_active", true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (tariffError) throw new Error(tariffError.message);
    if (!tariff) throw new Error("Тарифи интихобшуда ёфт нашуд");
    if (methodResult.error) throw new Error(methodResult.error.message);
    if (data.payment_method_id && !methodResult.data) throw new Error("Реквизити пардохт ёфт нашуд");

    const [folder, fileName] = data.receipt_path.split("/");
    if (!folder || !fileName || folder !== companyId) throw new Error("Роҳи чек нодуруст аст");
    const { data: uploaded, error: storageError } = await admin.storage
      .from("subscription-receipts")
      .list(folder, { search: fileName, limit: 10 });
    if (storageError) throw new Error(storageError.message);
    if (!(uploaded ?? []).some((item: { name: string }) => item.name === fileName)) {
      throw new Error("Файли чек дар сервер ёфт нашуд");
    }

    const { data: payment, error: insertError } = await admin.from("subscription_payments").insert({
      company_id: companyId,
      tariff_id: tariff.id,
      payment_method_id: data.payment_method_id,
      amount: tariff.price,
      currency: tariff.currency,
      receipt_url: data.receipt_path,
      created_by: userId,
      status: "pending",
      activated_until: null,
      reviewed_by: null,
      reviewed_at: null,
    }).select("id,status").single();
    if (insertError || !payment) {
      await admin.storage.from("subscription-receipts").remove([data.receipt_path]);
      throw new Error(insertError?.message ?? "Дархости пардохт сабт нашуд");
    }
    return payment as { id: string; status: string };
  });

export const listSubscriptionPaymentsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("subscription_payments")
      .select("*, tariff:tariffs(name, duration_days), method:payment_methods(provider, label), company:companies(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

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
