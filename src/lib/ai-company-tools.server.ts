import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type Scope = { column: string; parent?: string };
type Module = { label: string; fields: string; edit: string; scope: Scope; search?: string };
const company: Scope = { column: "company_id" };
const project: Scope = { column: "project_id", parent: "projects" };
const module = (label: string, fields: string, edit: string, scope = company, search?: string): Module => ({ label, fields: [...new Set([...fields.split(","), ...edit.split(",")].filter(Boolean))].join(","), edit, scope, search });

// No wildcard projections, credentials, role grants, billing changes or raw webhook payloads.
export const COMPANY_MODULES: Record<string, Module> = {
  companies: module("Ширкат ва реквизитҳо", "id,name,phone,receipt_inn,receipt_address,receipt_signer,status,subscription_expires_at", "name,phone,receipt_inn,receipt_address,receipt_signer", { column: "id" }, "name"),
  projects: module("Лоиҳаҳо ва блокҳо", "id,name,parent_id,location,description,status,cost_per_sqm,cost_currency,public_showcase,show_prices", "name,location,description,status,cost_per_sqm,cost_currency,public_showcase,show_prices", company, "name"),
  floors: module("Ошёнаҳо", "id,project_id,floor_number,status,description", "floor_number,status,description", project),
  apartments: module("Хонаҳо ва мағозаҳо", "id,project_id,floor_id,apartment_number,rooms,area,price,price_per_sqm,status,is_historical", "apartment_number,rooms,area,price", project, "apartment_number"),
  customers: module("Муштариён ва CRM", "id,fullname,phone,address,notes,status,funnel_stage,source,assigned_manager_id", "fullname,phone,address,notes,status,funnel_stage,source", company, "fullname"),
  customer_interactions: module("Таърихи CRM", "id,customer_id,kind,direction,subject,body,outcome,next_action_at,interaction_at", "kind,subject,body,outcome,next_action_at,interaction_at", company, "subject"),
  customer_documents: module("Ҳуҷҷатҳои муштариён", "id,customer_id,file_name,file_type,created_at", "file_name,file_type"),
  sales: module("Фурӯш ва рассрочка", "id,customer_id,apartment_id,project_id,full_price,paid_amount,remaining_amount,currency,status,payment_deadline,installment_months,sale_number,created_at", "payment_deadline", company),
  payments: module("Пардохтҳо", "id,sale_id,amount,currency,payment_method,status,payment_date,note,check_number", "amount,payment_date,payment_method,note", { column: "sale_id", parent: "sales" }),
  payment_schedule: module("Ҷадвали рассрочка", "id,sale_id,due_date,amount,paid_amount,status", "due_date", { column: "sale_id", parent: "sales" }),
  contract_documents: module("Шартномаҳо", "id,sale_id,kind,contract_number,contract_date,created_at", "contract_number,contract_date"),
  contract_templates: module("Шаблонҳои шартнома", "id,contract_title,number_prefix,director_name,director_position,inn,legal_address,bank_details,phone,intro_text,body_text,footer_text", "contract_title,number_prefix,director_name,director_position,inn,legal_address,bank_details,phone,intro_text,body_text,footer_text"),
  barter_deals: module("Бартер", "id,project_id,client_name,client_phone,asset_type,asset_name,brand_model,state_number,property_value,estimated_value,cash_paid,remaining,status,note", "client_name,client_phone,asset_name,brand_model,state_number,asset_description,note"),
  resettlements: module("Переселение", "id,project_id,owner_fullname,phone,old_address,old_house_area,land_area,compensation_area,additional_area,price_per_m2,discount,total_payable,status,compensation_type,cash_amount,note", "owner_fullname,phone,old_address,cadastral_number,note"),
  expenses: module("Хароҷот", "id,project_id,amount,currency,category,description,expense_date,employee_name,worker_id,floor_id,created_by", "amount,category,description,expense_date,employee_name", { column: "project_id", parent: "projects" }),
  suppliers: module("Таъминкунандагон", "id,name,phone,contact_person,address,note,archived", "name,phone,contact_person,address,note,archived", company, "name"),
  payables: module("Қарзҳои ширкат", "id,project_id,supplier_id,counterparty,category,total_amount,paid_amount,currency,due_date,status,description,archived", "counterparty,category,total_amount,due_date,description,archived"),
  payable_payments: module("Пардохти қарзҳо", "id,payable_id,amount,payment_date,method,comment", "amount,payment_date,method,comment", { column: "payable_id", parent: "payables" }),
  project_budgets: module("Буҷет", "id,project_id,floor_id,category,planned_amount,quantity,unit,unit_price,note", "category,planned_amount,quantity,unit,unit_price,note"),
  estimates: module("Смета ва версияҳо", "id,project_id,name,customer,responsible,status,version,is_current,total,note", "name,customer,responsible,note"),
  estimate_items: module("Сатрҳои смета", "id,estimate_id,project_id,kind,section,name,unit,quantity,unit_price,total,sort_order", "kind,section,name,unit,quantity,unit_price,sort_order", project, "name"),
  estimate_documents: module("Ҳуҷҷатҳои смета", "id,estimate_id,project_id,file_name,doc_type,created_at", "file_name,doc_type", project),
  warehouse_items: module("Бақияи анбор", "id,name,unit,quantity,unit_price,min_quantity", "min_quantity", company, "name"),
  warehouse_receipts: module("Приходи анбор", "id,receipt_date,name,unit,quantity,unit_price,total,supplier_fio,payment_status,check_number", "supplier_fio,receipt_date"),
  warehouse_issues: module("Расходи анбор", "id,project_id,issue_date,name,unit,quantity,unit_price,total", "issue_date"),
  materials: module("Маводи лоиҳа", "id,project_id,name,unit,quantity,unit_price", "", project, "name"),
  material_movements: module("Ҳаракати мавод", "id,project_id,material_id,type,quantity,unit_price,total,movement_date,note", "movement_date,note", project),
  supply_alerts: module("Огоҳии анбор", "id,item_name,quantity,threshold,unit,sms_status,resolved", "resolved"),
  cash_registers: module("Кассаҳо", "id,project_id,name,currency,is_active", "name,is_active"),
  cash_shifts: module("Сменаҳои касса", "id,register_id,opened_at,opened_balance,closed_at,closed_balance_declared,closed_balance_system,diff,status,note", "note"),
  cash_operations: module("Амалҳои касса", "id,register_id,shift_id,direction,source,amount,currency,operation_date,counterparty,note", "note,counterparty"),
  workers: module("Коргарон", "id,fullname,phone,position,daily_rate,monthly_salary,salary_start_date,is_active,project_id,block_id", "fullname,phone,position,daily_rate,monthly_salary,salary_start_date,is_active", company, "fullname"),
  profiles: module("Кормандон", "id,fullname,phone,department", "fullname,phone", company, "fullname"),
  company_directors: module("Директорҳо", "id,user_id,fullname,email,is_active", "fullname"),
  sales_team_members: module("Дастаи фурӯш", "id,user_id,fullname,email,kind,percent,is_active", "fullname"),
  sales_team_payouts: module("Даромади фурӯшандагон", "id,member_id,amount,note,paid_at", "note"),
  attendance: module("Табел", "id,worker_id,project_id,date,status,hours,note,face_verified", "date,status,hours,note"),
  salary_accruals: module("Ҳисоби маош", "id,worker_id,period,amount", ""),
  worker_payments: module("Пардохти маош", "id,worker_id,project_id,period_from,period_to,days_worked,total_amount,paid_amount,status,note", "note"),
  subcontractors: module("Пудратчиён", "id,brigade_name,foreman_name,specialty,phone,is_active", "brigade_name,foreman_name,specialty,phone,is_active", company, "brigade_name"),
  subcontract_works: module("Корҳои пудрат", "id,subcontractor_id,project_id,work_name,unit,planned_qty,unit_price,contract_amount,status,note", "work_name,status,note", project),
  subcontract_acts: module("Актҳои пудрат", "id,work_id,act_number,signed_date,done_qty,amount,note", "act_number,signed_date,note", { column: "work_id", parent: "subcontract_works" }),
  subcontract_payments: module("Пардохти пудрат", "id,work_id,act_id,amount,paid_date,method,note", "note", { column: "work_id", parent: "subcontract_works" }),
  equipment: module("Техника", "id,name,kind,ownership,plate_number,rate_per_hour,rate_per_day,fuel_per_hour,is_active,note", "name,kind,ownership,plate_number,rate_per_hour,rate_per_day,fuel_per_hour,is_active,note", company, "name"),
  equipment_maintenance: module("Таъмири техника", "id,equipment_id,maintenance_date,description,cost,note", "maintenance_date,description,cost,note", { column: "equipment_id", parent: "equipment" }),
  equipment_usage: module("Истифодаи техника", "id,equipment_id,project_id,usage_date,hours,fuel_liters,operator_name,amount,note", "usage_date,hours,fuel_liters,operator_name,note", project),
  car_damages: module("Зарари нақлиёт", "id,project_id,damage_date,vehicle,amount,notes", "damage_date,vehicle,amount,notes"),
  project_stages: module("Марҳилаҳо ва Gantt", "id,project_id,name,description,start_date,end_date,deadline,progress,status,weight,sort_order", "name,description,start_date,end_date,deadline,weight,sort_order"),
  stage_tasks: module("Вазифаҳои сохтмон", "id,project_id,stage_id,name,description,weight,progress,start_date,end_date,sort_order", "name,description,weight,progress,start_date,end_date,sort_order"),
  stage_updates: module("Рафти сохтмон", "id,stage_id,progress,note,created_at", "note", { column: "stage_id", parent: "project_stages" }),
  construction_photos: module("Аксҳои сохтмон", "id,project_id,stage_id,note,taken_at", "note,taken_at"),
  quality_checks: module("Санҷиши сифат", "id,project_id,stage_id,check_name,checklist,result,inspector,check_date,issues", "check_name,checklist,result,inspector,check_date,issues", project),
  site_incidents: module("Бехатарӣ", "id,project_id,incident_date,incident_type,severity,description,resolution,resolved", "incident_date,incident_type,severity,description,resolution,resolved", project),
  permits: module("Иҷозатномаҳо", "id,project_id,name,permit_number,authority,issued_date,expires_at,reminder_days,note", "name,permit_number,authority,issued_date,expires_at,reminder_days,note"),
  hidden_work_acts: module("Актҳои корҳои пинҳонӣ", "id,project_id,act_number,work_description,location,materials_used,act_date,inspector_name,note", "act_number,work_description,location,materials_used,act_date,inspector_name,note"),
  material_acceptance_acts: module("Қабули мавод", "id,project_id,material_name,unit,ordered_qty,actual_qty,unit_price,supplier,act_date,inspector,variance,variance_pct,loss_amount,note", "material_name,supplier,act_date,inspector,note"),
  funding_requests: module("Дархости маблағ", "id,project_id,category,amount,currency,note,status,decision_note,created_at", "note"),
  partner_shares: module("Саҳмҳои шарикон", "id,project_id,director_user_id,percent,note", "note"),
  partner_distributions: module("Тақсимоти даромад", "id,project_id,payment_id,sale_id,director_user_id,percent,amount,status,created_at", ""),
  partner_payouts: module("Пардохти шарикон", "id,project_id,director_user_id,amount,paid_date,note", "note"),
  tax_reports: module("Ҳисоботи андоз", "id,report_type,period_start,period_end,revenue,expenses,profit,tax_amount,status,note", "note"),
  support_tickets: module("Дастгирӣ", "id,subject,message,status,admin_reply,created_at", "subject,message"),
  whatsapp_chats: module("Чатҳои WhatsApp", "id,phone,display_name,customer_id,last_message_text,last_message_at,unread_count", ""),
  whatsapp_messages: module("Паёмҳои WhatsApp", "id,customer_id,direction,body,message_type,status,sent_at", ""),
  subscription_payments: module("Пардохти обуна", "id,amount,currency,status,created_at,activated_until", ""),
  ai_credits: module("Кредитҳои AI ва сканер", "company_id,free_limit,free_used,paid_balance,scan_free_limit,scan_free_used,scan_paid_balance", ""),
};

