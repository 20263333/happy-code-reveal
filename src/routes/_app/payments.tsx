import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Wallet, AlertCircle, Trash2, Search, Printer, MessageCircle, Send, Receipt, FileDown } from "lucide-react";
import { downloadCashReceipt } from "@/lib/pdf-templates/cash-receipt";
import { downloadReceiptDocx } from "@/lib/pdf-templates/receipt-docx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/preferences";
import { useAuth } from "@/hooks/use-auth";
import { PaymentStatusBadge } from "./projects/$id";
import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { openReceiptPrint } from "@/lib/receipt-print";
import { amountToTajikWords } from "@/lib/num-to-words";
import { usePeriodFilter } from "@/components/period-filter";
import { inRange } from "@/lib/finance";
import { ZhkBlockFilter, useZhkBlockFilter } from "@/components/zhk-block-filter";
import { useUsdRate, formatWithUsd } from "@/lib/use-usd-rate";

import { sendSms, sendPaidConfirmation } from "@/lib/sms.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({ meta: [{ title: "Платежи — Binosoz.tj" }] }),
  component: PaymentsPage,
});

// Рақами телефонро ба формати байналмилалӣ (танҳо рақамҳо) барои wa.me табдил медиҳад
function waNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9) digits = "992" + digits; // рақами маҳаллии Тоҷикистон
  else if (digits.length === 10 && digits.startsWith("0")) digits = "992" + digits.slice(1);
  else if (digits.startsWith("8") && digits.length === 11) digits = "992" + digits.slice(1);
  return digits;
}

const DEFAULT_REMINDER_TPL =
  "Муштарии мӯҳтарам {name}! Ёдоварӣ: то {date} мӯҳлати навбатии пардохти Шумо — {amount}. Лутфан саривақт пардохт намоед. Бо эҳтиром, ширкати сохтмонӣ.";
const DEFAULT_OVERDUE_TPL =
  "Муштарии мӯҳтарам {name}! Мӯҳлати пардохти Шумо ({amount}) аз {date} гузаштааст. Лутфан ҳарчи зудтар пардохт намоед. Бо эҳтиром, ширкати сохтмонӣ.";

function buildWaText(
  name: string,
  amount: number,
  dueDate: string,
  currency: string,
  overdue: boolean,
  templates?: { reminder?: string | null; overdue?: string | null },
): string {
  const d = new Date(dueDate).toLocaleDateString("ru-RU");
  const sum = `${Math.round(amount).toLocaleString()} ${currency}`;
  const tpl = overdue
    ? templates?.overdue || DEFAULT_OVERDUE_TPL
    : templates?.reminder || DEFAULT_REMINDER_TPL;
  return tpl.replaceAll("{name}", name).replaceAll("{amount}", sum).replaceAll("{date}", d);
}



