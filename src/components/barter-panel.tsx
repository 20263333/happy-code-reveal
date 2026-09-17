import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeftRight, Trash2, FileText, Phone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BARTER_STATUS, barterStatusLabel, BARTER_ASSET_TYPES, barterAssetTypeLabel } from "@/lib/constants";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";

const BUCKET = "barter-docs";
const BARTER_PAYMENT_NOTE = "Бартер: имущество + денежная часть";

type Form = {
  client_name: string;
  client_phone: string;
  property_value: string;
  asset_type: string;
  asset_name: string;
  brand_model: string;
  state_number: string;
  estimated_value: string;
  asset_description: string;
  cash_paid: string;
  status: string;
  note: string;
  floor_id: string;
  apartment_id: string;
  plan: string;
  custom_months: string;
};

const emptyForm: Form = {
  client_name: "", client_phone: "", property_value: "", asset_type: "car",
  asset_name: "", brand_model: "", state_number: "", estimated_value: "",
  asset_description: "", cash_paid: "", status: "valuation", note: "",
  floor_id: "", apartment_id: "", plan: "cash", custom_months: "",
};

function calcRemaining(f: Form) {
  return Number(f.property_value || 0) - Number(f.estimated_value || 0) - Number(f.cash_paid || 0);
}

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

export function BarterPanel({ projectId, canEdit, canDelete }: { projectId: string; canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();

  const { data: rows = [] } = useQuery({
    queryKey: ["barter-deals", projectId],
    queryFn: async () =>
      (await supabase.from("barter_deals").select("*, apartment:apartments(apartment_number, area)").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["barter-deals", projectId] });
    qc.invalidateQueries({ queryKey: ["floors", projectId] });
    qc.invalidateQueries({ queryKey: ["project-sales", projectId] });
    qc.invalidateQueries({ queryKey: ["project-payments", projectId] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  };
  const totalAssets = rows.reduce((s: number, r: any) => s + Number(r.estimated_value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Всего сделок: <b className="text-foreground">{rows.length}</b>
          {totalAssets > 0 && <> · Принятое имущество: <b className="text-foreground">{formatMoney(totalAssets)}</b></>}
        </div>
        {canEdit && <BarterDialog projectId={projectId} onDone={refresh} />}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Нет бартерных сделок" description="Принимайте имущество клиента (авто, землю, дом и др.) в счёт оплаты недвижимости." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r: any) => (
            <BarterCard key={r.id} row={r} projectId={projectId} canEdit={canEdit} canDelete={canDelete} onDone={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function BarterCard({ row, projectId, canEdit, canDelete, onDone }: any) {
  const { formatMoney } = usePrefs();
  const meta = (BARTER_STATUS as any)[row.status] ?? BARTER_STATUS.valuation;
  const remaining = Number(row.remaining);
  const overpay = remaining < 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold">{row.client_name}</h3>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {row.client_phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{row.client_phone}</div>}
            <div>{barterAssetTypeLabel(row.asset_type)}{row.asset_name ? ` · ${row.asset_name}` : ""}{row.brand_model ? ` · ${row.brand_model}` : ""}{row.state_number ? ` · ${row.state_number}` : ""}</div>
            {row.apartment && <div className="flex items-center gap-1 text-primary"><Building2 className="h-3 w-3" />Квартира № {row.apartment.apartment_number} · {row.apartment.area} м²</div>}
          </div>
        </div>
        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">Стоимость недвижимости</span><span className="text-right">{formatMoney(row.property_value)}</span>
        <span className="text-muted-foreground">Принятое имущество</span><span className="text-right text-success">−{formatMoney(row.estimated_value)}</span>
        <span className="text-muted-foreground">Денежная часть</span><span className="text-right text-success">−{formatMoney(row.cash_paid)}</span>
        <span className="border-t border-border pt-1 font-semibold">{overpay ? "Переплата" : "Остаток к оплате"}</span>
        <span className={`border-t border-border pt-1 text-right font-semibold ${overpay ? "text-accent" : "text-destructive"}`}>{formatMoney(Math.abs(remaining))}</span>
      </div>

      {row.asset_description && <p className="text-xs text-muted-foreground">{row.asset_description}</p>}
      {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}

      <div className="flex items-center gap-2">
        <DocLink path={row.photo_url} label="Фото" />
        <DocLink path={row.ownership_document} label="Документ" />
        <div className="ml-auto flex items-center gap-2">
          {canEdit && <BarterDialog projectId={projectId} row={row} onDone={onDone} trigger={<Button size="sm" variant="outline">Изменить</Button>} />}
          {canDelete && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
              if (!confirm("Удалить бартерную сделку? Связанная продажа и квартира будут освобождены.")) return;
              if (row.sale_id) {
                await supabase.from("payments").delete().eq("sale_id", row.sale_id);
                await supabase.from("sales").delete().eq("id", row.sale_id);
              }
              if (row.apartment_id) await supabase.from("apartments").update({ status: "empty" }).eq("id", row.apartment_id);
              const { error } = await supabase.from("barter_deals").delete().eq("id", row.id);
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

function BarterDialog({ projectId, row, onDone, trigger }: { projectId: string; row?: any; onDone: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { formatMoney, currency } = usePrefs();
  const [form, setForm] = useState<Form>(row ? {
    client_name: row.client_name ?? "", client_phone: row.client_phone ?? "", property_value: String(row.property_value ?? ""),
    asset_type: row.asset_type ?? "car", asset_name: row.asset_name ?? "", brand_model: row.brand_model ?? "",
    state_number: row.state_number ?? "", estimated_value: String(row.estimated_value ?? ""),
    asset_description: row.asset_description ?? "", cash_paid: String(row.cash_paid ?? ""),
    status: row.status ?? "valuation", note: row.note ?? "",
    floor_id: "", apartment_id: row.apartment_id ?? "",
    plan: "cash", custom_months: "",
  } : emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);

  // Load existing installment plan from the linked sale (edit mode).
  useQuery({
    queryKey: ["barter-sale-plan", row?.sale_id],
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

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const remaining = calcRemaining(form);
  const overpay = remaining < 0;
  const isCar = form.asset_type === "car";
  const months = planMonths(form);
  const monthly = months > 0 && remaining > 0 ? remaining / months : 0;

  const { data: floors = [] } = useQuery({
    queryKey: ["floors", projectId],
    queryFn: async () =>
      (await supabase.from("floors").select("*, apartments(*)").eq("project_id", projectId).order("floor_number", { ascending: true })).data ?? [],
    enabled: open,
  });

  const selectedFloor = floors.find((f: any) => f.id === form.floor_id);
  const availableApts = (selectedFloor?.apartments ?? []).filter((a: any) => a.status === "empty" || a.status === "reserved");


  const upload = async (file: File, prefix: string) => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/${prefix}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.client_name.trim()) throw new Error("Укажите имя клиента");
      if (!row && !form.apartment_id) throw new Error("Выберите квартиру для клиента");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await (supabase as any).from("profiles").select("company_id").eq("id", user?.id).maybeSingle();
      let photo_url = row?.photo_url ?? null;
      let ownership_document = row?.ownership_document ?? null;
      if (photo) photo_url = await upload(photo, "photo");
      if (doc) ownership_document = await upload(doc, "doc");

      const propertyValue = Number(form.property_value || 0);
      const barterAmount = Number(form.estimated_value || 0) + Number(form.cash_paid || 0);
      const remainingDebt = Math.max(propertyValue - barterAmount, 0);
      const months = planMonths(form);
      let computedDeadline: string | null = null;
      if (months > 0 && remainingDebt > 0) {
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        computedDeadline = d.toISOString().slice(0, 10);
      }

      let customer_id = row?.customer_id ?? null;
      let sale_id = row?.sale_id ?? null;

      // Create / sync the linked customer so the client appears in «Клиенты».
      if (customer_id) {
        await supabase.from("customers").update({
          fullname: form.client_name.trim(), phone: form.client_phone || null,
        }).eq("id", customer_id);
      } else {
        const { data: customer, error: cErr } = await supabase.from("customers").insert({
          fullname: form.client_name.trim(), phone: form.client_phone || null,
          notes: "Бартер", status: remaining <= 0 ? "active" : "booking",
          company_id: prof?.company_id ?? null, created_by: user?.id,
        } as any).select().single();
        if (cErr) throw cErr;
        customer_id = customer.id;
      }

      // Create / sync the linked sale (full price = property value).
      if (sale_id) {
        await supabase.from("sales").update({
          full_price: propertyValue, installment_months: months, payment_deadline: computedDeadline,
        }).eq("id", sale_id);
      } else if (form.apartment_id) {
        const { data: sale, error: sErr } = await supabase.from("sales").insert({
          project_id: projectId, apartment_id: form.apartment_id, customer_id,
          full_price: propertyValue, paid_amount: 0, installment_months: months,
          payment_deadline: computedDeadline, created_by: user?.id, currency,
        }).select().single();
        if (sErr) throw sErr;
        sale_id = sale.id;
      }

      // Record the barter (asset + cash) as a confirmed payment toward the sale.
      if (sale_id) {
        const { data: existing } = await supabase.from("payments")
          .select("id").eq("sale_id", sale_id).eq("note", BARTER_PAYMENT_NOTE).maybeSingle();
        if (existing) {
          await supabase.from("payments").update({ amount: barterAmount }).eq("id", existing.id);
        } else if (barterAmount > 0) {
          await supabase.from("payments").insert({
            sale_id, amount: barterAmount, payment_method: "cash", note: BARTER_PAYMENT_NOTE,
            currency, created_by: user?.id, status: "confirmed",
            confirmed_by: user?.id, confirmed_at: new Date().toISOString(),
          });
        }
        // If no payment yet, set apartment status manually (trigger handles the rest).
        if (barterAmount <= 0 && form.apartment_id) {
          await supabase.from("apartments").update({ status: "installment" }).eq("id", form.apartment_id);
        }
        // Rebuild the monthly installment schedule for the remaining balance.
        await regenSchedule(sale_id, remainingDebt, months);
      }


      const payload: any = {
        project_id: projectId,
        company_id: prof?.company_id ?? null,
        client_name: form.client_name.trim(),
        client_phone: form.client_phone || null,
        property_value: propertyValue,
        asset_type: form.asset_type,
        asset_name: form.asset_name || null,
        brand_model: form.brand_model || null,
        state_number: form.state_number || null,
        estimated_value: Number(form.estimated_value || 0),
        asset_description: form.asset_description || null,
        cash_paid: Number(form.cash_paid || 0),
        status: form.status,
        note: form.note || null,
        photo_url, ownership_document,
        apartment_id: form.apartment_id || null,
        customer_id, sale_id,
      };
      if (row) {
        const { error } = await supabase.from("barter_deals").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("barter_deals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Сохранено"); setOpen(false); if (!row) setForm(emptyForm); setPhoto(null); setDoc(null); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" />Новая бартерная сделка</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{row ? "Бартерная сделка" : "Новая бартерная сделка"}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5"><Label>Клиент *</Label><Input required value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Телефон</Label><Input value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} /></div>

          {row ? (
            <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Квартира: </span>
              <b>{row.apartment ? `№ ${row.apartment.apartment_number} · ${row.apartment.area} м²` : "не назначена"}</b>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Этаж квартиры *</Label>
                <Select value={form.floor_id} onValueChange={(v) => { set("floor_id", v); set("apartment_id", ""); }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {floors.map((f: any) => <SelectItem key={f.id} value={f.id}>Этаж {f.floor_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Квартира *</Label>
                <Select value={form.apartment_id} onValueChange={(v) => {
                  const apt = availableApts.find((a: any) => a.id === v);
                  set("apartment_id", v);
                  if (apt?.price != null) set("property_value", String(apt.price));
                }} disabled={!form.floor_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {availableApts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>№ {a.apartment_number} · {a.area} м²</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5 col-span-2"><Label>Стоимость недвижимости</Label><Input type="number" step="0.01" value={form.property_value} onChange={(e) => set("property_value", e.target.value)} /></div>

          <div className="col-span-2 mt-1 text-xs font-semibold uppercase text-muted-foreground">Имущество в счёт оплаты</div>
          <div className="space-y-1.5">
            <Label>Тип имущества</Label>
            <Select value={form.asset_type} onValueChange={(v) => set("asset_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BARTER_ASSET_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Наименование</Label><Input value={form.asset_name} onChange={(e) => set("asset_name", e.target.value)} /></div>
          {isCar && (
            <>
              <div className="space-y-1.5"><Label>Марка / модель</Label><Input value={form.brand_model} onChange={(e) => set("brand_model", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Гос. номер</Label><Input value={form.state_number} onChange={(e) => set("state_number", e.target.value)} /></div>
            </>
          )}
          <div className="space-y-1.5"><Label>Оценочная стоимость</Label><Input type="number" step="0.01" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Денежная часть оплаты</Label><Input type="number" step="0.01" value={form.cash_paid} onChange={(e) => set("cash_paid", e.target.value)} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Описание имущества</Label><Textarea rows={2} value={form.asset_description} onChange={(e) => set("asset_description", e.target.value)} /></div>

          <div className={`col-span-2 flex items-center justify-between rounded-md border p-3 text-sm ${overpay ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5"}`}>
            <span className="font-medium">{overpay ? "Переплата (имущество дороже)" : "Остаток к оплате"}</span>
            <b className={overpay ? "text-accent" : "text-destructive"}>{formatMoney(Math.abs(remaining))}</b>
          </div>

          {!overpay && remaining > 0 && (
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


          <div className="space-y-1.5">
            <Label>Статус</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(BARTER_STATUS).map((k) => <SelectItem key={k} value={k}>{barterStatusLabel(k)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Фото имущества</Label><Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Документ собственности (PDF/изображение)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Примечание</Label><Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} /></div>

          <DialogFooter className="col-span-2"><Button type="submit" disabled={save.isPending}>Сохранить</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
