// Funnel + WhatsApp sync → profit-flow-logic (server-only).
// Ҳамон усули push-webhook бо имзои HMAC-SHA256, ки барои Шарики фурӯш истифода мешавад.
// URL: FUNNEL_SYNC_URL, имзо: SALES_PARTNER_WEBHOOK_SECRET (ҳамон калиди муштарак).

import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any, any, any>;

export type FunnelEvent =
  | "funnel.sync" // snapshotи пурра (менеҷерҳо + лидҳо + паёмҳо)
  | "lead.upsert" // як лид тағир ёфт / эҷод шуд
  | "message.created"; // паёми нави WhatsApp

export type FunnelPayload = {
  source: "platform.tj";
  event: FunnelEvent;
  sent_at: string;
  company: { id: string; name?: string | null };
  data: unknown;
};

/** Фиристодани рӯйдод ба барномаи дуюм. Хатогӣ иҷрои асосиро вайрон намекунад. */
export async function pushFunnelEvent(
  event: FunnelEvent,
  company: { id: string; name?: string | null },
  data: unknown,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  // ⛔️ Интегратсия бо барномаи 2 (profit-flow-logic) хомӯш карда шуд.
  // Ҳеҷ лид, паём ё snapshot фиристода намешавад.
  void event;
  void company;
  void data;
  return { ok: false, error: "funnel_sync_disabled" };
}

/* ------------------------------------------------------- snapshot builder */

const normPhone = (p: any) => String(p ?? "").replace(/\D/g, "");

