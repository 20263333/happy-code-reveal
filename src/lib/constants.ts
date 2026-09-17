export const ROLE_LABELS = {
  owner: "Владелец",
  manager: "Менеджер",
  accountant: "Бухгалтер",
  warehouse: "Складчик",
  director: "Директор",
} as const;

// App modules that the Super Admin can toggle per company. The key matches the
// route segment (or a sub-tab key like "project:apartments"); the label is
// shown in the admin UI (translated via tr()). `group` groups related entries.
export const APP_MODULES = [
  // Top-level menus
  { key: "dashboard", label: "Дашборд", group: "Меню асосӣ" },
  { key: "projects", label: "Проекты", group: "Меню асосӣ" },
  { key: "customers", label: "Клиенты", group: "Меню асосӣ" },
  { key: "debtors", label: "Должники", group: "Меню асосӣ" },
  { key: "contracts", label: "Договор", group: "Меню асосӣ" },
  { key: "payments", label: "Платежи", group: "Меню асосӣ" },
  { key: "expenses", label: "Расходы", group: "Меню асосӣ" },
  { key: "warehouse", label: "Склад", group: "Меню асосӣ" },
  { key: "estimate", label: "Смета", group: "Меню асосӣ" },
  { key: "attendance", label: "Табел", group: "Меню асосӣ" },
  { key: "subcontractors", label: "Пудратчиён (Субподряд)", group: "Меню асосӣ" },
  { key: "equipment", label: "Техника", group: "Меню асосӣ" },
  { key: "quality", label: "Сифат ва Бехатарӣ", group: "Меню асосӣ" },
  { key: "crm-funnel", label: "Воронка фурӯш (CRM)", group: "Меню асосӣ" },
  { key: "gantt", label: "График сохтмон (Gantt)", group: "Меню асосӣ" },
  { key: "permits", label: "Иҷозатнома ва Актҳо", group: "Меню асосӣ" },
  { key: "tax-reports", label: "Ҳисоботи давлатӣ (1С)", group: "Меню асосӣ" },
  { key: "payables", label: "Поставщики", group: "Меню асосӣ" },
  { key: "reports", label: "Отчёт ОПУ", group: "Меню асосӣ" },
  { key: "staff", label: "Сотрудники", group: "Меню асосӣ" },
  { key: "directors", label: "Директорҳо", group: "Меню асосӣ" },
  { key: "cashier", label: "Кассир", group: "Меню асосӣ" },
  { key: "billing", label: "Тарифы и оплата", group: "Меню асосӣ" },
  { key: "scan-credits", label: "Скан Кредитҳо (сканери паспорт)", group: "Меню асосӣ" },
  { key: "settings", label: "Настройки", group: "Меню асосӣ" },
  // Project block sub-tabs
  { key: "project:apartments", label: "Квартираҳо", group: "Даруни блок (ЖК)" },
  { key: "project:sales", label: "Фурӯшҳо", group: "Даруни блок (ЖК)" },
  { key: "project:payments", label: "Пардохтҳо", group: "Даруни блок (ЖК)" },
  { key: "project:schedule", label: "📊 График", group: "Даруни блок (ЖК)" },
  { key: "project:budget", label: "💰 Буджет", group: "Даруни блок (ЖК)" },
  { key: "project:warehouse", label: "Склад (блок)", group: "Даруни блок (ЖК)" },
  { key: "project:estimate", label: "Смета", group: "Даруни блок (ЖК)" },
  { key: "project:resettlement", label: "Переселение", group: "Даруни блок (ЖК)" },
  { key: "project:barter", label: "Бартер", group: "Даруни блок (ЖК)" },
  { key: "project:facade3d", label: "🏢 3D фасад", group: "Даруни блок (ЖК)" },
  { key: "project:distribution", label: "💸 Тақсими даромад", group: "Даруни блок (ЖК)" },
  { key: "project:access", label: "Доступ", group: "Даруни блок (ЖК)" },
  { key: "project:add-floor", label: "Илова кардани этаж", group: "Даруни блок (ЖК)" },
  { key: "project:add-apartment", label: "Илова кардани квартира", group: "Даруни блок (ЖК)" },
  // Warehouse sub-tabs
  { key: "warehouse:stock", label: "Склад (остатки)", group: "Даруни Склад" },
  { key: "warehouse:in", label: "Приход", group: "Даруни Склад" },
  { key: "warehouse:out", label: "Расход", group: "Даруни Склад" },
  // Attendance sub-tabs
  { key: "attendance:table", label: "Табел", group: "Даруни Табел" },
  { key: "attendance:calc", label: "Ҳисоб-китоб", group: "Даруни Табел" },
  { key: "attendance:payments", label: "Пардохтҳо", group: "Даруни Табел" },
  // Permits sub-tabs
  { key: "permits:permits", label: "Иҷозатномаҳо", group: "Даруни Иҷозатномаҳо" },
  { key: "permits:acts", label: "Актҳои пинҳонӣ", group: "Даруни Иҷозатномаҳо" },
  // Quality sub-tabs
  { key: "quality:checks", label: "Санҷиши сифат", group: "Даруни Сифат ва Бехатарӣ" },
  { key: "quality:incidents", label: "Ҳодисаҳо / Бехатарӣ", group: "Даруни Сифат ва Бехатарӣ" },
  // Equipment sub-tabs
  { key: "equipment:list", label: "Рӯйхати техника", group: "Даруни Техника" },
  { key: "equipment:usage", label: "Истифодабарӣ", group: "Даруни Техника" },
  { key: "equipment:maint", label: "Таъмир", group: "Даруни Техника" },
] as const;

