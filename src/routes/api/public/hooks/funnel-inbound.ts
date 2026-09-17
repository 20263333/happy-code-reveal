import { uuid } from "@/lib/uuid";
import { createFileRoute } from "@tanstack/react-router";

// Фармонҳои воридотӣ аз барномаи дуюм (profit-flow-logic).
// Ҳоло дастгирӣ мешавад: { action: "send_message", phone, body } —
// фиристодани паёми WhatsApp аз тарафи он барнома тавассути ҳамин CRM.
// Бехатарӣ: имзои HMAC-SHA256 (x-platform-signature) бо SALES_PARTNER_WEBHOOK_SECRET.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/hooks/funnel-inbound")({
  server: {
    handlers: {
      GET: async () => json({ ok: true, endpoint: "funnel-inbound", ready: true }),

      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyFunnelSignature } = await import("@/lib/funnel-sync.server");
        const sig = request.headers.get("x-platform-signature");
        if (!verifyFunnelSignature(raw, sig))
          return json({ ok: false, error: "invalid_signature" }, 401);

        let payload: any = null;
        try {
          payload = JSON.parse(raw);
        } catch {
          return json({ ok: false, error: "invalid json" }, 400);
        }

        // --- СМС (OSON SMS) аз барномаи дуюм ---
        if (payload?.action === "send_sms") {
          const text = String(payload?.body ?? payload?.message ?? "").trim();
          const { normalizePhone: normSms, resolveSmsCfg, osonSend } = await import(
            "@/lib/sms-core.server"
          );
          const to = normSms(String(payload?.phone ?? ""));
          if (!to || !text) return json({ ok: false, error: "phone_and_body_required" }, 400);
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const admin = supabaseAdmin as any;

            let companyId: string | null = payload?.company_id ?? null;
            if (!companyId) {
              const { data: acc } = await admin
                .from("whatsapp_accounts")
                .select("company_id")
                .eq("enabled", true)
                .limit(1)
                .maybeSingle();
              companyId = acc?.company_id ?? null;
            }
            if (!companyId) {
              const { data: st } = await admin
                .from("company_sms_settings")
                .select("company_id")
                .eq("enabled", true)
                .limit(1)
                .maybeSingle();
              companyId = st?.company_id ?? null;
            }
            if (!companyId) return json({ ok: false, error: "company_not_found" }, 503);

            const cfg = await resolveSmsCfg(admin, companyId, payload?.project_id ?? null);
            if (!cfg) return json({ ok: false, error: "sms_not_configured" }, 503);

            const res = await osonSend(cfg, to, text);
            await admin.from("sms_logs").insert({
              company_id: companyId,
              customer_phone: to,
              message: text,
              stage: "manual",
              reminder_key: `funnel-${to}-${Date.now()}`,
              status: res.ok ? "sent" : "failed",
              error: res.ok ? null : res.error,
            });
            if (!res.ok) return json({ ok: false, error: res.error }, 502);
            return json({ ok: true, msgId: res.msgId ?? null });
          } catch (e: any) {
            console.error("[funnel-inbound] sms error", e?.message);
            return json({ ok: false, error: e?.message ?? "error" }, 500);
          }
        }

        // --- Голос / аудио (WhatsApp voice note) аз барномаи дуюм ---
        if (payload?.action === "send_voice") {
          const audioUrl = String(payload?.audio_url ?? payload?.url ?? "").trim();
          const { normalizePhone: normV, wappiSendVoice, logWa: logWaV } = await import(
            "@/lib/whatsapp.server"
          );
          const phoneV = normV(payload?.phone);
          if (!phoneV || !audioUrl) return json({ ok: false, error: "phone_and_audio_url_required" }, 400);
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const admin = supabaseAdmin as any;
            const { data: acc } = await admin
              .from("whatsapp_accounts")
              .select("company_id, profile_id")
              .eq("enabled", true)
              .limit(1)
              .maybeSingle();
            if (!acc) return json({ ok: false, error: "no_whatsapp_account" }, 503);

            const { data: chat } = await admin
              .from("whatsapp_chats")
              .select("id, customer_id")
              .eq("company_id", acc.company_id)
              .eq("phone", phoneV)
              .maybeSingle();

            // Линкҳои signed/муваққатӣ ва форматҳои нодурустро Wappi боргирӣ карда наметавонад.
            // Барои ҳамин файлро худамон мегирем ва ҳамчун линки кушода медиҳем.
            let sendUrl = audioUrl;
            try {
              const src = await fetch(audioUrl);
              if (src.ok) {
                const bytes = new Uint8Array(await src.arrayBuffer());
                const ct = (src.headers.get("content-type") ?? "").toLowerCase();
                const fromCt = ct.includes("ogg")
                  ? "ogg"
                  : ct.includes("mpeg")
                    ? "mp3"
                    : ct.includes("mp4") || ct.includes("m4a")
                      ? "m4a"
                      : ct.includes("wav")
                        ? "wav"
                        : ct.includes("webm")
                          ? "ogg" // webm/opus → ҳамчун ogg медиҳем (opus дохилаш)
                          : null;
                const fromName = audioUrl.split("?")[0].split(".").pop()?.toLowerCase();
                const ext =
                  fromCt ??
                  (fromName && ["ogg", "mp3", "m4a", "wav", "aac"].includes(fromName)
                    ? fromName
                    : "ogg");
                const name = `${uuid()}.${ext}`;
                const { error: upErr } = await admin.storage
                  .from("notification-media")
                  .upload(`wa-voice/${name}`, bytes, {
                    contentType: ext === "mp3" ? "audio/mpeg" : ext === "m4a" ? "audio/mp4" : "audio/ogg",
                    upsert: true,
                  });
                if (!upErr) sendUrl = new URL(`/api/public/wa-voice/${name}`, request.url).toString();
              }
            } catch {
              /* агар нашуд — линки аслиро истифода мебарем */
            }

            const res = await wappiSendVoice(acc.profile_id, phoneV, sendUrl);
            if (!res.ok) {
              await logWaV(admin, {
                company_id: acc.company_id,
                event: "send",
                level: "error",
                message: "Фиристодани голос аз барномаи дуюм ноком шуд: " + res.error,
              });
              return json({ ok: false, error: res.error }, 502);
            }

            await admin.from("whatsapp_messages").insert({
              company_id: acc.company_id,
              chat_id: chat?.id ?? null,
              customer_id: chat?.customer_id ?? null,
              direction: "outgoing",
              body: "",
              message_type: "voice",
              media_url: sendUrl,
              status: "sent",
              wappi_message_id: res.messageId,
            });
            if (chat?.id)
              await admin
                .from("whatsapp_chats")
                .update({
                  last_message_text: "🎤 Голос",
                  last_message_at: new Date().toISOString(),
                  last_direction: "outgoing",
                  unread_count: 0,
                })
                .eq("id", chat.id);

            await logWaV(admin, {
              company_id: acc.company_id,
              event: "send",
              message: "Голос аз барномаи дуюм фиристода шуд",
              detail: { phone: phoneV, message_id: res.messageId },
            });

            try {
              const { pushFunnelEvent } = await import("@/lib/funnel-sync.server");
              await pushFunnelEvent(
                "message.created",
                { id: acc.company_id },
                {
                  lead_id: chat?.customer_id ?? null,
                  chat_id: chat?.id ?? null,
                  phone: phoneV,
                  message: {
                    direction: "outgoing",
                    body: "",
                    message_type: "voice",
                    media_url: sendUrl,
                    status: "sent",
                    sent_at: new Date().toISOString(),
                  },
                },
              );
            } catch { /* noop */ }

            return json({ ok: true, messageId: res.messageId });
          } catch (e: any) {
            console.error("[funnel-inbound] voice error", e?.message);
            return json({ ok: false, error: e?.message ?? "error" }, 500);
          }
        }

        if (payload?.action !== "send_message")
          return json({ ok: false, error: "unknown_action" }, 400);


        const body = String(payload?.body ?? "").trim();
        const { normalizePhone, wappiSendText, logWa } = await import("@/lib/whatsapp.server");
        const phone = normalizePhone(payload?.phone);
        if (!phone || !body) return json({ ok: false, error: "phone_and_body_required" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const admin = supabaseAdmin as any;

          // Ширкатро аз профили Wappi мегирем (як профили фаъол)
          const { data: acc } = await admin
            .from("whatsapp_accounts")
            .select("company_id, profile_id")
            .eq("enabled", true)
            .limit(1)
            .maybeSingle();
          if (!acc) return json({ ok: false, error: "no_whatsapp_account" }, 503);

          // Чат/мизоҷи мавҷударо меҷӯем (нав насозем)
          const { data: chat } = await admin
            .from("whatsapp_chats")
            .select("id, customer_id")
            .eq("company_id", acc.company_id)
            .eq("phone", phone)
            .maybeSingle();

          const res = await wappiSendText(acc.profile_id, phone, body);
          if (!res.ok) {
            await logWa(admin, {
              company_id: acc.company_id,
              event: "send",
              level: "error",
              message: "Фиристодан аз барномаи дуюм ноком шуд: " + res.error,
            });
            return json({ ok: false, error: res.error }, 502);
          }

          await admin.from("whatsapp_messages").insert({
            company_id: acc.company_id,
            chat_id: chat?.id ?? null,
            customer_id: chat?.customer_id ?? null,
            direction: "outgoing",
            body,
            message_type: "text",
            status: "sent",
            wappi_message_id: res.messageId,
          });
          if (chat?.id)
            await admin
              .from("whatsapp_chats")
              .update({
                last_message_text: body,
                last_message_at: new Date().toISOString(),
                last_direction: "outgoing",
                unread_count: 0,
              })
              .eq("id", chat.id);

          await logWa(admin, {
            company_id: acc.company_id,
            event: "send",
            message: "Паём аз барномаи дуюм фиристода шуд",
            detail: { phone, message_id: res.messageId },
          });

          try {
            const { pushFunnelEvent } = await import("@/lib/funnel-sync.server");
            await pushFunnelEvent(
              "message.created",
              { id: acc.company_id },
              {
                lead_id: chat?.customer_id ?? null,
                chat_id: chat?.id ?? null,
                phone,
                message: {
                  direction: "outgoing",
                  body,
                  message_type: "text",
                  media_url: null,
                  status: "sent",
                  sent_at: new Date().toISOString(),
                },
              },
            );
          } catch {
            /* noop */
          }
          return json({ ok: true, messageId: res.messageId });

        } catch (e: any) {
          console.error("[funnel-inbound] error", e?.message);
          return json({ ok: false, error: e?.message ?? "error" }, 500);
        }
      },
    },
  },
});
