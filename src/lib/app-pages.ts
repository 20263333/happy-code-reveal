import type { Department } from "@/hooks/use-auth";

export type AppPage = {
  url: string;
  label: string; // Tajik label (passed through tr())
  moduleKey?: string; // maps to companies.enabled_modules
  department: Department;
  group?: string; // optional grouping label override
  // When true, the page is NOT part of the department defaults — the owner
  // must grant it explicitly via "Доступ к страницам" (goes to extra_pages).
  actionOnly?: boolean;
};

// Stable keys used inside project/block pages for per-tab access control.
// They are gated at render time by computeAllowedPages() against
// profile.denied_pages / extra_pages.
export const PROJECT_TAB_KEYS = {
  apartments: "project:apartments",
  sales: "project:sales",
  payments: "project:payments",
  schedule: "project:schedule",
  budget: "project:budget",
  warehouse: "project:warehouse",
  estimate: "project:estimate",
  resettlement: "project:resettlement",
  barter: "project:barter",
  facade3d: "project:facade3d",
  distribution: "project:distribution",
  carDamages: "project:car-damages",
  access: "project:access",
  addFloor: "project:add-floor",
  addApartment: "project:add-apartment",
  requests: "project:requests",
  requestNew: "project:request-new",
} as const;

export const PROJECT_GROUP_LABEL = "Даруни блок (ЖК)";

// Sub-tab keys for other main pages (rendered as tabs inside those routes).
export const WAREHOUSE_TAB_KEYS = {
  stock: "warehouse:stock",
  in: "warehouse:in",
  out: "warehouse:out",
  delete: "warehouse:delete",
} as const;
export const WAREHOUSE_GROUP_LABEL = "Даруни Склад";

export const DASHBOARD_TAB_KEYS = {
  distribution: "dashboard:distribution",
} as const;
export const DASHBOARD_GROUP_LABEL = "Даруни Дашборд";

export const ATTENDANCE_TAB_KEYS = {
  table: "attendance:table",
  calc: "attendance:calc",
  payments: "attendance:payments",
} as const;
export const ATTENDANCE_GROUP_LABEL = "Даруни Табел";

export const PERMITS_TAB_KEYS = {
  permits: "permits:permits",
  acts: "permits:acts",
} as const;
export const PERMITS_GROUP_LABEL = "Даруни Иҷозатномаҳо";

export const QUALITY_TAB_KEYS = {
  checks: "quality:checks",
  incidents: "quality:incidents",
  materials: "quality:materials",
} as const;
export const QUALITY_GROUP_LABEL = "Даруни Сифат ва Бехатарӣ";

export const EQUIPMENT_TAB_KEYS = {
  list: "equipment:list",
  usage: "equipment:usage",
  maint: "equipment:maint",
} as const;
export const EQUIPMENT_GROUP_LABEL = "Даруни Техника";

export const EXPENSES_TAB_KEYS = {
  new: "expenses:new",
  delete: "expenses:delete",
} as const;
export const EXPENSES_GROUP_LABEL = "Даруни Расходҳо";

