import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBudgetRemaining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid(),
    floor_id: z.string().uuid().nullable().optional(),
    category: z.string().min(1),
  }).parse(d))
  .handler(async ({ data }) => {
    const { admin, budgetState } = await import("@/lib/funding.server");
    return budgetState(admin(), data.project_id, data.floor_id ?? null, data.category);
  });

export const listFundingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { admin } = await import("@/lib/funding.server");
    const { data: rows, error } = await (supabase as any)
      .from("funding_requests")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const ids = Array.from(new Set(list.flatMap((r) => [r.requested_by, r.approver_id, ...((r.approver_ids ?? []) as string[])].filter(Boolean))));
    const floorIds = Array.from(new Set(list.map((r) => r.floor_id).filter(Boolean)));
    const db = admin();
    const [{ data: profiles }, { data: floors }] = await Promise.all([
      ids.length ? db.from("profiles").select("id, fullname").in("id", ids) : Promise.resolve({ data: [] }),
      floorIds.length ? db.from("floors").select("id, floor_number").in("id", floorIds) : Promise.resolve({ data: [] }),
    ]);
    const nameOf = (id: string | null) => (profiles ?? []).find((p: any) => p.id === id)?.fullname ?? null;
    return {
      userId,
      requests: list.map((r) => ({
        ...r,
        requester_name: nameOf(r.requested_by),
        approver_name: nameOf(r.approver_id),
        approver_names: ((r.approver_ids ?? []) as string[]).map((x) => nameOf(x)).filter(Boolean),
        floor_number: (floors ?? []).find((f: any) => f.id === r.floor_id)?.floor_number ?? null,
      })),
    };
  });

export const createFundingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid(),
    floor_id: z.string().uuid().nullable().optional(),
    category: z.string().min(1),
    amount: z.number().positive(),
    note: z.string().max(1000).optional().nullable(),
    approver_ids: z.array(z.string().uuid()).min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { admin, budgetState } = await import("@/lib/funding.server");
    const db = admin();
    const { data: proj } = await db.from("projects").select("company_id").eq("id", data.project_id).maybeSingle();
    if (!proj?.company_id) throw new Error("Лоиҳа ёфт нашуд");

    const st = await budgetState(db, data.project_id, data.floor_id ?? null, data.category);
    if (st.planned == null) throw new Error("Барои ин этаж/категория буджет таъин нашудааст");
    if (data.amount > (st.remaining ?? 0) + 0.005) {
      throw new Error(`Аз бақияи буджет зиёд. Бақия: ${(st.remaining ?? 0).toFixed(2)}`);
    }

    const { error } = await db.from("funding_requests").insert({
      company_id: proj.company_id,
      project_id: data.project_id,
      floor_id: data.floor_id ?? null,
      category: data.category,
      amount: data.amount,
      note: data.note ?? null,
      requested_by: userId,
      approver_id: data.approver_ids[0],
      approver_ids: data.approver_ids,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideFundingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    approve: z.boolean(),
    decision_note: z.string().max(1000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { admin, budgetState, isOwnerOrAdmin } = await import("@/lib/funding.server");
    const db = admin();
    const { data: req } = await db.from("funding_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Заявка ёфт нашуд");
    if (req.status !== "pending") throw new Error("Ин заявка аллакай ҳал шудааст");

    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    const allowed = [req.approver_id, ...((req.approver_ids ?? []) as string[])].filter(Boolean);
    if (!isOwner && !isAdmin && !allowed.includes(userId)) throw new Error("Шумо тасдиқкунандаи ин заявка нестед");

    if (!data.approve) {
      const { error } = await db.from("funding_requests").update({
        status: "rejected", decision_note: data.decision_note ?? null,
        decided_at: new Date().toISOString(), decided_by: userId,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, status: "rejected" as const };
    }

    const st = await budgetState(db, req.project_id, req.floor_id, req.category);
    if (st.planned == null) throw new Error("Буджет таъин нашудааст");
    if (Number(req.amount) > (st.remaining ?? 0) + 0.005) {
      throw new Error(`Аз бақияи буджет зиёд. Бақия: ${(st.remaining ?? 0).toFixed(2)}`);
    }

    const { data: exp, error: expErr } = await db.from("expenses").insert({
      project_id: req.project_id,
      floor_id: req.floor_id,
      amount: req.amount,
      category: req.category,
      description: req.note ?? "Заявка",
      expense_date: new Date().toISOString().slice(0, 10),
      created_by: req.requested_by,
      currency: req.currency ?? "TJS",
    }).select("id").maybeSingle();
    if (expErr) throw new Error(expErr.message);

    const { error } = await db.from("funding_requests").update({
      status: "approved", decision_note: data.decision_note ?? null,
      decided_at: new Date().toISOString(), decided_by: userId, expense_id: exp?.id ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, status: "approved" as const };
  });

export const listApprovers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ context }) => {
    const { userId } = context;
    const { admin } = await import("@/lib/funding.server");
    const db = admin();
    const { data: prof } = await db.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!prof?.company_id) return { users: [] as Array<{ id: string; fullname: string }> };
    const { data: users } = await db
      .from("profiles").select("id, fullname").eq("company_id", prof.company_id).order("fullname");
    return { users: (users ?? []).filter((u: any) => u.id !== userId) as Array<{ id: string; fullname: string }> };
  });