export function getModule(table: string): Module {
  if (!Object.hasOwn(COMPANY_MODULES, table)) throw new Error("Ин қисмат ба AI дастрас нест");
  const config = COMPANY_MODULES[table];
  if (!config) throw new Error("Қисмат ёфт нашуд");
  return config;
}

export async function requireAssistantOwner(db: SupabaseClient, userId: string): Promise<string> {
  const { data: profile, error } = await db.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const { data: owned, error: ownError } = await db.from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
  if (ownError) throw new Error(ownError.message);
  const companyId = profile?.company_id ?? owned?.id;
  if (!companyId) throw new Error("Ширкат ёфт нашуд");
  const { data: role, error: roleError } = await db.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (roleError) throw new Error(roleError.message);
  if (owned?.id !== companyId && role !== true) throw new Error("Танҳо соҳиби ширкат ба ёрдамчии AI дастрасӣ дорад");
  return companyId;
}

export async function allRows(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query(offset, offset + 499);
    if (result.error) throw new Error(result.error.message);
    const page = z.array(z.record(z.unknown())).parse(result.data ?? []);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

const emptyId = "00000000-0000-0000-0000-000000000000";
export class CompanyTools {
  private ids = new Map<string, Promise<string[]>>();
  constructor(readonly db: SupabaseClient, readonly companyId: string, readonly userId: string) {}
  async scoped(table: string, fields?: string) {
    const config = getModule(table);
    let q = this.db.from(table).select<string, Record<string, unknown>>(fields ?? config.fields);
    if (!config.scope.parent) return { query: q.eq(config.scope.column, this.companyId) };
    const ids = await this.parentIds(config.scope.parent);
    if (table === "expenses") {
      const people = await this.parentIds("profiles");
      return { query: q.or(`project_id.in.(${(ids.length ? ids : [emptyId]).join(",")}),and(project_id.is.null,created_by.in.(${(people.length ? people : [this.userId]).join(",")}))`) };
    }
    return { query: q.in(config.scope.column, ids.length ? ids : [emptyId]) };
  }
  parentIds(table: string): Promise<string[]> {
    let pending = this.ids.get(table);
    if (!pending) {
      pending = allRows(async (from, to) => (await this.scoped(table, "id")).query.order("id").range(from, to))
        .then(rows => rows.map(row => z.string().uuid().parse(row["id"])));
      this.ids.set(table, pending);
    }
    return pending;
  }
  async record(table: string, id: string) {
    z.string().uuid().parse(id);
    const { data, error } = await (await this.scoped(table)).query.eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Сабт ёфт нашуд ё ба ширкати шумо тааллуқ надорад");
    return z.record(z.unknown()).parse(data);
  }
  async list(input: unknown) {
    const args = z.object({ table: z.string(), search: z.string().max(150).optional(), filters: z.array(z.object({ field: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) })).max(8).default([]), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50) }).strict().parse(input);
    const config = getModule(args.table);
    let q = (await this.scoped(args.table)).query;
    for (const filter of args.filters) {
      if (!config.fields.split(",").includes(filter.field)) throw new Error("Майдони ҷустуҷӯ иҷозат надорад");
      q = q.eq(filter.field, filter.value);
    }
    if (args.search) {
      if (!config.search) throw new Error("Барои ин қисмат filters-ро истифода баред");
      q = q.ilike(config.search, `%${args.search.replace(/[%_]/g, "")}%`);
    }
    const { data, error } = await q.order(args.table === "ai_credits" ? "company_id" : "id").range(args.offset, args.offset + args.limit);
    if (error) throw new Error(error.message);
    return { module: config.label, records: (data ?? []).slice(0, args.limit), has_more: (data?.length ?? 0) > args.limit, next_offset: args.offset + args.limit };
  }
  async prepareUpdate(input: unknown) {
    const args = z.object({ table: z.string(), id: z.string().uuid(), changes: z.record(z.unknown()) }).strict().parse(input);
    const config = getModule(args.table);
    const before = await this.record(args.table, args.id);
    const changes = validateChanges(args.table, args.changes);
    // Apartment dimensions and numbering use one transaction, including swaps and duplicate checks.
    if (args.table === "apartments") return this.prepareApartments({ updates: [{ id: args.id, ...changes }] });
    return { name: "update_company_record", args: { ...args, changes, before: Object.fromEntries(Object.keys(changes).map(key => [key, before[key]])) }, preview: { section: config.label, record: before["name"] ?? before["fullname"] ?? before["id"], before: Object.fromEntries(Object.keys(changes).map(key => [key, before[key]])), after: changes } };
  }
  async prepareApartments(input: unknown) {
    const { updates } = z.object({ updates: z.array(z.object({ id: z.string().uuid(), apartment_number: z.string().trim().min(1).max(30).optional(), area: z.number().positive().optional(), price: z.number().min(0).optional(), rooms: z.number().int().min(0).max(30).optional() }).strict()).min(1).max(500) }).strict().parse(input);
    if (new Set(updates.map(row => row.id)).size !== updates.length) throw new Error("Як хона ду бор интихоб шудааст");
    const { data, error } = await (await this.scoped("apartments")).query.in("id", updates.map(row => row.id)).limit(500);
    if (error) throw new Error(error.message);
    const existing = new Map((data ?? []).map(row => [String(row["id"]), row]));
    if (existing.size !== updates.length) throw new Error("Хона ба ширкати шумо тааллуқ надорад ё ёфт нашуд");
    const rows = [];
    for (const row of updates) {
      if (Object.keys(row).length === 1) throw new Error("Тағйиротро муайян кунед");
      const before = existing.get(row.id);
      if (!before) throw new Error("Хона ёфт нашуд");
      rows.push({ ...row, before: Object.fromEntries(["apartment_number", "area", "price", "rooms", "price_per_sqm"].map(key => [key, before[key]])) });
    }
    return { name: "bulk_update_apartments", args: { updates: rows }, preview: { section: "Хонаҳо ва мағозаҳо", count: rows.length, changes: rows } };
  }
  async executeUpdate(input: unknown) {
    const args = z.object({ table: z.string(), id: z.string().uuid(), changes: z.record(z.unknown()), before: z.record(z.unknown()) }).parse(input);
    const current = await this.record(args.table, args.id);
    const changes = validateChanges(args.table, args.changes);
    if (Object.keys(changes).some(key => JSON.stringify(current[key]) !== JSON.stringify(args.before[key]))) throw new Error("Маълумот баъди пешниҳод тағйир ёфт. Дархостро дубора фиристед");
    // Scope the write independently too; SELECT validation alone is insufficient.
    const config = getModule(args.table);
    let q = this.db.from(args.table).update(changes).eq("id", args.id);
    if (args.table === "expenses" && current["project_id"] == null) q = q.is("project_id", null).in("created_by", await this.parentIds("profiles"));
    else if (!config.scope.parent) q = q.eq(config.scope.column, this.companyId);
    else q = q.in(config.scope.column, await this.parentIds(config.scope.parent));
    for (const key of Object.keys(changes)) q = args.before[key] == null ? q.is(key, null) : q.eq(key, args.before[key]);
    const { data, error } = await q.select("id").single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Тағйирот сабт нашуд");
    return { ok: true, updated: 1 };
  }
  async income(input: unknown) {
    const { from_date, to_date, project_id } = z.object({ from_date: dateSchema, to_date: dateSchema, project_id: z.string().uuid().optional() }).strict().parse(input);
    if (from_date > to_date) throw new Error("Давраи ҳисобот нодуруст аст");
    let saleIds: string[] | null = null;
    let projectIds: string[] | null = null;
    if (project_id) {
      await this.record("projects", project_id);
      const children = await allRows(async (from, to) => (await this.scoped("projects", "id")).query.eq("parent_id", project_id).order("id").range(from, to));
      projectIds = [project_id, ...children.map(row => String(row["id"]))];
      const sales = await allRows(async (from, to) => (await this.scoped("sales", "id")).query.in("project_id", projectIds ?? []).order("id").range(from, to));
      saleIds = sales.map(row => String(row["id"]));
    }
    const [payments, expenses] = await Promise.all([
      allRows(async (from, to) => { let q = (await this.scoped("payments")).query.eq("status", "confirmed").gte("payment_date", from_date).lte("payment_date", to_date); if (saleIds) q = q.in("sale_id", saleIds.length ? saleIds : [emptyId]); return q.order("id").range(from, to); }),
      allRows(async (from, to) => { let q = (await this.scoped("expenses")).query.gte("expense_date", from_date).lte("expense_date", to_date); if (projectIds) q = q.in("project_id", projectIds); return q.order("id").range(from, to); }),
    ]);
    return { from_date, to_date, ...summarizeIncome(payments, expenses), basis: "Даромад = пардохтҳои тасдиқшуда дар ин давра, на арзиши ҳамаи шартномаҳо. Бақия = даромад минус хароҷоти сабтшуда; ин фоидаи муҳосибии холис нест. Асъорҳо алоҳидаанд." };
  }
}

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "Сана нодуруст аст");
const numericFields = new Set("area price rooms floor_number amount total_amount planned_amount quantity unit_price cost_per_sqm daily_rate monthly_salary rate_per_hour rate_per_day fuel_per_hour hours cost fuel_liters min_quantity reminder_days weight progress sort_order".split(" "));
const booleanFields = new Set(["archived", "is_active", "resolved", "public_showcase", "show_prices"]);
export function validateChanges(table: string, changes: Record<string, unknown>) {
  const allowed = getModule(table).edit.split(",").filter(Boolean);
  if (!Object.keys(changes).length) throw new Error("Тағйирот муайян нашудааст");
  for (const [key, value] of Object.entries(changes)) {
    if (!allowed.includes(key)) throw new Error(`Тағйири ${key} иҷозат надорад; амали махсуси ин қисматро истифода баред`);
    if (numericFields.has(key)) { z.number().finite().min(0).parse(value); if (key === "area") z.number().positive().parse(value); if (key === "progress") z.number().max(100).parse(value); if (["rooms", "floor_number", "sort_order", "reminder_days"].includes(key)) z.number().int().parse(value); if (key === "rooms") z.number().max(30).parse(value); }
    else if (booleanFields.has(key)) z.boolean().parse(value);
    else if (key === "checklist") z.array(z.record(z.unknown())).parse(value);
    else if (value !== null) z.string().max(6000).parse(value);
  }
  return changes;
}
export function summarizeIncome(payments: Record<string, unknown>[], expenses: Record<string, unknown>[]) {
  const totals: Record<string, { received: number; expenses: number; balance: number }> = {};
  for (const [rows, field] of [[payments, "received"], [expenses, "expenses"]] as const) {
    for (const row of rows) {
      if (field === "received" && row["status"] !== "confirmed") continue;
      const currency = String(row["currency"] ?? "TJS");
      const total = totals[currency] ?? { received: 0, expenses: 0, balance: 0 };
      const amount = Number(row["amount"]);
      if (!Number.isFinite(amount)) throw new Error("Маблағи ҳисобот нодуруст аст");
      total[field] = Math.round((total[field] + amount) * 100) / 100;
      total.balance = Math.round((total.received - total.expenses) * 100) / 100;
      totals[currency] = total;
    }
  }
  return { currencies: totals, payment_count: payments.filter(row => row["status"] === "confirmed").length, expense_count: expenses.length };
}