// Master list of all department pages available to be granted individually.
// URL is the stable key stored in profiles.extra_pages / denied_pages.
export const APP_PAGES: AppPage[] = [
  // Sales
  { url: "/dashboard", label: "Дашборд", department: "sales" },
  {
    url: DASHBOARD_TAB_KEYS.distribution,
    label: "💸 Тақсими даромад",
    department: "sales",
    group: DASHBOARD_GROUP_LABEL,
  },
  { url: "/projects", label: "Проектҳо", moduleKey: "projects", department: "sales" },
  { url: "/customers", label: "Клиентҳо", moduleKey: "customers", department: "sales" },
  { url: "/crm-funnel", label: "Воронка фурӯш", moduleKey: "crm-funnel", department: "sales" },
  { url: "/whatsapp", label: "WhatsApp", department: "sales" },
  { url: "/contracts", label: "Договор", moduleKey: "contracts", department: "sales" },
  { url: "/payments", label: "Платежи", moduleKey: "payments", department: "sales" },
  { url: "/debtors", label: "Должники", moduleKey: "debtors", department: "sales" },
  // Legal
  { url: "/permits", label: "Иҷозатномаҳо", moduleKey: "permits", department: "legal" },
  { url: "/tax-reports", label: "Ҳисоботи давлатӣ", moduleKey: "tax-reports", department: "legal" },
  // Accounting
  { url: "/expenses", label: "Расходы", moduleKey: "expenses", department: "accounting" },
  { url: "/warehouse", label: "Склад", moduleKey: "warehouse", department: "accounting" },
  { url: "/supply", label: "Снабженец", department: "accounting" },
  { url: "/payables", label: "Поставщики", moduleKey: "payables", department: "accounting" },
  { url: "/reports", label: "Отчёт ОПУ", moduleKey: "reports", department: "accounting" },
  { url: "/billing", label: "Тарифы и оплата", moduleKey: "billing", department: "accounting" },
  { url: "/ai-credits", label: "AI Кредитҳо", department: "accounting" },
  {
    url: "/scan-credits",
    label: "Скан Кредитҳо",
    moduleKey: "scan-credits",
    department: "accounting",
  },
  { url: "/cashier", label: "Кассир", moduleKey: "cashier", department: "accounting" },
  // Construction
  { url: "/attendance", label: "Табел", moduleKey: "attendance", department: "construction" },
  {
    url: "/subcontractors",
    label: "Пудратчиён",
    moduleKey: "subcontractors",
    department: "construction",
  },
  { url: "/equipment", label: "Техника", moduleKey: "equipment", department: "construction" },
  { url: "/quality", label: "Сифат ва Бехатарӣ", moduleKey: "quality", department: "construction" },
  { url: "/gantt", label: "График Gantt", moduleKey: "gantt", department: "construction" },
  // HR
  { url: "/staff", label: "Сотрудникҳо", moduleKey: "staff", department: "hr" },
  { url: "/directors", label: "Директорҳо", department: "hr" },
  { url: "/settings", label: "Настройки", moduleKey: "settings", department: "hr" },
  // Project block sub-tabs — rendered inside /projects/$id (block view).
  {
    url: PROJECT_TAB_KEYS.apartments,
    label: "Квартираҳо",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.sales,
    label: "Фурӯшҳо",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.payments,
    label: "Пардохтҳо",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.schedule,
    label: "📊 График",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.budget,
    label: "💰 Буджет",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.warehouse,
    label: "Склад (блок)",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.estimate,
    label: "Смета",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.resettlement,
    label: "Переселение",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.barter,
    label: "Бартер",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.facade3d,
    label: "🏢 3D фасад",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.distribution,
    label: "💸 Тақсими даромад",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.carDamages,
    label: "🚗 Зарари мошин",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.access,
    label: "Доступ",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.addFloor,
    label: "Илова кардани этаж",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.addApartment,
    label: "Илова кардани квартира",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.requests,
    label: "📝 Заявка",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  {
    url: PROJECT_TAB_KEYS.requestNew,
    label: "Заявкаи нав",
    department: "sales",
    group: PROJECT_GROUP_LABEL,
  },
  // Warehouse sub-tabs
  {
    url: WAREHOUSE_TAB_KEYS.stock,
    label: "Склад (остатки)",
    department: "accounting",
    group: WAREHOUSE_GROUP_LABEL,
  },
  {
    url: WAREHOUSE_TAB_KEYS.in,
    label: "Приход",
    department: "accounting",
    group: WAREHOUSE_GROUP_LABEL,
  },
  {
    url: WAREHOUSE_TAB_KEYS.out,
    label: "Расход",
    department: "accounting",
    group: WAREHOUSE_GROUP_LABEL,
  },
  {
    url: WAREHOUSE_TAB_KEYS.delete,
    label: "🗑 Нест кардан (Склад)",
    department: "accounting",
    group: WAREHOUSE_GROUP_LABEL,
    actionOnly: true,
  },
  // Attendance sub-tabs
  {
    url: ATTENDANCE_TAB_KEYS.table,
    label: "Табел",
    department: "construction",
    group: ATTENDANCE_GROUP_LABEL,
  },
  {
    url: ATTENDANCE_TAB_KEYS.calc,
    label: "Ҳисоб-китоб",
    department: "construction",
    group: ATTENDANCE_GROUP_LABEL,
  },
  {
    url: ATTENDANCE_TAB_KEYS.payments,
    label: "Пардохтҳо",
    department: "construction",
    group: ATTENDANCE_GROUP_LABEL,
  },
  // Permits sub-tabs
  {
    url: PERMITS_TAB_KEYS.permits,
    label: "Иҷозатномаҳо",
    department: "legal",
    group: PERMITS_GROUP_LABEL,
  },
  {
    url: PERMITS_TAB_KEYS.acts,
    label: "Актҳои пинҳонӣ",
    department: "legal",
    group: PERMITS_GROUP_LABEL,
  },
  // Quality sub-tabs
  {
    url: QUALITY_TAB_KEYS.checks,
    label: "Санҷиши сифат",
    department: "construction",
    group: QUALITY_GROUP_LABEL,
  },
  {
    url: QUALITY_TAB_KEYS.incidents,
    label: "Ҳодисаҳо / Бехатарӣ",
    department: "construction",
    group: QUALITY_GROUP_LABEL,
  },
  {
    url: QUALITY_TAB_KEYS.materials,
    label: "Акти қабули мавод",
    department: "construction",
    group: QUALITY_GROUP_LABEL,
  },
  // Equipment sub-tabs
  {
    url: EQUIPMENT_TAB_KEYS.list,
    label: "Рӯйхати техника",
    department: "construction",
    group: EQUIPMENT_GROUP_LABEL,
  },
  {
    url: EQUIPMENT_TAB_KEYS.usage,
    label: "Истифодабарӣ",
    department: "construction",
    group: EQUIPMENT_GROUP_LABEL,
  },
  {
    url: EQUIPMENT_TAB_KEYS.maint,
    label: "Таъмир",
    department: "construction",
    group: EQUIPMENT_GROUP_LABEL,
  },
  // Expenses sub-actions
  {
    url: EXPENSES_TAB_KEYS.new,
    label: "Новый расход",
    department: "accounting",
    group: EXPENSES_GROUP_LABEL,
  },
  {
    url: EXPENSES_TAB_KEYS.delete,
    label: "Нест кардани расход",
    department: "accounting",
    group: EXPENSES_GROUP_LABEL,
  },
];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  sales: "Шуъбаи Фурӯш",
  legal: "Шуъбаи Ҳуқуқӣ",
  accounting: "Шуъбаи Муҳосибот",
  construction: "Шуъбаи Назорати Сохтмон",
  hr: "Шуъбаи Кадр",
};

// Default pages a user in a given department gets automatically.
export function defaultPagesForDepartment(dept: Department): string[] {
  return APP_PAGES.filter((p) => p.department === dept && !p.actionOnly).map((p) => p.url);
}

// Compute the effective set of URLs a staff user can access, given their
// department, per-user extras (add) and denies (remove).
export function computeAllowedPages(
  department: Department | null,
  extra: string[] = [],
  denied: string[] = [],
): Set<string> {
  const base = department ? defaultPagesForDepartment(department) : [];
  const set = new Set<string>(base);
  for (const u of extra) set.add(u);
  for (const u of denied) set.delete(u);
  return set;
}
