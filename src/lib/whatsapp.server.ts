// Wappi.pro ↔ CRM integration core (server-only).
// Handles: webhook auth, payload normalization, contact/chat/message upsert,
// outgoing send through Wappi API, delivery-status updates and logging.

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
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
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

export function normalizePhone(input: string | null | undefined): string | null {
  let d = String(input ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 9) d = "992" + d;
  else if (d.length === 10 && d.startsWith("0")) d = "992" + d.slice(1);
  else if (d.length === 11 && d.startsWith("8")) d = "992" + d.slice(1);
  return d.length >= 10 ? d : null;
}

function phoneFromChatId(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  const raw = String(chatId).split("@")[0].split(":")[0];
  return normalizePhone(raw);
}

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

export type WaEvent = {
  kind: "incoming" | "outgoing" | "status" | "unknown";
  profileId: string | null;
  messageId: string | null;
  chatId: string | null;
  phone: string | null;
  senderName: string | null;
  text: string | null;
  messageType: string;
  mediaUrl: string | null;
  mediaMeta: any;
  avatarUrl: string | null;
  sentAt: string;
  status: string | null;
};

function toIso(t: any): string {
  if (!t) return new Date().toISOString();
  if (typeof t === "number") return new Date(t < 1e12 ? t * 1000 : t).toISOString();
  const d = new Date(t);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapStatus(raw: any): string | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (["sent", "server", "pending_sent"].includes(s)) return "sent";
  if (["delivered", "device", "delivery"].includes(s)) return "delivered";
  if (["read", "played"].includes(s)) return "read";
  if (["undelivered", "expired"].includes(s)) return "undelivered";
  if (["failed", "error"].includes(s)) return "failed";
  if (s === "pending") return "pending";
  return s;
}

/** Wappi payloads vary between event types; parse defensively. */
export function parseWappiEvent(payload: any): WaEvent {
  const m =
    payload?.messages?.[0] ??
    payload?.message ??
    payload?.data?.messages?.[0] ??
    payload?.data ??
    payload ??
    {};
  // Wappi wh_type аксар вақт дар дохили паём аст (messages[0].wh_type)
  const whType = String(
    payload?.wh_type ?? payload?.type ?? m?.wh_type ?? "",
  ).toLowerCase();

  const profileId =
    payload?.profile_id ?? payload?.profileId ?? m?.profile_id ?? m?.profileId ?? null;

  const chatId = m?.chatId ?? m?.chat_id ?? m?.chat ?? m?.from ?? m?.to ?? null;
  // Wappi барои паёмҳои худӣ is_me мефиристад (на fromMe)
  const fromMe = Boolean(m?.fromMe ?? m?.from_me ?? m?.is_me);

  let kind: WaEvent["kind"] = "unknown";
  if (whType.includes("status")) kind = "status";
  else if (whType.includes("incoming")) kind = "incoming";
  else if (whType.includes("outgoing")) kind = "outgoing";
  else if (m?.body !== undefined || m?.type) kind = fromMe ? "outgoing" : "incoming";

  const mediaUrl =
    m?.file_link ?? m?.fileLink ?? m?.media?.url ?? m?.url ?? m?.link ?? null;

  const avatarUrl =
    m?.avatar ?? m?.avatarUrl ?? m?.avatar_url ?? m?.thumbnail ?? m?.photo ?? m?.profile_pic ??
    m?.profilePic ?? m?.profile_pic_url ?? m?.picture ?? m?.senderPhoto ??
    payload?.avatar ?? payload?.photo ?? null;

  const rawText =
    typeof m?.body === "string"
      ? m.body
      : (m?.caption ?? m?.text ?? m?.body?.text ?? null);

  return {
    kind,
    profileId: profileId ? String(profileId) : null,
    messageId: m?.id ? String(m.id) : (m?.message_id ? String(m.message_id) : null),
    chatId: chatId ? String(chatId) : null,
    phone: phoneFromChatId(chatId) ?? normalizePhone(m?.senderId ?? m?.author ?? null),
    senderName: m?.senderName ?? m?.chatName ?? m?.notifyName ?? m?.name ?? null,
    text: rawText ? String(rawText) : null,
    messageType: String(m?.type ?? (mediaUrl ? "media" : "text")),
    mediaUrl: mediaUrl ? String(mediaUrl) : null,
    avatarUrl: avatarUrl ? String(avatarUrl) : null,
    mediaMeta: m?.media ?? (m?.fileName ? { fileName: m.fileName } : null),
    sentAt: toIso(m?.time ?? m?.timestamp ?? payload?.time),
    status: mapStatus(m?.status ?? payload?.status),
  };
}

