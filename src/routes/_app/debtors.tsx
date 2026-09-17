import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Users, Search, Printer, Phone, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/constants";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";
import { usePeriodFilter } from "@/components/period-filter";
import { inRange } from "@/lib/finance";
import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { ZhkBlockFilter, useZhkBlockFilter } from "@/components/zhk-block-filter";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/debtors")({
  head: () => ({ meta: [{ title: "Должники — PLATFORM.TJ" }] }),
  component: DebtorsPage,
});

function DebtorsPage() {
  const { tr } = useT();
  const { formatMoney } = usePrefs();
  const period = usePeriodFilter("all");
  const [search, setSearch] = useState("");
  const [zhk, setZhk] = useState({ zhkId: "", blockId: "" });

  const { data: projects = [] } = useQuery({
    queryKey: ["debtors-projects"],
    queryFn: async () => (await supabase.from("projects").select("id, name, parent_id").order("name")).data ?? [],
  });
  const allowedIds = useZhkBlockFilter(projects as any, zhk);

  const { data: customers = [] } = useQuery({
    queryKey: ["debtors-customers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, fullname, phone, created_at, sales(id, full_price, paid_amount, remaining_amount, apartment:apartments(apartment_number, project_id, project:projects(id, name)))")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const debtors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (customers as any[])
      .map((c) => {
        const total = c.sales.reduce((s: number, x: any) => s + Number(x.full_price), 0);
        const paid = c.sales.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);
        const remaining = total - paid;
        const apartments = c.sales
          .map((s: any) => `${s.apartment?.project?.name ?? ""} ${s.apartment?.apartment_number ? "№" + s.apartment.apartment_number : ""}`.trim())
          .filter(Boolean)
          .join(", ");
        const projectIds = c.sales.map((s: any) => s.apartment?.project_id).filter(Boolean);
        return { ...c, total, paid, remaining, apartments, projectIds };
      })
      .filter((c) => c.remaining > 0.5)
      .filter((c) => !allowedIds || c.projectIds.some((pid: string) => allowedIds.has(pid)))
      .filter((c) => !period.active || inRange(c.created_at, period.fromDate, period.toDate))
      .filter((c) => {
        if (!q) return true;
        return [c.fullname, c.phone, c.apartments].filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => b.remaining - a.remaining);
  }, [customers, search, period.active, period.fromDate, period.toDate, allowedIds]);

  const totalRemaining = debtors.reduce((s, c) => s + c.remaining, 0);
  const totalPaid = debtors.reduce((s, c) => s + c.paid, 0);
  const totalPrice = debtors.reduce((s, c) => s + c.total, 0);

  const company = useCompanyHeader();
  const handlePrint = () => {
    const rowsHtml = debtors.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(c.fullname)}</td>
        <td>${esc(c.phone || "—")}</td>
        <td>${esc(c.apartments || "—")}</td>
        <td class="num">${esc(formatMoney(c.total))}</td>
        <td class="num">${esc(formatMoney(c.paid))}</td>
        <td class="num">${esc(formatMoney(c.remaining))}</td>
      </tr>`).join("");
    const content = `
      <h1>${esc(tr("Должники"))}</h1>
      <h2>${esc(period.label)}</h2>
      <table>
        <thead><tr>
          <th>№</th><th>${esc(tr("Клиент"))}</th><th>${esc(tr("Телефон"))}</th>
          <th>${esc(tr("Квартира"))}</th><th class="num">${esc(tr("Цена"))}</th>
          <th class="num">${esc(tr("Оплачено"))}</th><th class="num">${esc(tr("Остаток"))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="4">${esc(tr("Итого"))}</td>
          <td class="num">${esc(formatMoney(totalPrice))}</td>
          <td class="num">${esc(formatMoney(totalPaid))}</td>
          <td class="num">${esc(formatMoney(totalRemaining))}</td>
        </tr></tfoot>
      </table>`;
    if (!openPrintWindow({ title: tr("Должники"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Должники")}
        subtitle={`${tr("Остаток")}: ${formatMoney(totalRemaining)}`}
        actions={
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={debtors.length === 0}>
            <Printer className="mr-2 h-4 w-4" />{tr("Печать")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={tr("Общий остаток")} value={formatMoney(totalRemaining)} />
        <Kpi label={tr("Оплачено")} value={formatMoney(totalPaid)} />
        <Kpi label={tr("Должников")} value={String(debtors.length)} />
      </div>

      {period.control}

      <ZhkBlockFilter projects={projects as any} value={zhk} onChange={setZhk} />

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск: клиент, телефон, квартира…")} className="pl-8" />
      </div>

      {debtors.length === 0 ? (
        <EmptyState icon={Users} title={tr("Должников нет")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{tr("Клиент")}</th>
                <th className="px-4 py-3 text-left">{tr("Квартира")}</th>
                <th className="px-4 py-3 text-right">{tr("Цена")}</th>
                <th className="px-4 py-3 text-right">{tr("Оплачено")}</th>
                <th className="px-4 py-3 text-right">{tr("Остаток")}</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.fullname}</p>
                    {c.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.apartments || "—"}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(c.total)}</td>
                  <td className="px-4 py-3 text-right text-success">{formatMoney(c.paid)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">{formatMoney(c.remaining)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/30 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>{tr("Итого")}</td>
                <td className="px-4 py-3 text-right">{formatMoney(totalPrice)}</td>
                <td className="px-4 py-3 text-right text-success">{formatMoney(totalPaid)}</td>
                <td className="px-4 py-3 text-right text-destructive">{formatMoney(totalRemaining)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Wallet className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
