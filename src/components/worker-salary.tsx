import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";

export type SalarySummary = { accrued: number; paid: number; balance: number };

/** Accrue any missing monthly salary rows, then read accrued/paid/balance per worker. */
export function useSalarySummaries(companyId: string | null) {
  return useQuery({
    queryKey: ["salary-summary", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return {} as Record<string, SalarySummary>;
      await supabase.rpc("accrue_worker_salaries", { _company_id: companyId });
      const { data, error } = await supabase.rpc("worker_salary_summary", { _company_id: companyId });
      if (error) throw error;
      const map: Record<string, SalarySummary> = {};
      for (const r of (data ?? []) as any[]) {
        map[r.worker_id] = {
          accrued: Number(r.accrued ?? 0),
          paid: Number(r.paid ?? 0),
          balance: Number(r.balance ?? 0),
        };
      }
      return map;
    },
  });
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function periodLabel(period: string) {
  const d = new Date(period);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Accruals + salary payouts of one worker, newest first. */
export function useSalaryHistory(workerId: string | null) {
  return useQuery({
    queryKey: ["salary-history", workerId],
    enabled: !!workerId,
    queryFn: async () => {
      if (!workerId) return [];
      const [{ data: accruals }, { data: payouts }] = await Promise.all([
        supabase.from("salary_accruals").select("id, period, amount, created_at").eq("worker_id", workerId),
        supabase
          .from("expenses")
          .select("id, amount, description, expense_date, created_at")
          .eq("worker_id", workerId)
          .eq("category", "salary"),
      ]);
      const rows = [
        ...(accruals ?? []).map((a: any) => ({
          id: `a-${a.id}`,
          date: a.period,
          kind: "accrual" as const,
          period: a.period as string,
          amount: Number(a.amount),
          note: null as string | null,
        })),
        ...(payouts ?? []).map((p: any) => ({
          id: `p-${p.id}`,
          date: p.expense_date ?? p.created_at,
          kind: "payout" as const,
          period: p.expense_date ?? p.created_at,
          amount: -Number(p.amount),
          note: (p.description ?? null) as string | null,
        })),
      ];
      return rows.sort((x, y) => (x.date < y.date ? 1 : -1));
    },
  });
}

export function SalaryBalanceBox({ workerId, summary }: { workerId: string; summary?: SalarySummary }) {
  const { tr } = useT();
  const { formatMoney } = usePrefs();
  const { data: history = [] } = useSalaryHistory(workerId);
  const s = summary ?? { accrued: 0, paid: 0, balance: 0 };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <p className="text-[11px] text-muted-foreground">{tr("Всего начислено")}</p>
          <p className="text-sm font-semibold">{formatMoney(s.accrued)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <p className="text-[11px] text-muted-foreground">{tr("Всего выплачено")}</p>
          <p className="text-sm font-semibold">{formatMoney(s.paid)}</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
          <p className="text-[11px] text-muted-foreground">{tr("Доступно к выплате")}</p>
          <p className="text-sm font-semibold text-primary">{formatMoney(s.balance)}</p>
        </div>
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left">{tr("Дата")}</th>
              <th className="px-2 py-1.5 text-left">{tr("Операция")}</th>
              <th className="px-2 py-1.5 text-left">{tr("Период")}</th>
              <th className="px-2 py-1.5 text-right">{tr("Сумма")}</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">{tr("Нет данных")}</td></tr>
            ) : history.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-2 py-1.5 text-muted-foreground">{formatDate(r.date)}</td>
                <td className="px-2 py-1.5">
                  {r.kind === "accrual" ? tr("Начисление зарплаты") : (r.note || tr("Зарплата"))}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{periodLabel(r.period)}</td>
                <td className={`px-2 py-1.5 text-right font-semibold ${r.amount >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {r.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(r.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
