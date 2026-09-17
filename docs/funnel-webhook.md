# Интегратсияи воронкаи фурӯш + WhatsApp → profit-flow-logic

PLATFORM.TJ маълумоти воронкаи фурӯш (лидҳо, менеҷерҳо) ва чатҳои WhatsApp-ро
тавассути push-webhook ба барномаи `profit-flow-logic` мефиристад.

## Endpoint барои қабул дар барномаи дуюм

```
POST https://profit-flow-logic.lovable.app/api/public/platform-funnel-webhook
Headers:
  content-type: application/json
  x-platform-signature: <HMAC-SHA256 hex аз body бо SALES_PARTNER_WEBHOOK_SECRET>
  x-platform-event: funnel.sync | lead.upsert | message.created
```

Ҳамон калиди муштарак `SALES_PARTNER_WEBHOOK_SECRET`, ки барои пули Шарики фурӯш
истифода мешавад, инҷо ҳам имзоро тафтиш мекунад.

## Рӯйдодҳо

### `funnel.sync` — snapshotи пурра (тугмаи «Синхронизатсия» ё ҳар 60 соня аз саҳифаи Воронка)

```json
{
  "source": "platform.tj",
  "event": "funnel.sync",
  "sent_at": "2026-08-31T05:00:00.000Z",
  "company": { "id": "uuid" },
  "data": {
    "managers": [
      { "id": "uuid", "fullname": "Алима", "email": "...", "user_id": "uuid|null" }
    ],
    "leads": [
      {
        "id": "uuid",
        "fullname": "ФИО-и лид",
        "phone": "+992...",
        "status": "new",
        "stage": "lead|contacted|no_answer|meeting|thinking|hold|contract|lost",
        "source": "whatsapp",
        "manager_id": "uuid|null",
        "manager_name": "Алима",
        "probability": "10|25|50|75|100|null",
        "comment": "коментария",
        "crm_fields": { "…": "ҳамаи майдонҳои сделка" },
        "avatar_url": "https://…|null",
        "chat_id": "uuid|null",
        "last_direction": "incoming|outgoing|null",
        "last_message_at": "iso|null",
        "unread_count": 2,
        "answered": true,
        "created_at": "iso",
        "messages": [
          {
            "id": "uuid", "direction": "incoming|outgoing", "body": "…",
            "message_type": "text|ptt|image|…", "media_url": "…|null",
            "status": "sent|delivered|read|failed", "sent_at": "iso"
          }
        ]
      }
    ],
    "totals": { "leads": 123, "managers": 7 }
  }
}
```

### `lead.upsert` — як лид тағир ёфт (марҳила, менеҷер, ном, майдонҳо)

```json
{ "event": "lead.upsert", "data": { "lead": { …ҳамон сохтори lead… }, "manager": { "id","fullname","email","user_id" } } }
```

### `message.created` — паёми нави WhatsApp (воридотӣ ё содиротӣ)

```json
{ "event": "message.created", "data": { "lead_id": "uuid|null", "chat_id": "uuid", "phone": "992…", "message": { "direction","body","message_type","media_url","status","sent_at" } } }
```

## Тақсимоти менеҷерҳо

Ҳар лид `manager_id`/`manager_name` дорад. Дар барномаи дуюм кабинети ҳар менеҷер
бояд танҳо лидҳоееро нишон диҳад, ки `manager_id`-и онҳо ба ҳамон менеҷер тааллуқ
дорад (мувофиқат аз рӯи `email` ё `user_id`-и менеҷер).

## Фиристодани паём аз барномаи дуюм (дутарафа)

Барномаи дуюм метавонад паёми WhatsApp фиристад:

```
POST https://project--63d19137-8c20-4d78-9f11-31bd62013944.lovable.app/api/public/hooks/funnel-inbound
Headers: content-type: application/json, x-platform-signature: <HMAC-SHA256 аз body>
Body: { "action": "send_message", "phone": "+992XXXXXXXXX", "body": "Матни паём" }
```

Ҷавоб: `{ "ok": true, "messageId": "…" }`. Паём ҳамчун outgoing дар CRM сабт мешавад.

## Намунаи қабулкунанда (барномаи дуюм)

```ts
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/platform-funnel-webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const raw = await request.text();
    const sig = request.headers.get("x-platform-signature") ?? "";
    const exp = createHmac("sha256", process.env["SALES_PARTNER_WEBHOOK_SECRET"]!).update(raw).digest("hex");
    if (sig.length !== exp.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(exp)))
      return new Response("Invalid signature", { status: 401 });

    const payload = JSON.parse(raw);
    // payload.event: "funnel.sync" | "lead.upsert" | "message.created"
    // Дар ин ҷо ҷадвалҳои худро (upsert) нав кунед.
    return Response.json({ ok: true });
  } } },
});
```

## Фиристодани СМС аз барномаи дуюм (OSON SMS)

```
POST https://project--63d19137-8c20-4d78-9f11-31bd62013944.lovable.app/api/public/hooks/funnel-inbound
Headers: content-type: application/json, x-platform-signature: <HMAC-SHA256 аз body бо SALES_PARTNER_WEBHOOK_SECRET>
Body: { "action": "send_sms", "phone": "+992XXXXXXXXX", "body": "Матни СМС", "project_id": "uuid|null" }
```

Ҷавоб: `{ "ok": true, "msgId": "…" }`. СМС тавассути танзимоти OSON SMS-и ширкат
(лоиҳавӣ, набошад умумӣ) фиристода шуда, дар `sms_logs` сабт мешавад.

## Аксияи `send_voice` (голос / аудио)

Барномаи дуюм метавонад голоси WhatsApp (voice note) фиристад:

```json
{
  "action": "send_voice",
  "phone": "+992900000000",
  "audio_url": "https://example.com/voice.ogg"
}
```

- `audio_url` бояд линки мустақим (public https) ба файли аудио бошад (ogg/opus беҳтарин).
- Аввал ҳамчун PTT (voice note) меравад; агар ноком шавад — ҳамчун аудиои оддӣ.
- Ҷавоб: `{ ok: true, messageId }` ё `{ ok: false, error }`.
