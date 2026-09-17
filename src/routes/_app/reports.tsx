import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, Printer, TrendingUp, TrendingDown,
  Wallet, Receipt, Percent, Banknote, ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";
import { EXPENSE_CATEGORIES, payableCategoryLabel } from "@/lib/constants";
import { computeOpu, inRange, presetRange, type RangePreset } from "@/lib/finance";
import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { getStableSession, hasSavedSessionData } from "@/lib/auth-session";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Отчёт ОПУ — Binosoz.tj" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await getStableSession();
    if (!session) {
      if (!hasSavedSessionData()) throw redirect({ to: "/auth" });
      return; // transient — let the parent _app layout handle it
    }
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", session.user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    if (!list.includes("owner") && !list.includes("accountant")) {
      throw redirect({ to: "/projects" });
    }
  },
  component: ReportsPage,
});

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
  { value: "custom", label: "Период" },
];

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


function ReportsPage() {
  const { formatMoney } = usePrefs();
  const { t, tr } = useT();
  const catLabel = (value: string) => {
    const c = EXPENSE_CATEGORIES.find((x) => x.value === value);
    return c ? t(c.labelKey) : tr(payableCategoryLabel(value));
  };

  const [preset, setPreset] = useState<RangePreset>("month");
  const initial = presetRange("month");
  const [from, setFrom] = useState(toInput(initial.from));
  const [to, setTo] = useState(toInput(initial.to));

  const applyPreset = (p: RangePreset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(toInput(r.from));
      setTo(toInput(r.to));
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["opu-data"],
    queryFn: async () => {
      const [sales, expenses, payments, payables, wages] = await Promise.all([
        supabase.from("sales").select("full_price, remaining_amount, created_at"),
        supabase.from("expenses").select("amount, category, created_at, expense_date"),
        supabase.from("payments").select("amount, payment_date, status").eq("status", "confirmed"),
        (supabase as any).from("payables").select("total_amount, paid_amount, category, created_at, due_date").eq("archived", false),
        (supabase as any).from("worker_payments").select("paid_amount, paid_date, period_to, created_at"),
      ]);
      return {
        sales: sales.data ?? [],
        expenses: expenses.data ?? [],
        payments: payments.data ?? [],
        payables: payables.data ?? [],
        wages: wages.data ?? [],
      };
    },
  });

  const fromDate = useMemo(() => { const d = new Date(from); d.setHours(0, 0, 0, 0); return d; }, [from]);
  const toDate = useMemo(() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; }, [to]);

  const opu = useMemo(() => {
    if (!data) return null;
    const sales = data.sales.filter((s: any) => inRange(s.created_at, fromDate, toDate));
    const expenses = data.expenses.filter((e: any) => inRange(e.expense_date ?? e.created_at, fromDate, toDate));
    const payments = data.payments.filter((p: any) => inRange(p.payment_date, fromDate, toDate));
    const payables = data.payables.filter((p: any) => inRange(p.created_at, fromDate, toDate));
    const wages = data.wages.filter((w: any) => inRange(w.paid_date ?? w.period_to ?? w.created_at, fromDate, toDate));
    const result = computeOpu(sales as any, expenses as any, payments as any, payables as any, wages as any);
    const receivables = sales.reduce((s: number, x: any) => s + (Number(x.remaining_amount) || 0), 0);
    const payablesOutstanding = payables.reduce(
      (s: number, x: any) => s + Math.max((Number(x.total_amount) || 0) - (Number(x.paid_amount) || 0), 0), 0,
    );
    return { ...result, receivables, payables: payablesOutstanding };
  }, [data, fromDate, toDate]);

  const rows = useMemo(() => {
    if (!opu) return [];
    return [
      { label: "Выручка", value: opu.revenue },
      { label: "Себестоимость", value: -opu.cogs },
      { label: "Валовая прибыль", value: opu.grossProfit, bold: true },
      { label: "Зарплата сотрудников", value: -opu.salary },
      { label: "Налоги и госрасходы", value: -opu.taxes },
      { label: "Внутренние расходы", value: -opu.opex },
      { label: "Чистая прибыль", value: opu.netProfit, bold: true },
    ];
  }, [opu]);

  const periodLabel = `${from} — ${to}`;
  const maxCat = useMemo(() => Math.max(1, ...(opu?.byCategory ?? []).map((c) => c.amount)), [opu]);

  const company = useCompanyHeader();
  const handlePrint = () => {
    if (!opu) return;
    const rowsHtml = rows.map((r) => `
      <tr${r.bold ? ' style="font-weight:bold;background:#fafafa"' : ""}>
        <td>${esc(tr(r.label))}</td>
        <td class="num">${esc(formatMoney(r.value))}</td>
      </tr>`).join("");
    const catHtml = (opu.byCategory ?? []).length
      ? `<h2 style="margin-top:20px">${esc(tr("Расходы по категориям"))}</h2>
         <table><thead><tr><th>${esc(tr("Категория"))}</th><th class="num">${esc(tr("Сумма"))}</th></tr></thead>
         <tbody>${(opu.byCategory ?? []).map((c) => `<tr><td>${esc(catLabel(c.category))}</td><td class="num">${esc(formatMoney(c.amount))}</td></tr>`).join("")}</tbody></table>`
      : "";
    const content = `
      <h1>${esc(tr("Отчёт о прибылях и убытках"))}</h1>
      <h2>${esc(periodLabel)}</h2>
      <table>
        <thead><tr><th>${esc(tr("Показатель"))}</th><th class="num">${esc(tr("Сумма"))}</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${catHtml}`;
    if (!openPrintWindow({ title: tr("Отчёт ОПУ"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={tr("Отчёт ОПУ")} subtitle={tr("Отчёт о прибылях и убытках — формируется автоматически")} />

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.value} size="sm" variant={preset === p.value ? "default" : "outline"} onClick={() => applyPreset(p.value)}>
              {tr(p.label)}
            </Button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs">{tr("С")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">{tr("По")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">{periodLabel}</Badge>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!opu}><Printer className="h-4 w-4" />{tr("Печать")}</Button>
          </div>
        </div>
      </div>

      {isLoading || !opu ? (
        <EmptyState icon={FileText} title={tr("Загрузка данных…")} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label={tr("Выручка")} value={formatMoney(opu.revenue)} icon={Wallet} accent="primary" />
            <Kpi label={tr("Валовая прибыль")} value={formatMoney(opu.grossProfit)} icon={ArrowUpRight} accent={opu.grossProfit >= 0 ? "success" : "destructive"} />
            <Kpi
              label={tr("Чистая прибыль")} value={formatMoney(opu.netProfit)}
              icon={opu.netProfit >= 0 ? TrendingUp : TrendingDown}
              accent={opu.netProfit >= 0 ? "success" : "destructive"}
            />
            <Kpi label={tr("Рентабельность")} value={`${opu.margin.toFixed(1)}%`} icon={Percent} accent={opu.margin >= 0 ? "success" : "destructive"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* P&L statement */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <h3 className="font-display text-lg font-semibold">{tr("Отчёт о прибылях и убытках")}</h3>
              </div>
              <table className="mt-5 w-full text-sm">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-border/60 last:border-0">
                      <td className={`py-3 ${r.bold ? "font-semibold" : "text-muted-foreground"}`}>{tr(r.label)}</td>
                      <td className={`py-3 text-right tabular-nums ${r.bold ? "font-semibold" : ""} ${r.value < 0 ? "text-destructive" : ""}`}>
                        {formatMoney(r.value)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border">
                    <td className="py-3 font-semibold">{tr("Рентабельность")}</td>
                    <td className={`py-3 text-right font-semibold tabular-nums ${opu.margin < 0 ? "text-destructive" : "text-success"}`}>
                      {opu.margin.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Side: debts + payments */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-3">
                <h3 className="font-display text-lg font-semibold">{tr("Задолженности и платежи")}</h3>
                <SideRow icon={Banknote} label={tr("Поступившие платежи")} value={formatMoney(opu.paymentsReceived)} accent="success" />
                <SideRow icon={ArrowUpRight} label={tr("Дебиторская задолженность")} value={formatMoney(opu.receivables)} accent="primary" />
                <SideRow icon={ArrowDownRight} label={tr("Кредиторская задолженность")} value={formatMoney(opu.payables)} accent="destructive" />
              </div>
            </div>
          </div>

          {/* Expense categories with bars */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
              <h3 className="font-display text-lg font-semibold">{tr("Расходы по категориям")}</h3>
            </div>
            {opu.byCategory.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{tr("Нет данных за период.")}</p>
            ) : (
              <div className="mt-5 space-y-3">
                {[...opu.byCategory].sort((a, b) => b.amount - a.amount).map((c) => (
                  <div key={c.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{catLabel(c.category)}</span>
                      <span className="font-medium tabular-nums">{formatMoney(c.amount)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "success" | "destructive";
}) {
  const tone = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SideRow({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string;
  accent: "primary" | "success" | "destructive";
}) {
  const tone = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-sm">{value}</span>
    </div>
  );
}
