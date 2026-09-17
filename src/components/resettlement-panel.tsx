import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Home, Trash2, FileText, Phone, MapPin, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RESETTLEMENT_STATUS, resettlementStatusLabel } from "@/lib/constants";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";

const BUCKET = "resettlement-docs";
const COMPENSATION_NOTE = "Компенсация за переселение";

type Form = {
  owner_fullname: string;
  phone: string;
  old_address: string;
  cadastral_number: string;
  old_house_area: string;
  land_area: string;
  compensation_area: string;
  additional_area: string;
  price_per_m2: string;
  discount: string;
  status: string;
  note: string;
  floor_id: string;
  apartment_id: string;
  plan: string;
  custom_months: string;
  compensation_type: string; // 'apartment' | 'cash'
  cash_amount: string;       // manual / final payout to the owner
};

const emptyForm: Form = {
  owner_fullname: "", phone: "", old_address: "", cadastral_number: "",
  old_house_area: "", land_area: "", compensation_area: "", additional_area: "",
  price_per_m2: "", discount: "", status: "negotiation", note: "",
  floor_id: "", apartment_id: "", plan: "cash", custom_months: "",
  compensation_type: "apartment", cash_amount: "",
};

// Amount the resettler pays out of pocket (for the additional purchased area).
function calcTotal(f: Form) {
  const add = Number(f.additional_area || 0);
  const price = Number(f.price_per_m2 || 0);
  const disc = Number(f.discount || 0);
  return Math.max(add * price - disc, 0);
}

// Suggested cash compensation: (old house + land) * price per m² − discount.
function calcCashAuto(f: Form) {
  const area = Number(f.old_house_area || 0) + Number(f.land_area || 0);
  const price = Number(f.price_per_m2 || 0);
  const disc = Number(f.discount || 0);
  return Math.max(area * price - disc, 0);
}

const COMPENSATION_EXPENSE_CAT = "compensation";

function planMonths(f: Form) {
  return f.plan === "cash" ? 0 : f.plan === "custom" ? Math.max(0, Math.floor(Number(f.custom_months || 0))) : Number(f.plan);
}

// Rebuild the equal-installment schedule for the remaining balance of a sale.
async function regenSchedule(sale_id: string, remaining: number, months: number) {
  await supabase.from("payment_schedule").delete().eq("sale_id", sale_id);
  if (months <= 0 || remaining <= 0) return;
  const monthlyAmt = Math.floor(remaining / months);
  const base = new Date(); base.setMonth(base.getMonth() + 1);
  const rows = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(base); d.setMonth(d.getMonth() + i);
    rows.push({
      sale_id, due_date: d.toISOString().slice(0, 10),
      amount: i === months - 1 ? remaining - monthlyAmt * (months - 1) : monthlyAmt,
    });
  }
  await supabase.from("payment_schedule").insert(rows);
}

