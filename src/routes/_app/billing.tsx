import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Copy, Upload, Check, Clock, X, Infinity as InfIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { billingPeriodLabel, billingPeriodShort } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { submitSubscriptionPayment } from "@/lib/billing.functions";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [{ title: "Тарифы и оплата — Binosoz.tj" }] }),
  component: BillingPage,
});

const PROVIDER_LABELS: Record<string, string> = {
  dc: "Dushanbe City",
  alif: "Alif Bank",
  eskhata: "Eskhata Online",
};

function BillingPage() {
  const { tr } = useT();
  const { user, companyId, isOwner, loading: authLoading, profileLoaded } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tariffId, setTariffId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitPayment = useServerFn(submitSubscriptionPayment);

  const { data: tariffs = [] } = useQuery({
    queryKey: ["tariffs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tariffs")
        .select("*").eq("is_active", true).order("duration_days", { nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { listActivePaymentMethods } = await import("@/lib/payment-methods.functions");
      return await listActivePaymentMethods();
    },
  });

  const { data: company } = useQuery({
    queryKey: ["my-company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await (supabase as any).from("companies").select("id,name,owner_user_id,status,phone,created_at,updated_at,subscription_tariff_id,subscription_started_at,subscription_expires_at,max_staff,max_projects,max_blocks,enabled_modules,is_demo,demo_expires_at,kiosk_enabled").eq("id", companyId).single();
      return data;
    },
    enabled: !!companyId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-subscription-payments", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("subscription_payments")
        .select("*, tariff:tariffs(name, duration_days)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!tariffId && tariffs.length) setTariffId(tariffs[0].id);
    if (!methodId && methods.length) setMethodId(methods[0].id);
  }, [tariffs, methods, tariffId, methodId]);

  const selectedTariff = tariffs.find((t: any) => t.id === tariffId);
  const selectedMethod = methods.find((m: any) => m.id === methodId);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(tr("Скопировано")); }
    catch { toast.error(tr("Не удалось скопировать")); }
  };

  const submit = async () => {
    if (authLoading || !profileLoaded) { toast.error(tr("Маълумоти ҳисоб ҳоло бор мешавад")); return; }
    if (!user || !companyId) { toast.error(tr("Ширкат ёфт нашуд")); return; }
    if (!isOwner) { toast.error(tr("Только владелец компании может оплачивать")); return; }
    if (!selectedTariff || !file) {
      toast.error(tr("Выберите тариф и загрузите чек")); return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("subscription-receipts")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      await submitPayment({ data: {
        tariff_id: selectedTariff.id,
        payment_method_id: selectedMethod?.id ?? null,
        receipt_path: path,
      } });
      toast.success(tr("Чек отправлен на проверку"));
      setFile(null); setNote("");
      qc.invalidateQueries({ queryKey: ["my-subscription-payments"] });
    } catch (e: any) { toast.error(e.message ?? tr("Ошибка")); }
    finally { setSubmitting(false); }
  };

  const expires = company?.subscription_expires_at ? new Date(company.subscription_expires_at) : null;
  const isActive = !!company?.subscription_tariff_id && (!expires || expires > new Date());

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={tr("Тарифы и оплата")} subtitle={tr("Выберите тариф, оплатите и загрузите чек.")} />
      <Tabs defaultValue="subscription">
        <TabsList>
          <TabsTrigger value="subscription">{tr("Подписка")}</TabsTrigger>
        </TabsList>
        <TabsContent value="subscription" className="mt-4 space-y-6">



      {/* Status */}
      <div className={`rounded-xl border p-5 ${isActive ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center gap-3">
          {isActive ? <Check className="h-5 w-5 text-primary" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
          <div>
            <div className="font-semibold">
              {isActive
                ? (expires ? `${tr("Подписка активна до")} ${expires.toLocaleDateString()}` : tr("Подписка активна (бессрочно)"))
                : tr("Подписка неактивна")}
            </div>
            <div className="text-xs text-muted-foreground">
              {isActive ? tr("Доступ ко всем функциям системы открыт.") : tr("Оплатите тариф, чтобы получить доступ к системе.")}
            </div>
          </div>
        </div>
      </div>

      {/* Tariffs */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">{tr("1. Выберите тариф")}</h2>
        {tariffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("Тарифы пока не настроены администратором.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tariffs.map((t: any) => {
              const selected = t.id === tariffId;
              return (
                <button key={t.id} type="button" onClick={() => setTariffId(t.id)}
                  className={`text-left rounded-xl border p-5 transition ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base font-semibold">{t.name}</div>
                    {t.billing_period === "unlimited"
                      ? <Badge><InfIcon className="h-3 w-3 mr-1" />{tr("Бессрочно")}</Badge>
                      : <Badge variant="secondary">{tr(billingPeriodLabel(t.billing_period))}</Badge>}
                  </div>
                  <div className="mt-3 text-2xl font-bold">
                    {Number(t.price).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t.currency}{tr(billingPeriodShort(t.billing_period))}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Payment methods */}
      {tariffs.length > 0 && methods.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">{tr("2. Выберите способ оплаты")}</h2>
          <div className="grid gap-3">
            {methods.map((m: any) => {
              const selected = m.id === methodId;
              return (
                <div key={m.id} className={`rounded-xl border p-4 ${selected ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setMethodId(m.id)} className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{PROVIDER_LABELS[m.provider] ?? m.provider}</span>
                        <span className="text-xs text-muted-foreground">· {m.label}</span>
                      </div>
                      <div className="mt-2 font-mono text-base tracking-wider">{m.card_number}</div>
                      {m.holder_name && <div className="text-xs text-muted-foreground mt-1">{tr("Получатель:")} {m.holder_name}</div>}
                      {m.note && <div className="text-xs text-muted-foreground mt-1">{m.note}</div>}
                    </button>
                    <Button size="sm" variant="outline" onClick={() => copy(m.card_number)}>
                      <Copy className="h-4 w-4" /> {tr("Копировать")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Receipt */}
      {tariffs.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold">{tr("3. Загрузите чек")}</h2>
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div>{tr("К оплате:")} <strong>{selectedTariff ? `${Number(selectedTariff.price).toLocaleString()} ${selectedTariff.currency}` : "—"}</strong></div>
            <div className="text-xs text-muted-foreground mt-1">
              {tr("Переведите указанную сумму на карту выбранного банка и приложите фото/PDF чека.")}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Чек об оплате (jpg, png, pdf) *")}</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Комментарий (необязательно)")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting || authLoading || !profileLoaded || !file || !isOwner || !companyId}>
              <Upload className="h-4 w-4" /> {submitting ? tr("Отправка…") : tr("Отправить на проверку")}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>{tr("Назад")}</Button>
          </div>
          {!isOwner && <p className="text-xs text-destructive">{tr("Оплачивать может только владелец компании.")}</p>}
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">{tr("История заявок")}</h2>
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-medium">{h.tariff?.name ?? tr("Тариф")} · {Number(h.amount).toLocaleString()} {h.currency}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                  {h.reject_reason && <div className="text-xs text-destructive mt-1">{tr("Причина:")} {h.reject_reason}</div>}
                </div>
                {h.status === "pending" && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{tr("На проверке")}</Badge>}
                {h.status === "approved" && <Badge><Check className="h-3 w-3 mr-1" />{tr("Принято")}</Badge>}
                {h.status === "rejected" && <Badge variant="destructive"><X className="h-3 w-3 mr-1" />{tr("Отклонено")}</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
