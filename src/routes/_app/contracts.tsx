import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileSignature, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { ContractCapture } from "@/components/contract-capture";
import { ContractTemplateUploads } from "@/components/contract-template-uploads";
import type { ContractExtractResult } from "@/lib/contract.functions";

export const Route = createFileRoute("/_app/contracts")({
  head: () => ({ meta: [{ title: "Договор — PLATFORM.TJ" }] }),
  component: ContractsPage,
});

type Form = {
  contract_title: string;
  number_prefix: string;
  director_name: string;
  director_position: string;
  inn: string;
  legal_address: string;
  bank_details: string;
  phone: string;
  intro_text: string;
  body_text: string;
  footer_text: string;
};

const EMPTY: Form = {
  contract_title: "ДОГОВОР купли-продажи",
  number_prefix: "",
  director_name: "",
  director_position: "Директор",
  inn: "",
  legal_address: "",
  bank_details: "",
  phone: "",
  intro_text: "",
  body_text: "",
  footer_text: "",
};

function ContractsPage() {
  const { tr } = useT();
  const qc = useQueryClient();
  const { isOwner, isDirector, companyId } = useAuth();
  const [form, setForm] = useState<Form>(EMPTY);
  const canEdit = isOwner && !isDirector;

  const { data: template } = useQuery({
    queryKey: ["contract-template", companyId],
    queryFn: async () =>
      companyId
        ? (await (supabase as any).from("contract_templates").select("*").eq("company_id", companyId).maybeSingle()).data
        : null,
    enabled: !!companyId,
  });

  useEffect(() => {
    if (template) {
      setForm({
        contract_title: template.contract_title ?? EMPTY.contract_title,
        number_prefix: template.number_prefix ?? "",
        director_name: template.director_name ?? "",
        director_position: template.director_position ?? "Директор",
        inn: template.inn ?? "",
        legal_address: template.legal_address ?? "",
        bank_details: template.bank_details ?? "",
        phone: template.phone ?? "",
        intro_text: template.intro_text ?? "",
        body_text: template.body_text ?? "",
        footer_text: template.footer_text ?? "",
      });
    }
  }, [template]);

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("no company");
      const payload = { company_id: companyId, ...form };
      const { error } = await (supabase as any)
        .from("contract_templates")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("Договор сохранён"));
      qc.invalidateQueries({ queryKey: ["contract-template", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!canEdit && !isDirector) {
    return (
      <div className="space-y-6">
        <PageHeader title={tr("Договор")} />
        <EmptyState icon={FileSignature} title={tr("Только владелец компании может настраивать договор.")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Шаблон договора")}
        subtitle={tr("Настройте один раз — он будет использоваться для всех клиентов.")}
      />

      <ContractTemplateUploads companyId={companyId ?? null} canEdit={canEdit} />

      {canEdit && <ContractCapture
        onExtracted={(data: ContractExtractResult) => {
          setForm((f) => ({
            contract_title: data.contract_title ?? f.contract_title,
            number_prefix: data.number_prefix ?? f.number_prefix,
            director_name: data.director_name ?? f.director_name,
            director_position: data.director_position ?? f.director_position,
            inn: data.inn ?? f.inn,
            legal_address: data.legal_address ?? f.legal_address,
            bank_details: data.bank_details ?? f.bank_details,
            phone: data.phone ?? f.phone,
            intro_text: data.intro_text ?? f.intro_text,
            body_text: data.body_text ?? f.body_text,
            footer_text: data.footer_text ?? f.footer_text,
          }));
        }}
      />}

      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-5">
        <h3 className="font-display text-base font-semibold">{tr("Реквизиты и текст договора")}</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Название документа")}>
            <Input value={form.contract_title} onChange={set("contract_title")} disabled={!canEdit} />
          </Field>
          <Field label={tr("Префикс номера договора")}>
            <Input value={form.number_prefix} onChange={set("number_prefix")} placeholder="№ ДКП-" disabled={!canEdit} />
          </Field>
          <Field label={tr("ФИО директора")}>
            <Input value={form.director_name} onChange={set("director_name")} disabled={!canEdit} />
          </Field>
          <Field label={tr("Должность подписанта")}>
            <Input value={form.director_position} onChange={set("director_position")} disabled={!canEdit} />
          </Field>
          <Field label={tr("ИНН")}>
            <Input value={form.inn} onChange={set("inn")} disabled={!canEdit} />
          </Field>
          <Field label={tr("Телефон")}>
            <Input value={form.phone} onChange={set("phone")} disabled={!canEdit} />
          </Field>
          <Field label={tr("Юридический адрес")}>
            <Input value={form.legal_address} onChange={set("legal_address")} disabled={!canEdit} />
          </Field>
          <Field label={tr("Банковские реквизиты")}>
            <Input value={form.bank_details} onChange={set("bank_details")} disabled={!canEdit} />
          </Field>
        </div>

        <Field label={tr("Вступительный текст")}>
          <Textarea rows={3} value={form.intro_text} onChange={set("intro_text")} disabled={!canEdit} />
        </Field>
        <Field label={tr("Основной текст / условия")}>
          <Textarea rows={8} value={form.body_text} onChange={set("body_text")} disabled={!canEdit} />
        </Field>
        <Field label={tr("Заключительный текст / подписи")}>
          <Textarea rows={3} value={form.footer_text} onChange={set("footer_text")} disabled={!canEdit} />
        </Field>

        <p className="text-xs text-muted-foreground">
          {tr("Доступные подстановки:")}{" "}
          <code className="rounded bg-muted px-1">{"{client} {passport} {phone} {address} {project} {floor} {apartment} {area} {rooms} {price} {date}"}</code>
        </p>

        {canEdit && <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-1.5 h-4 w-4" />{tr("Сохранить")}
          </Button>
        </div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
