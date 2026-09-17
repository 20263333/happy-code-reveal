import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Plus, Receipt, Trash2, Search, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ExcelImportExpenses } from "@/components/excel-import-expenses";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatDate, EXPENSE_CATEGORIES } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/preferences";
import { useAuth } from "@/hooks/use-auth";
import { EXPENSES_TAB_KEYS } from "@/lib/app-pages";
import { useTabGate } from "@/lib/use-tab-gate";

import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { usePeriodFilter } from "@/components/period-filter";
import { inRange } from "@/lib/finance";
import { ZhkBlockFilter, useZhkBlockFilter } from "@/components/zhk-block-filter";
import { useSalarySummaries } from "@/components/worker-salary";
import { rollbackExpense } from "@/lib/distribution.functions";


import { toast } from "sonner";

export const Route = createFileRoute("/_app/expenses")({
  head: () => ({ meta: [{ title: "Расходы — PLATFORM.TJ" }] }),
  component: ExpensesPage,
  errorComponent: ({ error, reset }) => {
    const { tr } = useT();
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-semibold text-destructive">{tr("Не удалось загрузить раздел «Расходы»")}</p>
        <p className="mt-1 text-muted-foreground break-all">{String((error as any)?.message ?? error)}</p>
        <button onClick={() => reset()} className="mt-4 rounded-md bg-primary px-3 py-1.5 text-primary-foreground">{tr("Повторить")}</button>
      </div>
    );
  },
});

// Манбаъи маблағи хароҷот — аз ҳисоби кӣ пардохта шудааст
const FUNDING_SOURCES = [
  { value: "construction", label: "Ба хазинаи сохтмон" },
  { value: "partner_project", label: "Шарики Лоиҳа — 70.0%" },
  { value: "partner_sales", label: "Шарики фуруш — 30.0%" },
] as const;

