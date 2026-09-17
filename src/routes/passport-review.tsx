import { uuid } from "@/lib/uuid";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Gauge,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { structurePassport } from "@/lib/passport-structure.functions";
import { parseMrz } from "@/lib/mrz";
import { buildPrefill, dataUrlToBlob, setPassportPrefill } from "@/lib/passport-prefill";
import { getOcrSource } from "@/lib/passport-scan-store";
import {
  IMPORTANT_FIELDS,
  confidenceLevel,
  emptyPassportData,
  getOcrPayload,
  getPassportResult,
  normalizePassport,
  setPassportResult,
  validatePassport,
  type PassportConfidence,
  type PassportData,
  type PassportField,
} from "@/lib/passport-structure";


export const Route = createFileRoute("/passport-review")({
  head: () => ({
    meta: [
      { title: "Проверка данных паспорта — Binosoz.tj" },
      { name: "description", content: "Структурированные данные паспорта с оценкой уверенности и ручным редактированием." },
      { property: "og:title", content: "Проверка данных паспорта — Binosoz.tj" },
      { property: "og:description", content: "Структурированные данные паспорта с оценкой уверенности и ручным редактированием." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassportReviewPage,
});

const LABELS: Record<PassportField, string> = {
  last_name: "Фамилия",
  first_name: "Имя",
  middle_name: "Отчество",
  passport_number: "Номер паспорта",
  personal_number: "Персональный номер (ЖИС)",
  birth_date: "Дата рождения",
  issue_date: "Дата выдачи",
  expiry_date: "Действителен до",
  gender: "Пол",
  nationality: "Гражданство",
  place_of_birth: "Место рождения",
  issuing_authority: "Кем выдан",
  document_type: "Тип документа",
  mrz: "MRZ",
};

const PERSONAL: PassportField[] = [
  "last_name",
  "first_name",
  "middle_name",
  "birth_date",
  "gender",
  "nationality",
  "place_of_birth",
];
const DOCUMENT: PassportField[] = [
  "document_type",
  "passport_number",
  "personal_number",
  "issue_date",
  "expiry_date",
  "issuing_authority",
];

function PassportReviewPage() {
  const navigate = useNavigate();
  const run = useServerFn(structurePassport);
  const { companyId } = useAuth();
  const [saving, setSaving] = useState(false);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PassportData>(emptyPassportData());
  const [confidence, setConfidence] = useState<PassportConfidence>({});
  const [overall, setOverall] = useState(0);
  const [edited, setEdited] = useState<Set<PassportField>>(new Set());

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      const payload = getOcrPayload();
      if (!payload?.text?.trim()) {
        setLoading(false);
        setError("Не удалось обработать паспорт.");
        return;
      }
      try {
        const res = await run({
          data: {
            text: payload.text,
            lines: payload.lines ?? [],
            language: payload.language ?? "—",
            mrz: payload.mrz ?? null,
          },
        });
        setData(res.data);
        setConfidence(res.confidence);
        setOverall(res.overall);
        setEdited(new Set());
        setPassportResult(res);
      } catch (e) {
        setError(e instanceof Error && /лимит|кредит/i.test(e.message) ? e.message : "Не удалось обработать паспорт.");
      } finally {
        setLoading(false);
      }
    },
    [run],
  );

  useEffect(() => {
    const cached = getPassportResult();
    const payload = getOcrPayload();
    if (cached && payload) {
      setData(cached.data);
      setConfidence(cached.confidence);
      setOverall(cached.overall);
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = useMemo(() => validatePassport(data), [data]);
  const errorFor = (f: PassportField) => errors.find((e) => e.field === f)?.message ?? null;

  const setField = (f: PassportField, v: string) => {
    setData((prev) => ({ ...prev, [f]: v.trim() === "" ? null : v }));
    setEdited((prev) => new Set(prev).add(f));
    setConfidence((prev) => ({ ...prev, [f]: 100 }));
  };

  const lowImportant = IMPORTANT_FIELDS.filter((f) => (confidence[f] ?? 0) < 80);

  /* ------------------------------- MRZ check ------------------------------- */
  const mrz = useMemo(() => parseMrz(data.mrz), [data.mrz]);

  const applyMrz = () => {
    if (!mrz) return;
    const patch: Partial<PassportData> = {};
    const take = (f: PassportField, v: string | null) => {
      if (v && !data[f]) patch[f] = v;
    };
    take("last_name", mrz.last_name);
    take("first_name", mrz.first_name);
    take("middle_name", mrz.middle_name);
    take("passport_number", mrz.passport_number);
    take("nationality", mrz.nationality);
    take("birth_date", mrz.birth_date);
    take("expiry_date", mrz.expiry_date);
    take("gender", mrz.gender);
    take("personal_number", mrz.personal_number);
    const keys = Object.keys(patch) as PassportField[];
    if (!keys.length) {
      toast.info("Все поля уже заполнены");
      return;
    }
    setData((prev) => ({ ...prev, ...patch }));
    setConfidence((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { next[k] = mrz.valid ? 99 : 85; });
      return next;
    });
    toast.success(`Из MRZ заполнено полей: ${keys.length}`);
  };

  /* ------------------------------ finalization ----------------------------- */
  const finalize = () => {
    const normalized = normalizePassport(data);
    const errs = validatePassport(normalized);
    setData(normalized);
    if (errs.length) {
      toast.error("Проверьте выделенные поля", { description: errs[0].message });
      return null;
    }
    const values = Object.values(confidence);
    const finalOverall = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    const result = { data: normalized, confidence, overall: finalOverall };
    setPassportResult(result);
    setOverall(finalOverall);
    return result;
  };

  const onUseInForm = () => {
    const result = finalize();
    if (!result) return;
    setPassportPrefill(buildPrefill(result.data, getOcrSource().dataUrl));
    toast.success("Данные готовы", { description: "Откройте «Новый клиент» — форма заполнится автоматически." });
    void navigate({ to: "/projects" });
  };

  const onSaveCustomer = async () => {
    const result = finalize();
    if (!result) return;
    if (!companyId) {
      toast.error("Компания не определена — войдите в систему");
      return;
    }
    setSaving(true);
    try {
      const p = buildPrefill(result.data, null);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // upload the scanned page (best effort — never blocks the record)
      let frontPath: string | null = null;
      const image = getOcrSource().dataUrl;
      if (image) {
        const blob = dataUrlToBlob(image);
        const path = `${companyId}/${uuid()}/front-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("customer-passports")
          .upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (!upErr) frontPath = path;
      }

      const row = {
        fullname: p.fullname || "—",
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        middle_name: p.middle_name || null,
        birth_date: p.birth_date || null,
        gender: p.gender || null,
        nationality: p.nationality || null,
        passport: [p.passport_series, p.passport_number].filter(Boolean).join(" ") || null,
        passport_series: p.passport_series || null,
        passport_number: p.passport_number || null,
        personal_id: p.personal_id || null,
        passport_issued_by: p.passport_issued_by || null,
        issuing_authority: p.passport_issued_by || null,
        passport_issued_date: p.passport_issued_date || null,
        passport_expiry_date: p.passport_expiry_date || null,
        ...(frontPath ? { passport_front_path: frontPath } : {}),
      };

      // update an existing card with the same passport number, otherwise insert
      let existingId: string | null = null;
      if (p.passport_number) {
        const { data: found } = await (supabase as any)
          .from("customers")
          .select("id")
          .eq("company_id", companyId)
          .eq("passport_number", p.passport_number)
          .maybeSingle();
        existingId = found?.id ?? null;
      }

      if (existingId) {
        const { error } = await (supabase as any).from("customers").update(row).eq("id", existingId);
        if (error) throw error;
        toast.success("Карточка клиента обновлена");
      } else {
        const { error } = await (supabase as any)
          .from("customers")
          .insert({ ...row, company_id: companyId, status: "booking", created_by: userId });
        if (error) throw error;
        toast.success("Клиент сохранён в базе");
      }
      setPassportPrefill(buildPrefill(result.data, image));
      void navigate({ to: "/customers" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить клиента");
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Анализ данных паспорта</h1>
            <p className="mt-1 text-sm text-muted-foreground">Структурируем результат распознавания…</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="w-full max-w-md rounded-2xl border-destructive/40 bg-card/90 p-7 text-center shadow-lg">
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">{error}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Текст распознавания оказался недостаточно чётким для извлечения данных.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="h-12 rounded-xl" onClick={() => void load()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Повторить
            </Button>
            <Button variant="secondary" className="h-12 rounded-xl" onClick={() => navigate({ to: "/passport-scan" })}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Выбрать другое фото
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Проверка данных паспорта</h1>
          <p className="text-sm text-muted-foreground">
            Проверьте и при необходимости исправьте распознанные данные. Ваши правки заменяют значения ИИ.
          </p>
        </header>

        <Card className="rounded-2xl border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="h-4 w-4" />
              Общая уверенность
            </div>
            <span className="text-2xl font-semibold tabular-nums">{overall}%</span>
          </div>
          <Progress value={overall} className="mt-3 h-2" />
          {lowImportant.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Низкая уверенность: {lowImportant.map((f) => LABELS[f]).join(", ")}. Проверьте эти поля вручную.
              </span>
            </div>
          )}
        </Card>

        <Section icon={<User className="h-4 w-4" />} title="Личные данные">
          {PERSONAL.map((f) => (
            <Field
              key={f}
              field={f}
              value={data[f]}
              confidence={confidence[f]}
              edited={edited.has(f)}
              error={errorFor(f)}
              onChange={setField}
            />
          ))}
        </Section>

        <Section icon={<FileText className="h-4 w-4" />} title="Данные документа">
          {DOCUMENT.map((f) => (
            <Field
              key={f}
              field={f}
              value={data[f]}
              confidence={confidence[f]}
              edited={edited.has(f)}
              error={errorFor(f)}
              onChange={setField}
            />
          ))}
        </Section>

        <Section icon={<BadgeCheck className="h-4 w-4" />} title="MRZ">
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{LABELS.mrz}</Label>
              <ConfidenceBadge value={confidence.mrz} edited={edited.has("mrz")} />
            </div>
            <Textarea
              value={data.mrz ?? ""}
              onChange={(e) => setField("mrz", e.target.value)}
              rows={3}
              placeholder="MRZ не обнаружена"
              className="rounded-xl font-mono text-xs"
            />
          </div>

          {mrz ? (
            <div className="sm:col-span-2 space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {mrz.valid ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                  )}
                  {mrz.valid ? `MRZ подтверждена (${mrz.format})` : `Контрольные суммы MRZ не сходятся (${mrz.format})`}
                </div>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={applyMrz}>
                  Заполнить из MRZ
                </Button>
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {mrz.checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {c.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              MRZ не распознана — контрольные суммы не проверены.
            </p>
          )}
        </Section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" size="lg" className="h-12 rounded-xl" onClick={() => navigate({ to: "/passport-scanner" })}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
          <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={() => void load()}>
            <Loader2 className="mr-2 h-4 w-4" />
            Переанализировать
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="h-12 rounded-xl"
            onClick={onUseInForm}
            disabled={saving}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Заполнить форму продажи
          </Button>
          <Button size="lg" className="h-12 rounded-xl" onClick={() => void onSaveCustomer()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Сохранить клиента
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

      </div>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function ConfidenceBadge({ value, edited }: { value?: number; edited?: boolean }) {
  if (edited) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        <CheckCircle2 className="h-3 w-3" /> Исправлено
      </span>
    );
  }
  if (value === undefined) {
    return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">нет данных</span>;
  }
  const level = confidenceLevel(value);
  const cls =
    level === "high"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : level === "medium"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-destructive/15 text-destructive";
  const mark = level === "high" ? "✔" : level === "medium" ? "⚠" : "❌";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{mark} {value}%</span>;
}

function Field({
  field,
  value,
  confidence,
  edited,
  error,
  onChange,
}: {
  field: PassportField;
  value: string | null;
  confidence?: number;
  edited: boolean;
  error: string | null;
  onChange: (f: PassportField, v: string) => void;
}) {
  const low = !edited && (confidence ?? 0) < 80;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{LABELS[field]}</Label>
        <ConfidenceBadge value={confidence} edited={edited} />
      </div>
      <Input
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(field, e.target.value)}
        className={`h-11 rounded-xl ${
          error ? "border-destructive focus-visible:ring-destructive" : low ? "border-amber-500/60 bg-amber-500/5" : ""
        }`}
      />
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
