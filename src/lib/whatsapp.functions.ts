import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Фиристодани паёми WhatsApp аз CRM тавассути Wappi API. */
export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chatRowId: string; body: string }) =>
    z.object({ chatRowId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: chat, error: chatErr } = await supabase
      .from("whatsapp_chats")
      .select("id, company_id, chat_id, phone, profile_id, customer_id")
      .eq("id", data.chatRowId)
      .maybeSingle();
    if (chatErr || !chat) throw new Error("Чат ёфт нашуд");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { wappiSendText, logWa } = await import("@/lib/whatsapp.server");

    let profileId = chat.profile_id as string | null;
    if (!profileId) {
      const { data: acc } = await supabaseAdmin
        .from("whatsapp_accounts")
        .select("profile_id")
        .eq("company_id", chat.company_id)
        .eq("enabled", true)
        .limit(1)
        .maybeSingle();
      profileId = acc?.profile_id ?? null;
    }
    if (!profileId) throw new Error("Профили Wappi танзим нашудааст");

    // 1) паём дар ҳолати pending сабт мешавад
    const { data: msg, error: insErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        company_id: chat.company_id,
        chat_id: chat.id,
        customer_id: chat.customer_id,
        direction: "outgoing",
        body: data.body,
        message_type: "text",
        status: "pending",
        created_by: userId,
      })
      .select("id")
      .single();
    if (insErr || !msg) throw new Error(insErr?.message ?? "Паём сабт нашуд");

    // 2) даъвати Wappi API
    const res = await wappiSendText(profileId, chat.phone as string, data.body);

    if (!res.ok) {
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({ status: "failed", error_text: res.error })
        .eq("id", msg.id);
      await logWa(supabaseAdmin as any, {
        company_id: chat.company_id,
        event: "send",
        level: "error",
        message: "Фиристодан ноком шуд: " + res.error,
      });
      throw new Error(res.error);
    }

    await supabaseAdmin
      .from("whatsapp_messages")
      .update({ status: "sent", wappi_message_id: res.messageId })
      .eq("id", msg.id);
    await supabaseAdmin
      .from("whatsapp_chats")
      .update({
        last_message_text: data.body,
        last_message_at: new Date().toISOString(),
        last_direction: "outgoing",
      })
      .eq("id", chat.id);
    await logWa(supabaseAdmin as any, {
      company_id: chat.company_id,
      event: "send",
      message: "Паём фиристода шуд",
      detail: { message_id: res.messageId },
    });

    // Ба барномаи дуюм: паёми баромада (аз менеҷер) фавран синхрон мешавад
    try {
      const { pushFunnelEvent } = await import("@/lib/funnel-sync.server");
      await pushFunnelEvent(
        "message.created",
        { id: chat.company_id as string },
        {
          lead_id: chat.customer_id ?? null,
          chat_id: chat.id,
          phone: chat.phone,
          message: {
            direction: "outgoing",
            body: data.body,
            message_type: "text",
            media_url: null,
            status: "sent",
            sent_at: new Date().toISOString(),
          },
        },
      );
    } catch {
      /* синхронизатсия хатогии фиристоданро вайрон намекунад */
    }

    return { ok: true, messageId: res.messageId, id: msg.id };
  });


/** Санҷиши танзимоти интегратсия (бе ифшои калидҳо). */
export const whatsappIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    apiTokenSet: Boolean(process.env["WAPPI_API_TOKEN"]),
    webhookTokenSet: Boolean(process.env["WAPPI_WEBHOOK_AUTH_TOKEN"]),
  }));
