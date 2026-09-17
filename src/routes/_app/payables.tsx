import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Plus, Banknote, Trash2, Search, Wallet, AlertCircle, Users, Phone, User,
  CreditCard, History, Download, Archive, Pencil, CheckCircle2, BellRing,
  ChevronDown, ChevronRight, Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { ExcelImportSuppliers } from "@/components/excel-import-suppliers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  formatDate, PAYABLE_CATEGORIES, PAYABLE_STATUS, payableCategoryLabel,
  payableDisplayStatus, daysUntil,
} from "@/lib/constants";
import { usePrefs } from "@/lib/preferences";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/payables")({
  head: () => ({ meta: [{ title: "Поставщики — Binosoz.tj" }] }),
  component: PayablesPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <p className="font-semibold text-destructive">Не удалось загрузить раздел «Поставщики»</p>
      <p className="mt-1 text-muted-foreground break-all">{String((error as any)?.message ?? error)}</p>
      <button onClick={() => reset()} className="mt-4 rounded-md bg-primary px-3 py-1.5 text-primary-foreground">Повторить</button>
    </div>
  ),
});

const PAY_METHODS = ["Наличные", "Банковский перевод", "Карта", "Другое"];

const num = (v: any) => Number(v) || 0;

async function downloadDoc(path: string) {
  const { data, error } = await supabase.storage.from("payable-docs").createSignedUrl(path, 120);
  if (error || !data?.signedUrl) { toast.error("Не удалось получить документ"); return; }
  window.open(data.signedUrl, "_blank");
}

