// Server-only core for OSON SMS sending and automatic payment reminders.
// Never import this from client components or route module top-level — load it
// inside server handlers via dynamic import.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Рақами телефонро ба формати байналмилалии Тоҷикистон (992XXXXXXXXX) табдил медиҳад
export function normalizePhone(phone: string): string | null {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 9) d = "992" + d;
  else if (d.length === 10 && d.startsWith("0")) d = "992" + d.slice(1);
  else if (d.startsWith("8") && d.length === 11) d = "992" + d.slice(1);
  return d.length >= 11 ? d : null;
}

export type OsonCfg = {
  login: string;
  token: string;
  sender: string;
  hashSecret?: string | null;
  reminderTpl?: string | null;
  overdueTpl?: string | null;
  paidTpl?: string | null;
  penaltyPercent?: number;
  penaltyPeriod?: "daily" | "monthly";
};

export type SmsResult =
  | { ok: true; msgId: string | null; txnId: string; raw: string }
  | { ok: false; error: string };

export async function osonSend(cfg: OsonCfg, phone: string, msg: string): Promise<SmsResult> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const params = new URLSearchParams({
    from: cfg.sender,
    phone_number: phone,
    msg,
    txn_id: txnId,
    login: cfg.login,
  });
  if (cfg.hashSecret) {
    const str = `${txnId};${cfg.login};${cfg.sender};${phone};${cfg.hashSecret}`;
    params.set("str_hash", createHash("sha256").update(str).digest("hex"));
  }
  const url = `https://api.osonsms.com/sendsms_v1.php?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
    });
  } catch (e: any) {
    return { ok: false, error: "Пайвастшавӣ ба OSON SMS ноком шуд: " + (e?.message ?? "") };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (json?.error) {
    return {
      ok: false,
      error:
        json.error.msg || json.error.error_type || `Хатои OSON SMS (код ${json.error.code ?? "?"})`,
    };
  }
  if (!res.ok) {
    return { ok: false, error: `OSON SMS HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true, msgId: json?.msg_id ?? null, txnId, raw: text.slice(0, 300) };
}

// Матнҳои пешфарз аз рӯи марҳила: 3 ёдоварӣ пеш аз мӯҳлат ва 3 огоҳинома пас аз он.
const DEFAULT_STAGE_TPL: Record<string, string> = {
  "before-3":
    "Муштарии мӯҳтарам {name}! Ёдоварӣ: то мӯҳлати пардохти Шумо 3 рӯз мондааст. Санаи пардохт — {date}, маблағ — {amount}. Маблағи умумии боқимонда: {balance}. Лутфан саривақт пардохт намоед. Бо эҳтиром, ширкати сохтмонӣ.",
  "before-2":
    "Муштарии мӯҳтарам {name}! То мӯҳлати пардохт 2 рӯз мондааст. Санаи пардохт — {date}, маблағ — {amount}. Боқимонда: {balance}. Илтимос, пардохтро ба таъхир нагузоред. Бо эҳтиром, ширкати сохтмонӣ.",
  "before-1":
    "Муштарии мӯҳтарам {name}! Фардо {date} мӯҳлати пардохти Шумо ба маблағи {amount} фаро мерасад. Боқимонда: {balance}. Дар сурати сари вақт напардохтан ҷаримаи {penalty_percent}% {penalty_period} ҳисоб карда мешавад. Бо эҳтиром, ширкати сохтмонӣ.",
  "overdue-3":
    "Муштарии мӯҳтарам {name}! Мӯҳлати пардохти Шумо ({amount}) аз {date} гузашт ва 3 рӯз таъхир шудааст. Аз имрӯз ҷаримаи {penalty_percent}% {penalty_period} ҳисоб мешавад. Боқимонда: {balance}. Лутфан ҳарчи зудтар пардохт кунед. Бо эҳтиром, ширкати сохтмонӣ.",
  "overdue-4":
    "ОГОҲӢ! Муштарии мӯҳтарам {name}, қарзи Шумо аз {date} то ҳол пардохт нашудааст. Маблағи пардохтнашуда — {amount}, боқимондаи умумӣ — {balance}. Дар сурати сарфи назар кардан, шартнома метавонад як тарафа қатъ ва парванда ба хадамоти ҳуқуқӣ супорида шавад. Бо эҳтиром, ширкати сохтмонӣ.",
  "overdue-5":
    "ОГОҲИНОМАИ ОХИРИН! {name}, қарзи Шумо ({amount}) аз {date} пардохт нашуд. Боқимонда: {balance}. Агар дар муддати 3 рӯзи корӣ пардохт нашавад, мо маҷбур мешавем барои рӯёнидани қарз ва ҷарима ба СУД муроҷиат кунем ва Шумо ба ҷаласаи судӣ даъват карда мешавед. Хароҷоти судӣ ба зиммаи Шумо мешавад. Бо эҳтиром, ширкати сохтмонӣ.",
  paid: "Муштарии мӯҳтарам {name}! Пардохти Шумо ба маблағи {amount} қабул шуд. Ташаккур! Маблағи боқимонда: {balance}. Бо эҳтиром, ширкати сохтмонӣ.",
};

