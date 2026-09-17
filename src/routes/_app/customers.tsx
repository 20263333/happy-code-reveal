import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Users, Phone, FileText, Trash2, CalendarClock, Search, Download, Camera, ImagePlus, FileIcon, Printer, FileSignature, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatMoney, formatDate } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { ExcelImportCustomers } from "@/components/excel-import-customers";


import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePeriodFilter } from "@/components/period-filter";
import { inRange } from "@/lib/finance";
import { ZhkBlockFilter, useZhkBlockFilter, type ZhkBlockValue } from "@/components/zhk-block-filter";
import { ContractGeneratorButtons } from "@/components/contract-generator-buttons";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Клиенты — PLATFORM.TJ" }] }),
  component: CustomersPage,
});

const CUSTOMER_STATUSES: Record<string, { label: string; cls: string }> = {
  booking: { label: "Бронь", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  active: { label: "Активный", cls: "bg-success/15 text-success border-success/30" },
  closed: { label: "Закрыт", cls: "bg-muted text-muted-foreground border-border" },
};

function CustomerStatusBadge({ status }: { status: string }) {
  const { tr } = useT();
  const m = CUSTOMER_STATUSES[status] || CUSTOMER_STATUSES.active;
  return <Badge className={cn("border", m.cls)}>{tr(m.label)}</Badge>;
}

function CustomersPage() {
  const { tr } = useT();
  const qc = useQueryClient();
  const { isOwner, isDirector, companyId } = useAuth();
  const canModify = !isDirector;

  const [uploadTarget, setUploadTarget] = useState<any>(null);
  const [viewTarget, setViewTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  

  const delCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Удалено")); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("customers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Статус обновлён")); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: company } = useQuery({
    queryKey: ["company-print", companyId],
    queryFn: async () => companyId ? (await supabase.from("companies").select("name, phone").eq("id", companyId).maybeSingle()).data : null,
    enabled: !!companyId,
  });

  const { data: contract } = useQuery({
    queryKey: ["contract-template", companyId],
    queryFn: async () => companyId
      ? (await (supabase as any).from("contract_templates").select("*").eq("company_id", companyId).maybeSingle()).data
      : null,
    enabled: !!companyId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, sales(id, sale_number, full_price, paid_amount, remaining_amount, payment_deadline, installment_months, sales_manager_id, created_at, apartment:apartments(apartment_number, area, rooms, plan_image_path, floor:floors(floor_number), project:projects(id, name, parent_id)))")
        .order("created_at", { ascending: false });
      if (error) { console.error("customers query error", error); return []; }
      const parentIds = Array.from(new Set(
        (data ?? []).flatMap((c: any) => (c.sales ?? []).map((s: any) => s.apartment?.project?.parent_id).filter(Boolean))
      ));
      let parentMap = new Map<string, string>();
      if (parentIds.length > 0) {
        const { data: parents } = await supabase.from("projects").select("id, name").in("id", parentIds);
        parentMap = new Map((parents ?? []).map((p: any) => [p.id as string, p.name as string]));
      }
      for (const c of data ?? []) {
        for (const s of (c.sales ?? []) as any[]) {
          const proj = s.apartment?.project;
          if (proj?.parent_id) proj.parent = { name: parentMap.get(proj.parent_id) ?? null };
        }
      }
      // WhatsApp-лидҳо (аз чат омадаанд) ба рӯйхати мизоҷон дохил намешаванд,
      // то бо харидорони ҳақиқӣ омехта нашаванд — онҳо танҳо дар Воронка мемонанд.
      // Агар лид харид анҷом дода бошад (sale дорад), пас ӯ аллакай мизоҷ аст ва нишон дода мешавад.
      return (data ?? []).filter(
        (c: any) => c.source !== "whatsapp" || (c.sales ?? []).length > 0,
      );
    },
  });


  const creatorIds = Array.from(new Set(customers.map((c: any) => c.created_by).filter(Boolean)));
  const { data: creators = [] } = useQuery({
    queryKey: ["customer-creators", creatorIds.sort().join(",")],
    queryFn: async () => creatorIds.length ? (await supabase.from("profiles").select("id, fullname").in("id", creatorIds)).data ?? [] : [],
    enabled: creatorIds.length > 0,
  });
  const creatorMap = new Map(creators.map((c: any) => [c.id, c.fullname]));

  const managerIds = Array.from(new Set(customers.flatMap((c: any) => (c.sales ?? []).map((s: any) => s.sales_manager_id)).filter(Boolean)));
  const { data: saleManagers = [] } = useQuery({
    queryKey: ["customer-sale-managers", managerIds.sort().join(",")],
    queryFn: async () => managerIds.length ? (await (supabase as any).from("sales_team_members").select("id, fullname").in("id", managerIds)).data ?? [] : [],
    enabled: managerIds.length > 0,
  });
  const managerMap = new Map(saleManagers.map((m: any) => [m.id, m.fullname]));

  const customerIds = customers.map((c: any) => c.id);
  const { data: docs = [] } = useQuery({
    queryKey: ["customer-documents", customerIds.sort().join(",")],
    queryFn: async () => customerIds.length
      ? (await (supabase as any).from("customer_documents").select("*").in("customer_id", customerIds).order("created_at", { ascending: false })).data ?? []
      : [],
    enabled: customerIds.length > 0,
  });
  const docsByCustomer = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const d of docs as any[]) {
      const arr = m.get(d.customer_id) ?? [];
      arr.push(d);
      m.set(d.customer_id, arr);
    }
    return m;
  }, [docs]);

  const saleIds = customers.flatMap((c: any) => c.sales.map((s: any) => s.id));

  // Fetch rows for a list of sale ids in small id-batches: a single `.in(...)`
  // with hundreds of uuids overflows the request URL on the self-hosted server
  // and the whole query silently fails (graph disappears on the cards).
  async function fetchBySaleIds(table: string, columns: string, ids: string[], ordered?: string) {
    const ID_BATCH = 80;
    const PAGE = 1000;
    const all: any[] = [];
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const slice = ids.slice(i, i + ID_BATCH);
      for (let from = 0; ; from += PAGE) {
        let q = (supabase.from(table as any) as any).select(columns).in("sale_id", slice);
        if (ordered) q = q.order(ordered);
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data ?? [];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
      }
    }
    return all;
  }

  const { data: schedule = [] } = useQuery({
    queryKey: ["payment-schedule", saleIds.sort().join(",")],
    queryFn: async () =>
      saleIds.length ? fetchBySaleIds("payment_schedule", "sale_id, due_date, amount, status", saleIds, "due_date") : [],
    enabled: saleIds.length > 0,
  });

  // Group schedule rows by sale once — avoids O(n²) filtering per customer card.
  const scheduleBySale = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const sc of schedule as any[]) {
      const arr = m.get(sc.sale_id) ?? [];
      arr.push(sc);
      m.set(sc.sale_id, arr);
    }
    return m;
  }, [schedule]);

  // Confirmed payments per sale — used to detect overpayment (paid more than contract).
  const { data: confirmedPays = [] } = useQuery({
    queryKey: ["customer-payments", saleIds.sort().join(",")],
    queryFn: async () =>
      saleIds.length ? fetchBySaleIds("payments", "sale_id, amount, status", saleIds) : [],
    enabled: saleIds.length > 0,
  });


  const confirmedBySale = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of confirmedPays as any[]) {
      if (p.status !== "confirmed") continue;
      m.set(p.sale_id, (m.get(p.sale_id) ?? 0) + Number(p.amount));
    }
    return m;
  }, [confirmedPays]);

  const refund = useMutation({
    mutationFn: async ({ saleId, amount }: { saleId: string; amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        sale_id: saleId,
        amount: -Math.abs(amount),
        payment_method: "cash",
        note: tr("Возврат переплаты"),
        status: "confirmed",
        created_by: user?.id,
        confirmed_by: user?.id,
        confirmed_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("Переплата возвращена"));
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [zhkBlock, setZhkBlock] = useState<ZhkBlockValue>({ zhkId: "", blockId: "" });
  const period = usePeriodFilter("all");

  const { data: projectsList = [] } = useQuery({
    queryKey: ["projects-zhk-block", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name, parent_id").eq("company_id", companyId).order("name");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const allowedProjectIds = useZhkBlockFilter(projectsList as any, zhkBlock);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c: any) => {
      if (filterStatus !== "all" && (c.status || "active") !== filterStatus) return false;
      if (period.active && !inRange(c.created_at, period.fromDate, period.toDate)) return false;
      if (allowedProjectIds) {
        const has = (c.sales as any[]).some((s) => {
          const pid = s.apartment?.project?.id;
          return pid && allowedProjectIds.has(pid);
        });
        if (!has) return false;
      }
      if (!q) return true;
      return [c.fullname, c.phone, c.passport, c.address].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [customers, search, filterStatus, period.active, period.fromDate, period.toDate, allowedProjectIds]);

  // ---- Архивные (историчные) продажи ----
  const { data: archivedApts = [] } = useQuery({
    queryKey: ["archived-apartments", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("apartments")
        .select("id, apartment_number, area, historical_owner, price_per_sqm, floor:floors(floor_number), project:projects!inner(id, name, company_id)")
        .eq("is_historical", true)
        .eq("project.company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const archivedNames = useMemo(
    () => new Set((archivedApts as any[]).map((a) => String(a.historical_owner ?? "").trim().toLowerCase()).filter(Boolean)),
    [archivedApts],
  );

  // Клиенты, чьи деньги реально в системе (есть продажа) — исключаем архивных без продаж.
  const activeCustomers = useMemo(
    () => filteredCustomers.filter((c: any) => (c.sales?.length ?? 0) > 0),
    [filteredCustomers],
  );
  const archivedCustomers = useMemo(
    () => filteredCustomers.filter((c: any) => (c.sales?.length ?? 0) === 0 && archivedNames.has(String(c.fullname ?? "").trim().toLowerCase())),
    [filteredCustomers, archivedNames],
  );
  const listCustomers = useMemo(() => {
    const archIds = new Set(archivedCustomers.map((c: any) => c.id));
    return filteredCustomers.filter((c: any) => !archIds.has(c.id));
  }, [filteredCustomers, archivedCustomers]);

  const [groupView, setGroupView] = useState<null | "archive" | "active">(null);

  const fullPaidCustomers = useMemo(() => activeCustomers.filter((c: any) => {
    const total = c.sales.reduce((s: number, x: any) => s + Number(x.full_price), 0);
    const paid = c.sales.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);
    return total > 0 && paid >= total - 0.01;
  }), [activeCustomers]);
  const installmentCustomers = useMemo(() => activeCustomers.filter((c: any) => {
    const total = c.sales.reduce((s: number, x: any) => s + Number(x.full_price), 0);
    const paid = c.sales.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);
    return total > 0 && paid < total - 0.01;
  }), [activeCustomers]);




  const handlePrint = (c: any) => {
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));
    const total = c.sales.reduce((s: number, x: any) => s + Number(x.full_price), 0);
    const paid = c.sales.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);

    const salesHtml = c.sales.map((s: any) => {
      const remaining = Number(s.full_price) - Number(s.paid_amount);
      const saleSchedule = schedule.filter((sc: any) => sc.sale_id === s.id);
      const rows = saleSchedule.map((sc: any, idx: number) => `
        <tr>
          <td>${tr("М")}${idx + 1}</td>
          <td>${esc(formatDate(sc.due_date))}</td>
          <td style="text-align:right">${esc(formatMoney(sc.amount))}</td>
          <td>${sc.status === "paid" ? tr("Оплачено") : tr("Ожидается")}</td>
        </tr>`).join("");
      return `
        <div class="sale">
          <h3>${esc(s.apartment?.project?.name || "")} · ${tr("кв.")} ${esc(s.apartment?.apartment_number || "")}</h3>
          <table class="info">
            <tr><td>${tr("Цена")}</td><td style="text-align:right">${esc(formatMoney(s.full_price))}</td></tr>
            <tr><td>${tr("Оплачено")}</td><td style="text-align:right">${esc(formatMoney(s.paid_amount))}</td></tr>
            <tr><td>${tr("Остаток")}</td><td style="text-align:right"><b>${esc(formatMoney(remaining))}</b></td></tr>
            ${s.payment_deadline ? `<tr><td>${tr("до")}</td><td style="text-align:right">${esc(formatDate(s.payment_deadline))}</td></tr>` : ""}
          </table>
          ${saleSchedule.length > 0 ? `
            <h4>${tr("График платежей")}</h4>
            <table class="schedule">
              <thead><tr><th>№</th><th>${tr("Дата")}</th><th style="text-align:right">${tr("Сумма")}</th><th>${tr("Статус")}</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>` : ""}
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(c.fullname)}</title>
      <style>
        * { font-family: Arial, sans-serif; }
        body { margin: 32px; color: #1a1a1a; }
        .company-header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
        .company-header .name { font-size: 26px; font-weight: bold; letter-spacing: 0.5px; }
        .company-header .phone { color: #555; font-size: 14px; margin-top: 4px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 16px; margin: 16px 0 8px; }
        h3 { font-size: 14px; margin: 16px 0 6px; }
        h4 { font-size: 13px; margin: 10px 0 4px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 8px; }
        table.info td { padding: 3px 6px; }
        table.schedule th, table.schedule td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
        table.schedule th { background: #f0f0f0; }
        .sale { page-break-inside: avoid; border-top: 1px solid #ddd; padding-top: 8px; }
        .total { margin-top: 16px; font-size: 13px; font-weight: bold; }
        @media print { body { margin: 12mm; } }
      </style></head><body>
      <div class="company-header">
        <div class="name">${esc(company?.name || "PLATFORM.TJ")}</div>
        ${company?.phone ? `<div class="phone">${tr("Телефон")}: ${esc(company.phone)}</div>` : ""}
      </div>
      <h1>${esc(c.fullname)}</h1>
      <table class="info">
        ${c.phone ? `<tr><td>${tr("Телефон")}</td><td>${esc(c.phone)}</td></tr>` : ""}
        ${c.passport ? `<tr><td>${tr("Паспорт")}</td><td>${esc(c.passport)}</td></tr>` : ""}
        ${c.address ? `<tr><td>${tr("Адрес")}</td><td>${esc(c.address)}</td></tr>` : ""}
        <tr><td>${tr("Дата")}</td><td>${esc(formatDate(new Date()))}</td></tr>
      </table>
      ${salesHtml}
      <div class="total">${tr("Итого")}: ${esc(formatMoney(paid))} / ${esc(formatMoney(total))} · ${tr("Остаток")}: ${esc(formatMoney(total - paid))}</div>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error(tr("Разрешите всплывающие окна")); return; }
    w.document.write(html);
    w.document.close();
  };

  const handleContract = async (c: any) => {
    if (!contract) { toast.error(tr("Сначала настройте шаблон договора в меню «Договор».")); return; }
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));
    const today = formatDate(new Date());
    const first = c.sales[0];
    const ap = first?.apartment;

    const fill = (txt: string) =>
      String(txt ?? "")
        .replaceAll("{client}", c.fullname || "")
        .replaceAll("{passport}", c.passport || "")
        .replaceAll("{phone}", c.phone || "")
        .replaceAll("{address}", c.address || "")
        .replaceAll("{project}", ap?.project?.name || "")
        .replaceAll("{floor}", ap?.floor?.floor_number != null ? String(ap.floor.floor_number) : "")
        .replaceAll("{apartment}", ap?.apartment_number || "")
        .replaceAll("{area}", ap?.area != null ? String(ap.area) : "")
        .replaceAll("{rooms}", ap?.rooms != null ? String(ap.rooms) : "")
        .replaceAll("{price}", first ? formatMoney(first.full_price) : "")
        .replaceAll("{date}", today)
        .replaceAll("{birth_date}", c.birth_date ? formatDate(c.birth_date) : "")
        .replaceAll("{passport_series}", c.passport_series || "")
        .replaceAll("{passport_number}", c.passport_number || "")
        .replaceAll("{passport_issued_by}", c.passport_issued_by || "")
        .replaceAll("{passport_issued_date}", c.passport_issued_date ? formatDate(c.passport_issued_date) : "");

    const planUrls = new Map<string, string>();
    for (const s of c.sales) {
      const path = s.apartment?.plan_image_path;
      if (path && !planUrls.has(path)) {
        const { data } = await supabase.storage.from("apartment-plans").createSignedUrl(path, 3600);
        if (data?.signedUrl) planUrls.set(path, data.signedUrl);
      }
    }

    const subjectsHtml = c.sales.map((s: any) => {
      const a = s.apartment;
      const planUrl = a?.plan_image_path ? planUrls.get(a.plan_image_path) : null;
      const saleSchedule = schedule.filter((sc: any) => sc.sale_id === s.id);
      const rows = saleSchedule.map((sc: any, idx: number) => `
        <tr>
          <td>${tr("М")}${idx + 1}</td>
          <td>${esc(formatDate(sc.due_date))}</td>
          <td style="text-align:right">${esc(formatMoney(sc.amount))}</td>
          <td>${sc.status === "paid" ? tr("Оплачено") : tr("Ожидается")}</td>
        </tr>`).join("");
      return `
        <div class="subject">
          <table class="info">
            <tr><td>${tr("Блок / Проект")}</td><td>${esc(a?.project?.name || "")}</td></tr>
            ${a?.floor?.floor_number != null ? `<tr><td>${tr("Этаж")}</td><td>${esc(a.floor.floor_number)}</td></tr>` : ""}
            <tr><td>${tr("Квартира №")}</td><td>${esc(a?.apartment_number || "")}</td></tr>
            ${a?.area != null ? `<tr><td>${tr("Площадь")}</td><td>${esc(a.area)} ${tr("м²")}</td></tr>` : ""}
            ${a?.rooms != null ? `<tr><td>${tr("Комнат")}</td><td>${esc(a.rooms)}</td></tr>` : ""}
            <tr><td>${tr("Стоимость")}</td><td><b>${esc(formatMoney(s.full_price))}</b></td></tr>
          </table>
          ${saleSchedule.length > 0 ? `
            <h4>${tr("График ежемесячных платежей")}</h4>
            <table class="schedule">
              <thead><tr><th>№</th><th>${tr("Дата")}</th><th style="text-align:right">${tr("Сумма")}</th><th>${tr("Статус")}</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>` : ""}
          ${planUrl ? `
            <h4>${tr("Схемаи квартира")}</h4>
            <div class="plan"><img src="${esc(planUrl)}" alt="plan" style="max-width:100%;max-height:400px;object-fit:contain;border:1px solid #ddd;border-radius:6px;margin-top:6px" /></div>` : ""}
        </div>`;
    }).join("");

    const sellerLines = [
      `<b>${esc(company?.name || contract.contract_title || "")}</b>`,
      contract.legal_address ? esc(contract.legal_address) : "",
      contract.inn ? `${tr("ИНН")}: ${esc(contract.inn)}` : "",
      contract.bank_details ? esc(contract.bank_details) : "",
      (contract.phone || company?.phone) ? `${tr("Телефон")}: ${esc(contract.phone || company?.phone)}` : "",
      contract.director_name ? `${esc(contract.director_position || "Директор")}: ${esc(contract.director_name)}` : "",
    ].filter(Boolean).join("<br>");

    const buyerLines = [
      `<b>${esc(c.fullname)}</b>`,
      c.passport ? `${tr("Паспорт")}: ${esc(c.passport)}` : "",
      c.phone ? `${tr("Телефон")}: ${esc(c.phone)}` : "",
      c.address ? `${tr("Адрес")}: ${esc(c.address)}` : "",
    ].filter(Boolean).join("<br>");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(contract.contract_title)} — ${esc(c.fullname)}</title>
      <style>
        * { font-family: Arial, sans-serif; }
        body { margin: 32px; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
        .company-header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
        .company-header .name { font-size: 24px; font-weight: bold; }
        h1 { font-size: 18px; text-align: center; margin: 8px 0; }
        .meta { display:flex; justify-content: space-between; font-size: 12px; color:#444; margin-bottom: 16px; }
        h3 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
        h4 { font-size: 13px; margin: 10px 0 4px; }
        .parties { display:flex; gap: 24px; }
        .parties > div { flex: 1; border: 1px solid #ddd; padding: 10px; border-radius: 6px; font-size: 12px; }
        .parties .role { font-size: 11px; text-transform: uppercase; color:#777; margin-bottom: 6px; }
        .pre { white-space: pre-wrap; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 8px; }
        table.info td { padding: 4px 6px; }
        table.info td:first-child { color:#666; width: 40%; }
        table.schedule th, table.schedule td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
        table.schedule th { background: #f0f0f0; }
        .subject { page-break-inside: avoid; margin-bottom: 12px; }
        .sign { display:flex; gap: 24px; margin-top: 40px; }
        .sign > div { flex:1; }
        .sign .line { border-top: 1px solid #333; margin-top: 36px; padding-top: 4px; font-size: 11px; color:#555; }
        @media print { body { margin: 12mm; } }
      </style></head><body>
      <div class="company-header">
        <div class="name">${esc(company?.name || "PLATFORM.TJ")}</div>
      </div>
      <h1>${esc((contract.contract_title || "").replace(/\s*№\s*$/, ""))} № ${esc((c.sales || []).map((s: any) => s.sale_number).filter(Boolean).join(", ") || c.fullname?.split(" ")[0] || "")}</h1>
      <div class="meta">
        <span>${tr("Дата")}: ${esc(today)}</span>
      </div>
      ${contract.intro_text ? `<p class="pre">${esc(contract.intro_text)}</p>` : ""}
      <div class="parties">
        <div><div class="role">${tr("Продавец")}</div>${sellerLines}</div>
        <div><div class="role">${tr("Покупатель")}</div>${buyerLines}</div>
      </div>
      <h3>${tr("Предмет договора")}</h3>
      ${subjectsHtml}
      ${contract.body_text ? `<div class="pre">${esc(fill(contract.body_text))}</div>` : ""}
      ${contract.footer_text ? `<div class="pre" style="margin-top:12px">${esc(fill(contract.footer_text))}</div>` : ""}
      <div class="sign">
        <div><div class="line">${tr("Подпись продавца")}${contract.director_name ? " — " + esc(contract.director_name) : ""}</div></div>
        <div><div class="line">${tr("Подпись покупателя")} — ${esc(c.fullname)}</div></div>
      </div>
      <script>window.onload = function(){ var imgs=document.images; if(imgs.length===0){window.print();return;} var loaded=0; for(var i=0;i<imgs.length;i++){ if(imgs[i].complete) loaded++; else imgs[i].onload=imgs[i].onerror=function(){ if(++loaded===imgs.length) window.print(); }; } if(loaded===imgs.length) window.print(); }</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error(tr("Разрешите всплывающие окна")); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Клиенты")}
        subtitle={tr("База покупателей формируется автоматически из продаж по проектам.")}
        actions={isOwner && canModify ? <ExcelImportCustomers /> : undefined}
      />

      {period.control}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setGroupView("active")}
          className="rounded-xl border border-border bg-card p-4 text-left shadow-[var(--shadow-card)] transition hover:border-primary/50 hover:shadow-md"
        >
          <p className="text-xs text-muted-foreground">{tr("Клиенты с оплатой в системе")}</p>
          <p className="mt-1 font-display text-2xl font-semibold">{activeCustomers.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tr("100% оплата")}: <b className="text-success">{fullPaidCustomers.length}</b> · {tr("Рассрочка")}: <b className="text-warning">{installmentCustomers.length}</b>
          </p>
        </button>
        <button
          type="button"
          onClick={() => setGroupView("archive")}
          className="rounded-xl border border-border bg-muted/30 p-4 text-left shadow-[var(--shadow-card)] transition hover:border-primary/50 hover:shadow-md"
        >
          <p className="text-xs text-muted-foreground">🗄 {tr("Архивные продажи")}</p>
          <p className="mt-1 font-display text-2xl font-semibold">{(archivedApts as any[]).length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{tr("Деньги не входят в отчёты")}</p>
        </button>
      </div>

      <Dialog open={groupView !== null} onOpenChange={(o) => !o && setGroupView(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{groupView === "archive" ? tr("Архивные продажи") : tr("Клиенты с оплатой в системе")}</DialogTitle>
            <DialogDescription>
              {groupView === "archive" ? tr("Деньги не входят в отчёты") : tr("Сверху — клиенты со 100% оплатой, ниже — клиенты в рассрочке.")}
            </DialogDescription>
          </DialogHeader>

          {groupView === "archive" ? (
            (archivedApts as any[]).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{tr("Нет данных")}</p>
            ) : (
              <div className="space-y-2">
                {(archivedApts as any[]).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">🗄 {a.historical_owner || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.project?.name} · {tr("кв.")} {a.apartment_number}
                        {a.floor?.floor_number != null ? ` · ${a.floor.floor_number}` : ""}
                        {a.area ? ` · ${a.area} ${tr("м²")}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{tr("Архив")}</Badge>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-5">
              {[
                { title: tr("100% оплата"), list: fullPaidCustomers, cls: "text-success" },
                { title: tr("Рассрочка"), list: installmentCustomers, cls: "text-warning" },
              ].map((grp) => (
                <div key={grp.title}>
                  <h4 className={cn("mb-2 text-sm font-semibold", grp.cls)}>{grp.title} ({grp.list.length})</h4>
                  {grp.list.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{tr("Нет данных")}</p>
                  ) : (
                    <div className="space-y-2">
                      {grp.list.map((c: any) => {
                        const total = c.sales.reduce((s: number, x: any) => s + Number(x.full_price), 0);
                        const paid = c.sales.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);
                        return (
                          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{c.fullname}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.sales.map((s: any) => `${s.apartment?.project?.name ?? ""} ${tr("кв.")} ${s.apartment?.apartment_number ?? ""}`).join(", ")}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">{formatMoney(paid)} / {formatMoney(total)}</p>
                              <p className={cn("font-semibold", total - paid > 0 ? "text-destructive" : "text-success")}>
                                {total - paid > 0 ? formatMoney(total - paid) : "✓ 100%"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>



      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-[calc(50%+2px)] -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск: ФИО, телефон, паспорт…")} className="pl-8 h-9" />
        </div>
        <ZhkBlockFilter projects={projectsList as any} value={zhkBlock} onChange={setZhkBlock} />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{tr("Статус")}</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr("Все статусы")}</SelectItem>
              {Object.entries(CUSTOMER_STATUSES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{tr(v.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {listCustomers.length === 0 ? (
        <EmptyState icon={Users} title={customers.length === 0 ? tr("Клиентов пока нет") : tr("Ничего не найдено")} description={customers.length === 0 ? tr("Добавьте первого покупателя через проект.") : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listCustomers.map((c: any) => {

            const total = c.sales.reduce((s: number, x: any) => s + Number(x.full_price), 0);
            const paid = c.sales.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);
            const pct = total ? Math.round((paid / total) * 100) : 0;
            const creatorName = creatorMap.get(c.created_by);
            const custDocs = docsByCustomer.get(c.id) ?? [];
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-semibold">{c.fullname}</h3>
                      <CustomerStatusBadge status={c.status || "active"} />
                    </div>
                    {c.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</p>}
                    {c.passport && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><FileText className="h-3 w-3" />{c.passport}</p>}
                    {(() => {
                      const labels = Array.from(new Set(
                        (c.sales as any[])
                          .map((s) => {
                            const rawBlock = s.apartment?.project?.name as string | undefined;
                            const rawParent = s.apartment?.project?.parent?.name as string | undefined;
                            if (!rawBlock) return null;
                            const stripBlock = (v: string) => v.replace(/^\s*Блок[иa]?\s+/i, "").trim();
                            const stripJK = (v: string) => v.replace(/^\s*ЖК\s+/i, "").trim();
                            const block = stripBlock(rawBlock);
                            const parent = rawParent ? stripJK(rawParent) : null;
                            return parent ? `ЖК ${parent} Блоки ${block}` : `ЖК ${block}`;
                          })

                          .filter(Boolean)
                      ));
                      if (labels.length === 0) return null;
                      return (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {labels.map((label) => (
                            <Badge key={label as string} variant="secondary" className="text-[11px] font-normal">
                              {label as string}
                            </Badge>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {tr("Добавил:")} {creatorName || "—"} · {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{tr("Остаток")}</p>
                      <p className="font-display text-lg font-semibold text-destructive">{formatMoney(total - paid)}</p>
                    </div>
                    {canModify && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => setEditTarget(c)}
                        title={tr("Изменить данные клиента")}
                        className="h-8 w-8"
                      ><Pencil className="h-4 w-4" /></Button>
                    )}
                    {isOwner && canModify && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => { if (confirm(`${tr("Удалить клиента")} "${c.fullname}"?`)) delCustomer.mutate(c.id); }}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      ><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>

                {isOwner && canModify && (
                  <div className="mt-3">
                    <Select value={c.status || "active"} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CUSTOMER_STATUSES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{tr(v.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Документы клиента */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewTarget(c)}>
                    <Camera className="mr-1.5 h-4 w-4" />{tr("Фото")}{custDocs.length > 0 ? ` (${custDocs.length})` : ""}
                  </Button>
                  {canModify && <Button variant="secondary" size="sm" onClick={() => setUploadTarget(c)}>
                    <ImagePlus className="mr-1.5 h-4 w-4" />{tr("Добавить документ")}
                  </Button>}
                  <Button variant="outline" size="sm" onClick={() => handlePrint(c)}>
                    <Printer className="mr-1.5 h-4 w-4" />{tr("Печать")}
                  </Button>
                  {c.sales.length > 0 && (
                    <Button variant="default" size="sm" onClick={() => handleContract(c)}>
                      <FileSignature className="mr-1.5 h-4 w-4" />{tr("Договор")}
                    </Button>
                  )}
                </div>

                {c.sales.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{tr("Оплачено")} {pct}%</span>
                      <span className="font-medium">{formatMoney(paid)} / {formatMoney(total)}</span>
                    </div>
                    <Progress value={pct} />
                    {c.sales.map((s: any) => {
                      const remaining = Number(s.full_price) - Number(s.paid_amount);
                      const monthly = s.installment_months > 0 && remaining > 0 ? remaining / s.installment_months : 0;
                      const saleSchedule = schedule.filter((sc: any) => sc.sale_id === s.id);
                      const confirmedSum = confirmedBySale.get(s.id) ?? Number(s.paid_amount);
                      const overpay = Math.round((confirmedSum - Number(s.full_price)) * 100) / 100;
                      return (
                        <div key={s.id} className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span><b>{s.apartment?.project?.name}</b> · {tr("кв.")} {s.apartment?.apartment_number}{s.apartment?.area ? ` · ${s.apartment.area} ${tr("м²")}` : ""}</span>
                            <span className="text-muted-foreground">{tr("до")} {formatDate(s.payment_deadline)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>{tr("Дата продажи")}</span>
                            <span>
                              {s.created_at ? `${formatDate(s.created_at)} ${new Date(s.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "—"}
                              {s.sales_manager_id && managerMap.get(s.sales_manager_id) ? ` · ${tr("Менеджер")}: ${managerMap.get(s.sales_manager_id)}` : ""}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{tr("Цена / Оплачено:")}</span>
                            <span>{formatMoney(s.full_price)} / {formatMoney(s.paid_amount)}</span>
                          </div>
                          {Number(s.apartment?.area) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{tr("Цена за 1 м²:")}</span>
                              <span className="font-medium">{formatMoney(Number(s.full_price) / Number(s.apartment.area))} / {tr("м²")}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-destructive">
                            <span>{tr("Остаток:")}</span><b>{formatMoney(remaining)}</b>
                          </div>
                          {overpay > 0 && (
                            <div className="flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-warning-foreground">
                              <span>{tr("Переплата")}: <b>{formatMoney(overpay)}</b></span>
                              {isOwner && canModify && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[11px]"
                                  disabled={refund.isPending}
                                  onClick={() => {
                                    if (confirm(`${tr("Вернуть переплату")}: ${formatMoney(overpay)}?`)) {
                                      refund.mutate({ saleId: s.id, amount: overpay });
                                    }
                                  }}
                                >
                                  {tr("Вернуть")}
                                </Button>
                              )}
                            </div>
                          )}

                          {s.installment_months > 0 && (
                            <div className="flex justify-between text-primary">
                              <span>{tr("Ежемесячно")} ({s.installment_months} {tr("мес.")}):</span>
                              <b>{formatMoney(Math.round(monthly))}</b>
                            </div>
                          )}
                          <div className="pt-1">
                            <ContractGeneratorButtons saleId={s.id} hasInstallment={Number(s.installment_months) > 0} />
                          </div>
                          {saleSchedule.length > 0 && (
                            <details className="pt-1">
                              <summary className="cursor-pointer text-primary flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" />{tr("График")} ({saleSchedule.length} {tr("мес.")})
                              </summary>
                              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                                {saleSchedule.map((sc: any, idx: number) => {
                                  const schedPaid = Number(sc.paid_amount ?? 0);
                                  const schedRemain = Math.max(Number(sc.amount) - schedPaid, 0);
                                  const overdue = new Date(sc.due_date) < new Date() && sc.status !== "paid";
                                  return (
                                    <div key={sc.id} className={cn(
                                      "rounded px-1.5 py-1 border",
                                      sc.status === "paid" ? "border-success/40 bg-success/10 text-success" :
                                      sc.status === "partial" ? "border-primary/40 bg-primary/10 text-primary" :
                                      overdue ? "border-destructive/40 bg-destructive/10 text-destructive" :
                                      "border-border bg-background"
                                    )}>
                                      <div className="font-semibold">М{idx + 1}</div>
                                      <div>{formatDate(sc.due_date)}</div>
                                      <div className="font-medium">{formatMoney(sc.amount)}</div>
                                      {schedPaid > 0 && schedRemain > 0 && (
                                        <div className="opacity-80">{tr("Остаток:")} {formatMoney(schedRemain)}</div>
                                      )}
                                      {sc.status === "paid" && <div className="opacity-80">✓ {tr("Оплачено")}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}

                  </div>
                )}
                {c.notes && <p className="mt-3 text-xs italic text-muted-foreground">{c.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {uploadTarget && (
        <UploadDocsDialog
          customer={uploadTarget}
          companyId={companyId}
          onClose={() => setUploadTarget(null)}
          onUploaded={() => qc.invalidateQueries({ queryKey: ["customer-documents"] })}
        />
      )}
      {viewTarget && (
        <ViewDocsDialog
          customer={viewTarget}
          docs={docsByCustomer.get(viewTarget.id) ?? []}
          onClose={() => setViewTarget(null)}
        />
      )}
      {editTarget && (
        <EditCustomerDialog
          customer={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["customers"] })}
        />
      )}
    </div>
  );
}

function EditCustomerDialog({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
  const { tr } = useT();
  const [form, setForm] = useState({
    fullname: customer.fullname ?? "",
    phone: customer.phone ?? "",
    passport: customer.passport ?? "",
    address: customer.address ?? "",
    birth_date: customer.birth_date ?? "",
    notes: customer.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.fullname.trim()) throw new Error(tr("ФИО холист"));
      const { error } = await supabase
        .from("customers")
        .update({
          fullname: form.fullname.trim(),
          phone: form.phone.trim() || null,
          passport: form.passport.trim() || null,
          address: form.address.trim() || null,
          birth_date: form.birth_date.trim() || null,
          notes: form.notes.trim() || null,
        } as any)
        .eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Сохранено")); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Изменить данные клиента")}</DialogTitle>
          <DialogDescription>{tr("Обновите телефон и другие данные покупателя.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">{tr("ФИО")}</Label><Input value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} /></div>
          <div><Label className="text-xs">{tr("Телефон")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label className="text-xs">{tr("Паспорт")}</Label><Input value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} /></div>
          <div><Label className="text-xs">{tr("Адрес")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label className="text-xs">{tr("Дата рождения")}</Label><Input type="date" value={form.birth_date ? String(form.birth_date).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
          <div><Label className="text-xs">{tr("Эзоҳ")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr("Отмена")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? tr("Загрузка…") : tr("Сохранить")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDocsDialog({ customer, companyId, onClose, onUploaded }: { customer: any; companyId: string | null; onClose: () => void; onUploaded: () => void }) {
  const { tr } = useT();
  const [files, setFiles] = useState<File[]>([]);

  const upload = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error(tr("Выберите файлы"));
      const { data: { user } } = await supabase.auth.getUser();
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${customer.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("customer-docs").upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(`${tr("Загрузка:")} ${upErr.message}`);
        const { error } = await (supabase as any).from("customer_documents").insert({
          customer_id: customer.id,
          company_id: companyId,
          file_path: path,
          file_name: file.name,
          file_type: file.type,
          uploaded_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(tr("Документы добавлены")); onUploaded(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr("Документы клиента")} · {customer.fullname}</DialogTitle>
          <DialogDescription>{tr("Прикрепите фото или сканы документов. Удалить их нельзя — только добавить.")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}>
          <div className="space-y-1.5">
            <Label>{tr("Файлы (фото / сканы)")}</Label>
            <Input type="file" multiple accept="image/*,.pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </div>
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">{tr("Выбрано файлов:")} {files.length}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={upload.isPending || files.length === 0}>
              {upload.isPending ? tr("Загрузка…") : tr("Загрузить")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewDocsDialog({ customer, docs, onClose }: { customer: any; docs: any[]; onClose: () => void }) {
  const { tr } = useT();
  const { data: urls = {} } = useQuery({
    queryKey: ["customer-doc-urls", docs.map((d) => d.id).sort().join(",")],
    queryFn: async () => {
      const map: Record<string, string> = {};
      for (const d of docs) {
        const { data } = await supabase.storage.from("customer-docs").createSignedUrl(d.file_path, 600);
        if (data?.signedUrl) map[d.id] = data.signedUrl;
      }
      return map;
    },
    enabled: docs.length > 0,
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tr("Документы")} · {customer.fullname}</DialogTitle>
          <DialogDescription>{tr("Загруженные фото и документы клиента.")}</DialogDescription>
        </DialogHeader>
        {docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tr("Документы пока не загружены")}</p>
        ) : (
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
            {docs.map((d) => {
              const url = (urls as Record<string, string>)[d.id];
              const isImage = (d.file_type || "").startsWith("image/");
              return (
                <div key={d.id} className="rounded-lg border border-border bg-card p-2">
                  {isImage && url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={d.file_name} className="h-40 w-full rounded-md object-cover" />
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer" className="flex h-40 w-full items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                      <FileIcon className="h-10 w-10" />
                    </a>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs" title={d.file_name}>{d.file_name}</span>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-primary">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{formatDate(d.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