/** Snapshotи пурраи воронка: менеҷерҳо, лидҳо ва охирин паёмҳои WhatsApp. */
export async function buildFunnelSnapshot(admin: Admin, companyId: string) {
  const [{ data: managers }, { data: customers }, { data: chats }, { data: messages }] =
    await Promise.all([
      admin
        .from("sales_team_members")
        .select("id, fullname, email, user_id, kind, is_active")
        .eq("company_id", companyId)
        .eq("kind", "manager")
        .eq("is_active", true),
      admin
        .from("customers")
        .select(
          "id, fullname, phone, status, funnel_stage, source, assigned_manager_id, crm_fields, created_at",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("whatsapp_chats")
        .select(
          "id, customer_id, phone, display_name, avatar_url, last_direction, last_message_at, last_message_text, unread_count",
        )
        .eq("company_id", companyId)
        .limit(1000),
      // RPC: матни зиёда аз 2000 ҳарф бурида мешавад (base64-и медиа боиси timeout мешуд)
      admin.rpc("funnel_recent_messages", { _company_id: companyId, _limit: 5000 }),
    ]);

  const managerName = new Map<string, string>();
  for (const m of managers ?? []) managerName.set(m.id, m.fullname ?? "—");

  // Акс ва ҳолати чат аз рӯи customer_id ё рақами телефон
  const chatByCustomer = new Map<string, any>();
  const chatByPhone = new Map<string, any>();
  for (const c of chats ?? []) {
    if (c.customer_id && !chatByCustomer.has(c.customer_id)) chatByCustomer.set(c.customer_id, c);
    const ph = normPhone(c.phone);
    if (ph && !chatByPhone.has(ph)) chatByPhone.set(ph, c);
  }

  // Паёмҳо: агар customer_id набошад, аз рӯи chat_id мизоҷро меёбем
  const custByChat = new Map<string, string>();
  for (const c of chats ?? []) if (c.id && c.customer_id) custByChat.set(c.id, c.customer_id);

  const msgsByCustomer = new Map<string, any[]>();
  for (const m of messages ?? []) {
    const key = (m.customer_id as string | null) ?? custByChat.get(m.chat_id as string) ?? null;
    if (!key) continue;
    const arr = msgsByCustomer.get(key) ?? [];
    if (arr.length < 200) arr.push({ ...m, customer_id: key });
    msgsByCustomer.set(key, arr);
  }

  const leads = (customers ?? []).map((c: any) => {
    const chat = chatByCustomer.get(c.id) ?? chatByPhone.get(normPhone(c.phone)) ?? null;
    const fields = (c.crm_fields ?? {}) as any;
    const msgs = msgsByCustomer.get(c.id) ?? [];
    const answered = msgs.some((m: any) => m.direction === "outgoing");
    return {
      id: c.id,
      fullname: c.fullname,
      phone: c.phone,
      status: c.status,
      stage: c.funnel_stage ?? "lead",
      source: c.source,
      manager_id: c.assigned_manager_id ?? null,
      manager_name: c.assigned_manager_id ? (managerName.get(c.assigned_manager_id) ?? null) : null,
      probability: fields?.probability ?? null,
      comment: fields?.comments ?? null,
      crm_fields: fields,
      avatar_url: chat?.avatar_url ?? null,
      chat_id: chat?.id ?? null,
      last_direction: chat?.last_direction ?? null,
      last_message_at: chat?.last_message_at ?? null,
      last_message_text: chat?.last_message_text ?? null,
      unread_count: chat?.unread_count ?? 0,
      answered,
      created_at: c.created_at,
      messages: msgs.slice().reverse(),
    };
  });

  return {
    managers: (managers ?? []).map((m: any) => ({
      id: m.id,
      fullname: m.fullname,
      email: m.email ?? null,
      user_id: m.user_id ?? null,
    })),
    leads,
    totals: { leads: leads.length, managers: (managers ?? []).length },
  };
}

/** Як лидро (аз рӯи id) ба барномаи дуюм мефиристад — то паёмҳояш соҳиб дошта бошанд. */
export async function pushLeadUpsert(admin: Admin, companyId: string, customerId: string) {
  try {
    const { data: c } = await admin
      .from("customers")
      .select(
        "id, fullname, phone, status, funnel_stage, source, assigned_manager_id, crm_fields, created_at",
      )
      .eq("id", customerId)
      .maybeSingle();
    if (!c) return { ok: false, error: "lead_not_found" };

    const [{ data: mgr }, { data: chat }] = await Promise.all([
      c.assigned_manager_id
        ? admin
            .from("sales_team_members")
            .select("id, fullname, email, user_id")
            .eq("id", c.assigned_manager_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      admin
        .from("whatsapp_chats")
        .select("id, avatar_url, last_direction, last_message_at, unread_count")
        .eq("customer_id", c.id)
        .maybeSingle(),
    ]);

    const fields = (c.crm_fields ?? {}) as any;
    return await pushFunnelEvent(
      "lead.upsert",
      { id: companyId },
      {
        lead: {
          id: c.id,
          fullname: c.fullname,
          phone: c.phone,
          status: c.status,
          stage: c.funnel_stage ?? "lead",
          source: c.source,
          manager_id: c.assigned_manager_id ?? null,
          manager_name: mgr?.fullname ?? null,
          probability: fields?.probability ?? null,
          comment: fields?.comments ?? null,
          crm_fields: fields,
          avatar_url: chat?.avatar_url ?? null,
          chat_id: chat?.id ?? null,
          last_direction: chat?.last_direction ?? null,
          last_message_at: chat?.last_message_at ?? null,
          unread_count: chat?.unread_count ?? 0,
          created_at: c.created_at,
        },
        manager: mgr ?? null,
      },
    );
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "error" };
  }
}

/** Snapshotи пурраро ба барномаи дуюм мефиристад. */
export async function pushFunnelSnapshot(
  admin: Admin,
  companyId: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const snap = await buildFunnelSnapshot(admin, companyId);
    return await pushFunnelEvent("funnel.sync", { id: companyId }, snap);
  } catch (e: any) {
    console.error("[funnel-sync] snapshot failed", e?.message);
    return { ok: false, error: e?.message ?? "error" };
  }
}

/* -------------------------------------------------- имзои дархости воридотӣ */

/** Тафтиши имзои HMAC барои фармонҳои баромада аз барномаи дуюм (масалан фиристодани паём). */
export function verifyFunnelSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env["SALES_PARTNER_WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
