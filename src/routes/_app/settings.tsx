import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Settings as SettingsIcon, User, KeyRound, FileEdit, MessageSquare, Send } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { sendSms } from "@/lib/sms.functions";
import { SmsArchive } from "@/components/sms-archive";
import { KioskSettingsTab } from "@/components/settings/kiosk-settings-tab";
import { ApartmentSyncTab } from "@/components/settings/apartment-sync-tab";
import { LocalBackupTab } from "@/components/settings/local-backup-tab";
import { ReceiptSettingsSection } from "@/components/settings/receipt-settings-tab";
import { MfaSection } from "@/components/mfa-section";
import { PinCodeSection } from "@/components/settings/pin-code-section";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Настройки — Binosoz.tj" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tr } = useT();
  const { user, roles, isOwner, companyId } = useAuth();
  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("fullname, phone").eq("id", user.id).single()
      .then(({ data }) => { if (data) { setFullname(data.fullname || ""); setPhone(data.phone || ""); } });
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ fullname, phone }).eq("id", user.id);
    setSavingProfile(false);
    if (error) toast.error(error.message); else toast.success(tr("Профиль сохранён"));
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error(tr("Минимум 6 символов")); return; }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPass(false);
    if (error) toast.error(error.message); else { toast.success(tr("Пароль изменён")); setNewPassword(""); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={tr("Настройки")} subtitle={tr("Управление профилем и безопасностью.")} />

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-4">
          <User className="h-4 w-4" />{tr("Профиль")}
        </h3>
        <form className="space-y-3" onSubmit={saveProfile}>
          <div className="space-y-1.5">
            <Label>{tr("Email")}</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Роль")}</Label>
            <Input value={roles.map((r) => tr(ROLE_LABELS[r])).join(", ") || "—"} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("ФИО")}</Label>
            <Input value={fullname} onChange={(e) => setFullname(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Телефон")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={savingProfile}>{tr("Сохранить профиль")}</Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-4">
          <KeyRound className="h-4 w-4" />{tr("Сменить пароль")}
        </h3>
        <form className="space-y-3" onSubmit={savePassword}>
          <div className="space-y-1.5">
            <Label>{tr("Новый пароль")}</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={tr("Минимум 6 символов")} />
          </div>
          <Button type="submit" disabled={savingPass || !newPassword}>{tr("Обновить пароль")}</Button>
        </form>
      </div>

      <MfaSection />

      <PinCodeSection />





      {isOwner && companyId && <SmsSettingsSection companyId={companyId} />}

      {isOwner && companyId && <CompanyChangeRequestSection companyId={companyId} />}
      {isOwner && companyId && <KioskSettingsTab />}
      {isOwner && companyId && <ApartmentSyncTab />}
      {isOwner && companyId && <ReceiptSettingsSection companyId={companyId} />}
      {isOwner && companyId && <LocalBackupTab />}



      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground flex items-center gap-2">
        <SettingsIcon className="h-4 w-4" />
        {tr("Язык, валюту и тему меняйте через панель сверху.")}
      </div>
    </div>
  );
}

