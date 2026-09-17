import { pushSalesPartnerEvent } from "./sales-webhook.server";

export type PartnerSnapshotRow = {
  id: string;
  fullname: string;
  email: string | null;
  kind: "partner";
  percent: number;
  earned: number;
  paid: number;
  balance: number;
};

/** Ҳисоби ҳолати ҷории шарикони ширкат (мисли карточкаҳои «Тақсими даромад»). */
export async function computeCompanyPartners(admin: any, companyId: string) {
  const { data: projects } = await admin.from("projects").select("id").eq("company_id", companyId);
  const projectIds = (projects ?? []).map((p: any) => p.id);
  if (!projectIds.length) return { members: [] as PartnerSnapshotRow[], payouts: [] as any[] };

  const [{ data: shares }, { data: dists }, { data: payouts }, { data: damages }] = await Promise.all([
    admin.from("partner_shares").select("project_id, director_user_id, percent").in("project_id", projectIds),
    admin.from("partner_distributions").select("project_id, director_user_id, amount").in("project_id", projectIds),
    admin.from("partner_payouts").select("id, project_id, director_user_id, amount, note, paid_date, created_at").in("project_id", projectIds),
    admin.from("car_damages").select("project_id, amount").in("project_id", projectIds),
  ]);

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

  const members: PartnerSnapshotRow[] = ids.map((id) => {
    const a = byDir.get(id)!;
    const earned = Math.max(0, a.earnedRaw - a.damage);
    return {
      id,
      fullname: profiles.find((p) => p.id === id)?.fullname ?? "—",
      email: null,
      kind: "partner" as const,
      percent: a.projects.size ? a.percentSum / a.projects.size : 0,
      earned,
      paid: a.paid,
      balance: earned - a.paid,
    };
  }).sort((x, y) => y.earned - x.earned);

  const payoutRows = (payouts ?? []).map((p: any) => ({
    id: p.id,
    member_id: p.director_user_id,
    amount: Number(p.amount || 0),
    note: p.note ?? null,
    paid_at: p.paid_date ?? p.created_at,
  }));

  return { members, payouts: payoutRows };
}

/** Танҳо карточкаи «Шарики фурӯш»-ро аз рӯи ID-и дақиқ ё ном ҷудо мекунад. */
function filterSalesPartnerOnly(
  snap: { members: PartnerSnapshotRow[]; payouts: any[] },
  directorUserId?: string,
) {
  const norm = (s: string) => s.toLowerCase().replace(/ӯ/g, "у").replace(/ӣ/g, "и");
  const members = snap.members.filter((m) => {
    if (directorUserId) return m.id === directorUserId;
    const n = norm(m.fullname || "");
    return n.includes("фуруш") || n.includes("furush");
  });
  if (!members.length) {
    return {
      members: [] as PartnerSnapshotRow[],
      payouts: [] as any[],
      resetMembers: [] as PartnerSnapshotRow[],
    };
  }

  const keep = new Set(members.map((m) => m.id));
  // The receiver keeps old snapshot rows and totals every row for the company.
  // Explicitly zero non-sales partners so their previous amounts cannot be
  // added to the Sales Partner card on a later synchronization.
  const resetMembers = snap.members
    .filter((m) => !keep.has(m.id))
    .map((m) => ({ ...m, earned: 0, paid: 0, balance: 0 }));
  return {
    members,
    payouts: snap.payouts.filter((p) => keep.has(p.member_id)),
    resetMembers,
  };
}

/** Ҳолати ҷории шарикони ширкатро ба ҳолати танҳо «Шарики фурӯш» табдил медиҳад. */
export async function computeSalesPartnerSnapshot(admin: any, companyId: string, directorUserId?: string) {
  const snap = await computeCompanyPartners(admin, companyId);
  const filtered = filterSalesPartnerOnly(snap, directorUserId);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const member = filtered.members[0];
  const members = member ? [{
    ...member,
    earned: r2(member.earned),
    paid: r2(member.paid),
    balance: r2(member.balance),
  }, ...filtered.resetMembers] : [];
  return {
    members,
    payouts: member ? filtered.payouts.filter((p) => p.member_id === member.id) : [],
    totals: {
      earned: member ? r2(member.earned) : 0,
      paid: member ? r2(member.paid) : 0,
      balance: member ? r2(member.balance) : 0,
    },
    amount: member ? r2(member.earned) : 0,
  };
}

/**
 * Ҳолати ҷории шарикони ширкатро ба барномаи дуюм мефиристад.
 * Хатогӣ ҳеҷ гоҳ амали асосиро вайрон намекунад.
 */
export async function pushCompanyPartnersSnapshot(admin: any, companyId: string) {
  try {
    const filtered = await computeSalesPartnerSnapshot(admin, companyId);
    // Never send an empty snapshot: another company without a configured
    // Sales Partner must not clear valid data already stored by the receiver.
    if (!filtered.members.length) {
      return { ok: true, skipped: true, reason: "sales_partner_not_found" };
    }
    return await pushSalesPartnerEvent("snapshot.sync", { id: companyId }, filtered);
  } catch (e: any) {
    console.error("[distribution-sync] failed", e?.message);
    return { ok: false, error: e?.message ?? "error" };
  }
}
