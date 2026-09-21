import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileSpreadsheet, Plus, Download, Landmark, Calculator, Building2, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_app/tax-reports")({
  head: () => ({ meta: [{ title: "Ҳисоботи давлатӣ — Binosoz.tj" }] }),
  component: TaxReportsPage,
});

// Ставкаҳои андоз (Тоҷикистон). Заминаи ҳисоб (base):
//  - income: profit (даромад - хароҷот) × 13%
//  - profit_general: profit × 18% (барои шахси ҳуқуқии умумӣ)
//  - vat: revenue × 14% (нархҳо бидуни ААИ)
//  - social: маоши коргарон (worker_payments) × 25%
//  - labor/annual/quarter: танҳо ҷамъбаст, андоз ҳисоб намешавад
const TYPES = [
  { v: "income", l: "Андоз аз даромад (13% — соддашуда)", rate: 0.13, base: "profit" },
  { v: "profit_general", l: "Андоз аз фоида (18% — умумӣ)", rate: 0.18, base: "profit" },
  { v: "vat", l: "ААИ (VAT/НДС 14%)", rate: 0.14, base: "revenue" },
  { v: "social", l: "Андози иҷтимоӣ (СИН 25% аз маош)", rate: 0.25, base: "wages" },
  { v: "labor", l: "Ҳисоботи меҳнатӣ", rate: 0, base: "none" },
  { v: "annual", l: "Декларатсияи солона", rate: 0, base: "profit" },
  { v: "quarter", l: "Ҳисоботи семоҳа", rate: 0, base: "profit" },
];

