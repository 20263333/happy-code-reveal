import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";
import { StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCompanyInstallments, type InstallmentDashboardRow } from "@/lib/installments.functions";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";

type MonthGroup = {
  key: string;
  label: string;
  total: number;
  paidTotal: number;
  items: { id: string; name: string; phone: string | null; due: string; left: number; amount: number; paid: boolean }[];
};

const MONTHS_TG = [
  "Январ", "Феврал", "Март", "Апрел", "Май", "Июн",
  "Июл", "Август", "Сентябр", "Октябр", "Ноябр", "Декабр",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function InstallmentsCard({
  companyId,
  projectIds,
  isPlatformAdmin,
}: {
  companyId: string | null | undefined;
  projectIds: Set<string> | null;
  isPlatformAdmin?: boolean;
}) {
  const { formatMoney } = usePrefs();
  const { tr } = useT();
  const getInstallments = useServerFn(getCompanyInstallments);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const enabled = !!companyId || !!isPlatformAdmin;


  const { data: rows = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-installments", companyId, isPlatformAdmin],
    enabled,
    queryFn: () => getInstallments({}),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });


  const scoped = useMemo(
    () =>
      (rows as InstallmentDashboardRow[]).filter((r) => {
        const pid = r.sales?.project_id ?? null;
        if (projectIds) return !!pid && projectIds.has(pid);
        return true;
      }),
    [rows, projectIds],
  );

  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const r of scoped) {
      const d = new Date(r.due_date);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      let g = map.get(key);
      if (!g) {
        g = { key, label: `${MONTHS_TG[d.getMonth()]} ${d.getFullYear()}`, total: 0, paidTotal: 0, items: [] };
        map.set(key, g);
      }
      const amount = Number(r.amount || 0);
      const paidAmt = Number(r.paid_amount || 0);
      const left = amount - paidAmt;
      // Тафовути хурд (то 1 сомонӣ) аз мудаввар кардан — пардохтшуда ҳисоб мешавад
      const paid = left <= 1;
      g.total += Math.max(left, 0);
      g.paidTotal += paidAmt;
      g.items.push({
        id: r.id,
        name: r.sales?.customers?.fullname ?? tr("Номаълум"),
        phone: r.sales?.customers?.phone ?? null,
        due: r.due_date,
        left: Math.max(left, 0),
        amount,
        paid,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [scoped, tr]);

  const today = new Date();
  const todayKey = monthKey(today);
  // Show the upcoming month by default (next month from today) — matches the user's expectation of seeing September when it is August.
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthKey = monthKey(nextMonth);

  const highlightedMonth = useMemo(() => {
    if (groups.length === 0) return nextMonthKey;
    const upcoming = groups.find((g) => g.key >= todayKey);
    return upcoming?.key ?? nextMonthKey;
  }, [groups, todayKey, nextMonthKey]);

  const current = groups.find((g) => g.key === highlightedMonth);
  const currentTotal = current?.total ?? 0;
  const currentCount = current?.items.filter((i) => !i.paid).length ?? 0;
  const currentPaidCount = current?.items.filter((i) => i.paid).length ?? 0;
  const currentMonthLabel = useMemo(() => {
    const d = current ? new Date(`${current.key}-01`) : nextMonth;
    return `${tr("Расрочкаи")} ${MONTHS_TG[d.getMonth()]} ${d.getFullYear()}`;
  }, [current, nextMonth, tr]);



  return (
    <>
      <button type="button" className="w-full text-left" onClick={() => setOpen(true)}>
        <StatCard
          label={currentMonthLabel}
          value={isLoading ? "…" : formatMoney(currentTotal)}
          icon={CalendarClock}
          accent="accent"
          trend={currentPaidCount > 0
            ? `${currentCount} ${tr("карздор")} · ${currentPaidCount} ${tr("пардохт кард")}`
            : `${currentCount} ${tr("клиент")}`}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("Пули расрочка аз рӯи моҳҳо")}</DialogTitle>
          </DialogHeader>
          {groups.length === 0 ? (
            isError ? (
              <div className="space-y-3 text-sm text-destructive">
                <p>{tr("Хатогӣ ҳангоми боркунӣ")}: {(error as Error)?.message}</p>
                <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
                  {isFetching ? "…" : tr("Аз нав кӯшиш кардан")}
                </Button>
              </div>
            ) : <p className="text-sm text-muted-foreground">{tr("Маълумот нест")}</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const isOpen = expanded === g.key;
                return (
                  <div key={g.key} className="rounded-xl border border-border">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 p-3 text-sm ${g.key === highlightedMonth ? "bg-primary/5" : ""}`}
                      onClick={() => setExpanded(isOpen ? null : g.key)}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {g.label}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{g.items.length} {tr("клиент")}</span>
                        <span className="font-semibold tabular-nums">{formatMoney(g.total)}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border">
                        {g.items
                          .slice()
                          .sort((a, b) => Number(a.paid) - Number(b.paid) || a.due.localeCompare(b.due))
                          .map((it) => (
                            <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm border-b border-border/50 last:border-0">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{it.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(it.due).toLocaleDateString("ru-RU")}
                                  {it.phone ? ` · ${it.phone}` : ""}
                                </div>
                              </div>
                              {it.paid ? (
                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
                                  ✓ {tr("пардохт кард")} · {formatMoney(it.amount)}
                                </span>
                              ) : (
                                <span className="tabular-nums font-medium">{formatMoney(it.left)}</span>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
