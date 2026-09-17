import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HISTORY_LIMIT = 12;
const MUTATING_TOOLS = new Set([
  "create_floors", "bulk_create_apartments", "bulk_create_apartments_multi", "update_floor_prices", "update_apartment",
  "create_project", "create_block",
  "create_customer", "update_customer",
  "create_sale", "cancel_sale",
  "record_payment",
  "record_expense",
  "create_worker", "create_supplier", "create_subcontractor", "create_equipment",
  "create_payable", "record_payable_payment",
  "warehouse_receipt", "warehouse_issue",
  "material_in", "material_out",
  "create_stage", "update_stage_progress",
]);

type ChatContext = {
  currentProjectId?: string | null;
  currentPath?: string | null;
};

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/ӣ/g, "и")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function nameMatches(candidate: string, query: string): boolean {
  const c = norm(candidate);
  const q = norm(query);
  return !!q && (c === q || c.includes(q) || q.includes(c));
}

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const { data: owned } = await supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
  const companyId = prof?.company_id ?? owned?.id;
  if (!companyId) throw new Error("Ширкат ёфт нашуд");
  return companyId as string;
}

export const getAiChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT * 2);
    return (data ?? []).reverse();
  });

export const clearAiChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("ai_chat_messages").delete().eq("user_id", userId);
    return { ok: true };
  });

export const getAiCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getAiCreditBalance(supabaseAdmin as any, companyId);
  });

const strOpt = { type: "string" };
const numOpt = { type: "number" };
const intOpt = { type: "integer" };