export const COMPANY_TOOLS = [
  { type: "function" as const, function: { name: "list_company_modules", description: "Ҳамаи қисматҳо ва майдонҳои хондан/тағйир додани ширкати худ. Барои қисматҳои дигари ERP аввал ҳаминро бин.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function" as const, function: { name: "list_company_records", description: "Сабтҳои ҳар қисмати ширкати худ; filters аз майдонҳои модул, offset барои саҳифаи нав. Барои хонаҳо project_id/floor_id/apartment_number-ро филтр кун. Ҳаргиз id аз корбар напурс.", parameters: { type: "object", properties: { table: { type: "string" }, search: { type: "string" }, filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, value: { type: ["string", "number", "boolean"] } }, required: ["field", "value"], additionalProperties: false } }, limit: { type: "integer", maximum: 100 }, offset: { type: "integer" } }, required: ["table"], additionalProperties: false } } },
  { type: "function" as const, function: { name: "company_income_report", description: "Даромади ширкат ё лоиҳа барои давраи дилхоҳ (масалан як моҳи тақвимӣ). Ҷамъбасти ПУРРА, пардохтҳои тасдиқшуда, хароҷот ва бақия, TJS/USD алоҳида.", parameters: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" }, project_id: { type: "string" } }, required: ["from_date", "to_date"], additionalProperties: false } } },
  { type: "function" as const, function: { name: "update_company_record", description: "Пешниҳоди тағйири сабт дар ҳар қисмати иҷозатдода. Майдонҳо аз list_company_modules. Танҳо баъди тугмаи тасдиқи корбар иҷро мешавад. Маълумоти ҳуқуқ/парол/тарифро тағйир намедиҳад.", parameters: { type: "object", properties: { table: { type: "string" }, id: { type: "string" }, changes: { type: "object", additionalProperties: true } }, required: ["table", "id", "changes"], additionalProperties: false } } },
  { type: "function" as const, function: { name: "bulk_update_apartments", description: "Рақамгузорӣ, масоҳат, нарх ё ҳуҷраҳои як/чанд хона бо як тасдиқ. Барои рақамгузории оммавӣ аввал ҳамаи хонаҳоро ёб; тартиб аз рӯи ошёна ва рақам. ids нигоҳ дошта мешаванд, шартномаҳо тағйир намеёбанд. area бе price нархи умумиро нигоҳ медорад.", parameters: { type: "object", properties: { updates: { type: "array", minItems: 1, maxItems: 500, items: { type: "object", properties: { id: { type: "string" }, apartment_number: { type: "string" }, area: { type: "number" }, price: { type: "number" }, rooms: { type: "integer" } }, required: ["id"], additionalProperties: false } } }, required: ["updates"], additionalProperties: false } } },
];