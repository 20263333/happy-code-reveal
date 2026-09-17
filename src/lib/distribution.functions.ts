import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isOwnerOrAdmin(supabase: any, userId: string) {
  const [{ data: pa }, { data: role }] = await Promise.all([
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle(),
  ]);
  return { isAdmin: !!pa, isOwner: !!role };
}

async function getProjectCompanyId(admin: any, projectId: string) {
  const { data } = await admin.from("projects").select("company_id").eq("id", projectId).maybeSingle();
  return data?.company_id as string | undefined;
}

// Read access to partner data for a project: owner / platform admin /
// partner-director / any staff of the same company who has access to the
// project. Staff can only READ — every write path still requires owner.
async function canViewProjectPartners(supabase: any, userId: string, projectId?: string) {
  const { isAdmin, isOwner } = await isOwnerOrAdmin(supabase, userId);
  if (isAdmin || isOwner) return true;
  if (!projectId) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const companyId = await getProjectCompanyId(supabaseAdmin, projectId);
  if (!companyId) return false;

  const { data: prof } = await (supabaseAdmin as any)
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (prof?.company_id !== companyId) return false;

  const { data: staffRow } = await (supabaseAdmin as any)
    .from("project_staff").select("project_id").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  if (staffRow) return true;

  const { data: share } = await (supabaseAdmin as any)
    .from("partner_shares").select("id").eq("project_id", projectId).eq("director_user_id", userId).maybeSingle();
  return !!share;
}


// ============== OWNER: manage shares ==============

export const listPartnerShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let client: any = supabase;
    if (await canViewProjectPartners(supabase, userId, data.project_id)) {
      client = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }
    const { data: shares, error } = await client
      .from("partner_shares")
      .select("id, project_id, director_user_id, percent, note, created_at")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);


    const ids = (shares ?? []).map((s: any) => s.director_user_id);
    let profiles: any[] = [];
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: pr } = await (supabaseAdmin as any)
        .from("profiles").select("id, fullname, phone").in("id", ids);
      profiles = pr ?? [];
    }
    const withNames = (shares ?? []).map((s: any) => ({
      ...s,
      director_name: profiles.find((p) => p.id === s.director_user_id)?.fullname ?? "—",
      director_phone: profiles.find((p) => p.id === s.director_user_id)?.phone ?? null,
    }));
    const total = withNames.reduce((sum: number, s: any) => sum + Number(s.percent || 0), 0);
    return { shares: withNames, total_percent: total, construction_percent: Math.max(0, 100 - total) };
  });

