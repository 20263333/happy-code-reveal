import { uuid } from "@/lib/uuid";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getBlocksConstructionFund } from "@/lib/distribution.functions";

import { clearPassportPrefill, dataUrlToBlob, peekPassportPrefill } from "@/lib/passport-prefill";

import { ArrowLeft, Plus, Home, Wallet, Receipt, Users, ShieldCheck, Trash2, Boxes, ArrowDownToLine, ArrowUpFromLine, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { APARTMENT_STATUS, PROJECT_STATUS, formatDate, EXPENSE_CATEGORIES, MATERIAL_UNITS, materialUnitLabel, companyModuleEnabled } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { computeAllowedPages, PROJECT_TAB_KEYS } from "@/lib/app-pages";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/preferences";
import { useUsdRate, formatWithUsd } from "@/lib/use-usd-rate";
import { grantProjectAccess, revokeProjectAccess } from "@/lib/access.functions";
import { createBlock, listBlocks, deleteBlock, listFloors, createFloor, deleteFloor } from "@/lib/blocks.functions";
import { getProject } from "@/lib/projects.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EstimatePanel } from "@/components/estimate-panel";
import { ResettlementPanel } from "@/components/resettlement-panel";
import { BarterPanel } from "@/components/barter-panel";
import { CarDamagesPanel } from "@/components/car-damages-panel";
import { StagesPanel } from "@/components/stages-panel";
import { BudgetPanel } from "@/components/budget-panel";
import { DistributionPanel } from "@/components/distribution-panel";
import { FundingRequestsPanel } from "@/components/funding-requests-panel";
import { ShowcaseButton } from "@/components/showcase-button";
import { PassportCapture } from "@/components/passport-capture";
import { SuccessSplash } from "@/components/success-splash";
import { ExcelImportApartments } from "@/components/excel-import-apartments";

import { Facade3dUpload } from "@/components/3d/facade-upload";
import { Facade3dTab } from "@/components/3d/facade-3d-tab";
import { getProject3dSignedUrl } from "@/lib/facade-3d.functions";

function Facade3dSection({
  projectId,
  companyId,
  modelPath,
  canEdit,
  apartments,
}: {
  projectId: string;
  companyId: string;
  modelPath: string | null;
  canEdit: boolean;
  apartments: any[];
}) {
  const qc = useQueryClient();
  const signFn = useServerFn(getProject3dSignedUrl);
  const { data } = useQuery({
    queryKey: ["facade-3d-view", projectId, modelPath],
    queryFn: () => signFn({ data: { project_id: projectId } }),
    enabled: !!modelPath,
  });
  if (canEdit) {
    return (
      <Facade3dUpload
        projectId={projectId}
        companyId={companyId}
        currentPath={modelPath}
        onUpdated={() => qc.invalidateQueries({ queryKey: ["project", projectId] })}
      />
    );
  }
  return (
    <div className="h-[520px] overflow-hidden rounded-xl border border-border">
      <Facade3dTab modelUrl={data?.url ?? null} apartments={apartments} />
    </div>
  );
}

export const Route = createFileRoute("/_app/projects/$id")({
  head: () => ({ meta: [{ title: "Проект — Binosoz.tj" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: string } =>
    typeof s.tab === "string" ? { tab: s.tab } : {},
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { tab: tabFromUrl } = Route.useSearch();
  const { isOwner, isAccountant, isDirector, isPlatformAdmin, companyId, department, extraPages, deniedPages } = useAuth();
  const { t, tr } = useT();
  const { formatMoney, currency } = usePrefs();
  const usdRate = useUsdRate();
  const qc = useQueryClient();
  const [aptFilter, setAptFilter] = useState<"all" | "sold" | "installment" | "empty">("all");
  const [aptView, setAptView] = useState<"cards" | "grid">("cards");
  const canModify = !isDirector;

  // Owners and platform admins bypass per-page restrictions; staff use their
  // effective allowed set to gate block sub-tabs (apartments / sales / … ).
  const allowedTabs = (isOwner || isPlatformAdmin)
    ? null
    : computeAllowedPages(department, extraPages, deniedPages);
  const tabOk = (key: string) => allowedTabs === null || allowedTabs.has(key);

  // Доступ к Смете контролирует Super Admin через enabled_modules компании.
  const { data: companyAccess } = useQuery({
    queryKey: ["company-access", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await (supabase as any).from("companies")
        .select("subscription_tariff_id, subscription_expires_at, enabled_modules, is_demo")
        .eq("id", companyId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000,
  });
  const estimateEnabled = companyModuleEnabled(
    (companyAccess?.enabled_modules as string[] | null) ?? null,
    "estimate",
  );

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { project_id: id } }),
  });

  const { data: floors = [] } = useQuery({
    queryKey: ["floors", id],
    queryFn: () => listFloors({ data: { project_id: id } }) as Promise<any[]>,
  });


  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", id],
    queryFn: async () => (await supabase.from("expenses").select("*").eq("project_id", id).order("expense_date", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["project-sales", id],
    queryFn: async () => (await supabase.from("sales").select("*, customer:customers(fullname, phone), apartment:apartments(apartment_number, area, floor_id)").eq("project_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: projectPayments = [] } = useQuery({
    queryKey: ["project-payments", id],
    queryFn: async () => {
      const { data: salesRows } = await supabase.from("sales").select("id").eq("project_id", id);
      const saleIds = (salesRows ?? []).map((s) => s.id);
      if (saleIds.length === 0) return [];
      const { data } = await supabase
        .from("payments")
        .select("*, sale:sales(customer:customers(fullname), apartment:apartments(apartment_number))")
        .in("sale_id", saleIds)
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: projectPayables = [] } = useQuery({
    queryKey: ["project-payables", id],
    queryFn: async () =>
      (await (supabase as any)
        .from("payables")
        .select("total_amount")
        .eq("project_id", id)
        .eq("archived", false)).data ?? [],
  });


  if (!project) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  // Top-level projects (ЖК) are containers of blocks (child projects).
  if (!(project as any).parent_id) {
    return <ProjectBlocksView project={project} projectId={id} isOwner={isOwner && canModify} />;
  }

  const orderedFloors = [...floors].sort((a: any, b: any) => Number(a.floor_number) - Number(b.floor_number));
  const allApts = orderedFloors.flatMap((f: any) => f.apartments ?? []);
  // Имя покупателя под квартирой (по активным продажам).
  const buyerByApt: Record<string, string> = {};
  for (const s of (sales as any[])) {
    if (!s.apartment_id || s.status === "cancelled") continue;
    const nm = s.customer?.fullname;
    if (nm && !buyerByApt[s.apartment_id]) buyerByApt[s.apartment_id] = nm;
  }

  const sold = allApts.filter((a: any) => a.status === "sold").length;
  const freeApts = allApts.filter((a: any) => a.status === "empty").length;
  const installmentApts = allApts.filter((a: any) => a.status === "installment").length;
  
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const totalSales = sales.reduce((s, x) => s + Number(x.full_price), 0);
  const projectPayablesTotal = projectPayables.reduce((s: number, x: any) => s + Number(x.total_amount || 0), 0);
  const netProfit = totalSales - totalExpenses;
  const netProfitFull = totalSales - totalExpenses - projectPayablesTotal;

  return (
    <div className="space-y-6">
      <Link to="/projects/$id" params={{ id: (project as any).parent_id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Бозгашт ба лоиҳа
      </Link>


      <PageHeader
        title={project.name}
        subtitle={project.location ? `📍 ${project.location}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            {(isOwner || isPlatformAdmin) && (
              <ShowcaseButton
                projectId={id}
                projectName={project.name}
                publicShowcase={!!(project as any).public_showcase}
                showPrices={!!(project as any).show_prices}
                onChange={() => qc.invalidateQueries({ queryKey: ["project", id] })}
              />
            )}
            <Badge variant="secondary">{t(PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS] as any)}</Badge>
          </div>
        }
      />


      {project.description && <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("project.stats.total")} value={allApts.length} icon={Home} />
        <StatCard label={t("project.stats.sold")} value={sold} icon={Home} accent="success" />
        <StatCard label="Свободные" value={freeApts} icon={Home} accent="destructive" />
        <StatCard label="Рассрочка" value={installmentApts} icon={Home} accent="accent" />
      </div>

      {(isOwner || isAccountant || isDirector) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("project.stats.revenue")} value={formatMoney(totalSales)} icon={Wallet} accent="success" />
          <StatCard label={t("project.stats.expenses")} value={formatMoney(totalExpenses)} icon={Receipt} accent="warning" />
          <StatCard label="Чистая прибыль" value={formatMoney(netProfit)} icon={Wallet} accent={netProfit >= 0 ? "success" : "destructive"} />
          <StatCard label="Прибыль с учётом кредиторки" value={formatMoney(netProfitFull)} icon={Wallet} accent={netProfitFull >= 0 ? "success" : "destructive"} />
        </div>
      )}


      <Tabs key={tabFromUrl ?? "default"} defaultValue={tabFromUrl ?? ([["apartments", PROJECT_TAB_KEYS.apartments], ["sales", PROJECT_TAB_KEYS.sales], ["payments", PROJECT_TAB_KEYS.payments], ["schedule", PROJECT_TAB_KEYS.schedule], ["budget", PROJECT_TAB_KEYS.budget], ["warehouse", PROJECT_TAB_KEYS.warehouse], ["estimate", PROJECT_TAB_KEYS.estimate], ["resettlement", PROJECT_TAB_KEYS.resettlement], ["barter", PROJECT_TAB_KEYS.barter], ["facade3d", PROJECT_TAB_KEYS.facade3d], ["car-damages", PROJECT_TAB_KEYS.carDamages], ["distribution", PROJECT_TAB_KEYS.distribution], ["access", PROJECT_TAB_KEYS.access], ["requests", PROJECT_TAB_KEYS.requests]] as const).find(([, k]) => tabOk(k))?.[0]}>
        <TabsList className="grid grid-cols-3 gap-1 h-auto sm:flex sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
          {tabOk(PROJECT_TAB_KEYS.apartments) && <TabsTrigger value="apartments">{t("project.tabs.apartments")}</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.sales) && <TabsTrigger value="sales">{t("project.tabs.sales")}</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.payments) && <TabsTrigger value="payments">{t("project.tabs.payments")}</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.schedule) && <TabsTrigger value="schedule">📊 График</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.budget) && <TabsTrigger value="budget">💰 Буджет</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.warehouse) && <TabsTrigger value="warehouse">Склад</TabsTrigger>}
          {estimateEnabled && tabOk(PROJECT_TAB_KEYS.estimate) && <TabsTrigger value="estimate">Смета</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.resettlement) && <TabsTrigger value="resettlement">Переселение</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.barter) && <TabsTrigger value="barter">Бартер</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.facade3d) && <TabsTrigger value="facade3d">🏢 3D фасад</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.distribution) && <TabsTrigger value="distribution">💸 Тақсими даромад</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.carDamages) && <TabsTrigger value="car-damages">🚗 Зарари мошин</TabsTrigger>}
          {isOwner && canModify && tabOk(PROJECT_TAB_KEYS.access) && <TabsTrigger value="access">{t("project.tabs.access")}</TabsTrigger>}
          {tabOk(PROJECT_TAB_KEYS.requests) && <TabsTrigger value="requests">📝 Заявка</TabsTrigger>}
        </TabsList>

        {tabOk(PROJECT_TAB_KEYS.apartments) && <TabsContent value="apartments" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <AptFilterBar value={aptFilter} onChange={setAptFilter} />
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              <button onClick={() => setAptView("cards")} className={cn("px-3 py-1.5 text-xs font-medium transition", aptView === "cards" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>Карточкаҳо</button>
              <button onClick={() => setAptView("grid")} className={cn("px-3 py-1.5 text-xs font-medium transition", aptView === "grid" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>Шахматка</button>
            </div>
            {canModify && tabOk(PROJECT_TAB_KEYS.addFloor) && <AddFloorButton projectId={id} onAdded={() => qc.invalidateQueries({ queryKey: ["floors", id] })} />}
            {isOwner && canModify && <ExcelImportApartments projectId={id} />}
          </div>
          {floors.length === 0 ? (
            <EmptyState icon={Home} title={t("project.noFloors")} description={t("project.noFloorsDesc")} />
          ) : aptView === "grid" ? (
            <ShahmatkaGrid floors={orderedFloors} aptFilter={aptFilter} projectId={id} canEdit={canModify} buyers={buyerByApt} onChange={() => qc.invalidateQueries({ queryKey: ["floors", id] })} />
          ) : (
            <div className="space-y-4">
              {orderedFloors.map((floor: any) => (
                <FloorRow key={floor.id} floor={floor} projectId={id} canEdit={canModify} canAddApt={tabOk(PROJECT_TAB_KEYS.addApartment)} canDelete={isOwner && canModify} aptFilter={aptFilter} buyers={buyerByApt} onChange={() => qc.invalidateQueries({ queryKey: ["floors", id] })} />

              ))}
            </div>
          )}
        </TabsContent>}


        {tabOk(PROJECT_TAB_KEYS.sales) && <TabsContent value="sales" className="space-y-4 pt-4">
          {canModify && <NewClientButton projectId={id} floors={orderedFloors} currency={currency} onAdded={() => {
            qc.invalidateQueries({ queryKey: ["project-sales", id] });
            qc.invalidateQueries({ queryKey: ["floors", id] });
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["upcoming-sales"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
          }} />}
          {sales.length === 0 ? (
            <EmptyState icon={Users} title={t("project.noSales")} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">№</th>
                    <th className="px-4 py-3 text-left">{t("table.client")}</th>
                    <th className="px-4 py-3 text-left">{t("table.apartment")}</th>
                    <th className="px-4 py-3 text-right">Нарх/м²</th>
                    <th className="px-4 py-3 text-right">{t("table.price")}</th>
                    <th className="px-4 py-3 text-right">{t("table.paid")}</th>
                    <th className="px-4 py-3 text-right">{t("table.remaining")}</th>
                    <th className="px-4 py-3 text-left">{t("table.deadline")}</th>
                    {isOwner && canModify && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s: any) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{s.sale_number ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{s.customer?.fullname}<div className="text-xs text-muted-foreground">{s.customer?.phone}</div></td>
                      <td className="px-4 py-3">№ {s.apartment?.apartment_number} · {s.apartment?.area} м²</td>
                      <td className="px-4 py-3 text-right">
                        {s.sale_price_per_m2 != null ? (
                          <>
                            <div className="font-medium">{Number(s.sale_price_per_m2).toLocaleString()}</div>
                            {s.base_price_per_m2 != null && Number(s.base_price_per_m2) !== Number(s.sale_price_per_m2) && (
                              <div className={`text-xs ${Number(s.sale_price_per_m2) < Number(s.base_price_per_m2) ? "text-destructive" : "text-primary"}`}>
                                база {Number(s.base_price_per_m2).toLocaleString()} ({Number(s.sale_price_per_m2) > Number(s.base_price_per_m2) ? "+" : "−"}
                                {Math.abs(Math.round((Number(s.sale_price_per_m2) - Number(s.base_price_per_m2)) * 100) / 100).toLocaleString()})
                              </div>
                            )}
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{formatWithUsd(s.full_price, formatMoney, usdRate)}</td>
                      <td className="px-4 py-3 text-right text-success">{formatWithUsd(s.paid_amount, formatMoney, usdRate)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatWithUsd(s.remaining_amount, formatMoney, usdRate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(s.payment_deadline)}</td>
                      {isOwner && canModify && (
                        <td className="px-4 py-3 text-right">
                          <CancelSaleBtn sale={s} onDone={() => {
                            qc.invalidateQueries({ queryKey: ["project-sales", id] });
                            qc.invalidateQueries({ queryKey: ["floors", id] });
                            qc.invalidateQueries({ queryKey: ["project-payments", id] });
                            qc.invalidateQueries({ queryKey: ["payments"] });
                            qc.invalidateQueries({ queryKey: ["upcoming-sales"] });
                            qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
                            qc.invalidateQueries({ queryKey: ["payment-schedule"] });
                          }} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.payments) && <TabsContent value="payments" className="space-y-4 pt-4">
          {canModify && <NewPaymentButton sales={sales} projectId={id} currency={currency} onAdded={() => {
            qc.invalidateQueries({ queryKey: ["project-payments", id] });
            qc.invalidateQueries({ queryKey: ["project-sales", id] });
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["upcoming-sales"] });
            qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
            qc.invalidateQueries({ queryKey: ["payment-schedule"] });
          }} />}
          {projectPayments.length === 0 ? (
            <EmptyState icon={Wallet} title={t("project.noPayments")} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">№ {tr("чек")}</th>
                    <th className="px-4 py-3 text-left">{t("table.date")}</th>
                    <th className="px-4 py-3 text-left">{t("table.client")}</th>
                    <th className="px-4 py-3 text-left">{t("table.apartment")}</th>
                    <th className="px-4 py-3 text-left">Статус</th>
                    <th className="px-4 py-3 text-left">{t("table.method")}</th>
                    <th className="px-4 py-3 text-left">{t("table.receipt")}</th>
                    <th className="px-4 py-3 text-right">{t("table.amount")}</th>
                    {canModify && (isOwner || isAccountant) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {projectPayments.map((p: any) => (
                    <tr key={p.id} className={cn("border-t border-border", p.status === "pending" && "bg-warning/10")}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{p.check_number ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                      <td className="px-4 py-3 font-medium">{p.sale?.customer?.fullname}</td>
                      <td className="px-4 py-3">№ {p.sale?.apartment?.apartment_number}</td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-4 py-3"><Badge variant="outline">{t(`payment.method.${p.payment_method}` as any)}</Badge></td>
                      <td className="px-4 py-3"><ReceiptLink path={p.receipt_file} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-success">{formatWithUsd(p.amount, formatMoney, usdRate)}</td>
                      {canModify && (isOwner || isAccountant) && (
                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                          {p.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="text-success border-success/40 hover:bg-success/10" onClick={async () => {
                                const { data: { user } } = await supabase.auth.getUser();
                                const { error } = await supabase.from("payments").update({ status: "confirmed", confirmed_by: user?.id, confirmed_at: new Date().toISOString() }).eq("id", p.id);
                                if (error) toast.error(error.message); else { toast.success("Подтверждён"); qc.invalidateQueries({ queryKey: ["project-payments", id] }); qc.invalidateQueries({ queryKey: ["project-sales", id] }); qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["upcoming-sales"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] }); qc.invalidateQueries({ queryKey: ["payment-schedule"] }); }
                              }}>✓</Button>
                              <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={async () => {
                                const { error } = await supabase.from("payments").update({ status: "rejected" }).eq("id", p.id);
                                if (error) toast.error(error.message); else { toast.success("Отклонён"); qc.invalidateQueries({ queryKey: ["project-payments", id] }); qc.invalidateQueries({ queryKey: ["project-sales", id] }); qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["upcoming-sales"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] }); }
                              }}>✕</Button>
                            </>
                          )}
                          {isOwner && canModify && (
                            <DeleteBtn onConfirm={async () => {
                              const { error } = await supabase.from("payments").delete().eq("id", p.id);
                              if (error) throw error;
                            }} onDone={() => {
                              qc.invalidateQueries({ queryKey: ["project-payments", id] });
                              qc.invalidateQueries({ queryKey: ["project-sales", id] });
                              qc.invalidateQueries({ queryKey: ["payments"] });
                              qc.invalidateQueries({ queryKey: ["upcoming-sales"] });
                              qc.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
                              qc.invalidateQueries({ queryKey: ["payment-schedule"] });
                            }} />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}



        {tabOk(PROJECT_TAB_KEYS.schedule) && <TabsContent value="schedule" className="space-y-4 pt-4">
          <StagesPanel projectId={id} companyId={companyId} canEdit={canModify && (isOwner || (project as any)?.company_id === companyId)} canDelete={isOwner && canModify} />
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.budget) && <TabsContent value="budget" className="space-y-4 pt-4">
          <BudgetPanel projectId={id} companyId={companyId} canEdit={canModify && (isOwner || isAccountant)}
            totalSales={totalSales} totalExpenses={totalExpenses} expenses={expenses as any[]} />
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.warehouse) && <TabsContent value="warehouse" className="space-y-4 pt-4">
          <WarehousePanel projectId={id} canEdit={canModify && (isOwner || isAccountant)} canDelete={isOwner && canModify} />
        </TabsContent>}

        {estimateEnabled && tabOk(PROJECT_TAB_KEYS.estimate) && (
          <TabsContent value="estimate" className="space-y-4 pt-4">
            <EstimatePanel project={project as any} canEdit={canModify} actualExpenses={totalExpenses} />
          </TabsContent>
        )}

        {tabOk(PROJECT_TAB_KEYS.resettlement) && <TabsContent value="resettlement" className="space-y-4 pt-4">
          <ResettlementPanel projectId={id} canEdit={canModify} canDelete={isOwner && canModify} />
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.barter) && <TabsContent value="barter" className="space-y-4 pt-4">
          <BarterPanel projectId={id} canEdit={canModify} canDelete={isOwner && canModify} />
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.carDamages) && <TabsContent value="car-damages" className="space-y-4 pt-4">
          <CarDamagesPanel projectId={id} canEdit={canModify} />
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.facade3d) && <TabsContent value="facade3d" className="space-y-4 pt-4">
          <Facade3dSection
            projectId={id}
            companyId={(project as any).company_id}
            modelPath={(project as any).model_3d_path}
            canEdit={isOwner && canModify}
            apartments={allApts.map((a: any) => {
              const f = orderedFloors.find((fl: any) => fl.id === a.floor_id);
              return {
                id: a.id,
                apartment_number: a.apartment_number,
                area: a.area,
                rooms: a.rooms,
                status: a.status,
                price: a.price,
                floor_number: f?.floor_number ?? null,
              };
            })}
          />
        </TabsContent>}

        {tabOk(PROJECT_TAB_KEYS.distribution) && (
          <TabsContent value="distribution" className="space-y-4 pt-4">
            <DistributionPanel projectId={id} canEdit={isOwner && canModify} />
          </TabsContent>
        )}



        {tabOk(PROJECT_TAB_KEYS.requests) && (
          <TabsContent value="requests" className="space-y-4 pt-4">
            <FundingRequestsPanel projectId={id} canCreate={tabOk(PROJECT_TAB_KEYS.requestNew)} />
          </TabsContent>
        )}

        {isOwner && canModify && tabOk(PROJECT_TAB_KEYS.access) && (
          <TabsContent value="access" className="space-y-4 pt-4">
            <AccessPanel projectId={id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AptFilterBar({ value, onChange }: { value: string; onChange: (v: "all" | "sold" | "installment" | "empty") => void }) {
  const opts = [
    { key: "sold", label: "Продана", color: "bg-destructive hover:bg-destructive/80 border-destructive" },
    { key: "installment", label: "Рассрочка", color: "bg-accent hover:bg-accent/80 border-accent" },
    { key: "empty", label: "Свободна", color: "bg-success hover:bg-success/80 border-success" },
  ] as const;
  return (
    <div className="flex items-center gap-2">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(value === o.key ? "all" : o.key)}
          title={o.label}
          className={cn(
            "h-7 w-7 rounded-md border shadow-sm transition",
            o.color,
            value === o.key ? "ring-2 ring-offset-1 ring-foreground scale-110" : "opacity-60"
          )}
        />
      ))}
    </div>
  );
}

function FloorRow({ floor, projectId, canEdit, canAddApt = true, canDelete, aptFilter, buyers, onChange }: any) {
  const [addOpen, setAddOpen] = useState(false);
  const { t } = useT();
  const statusKey = `floor.status.${floor.status || "in_progress"}` as any;
  const statusColor = floor.status === "completed"
    ? "bg-success/15 text-success border-success/30"
    : floor.status === "planning"
      ? "bg-accent/15 text-accent border-accent/30"
      : "bg-warning/20 text-warning-foreground border-warning/40";
  const delFloor = async () => {
    await deleteFloor({ data: { floor_id: floor.id } });
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-base font-semibold">{t("project.floor")} {floor.floor_number}</h3>
          <Badge variant="outline" className={statusColor}>{t(statusKey)}</Badge>
          {floor.description && <span className="text-xs text-muted-foreground">· {floor.description}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && canAddApt && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />{t("project.newApartment")}</Button>
              </DialogTrigger>
              <NewApartmentDialog projectId={projectId} floorId={floor.id} onClose={() => { setAddOpen(false); onChange(); }} />
            </Dialog>
          )}
          {canDelete && (
            <DeleteBtn onConfirm={delFloor} onDone={onChange} />
          )}
        </div>
      </div>
      {(() => {
        const apts = (floor.apartments ?? []).filter((a: any) => aptFilter === "all" || a.status === aptFilter)
          .sort((a: any, b: any) => a.apartment_number.localeCompare(b.apartment_number, "ru", { numeric: true }));
        if (apts.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
        return (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {apts.map((apt: any) => (
              <ApartmentCell key={apt.id} apt={apt} projectId={projectId} canEdit={canEdit} buyerName={buyers?.[apt.id]} onChange={onChange} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function ApartmentCell({ apt, canEdit, buyerName, onChange }: any) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const meta = APARTMENT_STATUS[apt.status as keyof typeof APARTMENT_STATUS];
  const owner = apt.is_historical ? (apt.historical_owner || "Архив") : buyerName;
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn("rounded-lg border p-3 text-left transition hover:scale-[1.02] hover:shadow-md", meta.color)}>
        <p className="text-xs font-medium opacity-80">№ {apt.apartment_number}</p>
        <p className="mt-1 text-sm font-semibold">{apt.area} м²</p>
        <p className="text-[10px] uppercase tracking-wider opacity-70">{t(meta.labelKey as any)}</p>
        {owner ? (
          <p className="mt-1 truncate text-[10px] font-medium opacity-80" title={owner}>
            {apt.is_historical ? "🗄 " : "👤 "}{owner}
          </p>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <ApartmentDetailDialog apt={apt} canEdit={canEdit} onClose={() => { setOpen(false); onChange(); }} />
      </Dialog>
    </>
  );
}

function ShahmatkaGrid({ floors, aptFilter, projectId, canEdit, buyers, onChange }: { floors: any[]; aptFilter: string; projectId: string; canEdit: boolean; buyers?: Record<string, string>; onChange: () => void }) {
  const [selected, setSelected] = useState<any | null>(null);
  const maxCols = Math.max(1, ...floors.map((f: any) => (f.apartments ?? []).length));
  const { t } = useT();
  const sortedFloors = [...floors].sort((a, b) => Number(a.floor_number) - Number(b.floor_number));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-24 border-b border-r border-border bg-secondary/60 px-3 py-3 text-sm font-bold uppercase tracking-wider">Этаж</th>
              {Array.from({ length: maxCols }).map((_, i) => (
                <th key={i} className="w-32 border-b border-border bg-secondary/40 px-2 py-3 text-sm font-medium text-muted-foreground">{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedFloors.map((floor: any) => {
              const apts = [...(floor.apartments ?? [])].sort((a: any, b: any) =>
                String(a.apartment_number).localeCompare(String(b.apartment_number), "ru", { numeric: true })
              );
              return (
                <tr key={floor.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-border bg-secondary/60 px-3 py-3 text-center text-lg font-bold">{floor.floor_number}</td>
                  {Array.from({ length: maxCols }).map((_, i) => {
                    const apt = apts[i];
                    if (!apt) return <td key={i} className="w-32 border-b border-border bg-muted/20" />;
                    const dim = aptFilter !== "all" && apt.status !== aptFilter;
                    const bg =
                      apt.status === "installment" ? "bg-[oklch(0.55_0.18_240)] text-white" :
                      apt.status === "sold" ? "bg-[oklch(0.55_0.20_25)] text-white" :
                      apt.status === "unavailable" ? "bg-[oklch(0.65_0.15_60)] text-white" :
                      "bg-[oklch(0.50_0.15_150)] text-white";
                    return (
                      <td key={i} className="w-32 border-b border-border p-2">
                        <button
                          onClick={() => setSelected(apt)}
                          className={cn(
                            "block w-full rounded-md px-2 py-5 text-center text-base font-bold leading-tight transition hover:scale-105 hover:shadow",
                            bg,
                            dim && "opacity-25"
                          )}
                          title={`№ ${apt.apartment_number} · ${apt.area} м²`}
                        >
                          <div>№{apt.apartment_number}</div>
                          {apt.area ? <div className="mt-1 text-sm font-medium opacity-90">{apt.area}м²</div> : null}
                          {(() => {
                            const owner = apt.is_historical ? (apt.historical_owner || "Архив") : buyers?.[apt.id];
                            return owner ? (
                              <div className="mt-1 truncate text-[10px] font-medium tracking-wide opacity-90" title={owner}>
                                {apt.is_historical ? "🗄 " : "👤 "}{owner}
                              </div>
                            ) : null;
                          })()}

                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        {selected && <ApartmentDetailDialog apt={selected} canEdit={canEdit} onClose={() => { setSelected(null); onChange(); }} />}
      </Dialog>
    </div>
  );
}


function ApartmentDetailDialog({ apt, canEdit, onClose }: any) {
  const { isOwner } = useAuth();
  const { t, tr } = useT();
  const { formatMoney } = usePrefs();
  const [status, setStatus] = useState(apt.status);
  const [pricePerSqm, setPricePerSqm] = useState(
    String(apt.price_per_sqm && Number(apt.price_per_sqm) > 0
      ? apt.price_per_sqm
      : (Number(apt.area) > 0 ? Math.round((Number(apt.price) / Number(apt.area)) * 100) / 100 : 0)),
  );
  const [area, setArea] = useState(String(apt.area));
  const [apartmentNumber, setApartmentNumber] = useState(String(apt.apartment_number ?? ""));
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [tourUrl, setTourUrl] = useState<string>(apt.tour_url ?? "");
  const [tourFile, setTourFile] = useState<File | null>(null);
  const [tourPaths, setTourPaths] = useState<string[]>(apt.tour_media_paths ?? []);
  const totalPrice = Math.round(Number(area || 0) * Number(pricePerSqm || 0) * 100) / 100;

  const { data: planUrl } = useQuery({
    queryKey: ["apt-plan-url", apt.id, apt.plan_image_path],
    queryFn: async () => {
      if (!apt.plan_image_path) return null;
      const { data } = await supabase.storage.from("apartment-plans").createSignedUrl(apt.plan_image_path, 3600);
      return data?.signedUrl ?? null;
    },
    enabled: !!apt.plan_image_path,
  });

  const save = useMutation({
    mutationFn: async () => {
      let newPath = apt.plan_image_path as string | null;
      if (planFile) {
        const ext = planFile.name.split(".").pop() || "jpg";
        const path = `${apt.project_id}/${apt.id}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("apartment-plans").upload(path, planFile, { upsert: true });
        if (up.error) throw up.error;
        newPath = path;
      }
      let newTourPaths = tourPaths;
      if (tourFile) {
        // Kiosk RLS: first path segment must equal company_id
        const { data: proj } = await (supabase as any).from("projects").select("company_id").eq("id", apt.project_id).single();
        const ext = tourFile.name.split(".").pop() || "bin";
        const path = `${proj.company_id}/${apt.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("apartment-tours").upload(path, tourFile, { upsert: false, contentType: tourFile.type });
        if (up.error) throw up.error;
        newTourPaths = [path, ...tourPaths];
      }
      const { error } = await supabase.from("apartments").update({
        status: status as any,
        price_per_sqm: Number(pricePerSqm || 0),
        price: totalPrice,
        area: Number(area),
        apartment_number: apartmentNumber.trim(),
        plan_image_path: newPath,
        tour_url: tourUrl || null,
        tour_media_paths: newTourPaths,
      } as any).eq("id", apt.id);
      if (error) throw error;

      // Базовая цена квартиры НЕ меняет уже оформленные продажи —
      // каждая сделка хранит свою зафиксированную цену.

    },
    onSuccess: () => { toast.success("OK"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{t("apt.number")} {apt.apartment_number}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {apt.is_historical ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <p className="font-semibold">🗄 {tr("Архивная продажа")}</p>
            <p className="text-muted-foreground">
              {tr("Владелец")}: <b className="text-foreground">{apt.historical_owner || "—"}</b>
            </p>
            <p className="text-muted-foreground">
              {tr("Дата договора")}: <b className="text-foreground">{apt.historical_contract_date
                ? new Date(apt.historical_contract_date).toLocaleDateString("ru-RU")
                : "—"}</b>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tr("Продана до внедрения системы — в финансах и отчетах не участвует.")}
            </p>
          </div>
        ) : null}
        {planUrl ? (
          <a href={planUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
            <img src={planUrl} alt="plan" className="h-56 w-full object-contain bg-muted/30" />
          </a>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            {tr("Схема нест")}
          </div>
        )}
        {isOwner && canEdit && (
          <div className="space-y-1.5">
            <Label>{tr("Схемаи квартира")}</Label>
            <Input type="file" accept="image/*" onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)} />
            {planFile && <p className="text-xs text-muted-foreground">{planFile.name}</p>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>{t("apt.number")}</Label><Input value={apartmentNumber} onChange={(e) => setApartmentNumber(e.target.value)} disabled={!isOwner || !canEdit} /></div>
          <div className="space-y-1.5"><Label>{t("apt.area")}</Label><Input type="number" step="0.01" value={area} onChange={(e) => setArea(e.target.value)} disabled={!isOwner || !canEdit} /></div>
          <div className="space-y-1.5"><Label>{t("apt.pricePerSqm")}</Label><Input type="number" step="0.01" value={pricePerSqm} onChange={(e) => setPricePerSqm(e.target.value)} disabled={!isOwner || !canEdit} /></div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("apt.total")}</span>
          <b>{formatMoney(totalPrice)}</b>
        </div>
        <div className="space-y-1.5">
          <Label>{t("apt.status")}</Label>
          <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(APARTMENT_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v.labelKey as any)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isOwner && canEdit && (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3 bg-muted/20">
            <Label className="text-sm font-semibold">🎬 3D-тур (барои Kiosk)</Label>
            <div className="space-y-1.5">
              <Label className="text-xs">URL (Matterport/Kuula/YouTube 360)</Label>
              <Input value={tourUrl} onChange={(e) => setTourUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ё файли 360° (сурат/видео)</Label>
              <Input type="file" accept="image/*,video/*" onChange={(e) => setTourFile(e.target.files?.[0] ?? null)} />
              {tourFile && <p className="text-xs text-muted-foreground">{tourFile.name}</p>}
              {tourPaths.length > 0 && <p className="text-xs text-muted-foreground">Аллакай {tourPaths.length} файл сабт шудааст</p>}
            </div>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {isOwner && canEdit ? (
          <DeleteBtn label onConfirm={async () => {
            const { error } = await supabase.from("apartments").delete().eq("id", apt.id);
            if (error) throw error;
          }} onDone={onClose} />
        ) : <span />}
        {canEdit && <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>}
      </DialogFooter>
    </DialogContent>
  );
}


// Container view for a top-level project (ЖК): shows its blocks (child projects).
function ProjectBlocksView({ project, projectId, isOwner }: { project: any; projectId: string; isOwner: boolean }) {
  const { t, tr } = useT();
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();

  const { data: blocks = [] } = useQuery({
    queryKey: ["project-blocks", projectId],
    queryFn: async () =>
      (await (supabase as any)
        .from("projects")
        .select("*, apartments(id, status)")
        .eq("parent_id", projectId)
        .order("created_at", { ascending: true })).data ?? [],
  });

  const { data: fund } = useQuery({
    queryKey: ["blocks-construction-fund", projectId],
    queryFn: () => getBlocksConstructionFund({ data: { parent_project_id: projectId } }),
  });

  const fundByBlock = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of fund?.blocks ?? []) m.set(b.project_id, b.construction);
    return m;
  }, [fund]);


  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("project.toProjects")}
      </Link>

      <PageHeader
        title={project.name}
        subtitle={project.location ? `📍 ${project.location}` : undefined}
        actions={isOwner && (
          <AddBlockButton parentId={projectId} onAdded={() => qc.invalidateQueries({ queryKey: ["project-blocks", projectId] })} />
        )}
      />

      {project.description && <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>}

      {blocks.length === 0 ? (
        <EmptyState icon={Boxes} title="Блокҳо ҳоло нест" description="Дар дохили ин лоиҳа блокҳо илова кунед (Блоки 1, Блоки 2, ...). Ҳар блок хона, фурӯш, пардохт ва ҳисоботи худро дорад." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b: any) => {
            const total = b.apartments?.length ?? 0;
            const sold = b.apartments?.filter((a: any) => a.status === "sold").length ?? 0;
            return (
              <div key={b.id} className="group relative rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-accent hover:shadow-[var(--shadow-elegant)]">
                {isOwner && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      if (!confirm(`${tr("Удалить проект")} "${b.name}"? ${tr("Все данные будут потеряны.")}`)) return;
                      const { error } = await supabase.from("projects").delete().eq("id", b.id);
                      if (error) toast.error(error.message);
                      else { toast.success(tr("Удалено")); qc.invalidateQueries({ queryKey: ["project-blocks", projectId] }); }
                    }}
                    className="absolute top-2 right-2 h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Link to="/projects/$id" params={{ id: b.id }} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary">{t(PROJECT_STATUS[b.status as keyof typeof PROJECT_STATUS] as any)}</Badge>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{b.name}</h3>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">{tr("Квартир:")} <b className="text-foreground">{total}</b></span>
                    <span className="text-destructive">{tr("Продано:")} <b>{sold}</b></span>
                  </div>
                  {fund?.allowed && fundByBlock.has(b.id) && (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-success/10 px-3 py-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {tr("Ба хазинаи сохтмон")}
                      </span>
                      <b className="text-sm text-success">{formatMoney(fundByBlock.get(b.id) ?? 0)}</b>
                    </div>
                  )}

                </Link>
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}





function AddBlockButton({ parentId, onAdded }: { parentId: string; onAdded: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"planning" | "in_progress" | "completed">("in_progress");
  const createFn = useServerFn(createBlock);
  const add = useMutation({
    mutationFn: async () => {
      await createFn({ data: { parent_id: parentId, name, description: description || null, status } });
    },
    onSuccess: () => { toast.success("Блок илова шуд"); setOpen(false); setName(""); setDescription(""); setStatus("in_progress"); onAdded(); },
    onError: (e: any) => toast.error(e?.message || "Хатогӣ"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Блок илова кардан</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Блоки нав</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5"><Label>Номи блок</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Блоки 1" /></div>
          <div className="space-y-1.5">
            <Label>Ҳолат</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">{t("floor.status.planning")}</SelectItem>
                <SelectItem value="in_progress">{t("floor.status.in_progress")}</SelectItem>
                <SelectItem value="completed">{t("floor.status.completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Тавсиф</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="..." /></div>
          <DialogFooter><Button type="submit" disabled={!name || add.isPending}>Илова кардан</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function AddFloorButton({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [description, setDescription] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("floors").insert({
        project_id: projectId, floor_number: Number(num), status, description: description || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OK"); setOpen(false); setNum(""); setDescription(""); setStatus("in_progress"); onAdded(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />{t("project.addFloor")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("project.addFloor")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5"><Label>{t("project.floor")}</Label><Input type="number" required value={num} onChange={(e) => setNum(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>{t("floor.status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">{t("floor.status.planning")}</SelectItem>
                <SelectItem value="in_progress">{t("floor.status.in_progress")}</SelectItem>
                <SelectItem value="completed">{t("floor.status.completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{t("floor.description")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="..." /></div>
          <DialogFooter><Button type="submit" disabled={!num || add.isPending}>{t("common.add")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewApartmentDialog({ projectId, floorId, onClose }: any) {
  const { t, tr } = useT();
  const { formatMoney } = usePrefs();
  const [number, setNumber] = useState("");
  const [area, setArea] = useState("");
  const [pricePerSqm, setPricePerSqm] = useState("");
  const [rooms, setRooms] = useState("");
  const [planFile, setPlanFile] = useState<File | null>(null);
  const totalPrice = Math.round(Number(area || 0) * Number(pricePerSqm || 0) * 100) / 100;
  const add = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase.from("apartments").insert({
        project_id: projectId, floor_id: floorId,
        apartment_number: number, area: Number(area),
        price_per_sqm: Number(pricePerSqm || 0), price: totalPrice,
        rooms: rooms ? Number(rooms) : null,
      } as any).select("id").single();
      if (error) throw error;
      if (planFile && inserted?.id) {
        const ext = planFile.name.split(".").pop() || "jpg";
        const path = `${projectId}/${inserted.id}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("apartment-plans").upload(path, planFile, { upsert: true });
        if (up.error) throw up.error;
        await supabase.from("apartments").update({ plan_image_path: path } as any).eq("id", inserted.id);
      }
    },
    onSuccess: () => { toast.success("OK"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{t("project.newApartment")}</DialogTitle></DialogHeader>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <div className="space-y-1.5 col-span-2"><Label>{t("apt.number")}</Label><Input required value={number} onChange={(e) => setNumber(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>{t("apt.area")}</Label><Input type="number" step="0.01" required value={area} onChange={(e) => setArea(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>{t("apt.rooms")}</Label><Input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} /></div>
        <div className="space-y-1.5 col-span-2"><Label>{t("apt.pricePerSqm")}</Label><Input type="number" step="0.01" required value={pricePerSqm} onChange={(e) => setPricePerSqm(e.target.value)} /></div>
        <div className="space-y-1.5 col-span-2">
          <Label>{tr("Схемаи квартира")}</Label>
          <Input type="file" accept="image/*" onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)} />
          {planFile && <p className="text-xs text-muted-foreground">{planFile.name}</p>}
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("apt.total")}</span>
          <b>{formatMoney(totalPrice)}</b>
        </div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={add.isPending}>{t("common.create")}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}


function NewClientButton({ projectId, floors, currency, onAdded }: any) {
  const { t } = useT();
  const { isOwner, isAccountant, isManager } = useAuth();
  const staffOnly = !isOwner && !isAccountant && !isManager;
  const [open, setOpen] = useState(false);
  const [splash, setSplash] = useState(false);
  const [fullname, setFullname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [phone, setPhone] = useState("");
  const [passport, setPassport] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [passportSeries, setPassportSeries] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [personalId, setPersonalId] = useState("");
  const [passportIssuedBy, setPassportIssuedBy] = useState("");
  const [passportIssuedDate, setPassportIssuedDate] = useState("");
  const [passportExpiryDate, setPassportExpiryDate] = useState("");
  const [inn, setInn] = useState("");
  const [passportFrontFile, setPassportFrontFile] = useState<File | null>(null);
  const [passportBackFile, setPassportBackFile] = useState<File | null>(null);
  const [floorId, setFloorId] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [deadline, setDeadline] = useState("");
  const [plan, setPlan] = useState<"cash" | "6" | "12" | "18" | "24" | "36" | "custom">("cash");
  const [customMonths, setCustomMonths] = useState("");
  const [saleNumber, setSaleNumber] = useState("");
  const [salePricePerM2, setSalePricePerM2] = useState("");
  const [salesManagerId, setSalesManagerId] = useState("");

  const { data: salesManagers = [] } = useQuery({
    queryKey: ["sales-managers"],
    queryFn: async () =>
      (await (supabase as any)
        .from("sales_team_members")
        .select("id, fullname, percent, kind, is_active")
        .eq("is_active", true)
        .order("fullname")).data ?? [],
  });
  const selectedManager = salesManagers.find((m: any) => m.id === salesManagerId);


  const selectedFloor = floors.find((f: any) => f.id === floorId);
  const availableApts = (selectedFloor?.apartments ?? []).filter((a: any) => a.status === "empty");
  const selectedApt = availableApts.find((a: any) => a.id === apartmentId);

  const aptArea = Number(selectedApt?.area ?? 0);
  const basePerM2 = aptArea > 0 ? Math.round((Number(selectedApt?.price ?? 0) / aptArea) * 100) / 100 : 0;

  useEffect(() => {
    if (selectedApt) setSalePricePerM2(String(basePerM2 || ""));
    else setSalePricePerM2("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartmentId]);

  const perM2 = Number(salePricePerM2 || 0);
  const price = aptArea > 0 && perM2 > 0
    ? Math.round(aptArea * perM2 * 100) / 100
    : Number(selectedApt?.price ?? 0);
  const down = Number(downPayment || 0);
  const months = plan === "cash" ? 0 : plan === "custom" ? Math.max(0, Math.floor(Number(customMonths || 0))) : Number(plan);
  const remaining = Math.max(price - down, 0);
  const monthly = months > 0 && remaining > 0 ? remaining / months : 0;


  // Данные из полноэкранного сканера паспорта (/passport-scan → /passport-review)
  const applyScannerPrefill = (silent = false) => {
    const p = peekPassportPrefill();
    if (!p) {
      if (!silent) toast.info("Натиҷаи скани паспорт ёфт нашуд");
      return;
    }
    if (p.fullname) setFullname(p.fullname);
    if (p.first_name) setFirstName(p.first_name);
    if (p.last_name) setLastName(p.last_name);
    if (p.middle_name) setMiddleName(p.middle_name);
    if (p.birth_date) setBirthDate(p.birth_date);
    if (p.gender) setGender(p.gender);
    if (p.nationality) setNationality(p.nationality);
    if (p.passport_series) setPassportSeries(p.passport_series);
    if (p.passport_number) setPassportNumber(p.passport_number);
    if (p.personal_id) setPersonalId(p.personal_id);
    if (p.passport_issued_by) setPassportIssuedBy(p.passport_issued_by);
    if (p.passport_issued_date) setPassportIssuedDate(p.passport_issued_date);
    if (p.passport_expiry_date) setPassportExpiryDate(p.passport_expiry_date);
    if (p.address) setAddress(p.address);
    if (p.image) {
      try {
        const blob = dataUrlToBlob(p.image);
        setPassportFrontFile(new File([blob], "passport-front.jpg", { type: blob.type || "image/jpeg" }));
      } catch { /* ignore */ }
    }
    clearPassportPrefill();
    toast.success("Маълумоти паспорт аз сканер гузошта шуд");
  };

  useEffect(() => {
    applyScannerPrefill(true);
    const onFocus = () => applyScannerPrefill(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useMutation({

    mutationFn: async () => {
      if (!selectedApt) throw new Error("Выберите квартиру");
      if (plan === "custom" && months < 1) throw new Error("Укажите количество месяцев");

      const { data: { user } } = await supabase.auth.getUser();

      const { data: prof } = await (supabase as any).from("profiles").select("company_id").eq("id", user?.id).maybeSingle();
      const companyId = prof?.company_id;

      // Загрузка фото паспорта (если есть)
      let frontPath: string | null = null;
      let backPath: string | null = null;
      if (companyId && (passportFrontFile || passportBackFile)) {
        const ts = Date.now();
        const tmpId = uuid();
        if (passportFrontFile) {
          const p = `${companyId}/${tmpId}/front-${ts}.jpg`;
          const { error } = await supabase.storage.from("customer-passports").upload(p, passportFrontFile, { contentType: passportFrontFile.type || "image/jpeg", upsert: false });
          if (!error) frontPath = p;
        }
        if (passportBackFile) {
          const p = `${companyId}/${tmpId}/back-${ts}.jpg`;
          const { error } = await supabase.storage.from("customer-passports").upload(p, passportBackFile, { contentType: passportBackFile.type || "image/jpeg", upsert: false });
          if (!error) backPath = p;
        }
      }

      const passportCombined = passport || [passportSeries, passportNumber].filter(Boolean).join(" ") || null;
      const { data: customer, error: cErr } = await supabase.from("customers").insert({
        fullname, phone: phone || null, passport: passportCombined,
        address: address || null, notes: notes || null, created_by: user?.id,
        status: remaining <= 0 ? "active" : "booking",
        company_id: companyId,
        first_name: firstName || null,
        last_name: lastName || null,
        middle_name: middleName || null,
        birth_date: birthDate || null,
        gender: gender || null,
        nationality: nationality || null,
        passport_series: passportSeries || null,
        passport_number: passportNumber || null,
        personal_id: personalId || null,
        passport_issued_by: passportIssuedBy || null,
        issuing_authority: passportIssuedBy || null,
        passport_issued_date: passportIssuedDate || null,
        passport_expiry_date: passportExpiryDate || null,
        inn: inn ? inn.replace(/\D/g, "").slice(0, 9) : null,
        passport_front_path: frontPath,
        passport_back_path: backPath,
      } as any).select().single();
      if (cErr) throw cErr;

      const status = remaining <= 0 ? "sold" : "installment";
      let computedDeadline = deadline || null;
      if (!computedDeadline && months > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        computedDeadline = d.toISOString().slice(0, 10);
      }

      const manualNum = saleNumber.trim() ? parseInt(saleNumber.trim(), 10) : null;
      if (saleNumber.trim() && (!manualNum || manualNum < 1)) {
        throw new Error("Рақами шартнома нодуруст");
      }
      if (manualNum) {
        const { data: proj } = await (supabase as any)
          .from("projects").select("company_id").eq("id", projectId).maybeSingle();
        let dupQ = (supabase as any).from("sales").select("id").eq("sale_number", manualNum);
        dupQ = proj?.company_id ? dupQ.eq("company_id", proj.company_id) : dupQ.eq("project_id", projectId);
        const { data: dup } = await dupQ.maybeSingle();
        if (dup) throw new Error(`Рақами шартнома #${manualNum} аллакай истифода шудааст`);
      }


      const { data: sale, error: sErr } = await supabase.from("sales").insert({
        project_id: projectId,
        apartment_id: selectedApt.id,
        customer_id: customer.id,
        full_price: price,
        area_snapshot: aptArea || null,
        base_price_per_m2: basePerM2 || null,
        sale_price_per_m2: perM2 || basePerM2 || null,
        paid_amount: 0,
        payment_deadline: computedDeadline,
        installment_months: months,
        created_by: user?.id,
        currency,
        ...(manualNum ? { sale_number: manualNum } : {}),
        sales_manager_id: salesManagerId || null,
        commission_percent: selectedManager ? Number(selectedManager.percent || 0) : 0,
        commission_amount: selectedManager
          ? Math.round(price * Number(selectedManager.percent || 0)) / 100
          : 0,
      } as any).select().single();
      if (sErr) throw sErr;


      if (down > 0) {
        const payStatus = staffOnly ? "pending" : "confirmed";
        const { error: pErr } = await supabase.from("payments").insert({
          sale_id: sale.id, amount: down, payment_method: "cash",
          note: "Первый взнос", created_by: user?.id, currency,
          status: payStatus,
          confirmed_by: payStatus === "confirmed" ? user?.id : null,
          confirmed_at: payStatus === "confirmed" ? new Date().toISOString() : null,
        });
        if (pErr) throw pErr;
      }

      // Auto-generate installment schedule (равные платежи по выбранным месяцам)
      if (months > 0 && remaining > 0) {
        const monthlyAmt = Math.floor(remaining / months);
        // Базовая дата 1-го платежа: не раньше, чем через месяц после продажи
        const nextMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; })();
        const chosen = deadline ? new Date(deadline) : nextMonth;
        const baseDate = chosen.getTime() < nextMonth.getTime() ? nextMonth : chosen;
        const rows = [];
        for (let i = 0; i < months; i++) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          rows.push({
            sale_id: sale.id,
            due_date: d.toISOString().slice(0, 10),
            amount: i === months - 1 ? remaining - monthlyAmt * (months - 1) : monthlyAmt,
          });

        }
        await supabase.from("payment_schedule").insert(rows);
      }

      await supabase.from("apartments").update({ status }).eq("id", selectedApt.id);
    },
    onSuccess: () => {
      if (staffOnly && down > 0) toast.success("Создано. Взнос ожидает подтверждения");
      setSplash(true);
      setOpen(false);
      setFullname(""); setPhone(""); setPassport(""); setAddress(""); setNotes("");
      setFirstName(""); setLastName(""); setMiddleName(""); setGender(""); setNationality(""); setPersonalId(""); setInn("");
      setBirthDate(""); setPassportSeries(""); setPassportNumber(""); setPassportIssuedBy(""); setPassportIssuedDate(""); setPassportExpiryDate("");
      setPassportFrontFile(null); setPassportBackFile(null);
      setFloorId(""); setApartmentId(""); setDownPayment(""); setDeadline(""); setPlan("cash"); setCustomMonths(""); setSalesManagerId("");
      onAdded();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
    <SuccessSplash open={splash} onDone={() => setSplash(false)} title="Фурӯш бо муваффақият сабт шуд!" />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("project.newClient")}</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("project.newClient")}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3 max-h-[75vh] overflow-y-auto pr-1" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5 col-span-2">
            <Label>Рақами шартнома (ихтиёрӣ)</Label>
            <SaleNumberSelect projectId={projectId} value={saleNumber} onChange={setSaleNumber} />
            <p className="text-xs text-muted-foreground">Тугмаи «№»-ро пахш кунед, то рақами озодро интихоб кунед. Рақам дар доираи лоиҳа такрор намешавад.</p>
          </div>

          {salesManagers.length > 0 && (
            <div className="space-y-1.5 col-span-2">
              <Label>Менеҷери фурӯш (ихтиёрӣ)</Label>
              <Select value={salesManagerId || "none"} onValueChange={(v) => setSalesManagerId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Интихоб кунед" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Бе менеҷер</SelectItem>
                  {salesManagers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.fullname} — {Number(m.percent || 0)}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedManager && price > 0 && (
                <p className="text-xs text-muted-foreground">
                  Комиссия: {Math.round(price * Number(selectedManager.percent || 0)) / 100} сом. (аз ҳиссаи шарики фурӯш минус мешавад)
                </p>
              )}
            </div>
          )}


          <div className="col-span-2">
            <PassportCapture
              onExtracted={(d, files) => {
                if (d.fullname) setFullname(d.fullname);
                if (d.first_name) setFirstName(d.first_name);
                if (d.last_name) setLastName(d.last_name);
                if (d.middle_name) setMiddleName(d.middle_name);
                if (d.birth_date) setBirthDate(d.birth_date);
                if (d.gender) setGender(d.gender);
                if (d.nationality) setNationality(d.nationality);
                if (d.passport_series) setPassportSeries(d.passport_series);
                if (d.passport_number) setPassportNumber(d.passport_number);
                if (d.personal_id) setPersonalId(d.personal_id);
                if (d.passport_issued_by) setPassportIssuedBy(d.passport_issued_by);
                if (d.issuing_authority) setPassportIssuedBy(d.issuing_authority);
                if (d.passport_issued_date) setPassportIssuedDate(d.passport_issued_date);
                if ((d as any).passport_expiry_date) setPassportExpiryDate((d as any).passport_expiry_date);
                if (d.address) setAddress(d.address);
                if ((d as any).inn) setInn(String((d as any).inn).replace(/\D/g, "").slice(0, 9));
                setPassportFrontFile(files.front);
                setPassportBackFile(files.back);
              }}
            />
          </div>

          <div className="space-y-1.5 col-span-2"><Label>{t("client.fullname")}</Label><Input required value={fullname} onChange={(e) => setFullname(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Ном</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Насаб</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Номи падар</Label><Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Ҷинс</Label><Input value={gender} onChange={(e) => setGender(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("client.phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Миллат</Label><Input value={nationality} onChange={(e) => setNationality(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Санаи таваллуд</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Серияи паспорт</Label><Input value={passportSeries} onChange={(e) => setPassportSeries(e.target.value)} placeholder="A" /></div>
          <div className="space-y-1.5"><Label>Рақами паспорт</Label><Input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} placeholder="1234567" /></div>
          <div className="space-y-1.5 col-span-2"><Label>Personal ID / JIS</Label><Input value={personalId} onChange={(e) => setPersonalId(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>
          <div className="space-y-1.5 col-span-2"><Label>Кӣ додаст</Label><Input value={passportIssuedBy} onChange={(e) => setPassportIssuedBy(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Санаи додан</Label><Input type="date" value={passportIssuedDate} onChange={(e) => setPassportIssuedDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Санаи анҷоми эътибор</Label><Input type="date" value={passportExpiryDate} onChange={(e) => setPassportExpiryDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("client.passport")} (матн)</Label><Input value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="ихтиёрӣ" /></div>
          <div className="space-y-1.5"><Label>ИНН</Label><Input value={inn} onChange={(e) => setInn(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 рақам" inputMode="numeric" maxLength={9} /></div>
          <div className="space-y-1.5 col-span-2"><Label>{t("client.address")}</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>{t("client.floor")}</Label>
            <Select value={floorId} onValueChange={(v) => { setFloorId(v); setApartmentId(""); }}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {floors.map((f: any) => <SelectItem key={f.id} value={f.id}>{t("project.floor")} {f.floor_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("client.apartment")}</Label>
            <Select value={apartmentId} onValueChange={setApartmentId} disabled={!floorId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {availableApts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>№ {a.apartment_number} · {a.area} м²</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Срок рассрочки</Label>
            <Select value={plan} onValueChange={(v: any) => setPlan(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличными (полностью)</SelectItem>
                <SelectItem value="6">Рассрочка 6 месяцев (полгода)</SelectItem>
                <SelectItem value="12">Рассрочка 12 месяцев (1 год)</SelectItem>
                <SelectItem value="18">Рассрочка 18 месяцев (1.5 года)</SelectItem>
                <SelectItem value="24">Рассрочка 24 месяца (2 года)</SelectItem>
                <SelectItem value="36">Рассрочка 36 месяцев (3 года)</SelectItem>
                <SelectItem value="custom">Свой срок (укажите месяцы)…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {plan === "custom" && (
            <div className="space-y-1.5 col-span-2">
              <Label>Количество месяцев</Label>
              <Input type="number" min="1" max="120" placeholder="например 8" value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5"><Label>{t("client.downPayment")} (первый взнос)</Label><Input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("client.deadline")} (1-й платёж)</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>

          {selectedApt && (
            <div className="space-y-1.5 col-span-2">
              <Label>Цена продажи за 1 м² (нархи фурӯш барои 1 м²)</Label>
              <Input type="number" step="0.01" min="0" value={salePricePerM2} onChange={(e) => setSalePricePerM2(e.target.value)} />
              <p className="text-xs text-muted-foreground">Базовая цена: {basePerM2.toLocaleString()} {currency}/м² · Площадь: {aptArea} м²</p>
            </div>
          )}

          {selectedApt && (
            <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Площадь:</span><b>{aptArea} м²</b></div>
              <div className="flex justify-between"><span>Базовая цена:</span><b>{basePerM2.toLocaleString()} {currency}/м²</b></div>
              <div className="flex justify-between"><span>Цена продажи за 1 м²:</span><b>{perM2.toLocaleString()} {currency}/м²</b></div>
              {perM2 > 0 && basePerM2 > 0 && perM2 !== basePerM2 && (
                <div className={`flex justify-between ${perM2 < basePerM2 ? "text-destructive" : "text-primary"}`}>
                  <span>Отклонение от базовой цены:</span>
                  <b>{perM2 > basePerM2 ? "+" : "−"}{Math.abs(Math.round((perM2 - basePerM2) * 100) / 100).toLocaleString()} {currency}/м² ({(perM2 > basePerM2 ? "+" : "−")}{Math.abs(Math.round((perM2 - basePerM2) * aptArea)).toLocaleString()} {currency})</b>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 mt-1"><span>Итоговая стоимость:</span><b>{price.toLocaleString()} {currency}</b></div>
              <div className="flex justify-between"><span>Первый взнос:</span><b>{down.toLocaleString()} {currency}</b></div>
              <div className="flex justify-between text-destructive"><span>Остаток долга:</span><b>{remaining.toLocaleString()} {currency}</b></div>

              {months > 0 && (
                <div className="flex justify-between text-primary border-t border-border pt-1 mt-1">
                  <span>Ежемесячный платёж ({months} мес.):</span>
                  <b>{Math.round(monthly).toLocaleString()} {currency}</b>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5 col-span-2"><Label>{t("client.notes")}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <DialogFooter className="col-span-2"><Button type="submit" disabled={add.isPending || !apartmentId || !fullname || (plan === "custom" && months < 1)}>{t("client.create")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}


function NewPaymentButton({ sales, projectId, currency, onAdded }: any) {
  const { t } = useT();
  const { isOwner, isAccountant, isManager } = useAuth();
  const staffOnly = !isOwner && !isAccountant && !isManager;
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [checkNumber, setCheckNumber] = useState("");
  const [splash, setSplash] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  // Ҳангоми интихоби мизоҷ маблағи моҳонаи ҳамон фурӯшро худкор мегузорад
  useEffect(() => {
    if (!saleId || amountTouched) return;
    let cancelled = false;
    (async () => {
      const sale = sales.find((s: any) => s.id === saleId);
      const remaining = Number(sale?.remaining_amount ?? (Number(sale?.full_price ?? 0) - Number(sale?.paid_amount ?? 0)));
      let next: number | null = null;
      const { data } = await supabase
        .from("payment_schedule")
        .select("amount, paid_amount, due_date, status")
        .eq("sale_id", saleId)
        .neq("status", "paid")
        .order("due_date", { ascending: true })
        .limit(1);
      const row = data?.[0];
      if (row) {
        const left = Number(row.amount) - Number(row.paid_amount ?? 0);
        if (left > 1) next = Math.round(left);
      }
      if (next === null) {
        const months = Number(sale?.installment_months ?? 0);
        if (months > 0 && remaining > 0) next = Math.round(remaining / months);
      }
      if (next !== null && next > 0 && !cancelled) {
        setAmount(String(Math.min(next, Math.round(remaining) || next)));
      }
    })();
    return () => { cancelled = true; };
  }, [saleId, sales, amountTouched]);


  const filteredSales = (() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s: any) =>
      [s.customer?.fullname, s.apartment?.apartment_number]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  })();

  const add = useMutation({
    mutationFn: async () => {
      if (method === "card" && !file) throw new Error(t("payment.receiptRequired"));
      let receipt_file: string | null = null;
      if (file) {
        const path = `${projectId}/${saleId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
        if (upErr) throw upErr;
        receipt_file = path;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const payStatus = staffOnly ? "pending" : "confirmed";
      let manualCheck: number | null = null;
      if (checkNumber) {
        const n = Number(checkNumber);
        if (!Number.isFinite(n) || n < 1) throw new Error("Рақами чек нодуруст");
        manualCheck = n;
      }
      const { error } = await supabase.from("payments").insert({
        sale_id: saleId, amount: Number(amount), payment_method: method,
        receipt_file, note: note || null, payment_date: date, currency,
        created_by: user?.id,
        status: payStatus,
        confirmed_by: payStatus === "confirmed" ? user?.id : null,
        confirmed_at: payStatus === "confirmed" ? new Date().toISOString() : null,
        ...(manualCheck !== null ? { check_number: manualCheck } : {}),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false); setSaleId(""); setAmount(""); setNote(""); setFile(null); setMethod("cash"); setCheckNumber("");
      setAmountTouched(false);
      setSplash(true);
      onAdded();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <>
    <SuccessSplash open={splash} onDone={() => setSplash(false)} title="Пардохт бо муваффақият сабт шуд!" />
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAmountTouched(false); }}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("project.newPayment")}</Button></DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">

        <DialogHeader><DialogTitle>{t("project.newPayment")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5">
            <Label>{t("payment.sale")}</Label>
            {sales.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Ҳоло ягон фурӯш нест. Аввал дар таби «Фурӯш» тавассути «+ Нав» як мизоҷ ва квартира илова кунед.
              </div>
            ) : (
              <Select value={saleId} onValueChange={setSaleId}>
                <SelectTrigger className="w-full min-w-0 [&>span]:block [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left">
                  <SelectValue placeholder="Интихоб кунед…" />
                </SelectTrigger>
                <SelectContent className="max-h-72 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-3rem)]">

                  <div className="px-2 pt-2 pb-1.5 sticky top-0 bg-popover z-10">
                    <Input
                      autoFocus
                      value={saleSearch}
                      onChange={(e) => setSaleSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Поиск ФИО…"
                      className="h-8"
                    />
                  </div>
                  {filteredSales.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Ничего не найдено</div>
                  ) : filteredSales.map((s: any) => {
                    const remaining = Number(s.remaining_amount ?? (Number(s.full_price) - Number(s.paid_amount ?? 0)));
                    return (
                      <SelectItem key={s.id} value={s.id} disabled={remaining <= 0} className="max-w-full">
                        <span className="block truncate">{s.customer?.fullname} · № {s.apartment?.apartment_number} {remaining > 0 ? `· ост. ${remaining}` : "· пардохт шуд"}</span>
                      </SelectItem>

                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("payment.amount")}</Label><Input type="number" required value={amount} onChange={(e) => { setAmountTouched(true); setAmount(e.target.value); }} /></div>
            <div className="space-y-1.5"><Label>{t("payment.date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("payment.method")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("payment.method.cash")}</SelectItem>
                <SelectItem value="card">{t("payment.method.card")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("payment.receipt")} {method === "card" && <span className="text-destructive">*</span>}</Label>
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {method === "card" && <p className="text-xs text-muted-foreground">{t("payment.receiptRequired")}</p>}
          </div>
          <div className="space-y-1.5"><Label>{t("payment.note")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Рақами чек (ихтиёрӣ)</Label>
            <CheckNumberSelect projectId={projectId} value={checkNumber} onChange={setCheckNumber} />
          </div>
          <DialogFooter><Button type="submit" disabled={add.isPending || !saleId}>{t("payment.submit")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ReceiptLink({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  if (!path) return <span className="text-muted-foreground">—</span>;
  const open = async () => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      setUrl(data.signedUrl);
      window.open(data.signedUrl, "_blank");
    }
  };
  return <button onClick={open} className="text-accent underline">📄</button>;
}


function AccessPanel({ projectId }: { projectId: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const grantFn = useServerFn(grantProjectAccess);
  const revokeFn = useServerFn(revokeProjectAccess);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState("");
  const [extraProjectIds, setExtraProjectIds] = useState<string[]>([]);

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["project-staff", projectId],
    queryFn: async () => {
      const { data: ps } = await supabase.from("project_staff").select("*").eq("project_id", projectId);
      if (!ps?.length) return [];
      const userIds = ps.map((p) => p.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
      return ps.map((p) => ({ ...p, profile: profiles?.find((pr) => pr.id === p.user_id) }));
    },
  });

  const grant = useMutation({
    mutationFn: async () =>
      grantFn({ data: { email, password, fullname, project_id: projectId, project_ids: extraProjectIds } }),
    onSuccess: () => {
      toast.success("Дастрасӣ дода шуд / Доступ выдан");
      setEmail(""); setPassword(""); setFullname(""); setExtraProjectIds([]);
      qc.invalidateQueries({ queryKey: ["project-staff", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (user_id: string) => revokeFn({ data: { user_id, project_id: projectId } }),
    onSuccess: () => { toast.success("OK"); qc.invalidateQueries({ queryKey: ["project-staff", projectId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h3 className="font-display text-base font-semibold">{t("access.title")}</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t("access.desc")}</p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); grant.mutate(); }}>
          <div className="space-y-1.5"><Label>{t("access.fullname")}</Label><Input required value={fullname} onChange={(e) => setFullname(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("access.email")}</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("access.password")}</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {(() => {
            const others = allProjects.filter((p: any) => p.id !== projectId);
            if (others.length === 0) return null;
            const toggle = (pid: string) =>
              setExtraProjectIds((prev) => prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]);
            return (
              <div className="space-y-1.5">
                <Label>Дастрасӣ ба лоиҳаҳои дигар / Доступ к проектам</Label>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                  <label className="flex items-center gap-2 rounded px-1 py-1 text-sm opacity-70">
                    <input type="checkbox" checked disabled className="h-4 w-4 accent-accent" />
                    <span>{allProjects.find((p: any) => p.id === projectId)?.name ?? "—"} (ҷорӣ)</span>
                  </label>
                  {others.map((p: any) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={extraProjectIds.includes(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 accent-accent"
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}
          <Button type="submit" disabled={grant.isPending} className="w-full">
            <ShieldCheck className="mr-2 h-4 w-4" />{t("access.create")}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">{t("access.existing")}</h3>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {staff.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{s.profile?.fullname || "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.profile?.phone || s.user_id.slice(0, 8)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.user_id)} disabled={revoke.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  if (status === "confirmed") return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">Подтверждён</Badge>;
  if (status === "pending") return <Badge className="bg-warning/20 text-warning-foreground border-warning/40 hover:bg-warning/30">Ожидает</Badge>;
  if (status === "rejected") return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Отклонён</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function DeleteBtn({ onConfirm, onDone, label }: { onConfirm: () => Promise<void>; onDone?: () => void; label?: boolean }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!confirm("Удалить безвозвратно?")) return;
    setBusy(true);
    try {
      await onConfirm();
      toast.success("Удалено");
      onDone?.();
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={handle} disabled={busy} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
      <Trash2 className="h-4 w-4" />{label && <span className="ml-1">Удалить</span>}
    </Button>
  );
}

function CancelSaleBtn({ sale, onDone }: { sale: any; onDone?: () => void }) {
  const { tr } = useT();
  const { formatMoney } = usePrefs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await supabase.from("payment_schedule").delete().eq("sale_id", sale.id);
      await supabase.from("payments").delete().eq("sale_id", sale.id);
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;
      await supabase.from("apartments").update({ status: "empty" }).eq("id", sale.apartment_id);
      toast.success(tr("Продажа отменена, квартира снова выставлена на продажу"));
      setOpen(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message ?? tr("Ошибка"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <RotateCcw className="h-4 w-4" /><span className="ml-1 hidden sm:inline">{tr("Возврат")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr("Отмена продажи и возврат денег")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>{tr("Клиент")}: <b>{sale.customer?.fullname}</b></p>
          <p>{tr("Квартира")}: <b>№ {sale.apartment?.apartment_number}</b></p>
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
            <p className="text-xs text-muted-foreground">{tr("Сумма к возврату клиенту")}</p>
            <p className="text-lg font-bold text-destructive">{formatMoney(sale.paid_amount)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {tr("После подтверждения квартира снова станет свободной (для продажи), продажа и все её платежи будут удалены, а эта сумма вычтется из отчёта.")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{tr("Отмена")}</Button>
          <Button variant="destructive" onClick={handle} disabled={busy}>
            {busy ? "..." : tr("Подтвердить и вернуть деньги")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WarehousePanel({ projectId, canEdit, canDelete }: { projectId: string; canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", projectId],
    queryFn: async () => (await supabase.from("materials").select("*").eq("project_id", projectId).order("name")).data ?? [],
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", projectId],
    queryFn: async () => (await supabase.from("material_movements").select("*, materials(name, unit)").eq("project_id", projectId).order("movement_date", { ascending: false })).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["materials", projectId] });
    qc.invalidateQueries({ queryKey: ["movements", projectId] });
    qc.invalidateQueries({ queryKey: ["expenses", projectId] });
  };

  const receipts = movements.filter((m: any) => m.type === "in");
  const issues = movements.filter((m: any) => m.type === "out");
  const totalStockValue = materials.reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Позиций материалов" value={materials.length} icon={Boxes} />
        <StatCard label="Стоимость остатков" value={formatMoney(totalStockValue)} icon={Boxes} accent="success" />
        <StatCard label="Приходов" value={receipts.length} icon={ArrowDownToLine} accent="accent" />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Склад</TabsTrigger>
          <TabsTrigger value="in">Приход</TabsTrigger>
          <TabsTrigger value="out">Расход</TabsTrigger>
        </TabsList>

        {/* === Склад (остатки) === */}
        <TabsContent value="stock" className="mt-4">
          {materials.length === 0 ? (
            <EmptyState icon={Boxes} title="Склад пуст" description="Добавьте приход материала, чтобы пополнить склад." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Дата</th>
                    <th className="px-4 py-2.5 text-left">Наименование товара</th>
                    <th className="px-4 py-2.5 text-left">Ед.изм</th>
                    <th className="px-4 py-2.5 text-right">Количество</th>
                    <th className="px-4 py-2.5 text-right">Цена</th>
                    <th className="px-4 py-2.5 text-right">Итого сумма</th>
                    {canDelete && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m: any) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(m.updated_at)}</td>
                      <td className="px-4 py-2.5 font-medium">{m.name}</td>
                      <td className="px-4 py-2.5">{materialUnitLabel(m.unit)}</td>
                      <td className={cn("px-4 py-2.5 text-right", Number(m.quantity) <= 0 && "text-destructive")}>{Number(m.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatMoney(m.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(Number(m.quantity || 0) * Number(m.unit_price || 0))}</td>
                      {canDelete && (
                        <td className="px-4 py-2.5 text-right">
                          <DeleteBtn onConfirm={async () => {
                            const { error } = await supabase.from("materials").delete().eq("id", m.id);
                            if (error) throw error;
                          }} onDone={refresh} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* === Приход === */}
        <TabsContent value="in" className="mt-4 space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <MaterialMovementDialog projectId={projectId} type="in" materials={materials} formatMoney={formatMoney} onDone={refresh} />
            </div>
          )}
          {receipts.length === 0 ? (
            <EmptyState icon={ArrowDownToLine} title="Приходов пока нет" description="Добавьте поступление материала." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Дата</th>
                    <th className="px-4 py-2.5 text-left">Наименование товара</th>
                    <th className="px-4 py-2.5 text-left">Ед.изм</th>
                    <th className="px-4 py-2.5 text-right">Количество</th>
                    <th className="px-4 py-2.5 text-right">Цена</th>
                    <th className="px-4 py-2.5 text-right">Итого сумма</th>
                    {canDelete && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((mv: any) => (
                    <tr key={mv.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(mv.movement_date)}</td>
                      <td className="px-4 py-2.5 font-medium">{mv.materials?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">{materialUnitLabel(mv.materials?.unit)}</td>
                      <td className="px-4 py-2.5 text-right">{Number(mv.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatMoney(mv.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(mv.total)}</td>
                      {canDelete && (
                        <td className="px-4 py-2.5 text-right">
                          <DeleteBtn onConfirm={async () => {
                            const { error } = await supabase.from("material_movements").delete().eq("id", mv.id);
                            if (error) throw error;
                          }} onDone={refresh} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* === Расход === */}
        <TabsContent value="out" className="mt-4 space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <MaterialMovementDialog projectId={projectId} type="out" materials={materials} formatMoney={formatMoney} onDone={refresh} />
            </div>
          )}
          {issues.length === 0 ? (
            <EmptyState icon={ArrowUpFromLine} title="Расходов пока нет" description="Спишите материал со склада проекта." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Дата</th>
                    <th className="px-4 py-2.5 text-left">Наименование товара</th>
                    <th className="px-4 py-2.5 text-left">Ед.изм</th>
                    <th className="px-4 py-2.5 text-right">Количество</th>
                    <th className="px-4 py-2.5 text-right">Цена</th>
                    <th className="px-4 py-2.5 text-right">Итого сумма</th>
                    {canDelete && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {issues.map((mv: any) => (
                    <tr key={mv.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(mv.movement_date)}</td>
                      <td className="px-4 py-2.5 font-medium">{mv.materials?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">{materialUnitLabel(mv.materials?.unit)}</td>
                      <td className="px-4 py-2.5 text-right">{Number(mv.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{mv.unit_price ? formatMoney(mv.unit_price) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(mv.total)}</td>
                      {canDelete && (
                        <td className="px-4 py-2.5 text-right">
                          <DeleteBtn onConfirm={async () => {
                            const { error } = await supabase.from("material_movements").delete().eq("id", mv.id);
                            if (error) throw error;
                          }} onDone={refresh} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MaterialMovementDialog({ projectId, type, materials, formatMoney, onDone }: { projectId: string; type: "in" | "out"; materials: any[]; formatMoney: (v: any) => string; onDone: () => void }) {
  const isIn = type === "in";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("dona");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  const selectedMat = materials.find((m: any) => m.id === materialId);

  const submit = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!(q > 0)) throw new Error("Количество должно быть больше 0");
      const { data: { user } } = await supabase.auth.getUser();
      let matId = materialId;

      if (isIn) {
        if (!matId) {
          if (!name.trim()) throw new Error("Укажите наименование");
          // Найти существующий материал по имени+ед.изм или создать новый
          const existing = materials.find(
            (m: any) => m.name.trim().toLowerCase() === name.trim().toLowerCase() && m.unit === unit
          );
          if (existing) {
            matId = existing.id;
          } else {
            const { data: created, error: cErr } = await supabase.from("materials").insert({
              project_id: projectId, name: name.trim(), unit, quantity: 0,
              unit_price: Number(price || 0), created_by: user?.id,
            }).select("id").single();
            if (cErr) throw cErr;
            matId = created.id;
          }
        }
      } else {
        if (!matId) throw new Error("Выберите материал");
        if (selectedMat && q > Number(selectedMat.quantity)) throw new Error("Недостаточно на складе");
      }

      const p = isIn ? Number(price || selectedMat?.unit_price || 0) : Number(selectedMat?.unit_price || 0);
      const { error } = await supabase.from("material_movements").insert({
        material_id: matId, project_id: projectId, type, quantity: q,
        unit_price: p || 0, note: note || null, created_by: user?.id,
        movement_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isIn ? "Приход добавлен" : "Расход списан");
      setOpen(false); setName(""); setMaterialId(""); setQty(""); setPrice(""); setNote("");
      onDone();
    },
    onError: (e: any) => toast.error(e.message || "Ошибка"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={isIn ? "" : "bg-warning text-warning-foreground hover:bg-warning/90"}>
          {isIn ? <ArrowDownToLine className="mr-2 h-4 w-4" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />}
          {isIn ? "Добавить приход" : "Добавить расход"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isIn ? "Приход материала" : "Расход материала"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
          {isIn ? (
            <>
              <div className="space-y-1.5">
                <Label>Существующий материал (необязательно)</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger><SelectValue placeholder="Новый материал" /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({materialUnitLabel(m.unit)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!materialId && (
                <>
                  <div className="space-y-1.5"><Label>Наименование товара</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                  <div className="space-y-1.5">
                    <Label>Ед.изм</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATERIAL_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-1.5"><Label>Цена за единицу</Label><Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={selectedMat ? String(selectedMat.unit_price) : ""} /></div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Материал</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue placeholder="Выберите материал" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} — {Number(m.quantity)} {materialUnitLabel(m.unit)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Количество{selectedMat ? ` (${materialUnitLabel(selectedMat.unit)})` : ""}</Label><Input type="number" step="any" required value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          {!isIn && selectedMat && (
            <p className="text-xs text-muted-foreground">Будет добавлено в расходы проекта на сумму {formatMoney(Number(qty || 0) * Number(selectedMat.unit_price))}.</p>
          )}
          <div className="space-y-1.5"><Label>Примечание</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={submit.isPending}>Сохранить</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaleNumberSelect({ projectId, value, onChange }: { projectId: string; value: string; onChange: (v: string) => void }) {
  const { data: used = [] } = useQuery({
    queryKey: ["sale-numbers", projectId],
    queryFn: async () => {
      // Contract numbers are per project/block
      const { data } = await (supabase as any)
        .from("sales").select("sale_number").eq("project_id", projectId);
      return (data ?? []).map((r: any) => Number(r.sale_number)).filter((n: number) => Number.isFinite(n));
    },
  });


  const usedSet = new Set<number>(used as number[]);
  const nums = Array.from({ length: 200 }, (_, i) => i + 1);

  return (
    <Select value={value} onValueChange={(v) => onChange(v === "auto" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder="Автоматӣ" /></SelectTrigger>
      <SelectContent className="max-h-[60vh] w-[220px] overflow-y-auto">
        <SelectItem value="auto" className="w-full">Автоматӣ</SelectItem>
        <div className="flex flex-col">
          {nums.map((n) => (
            <SelectItem key={n} value={String(n)} disabled={usedSet.has(n)} className="w-full">
              №{n}{usedSet.has(n) ? " — истифода шудааст" : ""}
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

function CheckNumberSelect({ projectId, value, onChange }: { projectId: string; value: string; onChange: (v: string) => void }) {
  const { data: used = [] } = useQuery({
    queryKey: ["check-numbers-company", projectId],
    queryFn: async () => {
      // Check numbers are shared across the whole company (all blocks/projects)
      const { data: proj } = await (supabase as any)
        .from("projects").select("company_id").eq("id", projectId).maybeSingle();
      let sq = (supabase as any).from("sales").select("id");
      sq = proj?.company_id ? sq.eq("company_id", proj.company_id) : sq.eq("project_id", projectId);
      const { data: saleRows } = await sq;
      const ids = (saleRows ?? []).map((s: any) => s.id);
      if (ids.length === 0) return [] as number[];
      const { data } = await (supabase as any)
        .from("payments").select("check_number").in("sale_id", ids);
      return (data ?? []).map((r: any) => Number(r.check_number)).filter((n: number) => Number.isFinite(n));
    },
  });

  const usedSet = new Set<number>(used as number[]);

  return (
    <select
      value={value || "auto"}
      onChange={(e) => onChange(e.target.value === "auto" ? "" : e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <option value="auto">Автоматӣ</option>
      {Array.from({ length: 1500 }, (_, i) => i + 1).map((n) => (
        <option key={n} value={String(n)} disabled={usedSet.has(n)}>
          №{n}{usedSet.has(n) ? " — истифода шудааст" : ""}
        </option>
      ))}
    </select>
  );
}



