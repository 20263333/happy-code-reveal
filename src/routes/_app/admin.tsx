import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  X,
  Building2,
  Pause,
  Play,
  UserPlus,
  Trash2,
  Plus,
  Eye,
  AlertTriangle,
  CalendarClock,
  Pencil,
  Infinity,
  RotateCcw,
  Archive,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  approveCompanyRequest,
  rejectCompanyRequest,
  suspendCompany,
  createCompanyByAdmin,
  deleteCompany,
  setCompanyLimits,
  assignCompanyTariff,
  makeCompanyUnlimited,
  setCompanyModules,
  updateCompanyInfo,
} from "@/lib/company.functions";
import {
  approveSubscriptionPayment,
  rejectSubscriptionPayment,
  approveChangeRequest,
  rejectChangeRequest,
  getReceiptSignedUrl,
  listSubscriptionPaymentsForAdmin,
} from "@/lib/billing.functions";
import { restoreDeletedRecord } from "@/lib/trash.functions";
import { useAuth } from "@/hooks/use-auth";
import { billingPeriodLabel, APP_MODULES, ALL_MODULE_KEYS } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { AiPurchasesTab } from "@/components/admin-ai-purchases-tab";
import { ScanPurchasesTab } from "@/components/admin-scan-purchases-tab";
import { ShowcaseTab } from "@/components/admin/showcase-tab";
import { AppLogosTab } from "@/components/admin/app-logos-tab";
import { CompanyImportTab } from "@/components/admin/company-import-tab";



export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Binosoz.tj" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { isPlatformAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isPlatformAdmin)
    return (
      <EmptyState icon={Building2} title="Доступ запрещён" description="Только Super Admin." />
    );
  return (
    <div className="space-y-6">
      <PageHeader title="Super Admin" subtitle="Управление компаниями, тарифами и оплатами." />
      <Tabs defaultValue="companies">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="companies">Компании</TabsTrigger>
          <TabsTrigger value="payments">Заявки на оплату</TabsTrigger>
          <TabsTrigger value="site-requests">Заявки с сайта</TabsTrigger>
          <TabsTrigger value="changes">Изменения данных</TabsTrigger>
          <TabsTrigger value="tariffs">Тарифы</TabsTrigger>
          <TabsTrigger value="methods">Реквизиты</TabsTrigger>
          <TabsTrigger value="trash">Корзина</TabsTrigger>
          <TabsTrigger value="demo">Демо</TabsTrigger>
          <TabsTrigger value="notifications">Уведомления</TabsTrigger>
          <TabsTrigger value="ai">AI Кредиты</TabsTrigger>
          <TabsTrigger value="scan">Скан Кредитҳо</TabsTrigger>
          <TabsTrigger value="feedback">Отзывы demo</TabsTrigger>
          <TabsTrigger value="social">Соцсети</TabsTrigger>
          <TabsTrigger value="showcase">Витрина</TabsTrigger>
          <TabsTrigger value="logos">Логотипҳо</TabsTrigger>
          <TabsTrigger value="import">Импорт</TabsTrigger>
          
          
          
        </TabsList>
        <TabsContent value="companies">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentRequestsTab />
        </TabsContent>
        <TabsContent value="site-requests">
          <SitePlanRequestsTab />
        </TabsContent>
        <TabsContent value="changes">
          <ChangeRequestsTab />
        </TabsContent>
        <TabsContent value="tariffs">
          <TariffsTab />
        </TabsContent>
        <TabsContent value="methods">
          <PaymentMethodsTab />
        </TabsContent>
        <TabsContent value="trash">
          <TrashTab />
        </TabsContent>
        <TabsContent value="demo">
          <DemoCompaniesTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="ai">
          <AiPurchasesTab />
        </TabsContent>
        <TabsContent value="scan">
          <ScanPurchasesTab />
        </TabsContent>
        <TabsContent value="feedback">
          <DemoFeedbackTab />
        </TabsContent>
        <TabsContent value="social">
          <SocialLinksTab />
        </TabsContent>
        <TabsContent value="showcase">
          <ShowcaseTab />
        </TabsContent>
        <TabsContent value="logos">
          <AppLogosTab />
        </TabsContent>
        <TabsContent value="import">
          <CompanyImportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const SITE_PLAN_LABELS: Record<string, string> = {
  construction: "Строительство",
  construction_sales: "Строительство + продажи",
  premium_unlimited: "Premium Unlimited",
};

const SITE_REQUEST_STATUS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  completed: "Завершена",
};

