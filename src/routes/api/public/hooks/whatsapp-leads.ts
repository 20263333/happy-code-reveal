import { createFileRoute } from "@tanstack/react-router";

// Webhook-эндпоинт барои Wappi.pro (WhatsApp).
// Wappi ба ин суроға рӯйдодҳоро мефиристад: паёмҳои воридотӣ, ҳолати паёмҳо,
// паёмҳои содиротӣ (API ва телефон).
//
// Бехатарӣ: токени авторизатсия (WAPPI_WEBHOOK_AUTH_TOKEN) танҳо дар сервер
// нигоҳ дошта мешавад ва дар ҳар дархост тафтиш карда мешавад.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/hooks/whatsapp-leads")({
  server: {
    handlers: {
      // Санҷиши дастрасӣ (Wappi баъзан GET мефиристад)
      GET: async () => json({ ok: true, endpoint: "wappi-webhook", ready: true }),

      POST: async ({ request }) => {
        const { checkWebhookAuth, handleWappiWebhook, logWa } = await import(
          "@/lib/whatsapp.server"
        );

        const auth = checkWebhookAuth(request);
        if (!auth.ok) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await logWa(supabaseAdmin as any, {
              event: "auth",
              level: "error",
              message:
                auth.reason === "not_configured"
                  ? "WAPPI_WEBHOOK_AUTH_TOKEN танзим нашудааст"
                  : "Токени нодурусти webhook",
            });
          } catch {
            /* ignore */
          }
          return json(
            { ok: false, error: auth.reason === "not_configured" ? "not configured" : "unauthorized" },
            auth.reason === "not_configured" ? 503 : 401,
          );
        }

        let payload: any = null;
        try {
          payload = await request.json();
        } catch {
          return json({ ok: false, error: "invalid json" }, 400);
        }

        try {
          const result = await handleWappiWebhook(payload);
          return json({ ok: result.ok, result: result.result });
        } catch (e: any) {
          console.error("[wappi] webhook error", e?.message);
          return json({ ok: false, error: e?.message ?? "unknown error" }, 500);
        }
      },
    },
  },
});
