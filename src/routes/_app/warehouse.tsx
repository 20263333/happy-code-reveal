import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Boxes, ArrowDownToLine, ArrowUpFromLine, Plus, Trash2, Printer, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { ExcelImportWarehouse } from "@/components/excel-import-warehouse";
import { compressImageFile } from "@/lib/image-compress";
import { scanInvoiceItems } from "@/lib/warehouse-ocr.functions";
import { checkLowStock } from "@/lib/supply.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

import { MATERIAL_UNITS, materialUnitLabel, formatDate } from "@/lib/constants";
import { MATERIAL_CATALOG, MATERIAL_GROUPS, findMaterialPreset } from "@/lib/material-catalog";
import { usePrefs } from "@/lib/preferences";
import { useAuth } from "@/hooks/use-auth";
import { useTabGate } from "@/lib/use-tab-gate";
import { WAREHOUSE_TAB_KEYS } from "@/lib/app-pages";
import { useT } from "@/lib/i18n";
import { usePeriodFilter } from "@/components/period-filter";
import { inRange } from "@/lib/finance";
import { ZhkBlockFilter, useZhkBlockFilter } from "@/components/zhk-block-filter";
import { toast } from "sonner";

// Сурати сканеро ба анбори файлҳо бор мекунад ва роҳи онро бармегардонад.
// Бе ин, дархости калони base64 аз планшет/телефон дар шабака рад мешавад (403).
async function uploadOcrImage(
  companyId: string | null,
  dataUrl: string,
  kind: string,
): Promise<string | null> {
  if (!companyId) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${companyId}/ocr/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${kind}.jpg`;
    const { error } = await supabase.storage
      .from("warehouse-docs")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_app/warehouse")({
  head: () => ({ meta: [{ title: "Склад — PLATFORM.TJ" }] }),
  component: WarehousePage,
});

function WarehousePage() {
  const { tr } = useT();
  const { formatMoney } = usePrefs();
  const { companyId, user, isDirector } = useAuth();
  const qc = useQueryClient();
  const inPeriod = usePeriodFilter("all");
  const outPeriod = usePeriodFilter("all");
  const [outZhk, setOutZhk] = useState({ zhkId: "", blockId: "" });
  const canModify = !isDirector;
  const tabOk = useTabGate();
  // Deleting warehouse rows requires the explicit "warehouse:delete" grant
  // (owners / platform admins bypass the gate automatically).
  const canDelete = canModify && tabOk(WAREHOUSE_TAB_KEYS.delete);

  const { data: items = [] } = useQuery({
    queryKey: ["wh-items", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("warehouse_items")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Ҳангоми кам шудани захира ба снабженец огоҳӣ (СМС + рӯйхат) фиристода мешавад
  useEffect(() => {
    if (!companyId || items.length === 0) return;
    const lowCount = items.filter(
      (i: any) => Number(i.quantity ?? 0) < Number(i.min_quantity ?? 10),
    ).length;
    if (lowCount === 0) return;
    void checkLowStock().catch(() => {});
  }, [companyId, items]);

  const { data: receipts = [] } = useQuery({
    queryKey: ["wh-receipts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("warehouse_receipts")
        .select("*, suppliers(name)")
        .eq("company_id", companyId)
        .order("receipt_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["wh-issues", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("warehouse_issues")
        .select("*, projects(name)")
        .eq("company_id", companyId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["wh-suppliers", companyId],
    queryFn: async () =>
      (await (supabase as any).from("suppliers").select("id, name, patent_number").eq("archived", false).order("name")).data ?? [],
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["wh-proj-with-parent", companyId],
    queryFn: async () => (await supabase.from("projects").select("id, name, parent_id").order("name")).data ?? [],
    enabled: !!companyId,
  });

  const { data: company } = useQuery({
    queryKey: ["wh-company", companyId],
    queryFn: async () => companyId ? (await supabase.from("companies").select("name, phone").eq("id", companyId).maybeSingle()).data : null,
    enabled: !!companyId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["wh-items", companyId] });
    qc.invalidateQueries({ queryKey: ["wh-receipts", companyId] });
    qc.invalidateQueries({ queryKey: ["wh-issues", companyId] });
  };

  const delReceipt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouse_receipts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OK"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delIssue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouse_issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OK"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouse_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Удалено")); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalStock = items.reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);

  const filteredReceipts = useMemo(
    () => (receipts as any[]).filter((r) => !inPeriod.active || inRange(r.receipt_date, inPeriod.fromDate, inPeriod.toDate)),
    [receipts, inPeriod.active, inPeriod.fromDate, inPeriod.toDate],
  );
  const outAllowedIds = useZhkBlockFilter(projects as any, outZhk);
  const filteredIssues = useMemo(
    () => (issues as any[])
      .filter((r) => !outPeriod.active || inRange(r.issue_date, outPeriod.fromDate, outPeriod.toDate))
      .filter((r) => !outAllowedIds || outAllowedIds.has(r.project_id)),
    [issues, outPeriod.active, outPeriod.fromDate, outPeriod.toDate, outAllowedIds],
  );

  const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));

  const printStyles = `
    * { font-family: Arial, sans-serif; }
    body { margin: 32px; color: #1a1a1a; }
    .doc-no { text-align: left; font-size: 13px; margin-bottom: 6px; }
    .company-header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
    .company-header .name { font-size: 26px; font-weight: bold; letter-spacing: 0.5px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
    th { background: #f0f0f0; }
    .total { margin-top: 16px; font-size: 14px; font-weight: bold; text-align: right; }
    .usd-box { margin-top: 10px; }
    .usd-box table { width: auto; margin-left: auto; font-size: 11px; }
    .usd-box th { background: #f7f7f7; text-align: center; padding: 3px 10px; }
    .usd-box td { height: 20px; text-align: right; padding: 3px 10px; min-width: 100px; }
    .signs { margin-top: 30px; font-size: 12px; }
    .signs-grid { display: flex; flex-direction: column; gap: 18px; }
    .signs-row { display: flex; gap: 24px; justify-content: space-between; }
    .signs-row .line { display: flex; align-items: baseline; flex: 1; }
    .signs-row .num { min-width: 18px; }
    .signs-row .title { min-width: 90px; }
    .signs-row .blank { flex: 1; border-bottom: 1px solid #333; margin-left: 4px; min-width: 100px; }
    @media print { body { margin: 12mm; } }
  `;

  const signsBlockHtml = `
    <div class="signs">
      <div class="signs-grid">
        <div class="signs-row">
          <div class="line"><span class="num">1.</span><span class="title">${tr("Мухосиб")}</span><span class="blank"></span></div>
          <div class="line"><span class="num">2.</span><span class="title">${tr("Таъминотчи")}</span><span class="blank"></span></div>
          <div class="line"><span class="num">3.</span><span class="title">${tr("Прораб")}</span><span class="blank"></span></div>
        </div>
        <div class="signs-row">
          <div class="line"><span class="num">4.</span><span class="title">${tr("Роҳбар")}</span><span class="blank"></span></div>
          <div class="line"><span class="num">5.</span><span class="title">${tr("Роҳбар")}</span><span class="blank"></span></div>
        </div>
      </div>
    </div>
  `;

  const headerHtml = `
    <div class="doc-no">№________</div>
    <div class="company-header">
      <div class="name">${esc(company?.name || "PLATFORM.TJ")}</div>
    </div>
  `;

  const usdBoxHtml = `
    <div class="usd-box">
      <table>
        <thead><tr>
          <th>${tr("Курси доллар")} ($)</th>
          <th>${tr("Маблағ бо")} $</th>
        </tr></thead>
        <tbody><tr><td></td><td></td></tr></tbody>
      </table>
    </div>
  `;

  const openPrintDoc = (bodyHtml: string) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title><style>${printStyles}</style></head><body>${headerHtml}${bodyHtml}${usdBoxHtml}${signsBlockHtml}<script>window.onload=function(){window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error(tr("Разрешите всплывающие окна")); return; }
    w.document.write(html); w.document.close();
  };

  const tableHead = (cols: string[]) => `<thead><tr>${cols.join("")}</tr></thead>`;
  const stockCols = [
    `<th>№</th>`, `<th>${tr("Наименование товара")}</th>`, `<th>${tr("Ед.изм")}</th>`,
    `<th style="text-align:right">${tr("Количество")}</th>`,
    `<th style="text-align:right">${tr("Цена")}</th>`,
    `<th style="text-align:right">${tr("Итого сумма")}</th>`,
  ];

  const handlePrint = () => {
    if (items.length === 0) { toast.error(tr("Складских позиций пока нет")); return; }
    const rows = items.map((i: any, idx: number) => {
      const sum = Number(i.quantity || 0) * Number(i.unit_price || 0);
      return `<tr><td>${idx + 1}</td><td>${esc(i.name)}</td><td>${esc(materialUnitLabel(i.unit))}</td><td style="text-align:right">${Number(i.quantity).toLocaleString()}</td><td style="text-align:right">${i.unit_price ? esc(formatMoney(i.unit_price)) : "—"}</td><td style="text-align:right">${i.unit_price ? esc(formatMoney(sum)) : "—"}</td></tr>`;
    }).join("");
    openPrintDoc(`<table>${tableHead(stockCols)}<tbody>${rows}</tbody></table><div class="total">${tr("Итого")}: ${esc(formatMoney(totalStock))}</div>`);
  };

  const printItem = (i: any) => {
    const sum = Number(i.quantity || 0) * Number(i.unit_price || 0);
    const row = `<tr><td>1</td><td>${esc(i.name)}</td><td>${esc(materialUnitLabel(i.unit))}</td><td style="text-align:right">${Number(i.quantity).toLocaleString()}</td><td style="text-align:right">${i.unit_price ? esc(formatMoney(i.unit_price)) : "—"}</td><td style="text-align:right">${i.unit_price ? esc(formatMoney(sum)) : "—"}</td></tr>`;
    openPrintDoc(`<table>${tableHead(stockCols)}<tbody>${row}</tbody></table><div class="total">${tr("Итого")}: ${esc(formatMoney(sum))}</div>`);
  };

  const printIssues = () => {
    if (filteredIssues.length === 0) { toast.error(tr("Расходов пока нет")); return; }
    const totalSum = filteredIssues.reduce((s: number, r: any) => s + Number(r.quantity || 0) * Number(r.unit_price || 0), 0);
    const cols = [
      `<th>№</th>`, `<th>${tr("Дата")}</th>`, `<th>${tr("Проект")}</th>`, `<th>${tr("Наименование товара")}</th>`,
      `<th>${tr("Ед.изм")}</th>`,
      `<th style="text-align:right">${tr("Количество")}</th>`,
      `<th style="text-align:right">${tr("Цена")}</th>`,
      `<th style="text-align:right">${tr("Итого сумма")}</th>`,
    ];
    const rows = filteredIssues.map((r: any, idx: number) => {
      const sum = Number(r.quantity || 0) * Number(r.unit_price || 0);
      return `<tr><td>${idx + 1}</td><td>${esc(formatDate(r.issue_date))}</td><td>${esc(r.projects?.name ?? "—")}</td><td>${esc(r.name)}</td><td>${esc(materialUnitLabel(r.unit))}</td><td style="text-align:right">${Number(r.quantity).toLocaleString()}</td><td style="text-align:right">${r.unit_price ? esc(formatMoney(r.unit_price)) : "—"}</td><td style="text-align:right">${r.unit_price ? esc(formatMoney(sum)) : "—"}</td></tr>`;
    }).join("");
    openPrintDoc(`<table>${tableHead(cols)}<tbody>${rows}</tbody></table><div class="total">${tr("Итого")}: ${esc(formatMoney(totalSum))}</div>`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={tr("Склад")}
        subtitle={tr("Учёт прихода, расхода и остатков на складе компании.")}
        actions={
          <div className="flex items-center gap-2">
            {canModify && <ExcelImportWarehouse />}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />{tr("Печать")}
            </Button>
          </div>
        }
      />


      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={tr("Позиций материалов")} value={items.length} icon={Boxes} />
        <StatCard label={tr("Стоимость остатков")} value={formatMoney(totalStock)} icon={Boxes} accent="success" />
        <StatCard label={tr("Приходов")} value={receipts.length} icon={ArrowDownToLine} accent="accent" />
      </div>

      <Tabs defaultValue={([["stock", WAREHOUSE_TAB_KEYS.stock], ["in", WAREHOUSE_TAB_KEYS.in], ["out", WAREHOUSE_TAB_KEYS.out]] as const).find(([, k]) => tabOk(k))?.[0]}>
        <TabsList>
          {tabOk(WAREHOUSE_TAB_KEYS.stock) && <TabsTrigger value="stock">{tr("Склад")}</TabsTrigger>}
          {tabOk(WAREHOUSE_TAB_KEYS.in) && <TabsTrigger value="in">{tr("Приход")}</TabsTrigger>}
          {tabOk(WAREHOUSE_TAB_KEYS.out) && <TabsTrigger value="out">{tr("Расход")}</TabsTrigger>}
        </TabsList>


        {/* === Склад (остатки) === */}
        {tabOk(WAREHOUSE_TAB_KEYS.stock) && <TabsContent value="stock" className="mt-4">
          {items.length === 0 ? (
            <EmptyState icon={Boxes} title={tr("Склад пуст")} description={tr("Добавьте приход товара, чтобы пополнить склад.")} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{tr("Дата")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Наименование товара")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Ед.изм")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Количество")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Цена")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Итого сумма")}</th>
                    {canModify && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i: any) => (
                    <tr
                      key={i.id}
                      className={`border-t border-border${Number(i.quantity ?? 0) < Number(i.min_quantity ?? 10) ? " low-stock-row" : ""}`}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(i.updated_at)}</td>
                      <td className="px-4 py-2.5 font-medium">{i.name}</td>
                      <td className="px-4 py-2.5">{materialUnitLabel(i.unit)}</td>
                      <td className="px-4 py-2.5 text-right">{Number(i.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatMoney(i.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatMoney(Number(i.quantity || 0) * Number(i.unit_price || 0))}
                      </td>
                       {canModify && (
                         <td className="px-4 py-2.5 text-right whitespace-nowrap">
                           <Button size="icon" variant="ghost" onClick={() => printItem(i)} title={tr("Печать")}>
                             <Printer className="h-4 w-4" />
                           </Button>
                           {canDelete && (
                             <Button size="icon" variant="ghost" onClick={() => { if (confirm(tr("Удалить?"))) delItem.mutate(i.id); }}>
                               <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                           )}
                         </td>
                       )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {/* === Приход товара === */}
        {tabOk(WAREHOUSE_TAB_KEYS.in) && <TabsContent value="in" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-4 print:hidden">
            {canModify && (
              <ReceiptDialog
                companyId={companyId}
                userId={user?.id}
                stockItems={items}
                suppliers={suppliers}
                receipts={receipts}
                onDone={refresh}
              />
            )}
          </div>
          <div className="print:hidden">{inPeriod.control}</div>
          {filteredReceipts.length === 0 ? (
            <EmptyState icon={ArrowDownToLine} title={tr("Приходов пока нет")} description={tr("Добавьте поступление товара от поставщика.")} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{tr("Дата")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Наименование товара")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Ед.изм")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Количество")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Цена")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Итого сумма")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Поставщик")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Рақами чек")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("ФИО")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Статус оплаты")}</th>
                    {canDelete && <th className="px-4 py-2.5 print:hidden"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((r: any) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.receipt_date)}</td>
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5">{materialUnitLabel(r.unit)}</td>
                      <td className="px-4 py-2.5 text-right">{Number(r.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatMoney(r.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(r.total)}</td>
                      <td className="px-4 py-2.5">{r.suppliers?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.check_number ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{r.check_number}</span>
                            {r.check_photo_path && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" title={tr("Сурати чек")}
                                onClick={async () => {
                                  const { data } = await supabase.storage.from("warehouse-docs").createSignedUrl(r.check_photo_path, 300);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}>
                                <ScanLine className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">{r.supplier_fio ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.payment_status === "cash" ? (
                          <Badge className="bg-success/15 text-success border-success/30">{tr("Наличными")}</Badge>
                        ) : (
                          <Badge className="bg-warning/20 text-warning-foreground border-warning/40">{tr("В долг")}</Badge>
                        )}
                      </td>
                       {canDelete && <td className="px-4 py-2.5 print:hidden">
                         <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                           onClick={() => { if (confirm(tr("Удалить запись?"))) delReceipt.mutate(r.id); }}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {/* === Расход товара === */}
        {tabOk(WAREHOUSE_TAB_KEYS.out) && <TabsContent value="out" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={printIssues}>
              <Printer className="mr-2 h-4 w-4" />{tr("Печать расхода")}
            </Button>
            {canModify && <IssueDialog companyId={companyId} userId={user?.id} items={items} projects={projects} onDone={refresh} />}
          </div>
          <div className="print:hidden">{outPeriod.control}</div>
          <div className="print:hidden">
            <ZhkBlockFilter projects={projects as any} value={outZhk} onChange={setOutZhk} />
          </div>
          {filteredIssues.length === 0 ? (
            <EmptyState icon={ArrowUpFromLine} title={tr("Расходов пока нет")} description={tr("Спишите товар со склада на проект (блок).")} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{tr("Дата")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Проект")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Наименование товара")}</th>
                    <th className="px-4 py-2.5 text-left">{tr("Ед.изм")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Количество")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Цена")}</th>
                    {canDelete && <th className="px-4 py-2.5 print:hidden"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((r: any) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.issue_date)}</td>
                      <td className="px-4 py-2.5 font-medium">{r.projects?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.name}</td>
                      <td className="px-4 py-2.5">{materialUnitLabel(r.unit)}</td>
                      <td className="px-4 py-2.5 text-right">{Number(r.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{r.unit_price ? formatMoney(r.unit_price) : "—"}</td>
                       {canDelete && <td className="px-4 py-2.5 print:hidden">
                         <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                           onClick={() => { if (confirm(tr("Удалить запись?"))) delIssue.mutate(r.id); }}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}
      </Tabs>
    </div>
  );
}

function normCode(v: string): string {
  return v.toLowerCase().replace(/[^0-9a-zа-яёӯқғҳҷӣ]/gi, "");
}

function ReceiptDialog({ companyId, userId, suppliers, receipts, onDone, stockItems = [] }: { companyId: string | null; userId?: string; suppliers: any[]; receipts: any[]; onDone: () => void; stockItems?: any[] }) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("dona");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [fio, setFio] = useState("");
  const [status, setStatus] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkNumber, setCheckNumber] = useState("");
  const [checkFile, setCheckFile] = useState<File | null>(null);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [scanningItems, setScanningItems] = useState(false);
  const [scannedItems, setScannedItems] = useState<{ name: string; unit: string; quantity: number; unit_price: number }[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MATERIAL_CATALOG.filter(
      (m) => (category === "all" || m.group === category) && (!q || m.name.toLowerCase().includes(q)),
    ).slice(0, 200);
  }, [category, search]);

  const scanItems = async () => {
    if (invoiceFiles.length === 0) { toast.error(tr("Аввал сурати накладнойро бор кунед")); return; }
    setScanningItems(true);
    try {
      // Ҳар сурат ҷудогона ва хурд фиристода мешавад, то камераи планшет
      // дархости аз ҳад калон насозад.
      const all: { name: string; unit: string; quantity: number; unit_price: number }[] = [];
      let lastErr: any = null;
      for (const f of invoiceFiles.slice(0, 4)) {
        const img = await compressImageFile(f, { maxSize: 1400, quality: 0.75, maxBytes: 700_000 });
        // Сурат аввал ба анбор бор мешавад; ба сервер танҳо роҳи файл меравад.
        const path = await uploadOcrImage(companyId, img, "invoice");
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const res = await scanInvoiceItems({ data: path ? { paths: [path] } : { images: [img] } });
            all.push(...res.items);
            ok = true;
          } catch (e) {
            lastErr = e;
            // Шабакаи планшет баъзан дархости аввалро мебандад — як бор такрор мекунем.
            if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }
      if (!all.length) {
        if (lastErr) throw lastErr;
        toast.warning(tr("Товар ёфт нашуд — дастӣ ворид кунед"));
      } else {
        setScannedItems(all);
        toast.success(tr("Товарҳо хонда шуданд") + `: ${all.length}`);
      }
    } catch (e: any) {
      const message = String(e?.message ?? "");
      toast.error(
        message.includes("403") || message.includes("Forbidden")
          ? tr("Сурат фиристода нашуд. Интернетро санҷед ва аз нав сурат гиред")
          : message || tr("Сканер накладнойро хонда натавонист"),
      );

    } finally {
      setScanningItems(false);
    }
  };


  const patchItem = (i: number, patch: Partial<{ name: string; unit: string; quantity: number; unit_price: number }>) =>
    setScannedItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setScannedItems((prev) => prev.filter((_, idx) => idx !== i));
  const itemsTotal = scannedItems.reduce((s, it) => s + it.quantity * it.unit_price, 0);


  

  const duplicate = useMemo(() => {
    const n = normCode(checkNumber);
    if (!n) return null;
    return receipts.find((r: any) => r.check_number && normCode(String(r.check_number)) === n) ?? null;
  }, [checkNumber, receipts]);

  const add = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error(tr("Компания не найдена"));
      const rows = scannedItems.map((it) => ({ name: it.name.trim(), unit: it.unit || "dona", quantity: Number(it.quantity), unit_price: Number(it.unit_price || 0) }));
      // Сатри дастии пуркардашуда низ ба рӯйхат ҳамроҳ мешавад.
      if (name.trim() || Number(quantity) > 0) {
        rows.push({ name: name.trim(), unit, quantity: Number(quantity), unit_price: Number(unitPrice || 0) });
      }
      if (rows.length === 0) throw new Error(tr("Укажите название"));
      if (rows.some((r) => !r.name)) throw new Error(tr("Укажите название"));
      if (rows.some((r) => !(r.quantity > 0))) throw new Error(tr("Количество должно быть больше 0"));
      if (!supplierId) throw new Error(tr("Выберите поставщика"));
      if (!checkNumber.trim()) throw new Error(tr("Рақами чекро ворид кунед"));
      if (!checkFile) throw new Error(tr("Сурати чекро бор кунед"));
      if (duplicate) throw new Error(tr("Ин чек аллакай дар склад сабт шудааст — ворид кардан мумкин нест"));

      const upload = async (file: File, kind: string) => {
        const dataUrl = await compressImageFile(file);
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${companyId}/receipts/${Date.now()}-${kind}.jpg`;
        const { error: upErr } = await supabase.storage.from("warehouse-docs").upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw new Error(upErr.message);
        return path;
      };
      const check_photo_path = await upload(checkFile, "check");

      const { error } = await (supabase as any).from("warehouse_receipts").insert(
        rows.map((r) => ({
          company_id: companyId,
          name: r.name,
          unit: r.unit,
          quantity: r.quantity,
          unit_price: r.unit_price,
          supplier_id: supplierId || null,
          supplier_fio: fio.trim() || null,
          payment_status: status,
          receipt_date: date,
          check_number: checkNumber.trim(),
          check_photo_path,
          docs_source: "manual",
          created_by: userId ?? null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("Приход добавлен"));
      setOpen(false);
      setName(""); setQuantity(""); setUnitPrice(""); setSupplierId(""); setFio(""); setStatus("cash");
      setCheckNumber(""); setCheckFile(null);
      setInvoiceFiles([]); setScannedItems([]);

      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />{tr("Добавить приход")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{tr("Приход товара")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5"><Label>{tr("Дата")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <Label>{tr("Сурати накладной (номи товарҳо)")}</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setInvoiceFiles(Array.from(e.target.files ?? []).slice(0, 4))}
            />
            {invoiceFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">{tr("Суратҳо")}: {invoiceFiles.length}</p>
            )}
            <Button type="button" variant="outline" className="w-full" disabled={scanningItems || invoiceFiles.length === 0} onClick={scanItems}>
              <ScanLine className="mr-2 h-4 w-4" />{scanningItems ? tr("Хонда истодааст…") : tr("Сканер кардани товарҳо")}
            </Button>
          </div>

          <datalist id="material-catalog">
            {MATERIAL_CATALOG.map((m) => (
              <option key={m.name} value={m.name}>{m.group}</option>
            ))}
          </datalist>

          {/* Интихоби чанд намуд мавод аз рӯи категория */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <Label>{tr("Категория")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder={tr("Ҳама категорияҳо")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Ҳама категорияҳо")}</SelectItem>
                {MATERIAL_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={search}
              placeholder={tr("Ҷустуҷӯи мавод")}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {filteredCatalog.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">{tr("Ёфт нашуд")}</p>
              ) : filteredCatalog.map((m) => {
                const checked = picked.includes(m.name);
                return (
                  <label key={m.name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setPicked((prev) => checked ? prev.filter((x) => x !== m.name) : [...prev, m.name])}
                    />
                    <span className="flex-1">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{tr(materialUnitLabel(m.unit))}</span>
                  </label>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={picked.length === 0}
              onClick={() => {
                setScannedItems((prev) => {
                  const next = [...prev];
                  for (const n of picked) {
                    if (next.some((r) => r.name.trim().toLowerCase() === n.toLowerCase())) continue;
                    const p = findMaterialPreset(n);
                    next.push({ name: n, unit: p?.unit ?? "dona", quantity: 1, unit_price: 0 });
                  }
                  return next;
                });
                setPicked([]);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />{tr("Илова кардани интихобшудаҳо")} {picked.length > 0 ? `(${picked.length})` : ""}
            </Button>
          </div>

          {/* Воридкунии дастӣ (агар мавод дар рӯйхат набошад) */}
          <div className="space-y-1.5">
            <Label>{tr("Наименование товара")}</Label>
            <div className="flex gap-2">
              <Input
                list="material-catalog"
                value={name}
                placeholder={tr("Номи товарро нависед ё аз рӯйхат интихоб кунед")}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  const preset = findMaterialPreset(v);
                  if (preset) setUnit(preset.unit);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  const n = name.trim();
                  if (!n) { toast.error(tr("Укажите название")); return; }
                  setScannedItems((prev) => [...prev, { name: n, unit, quantity: 1, unit_price: 0 }]);
                  setName(""); setQuantity(""); setUnitPrice("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Рӯйхати маводҳои интихобшуда — миқдор ва нархи ҳар яке */}
          {scannedItems.length > 0 && (
            <div className="space-y-2">
              {scannedItems.map((it, i) => (
                <div key={i} className="rounded-md border border-border bg-background p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      list="material-catalog"
                      value={it.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        const preset = findMaterialPreset(v);
                        patchItem(i, preset ? { name: v, unit: preset.unit } : { name: v });
                      }}
                      className="h-8 text-sm"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{tr("Количество")}</Label>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => patchItem(i, { quantity: Math.max(0, Number((it.quantity - 1).toFixed(3))) })}>−</Button>
                        <Input type="number" step="any" value={it.quantity} onChange={(e) => patchItem(i, { quantity: Number(e.target.value) })} className="h-8 w-20 text-center text-sm" />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => patchItem(i, { quantity: Number((it.quantity + 1).toFixed(3)) })}>+</Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr("Ед.изм")}</Label>
                      <Select value={it.unit} onValueChange={(v) => patchItem(i, { unit: v })}>
                        <SelectTrigger className="h-8 w-24 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MATERIAL_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{tr(u.label)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tr("Цена за единицу")}</Label>
                      <Input type="number" step="any" value={it.unit_price} onChange={(e) => patchItem(i, { unit_price: Number(e.target.value) })} className="h-8 w-28 text-sm" />
                    </div>
                    <span className="ml-auto text-sm font-medium">{(it.quantity * it.unit_price).toLocaleString()} {tr("сомонӣ")}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>{tr("Ҳамагӣ")}</span>
                <span>{itemsTotal.toLocaleString()} {tr("сомонӣ")}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{tr("Поставщик")} *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder={tr("Выберите поставщика")} /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tr("Сурати чек")} *</Label>
              <Input type="file" accept="image/*" capture="environment" onChange={(e) => setCheckFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Рақами чек")} *</Label>
              <Input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                className={duplicate ? "border-destructive text-destructive" : ""}
              />
              {duplicate && (
                <p className="text-xs font-medium text-destructive">
                  {tr("Ин чек аллакай сабт шудааст")} ({formatDate(duplicate.receipt_date)} — {duplicate.name})
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5"><Label>{tr("ФИО")}</Label><Input value={fio} onChange={(e) => setFio(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>{tr("Статус оплаты")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{tr("Наличными")}</SelectItem>
                <SelectItem value="credit">{tr("В долг")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={add.isPending || !!duplicate}>{tr("Добавить")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ companyId, userId, items, projects, onDone }: { companyId: string | null; userId?: string; items: any[]; projects: any[]; onDone: () => void }) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState<string>("");
  const [zhkId, setZhkId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const zhkList = projects.filter((p: any) => !p.parent_id);
  const blockList = projects.filter((p: any) => p.parent_id === zhkId);
  const hasBlocks = blockList.length > 0;

  const selected = items.find((i) => i.id === itemId);

  const add = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error(tr("Компания не найдена"));
      if (!selected) throw new Error(tr("Выберите товар"));
      if (!zhkId) throw new Error(tr("Выберите ЖК"));
      const finalProjectId = hasBlocks ? projectId : zhkId;
      if (hasBlocks && !projectId) throw new Error(tr("Выберите блок"));
      const q = Number(quantity);
      if (!(q > 0)) throw new Error(tr("Количество должно быть больше 0"));
      if (q > Number(selected.quantity)) throw new Error(tr("Недостаточно на складе"));
      const { error } = await supabase.from("warehouse_issues").insert({
        company_id: companyId,
        project_id: finalProjectId,
        name: selected.name,
        unit: selected.unit,
        quantity: q,
        unit_price: unitPrice ? Number(unitPrice) : null,
        issue_date: date,
        created_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("Расход списан"));
      setOpen(false);
      setItemId(""); setZhkId(""); setProjectId(""); setQuantity(""); setUnitPrice("");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />{tr("Добавить расход")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{tr("Расход товара")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5"><Label>{tr("Дата")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>{tr("ЖК")}</Label>
            <Select value={zhkId} onValueChange={(v) => { setZhkId(v); setProjectId(""); }}>
              <SelectTrigger><SelectValue placeholder={tr("Выберите ЖК")} /></SelectTrigger>
              <SelectContent>
                {zhkList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {zhkId && hasBlocks && (
            <div className="space-y-1.5">
              <Label>{tr("Блок")}</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder={tr("Выберите блок")} /></SelectTrigger>
                <SelectContent>
                  {blockList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{tr("Наименование товара")}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder={tr("Выберите товар")} /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({Number(i.quantity)} {materialUnitLabel(i.unit)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tr("Количество")}{selected ? ` (${materialUnitLabel(selected.unit)})` : ""}</Label>
              <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-1.5"><Label>{tr("Цена (необязательно)")}</Label><Input type="number" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder={selected ? String(selected.unit_price) : ""} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={add.isPending}>{tr("Списать")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
