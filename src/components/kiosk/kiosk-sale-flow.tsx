import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PassportCapture } from "@/components/passport-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { kioskCreateSale } from "@/lib/kiosk.functions";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { usePrefs } from "@/lib/preferences";

import { openPrintWindow, esc } from "@/lib/print";
import { amountToTajikWords } from "@/lib/num-to-words";

export function KioskSaleFlow({ apartment, projectName, onClose }: { apartment: any; projectName?: string; onClose: () => void }) {
  const { formatMoney } = usePrefs();
  const createSale = useServerFn(kioskCreateSale);
  const [step, setStep] = useState<"passport" | "form" | "done">("passport");
  const [customer, setCustomer] = useState({
    fullname: "", first_name: "", last_name: "", middle_name: "", phone: "", passport_series: "", passport_number: "",
    birth_date: "", gender: "", nationality: "", personal_id: "", address: "", passport_issued_by: "", passport_issued_date: "",
    passport_expiry_date: "",
    inn: "",
  });
  const [paymentType, setPaymentType] = useState<"cash" | "installment">("cash");
  const [downPayment, setDownPayment] = useState("");
  const [months, setMonths] = useState("12");

  const normalizeInn = (v: string) => v.replace(/\D/g, "").slice(0, 9);
  const innValid = customer.inn === "" || /^\d{9}$/.test(customer.inn);

  const handlePassport = (data: any) => {
    setCustomer((current) => ({
      ...current,
      fullname: data.fullname ?? current.fullname,
      first_name: data.first_name ?? current.first_name,
      last_name: data.last_name ?? current.last_name,
      middle_name: data.middle_name ?? current.middle_name,
      passport_series: data.passport_series ?? current.passport_series,
      passport_number: data.passport_number ?? current.passport_number,
      birth_date: data.birth_date ?? current.birth_date,
      gender: data.gender ?? current.gender,
      nationality: data.nationality ?? current.nationality,
      personal_id: data.personal_id ?? current.personal_id,
      address: data.address ?? current.address,
      passport_issued_by: data.issuing_authority ?? data.passport_issued_by ?? current.passport_issued_by,
      passport_issued_date: data.passport_issued_date ?? current.passport_issued_date,
      passport_expiry_date: data.passport_expiry_date ?? current.passport_expiry_date,
      inn: data.inn ? normalizeInn(String(data.inn)) : current.inn,
    }));
    setStep("form");
  };

  const finalize = useMutation({
    mutationFn: async () => {
      if (!customer.fullname || !customer.phone) throw new Error("ФИО ва телефон лозим");
      if (customer.inn && !/^\d{9}$/.test(customer.inn)) throw new Error("ИНН бояд аз 9 рақам иборат бошад");
      return createSale({
        data: {
          apartment_id: apartment.id,
          customer: { ...customer, inn: customer.inn || null },
          payment_type: paymentType,
          down_payment: paymentType === "cash" ? undefined : Number(downPayment || 0),
          installment_months: paymentType === "installment" ? Number(months || 12) : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Фурӯш анҷом ёфт");
      setStep("done");
    },
    onError: (e: any) => toast.error(e.message ?? "Хатогӣ"),
  });

  const printContract = () => {
    const price = Number(apartment.price ?? 0);
    const isCash = paymentType === "cash";
    const down = isCash ? price : Number(downPayment || 0);
    const remaining = Math.max(price - down, 0);
    const m = isCash ? 0 : Number(months || 12);
    const monthly = m > 0 ? Math.round(remaining / m) : 0;
    const today = new Date().toLocaleDateString("ru-RU");
    const contentHtml = `
      <h1>ШАРТНОМАИ ХАРИДУ ФУРӮШИ ХОНА</h1>
      <h2>Сана: ${esc(today)} — ${esc(projectName ?? "")}</h2>
      <table>
        <tr><th colspan="2">Маълумоти клиент</th></tr>
        <tr><td>Ному насаб</td><td>${esc(customer.fullname)}</td></tr>
        <tr><td>Телефон</td><td>${esc(customer.phone)}</td></tr>
        <tr><td>Паспорт</td><td>${esc(customer.passport_series)} ${esc(customer.passport_number)}</td></tr>
        <tr><td>Санаи таваллуд</td><td>${esc(customer.birth_date)}</td></tr>
        <tr><td>Аз тарафи кӣ</td><td>${esc(customer.passport_issued_by)}</td></tr>
        <tr><td>Санаи додашуда</td><td>${esc(customer.passport_issued_date)}</td></tr>
        <tr><td>Санаи анҷоми эътибор</td><td>${esc(customer.passport_expiry_date)}</td></tr>
        <tr><td>Суроға</td><td>${esc(customer.address)}</td></tr>
      </table>
      <table style="margin-top:12px">
        <tr><th colspan="2">Маълумоти хона</th></tr>
        <tr><td>Проект</td><td>${esc(projectName ?? "")}</td></tr>
        <tr><td>Квартира №</td><td>${esc(apartment.apartment_number)}</td></tr>
        <tr><td>Метраж</td><td>${esc(apartment.area ?? "—")} м²</td></tr>
        <tr><td>Нархи 1м²</td><td>${esc(formatMoney(apartment.price_per_sqm ?? 0))}</td></tr>
        <tr><td>Нархи умумӣ</td><td><b>${esc(formatMoney(price))}</b><br><i style="font-size:11px;color:#444;">(${esc(amountToTajikWords(price))})</i></td></tr>
      </table>
      <table style="margin-top:12px">
        <tr><th colspan="2">Шартҳои пардохт</th></tr>
        <tr><td>Тарзи пардохт</td><td>${isCash ? "Нақдӣ (100%)" : "Рассрочка"}</td></tr>
        <tr><td>Пардохти аввал</td><td>${esc(formatMoney(down))}</td></tr>
        ${!isCash ? `<tr><td>Қарзи боқимонда</td><td>${esc(formatMoney(remaining))}</td></tr>
        <tr><td>Мӯҳлат</td><td>${m} моҳ</td></tr>
        <tr><td>Пардохти моҳона</td><td>${esc(formatMoney(monthly))}</td></tr>` : ""}
      </table>
      <div style="margin-top:40px; display:flex; justify-content:space-between; font-size:13px;">
        <div>Фурӯшанда: ___________________</div>
        <div>Харидор: ___________________</div>
      </div>
    `;
    openPrintWindow({
      title: `Шартнома — ${customer.fullname}`,
      company: { name: projectName ?? null, phone: null },
      contentHtml,
    });
  };

  if (step === "done") {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="mx-auto w-24 h-24 rounded-full bg-emerald-600 flex items-center justify-center mb-6">
          <Check className="h-14 w-14 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Фурӯш анҷом ёфт!</h2>
        <p className="text-muted-foreground mb-8">Клиент {customer.fullname} — квартира №{apartment.apartment_number}</p>
        <div className="flex gap-3 justify-center">
          <Button size="lg" className="h-14 text-lg" onClick={printContract}>Чоп кардани шартнома</Button>
          <Button size="lg" variant="outline" className="h-14 text-lg" onClick={onClose}>Тайёр</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {step === "passport" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold mb-4">Қадами 1: Скан кардани паспорт</h2>
          <PassportCapture mode="kiosk" onExtracted={handlePassport} />
          <Button variant="outline" className="mt-4" onClick={() => setStep("form")}>
            Дастӣ пур кардан
          </Button>
        </div>
      )}

      {step === "form" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-2xl font-bold mb-4">Қадами 2: Маълумоти клиент</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="ФИО*" value={customer.fullname} onChange={(v) => setCustomer({ ...customer, fullname: v })} />
              <Field label="Телефон*" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} />
              <Field label="Ном" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} />
              <Field label="Насаб" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} />
              <Field label="Номи падар" value={customer.middle_name} onChange={(v) => setCustomer({ ...customer, middle_name: v })} />
              <Field label="Ҷинс" value={customer.gender} onChange={(v) => setCustomer({ ...customer, gender: v })} />
              <Field label="Миллат" value={customer.nationality} onChange={(v) => setCustomer({ ...customer, nationality: v })} />
              <Field label="Серияи паспорт" value={customer.passport_series} onChange={(v) => setCustomer({ ...customer, passport_series: v })} />
              <Field label="Рақами паспорт" value={customer.passport_number} onChange={(v) => setCustomer({ ...customer, passport_number: v })} />
              <Field label="Personal ID / JIS" value={customer.personal_id} onChange={(v) => setCustomer({ ...customer, personal_id: v.replace(/\D/g, "") })} />
              <Field label="Санаи таваллуд" value={customer.birth_date} onChange={(v) => setCustomer({ ...customer, birth_date: v })} type="date" />
              <Field label="Санаи додашуда" value={customer.passport_issued_date} onChange={(v) => setCustomer({ ...customer, passport_issued_date: v })} type="date" />
              <Field label="Санаи анҷоми эътибор" value={customer.passport_expiry_date} onChange={(v) => setCustomer({ ...customer, passport_expiry_date: v })} type="date" />
              <div className="md:col-span-2">
                <Field label="Аз тарафи кӣ" value={customer.passport_issued_by} onChange={(v) => setCustomer({ ...customer, passport_issued_by: v })} />
              </div>
              <div>
                <Label>ИНН</Label>
                <Input
                  value={customer.inn}
                  onChange={(e) => setCustomer({ ...customer, inn: normalizeInn(e.target.value) })}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="9 рақам"
                  className={`h-12 text-base ${!innValid ? "border-destructive" : ""}`}
                />
                {!innValid && (
                  <p className="text-xs text-destructive mt-1">ИНН бояд аз 9 рақам иборат бошад</p>
                )}
              </div>
              <div className="md:col-span-2">
                <Field label="Суроға" value={customer.address} onChange={(v) => setCustomer({ ...customer, address: v })} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-2xl font-bold mb-4">Қадами 3: Пардохт</h2>
            <div className="space-y-3">
              <div>
                <Label>Тарзи пардохт</Label>
                <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Нақдӣ (100%)</SelectItem>
                    <SelectItem value="installment">Рассрочка</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentType === "installment" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Пардохти аввал" value={downPayment} onChange={setDownPayment} type="number" />
                  <Field label="Моҳҳо" value={months} onChange={setMonths} type="number" />
                </div>
              )}
              <div className="flex justify-between text-lg pt-2 border-t border-border">
                <span>Нархи умумӣ:</span>
                <b>{formatMoney(apartment.price ?? 0)}</b>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-xl"
            onClick={() => finalize.mutate()}
            disabled={finalize.isPending || !innValid}
          >
            {finalize.isPending && <Loader2 className="h-6 w-6 mr-2 animate-spin" />}
            Тасдиқи фурӯш
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-12 text-base" />
    </div>
  );
}