const TOOLS: any[] = [
  // ============ READ ============
  { type: "function", function: { name: "list_projects", description: "Рӯйхати лоиҳаҳо ва блокҳо (ЖК + блокҳо).", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "list_floors", description: "Рӯйхати этажҳо дар блок.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_apartments", description: "Рӯйхати квартираҳо дар як этаж.", parameters: { type: "object", properties: { floor_id: strOpt, project_id: strOpt, project_name: strOpt, block_name: strOpt, floor_number: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_available_apartments", description: "Ҳамаи квартираҳои холии як блок/лоиҳа.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_customers", description: "Рӯйхати муштариён (ё ҷустуҷӯи бо ном/телефон).", parameters: { type: "object", properties: { search: strOpt, status: strOpt, limit: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_sales", description: "Рӯйхати фурӯшҳо.", parameters: { type: "object", properties: { status: strOpt, project_id: strOpt, limit: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_debtors", description: "Муштариёне, ки қарздор ҳастанд (paid_amount < full_price).", parameters: { type: "object", properties: { limit: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_payments", description: "Пардохтҳои охирин.", parameters: { type: "object", properties: { sale_id: strOpt, status: strOpt, limit: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_expenses", description: "Хароҷоти лоиҳа.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, category: strOpt, limit: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_workers", description: "Рӯйхати коргарон.", parameters: { type: "object", properties: { search: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_suppliers", description: "Рӯйхати таъминкунандагон.", parameters: { type: "object", properties: { search: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_subcontractors", description: "Рӯйхати субпудратчиён (бригадаҳо).", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "list_equipment", description: "Рӯйхати техника.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "list_payables", description: "Қарзҳои ширкат (payables).", parameters: { type: "object", properties: { status: strOpt, project_id: strOpt, limit: intOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_warehouse_items", description: "Мавҷудӣ дар склади умумӣ.", parameters: { type: "object", properties: { search: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_materials", description: "Материалҳои як лоиҳа/блок.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "list_stages", description: "Марҳилаҳои лоиҳа.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "company_summary", description: "Хулосаи умумӣ: фурӯш, қарздорон, хароҷот, кредит.", parameters: { type: "object", properties: {}, additionalProperties: false } } },

  // ============ WRITE: STRUCTURE ============
  { type: "function", function: { name: "create_project", description: "Лоиҳаи нав (ЖК) месозад.", parameters: { type: "object", properties: { name: strOpt, location: strOpt }, required: ["name"], additionalProperties: false } } },
  { type: "function", function: { name: "create_block", description: "Блоки нав дар ЖК месозад.", parameters: { type: "object", properties: { name: strOpt, parent_project_id: strOpt, parent_project_name: strOpt }, required: ["name"], additionalProperties: false } } },
  { type: "function", function: { name: "create_floors", description: "Якчанд этаж дар блок эҷод мекунад.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt, count: intOpt, start_number: intOpt }, required: ["count"], additionalProperties: false } } },
  { type: "function", function: { name: "bulk_create_apartments", description: "Квартираҳо дар ЯК этаж эҷод мекунад.", parameters: { type: "object", properties: { floor_id: strOpt, project_id: strOpt, project_name: strOpt, block_name: strOpt, floor_number: intOpt, count: intOpt, rooms: intOpt, area: numOpt, price: numOpt, price_per_sqm: numOpt, start_number: intOpt }, required: ["count", "rooms", "area"], additionalProperties: false } } },
  { type: "function", function: { name: "bulk_create_apartments_multi", description: "ТАВСИЯ ШУДА барои якчанд этаж: аз floor_from то floor_to дар ҳар этаж квартираҳо месозад (этажҳои набударо худкор эҷод мекунад, рақамгузорӣ пайдарпай). Агар масоҳатҳо дар ҳар этаж якхела бошанд — areas-ро як бор деҳ. ҲАМАИ этажҳоро дар ЯК даъват иҷро кун.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt, floor_from: intOpt, floor_to: intOpt, areas: { type: "array", items: { type: "number" }, description: "Масоҳати ҳар квартира дар як этаж (тартиб муҳим)." }, count: intOpt, area: numOpt, rooms: intOpt, price_per_sqm: numOpt, price: numOpt, start_number: intOpt }, required: ["floor_from", "floor_to"], additionalProperties: false } } },
  { type: "function", function: { name: "update_floor_prices", description: "Нархи этажро тағир медиҳад.", parameters: { type: "object", properties: { floor_id: strOpt, project_id: strOpt, project_name: strOpt, block_name: strOpt, floor_number: intOpt, percent_delta: numOpt, new_price: numOpt }, additionalProperties: false } } },
  { type: "function", function: { name: "update_apartment", description: "Як квартираро тағир медиҳад (нарх, ҳолат ва ғ.).", parameters: { type: "object", properties: { apartment_id: strOpt, new_price: numOpt, new_status: { type: "string", enum: ["empty", "reserved", "installment", "sold"] }, new_rooms: intOpt, new_area: numOpt }, required: ["apartment_id"], additionalProperties: false } } },

  // ============ WRITE: CRM/SALES ============
  { type: "function", function: { name: "create_customer", description: "Муштарии нав.", parameters: { type: "object", properties: { fullname: strOpt, phone: strOpt, passport: strOpt, address: strOpt, notes: strOpt, status: strOpt }, required: ["fullname"], additionalProperties: false } } },
  { type: "function", function: { name: "update_customer", description: "Маълумоти муштариро тағир медиҳад.", parameters: { type: "object", properties: { customer_id: strOpt, fullname: strOpt, phone: strOpt, address: strOpt, notes: strOpt, status: strOpt }, required: ["customer_id"], additionalProperties: false } } },
  { type: "function", function: { name: "create_sale", description: "Фурӯши квартира. customer_id ё customer_name/phone.", parameters: { type: "object", properties: { apartment_id: strOpt, customer_id: strOpt, customer_name: strOpt, customer_phone: strOpt, full_price: numOpt, currency: { type: "string", enum: ["TJS", "USD"] }, installment_months: intOpt, payment_deadline: strOpt }, required: ["apartment_id"], additionalProperties: false } } },
  { type: "function", function: { name: "cancel_sale", description: "Фурӯшро бекор мекунад.", parameters: { type: "object", properties: { sale_id: strOpt }, required: ["sale_id"], additionalProperties: false } } },
  { type: "function", function: { name: "record_payment", description: "Пардохт аз муштарӣ.", parameters: { type: "object", properties: { sale_id: strOpt, amount: numOpt, payment_method: { type: "string", enum: ["cash", "card", "transfer", "other"] }, currency: { type: "string", enum: ["TJS", "USD"] }, payment_date: strOpt, note: strOpt, status: { type: "string", enum: ["pending", "confirmed"] } }, required: ["sale_id", "amount"], additionalProperties: false } } },

  // ============ WRITE: FINANCE ============
  { type: "function", function: { name: "record_expense", description: "Хароҷот сабт мекунад.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt, amount: numOpt, category: strOpt, description: strOpt, expense_date: strOpt, currency: strOpt, employee_name: strOpt }, required: ["amount", "category"], additionalProperties: false } } },
  { type: "function", function: { name: "create_payable", description: "Қарзи ширкат сабт мекунад.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, counterparty: strOpt, category: strOpt, total_amount: numOpt, due_date: strOpt, description: strOpt, currency: strOpt }, required: ["counterparty", "category", "total_amount", "due_date"], additionalProperties: false } } },
  { type: "function", function: { name: "record_payable_payment", description: "Пардохти қарз.", parameters: { type: "object", properties: { payable_id: strOpt, amount: numOpt, payment_date: strOpt, method: strOpt, comment: strOpt }, required: ["payable_id", "amount"], additionalProperties: false } } },

  // ============ WRITE: STAFF ============
  { type: "function", function: { name: "create_worker", description: "Коргар илова мекунад.", parameters: { type: "object", properties: { fullname: strOpt, phone: strOpt, position: strOpt, daily_rate: numOpt, passport_number: strOpt }, required: ["fullname"], additionalProperties: false } } },
  { type: "function", function: { name: "create_supplier", description: "Таъминкунанда илова мекунад.", parameters: { type: "object", properties: { name: strOpt, phone: strOpt, contact_person: strOpt, address: strOpt, note: strOpt }, required: ["name"], additionalProperties: false } } },
  { type: "function", function: { name: "create_subcontractor", description: "Бригада/субпудратчӣ илова мекунад.", parameters: { type: "object", properties: { brigade_name: strOpt, foreman_name: strOpt, specialty: strOpt, phone: strOpt }, required: ["brigade_name", "specialty"], additionalProperties: false } } },
  { type: "function", function: { name: "create_equipment", description: "Техника илова мекунад.", parameters: { type: "object", properties: { name: strOpt, kind: strOpt, ownership: { type: "string", enum: ["own", "rented"] }, plate_number: strOpt, rate_per_hour: numOpt, rate_per_day: numOpt }, required: ["name", "kind", "ownership"], additionalProperties: false } } },

  // ============ WRITE: WAREHOUSE / MATERIALS ============
  { type: "function", function: { name: "warehouse_receipt", description: "Ба склади умумӣ приход.", parameters: { type: "object", properties: { name: strOpt, unit: strOpt, quantity: numOpt, unit_price: numOpt, supplier_fio: strOpt, receipt_date: strOpt }, required: ["name", "unit", "quantity"], additionalProperties: false } } },
  { type: "function", function: { name: "warehouse_issue", description: "Аз склад ба лоиҳа расход.", parameters: { type: "object", properties: { name: strOpt, unit: strOpt, quantity: numOpt, unit_price: numOpt, project_id: strOpt, project_name: strOpt, block_name: strOpt, issue_date: strOpt }, required: ["name", "unit", "quantity"], additionalProperties: false } } },
  { type: "function", function: { name: "material_in", description: "Приходи материал бевосита ба лоиҳа.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt, name: strOpt, unit: strOpt, quantity: numOpt, unit_price: numOpt, movement_date: strOpt, note: strOpt }, required: ["name", "unit", "quantity"], additionalProperties: false } } },
  { type: "function", function: { name: "material_out", description: "Расходи материал аз лоиҳа (хароҷот худкор сабт мешавад).", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, block_name: strOpt, name: strOpt, quantity: numOpt, movement_date: strOpt, note: strOpt }, required: ["name", "quantity"], additionalProperties: false } } },

  // ============ WRITE: STAGES ============
  { type: "function", function: { name: "create_stage", description: "Марҳилаи нави лоиҳа.", parameters: { type: "object", properties: { project_id: strOpt, project_name: strOpt, name: strOpt, description: strOpt, start_date: strOpt, end_date: strOpt }, required: ["name"], additionalProperties: false } } },
  { type: "function", function: { name: "update_stage_progress", description: "Фоизи иҷрои марҳиларо тағир медиҳад.", parameters: { type: "object", properties: { stage_id: strOpt, progress: intOpt }, required: ["stage_id", "progress"], additionalProperties: false } } },
];

async function loadCompanyProjects(supabase: any, companyId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, parent_id, status, location")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getAiCreditBalance(admin: any, companyId: string) {
  const { data: row } = await admin
    .from("ai_credits")
    .select("free_limit, free_used, paid_balance")
    .eq("company_id", companyId)
    .maybeSingle();
  return {
    free_limit: row?.free_limit ?? 5,
    free_used: row?.free_used ?? 0,
    paid_balance: row?.paid_balance ?? 0,
  };
}

function applyChatContext(args: any, ctx?: ChatContext) {
  const next = { ...(args ?? {}) };
  if (!next.project_id && !next.project_name && !next.block_name && ctx?.currentProjectId) {
    next.project_id = ctx.currentProjectId;
  }
  return next;
}

function blockOptions(projects: any[]) {
  const byId = new Map<string, any>(projects.map((p: any) => [p.id, p]));
  return projects
    .filter((p: any) => !!p.parent_id)
    .map((p: any) => ({ id: p.id, name: p.name, project: byId.get(p.parent_id)?.name ?? null }));
}

async function resolveBlockProject(supabase: any, companyId: string, args: any, opts?: { ensureBlockForMutation?: boolean }): Promise<any> {
  const projects = await loadCompanyProjects(supabase, companyId);
  const byId = new Map<string, any>(projects.map((p: any) => [p.id, p]));

  const createDefaultBlock = async (top: any) => {
    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        name: "Блоки 1",
        location: top.location ?? null,
        description: null,
        status: top.status ?? "in_progress",
        company_id: companyId,
        parent_id: top.id,
      })
      .select("id, name, parent_id, status, location")
      .single();
    if (error) return { error: error.message };
    return { project: created, createdBlock: true };
  };

  const chooseFromTop = async (top: any) => {
    const children = projects.filter((p: any) => p.parent_id === top.id);
    if (args.block_name) {
      const matched = children.filter((p: any) => nameMatches(p.name, args.block_name));
      if (matched.length === 1) return { project: matched[0] };
      if (matched.length > 1) return { error: `Якчанд блок бо номи «${args.block_name}» ёфт шуд`, options: matched };
    }
    if (children.length === 1) return { project: children[0] };
    if (children.length > 1) {
      return {
        error: `Лоиҳаи «${top.name}» ${children.length} блок дорад. Номи блокро интихоб кунед: ${children.map((c: any) => c.name).join(", ")}`,
        options: children.map((c: any) => ({ id: c.id, name: c.name })),
      };
    }
    if (opts?.ensureBlockForMutation) return createDefaultBlock(top);
    return { project: top, direct_project: true };
  };

  if (args.project_id) {
    const p = byId.get(args.project_id);
    if (!p) return { error: "Лоиҳа/блок ёфт нашуд", options: blockOptions(projects) };
    return p.parent_id ? { project: p } : await chooseFromTop(p);
  }

  let candidates = projects;
  if (args.project_name) {
    candidates = candidates.filter((p: any) => nameMatches(p.name, args.project_name));
  }
  if (args.block_name) {
    candidates = candidates.filter((p: any) => p.parent_id && nameMatches(p.name, args.block_name));
  }

  if (candidates.length === 1) {
    const only = candidates[0];
    return only.parent_id ? { project: only } : await chooseFromTop(only);
  }

  const blockCandidates = candidates.filter((p: any) => p.parent_id);
  if (blockCandidates.length === 1) return { project: blockCandidates[0] };
  if (blockCandidates.length > 1) {
    return { error: "Якчанд блок мувофиқ омад. Номи аниқтари блокро нависед.", options: blockOptions(blockCandidates) };
  }

  if (!args.project_name && !args.block_name) {
    const blocks = projects.filter((p: any) => p.parent_id);
    if (blocks.length === 1) return { project: blocks[0] };
  }

  return { error: "Блок ёфт нашуд. Аввал list_projects-ро бинед ва номи лоиҳа/блокро аниқ кунед.", options: blockOptions(projects) };
}

async function resolveFloor(supabase: any, companyId: string, args: any, createIfMissing = false): Promise<any> {
  if (args.floor_id) {
    const { data: floor } = await supabase.from("floors").select("id, project_id, floor_number").eq("id", args.floor_id).maybeSingle();
    if (!floor) return { error: "Этаж ёфт нашуд" };
    const { data: project } = await supabase.from("projects").select("id, company_id, parent_id, name").eq("id", floor.project_id).eq("company_id", companyId).maybeSingle();
    if (!project) return { error: "Дастрасӣ ба этаж нест" };
    return { floor, project };
  }

  if (!args.floor_number) return { error: "Рақами этаж лозим аст" };
  const resolved = await resolveBlockProject(supabase, companyId, args, { ensureBlockForMutation: createIfMissing });
  if (resolved.error || !resolved.project) return resolved;

  const { data: floor } = await supabase
    .from("floors")
    .select("id, project_id, floor_number")
    .eq("project_id", resolved.project.id)
    .eq("floor_number", args.floor_number)
    .maybeSingle();
  if (floor) return { floor, project: resolved.project };
  if (!createIfMissing) return { error: `Этажи ${args.floor_number} дар блоки «${resolved.project.name}» ёфт нашуд` };

  const { data: created, error } = await supabase
    .from("floors")
    .insert({ project_id: resolved.project.id, floor_number: args.floor_number, status: "planning" })
    .select("id, project_id, floor_number")
    .single();
  if (error) return { error: error.message };
  return { floor: created, project: resolved.project, createdFloor: true, createdBlock: !!resolved.createdBlock };
}

async function findCustomer(admin: any, companyId: string, name?: string, phone?: string): Promise<any> {
  let q = admin.from("customers").select("id, fullname, phone").eq("company_id", companyId).limit(5);
  if (phone) q = q.ilike("phone", `%${phone}%`);
  else if (name) q = q.ilike("fullname", `%${name}%`);
  const { data } = await q;
  return data ?? [];
}

async function execTool(name: string, args: any, supabase: any, companyId: string, userId: string, ctx?: ChatContext): Promise<string> {
  try {
    args = applyChatContext(args, ctx);
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
    const today = new Date().toISOString().slice(0, 10);

    // ---------- READ ----------
    if (name === "list_projects") {
      const projects = await loadCompanyProjects(supabase, companyId);
      const byParent = new Map<string, any[]>();
      for (const p of projects) {
        if (p.parent_id) byParent.set(p.parent_id, [...(byParent.get(p.parent_id) ?? []), p]);
      }
      const result = projects.filter((p: any) => !p.parent_id).map((p: any) => ({
        id: p.id, name: p.name, type: "project", location: p.location,
        blocks: (byParent.get(p.id) ?? []).map((b: any) => ({ id: b.id, name: b.name })),
      }));
      return JSON.stringify({ projects: result });
    }
    if (name === "list_floors") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data } = await supabase.from("floors").select("id, floor_number, description, status").eq("project_id", r.project.id).order("floor_number");
      return JSON.stringify({ block: { id: r.project.id, name: r.project.name }, floors: data ?? [] });
    }
    if (name === "list_apartments") {
      const r = await resolveFloor(supabase, companyId, args, false);
      if (r.error || !r.floor) return JSON.stringify(r);
      const { data } = await supabase.from("apartments").select("id, apartment_number, rooms, area, price, status").eq("floor_id", r.floor.id).order("apartment_number");
      return JSON.stringify({ floor: r.floor.floor_number, block: r.project?.name, apartments: data ?? [] });
    }
    if (name === "list_available_apartments") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data } = await supabase.from("apartments").select("id, apartment_number, floor_id, rooms, area, price").eq("project_id", r.project.id).eq("status", "empty").order("apartment_number");
      return JSON.stringify({ block: r.project.name, available: data ?? [] });
    }
    if (name === "list_customers") {
      let q = supabase.from("customers").select("id, fullname, phone, status, funnel_stage").eq("company_id", companyId).order("created_at", { ascending: false }).limit(limit);
      if (args.status) q = q.eq("status", args.status);
      if (args.search) q = q.or(`fullname.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
      const { data } = await q;
      return JSON.stringify({ customers: data ?? [] });
    }
    if (name === "list_sales") {
      let q = supabase.from("sales").select("id, customer_id, apartment_id, project_id, full_price, paid_amount, currency, status, created_at").order("created_at", { ascending: false }).limit(limit);
      if (args.status) q = q.eq("status", args.status);
      if (args.project_id) q = q.eq("project_id", args.project_id);
      const { data } = await q;
      return JSON.stringify({ sales: data ?? [] });
    }
    if (name === "list_debtors") {
      const { data } = await supabase.from("sales")
        .select("id, customer_id, apartment_id, full_price, paid_amount, currency, payment_deadline, customers(fullname, phone)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit);
      const debtors = (data ?? []).filter((s: any) => Number(s.paid_amount) < Number(s.full_price)).map((s: any) => ({
        sale_id: s.id, customer: s.customers?.fullname, phone: s.customers?.phone,
        full_price: s.full_price, paid: s.paid_amount, remaining: Number(s.full_price) - Number(s.paid_amount),
        currency: s.currency, deadline: s.payment_deadline,
      }));
      return JSON.stringify({ debtors });
    }
    if (name === "list_payments") {
      let q = supabase.from("payments").select("id, sale_id, amount, currency, payment_method, status, payment_date, note").order("payment_date", { ascending: false }).limit(limit);
      if (args.sale_id) q = q.eq("sale_id", args.sale_id);
      if (args.status) q = q.eq("status", args.status);
      const { data } = await q;
      return JSON.stringify({ payments: data ?? [] });
    }
    if (name === "list_expenses") {
      let q = supabase.from("expenses").select("id, project_id, amount, category, description, expense_date, currency").order("expense_date", { ascending: false }).limit(limit);
      if (args.category) q = q.eq("category", args.category);
      if (args.project_id) q = q.eq("project_id", args.project_id);
      else if (args.project_name) {
        const r = await resolveBlockProject(supabase, companyId, args);
        if (r.project) q = q.eq("project_id", r.project.id);
      }
      const { data } = await q;
      return JSON.stringify({ expenses: data ?? [] });
    }
    if (name === "list_workers") {
      let q = supabase.from("workers").select("id, fullname, phone, position, daily_rate, is_active").eq("company_id", companyId).order("fullname").limit(100);
      if (args.search) q = q.ilike("fullname", `%${args.search}%`);
      const { data } = await q;
      return JSON.stringify({ workers: data ?? [] });
    }
    if (name === "list_suppliers") {
      let q = supabase.from("suppliers").select("id, name, phone, contact_person, address").eq("company_id", companyId).eq("archived", false).order("name").limit(100);
      if (args.search) q = q.ilike("name", `%${args.search}%`);
      const { data } = await q;
      return JSON.stringify({ suppliers: data ?? [] });
    }
    if (name === "list_subcontractors") {
      const { data } = await supabase.from("subcontractors").select("id, brigade_name, foreman_name, specialty, phone, is_active").eq("company_id", companyId).order("brigade_name");
      return JSON.stringify({ subcontractors: data ?? [] });
    }
    if (name === "list_equipment") {
      const { data } = await supabase.from("equipment").select("id, name, kind, ownership, plate_number, rate_per_hour, rate_per_day, is_active").eq("company_id", companyId).order("name");
      return JSON.stringify({ equipment: data ?? [] });
    }
    if (name === "list_payables") {
      let q = supabase.from("payables").select("id, project_id, counterparty, category, total_amount, paid_amount, currency, due_date, status").eq("company_id", companyId).eq("archived", false).order("due_date").limit(limit);
      if (args.status) q = q.eq("status", args.status);
      if (args.project_id) q = q.eq("project_id", args.project_id);
      const { data } = await q;
      return JSON.stringify({ payables: data ?? [] });
    }
    if (name === "list_warehouse_items") {
      let q = supabase.from("warehouse_items").select("id, name, unit, quantity, unit_price").eq("company_id", companyId).order("name").limit(200);
      if (args.search) q = q.ilike("name", `%${args.search}%`);
      const { data } = await q;
      return JSON.stringify({ items: data ?? [] });
    }
    if (name === "list_materials") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data } = await supabase.from("materials").select("id, name, unit, quantity, unit_price").eq("project_id", r.project.id).order("name");
      return JSON.stringify({ block: r.project.name, materials: data ?? [] });
    }
    if (name === "list_stages") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data } = await supabase.from("project_stages").select("id, name, progress, status, start_date, end_date, deadline").eq("project_id", r.project.id).order("sort_order");
      return JSON.stringify({ project: r.project.name, stages: data ?? [] });
    }
    if (name === "company_summary") {
      const [projRes, salesRes, custRes, expRes, credit] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("sales").select("full_price, paid_amount, currency, status"),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("expenses").select("amount, currency").gte("expense_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        getAiCreditBalance(supabase, companyId),
      ]);
      const sales = salesRes.data ?? [];
      const active = sales.filter((s: any) => s.status === "active");
      const totRev = sales.reduce((sum: number, s: any) => sum + Number(s.paid_amount || 0), 0);
      const totDebt = active.reduce((sum: number, s: any) => sum + (Number(s.full_price || 0) - Number(s.paid_amount || 0)), 0);
      const totExp30d = (expRes.data ?? []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      return JSON.stringify({
        projects: projRes.count ?? 0,
        customers: custRes.count ?? 0,
        sales_count: sales.length,
        active_sales: active.length,
        total_revenue: totRev,
        outstanding_debt: totDebt,
        expenses_last_30d: totExp30d,
        ai_credits: credit,
      });
    }

    // ---------- WRITE: STRUCTURE ----------
    if (name === "create_project") {
      if (!args.name) return JSON.stringify({ error: "Ном лозим аст" });
      const { data, error } = await supabase.from("projects").insert({
        name: args.name, location: args.location ?? null, company_id: companyId, status: "in_progress",
      }).select("id, name").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, project: data });
    }
    if (name === "create_block") {
      let parentId = args.parent_project_id;
      if (!parentId && args.parent_project_name) {
        const projs = await loadCompanyProjects(supabase, companyId);
        const top = projs.filter((p) => !p.parent_id && nameMatches(p.name, args.parent_project_name));
        if (top.length !== 1) return JSON.stringify({ error: "Лоиҳаи ҷои волидиро аниқтар нависед", options: projs.filter((p) => !p.parent_id).map((p) => ({ id: p.id, name: p.name })) });
        parentId = top[0].id;
      }
      if (!parentId) return JSON.stringify({ error: "parent_project_id ё parent_project_name лозим" });
      const { data, error } = await supabase.from("projects").insert({
        name: args.name, company_id: companyId, parent_id: parentId, status: "in_progress",
      }).select("id, name").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, block: data });
    }
    if (name === "create_floors") {
      const r = await resolveBlockProject(supabase, companyId, args, { ensureBlockForMutation: true });
      if (r.error || !r.project) return JSON.stringify(r);
      const { data: existing } = await supabase.from("floors").select("floor_number").eq("project_id", r.project.id);
      const nums = new Set<number>((existing ?? []).map((f: any) => Number(f.floor_number)));
      const start = args.start_number ?? (Math.max(0, ...Array.from(nums)) + 1);
      const rows = Array.from({ length: args.count }, (_, i) => ({
        project_id: r.project.id, floor_number: start + i, status: "planning",
      })).filter((r) => !nums.has(r.floor_number));
      if (!rows.length) return JSON.stringify({ ok: true, created: 0, message: "Ин этажҳо аллакай ҳастанд" });
      const { data, error } = await supabase.from("floors").insert(rows).select("id, floor_number");
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, block: r.project.name, created_block: !!r.createdBlock, created: data?.length, floors: data });
    }
    if (name === "bulk_create_apartments") {
      const r = await resolveFloor(supabase, companyId, args, true);
      if (r.error || !r.floor) return JSON.stringify(r);
      const totalPrice = args.price != null ? Number(args.price) : Number(args.area) * Number(args.price_per_sqm ?? 0);
      if (!Number.isFinite(totalPrice) || totalPrice < 0) return JSON.stringify({ error: "Нарх нодуруст аст" });
      // Continuous numbering across the whole block: max apartment_number in this block (project_id).
      const { data: last } = await supabase.from("apartments").select("apartment_number").eq("project_id", r.floor.project_id);
      const maxN = (last ?? []).reduce((m: number, a: any) => {
        const n = parseInt(String(a.apartment_number).replace(/\D/g, ""), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const start = args.start_number ?? (maxN + 1);
      const rows = Array.from({ length: args.count }, (_, i) => ({
        project_id: r.floor.project_id, floor_id: r.floor.id, apartment_number: String(start + i),
        rooms: args.rooms, area: args.area, price: totalPrice,
        price_per_sqm: args.area > 0 ? totalPrice / args.area : null, status: "empty",
      }));
      const { data, error } = await supabase.from("apartments").insert(rows).select("id");
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: data?.length, from: start, to: start + args.count - 1 });
    }
    if (name === "bulk_create_apartments_multi") {
      const r = await resolveBlockProject(supabase, companyId, args, { ensureBlockForMutation: true });
      if (r.error || !r.project) return JSON.stringify(r);
      const projectId = r.project.id;
      const from = Number(args.floor_from);
      const to = Number(args.floor_to);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 200) {
        return JSON.stringify({ error: "floor_from/floor_to нодуруст" });
      }
      // Per-floor apartment areas
      let areas: number[] = Array.isArray(args.areas) ? args.areas.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : [];
      if (!areas.length) {
        const cnt = Number(args.count);
        const ar = Number(args.area);
        if (!Number.isFinite(cnt) || cnt <= 0 || !Number.isFinite(ar) || ar <= 0) {
          return JSON.stringify({ error: "areas ё count+area лозим аст" });
        }
        areas = Array.from({ length: cnt }, () => ar);
      }

      // Ensure floors exist
      const { data: existingFloors } = await supabase.from("floors").select("id, floor_number").eq("project_id", projectId);
      const floorIdByNum = new Map<number, string>((existingFloors ?? []).map((f: any) => [Number(f.floor_number), f.id]));
      const missing: number[] = [];
      for (let n = from; n <= to; n++) if (!floorIdByNum.has(n)) missing.push(n);
      let floorsCreated = 0;
      if (missing.length) {
        const { data: newFloors, error: fErr } = await supabase.from("floors")
          .insert(missing.map((n) => ({ project_id: projectId, floor_number: n, status: "planning" })))
          .select("id, floor_number");
        if (fErr) return JSON.stringify({ error: fErr.message });
        for (const f of newFloors ?? []) floorIdByNum.set(Number(f.floor_number), f.id);
        floorsCreated = newFloors?.length ?? 0;
      }

      // Continuous numbering across the block
      const { data: existingApts } = await supabase.from("apartments").select("apartment_number, floor_id").eq("project_id", projectId);
      const maxN = (existingApts ?? []).reduce((m: number, a: any) => {
        const n = parseInt(String(a.apartment_number).replace(/\D/g, ""), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const occupied = new Set<string>((existingApts ?? []).map((a: any) => String(a.floor_id)));
      let next = Number.isFinite(Number(args.start_number)) && args.start_number != null ? Number(args.start_number) : maxN + 1;

      const perSqm = Number(args.price_per_sqm);
      const flatPrice = Number(args.price);
      const rows: any[] = [];
      const skipped: number[] = [];
      for (let n = from; n <= to; n++) {
        const floorId = floorIdByNum.get(n)!;
        if (occupied.has(String(floorId))) { skipped.push(n); continue; }
        for (const area of areas) {
          const price = Number.isFinite(flatPrice) && flatPrice > 0
            ? flatPrice
            : (Number.isFinite(perSqm) && perSqm > 0 ? Math.round(area * perSqm * 100) / 100 : 0);
          rows.push({
            project_id: projectId,
            floor_id: floorId,
            apartment_number: String(next++),
            rooms: args.rooms ?? null,
            area,
            price,
            price_per_sqm: area > 0 && price > 0 ? Math.round((price / area) * 100) / 100 : null,
            status: "empty",
          });
        }
      }
      if (!rows.length) return JSON.stringify({ ok: true, created: 0, message: "Ин этажҳо аллакай квартира доранд", skipped_floors: skipped });
      let created = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { data: ins, error } = await supabase.from("apartments").insert(rows.slice(i, i + 200)).select("id");
        if (error) return JSON.stringify({ error: error.message, created });
        created += ins?.length ?? 0;
      }
      return JSON.stringify({
        ok: true, block: r.project.name, created, floors_created: floorsCreated,
        floors_from: from, floors_to: to, per_floor: areas.length,
        skipped_floors: skipped, numbers_from: rows[0].apartment_number, numbers_to: rows[rows.length - 1].apartment_number,
      });
    }
    if (name === "update_floor_prices") {
      const r = await resolveFloor(supabase, companyId, args, false);
      if (r.error || !r.floor) return JSON.stringify(r);
      const { data: apts } = await supabase.from("apartments").select("id, price, area").eq("floor_id", r.floor.id);
      if (!apts?.length) return JSON.stringify({ ok: true, updated: 0 });
      let updated = 0;
      for (const a of apts) {
        const newPrice = args.new_price != null ? args.new_price : Math.round((a.price ?? 0) * (1 + (args.percent_delta ?? 0) / 100));
        const patch: any = { price: newPrice };
        if (a.area > 0) patch.price_per_sqm = newPrice / a.area;
        const { error } = await supabase.from("apartments").update(patch).eq("id", a.id);
        if (!error) updated++;
      }
      return JSON.stringify({ ok: true, updated });
    }
    if (name === "update_apartment") {
      const patch: any = {};
      if (args.new_price != null) patch.price = args.new_price;
      if (args.new_status) patch.status = args.new_status;
      if (args.new_rooms) patch.rooms = args.new_rooms;
      if (args.new_area) patch.area = args.new_area;
      if (patch.price != null && (args.new_area || patch.area != null)) {
        const area = args.new_area ?? patch.area;
        if (area > 0) patch.price_per_sqm = patch.price / area;
      } else if (patch.price != null) {
        const { data: a } = await supabase.from("apartments").select("area").eq("id", args.apartment_id).maybeSingle();
        if (a?.area > 0) patch.price_per_sqm = patch.price / a.area;
      }
      if (!Object.keys(patch).length) return JSON.stringify({ error: "Ягон майдон барои тағир нест" });
      const { data, error } = await supabase.from("apartments").update(patch).eq("id", args.apartment_id).select("id, apartment_number, status, price").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, updated: 1, apartment: data });
    }

    // ---------- WRITE: CRM ----------
    if (name === "create_customer") {
      const { data, error } = await supabase.from("customers").insert({
        company_id: companyId, fullname: args.fullname, phone: args.phone ?? null,
        passport: args.passport ?? null, address: args.address ?? null, notes: args.notes ?? null,
        status: args.status ?? "new", created_by: userId,
      }).select("id, fullname").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, customer: data });
    }
    if (name === "update_customer") {
      const patch: any = {};
      for (const k of ["fullname", "phone", "address", "notes", "status"]) if (args[k] !== undefined) patch[k] = args[k];
      const { data, error } = await supabase.from("customers").update(patch).eq("id", args.customer_id).select("id, fullname").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, updated: 1, customer: data });
    }
    if (name === "create_sale") {
      const { data: apt } = await supabase.from("apartments").select("id, project_id, price, status").eq("id", args.apartment_id).maybeSingle();
      if (!apt) return JSON.stringify({ error: "Квартира ёфт нашуд" });
      if (apt.status === "sold") return JSON.stringify({ error: "Ин квартира аллакай фурӯхта шудааст" });

      let customerId = args.customer_id;
      if (!customerId) {
        if (!args.customer_name && !args.customer_phone) return JSON.stringify({ error: "customer_id ё customer_name/phone лозим" });
        const found = await findCustomer(supabase, companyId, args.customer_name, args.customer_phone);
        if (found.length === 1) customerId = found[0].id;
        else if (found.length > 1) return JSON.stringify({ error: "Якчанд муштарӣ ёфт шуд", options: found });
        else {
          const { data: c, error: cerr } = await supabase.from("customers").insert({
            company_id: companyId, fullname: args.customer_name ?? args.customer_phone,
            phone: args.customer_phone ?? null, status: "booking", created_by: userId,
          }).select("id").single();
          if (cerr) return JSON.stringify({ error: cerr.message });
          customerId = c.id;
        }
      }
      const price = args.full_price ?? apt.price;
      const { data: sale, error } = await supabase.from("sales").insert({
        customer_id: customerId, apartment_id: apt.id, project_id: apt.project_id,
        full_price: price, currency: args.currency ?? "TJS",
        installment_months: args.installment_months ?? 0,
        payment_deadline: args.payment_deadline ?? null, status: "active", created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      await supabase.from("apartments").update({ status: "installment" }).eq("id", apt.id);
      return JSON.stringify({ ok: true, created: 1, sale });
    }
    if (name === "cancel_sale") {
      const { data: sale } = await supabase.from("sales").select("id, apartment_id").eq("id", args.sale_id).maybeSingle();
      if (!sale) return JSON.stringify({ error: "Фурӯш ёфт нашуд" });
      const { error } = await supabase.from("sales").update({ status: "cancelled" }).eq("id", args.sale_id);
      if (error) return JSON.stringify({ error: error.message });
      await supabase.from("apartments").update({ status: "empty" }).eq("id", sale.apartment_id);
      return JSON.stringify({ ok: true, updated: 1 });
    }
    if (name === "record_payment") {
      const { data, error } = await supabase.from("payments").insert({
        sale_id: args.sale_id, amount: args.amount, currency: args.currency ?? "TJS",
        payment_method: args.payment_method ?? "cash",
        payment_date: args.payment_date ?? today,
        note: args.note ?? null, status: args.status ?? "confirmed",
        confirmed_by: args.status === "pending" ? null : userId,
        confirmed_at: args.status === "pending" ? null : new Date().toISOString(),
        created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, payment: data });
    }

    // ---------- WRITE: FINANCE ----------
    if (name === "record_expense") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data, error } = await supabase.from("expenses").insert({
        project_id: r.project.id, amount: args.amount, category: args.category,
        description: args.description ?? null, expense_date: args.expense_date ?? today,
        currency: args.currency ?? "TJS", employee_name: args.employee_name ?? null,
        created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, expense: data });
    }
    if (name === "create_payable") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data, error } = await supabase.from("payables").insert({
        company_id: companyId, project_id: r.project.id,
        counterparty: args.counterparty, category: args.category,
        total_amount: args.total_amount, paid_amount: 0,
        due_date: args.due_date, description: args.description ?? null,
        currency: args.currency ?? "TJS", status: "new", created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, payable: data });
    }
    if (name === "record_payable_payment") {
      const { data, error } = await supabase.from("payable_payments").insert({
        payable_id: args.payable_id, amount: args.amount,
        payment_date: args.payment_date ?? today,
        method: args.method ?? null, comment: args.comment ?? null, created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, payment: data });
    }

    // ---------- WRITE: STAFF ----------
    if (name === "create_worker") {
      const { data, error } = await supabase.from("workers").insert({
        company_id: companyId, fullname: args.fullname, phone: args.phone ?? null,
        position: args.position ?? null, daily_rate: args.daily_rate ?? 0,
        passport_number: args.passport_number ?? null, is_active: true,
      }).select("id, fullname").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, worker: data });
    }
    if (name === "create_supplier") {
      const { data, error } = await supabase.from("suppliers").insert({
        company_id: companyId, name: args.name, phone: args.phone ?? null,
        contact_person: args.contact_person ?? null, address: args.address ?? null,
        note: args.note ?? null, archived: false, created_by: userId,
      }).select("id, name").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, supplier: data });
    }
    if (name === "create_subcontractor") {
      const { data, error } = await supabase.from("subcontractors").insert({
        company_id: companyId, brigade_name: args.brigade_name, specialty: args.specialty,
        foreman_name: args.foreman_name ?? null, phone: args.phone ?? null,
        is_active: true, created_by: userId,
      }).select("id, brigade_name").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, subcontractor: data });
    }
    if (name === "create_equipment") {
      const { data, error } = await supabase.from("equipment").insert({
        company_id: companyId, name: args.name, kind: args.kind, ownership: args.ownership,
        plate_number: args.plate_number ?? null, rate_per_hour: args.rate_per_hour ?? null,
        rate_per_day: args.rate_per_day ?? null, is_active: true, created_by: userId,
      }).select("id, name").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, equipment: data });
    }

    // ---------- WRITE: WAREHOUSE/MATERIALS ----------
    if (name === "warehouse_receipt") {
      const { data, error } = await supabase.from("warehouse_receipts").insert({
        company_id: companyId, name: args.name, unit: args.unit,
        quantity: args.quantity, unit_price: args.unit_price ?? 0,
        supplier_fio: args.supplier_fio ?? null,
        receipt_date: args.receipt_date ?? today,
        payment_status: "unpaid", created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, receipt: data });
    }
    if (name === "warehouse_issue") {
      const r = await resolveBlockProject(supabase, companyId, args, { ensureBlockForMutation: true });
      if (r.error || !r.project) return JSON.stringify(r);
      const { data, error } = await supabase.from("warehouse_issues").insert({
        company_id: companyId, project_id: r.project.id, name: args.name, unit: args.unit,
        quantity: args.quantity, unit_price: args.unit_price ?? 0,
        total: (args.unit_price ?? 0) * args.quantity,
        issue_date: args.issue_date ?? today, created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, issue: data });
    }
    if (name === "material_in") {
      const r = await resolveBlockProject(supabase, companyId, args, { ensureBlockForMutation: true });
      if (r.error || !r.project) return JSON.stringify(r);
      // find or create material
      let { data: mat } = await supabase.from("materials").select("id").eq("project_id", r.project.id).ilike("name", args.name).eq("unit", args.unit).maybeSingle();
      if (!mat) {
        const { data: m, error: merr } = await supabase.from("materials").insert({
          project_id: r.project.id, name: args.name, unit: args.unit, quantity: 0,
          unit_price: args.unit_price ?? 0, created_by: userId,
        }).select("id").single();
        if (merr) return JSON.stringify({ error: merr.message });
        mat = m;
      }
      const { data, error } = await supabase.from("material_movements").insert({
        material_id: mat.id, project_id: r.project.id, type: "in",
        quantity: args.quantity, unit_price: args.unit_price ?? 0,
        total: (args.unit_price ?? 0) * args.quantity,
        movement_date: args.movement_date ?? today,
        note: args.note ?? null, created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, movement: data });
    }
    if (name === "material_out") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { data: mat } = await supabase.from("materials").select("id, unit_price").eq("project_id", r.project.id).ilike("name", args.name).maybeSingle();
      if (!mat) return JSON.stringify({ error: "Материал ёфт нашуд" });
      const { data, error } = await supabase.from("material_movements").insert({
        material_id: mat.id, project_id: r.project.id, type: "out",
        quantity: args.quantity, unit_price: mat.unit_price ?? 0,
        total: (mat.unit_price ?? 0) * args.quantity,
        movement_date: args.movement_date ?? today,
        note: args.note ?? null, created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, movement: data });
    }

    // ---------- WRITE: STAGES ----------
    if (name === "create_stage") {
      const r = await resolveBlockProject(supabase, companyId, args);
      if (r.error || !r.project) return JSON.stringify(r);
      const { count } = await supabase.from("project_stages").select("id", { count: "exact", head: true }).eq("project_id", r.project.id);
      const { data, error } = await supabase.from("project_stages").insert({
        company_id: companyId, project_id: r.project.id, name: args.name,
        description: args.description ?? null,
        start_date: args.start_date ?? null, end_date: args.end_date ?? null,
        progress: 0, status: "planning", sort_order: (count ?? 0) + 1, created_by: userId,
      }).select("id, name").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, created: 1, stage: data });
    }
    if (name === "update_stage_progress") {
      const p = Math.min(100, Math.max(0, Number(args.progress)));
      const { data, error } = await supabase.from("stage_updates").insert({
        stage_id: args.stage_id, progress: p, note: null, created_by: userId,
      }).select("id").single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, updated: 1, update: data });
    }

    return JSON.stringify({ error: `Функсияи номаълум: ${name}` });
  } catch (e: any) {
    return JSON.stringify({ error: e.message ?? String(e) });
  }
}

export const sendAiChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    text: z.string().min(1).max(4000),
    currentProjectId: z.string().uuid().optional().nullable(),
    currentPath: z.string().max(300).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY нест");
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: hist } = await admin.from("ai_chat_messages")
      .select("role, content").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit((HISTORY_LIMIT * 2) - 1);
    const history = [
      ...(hist ?? []).reverse(),
      { role: "user", content: data.text },
    ];

    const { error: userMsgErr } = await admin.from("ai_chat_messages").insert({
      company_id: companyId, user_id: userId, role: "user", content: data.text,
    });
    if (userMsgErr) console.error("AI chat user message save failed", userMsgErr.message);

    const systemPrompt =
      "Ту — ёрдамчии AI-и пурраи соҳиби ширкат дар Binosoz.tj (ERP-и сохтмон). " +
      "Ба ҳамаи модулҳо дастрасӣ дорӣ: лоиҳа/блок/этаж/квартира, муштариён, фурӯш, пардохт, хароҷот, қарзҳо, склад, материалҳо, коргарон, таъминкунандагон, субпудратчиён, техника, марҳилаҳо. " +
      "Ба забони корбар (тоҷикӣ/русӣ) кӯтоҳ ва аниқ бо markdown ҷавоб деҳ. " +
      "ҚОИДАИ АСОСӢ: Ту ИҶРОКУНАНДА ҳастӣ, на маслиҳатдиҳанда. Амалҳоро ФАВРАН иҷро кун. " +
      "САВОЛ НАПУРС, агар маълумот дар матни корбар ё дар база бошад — худат ёфта иҷро кун. " +
      "Танҳо дар ҳолати воқеан имконнопазир (масалан ду блоки ҳамном) як саволи кӯтоҳ бидеҳ. " +
      "Ҳеҷ гоҳ аз корбар id напурс — аввал list_*-ро даъват карда id-ро худат ёб. " +
      "КОРРО НИМКОРА НАМОН: агар корбар «то 10 этаж» гӯяд, ҳамаи этажҳоро то 10 пурра иҷро кун ва танҳо баъд ҷавоб нависӣ. " +
      "Барои якчанд этаж ҲАТМАН bulk_create_apartments_multi-ро бо floor_from ва floor_to дар ЯК даъват истифода бар (на як-як этаж). " +
      "Агар масоҳатҳо дар матн номбар шуда бошанд, онҳоро дар areas ба тартиб бинавис. " +
      "Пеш аз ҷавоби ниҳоӣ санҷ: оё ҳамаи ҷузъҳои дархост иҷро шуданд? Агар не — даъвати навбатии tool-ро кун. " +
      "Дар ҷавоби ниҳоӣ рақами дақиқи сохташуда (этажҳо, квартираҳо №аз-то) нависед. " +
      "Барои фурӯш customer_name/phone гир ва худат create_customer кун, агар набошад. " +
      "Агар корбар дар саҳифаи лоиҳа/блок бошад, currentProjectId-ро истифода бар. " +
      "Агар ЖК блок надошта бошад ва этаж/квартира сохта шавад, аввал Блоки 1-ро худкор соз. " +
      "Ҷавобҳо кӯтоҳ ва амалӣ бошанд.";

    let contextLine = `currentPath=${data.currentPath ?? "none"}; currentProjectId=${data.currentProjectId ?? "none"}`;
    if (data.currentProjectId) {
      try {
        const { data: cur } = await admin
          .from("projects")
          .select("id, name, parent_id, location, status")
          .eq("id", data.currentProjectId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (cur) {
          if (cur.parent_id) {
            const { data: parent } = await admin.from("projects").select("id, name").eq("id", cur.parent_id).maybeSingle();
            contextLine += `\nКорбар ҲОЗИР ДАР БЛОК аст: «${cur.name}» (id=${cur.id}) аз лоиҳаи «${parent?.name ?? "?"}». project_id-и амалҳоро ба ин id гузор.`;
          } else {
            contextLine += `\nКорбар ҲОЗИР ДАР ЛОИҲА (ЖК) аст: «${cur.name}» (id=${cur.id}).`;
          }
        }
      } catch { /* ignore */ }
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: contextLine },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    let finalReply = "";
    let consumed: any = null;
    let creditChecked = false;
    const MAX_ITERS = 24;
    for (let iter = 0; iter < MAX_ITERS; iter++) {
      const lastRound = iter === MAX_ITERS - 1;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "openai/gpt-5.4",
          messages,
          ...(lastRound ? {} : { tools: TOOLS }),
          max_tokens: 4000,
        }),
      });
      if (res.status === 429) throw new Error("Лимит-и AI зиёд шуд, каме сабр кунед");
      if (res.status === 402) throw new Error("Кредит-и AI Gateway тамом шуд");
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`AI: ${res.status} ${t.slice(0, 200)}`);
      }
      const json: any = await res.json();
      const msg = json?.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* keep */ }
          const toolName = tc.function?.name;
          const isMutatingTool = MUTATING_TOOLS.has(toolName);
          if (isMutatingTool) {
            if (!creditChecked && !consumed) {
              const balance = await getAiCreditBalance(admin, companyId);
              if ((balance.free_limit - balance.free_used) <= 0 && (balance.paid_balance ?? 0) <= 0) throw new Error("no_credits");
              creditChecked = true;
            }
          }
          const result = await execTool(toolName, args, admin, companyId, userId, {
            currentProjectId: data.currentProjectId,
            currentPath: data.currentPath,
          });
          if (isMutatingTool && !consumed) {
            let parsed: any = null;
            try { parsed = JSON.parse(result); } catch { /* keep */ }
            const changed = parsed?.ok === true && ((Number(parsed.created) || 0) > 0 || (Number(parsed.updated) || 0) > 0);
            if (changed) {
              const { data: creditResult, error: consumeErr } = await admin.rpc("consume_ai_credit", { _company_id: companyId });
              if (consumeErr) {
                if (consumeErr.message?.includes("no_credits") || consumeErr.code === "P0001") throw new Error("no_credits");
                throw new Error(consumeErr.message);
              }
              consumed = creditResult;
            }
          }
          messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue;
      }
      finalReply = msg.content ?? "";
      break;
    }

    if (!finalReply) finalReply = "…";

    const { error: assistantMsgErr } = await admin.from("ai_chat_messages").insert({
      company_id: companyId, user_id: userId, role: "assistant", content: finalReply,
    });
    if (assistantMsgErr) console.error("AI chat assistant message save failed", assistantMsgErr.message);

    return {
      reply: finalReply,
      credits: consumed ?? await getAiCreditBalance(admin, companyId),
    };
  });
