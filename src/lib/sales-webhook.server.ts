import { createHmac } from "crypto";

export type SalesPartnerEvent =
  | "member.created"
  | "member.updated"
  | "payout.created"
  | "snapshot.sync";

export type SalesPartnerPayload = {
  source: "platform.tj";
  event: SalesPartnerEvent;
  sent_at: string;
  company: { id: string; name?: string | null };
  data: unknown;
};

/**
 * Push-webhook ба барномаи дуюм (Шарики фурӯш).
 * URL: SALES_PARTNER_WEBHOOK_URL, имзо: HMAC-SHA256 бо SALES_PARTNER_WEBHOOK_SECRET.
 * Ҳеҷ гоҳ хатоии шабака иҷрои амали асосиро вайрон намекунад.
 */
export async function pushSalesPartnerEvent(
  event: SalesPartnerEvent,
  company: { id: string; name?: string | null },
  data: unknown,
): Promise<{ ok: boolean; status?: number; error?: string; ledgerImported?: number }> {
  const { getSalesPartnerWebhookConfig } = await import("./webhook-config.server");
  const { url, secret } = await getSalesPartnerWebhookConfig();
  if (!url || !secret) return { ok: false, error: "webhook_not_configured" };

  const payload: SalesPartnerPayload = {
    source: "platform.tj",
    event,
    sent_at: new Date().toISOString(),
    company,
    data,
  };
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "user-agent": "PLATFORM.TJ-Sales-Partner-Sync/1.0",
        "x-platform-signature": signature,
        "x-platform-event": event,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[sales-webhook] failed", res.status, text.slice(0, 300));
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    const response = await res.json().catch(() => null) as { ledger_imported?: unknown } | null;
    const ledgerImported = Number(response?.ledger_imported ?? 0);
    return {
      ok: true,
      status: res.status,
      ledgerImported: Number.isFinite(ledgerImported) ? ledgerImported : 0,
    };
  } catch (e: any) {
    console.error("[sales-webhook] error", e?.message);
    return { ok: false, error: e?.message ?? "network error" };
  }
}