export const upsertPartnerShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    project_id: z.string().uuid(),
    director_user_id: z.string().uuid(),
    percent: z.number().min(0.01).max(100),
    note: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const companyId = await getProjectCompanyId(supabaseAdmin, data.project_id);
    if (!companyId) throw new Error("Лоиҳа ёфт нашуд");

    // Verify director belongs to same company
    const { data: dir } = await (supabaseAdmin as any).from("company_directors")
      .select("user_id").eq("company_id", companyId).eq("user_id", data.director_user_id).maybeSingle();
    if (!dir) throw new Error("Ин директор ба ширкати шумо тааллуқ надорад");

    if (data.id) {
      const { error } = await (supabaseAdmin as any).from("partner_shares")
        .update({ percent: data.percent, note: data.note ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabaseAdmin as any).from("partner_shares").insert({
        company_id: companyId,
        project_id: data.project_id,
        director_user_id: data.director_user_id,
        percent: data.percent,
        note: data.note ?? null,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePartnerShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("partner_shares").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== Payouts ==============

export const payPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid(),
    director_user_id: z.string().uuid(),
    amount: z.number().positive(),
    paid_date: z.string().optional(),
    note: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const companyId = await getProjectCompanyId(supabaseAdmin, data.project_id);
    if (!companyId) throw new Error("Лоиҳа ёфт нашуд");

    const { error } = await (supabaseAdmin as any).from("partner_payouts").insert({
      company_id: companyId,
      project_id: data.project_id,
      director_user_id: data.director_user_id,
      amount: data.amount,
      paid_date: data.paid_date ?? new Date().toISOString().slice(0, 10),
      note: data.note ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    const { pushCompanyPartnersSnapshot } = await import("./distribution-sync.server");
    await pushCompanyPartnersSnapshot(supabaseAdmin, companyId);
    return { ok: true };
  });


// Company-wide payout: splits one amount across the partner's projects that
// still have a positive balance (used by the dashboard "Тақсими даромад").
export const payPartnerCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    director_user_id: z.string().uuid(),
    amount: z.number().positive(),
    paid_date: z.string().optional(),
    note: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");

    const { data: prof } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = prof?.company_id;
    if (!companyId) throw new Error("Ширкат ёфт нашуд");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: projects } = await admin.from("projects").select("id").eq("company_id", companyId);
    const projectIds = (projects ?? []).map((p: any) => p.id);
    if (!projectIds.length) throw new Error("Лоиҳа нест");

    const [{ data: shares }, { data: dists }, { data: payouts }, { data: damages }] = await Promise.all([
      admin.from("partner_shares").select("project_id, director_user_id, percent").in("project_id", projectIds),
      admin.from("partner_distributions").select("project_id, director_user_id, amount")
        .eq("director_user_id", data.director_user_id).in("project_id", projectIds),
      admin.from("partner_payouts").select("project_id, amount")
        .eq("director_user_id", data.director_user_id).in("project_id", projectIds),
      admin.from("car_damages").select("project_id, amount").in("project_id", projectIds),
    ]);

    const baseByProject = new Map<string, number>();
    for (const s of shares ?? []) {
      baseByProject.set(s.project_id, (baseByProject.get(s.project_id) ?? 0) + Number(s.percent || 0));
    }
    const damageByProject = new Map<string, number>();
    for (const d of damages ?? []) {
      damageByProject.set(d.project_id, (damageByProject.get(d.project_id) ?? 0) + Number(d.amount || 0));
    }
    const balance = new Map<string, number>();
    for (const d of dists ?? []) {
      balance.set(d.project_id, (balance.get(d.project_id) ?? 0) + Number(d.amount || 0));
    }
    for (const s of shares ?? []) {
      if (s.director_user_id !== data.director_user_id) continue;
      const base = baseByProject.get(s.project_id) || 100;
      const dmg = (damageByProject.get(s.project_id) ?? 0) * (Number(s.percent || 0) / base);
      balance.set(s.project_id, (balance.get(s.project_id) ?? 0) - dmg);
    }
    for (const p of payouts ?? []) {
      balance.set(p.project_id, (balance.get(p.project_id) ?? 0) - Number(p.amount || 0));
    }

    const positive = Array.from(balance.entries())
      .filter(([, v]) => v > 0.009)
      .sort((a, b) => b[1] - a[1]);
    if (!positive.length) throw new Error("Қарзи пардохтнашуда нест");

    const total = positive.reduce((s, [, v]) => s + v, 0);
    if (data.amount > total + 0.01) throw new Error("Маблағ аз бақия зиёд аст");

    let left = data.amount;
    const rows: any[] = [];
    for (const [projectId, bal] of positive) {
      if (left <= 0.009) break;
      const part = Math.min(bal, left);
      left -= part;
      rows.push({
        company_id: companyId,
        project_id: projectId,
        director_user_id: data.director_user_id,
        amount: Math.round(part * 100) / 100,
        paid_date: data.paid_date ?? new Date().toISOString().slice(0, 10),
        note: data.note ?? null,
        created_by: userId,
      });
    }

    const { error } = await admin.from("partner_payouts").insert(rows);
    if (error) throw new Error(error.message);
    const { pushCompanyPartnersSnapshot } = await import("./distribution-sync.server");
    await pushCompanyPartnersSnapshot(admin, companyId);
    return { ok: true, parts: rows.length };
  });



export const listPartnerPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid().optional(),
    director_user_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let client: any = supabase;
    if (data.project_id && await canViewProjectPartners(supabase, userId, data.project_id)) {
      client = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }
    let q = client.from("partner_payouts")
      .select("id, project_id, director_user_id, amount, paid_date, note, created_at")
      .order("paid_date", { ascending: false });

    if (data.project_id) q = q.eq("project_id", data.project_id);
    if (data.director_user_id) q = q.eq("director_user_id", data.director_user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { payouts: rows ?? [] };
  });

export const deletePartnerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("partner_payouts").select("company_id").eq("id", data.id).maybeSingle();
    const { error } = await (supabaseAdmin as any).from("partner_payouts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.company_id) {
      const { pushCompanyPartnersSnapshot } = await import("./distribution-sync.server");
      await pushCompanyPartnersSnapshot(supabaseAdmin, row.company_id);
    }
    return { ok: true };
  });

