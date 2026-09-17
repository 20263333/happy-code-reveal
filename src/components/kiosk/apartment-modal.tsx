import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, PlayCircle, ShoppingCart, FileText, X, ArrowLeft, Loader2 } from "lucide-react";
import { kioskSignedUrl, kioskGetSaleByApartment, kioskGetContractTemplate } from "@/lib/kiosk.functions";
import { toast } from "sonner";
import { TourViewer } from "./tour-viewer";
import { ZoomableImage } from "./zoomable-image";
import { KioskSaleFlow } from "./kiosk-sale-flow";
import { usePrefs } from "@/lib/preferences";
import { openPrintWindow, esc } from "@/lib/print";
import { amountToTajikWords } from "@/lib/num-to-words";

type View = "overview" | "tour" | "sale" | "contract";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  empty: { label: "Холӣ", className: "bg-emerald-600 text-white" },
  installment: { label: "Рассрочка", className: "bg-blue-600 text-white" },
  sold: { label: "Фурӯхта шуд", className: "bg-red-600 text-white" },
  unavailable: { label: "Банд (фурӯхта намешавад)", className: "bg-amber-600 text-white" },
};

export function ApartmentModal({
  apartment,
  projectName,
  onClose,
  onSaleComplete,
}: {
  apartment: any;
  projectName: string;
  onClose: () => void;
  onSaleComplete?: () => void;
}) {
  const [view, setView] = useState<View>("overview");
  const signFn = useServerFn(kioskSignedUrl);
  const getSaleFn = useServerFn(kioskGetSaleByApartment);
  const getTemplateFn = useServerFn(kioskGetContractTemplate);
  const { formatMoney } = usePrefs();

  const { data: planUrl } = useQuery({
    queryKey: ["kiosk-plan-url", apartment.plan_image_path],
    queryFn: async () => apartment.plan_image_path
      ? (await signFn({ data: { bucket: "apartment-plans", path: apartment.plan_image_path } })).url
      : null,
    enabled: !!apartment.plan_image_path,
  });

  const isSold = apartment.status === "sold" || apartment.status === "installment";
  const { data: saleData } = useQuery({
    queryKey: ["kiosk-sale-by-apt", apartment.id],
    queryFn: () => getSaleFn({ data: { apartment_id: apartment.id } }),
    enabled: isSold,
  });
  const { data: tplData } = useQuery({
    queryKey: ["kiosk-contract-template"],
    queryFn: () => getTemplateFn(),
  });

  const status = STATUS_LABEL[apartment.status] ?? { label: apartment.status, className: "bg-muted" };
  const canSell = !isSold && apartment.status !== "unavailable";
  const hasTour = !!apartment.tour_url || (apartment.tour_media_paths?.length ?? 0) > 0;

  const printExistingContract = () => {
    const sale = saleData?.sale;
    const customer = saleData?.customer;
    if (!sale || !customer) return;
    const template = tplData?.template;
    const company = tplData?.company;

    if (!template) {
      toast.error("Аввал шаблони шартномаро дар менюи «Договор» танзим кунед");
      return;
    }

    const price = Number(sale.full_price ?? apartment.price ?? 0);
    const down = Number(sale.paid_amount ?? 0);
    const m = Number(sale.installment_months ?? 0);
    const remaining = Math.max(price - down, 0);
    const monthly = m > 0 ? Math.round(remaining / m) : 0;
    const isCash = m === 0;
    const today = new Date(sale.created_at ?? Date.now()).toLocaleDateString("ru-RU");

    const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("ru-RU") : "");
    const passport = [customer.passport_series, customer.passport_number].filter(Boolean).join(" ");

    const fill = (txt?: string | null) => String(txt ?? "")
      .replaceAll("{client}", customer.fullname || "")
      .replaceAll("{passport}", passport)
      .replaceAll("{passport_series}", customer.passport_series || "")
      .replaceAll("{passport_number}", customer.passport_number || "")
      .replaceAll("{passport_issued_by}", customer.passport_issued_by || "")
      .replaceAll("{passport_issued_date}", fmt(customer.passport_issued_date))
      .replaceAll("{birth_date}", fmt(customer.birth_date))
      .replaceAll("{phone}", customer.phone || "")
      .replaceAll("{address}", customer.address || "")
      .replaceAll("{project}", projectName)
      .replaceAll("{apartment}", String(apartment.apartment_number ?? ""))
      .replaceAll("{area}", apartment.area != null ? String(apartment.area) : "")
      .replaceAll("{price}", formatMoney(price))
      .replaceAll("{down_payment}", formatMoney(down))
      .replaceAll("{remaining}", formatMoney(remaining))
      .replaceAll("{months}", String(m))
      .replaceAll("{monthly}", formatMoney(monthly))
      .replaceAll("{date}", today);

    const sellerLines = [
      `<b>${esc(company?.name || template.contract_title || "")}</b>`,
      template.legal_address ? esc(template.legal_address) : "",
      template.inn ? `ИНН: ${esc(template.inn)}` : "",
      template.bank_details ? esc(template.bank_details) : "",
      (template.phone || company?.phone) ? `Телефон: ${esc(template.phone || company?.phone)}` : "",
      template.director_name ? `${esc(template.director_position || "Директор")}: ${esc(template.director_name)}` : "",
    ].filter(Boolean).join("<br>");

    const buyerLines = [
      `<b>${esc(customer.fullname)}</b>`,
      passport ? `Паспорт: ${esc(passport)}` : "",
      customer.phone ? `Телефон: ${esc(customer.phone)}` : "",
      customer.address ? `Суроға: ${esc(customer.address)}` : "",
    ].filter(Boolean).join("<br>");

    const contentHtml = `
      <h1 style="text-align:center;margin:8px 0;">${esc(template.contract_title || "ШАРТНОМАИ ХАРИДУ ФУРӮШИ ХОНА")}</h1>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#444;margin-bottom:16px;">
        <span>${esc(template.number_prefix || "")}${esc(customer.fullname?.split(" ")[0] || "")}</span>
        <span>Сана: ${esc(today)}</span>
      </div>
      ${template.intro_text ? `<p style="white-space:pre-wrap">${esc(fill(template.intro_text))}</p>` : ""}
      <div style="display:flex;gap:24px;margin:12px 0;">
        <div style="flex:1;border:1px solid #ddd;padding:10px;border-radius:6px;font-size:12px;">
          <div style="font-size:11px;text-transform:uppercase;color:#777;margin-bottom:6px;">Фурӯшанда</div>
          ${sellerLines}
        </div>
        <div style="flex:1;border:1px solid #ddd;padding:10px;border-radius:6px;font-size:12px;">
          <div style="font-size:11px;text-transform:uppercase;color:#777;margin-bottom:6px;">Харидор</div>
          ${buyerLines}
        </div>
      </div>
      <h3 style="font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px;">Предмети шартнома</h3>
      <table>
        <tr><td>Проект</td><td>${esc(projectName)}</td></tr>
        <tr><td>Квартира №</td><td>${esc(apartment.apartment_number)}</td></tr>
        <tr><td>Метраж</td><td>${esc(apartment.area ?? "—")} м²</td></tr>
        <tr><td>Нархи 1м²</td><td>${esc(formatMoney(apartment.price_per_sqm ?? 0))}</td></tr>
        <tr><td>Нархи умумӣ</td><td><b>${esc(formatMoney(price))}</b><br><i style="font-size:11px;color:#444;">(${esc(amountToTajikWords(price))})</i></td></tr>
        <tr><td>Тарзи пардохт</td><td>${isCash ? "Нақдӣ (100%)" : "Рассрочка"}</td></tr>
        <tr><td>Пардохти аввал</td><td>${esc(formatMoney(down))}</td></tr>
        ${!isCash ? `<tr><td>Қарзи боқимонда</td><td>${esc(formatMoney(remaining))}</td></tr>
        <tr><td>Мӯҳлат</td><td>${m} моҳ</td></tr>
        <tr><td>Пардохти моҳона</td><td>${esc(formatMoney(monthly))}</td></tr>` : ""}
      </table>
      ${(() => {
        const sched = saleData?.schedule ?? [];
        if (!sched.length) return "";
        const rows = sched.map((sc: any, i: number) => `
          <tr>
            <td>М${i + 1}</td>
            <td>${esc(new Date(sc.due_date).toLocaleDateString("ru-RU"))}</td>
            <td style="text-align:right">${esc(formatMoney(sc.amount))}</td>
            <td>${sc.status === "paid" ? "Пардохт шуд" : sc.status === "partial" ? "Қисман" : "Мунтазир"}</td>
          </tr>`).join("");
        return `
          <div style="page-break-before:always;">
          <h3 style="font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px;">Графики пардохтҳои моҳона</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f0f0f0;">
              <th style="border:1px solid #ccc;padding:5px 8px;text-align:left;">№</th>
              <th style="border:1px solid #ccc;padding:5px 8px;text-align:left;">Сана</th>
              <th style="border:1px solid #ccc;padding:5px 8px;text-align:right;">Маблағ</th>
              <th style="border:1px solid #ccc;padding:5px 8px;text-align:left;">Ҳолат</th>
            </tr></thead>
            <tbody>${rows.replace(/<td>/g, '<td style="border:1px solid #ccc;padding:5px 8px;">').replace(/<td style="text-align:right">/g, '<td style="border:1px solid #ccc;padding:5px 8px;text-align:right;">')}</tbody>
          </table>
          </div>`;
      })()}
      ${template.body_text ? `<div style="white-space:pre-wrap;margin-top:12px">${esc(fill(template.body_text))}</div>` : ""}
      ${template.footer_text ? `<div style="white-space:pre-wrap;margin-top:12px">${esc(fill(template.footer_text))}</div>` : ""}
      <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:13px;">
        <div>Фурӯшанда: ___________________${template.director_name ? " " + esc(template.director_name) : ""}</div>
        <div>Харидор: ___________________ ${esc(customer.fullname)}</div>
      </div>
      ${planUrl ? `
        <div style="page-break-before:always;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0;">
          <h3 style="font-size:18px;margin:0 0 12px;border-bottom:1px solid #ddd;padding-bottom:4px;">Схемаи хона</h3>
          <img src="${esc(planUrl)}" style="width:100%;height:calc(100vh - 60px);object-fit:contain;display:block;" />
        </div>
      ` : ""}
    `;

    openPrintWindow({
      title: `${template.contract_title || "Шартнома"} — ${customer.fullname}`,
      company: { name: company?.name || projectName, phone: company?.phone || null },
      contentHtml,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] w-[95vw] p-0 gap-0 sm:max-w-[95vw]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-card">
          <div className="flex items-center gap-4">
            {view !== "overview" && (
              <Button variant="ghost" size="lg" onClick={() => setView("overview")} className="h-14 px-4">
                <ArrowLeft className="h-6 w-6 mr-2" />Бозгашт
              </Button>
            )}
            <div>
              <div className="text-2xl font-bold">Квартира №{apartment.apartment_number}</div>
              <div className="text-sm text-muted-foreground">{projectName}</div>
            </div>
            <Badge className={status.className + " text-base py-1.5 px-3"}>{status.label}</Badge>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose} className="h-14 w-14">
            <X className="h-7 w-7" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full">
              {/* Plan */}
              <div className="bg-muted/30 relative overflow-hidden">
                {planUrl ? (
                  <ZoomableImage src={planUrl} alt="Схема" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                    <Home className="h-24 w-24 mx-auto mb-3 opacity-30" />
                    <p>Схемаи хона мавҷуд нест</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-lg">
                  <Stat label="Метраж" value={`${apartment.area ?? "—"} м²`} />
                  <Stat label="Нархи 1м²" value={formatMoney(apartment.price_per_sqm ?? 0)} />
                  <Stat label="Нархи умумӣ" value={formatMoney(apartment.price ?? 0)} big />
                  <Stat label="Ошёна" value="—" />
                </div>

                <div className="space-y-3 pt-4">
                  <BigButton
                    icon={<PlayCircle className="h-8 w-8" />}
                    label="3D-тур"
                    subtitle={hasTour ? "Тамошо кунед" : "Мавҷуд нест"}
                    disabled={!hasTour}
                    onClick={() => setView("tour")}
                    color="bg-purple-600 hover:bg-purple-700"
                  />
                  <BigButton
                    icon={<ShoppingCart className="h-8 w-8" />}
                    label="Фурӯш"
                    subtitle={canSell ? "Паспортро сканер кунед" : "Аллакай фурӯхта шуд"}
                    disabled={!canSell}
                    onClick={() => setView("sale")}
                    color="bg-emerald-600 hover:bg-emerald-700"
                  />
                  <BigButton
                    icon={<FileText className="h-8 w-8" />}
                    label="Шартнома"
                    subtitle="Ба чоп омода"
                    onClick={() => setView("contract")}
                    color="bg-blue-600 hover:bg-blue-700"
                  />
                </div>
              </div>
            </div>
          )}

          {view === "tour" && (
            <div className="h-full bg-black">
              <TourViewer tourUrl={apartment.tour_url} tourMediaPaths={apartment.tour_media_paths} />
            </div>
          )}

          {view === "sale" && (
            <div className="h-full overflow-y-auto p-6">
              <KioskSaleFlow apartment={apartment} projectName={projectName} onClose={() => { onSaleComplete?.(); onClose(); }} />
            </div>
          )}

          {view === "contract" && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto rounded-xl border border-border bg-card p-8 space-y-4">
                <h2 className="text-2xl font-bold">Шартномаи хариду фурӯш</h2>
                {isSold ? (
                  saleData?.sale && saleData?.customer ? (
                    <>
                      <p className="text-muted-foreground">
                        Ин хона аллакай фурӯхта шудааст. Шартнома бо маълумоти клиент омода аст.
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-4 bg-muted/30">
                        <div><span className="text-muted-foreground">Клиент:</span> <b>{saleData.customer.fullname}</b></div>
                        <div><span className="text-muted-foreground">Телефон:</span> <b>{saleData.customer.phone}</b></div>
                        <div><span className="text-muted-foreground">Нархи умумӣ:</span> <b>{formatMoney(saleData.sale.full_price ?? 0)}</b></div>
                        <div><span className="text-muted-foreground">Пардохти аввал:</span> <b>{formatMoney(saleData.sale.paid_amount ?? 0)}</b></div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <Button size="lg" className="h-14 text-lg" onClick={printExistingContract}>
                          <FileText className="h-5 w-5 mr-2" /> Чоп кардан
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground py-4">
                      <Loader2 className="h-5 w-5 animate-spin" /> Маълумоти шартнома бор мешавад…
                    </div>
                  )
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Барои ба чоп омода кардани шартномаи расмӣ, аввал фурӯшро анҷом диҳед.
                      Пас аз ворид кардани маълумоти клиент, шартнома автоматӣ пур мешавад.
                    </p>
                    <div className="flex gap-3 pt-4">
                      <Button size="lg" className="h-14 text-lg" onClick={() => setView("sale")}>
                        <ShoppingCart className="h-5 w-5 mr-2" /> Оғози фурӯш
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={big ? "text-2xl font-bold mt-1" : "text-xl font-semibold mt-1"}>{value}</div>
    </div>
  );
}

function BigButton({
  icon, label, subtitle, disabled, onClick, color,
}: {
  icon: React.ReactNode; label: string; subtitle: string;
  disabled?: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-4 rounded-xl px-6 py-6 text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
    >
      {icon}
      <div className="text-left flex-1">
        <div className="text-xl font-bold">{label}</div>
        <div className="text-sm opacity-90">{subtitle}</div>
      </div>
    </button>
  );
}