function PayablesPage() {
  const { formatMoney } = usePrefs();
  const { tr } = useT();
  const { isOwner, isAccountant, isManager, isDirector, isPlatformAdmin, companyId } = useAuth();
  const canManage = !isDirector && (isOwner || isAccountant || isManager);
  const qc = useQueryClient();

  const [openNewSupplier, setOpenNewSupplier] = useState(false);
  const [openNewPayable, setOpenNewPayable] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [historyTarget, setHistoryTarget] = useState<any>(null);
  const [newPayableSupplier, setNewPayableSupplier] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suppliers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payables = [], isLoading } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payables").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((p: any) => p.project_id).filter(Boolean)));
      let projMap: Record<string, { id: string; name: string }> = {};
      if (ids.length) {
        const { data: projs } = await supabase.from("projects").select("id, name").in("id", ids as string[]);
        projMap = Object.fromEntries((projs ?? []).map((p: any) => [p.id, p]));
      }
      return (data ?? []).map((p: any) => ({ ...p, project: projMap[p.project_id] ?? null }));
    },
  });

  const delSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Удалено")); qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["payables"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("payables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Удалено")); qc.invalidateQueries({ queryKey: ["payables"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await (supabase as any).from("payables").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Обновлено")); qc.invalidateQueries({ queryKey: ["payables"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");

  const active = useMemo(() => payables.filter((p: any) => !p.archived), [payables]);

  // Group obligations under suppliers + a legacy "no supplier" bucket
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySupplier: Record<string, any[]> = {};
    const legacy: any[] = [];
    for (const p of active) {
      if (p.supplier_id) {
        (bySupplier[p.supplier_id] ??= []).push(p);
      } else {
        legacy.push(p);
      }
    }
    const supRows = suppliers
      .map((s: any) => {
        const obls = bySupplier[s.id] ?? [];
        const total = obls.reduce((x: number, p: any) => x + num(p.total_amount), 0);
        const paid = obls.reduce((x: number, p: any) => x + num(p.paid_amount), 0);
        const remain = obls.reduce((x: number, p: any) => x + Math.max(num(p.total_amount) - num(p.paid_amount), 0), 0);
        const overdue = obls.some((p: any) => p.status !== "paid" && payableDisplayStatus(p.status, p.due_date) === "overdue");
        return { supplier: s, obligations: obls, total, paid, remain, overdue };
      })
      .filter((r: any) => {
        if (!q) return true;
        return [r.supplier.name, r.supplier.phone, r.supplier.contact_person]
          .filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => b.remain - a.remain || a.supplier.name.localeCompare(b.supplier.name));

    const legacyFiltered = legacy.filter((p: any) => {
      if (!q) return true;
      return [p.counterparty, p.project?.name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    return { supRows, legacy: legacyFiltered };
  }, [active, suppliers, search]);

  const totalOutstanding = active.reduce((s: number, p: any) => s + Math.max(num(p.total_amount) - num(p.paid_amount), 0), 0);
  const totalOverdue = active.filter((p: any) => payableDisplayStatus(p.status, p.due_date) === "overdue")
    .reduce((s: number, p: any) => s + Math.max(num(p.total_amount) - num(p.paid_amount), 0), 0);
  const totalPaid = active.reduce((s: number, p: any) => s + num(p.paid_amount), 0);

  const notifications = useMemo(() => {
    const out: { id: string; tone: "warn" | "danger" | "info"; text: string }[] = [];
    const nameOf = (p: any) => suppliers.find((s: any) => s.id === p.supplier_id)?.name ?? p.counterparty;
    for (const p of active) {
      if (p.status === "paid") continue;
      const d = daysUntil(p.due_date);
      if (d === null) continue;
      const remain = formatMoney(Math.max(num(p.total_amount) - num(p.paid_amount), 0));
      const label = nameOf(p);
      if (d < 0) out.push({ id: p.id, tone: "danger", text: `${tr("Просрочка")} ${Math.abs(d)} ${tr("дн.")}: ${label} — ${remain}` });
      else if (d === 0) out.push({ id: p.id, tone: "danger", text: `${tr("Сегодня срок оплаты")}: ${label} — ${remain}` });
      else if (d <= 3) out.push({ id: p.id, tone: "warn", text: `${tr("Через")} ${d} ${tr("дн. срок оплаты")}: ${label} — ${remain}` });
      else if (d <= 7) out.push({ id: p.id, tone: "info", text: `${tr("Через")} ${d} ${tr("дн. срок оплаты")}: ${label} — ${remain}` });
    }
    return out;
  }, [active, suppliers, formatMoney, tr]);

  const company = useCompanyHeader();
  const handlePrint = () => {
    const rowsHtml = active.map((p: any, i: number) => {
      const name = suppliers.find((s: any) => s.id === p.supplier_id)?.name ?? p.counterparty ?? "—";
      const remain = Math.max(num(p.total_amount) - num(p.paid_amount), 0);
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(name)}</td>
          <td>${esc(p.project?.name || "—")}</td>
          <td>${esc(payableCategoryLabel(p.category))}</td>
          <td>${esc(formatDate(p.due_date))}</td>
          <td class="num">${esc(formatMoney(num(p.total_amount)))}</td>
          <td class="num">${esc(formatMoney(num(p.paid_amount)))}</td>
          <td class="num">${esc(formatMoney(remain))}</td>
        </tr>`;
    }).join("");
    const content = `
      <h1>${esc(tr("Поставщики"))}</h1>
      <h2>${esc(formatDate(new Date()))}</h2>
      <table>
        <thead><tr>
          <th>№</th><th>${esc(tr("Поставщик"))}</th><th>${esc(tr("Проект"))}</th>
          <th>${esc(tr("Категория"))}</th><th>${esc(tr("Срок"))}</th>
          <th class="num">${esc(tr("Сумма"))}</th><th class="num">${esc(tr("Оплачено"))}</th>
          <th class="num">${esc(tr("Остаток"))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="5">${esc(tr("Итого"))}</td>
          <td class="num">${esc(formatMoney(active.reduce((s: number, p: any) => s + num(p.total_amount), 0)))}</td>
          <td class="num">${esc(formatMoney(totalPaid))}</td>
          <td class="num">${esc(formatMoney(totalOutstanding))}</td>
        </tr></tfoot>
      </table>`;
    if (!openPrintWindow({ title: tr("Поставщики"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  const toggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  const printSupplier = (supplier: any, obligations: any[], total: number, paid: number, remain: number) => {
    const rowsHtml = obligations.map((p: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(p.project?.name || "—")}</td>
        <td>${esc(payableCategoryLabel(p.category))}</td>
        <td>${esc(formatDate(p.due_date))}</td>
        <td class="num">${esc(formatMoney(num(p.total_amount)))}</td>
        <td class="num">${esc(formatMoney(num(p.paid_amount)))}</td>
        <td class="num">${esc(formatMoney(Math.max(num(p.total_amount) - num(p.paid_amount), 0)))}</td>
      </tr>`).join("");
    const info = [
      supplier.phone ? `${tr("Телефон")}: ${esc(supplier.phone)}` : "",
      supplier.contact_person ? `${tr("Контактное лицо")}: ${esc(supplier.contact_person)}` : "",
      supplier.address ? `${tr("Адрес")}: ${esc(supplier.address)}` : "",
    ].filter(Boolean).join(" · ");
    const content = `
      <h1>${esc(tr("Поставщик"))}: ${esc(supplier.name)}</h1>
      <h2>${esc(formatDate(new Date()))}${info ? ` — ${info}` : ""}</h2>
      <table>
        <thead><tr>
          <th>№</th><th>${esc(tr("Проект"))}</th><th>${esc(tr("Категория"))}</th><th>${esc(tr("Срок оплаты"))}</th>
          <th class="num">${esc(tr("Сумма"))}</th><th class="num">${esc(tr("Оплачено"))}</th><th class="num">${esc(tr("Остаток"))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="4">${esc(tr("Итого"))}</td>
          <td class="num">${esc(formatMoney(total))}</td>
          <td class="num">${esc(formatMoney(paid))}</td>
          <td class="num">${esc(formatMoney(remain))}</td>
        </tr></tfoot>
      </table>`;
    if (!openPrintWindow({ title: `${tr("Поставщик")} — ${supplier.name}`, company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  const startNewPayable = (supplier: any) => { setNewPayableSupplier(supplier); setOpenNewPayable(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Поставщики")}
        subtitle={`${tr("Остаток к оплате")}: ${formatMoney(totalOutstanding)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" />{tr("Печать")}</Button>
            {canManage && (
              <>
                <ExcelImportSuppliers />
                <Dialog open={openNewSupplier} onOpenChange={setOpenNewSupplier}>
                  <DialogTrigger asChild><Button variant="outline"><Users className="h-4 w-4" />{tr("Новый поставщик")}</Button></DialogTrigger>
                  <SupplierDialog companyId={companyId} onClose={() => { setOpenNewSupplier(false); qc.invalidateQueries({ queryKey: ["suppliers"] }); }} />
                </Dialog>
                <Button onClick={() => startNewPayable(null)}><Plus className="h-4 w-4" />{tr("Новая задолженность")}</Button>
              </>
            )}
          </div>
        }

      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={tr("Поставщиков")} value={String(suppliers.length)} icon={Users} accent="accent" />
        <StatCard label={tr("Общая задолженность")} value={formatMoney(totalOutstanding)} icon={Banknote} accent="warning" />
        <StatCard label={tr("Просроченная")} value={formatMoney(totalOverdue)} icon={AlertCircle} accent="destructive" />
        <StatCard label={tr("Оплачено всего")} value={formatMoney(totalPaid)} icon={CheckCircle2} accent="success" />
      </div>

      {notifications.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BellRing className="h-4 w-4 text-warning-foreground" />{tr("Уведомления")} ({notifications.length})
          </div>
          <ul className="space-y-1.5">
            {notifications.slice(0, 8).map((n) => (
              <li key={n.id} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${n.tone === "danger" ? "bg-destructive" : n.tone === "warn" ? "bg-warning" : "bg-accent"}`} />
                <span className={n.tone === "danger" ? "text-destructive" : "text-muted-foreground"}>{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск: поставщик, телефон…")} className="pl-8" />
      </div>

      {isLoading ? (
        <EmptyState icon={Banknote} title={tr("Загрузка…")} />
      ) : groups.supRows.length === 0 && groups.legacy.length === 0 ? (
        <EmptyState icon={Users} title={suppliers.length === 0 ? tr("Поставщиков пока нет") : tr("Ничего не найдено")}
          description={suppliers.length === 0 ? tr("Добавьте поставщика, чтобы вести учёт долгов и оплат.") : undefined} />
      ) : (
        <div className="space-y-3">
          {groups.supRows.map((row: any) => {
            const s = row.supplier;
            const isOpen = !!expanded[s.id];
            return (
              <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggle(s.id)} className="text-muted-foreground hover:text-foreground">
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(s.id)}>
                    <div className="flex items-center gap-2 font-semibold">{s.name}{row.overdue && <Badge variant="outline" className={PAYABLE_STATUS.overdue.color}>{tr(PAYABLE_STATUS.overdue.label)}</Badge>}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                      {s.contact_person && <span className="flex items-center gap-1"><User className="h-3 w-3" />{s.contact_person}</span>}
                      <span>{row.obligations.length} {tr("долг(ов)")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{tr("Остаток")}</div>
                    <div className="font-semibold text-warning-foreground">{formatMoney(row.remain)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" title={tr("Печать")} onClick={() => printSupplier(s, row.obligations, row.total, row.paid, row.remain)}><Printer className="h-4 w-4" /></Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" title={tr("Новая задолженность")} onClick={() => startNewPayable(s)}><Plus className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" title={tr("Редактировать")} onClick={() => setEditSupplier(s)}><Pencil className="h-4 w-4" /></Button>
                        {isOwner && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title={tr("Удалить")}
                            onClick={() => { if (confirm(tr("Удалить поставщика? Связанные долги останутся без поставщика."))) delSupplier.mutate(s.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <ObligationsTable
                    rows={row.obligations} canManage={canManage} isPlatformAdmin={isPlatformAdmin}
                    onPay={setPayTarget} onEdit={setEditTarget} onHistory={setHistoryTarget}
                    onArchive={(p: any) => archive.mutate({ id: p.id, archived: !p.archived })}
                    onDelete={(p: any) => { if (confirm(tr("Удалить задолженность безвозвратно?"))) del.mutate(p.id); }}
                    formatMoney={formatMoney} tr={tr}
                  />
                )}
              </div>
            );
          })}

          {groups.legacy.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="p-4 text-sm font-semibold text-muted-foreground">{tr("Без поставщика")} ({groups.legacy.length})</div>
              <ObligationsTable
                rows={groups.legacy} showCounterparty canManage={canManage} isPlatformAdmin={isPlatformAdmin}
                onPay={setPayTarget} onEdit={setEditTarget} onHistory={setHistoryTarget}
                onArchive={(p: any) => archive.mutate({ id: p.id, archived: !p.archived })}
                onDelete={(p: any) => { if (confirm(tr("Удалить задолженность безвозвратно?"))) del.mutate(p.id); }}
                formatMoney={formatMoney} tr={tr}
              />
            </div>
          )}
        </div>
      )}

      {openNewPayable && (
        <Dialog open onOpenChange={(o) => { if (!o) { setOpenNewPayable(false); setNewPayableSupplier(null); } }}>
          <NewPayableDialog projects={projects} suppliers={suppliers} defaultSupplier={newPayableSupplier}
            onClose={() => { setOpenNewPayable(false); setNewPayableSupplier(null); qc.invalidateQueries({ queryKey: ["payables"] }); }} />
        </Dialog>
      )}
      {editSupplier && (
        <Dialog open onOpenChange={(o) => !o && setEditSupplier(null)}>
          <SupplierDialog companyId={companyId} supplier={editSupplier} onClose={() => { setEditSupplier(null); qc.invalidateQueries({ queryKey: ["suppliers"] }); }} />
        </Dialog>
      )}
      {payTarget && (
        <Dialog open onOpenChange={(o) => !o && setPayTarget(null)}>
          <PaymentDialog payable={payTarget} onClose={() => { setPayTarget(null); qc.invalidateQueries({ queryKey: ["payables"] }); }} />
        </Dialog>
      )}
      {editTarget && (
        <Dialog open onOpenChange={(o) => !o && setEditTarget(null)}>
          <EditPayableDialog payable={editTarget} projects={projects} suppliers={suppliers} onClose={() => { setEditTarget(null); qc.invalidateQueries({ queryKey: ["payables"] }); }} />
        </Dialog>
      )}
      {historyTarget && (
        <Dialog open onOpenChange={(o) => !o && setHistoryTarget(null)}>
          <HistoryDialog payable={historyTarget} canManage={canManage} onChanged={() => qc.invalidateQueries({ queryKey: ["payables"] })} />
        </Dialog>
      )}
    </div>
  );
}

function ObligationsTable({ rows, showCounterparty, canManage, isPlatformAdmin, onPay, onEdit, onHistory, onArchive, onDelete, formatMoney, tr }: any) {
  return (
    <div className="overflow-x-auto border-t border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {showCounterparty && <th className="px-4 py-3 text-left">{tr("Контрагент")}</th>}
            <th className="px-4 py-3 text-left">{tr("Проект")}</th>
            <th className="px-4 py-3 text-left">{tr("Категория")}</th>
            <th className="px-4 py-3 text-right">{tr("Сумма")}</th>
            <th className="px-4 py-3 text-right">{tr("Оплачено")}</th>
            <th className="px-4 py-3 text-right">{tr("Остаток")}</th>
            <th className="px-4 py-3 text-left">{tr("Срок оплаты")}</th>
            <th className="px-4 py-3 text-left">{tr("Статус")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((p: any) => {
            const total = num(p.total_amount);
            const paid = num(p.paid_amount);
            const remain = Math.max(total - paid, 0);
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
            const st = payableDisplayStatus(p.status, p.due_date);
            const d = daysUntil(p.due_date);
            return (
              <tr key={p.id} className="border-t border-border align-top">
                {showCounterparty && <td className="px-4 py-3 font-medium">{p.counterparty}</td>}
                <td className="px-4 py-3 text-muted-foreground">{p.project?.name}</td>
                <td className="px-4 py-3"><Badge variant="outline">{tr(payableCategoryLabel(p.category))}</Badge></td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(total)}</td>
                <td className="px-4 py-3 text-right text-success">{formatMoney(paid)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold">{formatMoney(remain)}</div>
                  <div className="text-[11px] text-muted-foreground">{pct}% {tr("оплачено")}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{formatDate(p.due_date)}</div>
                  {st !== "paid" && d !== null && (
                    <div className={`text-[11px] ${d < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {d < 0 ? `${tr("просрочка")} ${Math.abs(d)} ${tr("дн.")}` : `${d} ${tr("дн. до срока")}`}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><Badge variant="outline" className={PAYABLE_STATUS[st].color}>{tr(PAYABLE_STATUS[st].label)}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canManage && st !== "paid" && !p.archived && (
                      <Button variant="ghost" size="sm" title={tr("Оплатить")} onClick={() => onPay(p)} className="text-success hover:bg-success/10">
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" title={tr("История платежей")} onClick={() => onHistory(p)}>
                      <History className="h-4 w-4" />
                    </Button>
                    {p.document_file && (
                      <Button variant="ghost" size="sm" title={tr("Скачать документ")} onClick={() => downloadDoc(p.document_file)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="sm" title={tr("Редактировать")} onClick={() => onEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="sm" title={p.archived ? tr("Вернуть из архива") : tr("Архивировать")} onClick={() => onArchive(p)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    {isPlatformAdmin && (
                      <Button variant="ghost" size="sm" title={tr("Удалить")} className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SupplierDialog({ companyId, supplier, onClose }: { companyId: string | null; supplier?: any; onClose: () => void }) {
  const { tr } = useT();
  const isEdit = !!supplier;
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [contact, setContact] = useState(supplier?.contact_person ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [note, setNote] = useState(supplier?.note ?? "");
  const [patentNumber, setPatentNumber] = useState(supplier?.patent_number ?? "");
  const [patentFile, setPatentFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Укажите название поставщика");
      let patent_photo_path: string | null = supplier?.patent_photo_path ?? null;
      if (patentFile) {
        const cid = companyId ?? supplier?.company_id;
        const path = `${cid}/patents/${Date.now()}-${patentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("warehouse-docs").upload(path, patentFile, { contentType: patentFile.type });
        if (upErr) throw new Error(upErr.message);
        patent_photo_path = path;
      }
      if (isEdit) {
        const { error } = await (supabase as any).from("suppliers").update({
          name: name.trim(), phone: phone.trim() || null, contact_person: contact.trim() || null,
          address: address.trim() || null, note: note.trim() || null,
          patent_number: patentNumber.trim() || null, patent_photo_path,
        }).eq("id", supplier.id);
        if (error) throw error;
      } else {
        if (!companyId) throw new Error("Нет компании");
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from("suppliers").insert({
          company_id: companyId, name: name.trim(), phone: phone.trim() || null,
          contact_person: contact.trim() || null, address: address.trim() || null,
          note: note.trim() || null, patent_number: patentNumber.trim() || null,
          patent_photo_path, created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(tr("Сохранено")); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{isEdit ? tr("Редактировать поставщика") : tr("Новый поставщик")}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5"><Label>{tr("Название *")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{tr("Телефон")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{tr("Контактное лицо")}</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label>{tr("Адрес")}</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{tr("Рақами патент")}</Label><Input value={patentNumber} onChange={(e) => setPatentNumber(e.target.value)} placeholder="№ патента" /></div>
          <div className="space-y-1.5"><Label>{tr("Сурати патент")}</Label><Input type="file" accept="image/*" onChange={(e) => setPatentFile(e.target.files?.[0] ?? null)} /></div>
        </div>
        {supplier?.patent_photo_path && (
          <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={async () => {
            const { data } = await supabase.storage.from("warehouse-docs").createSignedUrl(supplier.patent_photo_path, 300);
            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
          }}>{tr("Дидани патенти ҷорӣ")}</Button>
        )}
        <div className="space-y-1.5"><Label>{tr("Примечание")}</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit" disabled={save.isPending}>{tr("Сохранить")}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function NewPayableDialog({ projects, suppliers, defaultSupplier, onClose }: { projects: any[]; suppliers: any[]; defaultSupplier: any; onClose: () => void }) {
  const { currency } = usePrefs();
  const { tr } = useT();
  const [supplierId, setSupplierId] = useState(defaultSupplier?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState<string>(PAYABLE_CATEGORIES[0].value);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Выберите поставщика");
      if (!projectId) throw new Error("Выберите проект");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Сумма должна быть больше 0");
      const supplier = suppliers.find((s: any) => s.id === supplierId);
      const { data: projRow } = await supabase.from("projects").select("company_id").eq("id", projectId).maybeSingle();
      const company_id = (projRow as any)?.company_id;
      if (!company_id) throw new Error("У проекта нет компании");

      let document_file: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${projectId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("payable-docs").upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(`Загрузка файла: ${upErr.message}`);
        document_file = path;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("payables").insert({
        company_id, project_id: projectId, supplier_id: supplierId,
        counterparty: supplier?.name ?? "", category,
        total_amount: amt, due_date: dueDate, description: description || null,
        document_file, currency, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Задолженность создана")); onClose(); },
    onError: (e: any) => toast.error(e.message || tr("Ошибка")),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{tr("Новая задолженность")}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <div className="space-y-1.5">
          <Label>{tr("Поставщик *")}</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Проект *")}</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{tr("Категория *")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYABLE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{tr(c.label)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{tr("Сумма *")}</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        </div>
        <div className="space-y-1.5"><Label>{tr("Срок оплаты *")}</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>{tr("Описание")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        <div className="space-y-1.5"><Label>{tr("Документ (договор/счёт/накладная)")}</Label><Input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <DialogFooter><Button type="submit" disabled={add.isPending}>{tr("Сохранить")}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditPayableDialog({ payable, projects, suppliers, onClose }: { payable: any; projects: any[]; suppliers: any[]; onClose: () => void }) {
  const { tr } = useT();
  const [supplierId, setSupplierId] = useState(payable.supplier_id ?? "");
  const [projectId, setProjectId] = useState(payable.project_id);
  const [category, setCategory] = useState<string>(payable.category);
  const [amount, setAmount] = useState(String(payable.total_amount));
  const [dueDate, setDueDate] = useState(payable.due_date);
  const [description, setDescription] = useState(payable.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Сумма должна быть больше 0");
      if (amt < Number(payable.paid_amount)) throw new Error("Сумма не может быть меньше уже оплаченного");
      const supplier = suppliers.find((s: any) => s.id === supplierId);
      const { error } = await (supabase as any).from("payables").update({
        supplier_id: supplierId || null,
        counterparty: supplier?.name ?? payable.counterparty,
        project_id: projectId, category,
        total_amount: amt, due_date: dueDate, description: description || null,
      }).eq("id", payable.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Сохранено")); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{tr("Редактировать задолженность")}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5">
          <Label>{tr("Поставщик")}</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Проект")}</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{tr("Категория")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYABLE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{tr(c.label)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{tr("Сумма")}</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        </div>
        <div className="space-y-1.5"><Label>{tr("Срок оплаты")}</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>{tr("Описание")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit" disabled={save.isPending}>{tr("Сохранить")}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function PaymentDialog({ payable, onClose }: { payable: any; onClose: () => void }) {
  const { formatMoney } = usePrefs();
  const { tr } = useT();
  const remain = Math.max(num(payable.total_amount) - num(payable.paid_amount), 0);
  const [amount, setAmount] = useState(String(remain));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(PAY_METHODS[0]);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const pay = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Сумма должна быть больше 0");
      if (amt > remain + 0.001) throw new Error(`Сумма больше остатка (${formatMoney(remain)})`);
      let document_file: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${payable.project_id}/payments/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("payable-docs").upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(`Загрузка файла: ${upErr.message}`);
        document_file = path;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("payable_payments").insert({
        payable_id: payable.id, amount: amt, payment_date: date, method, comment: comment || null,
        document_file, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Платёж проведён")); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{tr("Оплата")} · {payable.counterparty}</DialogTitle>
        <DialogDescription>{tr("Остаток к оплате")}: {formatMoney(remain)}</DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{tr("Сумма платежа *")}</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>{tr("Дата платежа *")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Способ оплаты")}</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{tr(m)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>{tr("Комментарий")}</Label><Input value={comment} onChange={(e) => setComment(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>{tr("Документ подтверждения")}</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <DialogFooter><Button type="submit" disabled={pay.isPending}>{tr("Провести оплату")}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function HistoryDialog({ payable, canManage, onChanged }: { payable: any; canManage: boolean; onChanged: () => void }) {
  const { formatMoney } = usePrefs();
  const { tr } = useT();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payable-payments", payable.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("payable_payments")
        .select("*").eq("payable_id", payable.id).order("payment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("payable_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Платёж удалён")); qc.invalidateQueries({ queryKey: ["payable-payments", payable.id] }); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{tr("История платежей")} · {payable.counterparty}</DialogTitle>
        <DialogDescription>
          {tr("Сумма")} {formatMoney(num(payable.total_amount))} · {tr("Оплачено")} {formatMoney(num(payable.paid_amount))}
        </DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{tr("Загрузка…")}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{tr("Платежей пока нет")}</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2 text-left">{tr("Дата")}</th><th className="py-2 text-left">{tr("Способ")}</th><th className="py-2 text-right">{tr("Сумма")}</th><th className="py-2" /></tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2">{formatDate(r.payment_date)}{r.comment && <div className="text-[11px] text-muted-foreground">{r.comment}</div>}</td>
                  <td className="py-2 text-muted-foreground">{r.method ? tr(r.method) : "—"}</td>
                  <td className="py-2 text-right font-semibold">{formatMoney(num(r.amount))}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.document_file && (
                        <Button variant="ghost" size="sm" onClick={() => downloadDoc(r.document_file)} title={tr("Документ")}><Download className="h-4 w-4" /></Button>
                      )}
                      {canManage && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                          onClick={() => { if (confirm(tr("Удалить платёж?"))) del.mutate(r.id); }} title={tr("Удалить")}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DialogContent>
  );
}