function TaxReportsPage() {
  const { companyId, isOwner, isDirector } = useAuth();
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ["tax-reports", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("tax_reports").select("*").eq("company_id", companyId).order("period_end", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const totalTax = reports.filter((r: any) => r.status === "submitted" || r.status === "accepted").reduce((s: number, r: any) => s + Number(r.tax_amount || 0), 0);
  const drafts = reports.filter((r: any) => r.status === "draft").length;
  const submitted = reports.filter((r: any) => r.status === "submitted" || r.status === "accepted").length;

  const export1C = async (r: any) => {
    // Simple 1С-compatible CSV export
    const rows = [
      ["Показатель", "Значение"],
      ["Тип отчёта", TYPES.find((t) => t.v === r.report_type)?.l ?? r.report_type],
      ["Период с", r.period_start],
      ["Период по", r.period_end],
      ["Доход", String(r.revenue)],
      ["Расход", String(r.expenses)],
      ["Прибыль", String(r.profit)],
      ["Налог", String(r.tax_amount)],
      ["Статус", r.status],
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `1c-export-${r.report_type}-${r.period_start}-${r.period_end}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Экспорт ба формати 1С");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ҳисоботи давлатӣ (ТҶ)" subtitle="Декларатсия, андоз, экспорт ба 1С" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Ҳисоботҳо" value={String(reports.length)} icon={FileSpreadsheet} />
        <StatCard label="Черновик" value={String(drafts)} icon={Calculator} />
        <StatCard label="Супоридашуда" value={String(submitted)} icon={Landmark} accent="success" />
        <StatCard label="Ҳамагӣ андоз" value={formatMoney(totalTax)} icon={Landmark} accent="warning" />
      </div>

      {isOwner && !isDirector && <NewReportDialog companyId={companyId} onSaved={() => qc.invalidateQueries({ queryKey: ["tax-reports", companyId] })} />}

      {reports.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="Ҳисобот нест" description="Ҳисоботи навро эҷод кунед" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Навъ</th>
                <th className="px-4 py-3 text-left">Давра</th>
                <th className="px-4 py-3 text-right">Даромад</th>
                <th className="px-4 py-3 text-right">Ҳароҷот</th>
                <th className="px-4 py-3 text-right">Фоида</th>
                <th className="px-4 py-3 text-right">Андоз</th>
                <th className="px-4 py-3 text-left">Ҳолат</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{TYPES.find((t) => t.v === r.report_type)?.l ?? r.report_type}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(r.period_start)} — {formatDate(r.period_end)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(r.revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(r.expenses)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(r.profit)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-warning">{formatMoney(r.tax_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "accepted" ? "default" : r.status === "submitted" ? "secondary" : "outline"}>
                      {r.status === "draft" ? "Черновик" : r.status === "submitted" ? "Супорида" : r.status === "accepted" ? "Қабул шуд" : r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => export1C(r)}><Download className="h-3 w-3 mr-1" />1С</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewReportDialog({ companyId, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    report_type: "quarter", period_start: "", period_end: "", status: "draft",
  });
  const [computing, setComputing] = useState(false);
  const [preview, setPreview] = useState<{ revenue: number; expenses: number; profit: number; tax: number } | null>(null);

  const compute = async () => {
    if (!companyId || !f.period_start || !f.period_end) return toast.error("Давра лозим");
    setComputing(true);
    const [{ data: projects }, { data: companyWages }] = await Promise.all([
      supabase.from("projects").select("id").eq("company_id", companyId),
      (supabase as any).from("worker_payments").select("paid_amount, paid_date").eq("company_id", companyId)
        .gte("paid_date", f.period_start).lte("paid_date", f.period_end),
    ]);
    const projectIds = (projects ?? []).map((project) => project.id);
    const { data: companySales } = await supabase.from("sales").select("id").eq("company_id", companyId);
    const saleIds = (companySales ?? []).map((sale) => sale.id);
    // Даромад = пардохтҳои тасдиқшуда дар давра
    const pays = saleIds.length ? (await supabase.from("payments").select("amount, payment_date, status")
      .in("sale_id", saleIds).eq("status", "confirmed").gte("payment_date", f.period_start).lte("payment_date", f.period_end)).data : [];
    // Хароҷот = ҳамаи хароҷот дар давра
    const exps = projectIds.length ? (await supabase.from("expenses").select("amount, expense_date")
      .in("project_id", projectIds).gte("expense_date", f.period_start).lte("expense_date", f.period_end)).data : [];
    // Маош = пардохти коргарон дар давра (заминаи СИН ва як қисми хароҷоти умумӣ)
    const wages = companyWages ?? [];
    const revenue = (pays ?? []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
    const expensesOnly = (exps ?? []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const wagesTotal = (wages ?? []).reduce((s: number, w: any) => s + Number(w.paid_amount || 0), 0);
    // Хароҷоти умумӣ = expenses + маош (маош дар expenses нест, барои ин ҷудо ҷамъ мешавад)
    const expenses = expensesOnly + wagesTotal;
    const profit = revenue - expenses;
    const type = TYPES.find((t) => t.v === f.report_type);
    const rate = type?.rate ?? 0;
    let base = 0;
    if (type?.base === "revenue") base = revenue;
    else if (type?.base === "wages") base = wagesTotal;
    else if (type?.base === "profit") base = Math.max(0, profit); // андоз аз фоидаи манфӣ ситонида намешавад
    const tax = base * rate;
    setPreview({ revenue, expenses, profit, tax });
    setComputing(false);
  };

  const save = async () => {
    if (!preview) return toast.error("Аввал ҳисоб кунед");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("tax_reports").insert({
      company_id: companyId, report_type: f.report_type, period_start: f.period_start,
      period_end: f.period_end, revenue: preview.revenue, expenses: preview.expenses,
      profit: preview.profit, tax_amount: preview.tax, status: f.status, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Ҳисобот сохта шуд"); setOpen(false); onSaved();
    setPreview(null); setF({ report_type: "quarter", period_start: "", period_end: "", status: "draft" });
  };

  return (
    <div className="flex justify-end">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Ҳисоботи нав</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Ҳисоботи давлатии нав</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Навъ</Label>
              <Select value={f.report_type} onValueChange={(v) => { setF({ ...f, report_type: v }); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Аз</Label><Input type="date" value={f.period_start} onChange={(e) => { setF({ ...f, period_start: e.target.value }); setPreview(null); }} /></div>
              <div><Label>То</Label><Input type="date" value={f.period_end} onChange={(e) => { setF({ ...f, period_end: e.target.value }); setPreview(null); }} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={compute} disabled={computing}>
              <Calculator className="h-4 w-4 mr-1" />{computing ? "Ҳисоб..." : "Ҳисоб кардан"}
            </Button>
            {preview && (() => {
              const type = TYPES.find((t) => t.v === f.report_type);
              const baseLabel = type?.base === "revenue" ? "Даромад" : type?.base === "wages" ? "Маош" : type?.base === "profit" ? "Фоида" : "—";
              return (
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <div>Даромад: <strong>{preview.revenue.toLocaleString()} сом.</strong></div>
                  <div>Ҳароҷот: <strong>{preview.expenses.toLocaleString()} сом.</strong></div>
                  <div>Фоида: <strong>{preview.profit.toLocaleString()} сом.</strong></div>
                  {type && type.rate > 0 && (
                    <div className="text-xs text-muted-foreground pt-1">
                      Формула: {baseLabel} × {(type.rate * 100).toFixed(0)}%
                    </div>
                  )}
                  <div className="text-warning">Андоз: <strong>{preview.tax.toLocaleString()} сом.</strong></div>
                </div>
              );
            })()}
            <div>
              <Label>Ҳолат</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Черновик</SelectItem>
                  <SelectItem value="submitted">Супорида шуд</SelectItem>
                  <SelectItem value="accepted">Қабул шуд</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={!preview}>Сабт</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