/** Дастӣ: ҳолати шарикони ширкатро ба барномаи дуюм мефиристад. */
export const syncCompanyPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ director_user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");
    const { data: prof } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = prof?.company_id;
    if (!companyId) throw new Error("Ширкат ёфт нашуд");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeSalesPartnerSnapshot } = await import("./distribution-sync.server");
    const { pushSalesPartnerEvent } = await import("./sales-webhook.server");
    const snap = await computeSalesPartnerSnapshot(supabaseAdmin as any, companyId, data.director_user_id);
    if (!snap.members.some((member) => member.id === data.director_user_id)) {
      throw new Error("Шарики фурӯш ёфт нашуд");
    }
    const res = await pushSalesPartnerEvent("snapshot.sync", { id: companyId }, snap);
    if (!res.ok) {
      throw new Error(
        res.error === "webhook_not_configured"
          ? "Webhook дастрас нест — суроғаи барномаи дуюмро санҷед"
          : `Хатогии фиристодан: ${res.status ?? ""} ${res.error ?? ""}`,
      );
    }
    return {
      ok: true,
      members: 1,
      payouts: snap.payouts.length,
      amount: snap.amount,
      imported: res.ledgerImported ?? 0,
      totals: snap.totals,
    };
  });


export const rollbackExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо роҳбар метавонад хароҷотро нест кунад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: expense, error: expenseError } = await admin
      .from("expenses")
      .select("id, category, amount, project_id")
      .eq("id", data.id)
      .maybeSingle();
    if (expenseError) throw new Error(expenseError.message);
    if (!expense) return { ok: true, already_deleted: true };

    // Always resolve by the persisted relation, not by the editable category.
    // Deleting a linked payout runs partner_payout_reverse(), restoring the
    // paid distribution rows before the expense itself is removed.
    const { data: linkedPayouts, error: payoutLookupError } = await admin
      .from("partner_payouts")
      .select("id")
      .eq("expense_id", data.id);
    if (payoutLookupError) throw new Error(payoutLookupError.message);

    if (linkedPayouts?.length) {
      const payoutIds = linkedPayouts.map((p: { id: string }) => p.id);
      const { error: payoutError } = await admin
        .from("partner_payouts")
        .delete()
        .in("id", payoutIds);
      if (payoutError) throw new Error(payoutError.message);
    }

    const { error: deleteError } = await admin.from("expenses").delete().eq("id", data.id);
    if (deleteError) throw new Error(deleteError.message);

    const { data: remaining, error: verifyError } = await admin
      .from("expenses")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (verifyError) throw new Error(verifyError.message);
    if (remaining) throw new Error("Хароҷот нест нашуд. Маблағ тағйир дода нашуд.");

    return {
      ok: true,
      already_deleted: false,
      restored_amount: Number(expense.amount),
      project_id: expense.project_id,
    };
  });

// ============== Distributions (accrual history) ==============

export const listPartnerDistributions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid().optional(),
    director_user_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let client: any = supabase;
    if (data.project_id && await canViewProjectPartners(supabase, userId, data.project_id)) {
      client = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }
    let q = client.from("partner_distributions")
      .select("id, project_id, payment_id, sale_id, director_user_id, percent, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.project_id) q = q.eq("project_id", data.project_id);
    if (data.director_user_id) q = q.eq("director_user_id", data.director_user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { distributions: rows ?? [] };
  });

// ============== Summary (for director dashboard) ==============

