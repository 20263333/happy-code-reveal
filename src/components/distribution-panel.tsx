import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Wallet, Users, TrendingUp, Percent, Calculator, RefreshCw, Settings, Undo2, Printer } from "lucide-react";
import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { amountToTajikWords } from "@/lib/num-to-words";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatCard, EmptyState } from "@/components/page-header";
import { toast } from "sonner";
import { usePrefs } from "@/lib/preferences";
import { formatDate } from "@/lib/constants";
import { listCompanyDirectors } from "@/lib/directors.functions";
import {
  listPartnerShares, upsertPartnerShare, deletePartnerShare,
  payPartner, listPartnerPayouts, deletePartnerPayout, listPartnerDistributions,
  getProjectPartnerStats,
  getProjectCostBasis, updateProjectCostBasis, recomputeProjectDistributions,
} from "@/lib/distribution.functions";
import { listCarDamages } from "@/lib/car-damages.functions";

export function DistributionPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();
  const listSharesFn = useServerFn(listPartnerShares);
  const upsertFn = useServerFn(upsertPartnerShare);
  const deleteFn = useServerFn(deletePartnerShare);
  const listDirectorsFn = useServerFn(listCompanyDirectors);
  const payFn = useServerFn(payPartner);
  const listPayoutsFn = useServerFn(listPartnerPayouts);
  const deletePayoutFn = useServerFn(deletePartnerPayout);
  const listDistFn = useServerFn(listPartnerDistributions);
  const statsFn = useServerFn(getProjectPartnerStats);
  const getCostFn = useServerFn(getProjectCostBasis);
  const updateCostFn = useServerFn(updateProjectCostBasis);
  const recomputeFn = useServerFn(recomputeProjectDistributions);
  const listDamagesFn = useServerFn(listCarDamages);
  const company = useCompanyHeader();

  function printPayoutCheck(p: any, directorName: string) {
    const html = `
      <h1 style="text-align:center">ЧЕКИ ПАРДОХТ БА ШАРИК</h1>
      <table style="margin-top:12px">
        <tbody>
          <tr><th style="width:200px">Сана</th><td>${esc(formatDate(p.paid_date))}</td></tr>
          <tr><th>Шарик (директор)</th><td>${esc(directorName)}</td></tr>
          <tr><th>Маблағ</th><td><b>${esc(formatMoney(p.amount))}</b></td></tr>
          <tr><th>Бо ҳуруф</th><td>${esc(amountToTajikWords(Number(p.amount || 0)))}</td></tr>
          <tr><th>Эзоҳ</th><td>${esc(p.note ?? "")}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:28px;font-size:13px">
        <div>Супоридашуд: ____________________</div>
        <div style="margin-top:18px">Қабул кард: ____________________</div>
      </div>`;

    const ok = openPrintWindow({
      title: "Чеки пардохт ба шарик",
      company,
      contentHtml: html,
      showUsdBox: false,
      showSignatures: false,
      showDocNumber: true,
    });
    if (!ok) toast.error("Равзанаи чоп кушода нашуд");
  }


  const { data: sharesData } = useQuery({
    queryKey: ["partner-shares", projectId],
    queryFn: () => listSharesFn({ data: { project_id: projectId } }),
  });
  const { data: costData } = useQuery({
    queryKey: ["project-cost-basis", projectId],
    queryFn: () => getCostFn({ data: { project_id: projectId } }),
  });
  const { data: directorsData } = useQuery({
    queryKey: ["company-directors"],
    queryFn: () => listDirectorsFn({}),
    enabled: canEdit,
  });
  const { data: statsData } = useQuery({
    queryKey: ["partner-stats", projectId],
    queryFn: () => statsFn({ data: { project_id: projectId } }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const { data: payoutsData } = useQuery({
    queryKey: ["partner-payouts", projectId],
    queryFn: () => listPayoutsFn({ data: { project_id: projectId } }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const { data: distData } = useQuery({
    queryKey: ["partner-dist", projectId],
    queryFn: () => listDistFn({ data: { project_id: projectId } }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const { data: damagesData } = useQuery({
    queryKey: ["car-damages", projectId],
    queryFn: () => listDamagesFn({ data: { project_id: projectId } }),
  });

  const shares: any[] = sharesData?.shares ?? [];
  const totalPct = sharesData?.total_percent ?? 0;
  const constructionPct = sharesData?.construction_percent ?? 100;
  const directors: any[] = directorsData?.directors ?? [];
  const payouts: any[] = payoutsData?.payouts ?? [];
  const dist: any[] = distData?.distributions ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ director_user_id: "", percent: "" });

  const [payOpen, setPayOpen] = useState<null | { director_user_id: string; name: string; balance: number }>(null);
  const [payForm, setPayForm] = useState({ amount: "", paid_date: new Date().toISOString().slice(0, 10), note: "" });

  const [costForm, setCostForm] = useState({ cost_per_sqm: "", cost_currency: "USD" as "USD" | "TJS" });
  useEffect(() => {
    if (costData) {
      setCostForm({
        cost_per_sqm: costData.cost_per_sqm != null ? String(costData.cost_per_sqm) : "",
        cost_currency: costData.cost_currency ?? "USD",
      });
    }
  }, [costData]);


  const addM = useMutation({
    mutationFn: (input: { director_user_id: string; percent: number }) =>
      upsertFn({ data: { project_id: projectId, ...input } }),
    onSuccess: () => {
      toast.success("Шарик илова шуд");
      setAddOpen(false);
      setForm({ director_user_id: "", percent: "" });
      qc.invalidateQueries({ queryKey: ["partner-shares", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Нест шуд");
      qc.invalidateQueries({ queryKey: ["partner-shares", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const payM = useMutation({
    mutationFn: (input: any) => payFn({ data: input }),
    onSuccess: () => {
      toast.success("Пардохт сабт шуд");
      setPayOpen(null);
      setPayForm({ amount: "", paid_date: new Date().toISOString().slice(0, 10), note: "" });
      qc.invalidateQueries({ queryKey: ["partner-payouts", projectId] });
      qc.invalidateQueries({ queryKey: ["partner-dist", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delPayoutM = useMutation({
    mutationFn: (id: string) => deletePayoutFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Пардохт вазврат шуд");
      qc.invalidateQueries({ queryKey: ["partner-payouts", projectId] });
      qc.invalidateQueries({ queryKey: ["partner-dist", projectId] });
      qc.invalidateQueries({ queryKey: ["partner-stats", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveCostM = useMutation({
    mutationFn: () => updateCostFn({
      data: {
        project_id: projectId,
        cost_per_sqm: costForm.cost_per_sqm ? Number(costForm.cost_per_sqm) : null,
        cost_currency: costForm.cost_currency,
      },
    }),
    onSuccess: () => {
      toast.success("Танзимот сабт шуд");
      qc.invalidateQueries({ queryKey: ["project-cost-basis", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recomputeM = useMutation({
    mutationFn: () => recomputeFn({ data: { project_id: projectId } }),
    onSuccess: (r: any) => {
      toast.success(`Аз нав ҳисоб шуд (${r?.rows ?? 0} сатр)`);
      qc.invalidateQueries({ queryKey: ["partner-dist", projectId] });
      qc.invalidateQueries({ queryKey: ["partner-stats", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Per-director aggregates
  const totalDamage = Number(damagesData?.total ?? 0);
  const shareBase = totalPct > 0 ? totalPct : 100;
  const perDir = shares.map((s) => {
    const earnedRaw = dist.filter((d) => d.director_user_id === s.director_user_id)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const paid = payouts.filter((p) => p.director_user_id === s.director_user_id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    // Damage reduces ONLY partner profit (margin), proportional to share %.
    const damageShare = totalDamage * (Number(s.percent) / shareBase);
    const earned = Math.max(0, earnedRaw - damageShare);
    return { ...s, earnedRaw, damageShare, earned, paid, balance: earned - paid };
  });

  const confirmed = statsData?.confirmed_payments ?? 0;
  const totalPartnersMoney = perDir.reduce((s, d) => s + d.earned, 0);
  const constructionFund = confirmed - totalPartnersMoney - totalDamage;

  const availableDirectors = directors.filter(
    (d) => !shares.some((s) => s.director_user_id === d.user_id),
  );

  const costPerSqm = costData?.cost_per_sqm ?? null;
  const usdRate = costData?.usd_rate ?? null;
  const costCur = costData?.cost_currency ?? "USD";
  const rateForCost = costCur === "USD" ? (usdRate && usdRate > 0 ? usdRate : 1) : 1;


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Пардохтҳои тасдиқшуда" value={formatMoney(confirmed)} icon={TrendingUp} />
        <StatCard label="Зарари мошин" value={formatMoney(totalDamage)} icon={Wallet} />
        <StatCard label="Ба хазинаи сохтмон" value={formatMoney(constructionFund)} icon={Wallet} />
        <StatCard label="Фоизи шарикон" value={`${totalPct}%`} icon={Percent} />
      </div>

      {perDir.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            Ба шарикон (пас аз зарар) · ҳамагӣ <b className="text-foreground">{formatMoney(totalPartnersMoney)}</b>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {perDir.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium leading-tight">{d.director_name}</div>
                  <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                    {Number(d.percent)}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold">{formatMoney(d.earned)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Пардохт шуд: {formatMoney(d.paid)} · Қарз: {formatMoney(d.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Cost basis settings */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Танзимоти арзиши аслӣ (себестоимость)</h3>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => recomputeM.mutate()} disabled={recomputeM.isPending}>
              <RefreshCw className={`w-4 h-4 mr-1 ${recomputeM.isPending ? "animate-spin" : ""}`} />
              Аз нав ҳисоб кун
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Фоидаи софӣ = Маблағи фурӯш − (Масоҳат × Арзиши аслӣ). Танҳо фоида байни шарикон тақсим карда мешавад.
        </p>
        <div className="grid gap-3 md:grid-cols-3 items-end">
          <div>
            <Label>Арзиши аслӣ барои 1 м²</Label>
            <Input
              type="number" step="0.01" min="0"
              value={costForm.cost_per_sqm}
              onChange={(e) => setCostForm({ ...costForm, cost_per_sqm: e.target.value })}
              disabled={!canEdit}
              placeholder="масалан 590"
            />
          </div>
          <div>
            <Label>Валюта</Label>
            <Select
              value={costForm.cost_currency}
              onValueChange={(v: "USD" | "TJS") => setCostForm({ ...costForm, cost_currency: v })}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">Доллар (USD)</SelectItem>
                <SelectItem value="TJS">Сомонӣ (TJS)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <Button onClick={() => saveCostM.mutate()} disabled={saveCostM.isPending}>
              Сабт кардани танзимот
            </Button>
          )}
        </div>
        {costPerSqm != null && costPerSqm > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm flex items-start gap-2">
            <Calculator className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="space-y-1">
              <div>
                Арзиши аслии ҷорӣ: <b>{costPerSqm.toLocaleString()} {costCur}/м²</b>
                {costCur === "USD" && usdRate && usdRate > 0 && (
                  <span className="text-muted-foreground"> · курси USD→TJS: {usdRate.toFixed(4)}</span>
                )}
              </div>
              <div className="text-muted-foreground">
                Намуна: квартираи 80 м² → арзиши аслӣ = 80 × {costPerSqm} {costCur}
                {costCur === "USD" && usdRate && usdRate > 0 && (
                  <> × {usdRate.toFixed(2)} ≈ <b>{formatMoney(80 * costPerSqm * rateForCost)}</b></>
                )}
                {costCur === "TJS" && (
                  <> = <b>{formatMoney(80 * costPerSqm)}</b></>
                )}
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Shares table */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Шарикон ва фоизҳо</h3>
            <p className="text-sm text-muted-foreground">
              Ҷамъ: <b>{totalPct}%</b> → Хазинаи сохтмон: <b>{constructionPct}%</b>
            </p>
          </div>
          {canEdit && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Илова кардани шарик</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Илова кардани шарик</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Директор</Label>
                    <Select value={form.director_user_id} onValueChange={(v) => setForm({ ...form, director_user_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Интихоб кунед…" /></SelectTrigger>
                      <SelectContent>
                        {availableDirectors.map((d) => (
                          <SelectItem key={d.user_id} value={d.user_id}>
                            {d.fullname} ({d.email})
                          </SelectItem>
                        ))}
                        {availableDirectors.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground">Ҳамаи директорон илова шудаанд ё нест ҳастанд</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Фоиз (%)</Label>
                    <Input type="number" step="0.01" min="0.01" max={100 - totalPct}
                      value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })}
                      placeholder={`Максимум ${100 - totalPct}%`} />
                    <p className="text-xs text-muted-foreground mt-1">Мондаи имконпазир: {100 - totalPct}%</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Бекор</Button>
                  <Button
                    disabled={!form.director_user_id || !form.percent || addM.isPending}
                    onClick={() => addM.mutate({
                      director_user_id: form.director_user_id,
                      percent: Number(form.percent),
                    })}
                  >Сабт</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {perDir.length === 0 ? (
          <EmptyState icon={Users} title="Ҳанӯз шарик нест" description="Директоронеро, ки дар даромади ин ЖК ҳисса доранд, илова кунед." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Директор</th>
                  <th className="py-2 pr-3">Фоиз</th>
                  <th className="py-2 pr-3">Ба ӯ рост омад</th>
                  <th className="py-2 pr-3">Пардохт шуд</th>
                  <th className="py-2 pr-3">Қарз</th>
                  {canEdit && <th className="py-2 pr-3 text-right">Амал</th>}
                </tr>
              </thead>
              <tbody>
                {perDir.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{d.director_name}</div>
                      {d.director_phone && <div className="text-xs text-muted-foreground">{d.director_phone}</div>}
                    </td>
                    <td className="py-2 pr-3"><Badge variant="secondary">{d.percent}%</Badge></td>
                    <td className="py-2 pr-3">{formatMoney(d.earned)}</td>
                    <td className="py-2 pr-3 text-emerald-600">{formatMoney(d.paid)}</td>
                    <td className="py-2 pr-3 font-semibold">
                      <span className={d.balance > 0 ? "text-amber-600" : "text-muted-foreground"}>
                        {formatMoney(d.balance)}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-2 pr-3 text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="outline"
                          disabled={d.balance <= 0}
                          onClick={() => setPayOpen({ director_user_id: d.director_user_id, name: d.director_name, balance: d.balance })}>
                          <Wallet className="w-3 h-3 mr-1" /> Пардохт
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm(`${d.director_name}-ро нест кунед?`)) delM.mutate(d.id);
                        }}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts history */}
      {payouts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold mb-3">Таърихи пардохтҳо ба шарикон</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Сана</th>
                  <th className="py-2 pr-3">Директор</th>
                  <th className="py-2 pr-3">Маблағ</th>
                  <th className="py-2 pr-3">Эзоҳ</th>
                  <th className="py-2 pr-3 text-right">Амал</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => {
                  const dr = perDir.find((x) => x.director_user_id === p.director_user_id);
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">{formatDate(p.paid_date)}</td>
                      <td className="py-2 pr-3">{dr?.director_name ?? "—"}</td>
                      <td className="py-2 pr-3 font-semibold">{formatMoney(p.amount)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.note ?? ""}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap space-x-2">
                        <Button size="sm" variant="secondary"
                          onClick={() => printPayoutCheck(p, dr?.director_name ?? "—")}>
                          <Printer className="w-3 h-3 mr-1" /> Чек
                        </Button>
                        {canEdit && (
                          <Button size="sm" variant="outline"
                            disabled={delPayoutM.isPending}
                            onClick={() => {
                              if (confirm(`Пардохти ${formatMoney(p.amount)} вазврат карда шавад? Маблағ ба ҳисоби шарик бармегардад.`)) {
                                delPayoutM.mutate(p.id);
                              }
                            }}>
                            <Undo2 className="w-3 h-3 mr-1" /> Вазврат
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        </div>
      )}

      {/* Pay dialog */}
      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Пардохт ба {payOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Қарзи ҷорӣ: <b>{formatMoney(payOpen?.balance ?? 0)}</b></p>
            <div>
              <Label>Маблағ</Label>
              <Input type="number" step="0.01" value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Сана</Label>
              <Input type="date" value={payForm.paid_date}
                onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} />
            </div>
            <div>
              <Label>Эзоҳ</Label>
              <Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>Бекор</Button>
            <Button
              disabled={!payForm.amount || payM.isPending}
              onClick={() => payM.mutate({
                project_id: projectId,
                director_user_id: payOpen!.director_user_id,
                amount: Number(payForm.amount),
                paid_date: payForm.paid_date,
                note: payForm.note || null,
              })}
            >Сабт кардан</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