// Матни ёдоварии пардохт — агар ширкат қолаби худро гузошта бошад, он бартарӣ дорад
function buildMessage(
  cfg: OsonCfg,
  name: string,
  amount: number,
  dueDate: string,
  currency: string,
  stage: string,
  balance: number,
): string {
  const d = new Date(dueDate).toLocaleDateString("ru-RU");
  const sum = `${Math.round(amount).toLocaleString()} ${currency}`;
  const bal = `${Math.round(balance).toLocaleString()} ${currency}`;
  const custom =
    stage === "paid"
      ? cfg.paidTpl
      : stage.startsWith("overdue")
        ? cfg.overdueTpl
        : cfg.reminderTpl;
  const tpl = custom || DEFAULT_STAGE_TPL[stage] || DEFAULT_STAGE_TPL["before-1"];
  const period = cfg.penaltyPeriod === "monthly" ? "моҳона" : "рӯзона";
  return tpl
    .replaceAll("{name}", name)
    .replaceAll("{amount}", sum)
    .replaceAll("{balance}", bal)
    .replaceAll("{date}", d)
    .replaceAll("{penalty_percent}", String(cfg.penaltyPercent ?? 0))
    .replaceAll("{penalty_period}", period);
}

// Ёдоварӣ 1 рӯз пеш аз мӯҳлат; ҳангоми таъхир — пас аз 2 рӯз, ҳар рӯз як бор
// Танзимоти OSON SMS: аввал барои лоиҳа, набошад — умумии ширкат
export async function resolveSmsCfg(
  admin: any,
  companyId: string,
  projectId?: string | null,
): Promise<OsonCfg | null> {
  const { data: rows } = await admin
    .from("company_sms_settings")
    .select("*")
    .eq("company_id", companyId);
  const list = (rows as any[]) ?? [];
  // Агар лоиҳа блок (подпроект) бошад, танзимоти лоиҳаи асосӣ (parent) гирифта мешавад
  let pid = projectId ?? null;
  if (pid && !list.some((r) => r.project_id === pid)) {
    const { data: proj } = await admin
      .from("projects")
      .select("parent_id")
      .eq("id", pid)
      .maybeSingle();
    if (proj?.parent_id) pid = proj.parent_id;
  }
  const cfg =
    (pid ? list.find((r) => r.project_id === pid) : null) ??
    list.find((r) => !r.project_id) ??
    null;
  if (!cfg || !cfg.enabled || !cfg.login || !cfg.token || !cfg.sender) return null;
  return {
    login: cfg.login,
    token: cfg.token,
    sender: cfg.sender,
    hashSecret: cfg.hash_secret,
    reminderTpl: cfg.reminder_template,
    overdueTpl: cfg.overdue_template,
    paidTpl: cfg.paid_template,
    penaltyPercent: Number(cfg.penalty_percent ?? 0),
    penaltyPeriod: (cfg.penalty_period ?? "daily") as "daily" | "monthly",
  };
}