function SitePlanRequestsTab() {
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["site-plan-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("site_plan_requests").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("site_plan_requests").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Статус заявки обновлён");
      queryClient.invalidateQueries({ queryKey: ["site-plan-requests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Загрузка…</div>;
  if (!requests.length) return <EmptyState icon={Inbox} title="Заявок пока нет" description="Заявки с сайта появятся здесь." />;

  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      {requests.map((request: any) => (
        <article key={request.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant={request.status === "completed" ? "secondary" : request.status === "in_progress" ? "default" : "outline"}>{SITE_REQUEST_STATUS[request.status] ?? request.status}</Badge>
              <h3 className="mt-3 font-display text-lg font-semibold">{request.full_name}</h3>
              <p className="text-sm text-muted-foreground">{request.company_name} · {request.job_title}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{new Date(request.created_at).toLocaleString("ru-RU")}</div>
              <div className="mt-1 font-semibold text-primary">{SITE_PLAN_LABELS[request.plan_code] ?? request.plan_code}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
            <a className="text-primary hover:underline" href={`mailto:${request.email}`}>{request.email}</a>
            <a className="text-primary hover:underline" href={`tel:${request.phone}`}>{request.phone}</a>
            <span>Тип: {request.business_type}</span>
            <span>Язык: {String(request.locale).toUpperCase()}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(SITE_REQUEST_STATUS).map(([status, label]) => (
              <Button key={status} size="sm" variant={request.status === status ? "default" : "outline"} disabled={updateStatus.isPending || request.status === status} onClick={() => updateStatus.mutate({ id: request.id, status })}>{label}</Button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------------- Companies (existing) ---------------- */
function CompaniesTab() {
  const qc = useQueryClient();
  const approveFn = useServerFn(approveCompanyRequest);
  const rejectFn = useServerFn(rejectCompanyRequest);
  const suspendFn = useServerFn(suspendCompany);
  const deleteFn = useServerFn(deleteCompany);
  const createFn = useServerFn(createCompanyByAdmin);
  const limitsFn = useServerFn(setCompanyLimits);
  const assignFn = useServerFn(assignCompanyTariff);
  const unlimitedFn = useServerFn(makeCompanyUnlimited);
  const modulesFn = useServerFn(setCompanyModules);
  const infoFn = useServerFn(updateCompanyInfo);
  const saveInfo = useMutation({
    mutationFn: ({ id, name, phone }: { id: string; name: string; phone: string | null }) =>
      infoFn({ data: { company_id: id, name, phone } }),
    onSuccess: () => {
      toast.success("Данные компании сохранены");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const saveModules = useMutation({
    mutationFn: ({ id, modules }: { id: string; modules: string[] }) =>
      modulesFn({ data: { company_id: id, modules } }),
    onSuccess: () => {
      toast.success("Доступ сохранён");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const saveLimits = useMutation({
    mutationFn: ({
      id,
      max_staff,
      max_projects,
      max_blocks,
    }: {
      id: string;
      max_staff: number;
      max_projects: number;
      max_blocks: number;
    }) => limitsFn({ data: { company_id: id, max_staff, max_projects, max_blocks } }),
    onSuccess: () => {
      toast.success("Лимиты сохранены");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const assignTariff = useMutation({
    mutationFn: ({ id, tariff_id }: { id: string; tariff_id: string }) =>
      assignFn({ data: { company_id: id, tariff_id } }),
    onSuccess: () => {
      toast.success("Тариф назначен");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const unlimited = useMutation({
    mutationFn: ({ id }: { id: string }) => unlimitedFn({ data: { company_id: id } }),
    onSuccess: () => {
      toast.success("Бессрочный доступ установлен");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const { data: tariffs = [] } = useQuery({
    queryKey: ["active-tariffs-assign"],
    queryFn: async () =>
      (await (supabase as any).from("tariffs").select("*").eq("is_active", true).order("price"))
        .data ?? [],
  });
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullname: "",
    company_name: "",
    phone: "",
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, phone: form.phone || null } }),
    onSuccess: () => {
      toast.success("Компания создана");
      setForm({ email: "", password: "", fullname: "", company_name: "", phone: "" });
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["company-requests"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("company_requests")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
    refetchInterval: 30000,
  });
  const {
    data: companies = [],
    error: companiesError,
    isLoading: companiesLoading,
    refetch: refetchCompanies,
  } = useQuery({
    queryKey: ["companies-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select(
          "id,name,owner_user_id,status,phone,created_at,updated_at,subscription_tariff_id,subscription_started_at,subscription_expires_at,max_staff,max_projects,max_blocks,enabled_modules,is_demo,demo_expires_at,kiosk_enabled",
        )
        .or("is_demo.is.null,is_demo.eq.false")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { request_id: id } }),
    onSuccess: () => {
      toast.success("Принято");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectFn({ data: { request_id: id, reason } }),
    onSuccess: () => {
      toast.success("Отклонено");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const suspend = useMutation({
    mutationFn: ({ id, s }: { id: string; s: boolean }) =>
      suspendFn({ data: { company_id: id, suspend: s } }),
    onSuccess: () => {
      toast.success("OK");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { company_id: id, delete_users: true } }),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = requests.filter((r: any) => r.status === "pending");

  return (
    <div className="space-y-6 pt-4">
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Создать компанию</h2>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Label>Название компании *</Label>
            <Input
              required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div>
            <Label>ФИО владельца *</Label>
            <Input
              required
              value={form.fullname}
              onChange={(e) => setForm({ ...form, fullname: e.target.value })}
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Пароль *</Label>
            <Input
              type="text"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Телефон</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              <UserPlus className="h-4 w-4" />
              {create.isPending ? "Создание…" : "Создать"}
            </Button>
          </div>
        </form>
      </section>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Новые заявки ({pending.length})</h2>
          {pending.map((r: any) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5"
            >
              <div>
                <div className="font-semibold">{r.company_name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.fullname} · {r.email} · {r.phone || "—"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(r.id)}>
                  <Check className="h-4 w-4" />
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = prompt("Причина отказа:") ?? undefined;
                    reject.mutate({ id: r.id, reason });
                  }}
                >
                  <X className="h-4 w-4" />
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {(() => {
        const now = new Date();
        const expiring = companies.filter((c: any) => {
          if (!c.subscription_expires_at) return false;
          const exp = new Date(c.subscription_expires_at);
          const days = Math.ceil((exp.getTime() - now.getTime()) / 86400_000);
          return days <= 7;
        });
        if (expiring.length === 0) return null;
        return (
          <section className="rounded-xl border border-warning/40 bg-warning/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-warning-foreground">
              <AlertTriangle className="h-5 w-5" />
              Истекает срок тарифа ({expiring.length})
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {expiring.map((c: any) => {
                const exp = new Date(c.subscription_expires_at);
                const days = Math.ceil((exp.getTime() - now.getTime()) / 86400_000);
                return (
                  <li key={c.id}>
                    <strong>{c.name}</strong> — {days <= 0 ? "срок истёк" : `осталось ${days} дн.`}{" "}
                    ({exp.toLocaleDateString()})
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">
          Компании {companiesLoading ? "" : `(${companies.length})`}
        </h2>
        {companiesError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <span>Не удалось загрузить компании: {companiesError.message}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetchCompanies()}>
              Повторить
            </Button>
          </div>
        )}
        {companies.map((c: any) => {
          const tariff = tariffs.find((t: any) => t.id === c.subscription_tariff_id);
          const exp = c.subscription_expires_at ? new Date(c.subscription_expires_at) : null;
          const active = !!c.subscription_tariff_id && (!exp || exp > new Date());
          const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400_000) : null;
          return (
            <div key={c.id} className="space-y-4 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone || "—"}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                    <Badge variant="outline">Тариф: {tariff?.name ?? "—"}</Badge>
                    {active ? (
                      daysLeft !== null && daysLeft <= 7 ? (
                        <Badge variant="destructive">
                          Осталось {daysLeft <= 0 ? 0 : daysLeft} дн.
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          {exp ? `Активен · осталось ${daysLeft} дн.` : "Бессрочно"}
                        </Badge>
                      )
                    ) : (
                      <Badge variant="destructive">Подписка неактивна</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Начало:{" "}
                    {c.subscription_started_at
                      ? new Date(c.subscription_started_at).toLocaleDateString()
                      : "—"}{" "}
                    · Окончание: {exp ? exp.toLocaleDateString() : "—"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => suspend.mutate({ id: c.id, s: c.status === "active" })}
                  >
                    {c.status === "active" ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Блок
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Активировать
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(`Удалить компанию "${c.name}" и все её данные?`))
                        del.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </div>

              <TariffManager
                company={c}
                tariffs={tariffs}
                onAssign={(tariff_id) => assignTariff.mutate({ id: c.id, tariff_id })}
                onUnlimited={() => unlimited.mutate({ id: c.id })}
                busy={assignTariff.isPending || unlimited.isPending}
              />

              <CompanyInfoEditor
                company={c}
                onSave={(name, phone) => saveInfo.mutate({ id: c.id, name, phone })}
                saving={saveInfo.isPending}
              />

              <CompanyLimitsEditor
                company={c}
                onSave={(max_staff, max_projects, max_blocks) =>
                  saveLimits.mutate({ id: c.id, max_staff, max_projects, max_blocks })
                }
                saving={saveLimits.isPending}
              />

              <CompanyModulesEditor
                company={c}
                onSave={(modules) => saveModules.mutate({ id: c.id, modules })}
                saving={saveModules.isPending}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}

function CompanyInfoEditor({
  company,
  onSave,
  saving,
}: {
  company: any;
  onSave: (name: string, phone: string | null) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(company.name ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const dirty = name.trim() !== (company.name ?? "") || phone.trim() !== (company.phone ?? "");
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Название и телефон (показываются на печати)
      </div>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название строительной компании"
        />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
        <Button
          size="sm"
          disabled={saving || !dirty || name.trim().length < 2}
          onClick={() => onSave(name.trim(), phone.trim() || null)}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function TariffManager({
  company,
  tariffs,
  onAssign,
  onUnlimited,
  busy,
}: {
  company: any;
  tariffs: any[];
  onAssign: (tariffId: string) => void;
  onUnlimited: () => void;
  busy: boolean;
}) {
  const [sel, setSel] = useState<string>(company.subscription_tariff_id ?? "");
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <div className="min-w-44">
        <Label className="text-xs">Назначить тариф</Label>
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите тариф" />
          </SelectTrigger>
          <SelectContent>
            {tariffs.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} · {Number(t.price).toLocaleString()} {t.currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" disabled={busy || !sel} onClick={() => onAssign(sel)}>
        <CalendarClock className="h-4 w-4" />
        Назначить
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onUnlimited()}>
        <Infinity className="h-4 w-4" />
        Бессрочный
      </Button>
    </div>
  );
}

function CompanyLimitsEditor({
  company,
  onSave,
  saving,
}: {
  company: any;
  onSave: (maxStaff: number, maxProjects: number, maxBlocks: number) => void;
  saving: boolean;
}) {
  const [staffVal, setStaffVal] = useState(String(company.max_staff ?? 1));
  const [projVal, setProjVal] = useState(String(company.max_projects ?? 1));
  const [blockVal, setBlockVal] = useState(String(company.max_blocks ?? 1));
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <div className="w-28">
        <Label className="text-xs">Сотрудников</Label>
        <Input
          type="number"
          min="0"
          value={staffVal}
          onChange={(e) => setStaffVal(e.target.value)}
        />
      </div>
      <div className="w-28">
        <Label className="text-xs">Проектов</Label>
        <Input type="number" min="0" value={projVal} onChange={(e) => setProjVal(e.target.value)} />
      </div>
      <div className="w-28">
        <Label className="text-xs">Блоков</Label>
        <Input
          type="number"
          min="0"
          value={blockVal}
          onChange={(e) => setBlockVal(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        disabled={saving}
        onClick={() => onSave(Number(staffVal) || 0, Number(projVal) || 0, Number(blockVal) || 0)}
      >
        Сохранить лимиты
      </Button>
    </div>
  );
}

function CompanyModulesEditor({
  company,
  onSave,
  saving,
}: {
  company: any;
  onSave: (modules: string[]) => void;
  saving: boolean;
}) {
  const { tr } = useT();
  const initial: string[] = Array.isArray(company.enabled_modules)
    ? company.enabled_modules
    : ALL_MODULE_KEYS;
  const [sel, setSel] = useState<string[]>(initial);
  const [open, setOpen] = useState(false);
  const toggle = (key: string) =>
    setSel((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  // Group modules by their `group` label preserving APP_MODULES order.
  const groups: { label: string; items: (typeof APP_MODULES)[number][] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const m of APP_MODULES) {
    const g = (m as any).group ?? "Меню асосӣ";
    if (!groupIndex.has(g)) {
      groupIndex.set(g, groups.length);
      groups.push({ label: g, items: [] });
    }
    groups[groupIndex.get(g)!].items.push(m);
  }

  const toggleGroup = (items: (typeof APP_MODULES)[number][], on: boolean) => {
    setSel((cur) => {
      const set = new Set(cur);
      for (const it of items) {
        if (on) set.add(it.key);
        else set.delete(it.key);
      }
      return Array.from(set);
    });
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-medium hover:bg-muted"
      >
        <span>
          {tr("Доступ к меню")}{" "}
          <span className="ml-1 text-muted-foreground">
            ({sel.length}/{ALL_MODULE_KEYS.length})
          </span>
        </span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          {groups.map((g) => {
            const allOn = g.items.every((it) => sel.includes(it.key));
            return (
              <div key={g.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground">{tr(g.label)}</div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.items, !allOn)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {allOn ? tr("Ҳамаро хомӯш") : tr("Ҳамаро фаъол")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((m) => {
                    const on = sel.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggle(m.key)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                        } hover:border-primary/60`}
                      >
                        {tr(m.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <Button size="sm" disabled={saving} onClick={() => onSave(sel)}>
            {tr("Сохранить доступ")}
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------------- Subscription payment requests ---------------- */
function PaymentRequestsTab() {
  const qc = useQueryClient();
  const approveFn = useServerFn(approveSubscriptionPayment);
  const rejectFn = useServerFn(rejectSubscriptionPayment);
  const signedFn = useServerFn(getReceiptSignedUrl);
  const listPaymentsFn = useServerFn(listSubscriptionPaymentsForAdmin);

  const { data: items = [], error, isLoading, refetch } = useQuery({
    queryKey: ["all-subscription-payments"],
    queryFn: () => listPaymentsFn(),
    refetchInterval: 30000,
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { payment_id: id } }),
    onSuccess: () => {
      toast.success("Принято");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectFn({ data: { payment_id: id, reason } }),
    onSuccess: () => {
      toast.success("Отклонено");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const view = async (path: string) => {
    try {
      const { url } = await signedFn({ data: { path } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Загрузка…</div>;
  if (error) return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm text-destructive">
      <span>Не удалось загрузить заявки: {error.message}</span>
      <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Повторить</Button>
    </div>
  );
  if (items.length === 0)
    return <p className="pt-6 text-sm text-muted-foreground">Заявок на оплату пока нет.</p>;

  return (
    <div className="space-y-3 pt-4">
      {items.map((p: any) => (
        <div
          key={p.id}
          className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="space-y-1">
            <div className="font-semibold">{p.company?.name ?? "—"}</div>
            <div className="text-sm">
              {p.tariff?.name ?? "—"} ·{" "}
              <strong>
                {Number(p.amount).toLocaleString()} {p.currency}
              </strong>
            </div>
            <div className="text-xs text-muted-foreground">
              {p.method?.label ?? "—"} · {new Date(p.created_at).toLocaleString()}
            </div>
            {p.reject_reason && (
              <div className="text-xs text-destructive">Причина: {p.reject_reason}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => view(p.receipt_url)}>
              <Eye className="h-4 w-4" />
              Чек
            </Button>
            {p.status === "pending" ? (
              <>
                <Button size="sm" onClick={() => approve.mutate(p.id)}>
                  <Check className="h-4 w-4" />
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = prompt("Причина отказа:") ?? undefined;
                    reject.mutate({ id: p.id, reason });
                  }}
                >
                  <X className="h-4 w-4" />
                  Отклонить
                </Button>
              </>
            ) : (
              <Badge variant={p.status === "approved" ? "default" : "destructive"}>
                {p.status === "approved" ? "Принято" : "Отклонено"}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Company change requests ---------------- */
function ChangeRequestsTab() {
  const qc = useQueryClient();
  const approveFn = useServerFn(approveChangeRequest);
  const rejectFn = useServerFn(rejectChangeRequest);

  const { data: items = [] } = useQuery({
    queryKey: ["all-change-requests"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_change_requests")
        .select("*, company:companies(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { request_id: id } }),
    onSuccess: () => {
      toast.success("Применено");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectFn({ data: { request_id: id, reason } }),
    onSuccess: () => {
      toast.success("Отклонено");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (items.length === 0)
    return <p className="pt-6 text-sm text-muted-foreground">Заявок на изменение пока нет.</p>;

  return (
    <div className="space-y-3 pt-4">
      {items.map((r: any) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{r.company?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            {r.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(r.id)}>
                  <Check className="h-4 w-4" />
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = prompt("Причина отказа:") ?? undefined;
                    reject.mutate({ id: r.id, reason });
                  }}
                >
                  <X className="h-4 w-4" />
                  Отклонить
                </Button>
              </div>
            ) : (
              <Badge variant={r.status === "approved" ? "default" : "destructive"}>
                {r.status}
              </Badge>
            )}
          </div>
          <div className="mt-3 text-sm space-y-1">
            {Object.entries(r.requested_changes ?? {}).map(([k, v]) => (
              <div key={k}>
                <span className="text-muted-foreground">{k}:</span> <strong>{String(v)}</strong>
              </div>
            ))}
          </div>
          {r.reject_reason && (
            <div className="mt-2 text-xs text-destructive">Причина: {r.reject_reason}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Tariffs ---------------- */
type TariffForm = {
  id?: string;
  name: string;
  price: string;
  billing_period: string;
  duration_days: string;
  currency: string;
  max_staff: string;
  max_projects: string;
  max_blocks: string;
  support_days: string;
  description: string;
  features: string; // newline-separated
};

const EMPTY_TARIFF: TariffForm = {
  name: "",
  price: "",
  billing_period: "yearly",
  duration_days: "365",
  currency: "TJS",
  max_staff: "1",
  max_projects: "3",
  max_blocks: "1",
  support_days: "7",
  description: "",
  features: "",
};

function TariffsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<TariffForm>(EMPTY_TARIFF);
  const editing = !!form.id;

  const { data: items = [] } = useQuery({
    queryKey: ["all-tariffs"],
    queryFn: async () =>
      (await (supabase as any).from("tariffs").select("*").order("price", { ascending: true }))
        .data ?? [],
  });

  const buildPayload = () => ({
    name: form.name,
    price: Number(form.price),
    currency: form.currency,
    billing_period: form.billing_period,
    duration_days: form.duration_days === "" ? null : Number(form.duration_days),
    max_staff: form.max_staff === "" ? null : Number(form.max_staff),
    max_projects: form.max_projects === "" ? null : Number(form.max_projects),
    max_blocks: form.max_blocks === "" ? null : Number(form.max_blocks),
    support_days: form.support_days === "" ? null : Number(form.support_days),
    description: form.description || null,
    features: form.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (form.id) {
        const { error } = await (supabase as any).from("tariffs").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("tariffs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Сохранено" : "Создан");
      setForm(EMPTY_TARIFF);
      qc.invalidateQueries({ queryKey: ["all-tariffs"] });
      qc.invalidateQueries({ queryKey: ["active-tariffs-assign"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("tariffs").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-tariffs"] });
      qc.invalidateQueries({ queryKey: ["active-tariffs-assign"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("tariffs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Удалён");
      qc.invalidateQueries({ queryKey: ["all-tariffs"] });
      qc.invalidateQueries({ queryKey: ["active-tariffs-assign"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (t: any) =>
    setForm({
      id: t.id,
      name: t.name,
      price: String(t.price),
      currency: t.currency,
      billing_period: "yearly",
      duration_days: "365",
      max_staff: t.max_staff == null ? "" : String(t.max_staff),
      max_projects: t.max_projects == null ? "" : String(t.max_projects),
      max_blocks: t.max_blocks == null ? "" : String(t.max_blocks),
      support_days: t.support_days == null ? "" : String(t.support_days),
      description: t.description ?? "",
      features: (t.features ?? []).join("\n"),
    });

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">{editing ? "Редактировать тариф" : "Новый тариф"}</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label>Название *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Цена (сомонӣ) *</Label>
            <Input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Ставьте вручную"
            />
          </div>
          <div>
            <Label>Период</Label>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
              Годовой (365 дн.)
            </div>
          </div>
          <div>
            <Label>Макс. сотрудников</Label>
            <Input
              type="number"
              min="0"
              value={form.max_staff}
              onChange={(e) => setForm({ ...form, max_staff: e.target.value })}
            />
          </div>
          <div>
            <Label>Макс. проектов</Label>
            <Input
              type="number"
              min="0"
              value={form.max_projects}
              onChange={(e) => setForm({ ...form, max_projects: e.target.value })}
            />
          </div>
          <div>
            <Label>Макс. блоков</Label>
            <Input
              type="number"
              min="0"
              value={form.max_blocks}
              onChange={(e) => setForm({ ...form, max_blocks: e.target.value })}
            />
          </div>
          <div>
            <Label>Дней сопровождения</Label>
            <Input
              type="number"
              min="0"
              value={form.support_days}
              onChange={(e) => setForm({ ...form, support_days: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Описание</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Возможности (по одной в строке)</Label>
            <Textarea
              rows={4}
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              <Plus className="h-4 w-4" />
              {editing ? "Сохранить" : "Добавить"}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={() => setForm(EMPTY_TARIFF)}>
                Отмена
              </Button>
            )}
          </div>
        </form>
      </section>

      <div className="space-y-2">
        {items.map((t: any) => (
          <div
            key={t.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t.name}</span>
                <Badge variant="outline">{billingPeriodLabel(t.billing_period)}</Badge>
                <Badge variant={t.is_active ? "default" : "secondary"}>
                  {t.is_active ? "Активен" : "Скрыт"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {Number(t.price).toLocaleString()} {t.currency} ·{" "}
                {t.duration_days ? `${t.duration_days} дн.` : "бессрочно"} · {t.max_staff ?? "—"}{" "}
                польз. · {t.max_projects ?? "—"} проект. · {t.max_blocks ?? "—"} блок.
              </div>
              {(t.features ?? []).length > 0 && (
                <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                  {(t.features ?? []).map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggle.mutate({ id: t.id, is_active: !t.is_active })}
              >
                {t.is_active ? "Деактивировать" : "Активировать"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Удалить тариф?")) del.mutate(t.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Payment methods ---------------- */
function PaymentMethodsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    provider: "dc",
    label: "Карта Dushanbe City",
    card_number: "",
    holder_name: "",
    note: "",
  });

  const { data: items = [] } = useQuery({
    queryKey: ["all-payment-methods"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("payment_methods")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("payment_methods").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Создано");
      setForm({ ...form, card_number: "", holder_name: "", note: "" });
      qc.invalidateQueries({ queryKey: ["all-payment-methods"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("payment_methods")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-payment-methods"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-payment-methods"] }),
  });

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Новые реквизиты</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Label>Банк *</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dc">Dushanbe City</SelectItem>
                <SelectItem value="alif">Alif Bank</SelectItem>
                <SelectItem value="eskhata">Eskhata Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Название *</Label>
            <Input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Номер карты *</Label>
            <Input
              required
              value={form.card_number}
              onChange={(e) => setForm({ ...form, card_number: e.target.value })}
            />
          </div>
          <div>
            <Label>Получатель</Label>
            <Input
              value={form.holder_name}
              onChange={(e) => setForm({ ...form, holder_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Заметка</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </div>
        </form>
      </section>

      <div className="space-y-2">
        {items.map((m: any) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div>
              <div className="font-semibold">
                {m.label} <span className="text-xs text-muted-foreground">({m.provider})</span>
              </div>
              <div className="text-sm font-mono">{m.card_number}</div>
              {m.holder_name && (
                <div className="text-xs text-muted-foreground">{m.holder_name}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggle.mutate({ id: m.id, is_active: !m.is_active })}
              >
                {m.is_active ? "Скрыть" : "Показать"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Удалить?")) del.mutate(m.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Trash / Корзина ---------------- */

const TABLE_LABELS: Record<string, string> = {
  customers: "Клиент",
  projects: "Проект / Блок",
  floors: "Этаж",
  apartments: "Квартира",
  sales: "Сделка",
  payments: "Платёж",
  expenses: "Расход",
  materials: "Материал",
  warehouse_items: "Складской товар",
  warehouse_receipts: "Приход на склад",
  warehouse_issues: "Расход со склада",
  payables: "Долг поставщику",
  payable_payments: "Оплата поставщику",
  suppliers: "Поставщик",
  estimates: "Смета",
  estimate_items: "Позиция сметы",
  resettlements: "Переселение",
  barter_deals: "Бартер",
  workers: "Рабочий",
  customer_documents: "Документ клиента",
};

function recordSummary(table: string, data: any): string {
  if (!data) return "—";
  return (
    data.fullname ||
    data.name ||
    (data.apartment_number ? `Квартира ${data.apartment_number}` : null) ||
    (data.amount != null ? `${data.amount}` : null) ||
    (data.total_amount != null ? `${data.total_amount}` : null) ||
    (data.full_price != null ? `${data.full_price}` : null) ||
    (data.floor_number != null ? `Этаж ${data.floor_number}` : null) ||
    data.title ||
    data.id ||
    "—"
  );
}

// Original document date (when the record itself happened), not the deletion date.
function recordDate(data: any): string | null {
  if (!data) return null;
  const raw =
    data.date ||
    data.paid_at ||
    data.payment_date ||
    data.operation_date ||
    data.issued_at ||
    data.sale_date ||
    data.period ||
    data.created_at ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const onlyDate = typeof raw === "string" && raw.length <= 10;
  return onlyDate ? d.toLocaleDateString("ru-RU") : d.toLocaleString("ru-RU");
}

function recordDetails(data: any): string | null {
  if (!data) return null;
  const parts = [data.category, data.description, data.note, data.comment, data.worker_name].filter(
    (v: any) => typeof v === "string" && v.trim(),
  );
  return parts.length ? parts.join(" · ").slice(0, 120) : null;
}

function TrashTab() {
  const qc = useQueryClient();
  const restoreFn = useServerFn(restoreDeletedRecord);
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const { data: companies } = useQuery({
    queryKey: ["admin-companies-min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("companies").select("id, name").order("name");
      return data ?? [];
    },
  });

  // Only the current month is kept visible; older entries are purged.
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: records, isLoading } = useQuery({
    queryKey: ["deleted-records", monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deleted_records")
        .select("id, table_name, company_id, data, deleted_at")
        .gte("deleted_at", monthStart)
        .order("deleted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const companyName = (id: string | null) => companies?.find((c: any) => c.id === id)?.name ?? "—";

  const restore = useMutation({
    mutationFn: async (id: string) => {
      await restoreFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Восстановлено");
      // Restored rows must show up immediately in every module that lists them,
      // including pages that are not currently mounted (Расходы, зарплаты, баланс).
      qc.invalidateQueries({ refetchType: "all" });
    },


    onError: (e: any) => toast.error(e.message),
  });

  const purge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("deleted_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Удалено навсегда");
      qc.invalidateQueries({ queryKey: ["deleted-records"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const purgeAll = useMutation({
    mutationFn: async () => {
      let q = (supabase as any).from("deleted_records").delete();
      q = companyFilter === "all" ? q.not("id", "is", null) : q.eq("company_id", companyFilter);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Корзина очищена");
      qc.invalidateQueries({ queryKey: ["deleted-records"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (records ?? []).filter((r: any) =>
    companyFilter === "all" ? true : r.company_id === companyFilter,
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Удалённые данные компаний за текущий месяц. Более ранние записи стёрты безвозвратно.
        </p>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-56 ml-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все компании</SelectItem>
            {(companies ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="destructive"
          disabled={purgeAll.isPending || filtered.length === 0}
          onClick={() => {
            if (
              confirm(
                `Очистить корзину${companyFilter === "all" ? "" : " для выбранной компании"}? Это действие необратимо.`,
              )
            )
              purgeAll.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" /> Очистить всё
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Archive} title="Корзина пуста" description="Удалённых записей нет." />
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{TABLE_LABELS[r.table_name] ?? r.table_name}</Badge>
                  <span className="font-semibold truncate">
                    {recordSummary(r.table_name, r.data)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <div>
                    {recordDate(r.data) ? (
                      <span className="text-foreground font-medium">
                        Санаи ҳуҷҷат: {recordDate(r.data)}
                      </span>
                    ) : (
                      <span>Санаи ҳуҷҷат: —</span>
                    )}
                  </div>
                  <div>
                    {companyName(r.company_id)} · Ҳазф шуд:{" "}
                    {new Date(r.deleted_at).toLocaleString("ru-RU")}
                  </div>
                  {recordDetails(r.data) && <div>{recordDetails(r.data)}</div>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(r.id)}
                >
                  <RotateCcw className="h-4 w-4" /> Восстановить
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Удалить навсегда? Это действие необратимо.")) purge.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Notifications ---------------- */
function NotificationsTab() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { fetchNotifications } = await import("@/lib/notifications");
      return fetchNotifications();
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const { uploadNotificationMedia, createNotification } = await import("@/lib/notifications");
      const media_items = [];
      for (const f of files) {
        const up = await uploadNotificationMedia(f);
        media_items.push(up);
      }
      await createNotification({
        title: title.trim(),
        body: body.trim() || null,
        media_items,
        contact_phone: contactPhone.trim() || null,
      });
      toast.success("Уведомление отправлено");
      setTitle("");
      setBody("");
      setContactPhone("");
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить уведомление?")) return;
    const { deleteNotification } = await import("@/lib/notifications");
    await deleteNotification(id);
    toast.success("Удалено");
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-list"] });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">Новое уведомление</h3>
        <div className="space-y-2">
          <Label>Заголовок</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Текст</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        </div>
        <div className="space-y-2">
          <Label>Телефон для заказа (с кодом, например +992...)</Label>
          <Input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+992000000000"
          />
        </div>
        <div className="space-y-2">
          <Label>Медиа (фото или видео) — можно несколько</Label>
          <Input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">Выбрано файлов: {files.length}</p>
          )}
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "..." : "Отправить всем владельцам"}
        </Button>
      </form>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет уведомлений</p>
        ) : (
          items.map((n: any) => (
            <div
              key={n.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{n.title}</div>
                {n.body && <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                  {n.media_items?.length > 0 && ` • ${n.media_items.length} медиа`}
                </p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => remove(n.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- Demo companies ---------------- */
function DemoCompaniesTab() {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteCompany);

  const { data: demos = [], isLoading } = useQuery({
    queryKey: ["demo-companies"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("id, name, owner_user_id, demo_expires_at, created_at, status")
        .eq("is_demo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const delOne = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { company_id: id, delete_users: true } }),
    onSuccess: () => {
      toast.success("Демо удалено");
      qc.invalidateQueries({ queryKey: ["demo-companies"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const purgeAll = useMutation({
    mutationFn: async () => {
      for (const c of demos) {
        try {
          await deleteFn({ data: { company_id: c.id, delete_users: true } });
        } catch {
          /* continue */
        }
      }
    },
    onSuccess: () => {
      toast.success("Все демо очищены");
      qc.invalidateQueries({ queryKey: ["demo-companies"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: demoSetting } = useQuery({
    queryKey: ["platform_settings", "demo_enabled"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "demo_enabled")
        .maybeSingle();
      return data?.value !== false;
    },
  });

  const toggleDemo = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert({ key: "demo_enabled", value: enabled, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["platform_settings", "demo_enabled"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;

  const demoEnabled = demoSetting !== false;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Кнопка «Демо-режим» на странице входа</div>
          <p className="text-xs text-muted-foreground mt-1">
            {demoEnabled
              ? "Показывается всем посетителям."
              : "Скрыта — новые демо-аккаунты создать нельзя."}
          </p>
        </div>
        <Button
          size="sm"
          variant={demoEnabled ? "destructive" : "default"}
          disabled={toggleDemo.isPending}
          onClick={() => toggleDemo.mutate(!demoEnabled)}
        >
          {demoEnabled ? "Отключить" : "Включить"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Демо-аккаунты автоматически удаляются через 24 часа. Можно очистить вручную.
        </p>
        <Button
          size="sm"
          variant="destructive"
          disabled={purgeAll.isPending || demos.length === 0}
          onClick={() => {
            if (confirm(`Удалить все ${demos.length} демо-компаний?`)) purgeAll.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" /> Очистить всё
        </Button>
      </div>

      {demos.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Демо-аккаунтов нет"
          description="Активных демо-компаний не найдено."
        />
      ) : (
        <div className="space-y-2">
          {demos.map((c: any) => {
            const exp = c.demo_expires_at ? new Date(c.demo_expires_at) : null;
            const expired = exp ? exp.getTime() < Date.now() : false;
            const hoursLeft = exp
              ? Math.max(0, Math.round((exp.getTime() - Date.now()) / 3600_000))
              : null;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Демо</Badge>
                    <span className="font-semibold truncate">{c.name}</span>
                    {expired ? (
                      <Badge variant="destructive">Истекло</Badge>
                    ) : hoursLeft !== null ? (
                      <Badge variant="outline">Осталось {hoursLeft} ч.</Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Создано: {new Date(c.created_at).toLocaleString("ru-RU")}
                    {exp ? ` · Истекает: ${exp.toLocaleString("ru-RU")}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={delOne.isPending}
                  onClick={() => {
                    if (confirm(`Удалить демо "${c.name}"?`)) delOne.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Удалить
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DemoFeedbackTab() {
  const qc = useQueryClient();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-demo-feedback"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("demo_feedback")
        .select("*, company:companies(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      let profilesById: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, fullname, phone")
          .in("id", userIds);
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return rows.map((r) => ({ ...r, profile: profilesById[r.user_id] ?? null }));
    },
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; patch: any }) => {
      const { error } = await (supabase as any)
        .from("demo_feedback")
        .update(payload.patch)
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-demo-feedback"] });
      toast.success("Сохранено");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("demo_feedback").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-demo-feedback"] });
      toast.success("Удалено");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("demo_feedback")
        .delete()
        .not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-demo-feedback"] });
      toast.success("Все отзывы очищены");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Пожелания и идеи от пользователей демо-версии. Отмечайте «Решено», когда фича добавлена.
        </p>
        {items.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("Очистить все отзывы? Это действие необратимо.")) clearAll.mutate();
            }}
            disabled={clearAll.isPending}
          >
            <Trash2 className="h-4 w-4" /> Очистить всё
          </Button>
        )}
      </div>
      {items.length === 0 && (
        <EmptyState
          icon={Building2}
          title="Отзывов нет"
          description="Пользователи demo пока ничего не прислали."
        />
      )}
      {items.map((it: any) => (
        <div key={it.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">
                {new Date(it.created_at).toLocaleString()} · {it.company?.name ?? "—"} ·{" "}
                {it.profile?.fullname ?? "—"}
                {it.profile?.phone && <> · {it.profile.phone}</>}
              </div>
              <div className="mt-1 text-sm whitespace-pre-wrap">{it.message}</div>
              {it.admin_reply && (
                <div className="mt-2 rounded-md bg-muted p-2 text-sm whitespace-pre-wrap">
                  <div className="text-[10px] font-semibold text-primary mb-1">Ваш ответ</div>
                  {it.admin_reply}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {it.is_resolved ? (
                <Badge>
                  <Check className="h-3 w-3 mr-1" />
                  Решено
                </Badge>
              ) : (
                <Badge variant="secondary">В работе</Badge>
              )}
            </div>
          </div>

          {replyFor === it.id ? (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ваш ответ…"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    update.mutate({ id: it.id, patch: { admin_reply: replyText } });
                    setReplyFor(null);
                    setReplyText("");
                  }}
                >
                  Отправить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReplyFor(null);
                    setReplyText("");
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReplyFor(it.id);
                  setReplyText(it.admin_reply ?? "");
                }}
              >
                {it.admin_reply ? "Изменить ответ" : "Ответить"}
              </Button>
              <Button
                size="sm"
                variant={it.is_resolved ? "secondary" : "default"}
                onClick={() =>
                  update.mutate({ id: it.id, patch: { is_resolved: !it.is_resolved } })
                }
              >
                {it.is_resolved ? "Открыть заново" : "Отметить как решено"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Удалить отзыв?")) del.mutate(it.id);
                }}
              >
                <Trash2 className="h-4 w-4" /> Удалить
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Social Links ---------------- */
function SocialLinksTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["platform_settings", "social_links"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "social_links")
        .maybeSingle();
      return (data?.value ?? {}) as {
        whatsapp?: string;
        facebook?: string;
        instagram?: string;
        telegram?: string;
      };
    },
  });
  const [form, setForm] = useState<{
    whatsapp: string;
    facebook: string;
    instagram: string;
    telegram: string;
  } | null>(null);
  const current = form ?? {
    whatsapp: data?.whatsapp ?? "",
    facebook: data?.facebook ?? "",
    instagram: data?.instagram ?? "",
    telegram: data?.telegram ?? "",
  };
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert({ key: "social_links", value: current, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["platform_settings", "social_links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;

  const set = (k: keyof typeof current, v: string) => setForm({ ...current, [k]: v });

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-semibold">Ссылки на социальные сети</div>
          <p className="text-xs text-muted-foreground mt-1">
            Оставьте поле пустым, чтобы скрыть кнопку. Изменения появятся у всех пользователей.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input
              placeholder="https://wa.me/992..."
              value={current.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook</Label>
            <Input
              placeholder="https://facebook.com/..."
              value={current.facebook}
              onChange={(e) => set("facebook", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram</Label>
            <Input
              placeholder="https://instagram.com/..."
              value={current.instagram}
              onChange={(e) => set("instagram", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telegram</Label>
            <Input
              placeholder="https://t.me/..."
              value={current.telegram}
              onChange={(e) => set("telegram", e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form}>
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
          {form && (
            <Button variant="outline" onClick={() => setForm(null)}>
              Отменить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