export function ResettlementPanel({ projectId, canEdit, canDelete }: { projectId: string; canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();

  const { data: rows = [] } = useQuery({
    queryKey: ["resettlements", projectId],
    queryFn: async () =>
      (await supabase.from("resettlements").select("*, apartment:apartments(apartment_number, area, price)").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["resettlements", projectId] });
    qc.invalidateQueries({ queryKey: ["floors", projectId] });
    qc.invalidateQueries({ queryKey: ["project-sales", projectId] });
    qc.invalidateQueries({ queryKey: ["project-payments", projectId] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["expenses", projectId] });
    qc.invalidateQueries({ queryKey: ["all-expenses"] });
  };

  const totalPayable = rows.reduce((s: number, r: any) => s + Number(r.total_payable || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Всего карточек: <b className="text-foreground">{rows.length}</b>
          {totalPayable > 0 && <> · К оплате: <b className="text-foreground">{formatMoney(totalPayable)}</b></>}
        </div>
        {canEdit && <ResettlementDialog projectId={projectId} onDone={refresh} />}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Home} title="Нет переселенцев" description="Добавьте собственника дома или земельного участка, подлежащего переселению." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r: any) => (
            <ResettlementCard key={r.id} row={r} projectId={projectId} canEdit={canEdit} canDelete={canDelete} onDone={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResettlementCard({ row, projectId, canEdit, canDelete, onDone }: any) {
  const { formatMoney } = usePrefs();
  const meta = (RESETTLEMENT_STATUS as any)[row.status] ?? RESETTLEMENT_STATUS.negotiation;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold">{row.owner_fullname}</h3>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {row.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{row.phone}</div>}
            {row.old_address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{row.old_address}</div>}
            {row.cadastral_number && <div>Кадастр: {row.cadastral_number}</div>}
            {row.compensation_type === "cash" ? (
              <div className="flex items-center gap-1 text-destructive">Денежная компенсация</div>
            ) : row.apartment && <div className="flex items-center gap-1 text-primary"><Building2 className="h-3 w-3" />Квартира № {row.apartment.apartment_number} · {row.apartment.area} м²</div>}
          </div>
        </div>
        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
      </div>

      {row.compensation_type === "cash" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">Старый дом</span><span className="text-right">{Number(row.old_house_area).toLocaleString()} м²</span>
          <span className="text-muted-foreground">Земля</span><span className="text-right">{Number(row.land_area).toLocaleString()} м²</span>
          {Number(row.discount) > 0 && (<><span className="text-muted-foreground">Скидка</span><span className="text-right text-destructive">−{formatMoney(row.discount)}</span></>)}
          <span className="border-t border-border pt-1 font-semibold">К выплате (расход)</span>
          <span className="border-t border-border pt-1 text-right font-semibold text-destructive">{formatMoney(row.cash_amount)}</span>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">Старый дом</span><span className="text-right">{Number(row.old_house_area).toLocaleString()} м²</span>
        <span className="text-muted-foreground">Земля</span><span className="text-right">{Number(row.land_area).toLocaleString()} м²</span>
        <span className="text-muted-foreground">Компенсация</span><span className="text-right">{Number(row.compensation_area).toLocaleString()} м²</span>
        <span className="text-muted-foreground">Доп. площадь</span><span className="text-right">{Number(row.additional_area).toLocaleString()} м²</span>
        <span className="text-muted-foreground">Цена за м²</span><span className="text-right">{formatMoney(row.price_per_m2)}</span>
        {Number(row.discount) > 0 && (<><span className="text-muted-foreground">Скидка</span><span className="text-right text-destructive">−{formatMoney(row.discount)}</span></>)}
        <span className="border-t border-border pt-1 font-semibold">Итого к оплате</span>
        <span className="border-t border-border pt-1 text-right font-semibold text-primary">{formatMoney(row.total_payable)}</span>
      </div>
      )}

      {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}

      <div className="flex items-center gap-2">
        <DocLink path={row.photo_url} label="Фото" />
        <DocLink path={row.ownership_document} label="Документ" />
        <div className="ml-auto flex items-center gap-2">
          {canEdit && <ResettlementDialog projectId={projectId} row={row} onDone={onDone} trigger={<Button size="sm" variant="outline">Изменить</Button>} />}
          {canDelete && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
              if (!confirm("Удалить карточку переселения? Связанная продажа и квартира будут освобождены.")) return;
              if (row.sale_id) {
                await supabase.from("payments").delete().eq("sale_id", row.sale_id);
                await supabase.from("sales").delete().eq("id", row.sale_id);
              }
              if (row.apartment_id) await supabase.from("apartments").update({ status: "empty" }).eq("id", row.apartment_id);
              if (row.expense_id) await supabase.from("expenses").delete().eq("id", row.expense_id);
              const { error } = await supabase.from("resettlements").delete().eq("id", row.id);
              if (error) toast.error(error.message); else { toast.success("Удалено"); onDone(); }
            }}><Trash2 className="h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DocLink({ path, label }: { path: string | null; label: string }) {
  if (!path) return null;
  const open = async () => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return <button onClick={open} className="inline-flex items-center gap-1 text-xs text-accent underline"><FileText className="h-3 w-3" />{label}</button>;
}

function ResettlementDialog({ projectId, row, onDone, trigger }: { projectId: string; row?: any; onDone: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { formatMoney, currency } = usePrefs();
  const [form, setForm] = useState<Form>(row ? {
    owner_fullname: row.owner_fullname ?? "", phone: row.phone ?? "", old_address: row.old_address ?? "",
    cadastral_number: row.cadastral_number ?? "", old_house_area: String(row.old_house_area ?? ""),
    land_area: String(row.land_area ?? ""), compensation_area: String(row.compensation_area ?? ""),
    additional_area: String(row.additional_area ?? ""), price_per_m2: String(row.price_per_m2 ?? ""),
    discount: String(row.discount ?? ""), status: row.status ?? "negotiation", note: row.note ?? "",
    floor_id: "", apartment_id: row.apartment_id ?? "",
    plan: "cash", custom_months: "",
    compensation_type: row.compensation_type ?? "apartment", cash_amount: String(row.cash_amount ?? ""),
  } : emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Load existing installment plan from the linked sale (edit mode).
  useQuery({
    queryKey: ["resettlement-sale-plan", row?.sale_id],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("installment_months").eq("id", row.sale_id).maybeSingle();
      const m = Number(data?.installment_months ?? 0);
      if (!planLoaded) {
        const known = ["6", "12", "18", "24", "36"];
        setForm((p) => ({
          ...p,
          plan: m <= 0 ? "cash" : known.includes(String(m)) ? String(m) : "custom",
          custom_months: m > 0 ? String(m) : "",
        }));
        setPlanLoaded(true);
      }
      return data ?? null;
    },
    enabled: open && !!row?.sale_id && !planLoaded,
  });

  const { data: floors = [] } = useQuery({
    queryKey: ["floors", projectId],
    queryFn: async () =>
      (await supabase.from("floors").select("*, apartments(*)").eq("project_id", projectId).order("floor_number", { ascending: true })).data ?? [],
    enabled: open,
  });

  const selectedFloor = floors.find((f: any) => f.id === form.floor_id);
  const availableApts = (selectedFloor?.apartments ?? []).filter((a: any) => a.status === "empty" || a.status === "reserved");
  const selectedApt = availableApts.find((a: any) => a.id === form.apartment_id);

  // Real (catalogue) price of the assigned apartment — нархи аслии хонаи нав.
  const aptPrice = Number(selectedApt?.price ?? row?.apartment?.price ?? 0);
  const payable = calcTotal(form);                          // out-of-pocket for extra area
  const fullPrice = aptPrice > 0 ? aptPrice : payable;      // нархи асл
  const compensation = Math.max(fullPrice - payable, 0);    // covered by old property
  const months = planMonths(form);
  const monthly = months > 0 && payable > 0 ? payable / months : 0;
  const isCash = form.compensation_type === "cash";
  const cashAuto = calcCashAuto(form);
  const cashPayout = Number(form.cash_amount || 0) > 0 ? Number(form.cash_amount) : cashAuto;


  const upload = async (file: File, prefix: string) => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/${prefix}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.owner_fullname.trim()) throw new Error("Укажите ФИО собственника");
      if (!isCash && !row && !form.apartment_id) throw new Error("Выберите квартиру для переселенца");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await (supabase as any).from("profiles").select("company_id").eq("id", user?.id).maybeSingle();
      let photo_url = row?.photo_url ?? null;
      let ownership_document = row?.ownership_document ?? null;
      if (photo) photo_url = await upload(photo, "photo");
      if (doc) ownership_document = await upload(doc, "doc");

      const totalPayable = calcTotal(form);
      const saleFullPrice = fullPrice;                       // нархи аслии хона
      const compensationAmt = Math.max(saleFullPrice - totalPayable, 0);
      const installMonths = planMonths(form);
      let computedDeadline: string | null = null;
      if (installMonths > 0 && totalPayable > 0) {
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        computedDeadline = d.toISOString().slice(0, 10);
      }

      let customer_id = row?.customer_id ?? null;
      let sale_id = row?.sale_id ?? null;
      let expense_id = row?.expense_id ?? null;

      if (isCash) {
        // Cash compensation: the company PAYS the owner -> record as a project expense.
        const payoutAmt = Number(form.cash_amount || 0) > 0 ? Number(form.cash_amount) : calcCashAuto(form);
        const desc = "Компенсация переселенцу: " + form.owner_fullname.trim()
          + (form.old_address ? " (" + form.old_address + ")" : "");
        if (expense_id) {
          await supabase.from("expenses").update({
            amount: payoutAmt, description: desc,
          }).eq("id", expense_id);
        } else if (payoutAmt > 0) {
          const { data: exp, error: eErr } = await supabase.from("expenses").insert({
            project_id: projectId, amount: payoutAmt, category: COMPENSATION_EXPENSE_CAT,
            description: desc, expense_date: new Date().toISOString().slice(0, 10),
            currency, created_by: user?.id,
          }).select().single();
          if (eErr) throw eErr;
          expense_id = exp.id;
        }
        // Release any previously linked apartment / sale if the card was switched to cash.
        if (row?.sale_id) {
          await supabase.from("payments").delete().eq("sale_id", row.sale_id);
          await supabase.from("sales").delete().eq("id", row.sale_id);
          sale_id = null;
        }
        if (row?.apartment_id) {
          await supabase.from("apartments").update({ status: "empty" }).eq("id", row.apartment_id);
        }
      } else {
        // Apartment compensation (default flow).
        // Create / sync the linked customer so the resettler appears in «Клиенты».
        if (customer_id) {
          await supabase.from("customers").update({
            fullname: form.owner_fullname.trim(), phone: form.phone || null, address: form.old_address || null,
          }).eq("id", customer_id);
        } else {
          const { data: customer, error: cErr } = await supabase.from("customers").insert({
            fullname: form.owner_fullname.trim(), phone: form.phone || null, address: form.old_address || null,
            notes: "Переселение", status: totalPayable <= 0 ? "active" : "booking",
            company_id: prof?.company_id ?? null, created_by: user?.id,
          } as any).select().single();
          if (cErr) throw cErr;
          customer_id = customer.id;
        }

        // Create / sync the linked sale at the real apartment price so «Продажи»/«Платежи»/отчёты
        // show the full value, not just the surcharge for extra area.
        if (sale_id) {
          await supabase.from("sales").update({
            full_price: saleFullPrice, installment_months: installMonths, payment_deadline: computedDeadline,
          }).eq("id", sale_id);
        } else if (form.apartment_id) {
          const { data: sale, error: sErr } = await supabase.from("sales").insert({
            project_id: projectId, apartment_id: form.apartment_id, customer_id,
            full_price: saleFullPrice, paid_amount: 0, installment_months: installMonths,
            payment_deadline: computedDeadline, created_by: user?.id, currency,
          }).select().single();
          if (sErr) throw sErr;
          sale_id = sale.id;
        }

        if (sale_id) {
          // Record the compensation (old property value) as a confirmed payment.
          const { data: existingComp } = await supabase.from("payments")
            .select("id").eq("sale_id", sale_id).eq("note", COMPENSATION_NOTE).maybeSingle();
          if (existingComp) {
            await supabase.from("payments").update({ amount: compensationAmt }).eq("id", existingComp.id);
          } else if (compensationAmt > 0) {
            await supabase.from("payments").insert({
              sale_id, amount: compensationAmt, payment_method: "cash", note: COMPENSATION_NOTE,
              currency, created_by: user?.id, status: "confirmed",
              confirmed_by: user?.id, confirmed_at: new Date().toISOString(),
            });
          }
          // No compensation payment yet -> set status manually (trigger handles the rest).
          if (compensationAmt <= 0 && form.apartment_id) {
            await supabase.from("apartments").update({ status: totalPayable <= 0 ? "sold" : "installment" }).eq("id", form.apartment_id);
          }
          // Rebuild the monthly installment schedule for the remaining (out-of-pocket) balance.
          await regenSchedule(sale_id, totalPayable, installMonths);
        }
      }


      const payload: any = {
        project_id: projectId,
        company_id: prof?.company_id ?? null,
        owner_fullname: form.owner_fullname.trim(),
        phone: form.phone || null,
        old_address: form.old_address || null,
        cadastral_number: form.cadastral_number || null,
        old_house_area: Number(form.old_house_area || 0),
        land_area: Number(form.land_area || 0),
        compensation_area: Number(form.compensation_area || 0),
        additional_area: Number(form.additional_area || 0),
        price_per_m2: Number(form.price_per_m2 || 0),
        discount: Number(form.discount || 0),
        status: form.status,
        note: form.note || null,
        photo_url, ownership_document,
        compensation_type: form.compensation_type,
        cash_amount: isCash ? (Number(form.cash_amount || 0) > 0 ? Number(form.cash_amount) : calcCashAuto(form)) : 0,
        apartment_id: isCash ? null : (form.apartment_id || null),
        customer_id: isCash ? null : customer_id,
        sale_id, expense_id,
      };
      if (row) {
        const { error } = await supabase.from("resettlements").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("resettlements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Сохранено"); setOpen(false); if (!row) setForm(emptyForm); setPhoto(null); setDoc(null); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" />Добавить переселение</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{row ? "Карточка переселения" : "Новое переселение"}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5 col-span-2"><Label>ФИО собственника *</Label><Input required value={form.owner_fullname} onChange={(e) => set("owner_fullname", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Телефон</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Кадастровый номер</Label><Input value={form.cadastral_number} onChange={(e) => set("cadastral_number", e.target.value)} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Адрес старого дома</Label><Input value={form.old_address} onChange={(e) => set("old_address", e.target.value)} /></div>

          <div className="space-y-1.5 col-span-2">
            <Label>Вид компенсации</Label>
            <Select value={form.compensation_type} onValueChange={(v) => set("compensation_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Квартира в доме</SelectItem>
                <SelectItem value="cash">Денежная выплата</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isCash && (row ? (
            <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Новая квартира: </span>
              <b>{row.apartment ? `№ ${row.apartment.apartment_number} · ${row.apartment.area} м²` : "не назначена"}</b>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Этаж новой квартиры *</Label>
                <Select value={form.floor_id} onValueChange={(v) => { set("floor_id", v); set("apartment_id", ""); }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {floors.map((f: any) => <SelectItem key={f.id} value={f.id}>Этаж {f.floor_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Квартира *</Label>
                <Select value={form.apartment_id} onValueChange={(v) => set("apartment_id", v)} disabled={!form.floor_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {availableApts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>№ {a.apartment_number} · {a.area} м²</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ))}

          <div className="space-y-1.5"><Label>Площадь старого дома (м²)</Label><Input type="number" step="0.01" value={form.old_house_area} onChange={(e) => set("old_house_area", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Площадь земли (м²)</Label><Input type="number" step="0.01" value={form.land_area} onChange={(e) => set("land_area", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Компенсационная площадь (м²)</Label><Input type="number" step="0.01" value={form.compensation_area} onChange={(e) => set("compensation_area", e.target.value)} /></div>
          {!isCash && <div className="space-y-1.5"><Label>Доп. площадь для покупки (м²)</Label><Input type="number" step="0.01" value={form.additional_area} onChange={(e) => set("additional_area", e.target.value)} /></div>}
          <div className="space-y-1.5"><Label>Цена за 1 м²</Label><Input type="number" step="0.01" value={form.price_per_m2} onChange={(e) => set("price_per_m2", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Скидка</Label><Input type="number" step="0.01" value={form.discount} onChange={(e) => set("discount", e.target.value)} /></div>

          {isCash ? (
            <>
              <div className="space-y-1.5 col-span-2">
                <Label>Сумма выплаты собственнику</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" placeholder={String(cashAuto)} value={form.cash_amount} onChange={(e) => set("cash_amount", e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => set("cash_amount", String(cashAuto))}>= авто</Button>
                </div>
                <p className="text-xs text-muted-foreground">Авто: (дом {Number(form.old_house_area || 0)} + земля {Number(form.land_area || 0)}) м² × цена − скидка</p>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <span className="text-muted-foreground">Расчётная сумма</span>
                <span className="text-right">{formatMoney(cashAuto)}</span>
                <span className="border-t border-border pt-1 font-semibold">К выплате (расход)</span>
                <span className="border-t border-border pt-1 text-right font-semibold text-destructive">{formatMoney(cashPayout)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <span className="text-muted-foreground">Реальная цена квартиры</span>
                <span className="text-right">{aptPrice > 0 ? formatMoney(aptPrice) : "—"}</span>
                <span className="text-muted-foreground">Компенсация (старое жильё)</span>
                <span className="text-right text-success">−{formatMoney(compensation)}</span>
                <span className="border-t border-border pt-1 font-semibold">К оплате (за доп. площадь)</span>
                <span className="border-t border-border pt-1 text-right font-semibold text-primary">{formatMoney(payable)}</span>
              </div>

              {payable > 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label>Рассрочка остатка</Label>
                    <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Без рассрочки</SelectItem>
                        <SelectItem value="6">6 месяцев</SelectItem>
                        <SelectItem value="12">12 месяцев</SelectItem>
                        <SelectItem value="18">18 месяцев</SelectItem>
                        <SelectItem value="24">24 месяца</SelectItem>
                        <SelectItem value="36">36 месяцев</SelectItem>
                        <SelectItem value="custom">Другой срок</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.plan === "custom" ? (
                    <div className="space-y-1.5"><Label>Количество месяцев</Label><Input type="number" min="1" value={form.custom_months} onChange={(e) => set("custom_months", e.target.value)} /></div>
                  ) : (
                    <div className="space-y-1.5"><Label>Ежемесячный платёж</Label><Input readOnly value={monthly > 0 ? formatMoney(monthly) : "—"} /></div>
                  )}
                  {form.plan === "custom" && months > 0 && (
                    <div className="col-span-2 text-xs text-muted-foreground">Ежемесячный платёж: <b className="text-foreground">{formatMoney(monthly)}</b> × {months} мес.</div>
                  )}
                </>
              )}
            </>
          )}


          <div className="space-y-1.5">
            <Label>Статус</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(RESETTLEMENT_STATUS).map((k) => <SelectItem key={k} value={k}>{resettlementStatusLabel(k)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Фото объекта</Label><Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Документ собственности (PDF/изображение)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Примечание</Label><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></div>

          <DialogFooter className="col-span-2"><Button type="submit" disabled={save.isPending}>Сохранить</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