// 3 ёдоварӣ пеш аз мӯҳлат (3, 2, 1 рӯз) ва пас аз мӯҳлат — 3 огоҳинома,
// ки аз рӯзи 3-юми таъхир сар мешаванд (3, 4, 5 рӯз).
const REMIND_BEFORE_DAYS = [3, 2, 1];
const OVERDUE_DAYS = [3, 4, 5];

function stageFor(daysDiff: number): string | null {
  if (daysDiff < 0) {
    const late = -daysDiff;
    return OVERDUE_DAYS.includes(late) ? `overdue-${late}` : null;
  }
  if (REMIND_BEFORE_DAYS.includes(daysDiff)) return `before-${daysDiff}`;
  return null;
}

export type ReminderRunResult = {
  ok: boolean;
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ schedule_id: string; phone: string | null; stage: string; status: string; error?: string }>;
};

// Логикаи автоматӣ: аз графики рассрочка муштариёнро ёфта, ба онҳое ки мӯҳлати
// пардохташон наздик ё гузашта аст, СМС мефиристад.
export async function runSmsReminders(): Promise<ReminderRunResult> {
  const admin = supabaseAdmin as any;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const horizon = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);

  // Графикҳои пардохти пардохтнашуда то 3 рӯзи оянда (ва гузаштаҳо)
  const { data: rows, error } = await admin
    .from("payment_schedule")
    .select(
      "id, due_date, amount, paid_amount, status, sale:sales(id, status, project_id, currency, full_price, paid_amount, customer:customers(company_id, fullname, phone))",
    )
    .neq("status", "paid")
    .lte("due_date", horizon)
    .order("due_date", { ascending: true });

  const details: ReminderRunResult["details"] = [];
  let sent = 0,
    failed = 0,
    skipped = 0;

  if (error || !rows) {
    return { ok: false, scanned: 0, sent, failed, skipped, details, error: error?.message } as any;
  }

  // Танзимоти СМС-и ширкатҳоро кэш мекунем
  const cfgCache = new Map<string, OsonCfg | null>();
  async function getCfg(companyId: string, projectId?: string | null): Promise<OsonCfg | null> {
    const key = `${companyId}:${projectId ?? ""}`;
    if (cfgCache.has(key)) return cfgCache.get(key)!;
    const result = await resolveSmsCfg(admin, companyId, projectId);
    cfgCache.set(key, result);
    return result;

  }

  for (const r of rows as any[]) {
    const daysDiff = Math.ceil((new Date(r.due_date).getTime() - today.getTime()) / 86400000);
    const stage = stageFor(daysDiff);
    if (!stage) {
      skipped++;
      continue;
    }
    const sale = r.sale;
    const companyId = sale?.customer?.company_id;
    const phone = normalizePhone(sale?.customer?.phone || "");
    const name = sale?.customer?.fullname || "муштарӣ";
    const remaining = Math.max(Number(r.amount || 0) - Number(r.paid_amount || 0), 0);
    const saleBalance = Math.max(Number(sale?.full_price || 0) - Number(sale?.paid_amount || 0), 0);
    // Агар фурӯш бекор шуда бошад ё тамоми маблағ пардохт шуда бошад — СМС намефиристем
    // Тафовути хурд (то 1 сомонӣ) аз мудаввар кардан — СМС намеравад
    if (!companyId || !phone || remaining <= 1 || saleBalance <= 1 || sale?.status === "cancelled") {
      skipped++;
      continue;
    }


    // Калиди беназир: барои ҳар марҳила ва ҳар мӯҳлат танҳо як СМС
    const reminderKey = `${r.id}:${stage}:${r.due_date}`;

    const cfg = await getCfg(companyId, sale?.project_id ?? null);
    if (!cfg) {
      skipped++;
      continue;
    }

    // Дедупликатсия: агар аллакай фиристода шуда бошад, мегузарем
    const { data: existing } = await admin
      .from("sms_logs")
      .select("id")
      .eq("reminder_key", reminderKey)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    // Санҷиши ниҳоӣ: шояд ҳозир пардохт шуда бошад
    const { data: fresh } = await admin
      .from("payment_schedule")
      .select("amount, paid_amount, status")
      .eq("id", r.id)
      .maybeSingle();
    const freshRemaining = fresh
      ? Math.max(Number(fresh.amount || 0) - Number(fresh.paid_amount || 0), 0)
      : remaining;
    if (fresh?.status === "paid" || freshRemaining <= 1) {
      skipped++;
      continue;
    }


    const currency = sale?.currency || "сомонӣ";
    const totalBalance = Math.max(Number(sale?.full_price || 0) - Number(sale?.paid_amount || 0), 0);
    const message = buildMessage(cfg, name, remaining, r.due_date, currency, stage, totalBalance);
    const res = await osonSend(cfg, phone, message);

    await admin.from("sms_logs").insert({
      company_id: companyId,
      schedule_id: r.id,
      customer_phone: phone,
      message,
      due_date: r.due_date,
      stage,
      reminder_key: reminderKey,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : res.error,
    });

    if (res.ok) {
      sent++;
      details.push({ schedule_id: r.id, phone, stage, status: "sent" });
    } else {
      failed++;
      details.push({ schedule_id: r.id, phone, stage, status: "failed", error: res.error });
    }
  }

  return { ok: true, scanned: rows.length, sent, failed, skipped, details };
}