export const getPartnerSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    director_user_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dirId = data.director_user_id ?? userId;

    // My shares (list of projects where I'm a partner)
    let sharesQ = supabase.from("partner_shares")
      .select("id, project_id, percent, projects:project_id(id,name,company_id)")
      .eq("director_user_id", dirId);
    const { data: shares } = await sharesQ;

    // Distributions
    let distQ = supabase.from("partner_distributions")
      .select("project_id, amount, status, created_at")
      .eq("director_user_id", dirId);
    if (data.project_id) distQ = distQ.eq("project_id", data.project_id);
    const { data: dists } = await distQ;

    // Payouts
    let payQ = supabase.from("partner_payouts")
      .select("project_id, amount, paid_date")
      .eq("director_user_id", dirId);
    if (data.project_id) payQ = payQ.eq("project_id", data.project_id);
    const { data: payouts } = await payQ;

    // Car damages — deduct proportional to this director's share per project
    const projectIds = Array.from(new Set([
      ...(shares ?? []).map((s: any) => s.project_id),
      ...(dists ?? []).map((r: any) => r.project_id),
    ].filter(Boolean)));
    let damageDeduction = 0;
    if (projectIds.length) {
      let dmgQ = supabase.from("car_damages")
        .select("project_id, amount")
        .in("project_id", projectIds);
      const { data: damages } = await dmgQ;
      // Load all partner shares for these projects to compute share base
      const { data: allShares } = await supabase.from("partner_shares")
        .select("project_id, director_user_id, percent")
        .in("project_id", projectIds);
      const totalsByProject = new Map<string, number>();
      const myPctByProject = new Map<string, number>();
      for (const s of allShares ?? []) {
        totalsByProject.set(s.project_id, (totalsByProject.get(s.project_id) ?? 0) + Number(s.percent || 0));
        if (s.director_user_id === dirId) {
          myPctByProject.set(s.project_id, Number(s.percent || 0));
        }
      }
      const damageByProject = new Map<string, number>();
      for (const d of damages ?? []) {
        damageByProject.set(d.project_id, (damageByProject.get(d.project_id) ?? 0) + Number(d.amount || 0));
      }
      for (const [pid, dmgTotal] of damageByProject.entries()) {
        const myPct = myPctByProject.get(pid) ?? 0;
        const base = totalsByProject.get(pid) || 100;
        damageDeduction += dmgTotal * (myPct / (base || 100));
      }
    }

    // Комиссияи дастаи фурӯш — аз ҳиссаи худи шарики фурӯш минус мешавад
    let commissionDeduction = 0;
    {
      const { data: team } = await supabase
        .from("sales_team_members").select("id").eq("owner_user_id", dirId);
      const memberIds = (team ?? []).map((m: any) => m.id);
      if (memberIds.length) {
        let cq = supabase.from("sales")
          .select("commission_amount, status, project_id")
          .in("sales_manager_id", memberIds);
        if (data.project_id) cq = cq.eq("project_id", data.project_id);
        const { data: cs } = await cq;
        commissionDeduction = (cs ?? [])
          .filter((r: any) => r.status !== "cancelled")
          .reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0);
      }
    }

    const earnedRaw = (dists ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const earned = Math.max(0, earnedRaw - damageDeduction - commissionDeduction);
    const paid = (payouts ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const balance = earned - paid;

    // Group by month for chart
    const monthly = new Map<string, number>();
    for (const r of dists ?? []) {
      const m = String(r.created_at).slice(0, 7);
      monthly.set(m, (monthly.get(m) ?? 0) + Number(r.amount || 0));
    }

    return {
      shares: shares ?? [],
      earned, paid, balance,
      damage_deduction: damageDeduction,
      commission_deduction: commissionDeduction,
      monthly: Array.from(monthly.entries()).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
    };
  });

// Get project revenue (sum of confirmed payments) — director-partner scope
export const getProjectPartnerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Reads via sales → payments; RLS allows director-partners now
    const { data: sales } = await supabase.from("sales")
      .select("id, full_price").eq("project_id", data.project_id);
    const saleIds = (sales ?? []).map((s: any) => s.id);
    let confirmed = 0;
    if (saleIds.length) {
      const { data: pays } = await supabase.from("payments")
        .select("amount, status").in("sale_id", saleIds);
      confirmed = (pays ?? []).filter((p: any) => p.status === "confirmed")
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    }
    const total_price = (sales ?? []).reduce((s: number, x: any) => s + Number(x.full_price || 0), 0);
    return { total_price, confirmed_payments: confirmed, sales_count: sales?.length ?? 0 };
  });

// ============== Cost basis (себестоимость) ==============

export const getProjectCostBasis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: proj, error } = await supabase
      .from("projects")
      .select("id, cost_per_sqm, cost_currency")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: rate } = await supabase
      .from("exchange_rates")
      .select("usd_rate, date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      cost_per_sqm: proj?.cost_per_sqm ? Number(proj.cost_per_sqm) : null,
      cost_currency: (proj?.cost_currency as "USD" | "TJS") ?? "USD",
      usd_rate: rate?.usd_rate ? Number(rate.usd_rate) : null,
    };
  });

export const updateProjectCostBasis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid(),
    cost_per_sqm: z.number().min(0).nullable(),
    cost_currency: z.enum(["USD", "TJS"]).default("USD"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    if (!isOwner && !isAdmin) throw new Error("Танҳо соҳиби ширкат");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("projects")
      .update({
        cost_per_sqm: data.cost_per_sqm,
        cost_currency: data.cost_currency,
      })
      .eq("id", data.project_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recomputeProjectDistributions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await (supabase as any)
      .rpc("recompute_project_distributions", { _project_id: data.project_id });
    if (error) throw new Error(error.message);
    return result ?? { ok: true };
  });

