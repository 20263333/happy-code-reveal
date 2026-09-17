import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HardHat, Plus, ChevronLeft, ChevronRight, Wallet, Users, CheckCircle2, DollarSign, Monitor, Printer } from "lucide-react";
import { useCompanyHeader, openPrintWindow, esc } from "@/lib/print";
import { useAuth } from "@/hooks/use-auth";
import { useTabGate } from "@/lib/use-tab-gate";
import { ATTENDANCE_TAB_KEYS } from "@/lib/app-pages";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/constants";
import { useServerFn } from "@tanstack/react-start";
import { getKioskSettings, setKioskPin, setKioskEnabled } from "@/lib/kiosk.functions";
import { enrollWorkerFace } from "@/lib/face-id.functions";
import { FaceCaptureDialog } from "@/components/face-capture-dialog";
import { Copy, ExternalLink } from "lucide-react";
import { ExcelImportWorkers } from "@/components/excel-import-workers";


export const Route = createFileRoute("/_app/attendance")({
  head: () => ({ meta: [{ title: "Табел коргарон — PLATFORM.TJ" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const { isOwner, isAccountant, isManager, isDirector, companyId } = useAuth();
  const canEdit = !isDirector && (isOwner || isAccountant || isManager);
  const canPay = !isDirector && (isOwner || isAccountant);
  const tabOk = useTabGate();
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();

  const [month, setMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rateOpen, setRateOpen] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState<any>(null);

  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-full", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("workers").select("*, face_photo_path, face_enrolled_at, face_required")
        .eq("company_id", companyId).order("fullname");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", companyId, month],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("attendance")
        .select("*").eq("company_id", companyId).gte("date", from).lte("date", to);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["worker-payments", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("worker_payments")
        .select("*, worker:workers(fullname)")
        .eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  // Map worker+date → attendance record
  const attMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of attendance) m.set(`${a.worker_id}_${a.date}`, a);
    return m;
  }, [attendance]);

  const attKey = ["attendance", companyId, month] as const;
  const hoursFor = (status: string) =>
    status === "full" ? 8 : status === "half" ? 4 : status === "absent" ? 0 : null;

  const setAtt = useMutation({
    mutationFn: async ({ workerId, date, status }: { workerId: string; date: string; status: string }) => {
      const { data: prev } = await (supabase as any).from("attendance")
        .select("id").eq("worker_id", workerId).eq("date", date).maybeSingle();
      const { data: { user } } = await supabase.auth.getUser();
      const hours = hoursFor(status);
      if (status === "clear") {
        if (prev) {
          const { error } = await (supabase as any).from("attendance").delete().eq("id", prev.id);
          if (error) throw error;
        }
      } else if (prev) {
        const { error } = await (supabase as any).from("attendance").update({ status, hours }).eq("id", prev.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("attendance").insert({
          worker_id: workerId, company_id: companyId, date, status, hours, created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ workerId, date, status }) => {
      await qc.cancelQueries({ queryKey: attKey });
      const prev = qc.getQueryData<any[]>(attKey) ?? [];
      const idx = prev.findIndex((a: any) => a.worker_id === workerId && a.date === date);
      const hours = hoursFor(status);
      let next = prev.slice();
      if (status === "clear") {
        if (idx >= 0) next.splice(idx, 1);
      } else if (idx >= 0) {
        next[idx] = { ...next[idx], status, hours };
      } else {
        next.push({ id: `tmp-${workerId}-${date}`, worker_id: workerId, date, status, hours, company_id: companyId });
      }
      qc.setQueryData(attKey, next);
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(attKey, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: attKey }),
  });

  // Per worker: days worked + total earned
  const workerStats = workers.map((w: any) => {
    const wAtt = attendance.filter((a: any) => a.worker_id === w.id);
    const daysWorked = wAtt.reduce((s: number, a: any) =>
      s + (a.status === "full" ? 1 : a.status === "half" ? 0.5 : 0), 0);
    const hoursWorked = wAtt.reduce((s: number, a: any) => s + Number(a.hours || 0), 0);
    const rate = Number(w.daily_rate || 0);
    return { ...w, daysWorked, hoursWorked, earned: daysWorked * rate };
  });

  const totalEarned = workerStats.reduce((s: number, w: any) => s + w.earned, 0);
  const activeWorkers = workers.filter((w: any) => w.is_active !== false).length;

  const shiftMonth = (delta: number) => {
    const d = new Date(year, mon - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const cycle = (cur: string | undefined) =>
    cur === "full" ? "half" : cur === "half" ? "absent" : cur === "absent" ? "clear" : "full";

  const company = useCompanyHeader();
  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const statusChar = (s: string | undefined) => s === "full" ? "✓" : s === "half" ? "½" : s === "absent" ? "✗" : "";

  const handlePrint = () => {
    const dayCols = days.map((d) => `<th style="padding:2px 4px;font-size:9px">${d}</th>`).join("");
    const rowsHtml = workers.map((w: any, i: number) => {
      const ws = workerStats.find((x: any) => x.id === w.id)!;
      const cells = days.map((d) => {
        const dateStr = `${month}-${String(d).padStart(2, "0")}`;
        const rec = attMap.get(`${w.id}_${dateStr}`);
        return `<td style="text-align:center;font-size:10px">${statusChar(rec?.status)}</td>`;
      }).join("");
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(w.fullname)}${w.position ? `<br/><span style="font-size:9px;color:#666">${esc(w.position)}</span>` : ""}</td>
        ${cells}
        <td style="text-align:right;font-weight:600">${ws.daysWorked}</td>
        <td style="text-align:right">${esc(String(w.daily_rate || 0))}</td>
        <td class="num" style="font-weight:600">${esc(String(Math.round(ws.earned)))}</td>
      </tr>`;
    }).join("");

    const content = `
      <h1>Табел коргарон</h1>
      <h2>${esc(monthLabel)}</h2>
      <table style="font-size:11px">
        <thead>
          <tr>
            <th>№</th><th>Коргар</th>${dayCols}<th>Рӯз</th><th>Ставка</th><th class="num">Ҳисобшуда</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="${days.length + 4}">Ҷамъ</td><td class="num">${Math.round(totalEarned)}</td></tr></tfoot>
      </table>
      <div style="margin-top:12px;font-size:10px;color:#555">✓ — рӯзи пур · ½ — ним рӯз · ✗ — набуд</div>
    `;
    if (!openPrintWindow({ title: `Табел ${monthLabel}`, company, contentHtml: content })) {
      toast.error("Разрешите всплывающие окна");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Табел коргарон" subtitle="Ҳамарӯза коргаронро қайд кунед ва музди меҳнатро ҳисоб намоед" actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Чоп</Button>
          {isOwner && !isDirector && <ExcelImportWorkers />}
        </div>
      } />

      {isOwner && !isDirector && <TabelKioskLinkPanel />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Коргарони фаъол" value={String(activeWorkers)} icon={Users} />
        <StatCard label={`Ҳисобшуда (${month})`} value={formatMoney(totalEarned)} icon={DollarSign} accent="warning" />
        <StatCard label="Пардохтҳо" value={String(payments.length)} icon={Wallet} accent="success" />
      </div>

      <Tabs defaultValue={([["table", ATTENDANCE_TAB_KEYS.table], ["calc", ATTENDANCE_TAB_KEYS.calc], ["payments", ATTENDANCE_TAB_KEYS.payments]] as const).find(([, k]) => tabOk(k))?.[0]}>
        <TabsList>
          {tabOk(ATTENDANCE_TAB_KEYS.table) && <TabsTrigger value="table">Табел</TabsTrigger>}
          {tabOk(ATTENDANCE_TAB_KEYS.calc) && <TabsTrigger value="calc">Ҳисоб-китоб</TabsTrigger>}
          {tabOk(ATTENDANCE_TAB_KEYS.payments) && <TabsTrigger value="payments">Пардохтҳо</TabsTrigger>}
        </TabsList>

        {tabOk(ATTENDANCE_TAB_KEYS.table) && <TabsContent value="table" className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            <div className="ml-auto text-xs text-muted-foreground">
              Клик: ✓ пур → ½ ним → ✗ набуд → холӣ
            </div>
          </div>

          {workers.length === 0 ? (
            <EmptyState icon={HardHat} title="Коргарон ҳоло илова нашудаанд"
              description="Дар саҳифаи 'Сотрудники' коргар илова кунед." />
          ) : (
            <div className="overflow-auto rounded-xl border border-border bg-card">
              <table className="text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left sticky left-0 bg-muted/50 z-10 min-w-[180px]">Коргар</th>
                    {days.map((d) => (
                      <th key={d} className="px-1.5 py-2 text-center w-8">{d}</th>
                    ))}
                    <th className="px-3 py-2 text-right min-w-[80px]">Рӯз</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w: any) => {
                    const wStats = workerStats.find((x: any) => x.id === w.id)!;
                    return (
                      <tr key={w.id} className="border-t border-border">
                        <td className="px-3 py-2 sticky left-0 bg-card z-10 font-medium">
                          <div>{w.fullname}</div>
                          {w.position && <div className="text-[10px] text-muted-foreground">{w.position}</div>}
                        </td>
                        {days.map((d) => {
                          const dateStr = `${month}-${String(d).padStart(2, "0")}`;
                          const rec = attMap.get(`${w.id}_${dateStr}`);
                          const st = rec?.status;
                          return (
                            <td key={d} className="p-0.5 text-center">
                              <button
                                disabled={!canEdit}
                                onClick={() => setAtt.mutate({ workerId: w.id, date: dateStr, status: cycle(st) })}
                                className={cn("w-7 h-7 rounded text-xs font-bold transition",
                                  st === "full" && "bg-success text-success-foreground",
                                  st === "half" && "bg-warning text-warning-foreground",
                                  st === "absent" && "bg-destructive text-destructive-foreground",
                                  !st && "bg-muted/40 hover:bg-muted text-muted-foreground",
                                  !canEdit && "cursor-not-allowed opacity-70")}
                              >
                                {st === "full" ? "✓" : st === "half" ? "½" : st === "absent" ? "✗" : ""}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-semibold">{wStats.daysWorked}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {tabOk(ATTENDANCE_TAB_KEYS.calc) && <TabsContent value="calc" className="pt-4 space-y-3">
          <div className="text-xs text-muted-foreground">Барои моҳи {month}. Барои иваз кардани ставка, дар қатор клик кунед.</div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Коргар</th>
                  <th className="px-4 py-3 text-left">Вазифа</th>
                  <th className="px-4 py-3 text-right">Ставкаи рӯзона</th>
                  <th className="px-4 py-3 text-right">Рӯзҳо</th>
                  <th className="px-4 py-3 text-right">Соатҳо</th>
                  <th className="px-4 py-3 text-right">Ҳисобшуда</th>
                  {canPay && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {workerStats.map((w: any) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{w.fullname}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.position || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button className={canEdit ? "hover:underline" : "cursor-default"} disabled={!canEdit} onClick={() => setRateOpen(w.id)}>
                        {formatMoney(Number(w.daily_rate || 0))}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">{w.daysWorked}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{w.hoursWorked ? `${w.hoursWorked} с` : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(w.earned)}</td>
                    {canPay && (
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" disabled={w.earned <= 0}
                          onClick={() => setPayOpen({ worker: w, amount: w.earned, days: w.daysWorked })}>
                          <DollarSign className="h-3.5 w-3.5 mr-1" />Пардохт
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {workerStats.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Коргарон нест</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>}

        {tabOk(ATTENDANCE_TAB_KEYS.payments) && <TabsContent value="payments" className="pt-4">
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="Ҳоло пардохт нест" />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Коргар</th>
                    <th className="px-4 py-3 text-left">Давра</th>
                    <th className="px-4 py-3 text-right">Рӯзҳо</th>
                    <th className="px-4 py-3 text-right">Сумма</th>
                    <th className="px-4 py-3 text-left">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{p.worker?.fullname}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(p.period_from)} — {formatDate(p.period_to)}</td>
                      <td className="px-4 py-3 text-right">{p.days_worked}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                          p.status === "paid" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground")}>
                          <CheckCircle2 className="h-3 w-3" />{p.status === "paid" ? "Пардохт шуд" : "Дар навбат"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}
      </Tabs>

      {rateOpen && (
        <Dialog open={!!rateOpen} onOpenChange={(o) => !o && setRateOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Ставкаи рӯзона</DialogTitle></DialogHeader>
            <RateForm worker={workers.find((w: any) => w.id === rateOpen)}
              onDone={() => { setRateOpen(null); qc.invalidateQueries({ queryKey: ["workers-full", companyId] }); }} />
          </DialogContent>
        </Dialog>
      )}

      {payOpen && (
        <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Пардохти музд</DialogTitle></DialogHeader>
            <PayForm worker={payOpen.worker} amount={payOpen.amount} days={payOpen.days}
              periodFrom={from} periodTo={to} companyId={companyId}
              onDone={() => {
                setPayOpen(null);
                qc.invalidateQueries({ queryKey: ["worker-payments", companyId] });
                qc.invalidateQueries({ queryKey: ["expenses"] });
              }} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RateForm({ worker, onDone }: { worker: any; onDone: () => void }) {
  const [rate, setRate] = useState(String(worker?.daily_rate ?? 0));
  const [position, setPosition] = useState(worker?.position ?? "");
  const [faceOpen, setFaceOpen] = useState(false);
  const qc = useQueryClient();
  const enrollFn = useServerFn(enrollWorkerFace);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workers").update({
        daily_rate: Number(rate) || 0, position: position.trim() || null,
      } as any).eq("id", worker.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Захира шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const enroll = useMutation({
    mutationFn: async (base64: string) => {
      const res = await enrollFn({ data: { worker_id: worker.id, image_base64: base64 } });
      return res;
    },
    onSuccess: () => {
      toast.success("Акси рӯй сабт шуд");
      setFaceOpen(false);
      qc.invalidateQueries({ queryKey: ["workers-full", worker.company_id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Хатогӣ"),
  });

  const enrolled = !!worker?.face_photo_path;

  return (
    <>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5"><Label>Ставкаи рӯзона</Label>
          <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} min={0} /></div>
        <div className="space-y-1.5"><Label>Вазифа</Label>
          <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="масалан: усто" /></div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Face ID</div>
              <div className="text-xs text-muted-foreground">
                {enrolled ? "Акси рӯй сабт шудааст" : "Акси рӯй сабт нашудааст"}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setFaceOpen(true)}>
              {enrolled ? "Аз нав сабт кардан" : "Акс гирифтан"}
            </Button>
          </div>
        </div>

        <DialogFooter><Button type="submit" disabled={save.isPending}>Захира</Button></DialogFooter>
      </form>

      <FaceCaptureDialog
        open={faceOpen}
        onOpenChange={(o) => setFaceOpen(o)}
        title={`Акси рӯй — ${worker?.fullname ?? ""}`}
        subtitle="Рӯи коргарро дар доираи камера нигоҳ доред ва акс гиред"
        onCapture={(base64) => enroll.mutate(base64)}
        busy={enroll.isPending}
      />
    </>
  );
}

function PayForm({ worker, amount, days, periodFrom, periodTo, companyId, onDone }: {
  worker: any; amount: number; days: number; periodFrom: string; periodTo: string;
  companyId: string | null; onDone: () => void;
}) {
  const { formatMoney } = usePrefs();
  const [paidAmount, setPaidAmount] = useState(String(amount));
  const [note, setNote] = useState("");

  const pay = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Ширкат ёфт нашуд");
      const paid = Number(paidAmount);
      if (paid <= 0) throw new Error("Сумма нодуруст");
      const { data: { user } } = await supabase.auth.getUser();

      // Create linked expense (category=salary)
      const { data: exp, error: eErr } = await supabase.from("expenses").insert({
        amount: paid, category: "salary",
        description: `Музди меҳнат: ${worker.fullname} (${days} рӯз, ${periodFrom}—${periodTo})${note ? " — " + note : ""}`,
        expense_date: new Date().toISOString().slice(0, 10),
        created_by: user?.id,
      } as any).select().single();
      if (eErr) throw eErr;

      const { error } = await (supabase as any).from("worker_payments").insert({
        worker_id: worker.id, company_id: companyId,
        period_from: periodFrom, period_to: periodTo,
        days_worked: days, total_amount: amount, paid_amount: paid,
        status: paid >= amount ? "paid" : "partial",
        note: note.trim() || null, expense_id: exp?.id, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Пардохт сабт шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div><b>{worker.fullname}</b></div>
        <div className="text-muted-foreground">Ҳисобшуда: {formatMoney(amount)} ({days} рӯз)</div>
      </div>
      <div className="space-y-1.5"><Label>Суммаи пардохт</Label>
        <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} min={1} required /></div>
      <div className="space-y-1.5"><Label>Шарҳ</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ихтиёрӣ" /></div>
      <div className="text-xs text-muted-foreground">
        ⚠️ Пардохт ба автоматӣ ҳамчун "Хароҷот → Зарплата" сабт мешавад.
      </div>
      <DialogFooter><Button type="submit" disabled={pay.isPending}>Пардохт кардан</Button></DialogFooter>
    </form>
  );
}

function TabelKioskLinkPanel() {
  const getSettings = useServerFn(getKioskSettings);
  const savePin = useServerFn(setKioskPin);
  const toggleEnabled = useServerFn(setKioskEnabled);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["kiosk-settings-for-tabel"],
    queryFn: () => getSettings(),
  });

  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  const pinMut = useMutation({
    mutationFn: async () => {
      if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN бояд 4-6 рақам бошад");
      if (pin !== pin2) throw new Error("PIN-ҳо мувофиқат намекунанд");
      return savePin({ data: { pin, enabled: true } });
    },
    onSuccess: () => {
      toast.success("PIN сабт шуд");
      setPin(""); setPin2("");
      qc.invalidateQueries({ queryKey: ["kiosk-settings-for-tabel"] });
    },
    onError: (e: any) => toast.error(e?.message || "Хатогӣ"),
  });

  const enableMut = useMutation({
    mutationFn: (enabled: boolean) => toggleEnabled({ data: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kiosk-settings-for-tabel"] }),
  });

  if (!data) return null;

  const needsPin = !data.pin_set;
  const url = data.kiosk_token ? `${window.location.origin}/tabel-screen/${data.kiosk_token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Линк нусхабардорӣ шуд");
    } catch {
      toast.error("Хатогӣ");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <div className="font-semibold">Линки Табел-Kiosk барои экрани алоҳида</div>
      </div>
      <div className="text-xs text-muted-foreground">
        Ин линкро дар планшет/экрани дигар кушоед — бе логин, танҳо бо PIN. Ҳар коргар меояд ва рӯзи худро қайд мекунад.
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
        <div className="text-sm font-medium">
          {needsPin ? "PIN гузоред (4-6 рақам)" : "PIN-ро иваз кардан (4-6 рақам)"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Диққат: рақамҳо намоён нишон дода мешаванд, то хато нашавед. Пас аз сабт кардан, ҳамин рақамҳоро дар экрани Kiosk ворид кунед.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            name="kiosk-pin-new"
            maxLength={6}
            placeholder="PIN нав"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-32 font-mono tracking-widest text-center"
          />
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            name="kiosk-pin-repeat"
            maxLength={6}
            placeholder="Такрор"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
            className="w-32 font-mono tracking-widest text-center"
          />
          <Button size="sm" onClick={() => pinMut.mutate()} disabled={pinMut.isPending || !pin || !pin2}>
            {needsPin ? "Сабт кардан" : "Иваз кардан"}
          </Button>
          {data.pin_set && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => enableMut.mutate(!data.enabled)}
              disabled={enableMut.isPending}
            >
              {data.enabled ? "Ғайрифаъол кардан" : "Фаъол кардан"}
            </Button>
          )}
          <div className="text-xs text-muted-foreground">
            Ҳолат: {data.enabled && data.pin_set ? "фаъол ✓" : "ғайрифаъол"}
          </div>
        </div>
      </div>

      {data.enabled && data.pin_set && url ? (
        <div className="flex items-center gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={copy} className="gap-1">
            <Copy className="h-3.5 w-3.5" />Нусха
          </Button>
          <a href={url} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1">
              <ExternalLink className="h-3.5 w-3.5" />Кушодан
            </Button>
          </a>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Барои гирифтани линк — PIN гузоред ва фаъол кунед.
        </div>
      )}
    </div>
  );
}
