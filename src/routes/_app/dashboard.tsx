import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Users, Wallet, HandCoins, Receipt, Boxes, TrendingUp, PieChart, Car, Plus, CalendarClock, RefreshCw, Landmark } from "lucide-react";
import { getCompanyDistributionSummary, payPartnerCompany, syncCompanyPartners } from "@/lib/distribution.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/page-header";
import { DashboardMetrics, DashboardViewSwitcher, useDashboardView, type DashboardMetric } from "@/components/dashboard-views";
import { InstallmentsCard } from "@/components/installments-card";
import { MortgageCard } from "@/components/mortgage-card";

import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/preferences";
import { NewExpenseDialog } from "@/routes/_app/expenses";
import { useTabGate } from "@/lib/use-tab-gate";
import { EXPENSES_TAB_KEYS, DASHBOARD_TAB_KEYS, DEPARTMENT_LABEL } from "@/lib/app-pages";
import { usePeriodFilter } from "@/components/period-filter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZhkBlockFilter, useZhkBlockFilter, type ZhkBlockValue, type ZhkBlockProject } from "@/components/zhk-block-filter";
import type { Department } from "@/hooks/use-auth";
import { getDashboardStats } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Дашборд — PLATFORM.TJ" },
      { name: "description", content: "Нишондиҳандаҳои зиндаи фурӯш, пардохт, хароҷот ва сохтмон." },
      { property: "og:title", content: "Дашборд — PLATFORM.TJ" },
      { property: "og:description", content: "Нишондиҳандаҳои зиндаи фурӯш, пардохт, хароҷот ва сохтмон." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

type DeptFilter = "all" | Department;

const DEPT_SECTIONS: Record<DeptFilter, {
  sales: boolean; customers: boolean; apartments: boolean;
  revenue: boolean; payments: boolean; expenses: boolean;
  debt: boolean; warehouse: boolean; workers: boolean;
  projects: boolean;
}> = {
  all:          { sales: true, customers: true, apartments: true, revenue: true, payments: true, expenses: true, debt: true, warehouse: true, workers: true, projects: true },
  sales:        { sales: true, customers: true, apartments: true, revenue: true, payments: true, expenses: false, debt: true, warehouse: false, workers: false, projects: true },
  legal:        { sales: false, customers: true, apartments: false, revenue: false, payments: false, expenses: false, debt: false, warehouse: false, workers: false, projects: true },
  accounting:   { sales: false, customers: false, apartments: false, revenue: true, payments: true, expenses: true, debt: true, warehouse: true, workers: false, projects: false },
  construction: { sales: false, customers: false, apartments: true, revenue: false, payments: false, expenses: true, debt: false, warehouse: true, workers: true, projects: true },
  hr:           { sales: false, customers: false, apartments: false, revenue: false, payments: false, expenses: false, debt: false, warehouse: false, workers: true, projects: false },
};

function DashboardPage() {
  const { companyId, isOwner, isPlatformAdmin, isDirector } = useAuth();
  const { t, tr } = useT();
  const { formatMoney } = usePrefs();
  const period = usePeriodFilter("month");
  const tabOk = useTabGate();
  const canManageExpense = !isDirector && (isOwner || isPlatformAdmin || tabOk(EXPENSES_TAB_KEYS.new));
  // Кисмати «Тақсими даромад»: соҳиб онро дар «Доступ к страницам» мекушояд;
  // директорҳо (шарикони лоиҳа/фурӯш) онро ҳамеша мебинанд;
  // тугмаҳои Пардохт/Синхронизатсия фақат барои соҳиб/админ.
  const canSeeDistribution = isDirector || tabOk(DASHBOARD_TAB_KEYS.distribution);
  const canManageDistribution = isOwner || isPlatformAdmin;
  const [dept, setDept] = useState<DeptFilter>("all");
  const [zhkFilter, setZhkFilter] = useState<ZhkBlockValue>({ zhkId: "", blockId: "" });
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [payNote, setPayNote] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const getStats = useServerFn(getDashboardStats);
  

  const payM = useMutation({
    mutationFn: (v: { director_user_id: string; amount: number; note: string }) =>
      payPartnerCompany({ data: { director_user_id: v.director_user_id, amount: v.amount, note: v.note || null } }),
    onSuccess: () => {
      toast.success("Пардохт сабт шуд");
      setPayOpen(null);
      setPayAmount("");
      setPayNote("");
      qc.invalidateQueries({ queryKey: ["dashboard-distribution"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const { data: projectsList = [] } = useQuery({
    queryKey: ["dashboard-projects", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, parent_id")
        .eq("company_id", companyId!)
        .order("name");
      return (data ?? []) as ZhkBlockProject[];
    },
  });

  const projectIdsFilter = useZhkBlockFilter(projectsList, zhkFilter);

  const fromIso = period.fromDate?.toISOString() ?? null;
  const toIso = period.toDate?.toISOString() ?? null;
  const scopeKey = projectIdsFilter ? Array.from(projectIdsFilter).sort().join(",") : "all";

  const { data: stats, isError, error, isFetching: statsFetching, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-stats", companyId, fromIso, toIso, scopeKey],
    enabled: !!companyId,
    queryFn: () => getStats({ data: {
      project_ids: projectIdsFilter ? Array.from(projectIdsFilter) : null,
      from_date: period.active && period.fromDate ? period.fromDate.toISOString().slice(0, 10) : null,
      to_date: period.active && period.toDate ? period.toDate.toISOString().slice(0, 10) : null,
    } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // Тақсими даромад — аз рӯи филтри ЖК/Блок
  const { data: dist } = useQuery({
    queryKey: ["dashboard-distribution", companyId, scopeKey],
    enabled: !!companyId,
    queryFn: () =>
      getCompanyDistributionSummary({
        data: projectIdsFilter ? { project_ids: Array.from(projectIdsFilter) } : {},
      }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });


  // Бартер: бо чанд мошин бартер кардаем
  const { data: barter } = useQuery({
    queryKey: ["dashboard-barter", companyId, scopeKey],
    enabled: !!companyId,
    queryFn: async () => {
      let q: any = supabase
        .from("barter_deals")
        .select("id, asset_type, estimated_value, project_id")
        .eq("company_id", companyId!)
        .limit(5000);
      const { data } = await q;
      let rows = (data ?? []) as any[];
      if (projectIdsFilter) rows = rows.filter((r) => r.project_id && projectIdsFilter.has(r.project_id));
      const cars = rows.filter((r) => r.asset_type === "car");
      return {
        cars: cars.length,
        total: rows.length,
        value: cars.reduce((s, r) => s + Number(r.estimated_value || 0), 0),
      };
    },
  });

  const show = useMemo(() => DEPT_SECTIONS[dept], [dept]);
  const periodLabel = period.active ? period.label : tr("Тамоми давра");
  const { mode: viewMode, setMode: setViewMode } = useDashboardView(companyId);

  const metrics = useMemo<DashboardMetric[]>(() => {
    const list: DashboardMetric[] = [];
    if (show.projects) list.push({ key: "projects", label: tr("Проектҳо"), value: stats?.projects ?? "…", raw: stats?.projects, icon: Building2, to: "/projects" });
    if (show.customers) list.push({ key: "customers", label: tr("Клиентҳо"), value: stats?.customers ?? "…", raw: stats?.customers, icon: Users, to: "/customers" });
    if (show.apartments) {
      list.push({ key: "sold", label: tr("Продано квартир"), value: stats?.sold ?? "…", raw: stats?.sold, icon: TrendingUp, accent: "accent", to: "/projects" });
      list.push({ key: "available", label: tr("Свободных квартир"), value: stats?.available ?? "…", raw: stats?.available, icon: TrendingUp, accent: "success", to: "/projects" });
    }
    if (show.revenue) list.push({ key: "revenue", label: tr("Даромад"), value: stats ? formatMoney(stats.revenue) : "…", raw: stats?.revenue, money: true, icon: Wallet, accent: "success", to: "/payments" });
    if (show.payments) list.push({ key: "payments", label: tr("Пардохтҳо"), value: stats ? formatMoney(stats.paymentsSum) : "…", raw: stats?.paymentsSum, money: true, icon: Wallet, accent: "success", to: "/payments" });
    if (show.expenses) list.push({ key: "expenses", label: tr("Харочот"), value: stats ? formatMoney(stats.expensesSum) : "…", raw: stats?.expensesSum, money: true, icon: Receipt, accent: "warning", to: "/expenses" });
    if (show.debt) list.push({ key: "debt", label: tr("Қарздорӣ"), value: stats ? formatMoney(stats.totalDebt) : "…", raw: stats?.totalDebt, money: true, icon: HandCoins, accent: "destructive", to: "/debtors" });
    if (show.warehouse) list.push({ key: "warehouse", label: tr("Склад"), value: stats?.warehouse ?? "…", raw: stats?.warehouse, icon: Boxes, to: "/warehouse" });
    list.push({
      key: "barter",
      label: tr("Бартер (мошинҳо)"),
      value: barter ? `${barter.cars}` : "…",
      raw: barter?.cars,
      icon: Car,
      accent: "accent",
      to: "/projects",
    });
    if (show.customers) {
      list.push({
        key: "paying-customers",
        label: tr("Клиенты с оплатой в системе"),
        value: stats?.payingCustomers ?? "…",
        raw: stats?.payingCustomers,
        icon: Users,
        accent: "success",
        to: "/customers",
        render: () => (
          <StatCard
            label={tr("Клиенты с оплатой в системе")}
            value={stats?.payingCustomers ?? "…"}
            icon={Users}
            accent="success"
            to="/customers"
            trend={`${tr("100% оплата")}: ${stats?.payFull ?? 0} · ${tr("Рассрочка")}: ${stats?.payInst ?? 0}`}
          />
        ),
      });
    }
    if (show.workers) list.push({ key: "workers", label: tr("Коргарон"), value: stats?.workers ?? "…", raw: stats?.workers, icon: Users, to: "/staff" });

    if (show.payments) {
      list.push({
        key: "installments",
        label: tr("Расрочкаи ин моҳ"),
        value: "…",
        raw: 0,
        icon: CalendarClock,
        accent: "accent",
        render: () => <InstallmentsCard companyId={companyId} projectIds={projectIdsFilter} isPlatformAdmin={isPlatformAdmin} />,
      });
      list.push({
        key: "mortgage",
        label: tr("Пардохти ипотека (рассрочка)"),
        value: "…",
        raw: 0,
        icon: Landmark,
        accent: "accent",
        render: () => <MortgageCard companyId={companyId} projectIds={projectIdsFilter} />,
      });
    }
    return list;
  }, [show, stats, tr, formatMoney, barter, companyId, projectIdsFilter, isPlatformAdmin]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Дашборд")}
        subtitle={periodLabel}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              <RefreshCw className={`h-3.5 w-3.5 ${statsFetching ? "animate-spin" : ""}`} />
              {statsFetching
                ? tr("Навсозӣ…")
                : dataUpdatedAt
                  ? `${tr("Нав шуд")}: ${new Date(dataUpdatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : tr("Ҳар 5 сония")}
            </div>
            <DashboardViewSwitcher mode={viewMode} onChange={setViewMode} />
            {canManageExpense && (
              <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />{t("expense.new")}
                  </Button>
                </DialogTrigger>
                <NewExpenseDialog
                  projects={projectsList}
                  onClose={() => {
                    setExpenseOpen(false);
                    qc.invalidateQueries({ queryKey: ["all-expenses"] });
                    qc.invalidateQueries({ queryKey: ["salary-summary"] });
                    qc.invalidateQueries({ queryKey: ["salary-history"] });
                    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                    qc.invalidateQueries({ queryKey: ["dashboard-distribution"] });
                  }}
                />
              </Dialog>
            )}
          </div>
        }
      />


      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur space-y-3">
          {period.control}
          <ZhkBlockFilter projects={projectsList} value={zhkFilter} onChange={setZhkFilter} />
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
          <div className="text-xs text-muted-foreground mb-2">{tr("Шуъба")}</div>
          <Select value={dept} onValueChange={(v) => setDept(v as DeptFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr("Ҳама шуъбаҳо")}</SelectItem>
              {(Object.keys(DEPARTMENT_LABEL) as Department[]).map((d) => (
                <SelectItem key={d} value={d}>{tr(DEPARTMENT_LABEL[d])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {tr("Хатогӣ ҳангоми боркунӣ")}: {(error as Error)?.message}
        </div>
      )}
      <DashboardMetrics mode={viewMode} metrics={metrics} />


      




      {dist?.allowed && canSeeDistribution && (dist.partners.length > 0 || dist.confirmed > 0) && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{tr("Тақсими даромад")}</h2>
          </div>


          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <StatCard label={tr("Пардохтҳои тасдиқшуда")} value={formatMoney(dist.confirmed)} icon={TrendingUp} />
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-destructive">{tr("Бақияи умумӣ (шарикон + хазина)")}</span>
                  <span className="font-display text-xl font-semibold tabular-nums text-destructive">
                    {formatMoney(
                      dist.partners.reduce((s, p) => s + (p.balance ?? 0), 0) +
                        (dist.construction_balance ?? dist.construction ?? 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
            {dist.partners.map((p) => {
              const normalizedPartnerName = (p.name || "")
                .toLowerCase()
                .replaceAll("ӯ", "у")
                .replaceAll("ӣ", "и");
              const isSalesPartner = normalizedPartnerName.includes("фуруш") || normalizedPartnerName.includes("furush");
              return (
                <div key={p.director_user_id} className="space-y-2">
                  <StatCard
                    label={p.percent ? `${p.name} — ${p.percent.toFixed(1)}%` : p.name}
                    value={formatMoney(p.earned)}
                    icon={Users}
                    accent="accent"
                    trend={`${tr("Бақия")}: ${formatMoney(p.balance)}`}
                  />
                  {canManageDistribution && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={p.balance <= 0}
                      onClick={() => {
                        setPayOpen({ id: p.director_user_id, name: p.name, balance: p.balance });
                        setPayAmount(String(Math.round(p.balance * 100) / 100));
                      }}
                    >
                      <Wallet className="mr-2 h-4 w-4" />{tr("Пардохт")}
                    </Button>
                  )}
                  {isSalesPartner && canManageDistribution && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={syncing}
                      onClick={async () => {
                        setSyncing(true);
                        try {
                          const r: any = await syncCompanyPartners({
                            data: { director_user_id: p.director_user_id },
                          });
                          toast.success(
                            `Фиристода шуд: ${formatMoney(r?.amount ?? 0)} · нав қабул шуд: ${formatMoney(r?.imported ?? 0)}`,
                          );
                        } catch (e: any) {
                          toast.error(e?.message ?? "Хатогӣ");
                        } finally {
                          setSyncing(false);
                        }
                      }}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                      {syncing ? "…" : tr("Синхронизатсия")}
                    </Button>
                  )}
                </div>
              );
            })}
            <StatCard label={tr("Зарари мошин")} value={formatMoney(dist.damage_total)} icon={Receipt} accent="warning" />
            <div className="space-y-2">
              <StatCard
                label={tr("Ба хазинаи сохтмон")}
                value={formatMoney(dist.construction)}
                icon={Wallet}
                accent="success"
                trend={`${tr("Бақия")}: ${formatMoney(dist.construction_balance ?? dist.construction)}`}
              />
              {canManageExpense && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setExpenseOpen(true)}>
                  <Wallet className="mr-2 h-4 w-4" />{tr("Пардохт")}
                </Button>
              )}
            </div>

          </div>


          {dist.partners.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">{tr("Шарик")}</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2 pr-3">{tr("Ҳисобшуда")}</th>
                    <th className="py-2 pr-3">{tr("Пардохтшуда")}</th>
                    
                    <th className="py-2">{tr("Бақия")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dist.partners.map((p) => (
                    <tr key={p.director_user_id} className="border-t border-border">
                      <td className="py-2 pr-3 font-medium">{p.name}</td>
                      <td className="py-2 pr-3">{p.percent ? `${p.percent.toFixed(1)}%` : "—"}</td>
                      <td className="py-2 pr-3">{formatMoney(p.earned)}</td>
                      <td className="py-2 pr-3">{formatMoney(p.paid)}</td>
                      
                      <td className="py-2 font-semibold">{formatMoney(p.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Пардохт")} — {payOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr("Бақия")}: <b>{payOpen ? formatMoney(payOpen.balance) : ""}</b>
            </p>
            <Input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={tr("Маблағ")}
            />
            <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={tr("Эзоҳ")} />
          </div>
          <DialogFooter>
            <Button
              disabled={payM.isPending || !(Number(payAmount) > 0)}
              onClick={() => payOpen && payM.mutate({ director_user_id: payOpen.id, amount: Number(payAmount), note: payNote })}
            >
              {tr("Сабт кардан")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