/* --------------------------------------------------------- resolve tenant */

export async function resolveCompany(
  admin: Admin,
  profileId: string | null,
): Promise<{ companyId: string | null; profileId: string | null }> {
  if (profileId) {
    const { data } = await admin
      .from("whatsapp_accounts")
      .select("company_id, profile_id, enabled")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (data?.company_id) return { companyId: data.company_id, profileId };
  }
  // Fallback: exactly one configured account → use it.
  const { data: accounts } = await admin
    .from("whatsapp_accounts")
    .select("company_id, profile_id")
    .limit(2);
  if (accounts?.length === 1)
    return { companyId: accounts[0].company_id, profileId: profileId ?? accounts[0].profile_id };
  return { companyId: null, profileId };
}

/* ----------------------------------------------------- contact / chat CRUD */

async function findOrCreateCustomer(
  admin: Admin,
  companyId: string,
  phone: string,
  name: string | null,
  createIfMissing = true,
): Promise<{ id: string; created: boolean } | null> {
  const last9 = phone.slice(-9);
  // Рақамҳо метавонанд бо фосила/дефис нигоҳ дошта шаванд, бинобар ин
  // ҳам муқоисаи мустақим ва ҳам муқоисаи нормализатсияшуда истифода мешавад.
  const digitsPattern = `%${last9.split("").join("%")}%`;
  const { data: existing } = await admin
    .from("customers")
    .select("id, phone, created_at")
    .eq("company_id", companyId)
    .or(`phone.ilike.%${last9},phone.ilike.${digitsPattern}`)
    .order("created_at", { ascending: true })
    .limit(50);
  const match = (existing ?? []).find(
    (c: any) => String(c.phone ?? "").replace(/\D/g, "").slice(-9) === last9,
  );
  if (match) return { id: match.id, created: false };



  // Барои паёмҳои ирсолӣ (outgoing) муштарии нав насозем —
  // лид фақат вақте эҷод мешавад, ки муштарӣ худ ба мо нависад.
  if (!createIfMissing) return null;

  const { data, error } = await admin
    .from("customers")
    .insert({
      company_id: companyId,
      fullname: (name && name.trim()) || `WhatsApp +${phone}`,
      phone: `+${phone}`,
      status: "new",
      funnel_stage: "lead",
      source: "whatsapp",
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id, created: true };
}

async function findOrCreateChat(
  admin: Admin,
  companyId: string,
  profileId: string | null,
  chatId: string,
  phone: string,
  name: string | null,
  customerId: string | null,
): Promise<{ id: string; created: boolean } | null> {
  const { data: existing } = await admin
    .from("whatsapp_chats")
    .select("id, customer_id, display_name")
    .eq("company_id", companyId)
    .eq("chat_id", chatId)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (!existing.customer_id && customerId) patch.customer_id = customerId;
    if (!existing.display_name && name) patch.display_name = name;
    if (Object.keys(patch).length)
      await admin.from("whatsapp_chats").update(patch).eq("id", existing.id);
    return { id: existing.id, created: false };
  }

  const { data, error } = await admin
    .from("whatsapp_chats")
    .insert({
      company_id: companyId,
      profile_id: profileId,
      chat_id: chatId,
      phone,
      display_name: name,
      customer_id: customerId,
    })
    .select("id")
    .single();
  if (error || !data) {
    // race: another webhook created it
    const { data: retry } = await admin
      .from("whatsapp_chats")
      .select("id")
      .eq("company_id", companyId)
      .eq("chat_id", chatId)
      .maybeSingle();
    return retry ? { id: retry.id, created: false } : null;
  }
  return { id: data.id, created: true };
}