function PaymentsPage() {
  const { t, tr } = useT();
  const { formatMoney, currency } = usePrefs();
  const usdRate = useUsdRate();
  const { isOwner, isAccountant, isDirector, companyId } = useAuth();
  const canManage = !isDirector && (isOwner || isAccountant);
  const qc = useQueryClient();
  const smsFn = useServerFn(sendSms);
  const paidConfirmFn = useServerFn(sendPaidConfirmation);
  const [smsSending, setSmsSending] = useState<string | null>(null);

  const sendReminderSms = async (id: string, phone: string | null | undefined, text: string, projectId?: string | null) => {
    if (!phone) { toast.error(tr("Рақами телефон нест")); return; }
    setSmsSending(id);
    try {
      const res: any = await smsFn({ data: { phone, message: text, ...(projectId ? { project_id: projectId } : {}) } });
      if (res?.ok) toast.success(tr("СМС фиристода шуд"));
      else toast.error(res?.error ?? tr("Хатогӣ ҳангоми фиристодан"));
    } catch (err: any) {
      toast.error(err?.message ?? tr("Хатогӣ ҳангоми фиристодан"));
    } finally {
      setSmsSending(null);
    }
  };


  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Удалено")); qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["upcoming-schedule"] }); qc.invalidateQueries({ queryKey: ["payment-schedule"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmPay = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: payRow } = await supabase.from("payments").select("sale_id").eq("id", id).maybeSingle();
    const { error } = await supabase.from("payments").update({ status: "confirmed", confirmed_by: user?.id, confirmed_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr("Подтверждён"));
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["upcoming-schedule"] });
    qc.invalidateQueries({ queryKey: ["payment-schedule"] });
    if (payRow?.sale_id) {
      try { await paidConfirmFn({ data: { sale_id: payRow.sale_id } }); } catch { /* silent */ }
    }
  };
  const rejectPay = async (id: string) => {
    const { error } = await supabase.from("payments").update({ status: "rejected" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(tr("Отклонён")); qc.invalidateQueries({ queryKey: ["payments"] }); }
  };


  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase
      .from("payments")
      .select("*, sale:sales(sale_number, full_price, paid_amount, customer:customers(fullname, phone), apartment:apartments(apartment_number), project:projects(id, name))")
      .order("payment_date", { ascending: false })).data ?? [],
  });

  const { data: receiptTpl } = useQuery({
    queryKey: ["company-receipt-template", companyId],
    queryFn: async () =>
      companyId
        ? (await (supabase as any)
            .from("companies")
            .select("name, phone, receipt_bg, receipt_stamp, receipt_inn, receipt_address, receipt_signer")
            .eq("id", companyId)
            .maybeSingle()).data
        : null,
    enabled: !!companyId,
  });

  const printReceipt = (p: any) => {
    const fullPrice = Number(p.sale?.full_price ?? 0);
    const paidTotal = Number(p.sale?.paid_amount ?? 0);
    const remaining = Math.max(fullPrice - paidTotal, 0);
    const methodMap: Record<string, string> = {
      cash: tr("Нақдӣ"), card: tr("Корт"), transfer: tr("Гузаронидан"), other: tr("Дигар"),
    };
    if (!openReceiptPrint({
      template: {
        bg: receiptTpl?.receipt_bg,
        stamp: receiptTpl?.receipt_stamp,
        inn: receiptTpl?.receipt_inn,
        address: receiptTpl?.receipt_address,
        signer: receiptTpl?.receipt_signer,
        companyName: receiptTpl?.name,
        companyPhone: receiptTpl?.phone,
      },
      data: {
        receiptNo: p.check_number ? String(p.check_number) : String(p.id).slice(0, 8).toUpperCase(),
        date: formatDate(p.payment_date),
        customerName: p.sale?.customer?.fullname ?? "—",
        customerPhone: p.sale?.customer?.phone,
        projectName: p.sale?.project?.name,
        apartmentNumber: p.sale?.apartment?.apartment_number,
        amountText: formatMoney(Number(p.amount)),
        amountWords: amountToTajikWords(Number(p.amount)),
        method: p.payment_method ? (methodMap[p.payment_method] ?? p.payment_method) : null,
        note: p.note,
        fullPriceText: fullPrice > 0 ? formatMoney(fullPrice) : null,
        paidTotalText: fullPrice > 0 ? formatMoney(paidTotal) : null,
        remainingText: fullPrice > 0 ? formatMoney(remaining) : null,
      },
      qrPayload: [
        `${tr("Квитанция")} № ${p.check_number ?? String(p.id).slice(0, 8).toUpperCase()}`,
        `${tr("Сана")}: ${formatDate(p.payment_date)}`,
        `${tr("Клиент")}: ${p.sale?.customer?.fullname ?? "—"}`,
        p.sale?.project?.name ? `${tr("Проект")}: ${p.sale.project.name}${p.sale?.apartment?.apartment_number ? ` · ${tr("кв.")} ${p.sale.apartment.apartment_number}` : ""}` : "",
        `${tr("Сумма")}: ${formatMoney(Number(p.amount))}`,
        receiptTpl?.name ? `${receiptTpl.name}${receiptTpl?.phone ? ` · ☎ ${receiptTpl.phone}` : ""}` : "",
      ].filter(Boolean).join("\n"),
      labels: {
        title: tr("Квитанция"), no: tr("№"), date: tr("Дата"), client: tr("Клиент"),
        phone: tr("Телефон"), project: tr("Проект"), apt: tr("кв."), method: tr("Способ"),
        amount: tr("Сумма"), fullPrice: tr("Ҷамъи умумӣ"), paidTotal: tr("Пардохтшуда"),
        remaining: tr("Бақия"), signer: tr("Имзогузор"), signature: tr("Имзо"),
        inn: tr("ИНН"), address: tr("Суроға"), note: tr("Эзоҳ"), verify: tr("Санҷиш"),
        copyClient: tr("Нусхаи муштарӣ"), copyOffice: tr("Нусхаи ширкат"), cutHere: tr("✂ буред"),
      },
    })) {
      toast.error(tr("Разрешите всплывающие окна"));
      return false;
    }
    return true;
  };

  // Чоп кардани чек ва ҳамзамон фиристодани СМС ба муштарӣ дар бораи қабули пардохт
  const printAndSms = async (p: any) => {
    const ok = printReceipt(p);
    if (!ok) return;
    const phone = p.sale?.customer?.phone;
    if (!phone) { toast.error(tr("Рақами телефон нест")); return; }
    const name = p.sale?.customer?.fullname ?? tr("Муштарӣ");
    const fullPrice = Number(p.sale?.full_price ?? 0);
    const paidTotal = Number(p.sale?.paid_amount ?? 0);
    const remaining = Math.max(fullPrice - paidTotal, 0);
    const message = `Муштарии мӯҳтарам ${name}! Пардохти Шумо ба маблағи ${formatMoney(Number(p.amount))} қабул шуд. Санаи ${formatDate(p.payment_date)}.${fullPrice > 0 ? ` Бақия: ${formatMoney(remaining)}.` : ""} Ташаккур!`;
    setSmsSending(p.id);
    try {
      const pid = p.sale?.project?.id ?? p.project?.id ?? null;
      const res: any = await smsFn({ data: { phone, message, ...(pid ? { project_id: pid } : {}) } });

      if (res?.ok) toast.success(tr("СМС фиристода шуд"));
      else toast.error(res?.error ?? tr("Хатогӣ ҳангоми фиристодан"));
    } catch (err: any) {
      toast.error(err?.message ?? tr("Хатогӣ ҳангоми фиристодан"));
    } finally {
      setSmsSending(null);
    }
  };



  const creatorIds = Array.from(new Set(payments.map((p: any) => p.created_by).filter(Boolean)));
  const { data: creators = [] } = useQuery({
    queryKey: ["creators", creatorIds.sort().join(",")],
    queryFn: async () => creatorIds.length ? (await supabase.from("profiles").select("id, fullname").in("id", creatorIds)).data ?? [] : [],
    enabled: creatorIds.length > 0,
  });
  const creatorMap = new Map(creators.map((c: any) => [c.id, c.fullname]));

  // Эслатмаҳои пардохт аз рӯи графики рассрочка (payment_schedule)
  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-schedule"],
    queryFn: async () => (await supabase
      .from("payment_schedule")
      .select("id, due_date, amount, paid_amount, status, sale:sales(id, customer:customers(fullname, phone), apartment:apartments(apartment_number), project:projects(id, name))")
      .neq("status", "paid")
      .order("due_date", { ascending: true })).data ?? [],
  });

  // Қолаби матни СМС — барои ҳар лоиҳа алоҳида, вагарна умумии ширкат
  const { data: smsTplRows } = useQuery({
    queryKey: ["sms-templates-all"],
    queryFn: async () =>
      (await (supabase as any)
        .from("company_sms_settings")
        .select("project_id, reminder_template, overdue_template")).data ?? [],
  });
  const getTemplates = (projectId?: string | null) => {
    const list = (smsTplRows as any[]) ?? [];
    const row =
      (projectId ? list.find((r) => r.project_id === projectId) : null) ??
      list.find((r) => !r.project_id) ??
      null;
    return {
      reminder: row?.reminder_template as string | null | undefined,
      overdue: row?.overdue_template as string | null | undefined,
    };
  };


  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysDiff = (d: string) => Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "confirmed" | "rejected">("all");
  const [zhk, setZhk] = useState({ zhkId: "", blockId: "" });
  const period = usePeriodFilter("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["payments-projects", companyId],
    queryFn: async () =>
      companyId
        ? (await supabase.from("projects").select("id, name, parent_id").eq("company_id", companyId).order("name")).data ?? []
        : [],
    enabled: !!companyId,
  });
  const allowedIds = useZhkBlockFilter(projects as any, zhk);

  // Танҳо мӯҳлатҳои наздик (то 30 рӯз) ё гузашта — бо фильтри ЖК/Блок
  const reminders = useMemo(
    () => upcoming.filter((s: any) => {
      // Агар танҳо тафовути хурди мудаввар монда бошад — пардохтшуда ҳисоб мешавад
      if (Number(s.amount) - Number(s.paid_amount ?? 0) <= 1) return false;
      if (daysDiff(s.due_date) > 30) return false;
      if (allowedIds && !allowedIds.has(s.sale?.project?.id)) return false;
      return true;
    }),
    [upcoming, allowedIds],
  );

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p: any) => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (allowedIds && !allowedIds.has(p.sale?.project?.id)) return false;
      if (period.active && !inRange(p.payment_date, period.fromDate, period.toDate)) return false;
      if (!q) return true;
      const hay = [
        p.sale?.customer?.fullname,
        p.sale?.project?.name,
        p.sale?.apartment?.apartment_number,
        p.payment_method,
        p.note,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [payments, search, filterStatus, period.active, period.fromDate, period.toDate, allowedIds]);

  const pendingPayments = payments.filter((p: any) => p.status === "pending");

  const company = useCompanyHeader();
  const statusLabel = (s: string) =>
    s === "confirmed" ? tr("Подтверждён") : s === "rejected" ? tr("Отклонён") : tr("Ожидается");
  const handlePrint = () => {
    const rowsHtml = filteredPayments.map((p: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(p.payment_date))}</td>
        <td>${esc(p.sale?.customer?.fullname || "—")}</td>
        <td>${esc(p.sale?.project?.name || "")}${p.sale?.apartment?.apartment_number ? " · " + esc(tr("кв.")) + " " + esc(p.sale.apartment.apartment_number) : ""}</td>
        <td>${esc(p.payment_method || "")}</td>
        <td>${esc(statusLabel(p.status))}</td>
        <td class="num">${esc(formatMoney(Number(p.amount)))}</td>
      </tr>`).join("");
    const total = filteredPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const content = `
      <h1>${esc(t("nav.payments"))}</h1>
      <h2>${esc(formatDate(new Date()))}</h2>
      <table>
        <thead><tr>
          <th>№</th><th>${esc(tr("Дата"))}</th><th>${esc(tr("Клиент"))}</th>
          <th>${esc(tr("Проект"))}</th><th>${esc(tr("Способ"))}</th><th>${esc(tr("Статус"))}</th>
          <th class="num">${esc(tr("Сумма"))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="6">${esc(tr("Итого"))}</td><td class="num">${esc(formatMoney(total))}</td></tr></tfoot>
      </table>`;
    if (!openPrintWindow({ title: t("nav.payments"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  const handlePrintUpcoming = () => {
    const rowsHtml = reminders.map((s: any, i: number) => {
      const d = daysDiff(s.due_date);
      const remaining = Math.max(Number(s.amount) - Number(s.paid_amount ?? 0), 0);
      const statusText = d < 0 ? `${tr("Просрочка")} ${Math.abs(d)} ${tr("дн.")}` : d === 0 ? tr("Сегодня срок оплаты") : `${d} ${tr("дн.")}`;
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(s.due_date))}</td>
        <td>${esc(s.sale?.customer?.fullname || "—")}</td>
        <td>${esc(s.sale?.customer?.phone || "")}</td>
        <td>${esc(s.sale?.project?.name || "")}${s.sale?.apartment?.apartment_number ? " · " + esc(tr("кв.")) + " " + esc(s.sale.apartment.apartment_number) : ""}</td>
        <td>${esc(statusText)}</td>
        <td class="num">${esc(formatMoney(remaining))}</td>
      </tr>`;
    }).join("");
    const total = reminders.reduce((s: number, r: any) => s + Math.max(Number(r.amount) - Number(r.paid_amount ?? 0), 0), 0);
    const content = `
      <h1>${esc(t("payments.upcoming"))}</h1>
      <h2>${esc(formatDate(new Date()))}</h2>
      <table>
        <thead><tr>
          <th>№</th><th>${esc(tr("Срок оплаты"))}</th><th>${esc(tr("Клиент"))}</th>
          <th>${esc(tr("Телефон"))}</th><th>${esc(tr("Проект"))}</th><th>${esc(tr("Статус"))}</th>
          <th class="num">${esc(tr("Остаток"))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="6">${esc(tr("Итого"))}</td><td class="num">${esc(formatMoney(total))}</td></tr></tfoot>
      </table>`;
    if (!openPrintWindow({ title: t("payments.upcoming"), company, contentHtml: content })) {
      toast.error(tr("Разрешите всплывающие окна"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.payments")}
        subtitle={t("payments.upcoming")}
        actions={
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />{tr("Печать")}
          </Button>
        }
      />

      {pendingPayments.length > 0 && canManage && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-sm">
          <b>{pendingPayments.length}</b> {tr("платёж(ей) ожидают вашего подтверждения")}
        </div>
      )}

      {reminders.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <h3 className="font-display text-sm font-semibold">{t("payments.upcoming")}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{reminders.length}</span>
            <Button variant="outline" size="sm" onClick={handlePrintUpcoming}>
              <Printer className="mr-2 h-4 w-4" />{tr("Печать")}
            </Button>
          </div>

          <div className="divide-y divide-border">
            {reminders.map((s: any) => {
              const d = daysDiff(s.due_date);
              const overdue = d < 0;
              const soon = d >= 0 && d <= 7;
              const remaining = Math.max(Number(s.amount) - Number(s.paid_amount ?? 0), 0);
              const name = s.sale?.customer?.fullname ?? "";
              const wa = waNumber(s.sale?.customer?.phone);
              const waLink = wa
                ? `https://wa.me/${wa}?text=${encodeURIComponent(buildWaText(name, remaining, s.due_date, currency, overdue, getTemplates(s.sale?.project?.id ?? s.project?.id)))}`
                : null;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-muted/40",
                    overdue && "bg-destructive/10",
                    soon && "bg-warning/10",
                  )}
                >
                  <Link
                    to="/projects/$id"
                    params={{ id: s.sale?.project?.id }}
                    className="flex flex-1 items-center gap-3 min-w-0"
                  >
                    <div className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      overdue ? "bg-destructive animate-pulse" : soon ? "bg-warning" : "bg-muted-foreground/40",
                    )} />
                    <div className="min-w-0">
                      <p className={cn("truncate text-sm font-semibold", overdue && "text-destructive")}>
                        {name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.sale?.project?.name} · {tr("кв.")} {s.sale?.apartment?.apartment_number} · {s.sale?.customer?.phone || "—"}
                      </p>
                    </div>
                  </Link>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatMoney(remaining)}</p>
                    <p className={cn(
                      "text-xs",
                      overdue ? "text-destructive font-semibold" : soon ? "text-warning-foreground" : "text-muted-foreground",
                    )}>
                      {overdue ? `${t("payments.overdue")} ${Math.abs(d)} ${t("payments.days")}` : `${t("payments.dueIn")} ${d} ${t("payments.days")} · ${formatDate(s.due_date)}`}
                    </p>
                  </div>
                  {!isDirector && <button
                    type="button"
                    disabled={smsSending === s.id || !s.sale?.customer?.phone}
                    onClick={() => sendReminderSms(s.id, s.sale?.customer?.phone, buildWaText(name, remaining, s.due_date, currency, overdue, getTemplates(s.sale?.project?.id ?? s.project?.id)), s.sale?.project?.id ?? s.project?.id ?? null)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    title={tr("Фиристодани СМС")}
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">{smsSending === s.id ? tr("...") : "СМС"}</span>
                  </button>}
                  {!isDirector && waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-success px-3 py-2 text-xs font-semibold text-success-foreground transition hover:opacity-90"
                      title={tr("Эслатма ба WhatsApp")}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  ) : !isDirector ? (
                    <span className="shrink-0 text-xs text-muted-foreground" title={tr("Рақами телефон нест")}>—</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {period.control}

      <ZhkBlockFilter projects={projects as any} value={zhk} onChange={setZhk} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск: клиент, проект, квартира…")} className="pl-8" />
        </div>
        {(["all", "pending", "confirmed", "rejected"] as const).map((s) => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)}>
            {s === "all" ? tr("Все") : s === "pending" ? tr("Ожидают") : s === "confirmed" ? tr("Подтв.") : tr("Откл.")}
          </Button>
        ))}
      </div>

      {filteredPayments.length === 0 ? (
        <EmptyState icon={Wallet} title={payments.length === 0 ? t("project.noPayments") : tr("Ничего не найдено")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">№ {tr("чек")}</th>
                <th className="px-4 py-3 text-left">{t("table.date")}</th>
                <th className="px-4 py-3 text-left">{t("table.client")}</th>
                <th className="px-4 py-3 text-left">{t("table.project")} / {t("table.apartment")}</th>
                <th className="px-4 py-3 text-left">{tr("Статус")}</th>
                <th className="px-4 py-3 text-left">{t("table.method")}</th>
                <th className="px-4 py-3 text-left">{tr("Добавил")}</th>
                <th className="px-4 py-3 text-right">{t("table.amount")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p: any) => (
                <tr key={p.id} className={cn("border-t border-border", p.status === "pending" && "bg-warning/10")}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{p.check_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                  <td className="px-4 py-3 font-medium">{p.sale?.customer?.fullname}</td>
                  <td className="px-4 py-3 text-xs">{p.sale?.project?.name} · {tr("кв.")} {p.sale?.apartment?.apartment_number}</td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><Badge variant="outline">{t(`payment.method.${p.payment_method}` as any)}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{creatorMap.get(p.created_by) || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-success">{formatWithUsd(p.amount, formatMoney, usdRate)}</td>
                  <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => printReceipt(p)} title={tr("Чоп чек")}>
                      <Receipt className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={tr("Чек DOCX (шаблони расмӣ)")}
                      onClick={async () => {
                        try {
                          await downloadReceiptDocx({
                            receipt_number: p.check_number ? String(p.check_number) : String(p.id).slice(0, 8).toUpperCase(),
                            receipt_date: formatDate(p.payment_date),
                            contract_number: p.sale?.sale_number || "",
                            client_full_name: p.sale?.customer?.fullname || "",
                            amount: Number(p.amount),
                          });
                        } catch (e: any) {
                          toast.error(e?.message ?? "DOCX error");
                        }
                      }}
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                    {!isDirector && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={smsSending === p.id || !p.sale?.customer?.phone}
                        onClick={() => printAndSms(p)}
                        title={tr("Чоп + СМС ба муштарӣ")}
                        className="text-primary border-primary/40 hover:bg-primary/10"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && p.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-success border-success/40 hover:bg-success/10" onClick={() => confirmPay(p.id)}>{tr("✓ Подтв.")}</Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => rejectPay(p.id)}>✕</Button>
                      </>
                    )}
                    {isOwner && !isDirector && (
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(tr("Удалить?"))) del.mutate(p.id); }} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