// ============== Company-wide summary (dashboard card) ==============

export const getCompanyDistributionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ project_ids: z.array(z.string().uuid()).max(500).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);

    const { data: prof } = await supabase
      .from("profiles").select("company_id, department, extra_pages, denied_pages").eq("id", userId).maybeSingle();
    const companyId = prof?.company_id;

    // Staff granted "dashboard:distribution" in Доступ к страницам may READ the
    // summary too (either explicitly, or via their department defaults).
    // Company directors (partners — Шарики Лохия / Шарики фуруш) may also READ
    // the summary of their own company.
    // Write paths (payPartnerCompany etc.) still require owner.
    const { computeAllowedPages } = await import("@/lib/app-pages");
    const staffGranted = computeAllowedPages(
      ((prof as any)?.department ?? null) as any,
      ((prof as any)?.extra_pages as string[] | null) ?? [],
      ((prof as any)?.denied_pages as string[] | null) ?? [],
    ).has("dashboard:distribution");

    const { data: dirRole } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "director").maybeSingle();
    const isDirector = !!dirRole;

    const empty = {
      allowed: false as const,
      confirmed: 0, partners_total: 0, damage_total: 0, construction: 0,
      construction_spent: 0, construction_balance: 0,
      partners: [] as Array<{
        director_user_id: string; name: string; percent: number; earned: number; paid: number; balance: number;
        payout_count: number;
        payouts: Array<{ id: string; amount: number; paid_date: string | null; note: string | null; project_name: string }>;
      }>,
    };

    if (!companyId || (!isOwner && !isAdmin && !staffGranted && !isDirector)) return empty;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: projects } = await admin
      .from("projects").select("id, name").eq("company_id", companyId);
    const projectNames = new Map<string, string>((projects ?? []).map((p: any) => [p.id, p.name]));
    let projectIds = (projects ?? []).map((p: any) => p.id);
    if (data.project_ids?.length) {
      const allow = new Set(data.project_ids);
      projectIds = projectIds.filter((id: string) => allow.has(id));
    }
    if (!projectIds.length) return { ...empty, allowed: true as const };

    let paymentsQuery = admin
      .from("payments")
      .select("amount, sales!inner(project_id, company_id)")
      .eq("status", "confirmed")
      .eq("sales.company_id", companyId);
    paymentsQuery = paymentsQuery.in("sales.project_id", projectIds);

    const [{ data: shares }, { data: dists }, { data: payouts }, { data: damages }, { data: payments }] =
      await Promise.all([
        admin.from("partner_shares").select("project_id, director_user_id, percent").in("project_id", projectIds),
        admin.from("partner_distributions").select("project_id, director_user_id, amount").in("project_id", projectIds),
        admin.from("partner_payouts").select("project_id, director_user_id, amount").in("project_id", projectIds),
        admin.from("car_damages").select("project_id, amount").in("project_id", projectIds),
        paymentsQuery,
      ]);

    const confirmed = (payments ?? []).reduce(
      (sum: number, payment: any) => sum + Number(payment.amount || 0),
      0,
    );

    // Damage per project + share base per project
    const damageByProject = new Map<string, number>();
    for (const d of damages ?? []) {
      damageByProject.set(d.project_id, (damageByProject.get(d.project_id) ?? 0) + Number(d.amount || 0));
    }
    const baseByProject = new Map<string, number>();
    for (const s of shares ?? []) {
      baseByProject.set(s.project_id, (baseByProject.get(s.project_id) ?? 0) + Number(s.percent || 0));
    }

    type Agg = { earnedRaw: number; damage: number; paid: number; percentSum: number; projects: Set<string> };
    const byDir = new Map<string, Agg>();
    const get = (id: string) => {
      let a = byDir.get(id);
      if (!a) { a = { earnedRaw: 0, damage: 0, paid: 0, percentSum: 0, projects: new Set() }; byDir.set(id, a); }
      return a;
    };

    for (const s of shares ?? []) {
      const a = get(s.director_user_id);
      a.percentSum += Number(s.percent || 0);
      a.projects.add(s.project_id);
      const base = baseByProject.get(s.project_id) || 100;
      a.damage += (damageByProject.get(s.project_id) ?? 0) * (Number(s.percent || 0) / base);
    }
    for (const d of dists ?? []) get(d.director_user_id).earnedRaw += Number(d.amount || 0);
    for (const p of payouts ?? []) get(p.director_user_id).paid += Number(p.amount || 0);

    const ids = Array.from(byDir.keys());
    let profiles: any[] = [];
    if (ids.length) {
      const { data: pr } = await admin.from("profiles").select("id, fullname").in("id", ids);
      profiles = pr ?? [];
    }

    const partners = ids.map((id) => {
      const a = byDir.get(id)!;
      const earned = Math.max(0, a.earnedRaw - a.damage);
      return {
        director_user_id: id,
        name: profiles.find((p) => p.id === id)?.fullname ?? "—",
        percent: a.projects.size ? a.percentSum / a.projects.size : 0,
        earned,
        paid: a.paid,
        balance: earned - a.paid,
      };
    }).sort((x, y) => y.earned - x.earned);

    const partnersTotal = partners.reduce((s, p) => s + p.earned, 0);
    const damageTotal = Array.from(damageByProject.values()).reduce((s, v) => s + v, 0);

    // Хароҷоти аз хазинаи сохтмон пардохтшуда (лоиҳаҳои дохилишуда + умумии ширкат)
    const { data: companyUsers } = await admin
      .from("profiles").select("id").eq("company_id", companyId);
    const companyUserIds = (companyUsers ?? []).map((u: any) => u.id);
    // Пардохт ба шарикон аз ҳиссаи худи шарик меравад — дар хароҷоти
    // хазинаи сохтмон дубора ҳисоб намешавад.
    const [{ data: projExp }, { data: generalExp }] = await Promise.all([
      admin.from("expenses").select("amount").in("project_id", projectIds).neq("category", "partner_payout"),
      companyUserIds.length
        ? admin.from("expenses").select("amount").is("project_id", null).in("created_by", companyUserIds).neq("category", "partner_payout")
        : Promise.resolve({ data: [] }),
    ]);
    const constructionSpent = [...(projExp ?? []), ...(generalExp ?? [])]
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const construction = confirmed - partnersTotal - damageTotal;

    return {
      allowed: true as const,
      confirmed,
      partners_total: partnersTotal,
      damage_total: damageTotal,
      construction,
      construction_spent: constructionSpent,
      construction_balance: construction - constructionSpent,
      partners,
    };
  });