export type AppModuleKey = typeof APP_MODULES[number]["key"];

export const ALL_MODULE_KEYS = APP_MODULES.map((m) => m.key) as AppModuleKey[];

// A company with no explicit list (null) gets every module. A few keys stay
// always-on so company owners never miss platform announcements or billing.
// Any key not present in APP_MODULES (unknown/legacy) also defaults to true
// so newly-introduced menus don't disappear for pre-existing companies until
// a Super Admin explicitly toggles them.
const ALWAYS_ON = new Set(["notifications", "ai-credits", "my-shares", "support"]);
const KNOWN_KEYS = new Set<string>(APP_MODULES.map((m) => m.key));

export function companyModuleEnabled(
  enabled: string[] | null | undefined,
  key: string,
): boolean {
  if (ALWAYS_ON.has(key)) return true;
  if (!enabled) return true;
  if (!KNOWN_KEYS.has(key)) return true;
  return enabled.includes(key);
}

export const APARTMENT_STATUS = {
  empty: { labelKey: "status.empty", color: "bg-success/15 text-success border-success/30" },
  sold: { labelKey: "status.sold", color: "bg-destructive/15 text-destructive border-destructive/30" },
  installment: { labelKey: "status.installment", color: "bg-accent/15 text-accent border-accent/30" },
  unavailable: { labelKey: "status.unavailable", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
} as const;

export const PROJECT_STATUS = {
  planning: "projectStatus.planning",
  in_progress: "projectStatus.in_progress",
  completed: "projectStatus.completed",
  paused: "projectStatus.paused",
} as const;

export const EXPENSE_CATEGORIES = [
  { value: "cement", labelKey: "expense.cat.cement" },
  { value: "concrete", labelKey: "expense.cat.concrete" },
  { value: "rebar", labelKey: "expense.cat.rebar" },
  { value: "brick", labelKey: "expense.cat.brick" },
  { value: "blocks", labelKey: "expense.cat.blocks" },
  { value: "sand", labelKey: "expense.cat.sand" },
  { value: "gravel", labelKey: "expense.cat.gravel" },
  { value: "cable", labelKey: "expense.cat.cable" },
  { value: "wire", labelKey: "expense.cat.wire" },
  { value: "wire_6mm", labelKey: "expense.cat.wire_6mm" },
  { value: "wire_visual", labelKey: "expense.cat.wire_visual" },
  { value: "nails", labelKey: "expense.cat.nails" },
  { value: "lumber", labelKey: "expense.cat.lumber" },
  { value: "formwork", labelKey: "expense.cat.formwork" },
  { value: "electrical", labelKey: "expense.cat.electrical" },
  { value: "plumbing", labelKey: "expense.cat.plumbing" },
  { value: "plaster", labelKey: "expense.cat.plaster" },
  { value: "paint", labelKey: "expense.cat.paint" },
  { value: "tile", labelKey: "expense.cat.tile" },
  { value: "windows", labelKey: "expense.cat.windows" },
  { value: "doors", labelKey: "expense.cat.doors" },
  { value: "roofing", labelKey: "expense.cat.roofing" },
  { value: "waterproof", labelKey: "expense.cat.waterproof" },
  { value: "insulation", labelKey: "expense.cat.insulation" },
  { value: "welding", labelKey: "expense.cat.welding" },
  { value: "tools", labelKey: "expense.cat.tools" },
  { value: "fuel", labelKey: "expense.cat.fuel" },
  { value: "elevator", labelKey: "expense.cat.elevator" },
  { value: "landscaping", labelKey: "expense.cat.landscaping" },
  { value: "materials", labelKey: "expense.cat.materials" },
  { value: "salary", labelKey: "expense.cat.salary" },
  { value: "masters", labelKey: "expense.cat.masters" },
  { value: "subcontract", labelKey: "expense.cat.subcontract" },
  { value: "equipment", labelKey: "expense.cat.equipment" },
  { value: "transport", labelKey: "expense.cat.transport" },
  { value: "rent", labelKey: "expense.cat.rent" },
  { value: "taxes", labelKey: "expense.cat.taxes" },
  { value: "compensation", labelKey: "expense.cat.compensation" },
  { value: "car_loss", labelKey: "expense.cat.car_loss" },
  { value: "partner_payout", labelKey: "expense.cat.partner_payout" },
  { value: "other", labelKey: "expense.cat.other" },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]["value"];

// Categories a director can budget per floor and an employee can request
// money for through the «Заявка» flow.
export const REQUEST_CATEGORIES = [
  "concrete", "rebar", "salary", "equipment", "cement", "brick", "blocks", "sand", "gravel",
  "cable", "wire", "wire_6mm", "wire_visual", "nails", "lumber", "formwork", "electrical", "plumbing", "plaster", "paint",
  "tile", "windows", "doors", "roofing", "waterproof", "insulation", "welding", "tools",
  "fuel", "elevator", "landscaping", "materials", "masters", "transport",
] as const;


// Partner payouts are paid out of the partner's own balance, so they must not
// be counted again as construction-fund spending or budget fact.
export const NON_FUND_CATEGORIES = ["partner_payout"] as const;


// Units of measure for warehouse materials (склад)
export const MATERIAL_UNITS = [
  { value: "dona", label: "дона (шт)" },
  { value: "m", label: "метр (м)" },
  { value: "m2", label: "метри мураббаъ (м²)" },
  { value: "m3", label: "метри мукааб (м³)" },
  { value: "kg", label: "килограмм (кг)" },
  { value: "ton", label: "тонна (т)" },
  { value: "gram", label: "грамм (г)" },
  { value: "liter", label: "литр (л)" },
  { value: "bag", label: "халта" },
  { value: "rulon", label: "рулон" },
  { value: "basta", label: "баста" },
  { value: "quti", label: "қуттӣ" },
  { value: "juft", label: "ҷуфт" },
  { value: "komplekt", label: "комплект" },
  { value: "buxta", label: "бухта" },
  { value: "pallet", label: "паллет" },
] as const;

export function materialUnitLabel(value: string) {
  return MATERIAL_UNITS.find((u) => u.value === value)?.label ?? value;
}

// ============ ESTIMATE (Смета) module ============
// Estimate line kinds with preset name suggestions per the construction domain.
export const ESTIMATE_KINDS = [
  { value: "work", label: "Корҳои сохтмонӣ", presets: ["Корҳои заминӣ", "Фундамент", "Деворҳо", "Бом", "Отделка"] },
  { value: "material", label: "Маводҳо", presets: ["Семент", "Арматура", "Хишт", "Қум", "Шағал"] },
  { value: "equipment", label: "Техника", presets: ["Экскаватор", "Кран", "Самосвал", "Бетономешалка"] },
  { value: "labor", label: "Қувваи корӣ", presets: ["Муҳандис", "Усто", "Коргар"] },
] as const;

export type EstimateKind = typeof ESTIMATE_KINDS[number]["value"];

export function estimateKindLabel(value: string): string {
  return ESTIMATE_KINDS.find((k) => k.value === value)?.label ?? value;
}

export const ESTIMATE_STATUS = {
  draft: { label: "Черновик", color: "bg-muted text-muted-foreground border-border" },
  review: { label: "На согласовании", color: "bg-warning/20 text-warning-foreground border-warning/40" },
  approved: { label: "Утверждена", color: "bg-success/15 text-success border-success/30" },
  completed: { label: "Завершена", color: "bg-accent/15 text-accent border-accent/30" },
} as const;

export type EstimateStatus = keyof typeof ESTIMATE_STATUS;

export function estimateStatusLabel(status: string): string {
  return (ESTIMATE_STATUS as any)[status]?.label ?? status;
}

// Estimate is locked from editing once approved or completed.
export function estimateLocked(status: string): boolean {
  return status === "approved" || status === "completed";
}

// Categories for the Accounts Payable (Кредиторская задолженность) module.
export const PAYABLE_CATEGORIES = [
  { value: "materials", label: "Строительные материалы" },
  { value: "salary", label: "Зарплата" },
  { value: "equipment", label: "Техника и оборудование" },
  { value: "rent", label: "Аренда" },
  { value: "transport", label: "Транспорт" },
  { value: "taxes", label: "Налоги" },
  { value: "contractors", label: "Подрядчики" },
  { value: "utilities", label: "Коммунальные услуги" },
  { value: "other", label: "Прочие расходы" },
] as const;

export type PayableCategory = typeof PAYABLE_CATEGORIES[number]["value"];

export function payableCategoryLabel(v: string): string {
  return PAYABLE_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

// Display statuses. Stored status is new/partial/paid; "overdue" is derived
// from the due date in the UI when the debt is not fully paid.
export const PAYABLE_STATUS = {
  new: { label: "Новая", color: "bg-muted text-muted-foreground border-border" },
  partial: { label: "Частично оплачена", color: "bg-warning/20 text-warning-foreground border-warning/40" },
  paid: { label: "Полностью оплачена", color: "bg-success/15 text-success border-success/30" },
  overdue: { label: "Просрочена", color: "bg-destructive/15 text-destructive border-destructive/30" },
} as const;

export type PayableDisplayStatus = keyof typeof PAYABLE_STATUS;

/** Derive the visible status, promoting unpaid past-due debts to "overdue". */
export function payableDisplayStatus(
  status: string,
  dueDate: string | null | undefined,
): PayableDisplayStatus {
  if (status === "paid") return "paid";
  if (dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) return "overdue";
  }
  return (status === "partial" ? "partial" : "new");
}

/** Whole days until the due date (negative when overdue). */
export function daysUntil(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// ============ RESETTLEMENT (Переселение / Реновация) module ============
export const RESETTLEMENT_STATUS = {
  negotiation:     { label: "Переговоры",        color: "bg-muted text-muted-foreground border-border" },
  agreed:          { label: "Согласовано",       color: "bg-warning/20 text-warning-foreground border-warning/40" },
  contract_signed: { label: "Договор подписан",  color: "bg-accent/15 text-accent border-accent/30" },
  resettled:       { label: "Переселён",         color: "bg-primary/15 text-primary border-primary/30" },
  completed:       { label: "Завершено",         color: "bg-success/15 text-success border-success/30" },
} as const;

export type ResettlementStatus = keyof typeof RESETTLEMENT_STATUS;

export function resettlementStatusLabel(s: string): string {
  return (RESETTLEMENT_STATUS as any)[s]?.label ?? s;
}

// ============ BARTER (Бартер / Имущество в счёт оплаты) module ============
export const BARTER_ASSET_TYPES = [
  { value: "car",        label: "Автомобиль" },
  { value: "land",       label: "Земельный участок" },
  { value: "house",      label: "Частный дом" },
  { value: "commercial", label: "Коммерческое помещение" },
  { value: "other",      label: "Другое имущество" },
] as const;

export type BarterAssetType = typeof BARTER_ASSET_TYPES[number]["value"];

export function barterAssetTypeLabel(v: string): string {
  return BARTER_ASSET_TYPES.find((a) => a.value === v)?.label ?? v;
}

export const BARTER_STATUS = {
  valuation:     { label: "На оценке",         color: "bg-muted text-muted-foreground border-border" },
  approved:      { label: "Одобрено",          color: "bg-success/15 text-success border-success/30" },
  awaiting_docs: { label: "Ожидает документов", color: "bg-warning/20 text-warning-foreground border-warning/40" },
  completed:     { label: "Завершено",         color: "bg-accent/15 text-accent border-accent/30" },
  cancelled:     { label: "Отменено",          color: "bg-destructive/15 text-destructive border-destructive/30" },
} as const;

export type BarterStatus = keyof typeof BARTER_STATUS;

export function barterStatusLabel(s: string): string {
  return (BARTER_STATUS as any)[s]?.label ?? s;
}

// Legacy fallback formatter (TJS only). Prefer usePrefs().formatMoney().
export function formatMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " сом.";
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

// Tariff billing period labels (ru) and helpers.
export const BILLING_PERIODS: Record<string, { label: string; short: string; days: number | null }> = {
  monthly:  { label: "Месячный",  short: "/мес",  days: 30 },
  yearly:   { label: "Годовой",   short: "/год",  days: 365 },
  one_time: { label: "Разовый",   short: "",      days: null },
  unlimited:{ label: "Бессрочный", short: "",      days: null },
};

export function billingPeriodLabel(period?: string | null): string {
  return BILLING_PERIODS[period ?? "one_time"]?.label ?? "Разовый";
}

export function billingPeriodShort(period?: string | null): string {
  return BILLING_PERIODS[period ?? "one_time"]?.short ?? "";
}

// Resolve how many days a subscription lasts based on the tariff's billing
// period. Monthly = 30, yearly = 365, one_time uses the explicit duration_days,
// and unlimited returns null (no expiry).
export function tariffDurationDays(tariff: { billing_period?: string | null; duration_days?: number | null }): number | null {
  const period = tariff.billing_period ?? (tariff.duration_days == null ? "unlimited" : "one_time");
  if (period === "unlimited") return null;
  if (period === "one_time") return tariff.duration_days ?? null;
  return BILLING_PERIODS[period]?.days ?? tariff.duration_days ?? null;
}