/** Inbox for the bell: requests awaiting my approval + my recently decided requests. */
export const fundingInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { admin } = await import("@/lib/funding.server");
    const db = admin();
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const [{ data: pend }, { data: mine }] = await Promise.all([
      db.from("funding_requests").select("*")
        .or(`approver_id.eq.${userId},approver_ids.cs.{${userId}}`)
        .eq("status", "pending")
        .not("cleared_by", "cs", `{${userId}}`)
        .order("created_at", { ascending: false }).limit(30),
      db.from("funding_requests").select("*").eq("requested_by", userId).neq("status", "pending")
        .not("cleared_by", "cs", `{${userId}}`)
        .gte("decided_at", since).order("decided_at", { ascending: false }).limit(30),
    ]);
    const rows = [...(pend ?? []), ...(mine ?? [])] as any[];
    const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));
    const { data: projects } = projectIds.length
      ? await db.from("projects").select("id, name").in("id", projectIds)
      : { data: [] as any[] };
    const nameOf = (id: string) => (projects ?? []).find((p: any) => p.id === id)?.name ?? "";
    const map = (r: any, kind: "approve" | "decided") => ({
      id: r.id as string,
      kind,
      project_id: r.project_id as string,
      project_name: nameOf(r.project_id),
      category: r.category as string,
      amount: Number(r.amount || 0),
      status: r.status as string,
      at: (r.decided_at ?? r.created_at) as string,
    });
    return {
      pending: (pend ?? []).map((r: any) => map(r, "approve")),
      decided: (mine ?? []).map((r: any) => map(r, "decided")),
    };
  });

/** Delete a request (owner/platform admin/director or the requester). */
export const deleteFundingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { admin, isOwnerOrAdmin } = await import("@/lib/funding.server");
    const db = admin();
    const { data: req } = await db.from("funding_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Заявка ёфт нашуд");
    const { isOwner, isAdmin } = await isOwnerOrAdmin(supabase, userId);
    const { data: dir } = await db.from("company_directors").select("user_id").eq("user_id", userId).maybeSingle();
    if (!isOwner && !isAdmin && !dir && req.requested_by !== userId) {
      throw new Error("Иҷозат нест");
    }
    if (req.status === "approved") throw new Error("Заявкаи қабулшуда нест карда намешавад — аввал расходро нест кунед");
    const { error } = await db.from("funding_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hide notifications from my bell (does not delete the requests). */
export const clearFundingNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { admin } = await import("@/lib/funding.server");
    const db = admin();
    let q = db.from("funding_requests").select("id, cleared_by")
      .or(`approver_id.eq.${userId},approver_ids.cs.{${userId}},requested_by.eq.${userId}`);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { data: rows } = await q;
    const todo = (rows ?? []).filter((r: any) => !((r.cleared_by ?? []) as string[]).includes(userId));
    for (const r of todo) {
      await db.from("funding_requests")
        .update({ cleared_by: [...((r.cleared_by ?? []) as string[]), userId] })
        .eq("id", r.id);
    }
    return { ok: true, cleared: todo.length };
  });
