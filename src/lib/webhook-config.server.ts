/**
 * Танзимоти webhook-и «Шарики фурӯш».
 * Тартиб: ENV → platform_settings → қиматҳои пешфарзи дарунсохт.
 * Ҳамин тавр дар VPS ҳам бе ягон танзими дастӣ кор мекунад.
 */
export type SalesPartnerWebhookConfig = { url: string | null; secret: string | null };

/** Суроға ва сирри пешфарз — дар ҳар ду барнома айнан якхела. */
export const DEFAULT_SALES_PARTNER_WEBHOOK_URL =
  "https://fz.platform.tj/api/public/platform-sales-webhook";
export const DEFAULT_SALES_PARTNER_WEBHOOK_SECRET =
  "platform-tj-sales-partner-2026-8f3c1a94b7e24d6fa05c9b31e7d24f60";

let cache: { at: number; value: SalesPartnerWebhookConfig } | null = null;
const TTL = 30_000;

export function clearSalesPartnerWebhookCache() {
  cache = null;
}

export async function getSalesPartnerWebhookConfig(): Promise<SalesPartnerWebhookConfig> {
  const envUrl = process.env["SALES_PARTNER_WEBHOOK_URL"] || null;
  const envSecret = process.env["SALES_PARTNER_WEBHOOK_SECRET"] || null;
  if (envUrl && envSecret) return { url: envUrl, secret: envSecret };

  if (cache && Date.now() - cache.at < TTL) return cache.value;

  let dbUrl: string | null = null;
  let dbSecret: string | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "sales_partner_webhook")
      .maybeSingle();
    const v = (data?.value ?? {}) as { url?: string; secret?: string };
    dbUrl = v.url ? String(v.url).trim() : null;
    dbSecret = v.secret ? String(v.secret).trim() : null;
  } catch (e: any) {
    console.error("[webhook-config] read failed", e?.message);
  }

  const value: SalesPartnerWebhookConfig = {
    url: envUrl || dbUrl || DEFAULT_SALES_PARTNER_WEBHOOK_URL,
    secret: envSecret || dbSecret || DEFAULT_SALES_PARTNER_WEBHOOK_SECRET,
  };
  cache = { at: Date.now(), value };
  return value;
}