function CompanyChangeRequestSection({ companyId }: { companyId: string }) {
  const { tr } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["my-company-info", companyId],
    queryFn: async () => (await (supabase as any).from("companies").select("name, phone").eq("id", companyId).single()).data,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["my-change-requests", companyId],
    queryFn: async () => (await (supabase as any).from("company_change_requests").select("*").order("created_at", { ascending: false })).data ?? [],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (company) { setName(company.name ?? ""); setPhone(company.phone ?? ""); }
  }, [company]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const changes: Record<string, any> = {};
    if (name && name !== company.name) changes.name = name;
    if (phone !== (company.phone ?? "")) changes.phone = phone;
    if (Object.keys(changes).length === 0) { toast.error(tr("Нет изменений")); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from("company_change_requests").insert({
      company_id: companyId, requested_changes: changes,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success(tr("Заявка отправлена администратору")); qc.invalidateQueries({ queryKey: ["my-change-requests"] }); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-4">
        <FileEdit className="h-4 w-4" />{tr("Заявка на изменение данных компании")}
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        {tr("Изменения применяются после одобрения администратором.")}
      </p>
      <form className="space-y-3" onSubmit={submit}>
        <div className="space-y-1.5"><Label>{tr("Название компании")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>{tr("Телефон")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <Button type="submit" disabled={submitting}>{tr("Отправить заявку")}</Button>
      </form>

      {requests.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase">{tr("История")}</div>
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                  {r.status === "pending" ? tr("На проверке") : r.status === "approved" ? tr("Принято") : tr("Отклонено")}
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground">{JSON.stringify(r.requested_changes)}</div>
              {r.reject_reason && <div className="mt-1 text-destructive">{tr("Причина:")} {r.reject_reason}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SmsSettingsSection({ companyId }: { companyId: string }) {
  const { tr } = useT();
  const qc = useQueryClient();
  const send = useServerFn(sendSms);

  const [login, setLogin] = useState("");
  const [token, setToken] = useState("");
  const [sender, setSender] = useState("");
  const [hashSecret, setHashSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [reminderTpl, setReminderTpl] = useState("");
  const [overdueTpl, setOverdueTpl] = useState("");
  const [paidTpl, setPaidTpl] = useState("");
  const [penaltyPercent, setPenaltyPercent] = useState<string>("0");
  const [penaltyPeriod, setPenaltyPeriod] = useState<"daily" | "monthly">("daily");
  const [saving, setSaving] = useState(false);

  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("Озмоиши OSON SMS аз Binosoz.tj.");
  const [sending, setSending] = useState(false);

  // Танзимот метавонад умумии ширкат ("") ё барои як лоиҳа (project id) бошад
  const [scope, setScope] = useState<string>("");

  const { data: projects } = useQuery({
    queryKey: ["sms-projects", companyId],
    queryFn: async () =>
      (await (supabase as any)
        .from("projects")
        .select("id, name")
        .eq("company_id", companyId)
        .is("parent_id", null)
        .order("name")).data ?? [],
  });

  const { data: cfg } = useQuery({
    queryKey: ["sms-settings", companyId, scope],
    queryFn: async () => {
      let q = (supabase as any)
        .from("company_sms_settings")
        .select("*")
        .eq("company_id", companyId);
      q = scope ? q.eq("project_id", scope) : q.is("project_id", null);
      return (await q.maybeSingle()).data;
    },
  });

  useEffect(() => {
    setLogin(cfg?.login ?? "");
    setToken(cfg?.token ?? "");
    setSender(cfg?.sender ?? "");
    setHashSecret(cfg?.hash_secret ?? "");
    setEnabled(!!cfg?.enabled);
    setTestMode(cfg?.test_mode ?? true);
    setReminderTpl(cfg?.reminder_template ?? "");
    setOverdueTpl(cfg?.overdue_template ?? "");
    setPaidTpl(cfg?.paid_template ?? "");
    setPenaltyPercent(String(cfg?.penalty_percent ?? 0));
    setPenaltyPeriod((cfg?.penalty_period ?? "daily") as "daily" | "monthly");
  }, [cfg, scope]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      company_id: companyId,
      project_id: scope || null,
      provider: "osonsms",
      login: login.trim() || null,
      token: token.trim() || null,
      sender: sender.trim() || null,
      hash_secret: hashSecret.trim() || null,
      enabled,
      test_mode: testMode,
      reminder_template: reminderTpl.trim() || null,
      overdue_template: overdueTpl.trim() || null,
      paid_template: paidTpl.trim() || null,
      penalty_percent: Number(penaltyPercent) || 0,
      penalty_period: penaltyPeriod,
    };
    const error = cfg?.id
      ? (await (supabase as any).from("company_sms_settings").update(payload).eq("id", cfg.id)).error
      : (await (supabase as any).from("company_sms_settings").insert(payload)).error;
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(tr("Танзимоти СМС нигоҳ дошта шуд"));
      qc.invalidateQueries({ queryKey: ["sms-settings", companyId] });
    }
  };


  const sendTest = async () => {
    if (!testPhone.trim()) {
      toast.error(tr("Рақами телефонро ворид кунед"));
      return;
    }
    setSending(true);
    try {
      const res: any = await send({ data: { phone: testPhone.trim(), message: testText, project_id: scope || undefined } });
      if (res?.ok) toast.success(tr("СМС-и озмоишӣ фиристода шуд"));
      else toast.error(res?.error ?? tr("Хатогӣ ҳангоми фиристодан"));
    } catch (err: any) {
      toast.error(err?.message ?? tr("Хатогӣ ҳангоми фиристодан"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-1">
        <MessageSquare className="h-4 w-4" />{tr("Интеграцияи СМС (OSON SMS)")}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {tr("Маълумотро аз кабинети шахсии OSON SMS гиред ва инҷо ворид кунед. СМС ба муштариён худкор фиристода мешавад.")}
      </p>

      <div className="space-y-1.5 mb-4">
        <Label>{tr("Танзимот барои")}</Label>
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="">{tr("Ҳамаи лоиҳаҳо (умумии ширкат)")}</option>
          {(projects ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {tr("Ҳар лоиҳа метавонад логин ва токени OSON SMS-и худро дошта бошад. Агар холӣ монад, танзимоти умумии ширкат кор мекунад.")}
        </p>
      </div>

      <form className="space-y-3" onSubmit={save}>

        <div className="space-y-1.5">
          <Label>{tr("Логин (login)")}</Label>
          <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="login" />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Токен (Bearer token)")}</Label>
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Имя отправителя (sender)")}</Label>
          <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="OSONSMS" />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Хэш-секрет (str_hash, ихтиёрӣ)")}</Label>
          <Input type="password" value={hashSecret} onChange={(e) => setHashSecret(e.target.value)} placeholder={tr("агар лозим бошад")} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <div className="text-sm font-medium">{tr("Фаъол кардан")}</div>
            <div className="text-xs text-muted-foreground">{tr("СМС-и худкорро фаъол мекунад")}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <div className="text-sm font-medium">{tr("Режими озмоишӣ (тест)")}</div>
            <div className="text-xs text-muted-foreground">{tr("Барои санҷиш пеш аз кор")}</div>
          </div>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="text-sm font-medium">{tr("Ҷаримаи таъхир")}</div>
          <p className="text-xs text-muted-foreground">
            {tr("Ҳангоми таъхир аз мӯҳлат ин фоиз ба муштарӣ дар СМС нишон дода мешавад.")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tr("Фоизи ҷарима (%)")}</Label>
              <Input type="number" step="0.01" min="0" value={penaltyPercent} onChange={(e) => setPenaltyPercent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Давра")}</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={penaltyPeriod}
                onChange={(e) => setPenaltyPeriod(e.target.value as "daily" | "monthly")}
              >
                <option value="daily">{tr("Рӯзона")}</option>
                <option value="monthly">{tr("Моҳона")}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="text-sm font-medium">{tr("Матни СМС")}</div>
          <p className="text-xs text-muted-foreground">
            {tr("Метках истифода баред:")} <code className="font-mono">{"{name}"}</code> — {tr("ном")},{" "}
            <code className="font-mono">{"{amount}"}</code> — {tr("маблағ")},{" "}
            <code className="font-mono">{"{balance}"}</code> — {tr("боқимонда")},{" "}
            <code className="font-mono">{"{date}"}</code> — {tr("сана")},{" "}
            <code className="font-mono">{"{penalty_percent}"}</code> — {tr("фоизи ҷарима")},{" "}
            <code className="font-mono">{"{penalty_period}"}</code> — {tr("давра")}.
          </p>
          <div className="space-y-1.5">
            <Label>{tr("Матни ёдоварӣ (1 рӯз пеш аз мӯҳлат)")}</Label>
            <Textarea rows={3} value={reminderTpl} onChange={(e) => setReminderTpl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Матни қарздорӣ (2 рӯз пас аз мӯҳлат, ҳар рӯз)")}</Label>
            <Textarea rows={3} value={overdueTpl} onChange={(e) => setOverdueTpl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Матни тасдиқи пардохт")}</Label>
            <Textarea rows={3} value={paidTpl} onChange={(e) => setPaidTpl(e.target.value)} />
          </div>
        </div>

        <Button type="submit" disabled={saving}>{tr("Нигоҳ доштан")}</Button>
      </form>

      <div className="mt-6 border-t border-border pt-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">{tr("Санҷиши СМС")}</div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tr("Рақами телефон")}</Label>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+992 90 123 45 67" />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Матни паём")}</Label>
            <Input value={testText} onChange={(e) => setTestText(e.target.value)} />
          </div>
          <Button type="button" variant="outline" disabled={sending} onClick={sendTest}>
            <Send className="h-4 w-4" />{tr("Фиристодани СМС-и озмоишӣ")}
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <SmsArchive companyId={companyId} />
      </div>
    </div>
  );
}