/* -------------------------------------------------------- webhook handler */

export async function handleWappiWebhook(payload: any): Promise<{
  ok: boolean;
  result: string;
  detail?: unknown;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Admin;

  const ev = parseWappiEvent(payload);
  const { companyId, profileId } = await resolveCompany(admin, ev.profileId);

  if (!companyId) {
    await logWa(admin, {
      event: ev.kind,
      level: "error",
      message: `Профили Wappi «${ev.profileId ?? "?"}» ба ягон ширкат пайваст нашудааст`,
      detail: { profile_id: ev.profileId },
    });
    return { ok: true, result: "no_company" };
  }

  /* -- delivery status update -- */
  if (ev.kind === "status") {
    if (!ev.messageId || !ev.status) return { ok: true, result: "status_ignored" };
    await admin
      .from("whatsapp_messages")
      .update({ status: ev.status })
      .eq("company_id", companyId)
      .eq("wappi_message_id", ev.messageId);
    await logWa(admin, {
      company_id: companyId,
      event: "status",
      message: `Ҳолати паём: ${ev.status}`,
      detail: { message_id: ev.messageId },
    });
    return { ok: true, result: "status_updated" };
  }

  if (ev.kind !== "incoming" && ev.kind !== "outgoing") {
    await logWa(admin, {
      company_id: companyId,
      event: "unknown",
      level: "warn",
      message: "Рӯйдоди нашинохта",
      detail: { wh_type: payload?.wh_type },
    });
    return { ok: true, result: "ignored" };
  }

  const phone = ev.phone;
  const chatKey = ev.chatId ?? (phone ? `${phone}@c.us` : null);
  if (!phone || !chatKey) {
    await logWa(admin, {
      company_id: companyId,
      event: ev.kind,
      level: "warn",
      message: "Рақами телефон муайян нашуд",
      detail: payload,
    });
    return { ok: true, result: "no_phone" };
  }

  /* -- duplicate guard -- */
  if (ev.messageId) {
    const { data: dup } = await admin
      .from("whatsapp_messages")
      .select("id, status")
      .eq("company_id", companyId)
      .eq("wappi_message_id", ev.messageId)
      .maybeSingle();
    if (dup) {
      if (ev.status && ev.status !== dup.status)
        await admin.from("whatsapp_messages").update({ status: ev.status }).eq("id", dup.id);
      await logWa(admin, {
        company_id: companyId,
        event: ev.kind,
        message: "Такрор — гузаронда шуд",
        detail: { message_id: ev.messageId },
      });
      return { ok: true, result: "duplicate_skipped" };
    }
  }

  /* -- contact -- */
  const customer = await findOrCreateCustomer(
    admin,
    companyId,
    phone,
    ev.senderName,
    ev.kind === "incoming", // outgoing → фақат ҷустуҷӯ, эҷод не
  );
  if (customer?.created)
    await logWa(admin, {
      company_id: companyId,
      event: ev.kind,
      message: "Мизоҷи нав аз WhatsApp сохта шуд",
      detail: { customer_id: customer.id },
    });

  /* -- chat -- */
  const chat = await findOrCreateChat(
    admin,
    companyId,
    profileId,
    chatKey,
    phone,
    ev.senderName,
    customer?.id ?? null,
  );
  if (!chat) return { ok: false, result: "chat_failed" };

  // Акси профил: линкҳои Wappi муваққатианд — расмро ҳамон замон боргирӣ карда,
  // ҳамчун data-URL нигоҳ медорем, то ҳамеша (ва дар барномаи дуюм ҳам) намоён бошад.
  if (ev.avatarUrl) {
    const cached = await cacheAvatar(ev.avatarUrl);
    if (cached) await admin.from("whatsapp_chats").update({ avatar_url: cached }).eq("id", chat.id);
  }


  /* -- outgoing sent from CRM: link instead of duplicating -- */
  if (ev.kind === "outgoing" && ev.messageId) {
    const { data: pending } = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("company_id", companyId)
      .eq("chat_id", chat.id)
      .eq("direction", "outgoing")
      .is("wappi_message_id", null)
      .eq("body", ev.text ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending) {
      await admin
        .from("whatsapp_messages")
        .update({ wappi_message_id: ev.messageId, status: ev.status ?? "sent" })
        .eq("id", pending.id);
      await touchChat(admin, chat.id, ev, "outgoing", false);
      return { ok: true, result: "outgoing_linked" };
    }
  }

  /* -- store message -- */
  const { error: insErr } = await admin.from("whatsapp_messages").insert({
    company_id: companyId,
    chat_id: chat.id,
    customer_id: customer?.id ?? null,
    direction: ev.kind,
    body: ev.text,
    message_type: ev.messageType,
    media_url: ev.mediaUrl,
    media_meta: ev.mediaMeta,
    wappi_message_id: ev.messageId,
    status: ev.kind === "incoming" ? "delivered" : (ev.status ?? "sent"),
    sent_at: ev.sentAt,
    raw: payload,
  });
  if (insErr) {
    if (String(insErr.code) === "23505") return { ok: true, result: "duplicate_skipped" };
    await logWa(admin, {
      company_id: companyId,
      event: ev.kind,
      level: "error",
      message: "Паём сабт нашуд: " + insErr.message,
    });
    return { ok: false, result: "insert_failed" };
  }

  await touchChat(admin, chat.id, ev, ev.kind, ev.kind === "incoming");
  await logWa(admin, {
    company_id: companyId,
    event: ev.kind,
    message: "Паём сабт шуд",
    detail: { chat_id: chat.id, message_id: ev.messageId },
  });

  // Пайвастшавӣ бо барномаи дуюм (воронкаи фурӯш): аввал лид, баъд паём
  try {
    const { pushFunnelEvent, pushLeadUpsert } = await import("@/lib/funnel-sync.server");
    if (customer?.id) await pushLeadUpsert(admin, companyId, customer.id);
    await pushFunnelEvent(
      "message.created",
      { id: companyId },
      {
        lead_id: customer?.id ?? null,
        chat_id: chat.id,
        phone,
        message: {
          direction: ev.kind,
          body: ev.text,
          message_type: ev.messageType,
          media_url: ev.mediaUrl,
          status: ev.kind === "incoming" ? "delivered" : (ev.status ?? "sent"),
          sent_at: ev.sentAt,
        },
      },
    );
  } catch {
    /* sync хатогии webhook-ро вайрон намекунад */
  }
  return { ok: true, result: "message_saved" };
}

async function touchChat(
  admin: Admin,
  chatRowId: string,
  ev: WaEvent,
  direction: string,
  incrementUnread: boolean,
) {
  const patch: Record<string, unknown> = {
    last_message_text: ev.text ?? (ev.mediaUrl ? "📎 Файл" : null),
    last_message_at: ev.sentAt,
    last_direction: direction,
  };
  if (incrementUnread) {
    const { data } = await admin
      .from("whatsapp_chats")
      .select("unread_count")
      .eq("id", chatRowId)
      .maybeSingle();
    patch.unread_count = (data?.unread_count ?? 0) + 1;
  } else if (direction === "outgoing") {
    // Менеҷер ҷавоб дод — ҳисобкунаки паёмҳои беҷавобро сифр мекунем
    patch.unread_count = 0;
  }
  await admin.from("whatsapp_chats").update(patch).eq("id", chatRowId);
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
