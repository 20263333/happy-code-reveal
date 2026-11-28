// Wappi.pro ↔ CRM integration core (server-only).
// Handles: webhook auth, payload normalization, contact/chat/message upsert,
// outgoing send through Wappi API, delivery-status updates and logging.

import { receiveWappiDelivery } from "./wappi-inbox.server";
export { normalizePhone } from "./wappi-events";

import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any, any, any>;

const WAPPI_BASE = "https://wappi.pro";

/** Расми профилро боргирӣ карда, ба data-URL табдил медиҳад (линкҳои Wappi мунқазӣ мешаванд). */
export async function cacheAvatar(url: string | null | undefined): Promise<string | null> {
  const src = String(url ?? "");
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src, {
      headers: { Authorization: process.env["WAPPI_API_TOKEN"] ?? "" },
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length || buf.length > 300_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode((buf[i] ?? 0));
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/** Линки нави акси профилро аз Wappi мегирад (профил бояд authorized бошад). */
export async function fetchWappiAvatar(
  profileId: string,
  phone: string | null | undefined,
): Promise<string | null> {
  const ph = String(phone ?? "").replace(/\D/g, "");
  if (!profileId || !ph) return null;
  try {
    const res = await fetch(
      `${WAPPI_BASE}/api/sync/contact/get?profile_id=${encodeURIComponent(profileId)}&recipient=${ph}`,
      { headers: { Authorization: process.env["WAPPI_API_TOKEN"] ?? "" } },
    );
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => null);
    const c = j?.contact ?? j?.data ?? j ?? {};
    return (
      c.avatar ?? c.avatarUrl ?? c.avatar_url ?? c.img ?? c.image ?? c.profile_pic ?? null
    );
  } catch {
    return null;
  }
}


/* ------------------------------------------------------------------ utils */

export async function logWa(
  admin: Admin,
  entry: {
    company_id?: string | null;
    event?: string | null;
    level?: "info" | "warn" | "error";
    message?: string;
    detail?: unknown;
  },
) {
  const line = `[wappi] ${entry.level ?? "info"} ${entry.event ?? "-"} ${entry.message ?? ""}`;
  if (entry.level === "error") console.error(line);
  else console.log(line);
  try {
    await admin.from("whatsapp_webhook_logs").insert({
      company_id: entry.company_id ?? null,
      event: entry.event ?? null,
      level: entry.level ?? "info",
      message: entry.message ?? null,
      detail: (entry.detail ?? null) as any,
    });
  } catch {
    /* logging must never break the webhook */
  }
}

/* ------------------------------------------------------------------- auth */

/** Wappi sends the configured webhook token in the `Authorization` header
 *  (raw value, sometimes as `Bearer <token>`). We also accept common aliases. */
export function checkWebhookAuth(request: Request): { ok: boolean; reason?: string } {
  const expected = process.env["WAPPI_WEBHOOK_AUTH_TOKEN"];
  if (!expected) return { ok: false, reason: "not_configured" };

  const candidates = [
    request.headers.get("authorization"),
    request.headers.get("x-wappi-token"),
    request.headers.get("x-webhook-token"),
    request.headers.get("x-api-key"),
    new URL(request.url).searchParams.get("token"),
  ]
    .filter(Boolean)
    .map((v) => String(v).replace(/^Bearer\s+/i, "").trim());

  return candidates.includes(expected.trim())
    ? { ok: true }
    : { ok: false, reason: "invalid_token" };
}

/* -------------------------------------------------------- payload parsing */

export { parseWappiEvent } from "./wappi-events";

/* --------------------------------------------------------- resolve tenant */

export async function resolveCompany(
  admin: Admin,
  profileId: string | null,
): Promise<{ companyId: string | null; profileId: string | null }> {
  const query = admin.from("whatsapp_accounts").select("company_id, profile_id").eq("enabled", true);
  const { data: accounts, error } = await (profileId ? query.eq("profile_id", profileId) : query).limit(2);
  if (error) throw new Error("Профили WhatsApp хонда нашуд");
  const account = accounts?.length === 1 ? accounts[0] : null;
  if (account) return { companyId: account.company_id, profileId: account.profile_id };
  return { companyId: null, profileId };
}

/* -------------------------------------------------------- webhook handler */

export async function handleWappiWebhook(payload: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return receiveWappiDelivery(supabaseAdmin as unknown as Admin, payload);
}

/* ------------------------------------------------------------ outgoing API */

// Voice (PTT) ё дигар аудио тавассути Wappi: url бояд линки мустақими файли аудио бошад.
export async function wappiSendVoice(
  profileId: string,
  recipient: string,
  audioUrl: string,
): Promise<{ ok: true; messageId: string | null; raw: any } | { ok: false; error: string }> {
  const token = process.env["WAPPI_API_TOKEN"];
  if (!token) return { ok: false, error: "WAPPI_API_TOKEN танзим нашудааст" };

  const tryEndpoint = async (path: string, body: Record<string, string>) => {
    const res = await fetch(
      `${WAPPI_BASE}${path}?profile_id=${encodeURIComponent(profileId)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: token },
        body: JSON.stringify(body),
      },
    );
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-json */ }
    return { res, json, text };
  };

  const bad = (o: { res: Response; json: any }) =>
    !o.res.ok || o.json?.status === "error" || o.json?.status === "failed";

  try {
    // Аввал PTT (voice note) → аудиои оддӣ → файл (fallback).
    let out = await tryEndpoint("/api/sync/message/ptt/send", { recipient, url: audioUrl });
    if (bad(out)) out = await tryEndpoint("/api/sync/message/audio/send", { recipient, url: audioUrl });
    if (bad(out))
      out = await tryEndpoint("/api/sync/message/document/send", {
        recipient,
        url: audioUrl,
        file_name: "voice.ogg",
      });
    if (bad(out)) {
      console.error("[wappi] voice send failed", out.text.slice(0, 500));
      return { ok: false, error: out.json?.detail ?? out.json?.message ?? out.text.slice(0, 300) };
    }
    const messageId =
      out.json?.message_id ?? out.json?.task_id ?? out.json?.id ?? out.json?.data?.id ?? null;
    return { ok: true, messageId: messageId ? String(messageId) : null, raw: out.json ?? out.text };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "network error" };
  }
}


export async function wappiSendText(
  profileId: string,
  recipient: string,
  body: string,
): Promise<{ ok: true; messageId: string | null; raw: any } | { ok: false; error: string }> {
  const token = process.env["WAPPI_API_TOKEN"];
  if (!token) return { ok: false, error: "WAPPI_API_TOKEN танзим нашудааст" };

  try {
    const res = await fetch(
      `${WAPPI_BASE}/api/sync/message/send?profile_id=${encodeURIComponent(profileId)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: token },
        body: JSON.stringify({ recipient, body }),
      },
    );
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-json */
    }
    if (!res.ok || json?.status === "error") {
      return { ok: false, error: json?.detail ?? json?.message ?? text.slice(0, 300) };
    }
    const messageId =
      json?.message_id ?? json?.task_id ?? json?.id ?? json?.data?.id ?? null;
    return { ok: true, messageId: messageId ? String(messageId) : null, raw: json ?? text };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "network error" };
  }
}
