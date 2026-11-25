import { z } from "zod";

export const WAPPI_WEBHOOK_PATH = "/api/public/hooks/whatsapp-leads";
export function wappiWebhookUrl(origin: string): string {
  return new URL(WAPPI_WEBHOOK_PATH, origin).toString();
}

export function normalizePhone(input: string | null | undefined): string | null {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 9) digits = "992" + digits;
  else if (digits.length === 10 && digits.startsWith("0")) digits = "992" + digits.slice(1);
  else if (digits.length === 11 && digits.startsWith("8")) digits = "992" + digits.slice(1);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

const object = z.record(z.unknown());
const envelope = object.refine(value => Object.keys(value).length > 0);
const record = (value: unknown): Record<string, unknown> => object.safeParse(value).success ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === "string" || typeof value === "number" ? String(value) : null;
const own = (value: unknown) => value === true || value === 1 || value === "true" || value === "1";

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
  mediaMeta: unknown;
  avatarUrl: string | null;
  sentAt: string;
  status: string | null;
};

function iso(value: unknown, fallback: string): string {
  const scalar = text(value);
  if (!scalar) return fallback;
  const numeric = Number(scalar);
  const date = Number.isFinite(numeric) ? new Date(numeric < 1e12 ? numeric * 1000 : numeric) : new Date(scalar);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function status(value: unknown): string | null {
  const raw = String(value ?? "").toLowerCase();
  if (["1", "sent", "server", "pending_sent"].includes(raw)) return "sent";
  if (["2", "delivered", "device", "delivery"].includes(raw)) return "delivered";
  if (["3", "4", "read", "played"].includes(raw)) return "read";
  if (["-1", "failed", "error", "undelivered", "expired"].includes(raw)) return "failed";
  return raw || null;
}

/** Expand the entire delivery, including Wappi batches and nested data envelopes. */
export function parseWappiEvents(payload: unknown, receivedAt = new Date().toISOString()): WaEvent[] {
  const root = envelope.parse(payload);
  const data = record(root['data']);
  const container = Array.isArray(root['messages']) ? root['messages'] : Array.isArray(data['messages']) ? data['messages']
    : Array.isArray(root['statuses']) ? root['statuses'] : Array.isArray(data['statuses']) ? data['statuses']
    : Array.isArray(root['data']) ? root['data'] : [root['message'] ?? data['message'] ?? root['data'] ?? root];
  if (container.length > 100) throw new Error("Too many Wappi events");
  return container.map(value => {
    const message = record(value);
    const key = record(message['key']);
    const type = String(message['wh_type'] ?? root['wh_type'] ?? data['wh_type'] ?? root['type'] ?? "").toLowerCase();
    const fromMe = own(message['fromMe'] ?? message['from_me'] ?? message['is_me'] ?? key['fromMe']);
    const kind: WaEvent['kind'] = /status|ack/.test(type) || root['statuses'] || data['statuses'] ? "status"
      : type.includes("incoming") ? "incoming" : type.includes("outgoing") ? "outgoing"
      : message['body'] !== undefined || message['text'] !== undefined || message['type'] ? fromMe ? "outgoing" : "incoming" : "unknown";
    const chatId = text(message['chatId'] ?? message['chat_id'] ?? message['chat'] ?? key['remoteJid']
      ?? (fromMe ? message['to'] ?? message['from'] : message['from'] ?? message['to']));
    // Group IDs and privacy-preserving LIDs are not customer phone numbers.
    const direct = !chatId || !/@(g\.us|lid|broadcast)$/.test(chatId);
    const phone = direct ? normalizePhone(chatId?.split("@")[0]?.split(":")[0])
      ?? normalizePhone(text(message['senderId'] ?? message['author'] ?? message['phone'])) : null;
    const media = record(message['media']);
    const mediaUrl = text(message['file_link'] ?? message['fileLink'] ?? media['url'] ?? message['url'] ?? message['link']);
    return {
      kind, profileId: text(message['profile_id'] ?? message['profileId'] ?? root['profile_id'] ?? root['profileId'] ?? data['profile_id'] ?? data['profileId']),
      messageId: text(message['id'] ?? message['message_id'] ?? key['id']), chatId, phone,
      senderName: text(message['senderName'] ?? message['chatName'] ?? message['notifyName'] ?? message['name']),
      text: text(typeof message['body'] === "string" ? message['body'] : message['caption'] ?? message['text'] ?? record(message['body'])['text']),
      messageType: String(message['type'] ?? (mediaUrl ? "media" : "text")), mediaUrl,
      mediaMeta: message['media'] ?? (message['fileName'] ? { fileName: message['fileName'] } : null),
      avatarUrl: text(message['avatar'] ?? message['avatarUrl'] ?? message['avatar_url'] ?? message['photo'] ?? message['profile_pic'] ?? root['avatar']),
      sentAt: iso(message['time'] ?? message['timestamp'] ?? root['time'], receivedAt),
      status: status(message['status'] ?? message['ack'] ?? root['status']),
    };
  });
}

export function parseWappiEvent(payload: unknown): WaEvent {
  const event = parseWappiEvents(payload)[0];
  if (!event) throw new Error("Empty Wappi delivery");
  return event;
}