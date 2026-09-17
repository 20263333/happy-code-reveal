// Shared financial helpers for the P&L (ОПУ) report and dashboard.
//
// Expense groups for the company-wide P&L. Every expense/payable category is
// classified into exactly one group so the net profit always equals
// revenue − (cogs + salary + taxes + opex).

// 1) Cost of goods sold (себестоимость) — production/construction materials & works.
export const COGS_CATEGORIES = ["cement", "materials", "equipment", "contractors"] as const;
// 2) Payroll (зарплата сотрудников).
export const SALARY_CATEGORIES = ["salary"] as const;
// 3) Taxes & state/authority payments (налоги и госорганы).
export const TAX_CATEGORIES = ["taxes"] as const;
// 4) Internal / operating expenses (внутренние расходы офиса): rent, transport,
//    utilities, other — and anything that does not match the groups above.
export const OPEX_CATEGORIES = ["transport", "rent", "utilities", "other"] as const;

export type ExpenseGroup = "cogs" | "salary" | "taxes" | "opex";

/** Classify a single category into one of the four P&L groups. */
export function expenseGroup(category: string | null | undefined): ExpenseGroup {
  const c = category ?? "other";
  if ((COGS_CATEGORIES as readonly string[]).includes(c)) return "cogs";
  if ((SALARY_CATEGORIES as readonly string[]).includes(c)) return "salary";
  if ((TAX_CATEGORIES as readonly string[]).includes(c)) return "taxes";
  return "opex";
}

export type ExpenseRow = { amount: number | string; category: string | null; expense_date?: string | null; created_at?: string | null };
export type SaleRow = { full_price: number | string; remaining_amount: number | string; created_at?: string | null };
export type PaymentRow = { amount: number | string; payment_date?: string | null; status?: string | null };
export type WagesRow = { paid_amount: number | string; paid_date?: string | null; period_to?: string | null; created_at?: string | null };
export type PayableRow = { total_amount: number | string; paid_amount: number | string; category: string | null; created_at?: string | null; due_date?: string | null };


export interface OpuResult {
  revenue: number;          // Выручка
  cogs: number;             // Себестоимость
  grossProfit: number;      // Валовая прибыль = revenue − cogs
  salary: number;           // Зарплата сотрудников
  taxes: number;            // Налоги и госрасходы
  opex: number;             // Внутренние / операционные расходы
  totalExpenses: number;    // cogs + salary + taxes + opex
  netProfit: number;        // Чистая прибыль = grossProfit − salary − taxes − opex
  margin: number;           // Рентабельность %
  paymentsReceived: number; // Поступившие платежи
  receivables: number;      // Дебиторская задолженность
  payables: number;         // Кредиторская задолженность
  byCategory: { category: string; amount: number }[];
}

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function inRange(dateStr: string | null | undefined, from: Date | null, to: Date | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function computeOpu(
  sales: SaleRow[],
  expenses: ExpenseRow[],
  payments: PaymentRow[],
  payables: PayableRow[] = [],
  wages: WagesRow[] = [],
): OpuResult {
  const revenue = sales.reduce((s, x) => s + num(x.full_price), 0);
  const receivables = sales.reduce((s, x) => s + num(x.remaining_amount), 0);

  const byCatMap = new Map<string, number>();
  let cogs = 0;
  let salary = 0;
  let taxes = 0;
  let opex = 0;
  const recognize = (amt: number, cat: string) => {
    byCatMap.set(cat, (byCatMap.get(cat) ?? 0) + amt);
    switch (expenseGroup(cat)) {
      case "cogs": cogs += amt; break;
      case "salary": salary += amt; break;
      case "taxes": taxes += amt; break;
      default: opex += amt; break;
    }
  };
  // Себестоимость и прочие расходы берутся ТОЛЬКО из реальных расходов
  // (страница «Расходы») по всем проектам — это фактические затраты на
  // материалы/работы. Кредиторская задолженность (payables) — это долги
  // поставщикам, они показываются отдельно и НЕ входят в себестоимость,
  // чтобы не задваивать суммы.
  for (const e of expenses) recognize(num(e.amount), e.category ?? "other");

  // Маоши коргарон (worker_payments) — гурӯҳи «salary». Дар expenses ин суммаҳо
  // такрор намешаванд, барои ҳамин алоҳида илова карда мешавад.
  const wagesTotal = wages.reduce((s, w) => s + num(w.paid_amount), 0);
  if (wagesTotal > 0) recognize(wagesTotal, "salary");

  const grossProfit = revenue - cogs;
  const totalExpenses = cogs + salary + taxes + opex;
  const netProfit = revenue - totalExpenses;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const paymentsReceived = payments
    .filter((p) => (p.status ?? "confirmed") === "confirmed")
    .reduce((s, x) => s + num(x.amount), 0);

  // Payables (кредиторская задолженность): outstanding amount still owed.
  const payablesOutstanding = payables.reduce(
    (s, x) => s + Math.max(num(x.total_amount) - num(x.paid_amount), 0),
    0,
  );

  return {
    revenue, cogs, grossProfit, salary, taxes, opex, totalExpenses, netProfit, margin,
    paymentsReceived, receivables, payables: payablesOutstanding,
    byCategory: Array.from(byCatMap.entries()).map(([category, amount]) => ({ category, amount })),
  };
}


// Date range presets for the report filters.
export type RangePreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

export function presetRange(preset: RangePreset): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  switch (preset) {
    case "today": break;
    case "week": from.setDate(from.getDate() - 6); break;
    case "month": from.setDate(1); break;
    case "quarter": {
      const q = Math.floor(from.getMonth() / 3);
      from.setMonth(q * 3, 1);
      break;
    }
    case "year": from.setMonth(0, 1); break;
    default: break;
  }
  return { from, to };
}