// СМС-и тасдиқи пардохт барои графикҳое, ки нав ба ҳолати `paid` гузаштаанд.
export async function sendPaidConfirmationForSale(saleId: string): Promise<{ ok: boolean; sent: number; error?: string }> {
  const admin = supabaseAdmin as any;
  const { data: sale } = await admin
    .from("sales")
    .select("id, project_id, currency, full_price, paid_amount, customer:customers(company_id, fullname, phone)")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) return { ok: false, sent: 0, error: "sale not found" };

  const companyId = sale.customer?.company_id;
  const phone = normalizePhone(sale.customer?.phone || "");
  const name = sale.customer?.fullname || "муштарӣ";
  if (!companyId || !phone) return { ok: true, sent: 0 };

  const cfg = await resolveSmsCfg(admin, companyId, sale.project_id ?? null);
  if (!cfg) return { ok: true, sent: 0 };

  const { data: schedules } = await admin
    .from("payment_schedule")
    .select("id, amount, due_date, status")
    .eq("sale_id", saleId)
    .eq("status", "paid");

  const currency = sale.currency || "сомонӣ";
  const balance = Math.max(Number(sale.full_price || 0) - Number(sale.paid_amount || 0), 0);
  let sent = 0;
  for (const s of (schedules as any[]) ?? []) {
    const reminderKey = `${s.id}:paid`;
    const { data: exists } = await admin
      .from("sms_logs")
      .select("id")
      .eq("reminder_key", reminderKey)
      .maybeSingle();
    if (exists) continue;

    const message = buildMessage(cfg, name, Number(s.amount || 0), s.due_date, currency, "paid", balance);
    const res = await osonSend(cfg, phone, message);
    await admin.from("sms_logs").insert({
      company_id: companyId,
      schedule_id: s.id,
      customer_phone: phone,
      message,
      due_date: s.due_date,
      stage: "paid",
      reminder_key: reminderKey,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : res.error,
    });
    if (res.ok) sent++;
  }
  return { ok: true, sent };
}
