import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Snapshotи пурраи воронка + WhatsApp ба profit-flow-logic мефиристад (танҳо соҳиб/директор/admin). */
export const syncFunnelNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: companyId } = await supabase.rpc("user_company_id", { _user_id: userId });
    if (!companyId) throw new Error("Ширкат ёфт нашуд");

    const [{ data: isOwner }, { data: isDirector }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
      supabase.rpc("is_director", { _user_id: userId }),
      supabase.rpc("is_platform_admin", { _user_id: userId }),
    ]);
    if (!isOwner && !isDirector && !isAdmin) throw new Error("Иҷозат нест");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pushFunnelSnapshot } = await import("@/lib/funnel-sync.server");
    const res = await pushFunnelSnapshot(supabaseAdmin as any, companyId as string);
    if (!res.ok) throw new Error(res.error ?? `Синхронизатсия ноком шуд (${res.status ?? "?"})`);
    return { ok: true };
  });

/** Рӯйдоди яклик (тағйири лид / паёми нав) — fire-and-forget аз клиент. */
export const pushLeadChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; kind?: "lead" | "message" }) =>
    z.object({ leadId: z.string().uuid(), kind: z.enum(["lead", "message"]).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: companyId } = await supabase.rpc("user_company_id", { _user_id: userId });
    if (!companyId) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: c } = await admin
      .from("customers")
      .select(
        "id, fullname, phone, status, funnel_stage, source, assigned_manager_id, crm_fields, created_at, company_id",
      )
      .eq("id", data.leadId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!c) return { ok: false };

    const [{ data: mgr }, { data: chat }] = await Promise.all([
      c.assigned_manager_id
        ? admin
            .from("sales_team_members")
            .select("id, fullname, email, user_id")
            .eq("id", c.assigned_manager_id)
            .maybeSingle()
        : { data: null },
      admin
        .from("whatsapp_chats")
        .select("id, avatar_url, last_direction, last_message_at, last_message_text, unread_count")
        .eq("company_id", companyId)
        .or(`customer_id.eq.${c.id},phone.eq.${String(c.phone ?? "").replace(/\D/g, "")}`)
        .limit(1)
        .maybeSingle(),
    ]);

    const fields = (c.crm_fields ?? {}) as any;
    const { pushFunnelEvent } = await import("@/lib/funnel-sync.server");
    const res = await pushFunnelEvent(
      "lead.upsert",
      { id: companyId as string },
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
          last_direction: chat?.last_direction ?? null,
          last_message_at: chat?.last_message_at ?? null,
          unread_count: chat?.unread_count ?? 0,
          created_at: c.created_at,
        },
        manager: mgr ?? null,
      },
    );
    return { ok: res.ok };
  });
