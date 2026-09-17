import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callerCompany(supabase: any, userId: string): Promise<string> {
  const { data: owned } = await supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
  if (owned?.id) return owned.id as string;
  const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!prof?.company_id) throw new Error("Ширкат ёфт нашуд");
  return prof.company_id as string;
}

/** Комиссияи аз фурӯшҳо ҳисобшуда барои ҳар аъзо (member_id → маблағ). */
async function commissionsByMember(supabase: any, memberIds: string[]): Promise<Record<string, number>> {
  if (!memberIds.length) return {};
  const { data } = await supabase
    .from("sales")
    .select("sales_manager_id, commission_amount, status")
    .in("sales_manager_id", memberIds)
    .limit(20000);
  const map: Record<string, number> = {};
  for (const r of data ?? []) {
    if (r.status === "cancelled") continue;
    const k = r.sales_manager_id as string;
    map[k] = (map[k] ?? 0) + Number(r.commission_amount || 0);
  }
  return map;
}

/** Шарики фурӯш: рӯйхати менеҷерҳо ва кормандон бо ҳисоб. */
export const listSalesTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: members, error } = await supabase
      .from("sales_team_members")
      .select("id, fullname, email, kind, percent, is_active, user_id, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (members ?? []).map((m: any) => m.id);
    let payouts: any[] = [];
    if (ids.length) {
      const { data: p } = await supabase
        .from("sales_team_payouts")
        .select("id, member_id, amount, note, paid_at")
        .in("member_id", ids)
        .order("paid_at", { ascending: false });
      payouts = p ?? [];
    }
    const comm = await commissionsByMember(supabase, ids);
    const rows = (members ?? []).map((m: any) => {
      const earned = comm[m.id] ?? 0;
      const paid = payouts.filter((p) => p.member_id === m.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      return { ...m, earned, paid, balance: earned - paid };
    });
    const base = rows.reduce((s: number, r: any) => s + r.earned, 0);
    return { base, members: rows, payouts };
  });

/** Дашборди худи менеҷер/корманд. */
export const myTeamEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: m } = await supabase
      .from("sales_team_members")
      .select("id, fullname, kind, percent, owner_user_id, is_active")
      .eq("user_id", userId)
      .maybeSingle();
    if (!m) return { member: null, earned: 0, paid: 0, balance: 0, payouts: [] as any[] };
    const comm = await commissionsByMember(supabase, [m.id]);
    const { data: payouts } = await supabase
      .from("sales_team_payouts")
      .select("id, amount, note, paid_at")
      .eq("member_id", m.id)
      .order("paid_at", { ascending: false });
    const earned = comm[m.id] ?? 0;
    const paid = (payouts ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return { member: m, earned, paid, balance: earned - paid, payouts: payouts ?? [] };
  });

const CreateSchema = z.object({
  fullname: z.string().min(2).max(120),
  kind: z.enum(["manager", "staff"]),
  percent: z.number().min(0).max(100),
  email: z.string().email().max(255).optional().nullable(),
  password: z.string().min(6).max(72).optional().nullable(),
});

export const createSalesTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await callerCompany(supabase, userId);

    let memberUserId: string | null = null;
    if (data.email && data.password) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = (list?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === data.email!.toLowerCase(),
      );
      if (found) {
        memberUserId = found.id;
        await admin.auth.admin.updateUserById(found.id, { password: data.password, email_confirm: true });
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: data.email, password: data.password, email_confirm: true,
          user_metadata: { fullname: data.fullname },
        });
        if (cErr) throw new Error(cErr.message);
        memberUserId = created.user?.id ?? null;
      }
      if (memberUserId) {
        await admin.from("profiles").upsert({ id: memberUserId, fullname: data.fullname, company_id: companyId });
      }
    }

    const { data: inserted, error } = await supabase.from("sales_team_members").insert({
      company_id: companyId,
      owner_user_id: userId,
      user_id: memberUserId,
      email: data.email ?? null,
      fullname: data.fullname,
      kind: data.kind,
      percent: data.percent,
    }).select("id, fullname, email, kind, percent, user_id, created_at").maybeSingle();
    if (error) throw new Error(error.message);
    const { pushSalesPartnerEvent } = await import("./sales-webhook.server");
    await pushSalesPartnerEvent("member.created", { id: companyId }, inserted);
    return { ok: true };
  });

export const updateSalesTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    fullname: z.string().min(2).max(120).optional(),
    percent: z.number().min(0).max(100).optional(),
    is_active: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { error } = await supabase
      .from("sales_team_members").update(patch).eq("id", id).eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSalesTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sales_team_members").delete().eq("id", data.id).eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const paySalesTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    member_id: z.string().uuid(),
    amount: z.number().positive(),
    note: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: m } = await supabase
      .from("sales_team_members").select("id, company_id")
      .eq("id", data.member_id).eq("owner_user_id", userId).maybeSingle();
    if (!m) throw new Error("Аъзо ёфт нашуд");
    const { data: row, error } = await supabase.from("sales_team_payouts").insert({
      company_id: m.company_id,
      member_id: m.id,
      owner_user_id: userId,
      amount: data.amount,
      note: data.note ?? null,
    }).select("id, member_id, amount, note, paid_at").maybeSingle();
    if (error) throw new Error(error.message);

    const { data: member } = await supabase
      .from("sales_team_members").select("id, fullname, email, kind, percent, user_id")
      .eq("id", m.id).maybeSingle();
    const { pushSalesPartnerEvent } = await import("./sales-webhook.server");
    await pushSalesPartnerEvent("payout.created", { id: m.company_id }, { payout: row, member });
    return { ok: true };
  });

/** Ҳамаи аъзоён + балансро якбора ба барномаи дуюм мефиристад. */
export const syncSalesPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await callerCompany(supabase, userId);
    const { data: members } = await supabase
      .from("sales_team_members")
      .select("id, fullname, email, kind, percent, is_active, user_id, created_at")
      .eq("owner_user_id", userId);
    const ids = (members ?? []).map((m: any) => m.id);
    let payouts: any[] = [];
    if (ids.length) {
      const { data: p } = await supabase
        .from("sales_team_payouts").select("id, member_id, amount, note, paid_at").in("member_id", ids);
      payouts = p ?? [];
    }
    const comm = await commissionsByMember(supabase, ids);
    const rows = (members ?? []).map((m: any) => {
      const earned = comm[m.id] ?? 0;
      const paid = payouts.filter((p) => p.member_id === m.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      return { ...m, earned, paid, balance: earned - paid };
    });
    const { pushSalesPartnerEvent } = await import("./sales-webhook.server");
    const res = await pushSalesPartnerEvent("snapshot.sync", { id: companyId }, { members: rows, payouts });
    if (!res.ok) {
      throw new Error(
        res.error === "webhook_not_configured"
          ? "Webhook дастрас нест — суроғаи барномаи дуюмро санҷед"
          : `Хатогии фиристодан: ${res.status ?? ""} ${res.error ?? ""}`,
      );
    }
    return { ok: true, members: rows.length, payouts: payouts.length };
  });