// ============== Construction fund per block (child projects of a ЖК) ==============

export const getBlocksConstructionFund = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ parent_project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const allowed = await canViewProjectPartners(supabase, userId, data.parent_project_id);
    if (!allowed) return { allowed: false as const, blocks: [] as Array<{ project_id: string; construction: number }> };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: blocks } = await admin
      .from("projects").select("id").eq("parent_id", data.parent_project_id);
    const ids = (blocks ?? []).map((b: any) => b.id);
    if (!ids.length) return { allowed: true as const, blocks: [] };

    const [{ data: dists }, { data: damages }, { data: sales }] = await Promise.all([
      admin.from("partner_distributions").select("project_id, amount").in("project_id", ids),
      admin.from("car_damages").select("project_id, amount").in("project_id", ids),
      admin.from("sales").select("id, project_id").in("project_id", ids),
    ]);

    const saleProject = new Map<string, string>();
    for (const s of sales ?? []) saleProject.set(s.id, s.project_id);
    const saleIds = Array.from(saleProject.keys());

    const confirmedByProject = new Map<string, number>();
    for (let i = 0; i < saleIds.length; i += 500) {
      const chunk = saleIds.slice(i, i + 500);
      const { data: pays } = await admin
        .from("payments").select("amount, status, sale_id").in("sale_id", chunk);
      for (const p of pays ?? []) {
        if (p.status !== "confirmed") continue;
        const pid = saleProject.get(p.sale_id);
        if (!pid) continue;
        confirmedByProject.set(pid, (confirmedByProject.get(pid) ?? 0) + Number(p.amount || 0));
      }
    }

    const distByProject = new Map<string, number>();
    for (const d of dists ?? []) distByProject.set(d.project_id, (distByProject.get(d.project_id) ?? 0) + Number(d.amount || 0));
    const damageByProject = new Map<string, number>();
    for (const d of damages ?? []) damageByProject.set(d.project_id, (damageByProject.get(d.project_id) ?? 0) + Number(d.amount || 0));

    return {
      allowed: true as const,
      blocks: ids.map((id: string) => ({
        project_id: id,
        construction:
          (confirmedByProject.get(id) ?? 0) - (distByProject.get(id) ?? 0) - (damageByProject.get(id) ?? 0),
      })),
    };
  });