function ExpensesPage() {
  const { t, tr } = useT();
  const { formatMoney } = usePrefs();
  const { isOwner, isPlatformAdmin, isDirector, user } = useAuth();
  const tabOk = useTabGate();
  // Right to create/delete an expense: owners/platform admins always,
  // any other staff member only when the sub-page key is granted.
  const canManage = !isDirector && (isOwner || isPlatformAdmin || tabOk(EXPENSES_TAB_KEYS.new));
  // Нест кардани хароҷот танҳо барои роҳбар (соҳиби ширкат / супер админ)
  const canDelete = isOwner || isPlatformAdmin;


  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: expenses = [] } = useQuery({
    queryKey: ["all-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, category, description, employee_name, expense_date, currency, project_id, created_at, funding_source")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((e: any) => e.project_id).filter(Boolean)));
      let projMap: Record<string, { id: string; name: string; parent_id: string | null }> = {};
      if (ids.length) {
        const { data: projs } = await supabase.from("projects").select("id, name, parent_id").in("id", ids as string[]);
        projMap = Object.fromEntries((projs ?? []).map((p: any) => [p.id, p]));
        // Fetch parent project names for blocks so we can show "ЖК → Блок".
        const parentIds = Array.from(
          new Set(Object.values(projMap).map((p) => p.parent_id).filter((pid) => pid && !projMap[pid as string])),
        );
        if (parentIds.length) {
          const { data: parents } = await supabase.from("projects").select("id, name, parent_id").in("id", parentIds as string[]);
          for (const p of parents ?? []) projMap[(p as any).id] = p as any;
        }
      }
      return (data ?? []).map((e: any) => {
        const proj = projMap[e.project_id] ?? null;
        const parent = proj?.parent_id ? projMap[proj.parent_id] ?? null : null;
        const fullName = proj ? (parent ? `${parent.name} → ${proj.name}` : proj.name) : null;
        return { ...e, project: proj ? { ...proj, fullName } : null };
      });
    },
  });

  const [delTarget, setDelTarget] = useState<any | null>(null);
  const rollbackExpenseFn = useServerFn(rollbackExpense);

  const del = useMutation({
    mutationFn: async ({ row }: { row: any }) => {
      return rollbackExpenseFn({ data: { id: row.id } });
    },
    onSuccess: async () => {
      setDelTarget(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["all-expenses"] }),
        qc.invalidateQueries({ queryKey: ["salary-summary"] }),
        qc.invalidateQueries({ queryKey: ["salary-history"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-distribution"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        qc.invalidateQueries({ queryKey: ["blocks-construction-fund"] }),
        qc.invalidateQueries({ queryKey: ["distribution"] }),
        qc.invalidateQueries({ queryKey: ["partner-payouts"] }),
      ]);
      toast.success(tr("Расход удалён, сумма возвращена на исходный счёт"));
    },
    onError: (e: any) => toast.error(e.message),
  });




  const { data: projects = [] } = useQuery({
    queryKey: ["projects-min-with-parent"],
    queryFn: async () => (await supabase.from("projects").select("id, name, parent_id").order("name")).data ?? [],
  });

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [costFilter, setCostFilter] = useState<string>("all");
  const [filterFunding, setFilterFunding] = useState<string>("all");
  const [zhk, setZhk] = useState({ zhkId: "", blockId: "" });
  const allowedIds = useZhkBlockFilter(projects as any, zhk);
  const period = usePeriodFilter("all");

  const catLabel = (v: string) => {
    const c = EXPENSE_CATEGORIES.find(x => x.value === v);
    return c ? t(c.labelKey as any) : v;
  };

  // Сумма расходов по каждому проекту (для чипов блоков)
  const projectTotals = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number }>();
    for (const e of expenses as any[]) {
      if (!e.project_id || !e.project) continue;
      const prev = m.get(e.project_id);
      if (prev) prev.total += Number(e.amount);
      else m.set(e.project_id, { id: e.project_id, name: e.project.fullName ?? e.project.name, total: Number(e.amount) });
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e: any) => {
      if (allowedIds && !allowedIds.has(e.project_id)) return false;
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (filterFunding !== "all" && (e.funding_source || "construction") !== filterFunding) return false;
      const isBlock = !!e.project?.parent_id;
      if (costFilter === "project" && isBlock) return false;
      if (costFilter === "block" && !isBlock) return false;
      if (period.active && !inRange(e.expense_date ?? e.created_at, period.fromDate, period.toDate)) return false;
      if (!q) return true;
      return [e.description, e.project?.fullName, e.project?.name, catLabel(e.category)].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [expenses, search, filterCat, filterFunding, costFilter, allowedIds, period.active, period.fromDate, period.toDate]);

  // Проект для импорта из Excel: конкретный блок или ЖК без блоков.
  const importProjectId = useMemo(() => {
    if (zhk.blockId) return zhk.blockId;
    if (zhk.zhkId) {
      const hasBlocks = (projects as any[]).some((p) => p.parent_id === zhk.zhkId);
      if (!hasBlocks) return zhk.zhkId;
    }
    return null;
  }, [zhk, projects]);

  const total = filtered.reduce((s, x) => s + Number(x.amount), 0);
  const blockTotal = filtered.filter((e: any) => e.project?.parent_id).reduce((s, x: any) => s + Number(x.amount), 0);
  const projectTotal = total - blockTotal;
  const salaryTotal = filtered.filter((e: any) => e.category === "salary").reduce((s, x: any) => s + Number(x.amount), 0);

  // Ҳисоб барои ҳар манбаи маблағ (бе филтри манбаъ) — чанд бор ва чанд пул сарф шудааст
  const fundingStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = expenses.filter((e: any) => {
      if (allowedIds && !allowedIds.has(e.project_id)) return false;
      if (filterCat !== "all" && e.category !== filterCat) return false;
      const isBlock = !!e.project?.parent_id;
      if (costFilter === "project" && isBlock) return false;
      if (costFilter === "block" && !isBlock) return false;
      if (period.active && !inRange(e.expense_date ?? e.created_at, period.fromDate, period.toDate)) return false;
      if (!q) return true;
      return [e.description, e.project?.fullName, e.project?.name, catLabel(e.category)].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    const mk = (src: string) => {
      const rows = list.filter((e: any) => (e.funding_source || "construction") === src);
      return { count: rows.length, total: rows.reduce((s: number, x: any) => s + Number(x.amount), 0) };
    };
    return [
      { value: "partner_sales", label: tr("Шарики фуруш"), ...mk("partner_sales") },
      { value: "partner_project", label: tr("Шарики Лоиҳа"), ...mk("partner_project") },
      { value: "construction", label: tr("Хазинаи сохтмон"), ...mk("construction") },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, search, filterCat, costFilter, allowedIds, period.active, period.fromDate, period.toDate]);


  const company = useCompanyHeader();
  const handlePrint = () => {
    const rowsHtml = filtered.map((e: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(e.expense_date))}</td>
        <td>${esc(e.project?.fullName || e.project?.name || "—")}</td>
        <td>${esc(catLabel(e.category))}</td>
        <td>${esc(e.employee_name || "—")}</td>
        <td>${esc(e.description || "—")}</td>
        <td style="text-align:right">${esc(formatMoney(Number(e.amount)))}</td>
      </tr>`).join("");
    const content = `
      <table>
        <thead><tr>
          <th>№</th>
          <th>${esc(tr("Дата"))}</th>
          <th>${esc(tr("Проект"))}</th>
          <th>${esc(tr("Категория"))}</th>
          <th>${esc(tr("Имя рабочего"))}</th>
          <th>${esc(tr("Описание"))}</th>
          <th style="text-align:right">${esc(tr("Сумма"))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="total">${esc(tr("Итого"))}: ${esc(formatMoney(total))}</div>`;
    if (!openPrintWindow({ title: tr("Расходы"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  const handlePrintOne = (e: any) => {
    const row = `
      <tr>
        <td>1</td>
        <td>${esc(formatDate(e.expense_date))}</td>
        <td>${esc(e.project?.fullName || e.project?.name || "—")}</td>
        <td>${esc(catLabel(e.category))}</td>
        <td>${esc(e.employee_name || "—")}</td>
        <td>${esc(e.description || "—")}</td>
        <td style="text-align:right">${esc(formatMoney(Number(e.amount)))}</td>
      </tr>`;
    const content = `
      <table>
        <thead><tr>
          <th>№</th>
          <th>${esc(tr("Дата"))}</th>
          <th>${esc(tr("Проект"))}</th>
          <th>${esc(tr("Категория"))}</th>
          <th>${esc(tr("Имя рабочего"))}</th>
          <th>${esc(tr("Описание"))}</th>
          <th style="text-align:right">${esc(tr("Сумма"))}</th>
        </tr></thead>
        <tbody>${row}</tbody>
      </table>
      <div class="total">${esc(tr("Итого"))}: ${esc(formatMoney(Number(e.amount)))}</div>`;
    if (!openPrintWindow({ title: tr("Расход"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.expenses")}
        subtitle={`${t("table.amount")}: ${formatMoney(total)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />{tr("Печать")}
            </Button>
            {canManage && importProjectId && (
              <ExcelImportExpenses projectId={importProjectId} />
            )}
            {canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("expense.new")}</Button></DialogTrigger>
                <NewExpenseDialog projects={projects} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["all-expenses"] }); qc.invalidateQueries({ queryKey: ["salary-summary"] }); qc.invalidateQueries({ queryKey: ["salary-history"] }); }} />
              </Dialog>
            )}
          </div>

        }
      />

      <ZhkBlockFilter projects={projects as any} value={zhk} onChange={setZhk} />



      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: tr("Прямые расходы блоков"), value: blockTotal },
          { label: tr("Общие расходы проекта"), value: projectTotal },
          { label: tr("Общие расходы на зарплаты"), value: salaryTotal },
          { label: tr("Итого расходы проекта"), value: total },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-lg font-semibold">{formatMoney(c.value)}</p>
          </div>
        ))}
      </div>

      {period.control}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск: проект, описание, категория…")} className="pl-8" />
        </div>
        <Select value={costFilter} onValueChange={setCostFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Все расходы")}</SelectItem>
            <SelectItem value="project">{tr("Общие расходы проекта")}</SelectItem>
            <SelectItem value="block">{tr("Расходы блоков")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Все категории")}</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{t(c.labelKey as any)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFunding} onValueChange={setFilterFunding}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Ҳама манбаъҳо")}</SelectItem>
            {FUNDING_SOURCES.map((f) => <SelectItem key={f.value} value={f.value}>{tr(f.label)}</SelectItem>)}
            <SelectItem value="none">{tr("Умумӣ (бе манбаъ)")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {fundingStats.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilterFunding(filterFunding === f.value ? "all" : f.value)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filterFunding === f.value ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="mt-1 font-display text-lg font-semibold">{formatMoney(f.total)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{f.count} {tr("бор сарф шудааст")}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title={expenses.length === 0 ? t("project.noExpenses") : tr("Ничего не найдено")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{t("table.date")}</th>
                <th className="px-4 py-3 text-left">{t("table.project")}</th>
                <th className="px-4 py-3 text-left">{t("table.category")}</th>
                <th className="px-4 py-3 text-left">{tr("Центр затрат")}</th>
                <th className="px-4 py-3 text-left">{t("table.description")}</th>
                <th className="px-4 py-3 text-right">{t("table.amount")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3 font-medium">{e.project?.fullName ?? e.project?.name ?? tr("Умумии ширкат")}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{catLabel(e.category)}</Badge>
                    {e.funding_source && (
                      <Badge variant="secondary" className="ml-1">
                        {tr(FUNDING_SOURCES.find((f) => f.value === e.funding_source)?.label ?? "")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={e.project?.parent_id ? "default" : "secondary"}>
                      {e.project?.parent_id ? e.project?.name : tr("Общий расход")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {e.employee_name && <span className="font-medium">👤 {e.employee_name}</span>}
                    {e.employee_name && e.description && <span className="text-muted-foreground"> · </span>}
                    {e.description}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handlePrintOne(e)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => setDelTarget(e)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!delTarget} onOpenChange={(o) => { if (!o) setDelTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Нест кардани хароҷот")}</DialogTitle></DialogHeader>
          {delTarget && (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">
                {catLabel(delTarget.category)} · {formatDate(delTarget.expense_date)}
              </div>
              <div className="text-lg font-semibold">{formatMoney(delTarget.amount)}</div>
              <p>{tr("Вы действительно хотите удалить этот расход? После удаления сумма будет возвращена на исходный счёт.")}</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" disabled={del.isPending} onClick={() => setDelTarget(null)}>
              {tr("Отмена")}
            </Button>
            <Button disabled={del.isPending} onClick={() => del.mutate({ row: delTarget })}>
              {tr("Да")}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>

  );
}

// Псевдо-значение в выпадающем списке проектов: общий расход компании (без проекта).
const GENERAL_EXPENSE = "__general__";

export function NewExpenseDialog({ projects, onClose }: { projects: any[]; onClose: () => void }) {
  const { t, tr } = useT();
  const { currency, formatMoney } = usePrefs();
  const { companyId } = useAuth();
  const [parentId, setParentId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [fundingSource, setFundingSource] = useState<string>("construction");

  // Top-level projects (ЖК) and the blocks (sub-projects) of the selected one.
  const topProjects = useMemo(() => projects.filter((p) => !p.parent_id), [projects]);
  const blocks = useMemo(
    () => projects.filter((p) => p.parent_id === parentId),
    [projects, parentId],
  );
  const { data: workers = [] } = useQuery({
    queryKey: ["workers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("workers").select("id, fullname, monthly_salary, cost_center, project_id, block_id").eq("company_id", companyId).order("fullname");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: salary = {} } = useSalarySummaries(companyId);
  const worker = workers.find((w: any) => w.id === workerId) ?? null;
  const balance = salary[workerId]?.balance ?? 0;
  const overLimit = category === "salary" && !!workerId && Number(amount) > balance + 0.005;

  // Salary of a general (project-wide) employee: cost centre is the project, not a block.
  const generalSalary = category === "salary" && !!worker && (worker as any).cost_center !== "block";

  // Prefill the cost centre of the chosen employee.
  useEffect(() => {
    if (category !== "salary" || !worker) return;
    const w = worker as any;
    if (w.cost_center === "block" && w.block_id) {
      const b = projects.find((p) => p.id === w.block_id);
      setParentId(b?.parent_id ?? w.project_id ?? "");
      setBlockId(w.block_id);
    } else if (w.project_id) {
      setParentId(w.project_id);
      setBlockId("");
    }
  }, [workerId, category]);

  // Expense attaches to the chosen block(s); if a project has no blocks, attach to the project itself.
  // GENERAL = общий расход компании (без проекта): project_id остаётся null.
  const isGeneral = parentId === GENERAL_EXPENSE;
  const multiBlock = category !== "salary" && !isGeneral && !!parentId && blocks.length > 0;
  const [blockIds, setBlockIds] = useState<string[]>([]);
  useEffect(() => { setBlockIds(blockId ? [blockId] : []); }, [blockId]);
  useEffect(() => { if (!multiBlock) return; setBlockIds((prev) => prev.filter((id) => blocks.some((b) => b.id === id))); }, [parentId]);

  const targetIds: (string | null)[] = isGeneral
    ? [null]
    : generalSalary
      ? [parentId]
      : multiBlock
        ? blockIds
        : blocks.length > 0
          ? (blockId ? [blockId] : [])
          : (parentId ? [parentId] : []);
  const projectId = (targetIds[0] as string | null) ?? null;
  const hasTarget = isGeneral || targetIds.length > 0;

  // ---- Floor-level cost centre + budget limit (only for a single target) ----
  const singleTarget = !isGeneral && targetIds.length === 1 ? (targetIds[0] as string) : null;
  const [floorId, setFloorId] = useState("");
  useEffect(() => { setFloorId(""); }, [singleTarget]);

  const { data: floors = [] } = useQuery({
    queryKey: ["floors-simple", singleTarget],
    queryFn: async () =>
      (await supabase.from("floors").select("id, floor_number").eq("project_id", singleTarget!).order("floor_number")).data ?? [],
    enabled: !!singleTarget,
  });

  const { data: budgetRows = [] } = useQuery({
    queryKey: ["project-budgets", singleTarget],
    queryFn: async () =>
      ((await (supabase as any).from("project_budgets").select("*").eq("project_id", singleTarget!)).data ?? []) as any[],
    enabled: !!singleTarget,
  });

  const { data: targetExpenses = [] } = useQuery({
    queryKey: ["expenses-floor", singleTarget],
    queryFn: async () =>
      ((await supabase.from("expenses").select("amount, category, floor_id").eq("project_id", singleTarget!)).data ?? []) as any[],
    enabled: !!singleTarget,
  });

  const budgetInfo = useMemo(() => {
    if (!singleTarget) return null;
    const fid = floorId || null;
    const b = (budgetRows as any[]).find((x) => x.category === category && (x.floor_id ?? null) === fid);
    if (!b) return null;
    const planned = Number(b.planned_amount || 0);
    const spent = (targetExpenses as any[])
      .filter((e) => e.category === category && (e.floor_id ?? null) === fid)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return { planned, spent, remaining: planned - spent };
  }, [singleTarget, floorId, category, budgetRows, targetExpenses]);

  const overBudget = !!budgetInfo && Number(amount) > budgetInfo.remaining + 0.005;

  // Сумма делится поровну между выбранными блоками (остаток — последнему).
  const splitAmounts = (total: number, parts: number) => {
    const each = Math.round((total / parts) * 100) / 100;
    const arr = Array.from({ length: parts }, () => each);
    arr[parts - 1] = Math.round((total - each * (parts - 1)) * 100) / 100;
    return arr;
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!hasTarget) throw new Error(tr("Выберите проект"));
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error(tr("Сумма должна быть больше 0"));
      if (category === "salary" && !workerId) throw new Error(tr("Выберите сотрудника"));
      if (overLimit) {
        throw new Error(`${tr("Сумма превышает доступный зарплатный баланс сотрудника. Доступно к выплате:")} ${formatMoney(balance)}`);
      }
      if (overBudget) {
        throw new Error(`${tr("Аз бақияи буджет зиёд. Бақия:")} ${formatMoney(budgetInfo!.remaining)}`);
      }
      let invoice_file: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${projectId ?? "general"}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw new Error(`${tr("Загрузка файла:")} ${upErr.message}`);
        invoice_file = path;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const parts = splitAmounts(amt, targetIds.length);
      const rows = targetIds.map((pid, i) => ({
        project_id: pid, amount: parts[i], category, description: description || null, invoice_file,
        floor_id: singleTarget && floorId ? floorId : null,
        employee_name: category === "salary" ? (worker?.fullname ?? null) : null,
        worker_id: category === "salary" ? workerId : null,
        expense_date: date, created_by: user?.id, currency,
        funding_source: fundingSource,
      }));
      const { error } = await supabase.from("expenses").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Расход добавлен")); onClose(); },
    onError: (e: any) => { console.error("add expense error", e); toast.error(e.message || tr("Ошибка")); },
  });



  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{t("expense.new")}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <div className="space-y-1.5">
          <Label>{t("table.project")}</Label>
          <Select value={parentId} onValueChange={(v) => { setParentId(v); setBlockId(""); setBlockIds([]); }}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL_EXPENSE}>{tr("Умумӣ (бе лоиҳа)")}</SelectItem>
              {topProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isGeneral ? (
          <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
            {tr("Источник расхода")}: <span className="font-semibold">{tr("Умумии ширкат")}</span>
          </p>
        ) : generalSalary ? (
          <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
            {tr("Источник расхода")}: <span className="font-semibold">{tr("Общие расходы проекта")}</span>
          </p>
        ) : multiBlock ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{tr("Блокҳо")}</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setBlockIds(blockIds.length === blocks.length ? [] : blocks.map((b) => b.id))}
              >
                {blockIds.length === blocks.length ? tr("Тоза кардан") : tr("Ҳамаро интихоб кардан")}
              </button>
            </div>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {blocks.map((b) => {
                const checked = blockIds.includes(b.id);
                return (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v: boolean | "indeterminate") =>
                        setBlockIds((prev) => (v ? [...prev, b.id] : prev.filter((x) => x !== b.id)))
                      }
                    />
                    <span>{b.name}</span>
                  </label>
                );
              })}
            </div>
            {blockIds.length > 1 && Number(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                {tr("Сумма делится поровну между блоками")}: {formatMoney(Number(amount) / blockIds.length)} × {blockIds.length}
              </p>
            )}
          </div>
        ) : parentId && blocks.length > 0 ? (
          <div className="space-y-1.5">
            <Label>{tr("Блок")}</Label>
            <Select value={blockId} onValueChange={setBlockId}>
              <SelectTrigger><SelectValue placeholder={tr("Блокро интихоб кунед")} /></SelectTrigger>
              <SelectContent>
                {blocks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {singleTarget && (floors as any[]).length > 0 && (
          <div className="space-y-1.5">
            <Label>{tr("Этаж")}</Label>
            <Select value={floorId || "__all__"} onValueChange={(v) => setFloorId(v === "__all__" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{tr("Умумӣ (бе этаж)")}</SelectItem>
                {(floors as any[]).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{tr("Этаж")} {f.floor_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}




        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("table.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{t(c.labelKey as any)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{t("table.amount")}</Label><Input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        {category === "salary" && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>{tr("Сотрудник")}</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger><SelectValue placeholder={tr("Выберите сотрудника")} /></SelectTrigger>
                <SelectContent>
                  {workers.map((w: { id: string; fullname: string }) => (
                    <SelectItem key={w.id} value={w.id}>{w.fullname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {workerId && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Фиксированная зарплата")}</span><span>{formatMoney(Number(worker?.monthly_salary ?? 0))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Начислено")}</span><span>{formatMoney(salary[workerId]?.accrued ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Уже выплачено")}</span><span>{formatMoney(salary[workerId]?.paid ?? 0)}</span></div>
                <div className="flex justify-between font-semibold"><span>{tr("Доступно к выплате")}</span><span className="text-primary">{formatMoney(balance)}</span></div>
              </div>
            )}
            {overLimit && (
              <p className="text-xs text-destructive">
                {tr("Сумма превышает доступный зарплатный баланс сотрудника. Доступно к выплате:")} {formatMoney(balance)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>{tr("Манбаъи маблағ")}</Label>
          <Select value={fundingSource} onValueChange={setFundingSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FUNDING_SOURCES.map((f) => <SelectItem key={f.value} value={f.value}>{tr(f.label)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>{t("table.date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>{t("table.description")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>{tr("Инвойс (PDF/фото)")}</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        {budgetInfo && (
          <p className={cn("rounded-lg border p-2.5 text-xs", overBudget ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted/30")}>
            {tr("Буджет")}: {formatMoney(budgetInfo.planned)} · {tr("Бақия")}: {formatMoney(budgetInfo.remaining)}
          </p>
        )}
        <DialogFooter><Button type="submit" disabled={(!projectId && !isGeneral) || add.isPending || overLimit || overBudget}>{t("common.save")}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
