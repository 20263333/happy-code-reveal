import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Wallet, Play, Square, ArrowLeftRight, Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cashier")({
  head: () => ({ meta: [{ title: "Кассир — Binosoz.tj" }] }),
  component: CashierPage,
});

type Register = { id: string; name: string; project_id: string | null; currency: string; is_active: boolean; company_id: string };
type Shift = { id: string; register_id: string; cashier_user_id: string; opened_at: string; opened_balance: number; closed_at: string | null; closed_balance_declared: number | null; closed_balance_system: number | null; diff: number | null; status: string; note: string | null };
type Op = { id: string; register_id: string; shift_id: string | null; direction: string; source: string; amount: number; currency: string; operation_date: string; counterparty: string | null; note: string | null; created_at: string };

function CashierPage() {
  const { tr } = useT();
  const { formatMoney } = usePrefs();
  const { companyId, user, isOwner } = useAuth();
  const qc = useQueryClient();
  const [selectedRegister, setSelectedRegister] = useState<string>("");

  // Registers accessible to user
  const { data: registers = [] } = useQuery({
    queryKey: ["cash-registers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("cash_registers" as any)
        .select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Register[];
    },
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["cash-projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id,name").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });
  const projectName = (id: string | null) => id ? (projects.find((p: any) => p.id === id)?.name ?? "—") : tr("Умумии ширкат");

  const activeRegister = registers.find((r) => r.id === selectedRegister) ?? registers[0];
  const activeId = activeRegister?.id ?? "";

  // Auto-pick first if none
  if (activeRegister && !selectedRegister) setTimeout(() => setSelectedRegister(activeRegister.id), 0);

  const { data: openShift } = useQuery({
    queryKey: ["cash-open-shift", activeId],
    queryFn: async () => {
      if (!activeId) return null;
      const { data } = await supabase.from("cash_shifts" as any)
        .select("*").eq("register_id", activeId).eq("status", "open").maybeSingle();
      return (data as unknown as Shift | null) ?? null;
    },
    enabled: !!activeId,
    refetchInterval: 5000,
  });

  const { data: ops = [] } = useQuery({
    queryKey: ["cash-ops", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data } = await supabase.from("cash_operations" as any)
        .select("*").eq("register_id", activeId).order("created_at", { ascending: false }).limit(500);
      return (data ?? []) as unknown as Op[];
    },
    enabled: !!activeId,
    refetchInterval: 5000,
  });

  const { data: balance = 0 } = useQuery({
    queryKey: ["cash-balance", activeId, ops.length],
    queryFn: async () => {
      if (!activeId) return 0;
      const { data } = await supabase.rpc("cash_register_balance" as any, { _register_id: activeId });
      return Number(data ?? 0);
    },
    enabled: !!activeId,
  });

  const totalIn = useMemo(() => ops.filter(o => o.direction === "in").reduce((s, o) => s + Number(o.amount), 0), [ops]);
  const totalOut = useMemo(() => ops.filter(o => o.direction === "out").reduce((s, o) => s + Number(o.amount), 0), [ops]);

  // Open shift
  const [openDlg, setOpenDlg] = useState(false);
  const [openBal, setOpenBal] = useState("0");
  const [openNote, setOpenNote] = useState("");
  const openShiftMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cash_shift_open" as any, {
        _register_id: activeId, _opened_balance: Number(openBal) || 0, _note: openNote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Смена кушода шуд")); setOpenDlg(false); setOpenBal("0"); setOpenNote(""); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Close shift
  const [closeDlg, setCloseDlg] = useState(false);
  const [declared, setDeclared] = useState("0");
  const [closeNote, setCloseNote] = useState("");
  const closeShiftMut = useMutation({
    mutationFn: async () => {
      if (!openShift) throw new Error("Смена ёфт нашуд");
      const { data, error } = await supabase.rpc("cash_shift_close" as any, {
        _shift_id: openShift.id, _declared_balance: Number(declared) || 0, _note: closeNote || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(tr("Смена баста шуд") + `. ${tr("Фарқ")}: ${formatMoney(Number(data?.diff ?? 0))}`);
      setCloseDlg(false); setDeclared("0"); setCloseNote(""); qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Manual op
  const [opDlg, setOpDlg] = useState<{ open: boolean; direction: "in" | "out" }>({ open: false, direction: "in" });
  const [opAmount, setOpAmount] = useState("");
  const [opCp, setOpCp] = useState("");
  const [opNote, setOpNote] = useState("");
  const addOpMut = useMutation({
    mutationFn: async () => {
      if (!activeRegister) throw new Error("Касса нест");
      const amt = Number(opAmount);
      if (!(amt > 0)) throw new Error("Маблағ хато");
      const { error } = await supabase.from("cash_operations" as any).insert({
        company_id: activeRegister.company_id,
        register_id: activeRegister.id,
        shift_id: openShift?.id ?? null,
        direction: opDlg.direction,
        source: opDlg.direction === "in" ? "manual_in" : "manual_out",
        amount: amt,
        currency: activeRegister.currency,
        counterparty: opCp || null,
        note: opNote || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Сабт шуд")); setOpDlg({ open: false, direction: "in" }); setOpAmount(""); setOpCp(""); setOpNote(""); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Transfer
  const [xferDlg, setXferDlg] = useState(false);
  const [xferTo, setXferTo] = useState("");
  const [xferAmt, setXferAmt] = useState("");
  const [xferNote, setXferNote] = useState("");
  const xferMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cash_transfer" as any, {
        _from_register: activeId, _to_register: xferTo, _amount: Number(xferAmt), _note: xferNote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Гузаронида шуд")); setXferDlg(false); setXferTo(""); setXferAmt(""); setXferNote(""); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete op (owner)
  const delOpMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_operations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Ҳазф шуд")); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Create register (owner)
  const [newRegDlg, setNewRegDlg] = useState(false);
  const [newRegName, setNewRegName] = useState("");
  const [newRegProject, setNewRegProject] = useState<string>("__company__");
  const [newRegCur, setNewRegCur] = useState("TJS");
  const createRegMut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Компания");
      const { error } = await supabase.from("cash_registers" as any).insert({
        company_id: companyId,
        project_id: newRegProject === "__company__" ? null : newRegProject,
        name: newRegName || tr("Касса"),
        currency: newRegCur,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Касса сохта шуд")); setNewRegDlg(false); setNewRegName(""); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const sourceLabel = (s: string) => ({
    sale_payment: tr("Пардохти муштарӣ"),
    supplier_payable: tr("Пардохт ба таъминкунанда"),
    worker_payment: tr("Пардохт ба коргар"),
    manual_in: tr("Даромади дастӣ"),
    manual_out: tr("Расходи дастӣ"),
    transfer_in: tr("Гузаронидан (даромад)"),
    transfer_out: tr("Гузаронидан (расход)"),
    open_balance: tr("Мондаи саршуда"),
    shift_diff: tr("Фарқи смена"),
  } as any)[s] ?? s;

  const printReceipt = (op: Op) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>${tr("Чек")} #${op.id.slice(0,8)}</title>
      <style>body{font-family:sans-serif;padding:24px;max-width:400px;margin:auto}
      h2{margin:0 0 8px}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ccc}
      .big{font-size:20px;font-weight:bold}</style></head><body>
      <h2>${activeRegister?.name ?? ""} — ${op.direction === "in" ? tr("Даромад") : tr("Расход")}</h2>
      <div class="row"><span>${tr("Сана")}</span><span>${formatDate(op.operation_date)}</span></div>
      <div class="row"><span>${tr("Намуд")}</span><span>${sourceLabel(op.source)}</span></div>
      ${op.counterparty ? `<div class="row"><span>${tr("Ҷониб")}</span><span>${op.counterparty}</span></div>` : ""}
      ${op.note ? `<div class="row"><span>${tr("Эзоҳ")}</span><span>${op.note}</span></div>` : ""}
      <div class="row big"><span>${tr("Маблағ")}</span><span>${formatMoney(Number(op.amount))} ${op.currency}</span></div>
      <p style="text-align:center;margin-top:32px;color:#666">Binosoz.tj</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  const printZReport = () => {
    if (!openShift) return;
    const w = window.open("", "_blank"); if (!w) return;
    const rows = ops.filter(o => o.shift_id === openShift.id);
    const sIn = rows.filter(o => o.direction === "in").reduce((s,o)=>s+Number(o.amount),0);
    const sOut = rows.filter(o => o.direction === "out").reduce((s,o)=>s+Number(o.amount),0);
    w.document.write(`<html><head><title>Z-${tr("Ҳисобот")}</title>
      <style>body{font-family:sans-serif;padding:24px;max-width:600px;margin:auto}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{border:1px solid #ddd;padding:6px;text-align:left;font-size:12px}
      .big{font-size:18px;font-weight:bold}</style></head><body>
      <h2>Z-${tr("Ҳисоботи смена")} — ${activeRegister?.name ?? ""}</h2>
      <p>${tr("Кушода")}: ${new Date(openShift.opened_at).toLocaleString()}</p>
      <p>${tr("Мондаи саршуда")}: <b>${formatMoney(Number(openShift.opened_balance))}</b></p>
      <table><thead><tr><th>${tr("Сана")}</th><th>${tr("Намуд")}</th><th>${tr("Ҷониб")}</th><th style="text-align:right">${tr("Даромад")}</th><th style="text-align:right">${tr("Расход")}</th></tr></thead>
      <tbody>${rows.map(o=>`<tr><td>${formatDate(o.operation_date)}</td><td>${sourceLabel(o.source)}</td><td>${o.counterparty ?? ""}</td>
      <td style="text-align:right">${o.direction==="in"?formatMoney(Number(o.amount)):""}</td>
      <td style="text-align:right">${o.direction==="out"?formatMoney(Number(o.amount)):""}</td></tr>`).join("")}</tbody></table>
      <div class="big">${tr("Ҷамъи даромад")}: ${formatMoney(sIn)}</div>
      <div class="big">${tr("Ҷамъи расход")}: ${formatMoney(sOut)}</div>
      <div class="big">${tr("Мондаи системавӣ")}: ${formatMoney(Number(openShift.opened_balance) + sIn - sOut)}</div>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  if (!registers.length) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title={tr("Кассир")} subtitle={tr("Кассабонии рӯзонаи ширкат")} />
        <EmptyState icon={Wallet} title={tr("Ҳоло касса нест")} description={tr("Барои сар кардан касса созед")} />
        {isOwner && (
          <Dialog open={newRegDlg} onOpenChange={setNewRegDlg}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{tr("Сохтани касса")}</Button></DialogTrigger>
            <NewRegisterDialog {...{ newRegName, setNewRegName, newRegProject, setNewRegProject, newRegCur, setNewRegCur, projects, createRegMut, tr }} />
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title={tr("Кассир")} subtitle={tr("Кассабонии рӯзонаи ширкат")} />

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1 min-w-[220px]">
          <Label className="text-xs">{tr("Касса")}</Label>
          <Select value={activeId} onValueChange={setSelectedRegister}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {registers.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name} • {projectName(r.project_id)} • {r.currency}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isOwner && (
          <Dialog open={newRegDlg} onOpenChange={setNewRegDlg}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />{tr("Касса")}</Button></DialogTrigger>
            <NewRegisterDialog {...{ newRegName, setNewRegName, newRegProject, setNewRegProject, newRegCur, setNewRegCur, projects, createRegMut, tr }} />
          </Dialog>
        )}
        <div className="flex-1" />
        {openShift ? (
          <>
            <Badge variant="default" className="h-9 px-3">{tr("Смена кушода")}</Badge>
            <Button variant="outline" size="sm" onClick={printZReport}><Printer className="h-4 w-4 mr-1" />Z-{tr("отчёт")}</Button>
            <Dialog open={closeDlg} onOpenChange={setCloseDlg}>
              <DialogTrigger asChild><Button variant="destructive" size="sm"><Square className="h-4 w-4 mr-1" />{tr("Бастан")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{tr("Бастани смена")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-lg border p-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>{tr("Мондаи саршуда")}</span><b>{formatMoney(Number(openShift.opened_balance))}</b></div>
                    <div className="flex justify-between"><span>{tr("Даромад дар смена")}</span><b className="text-emerald-600">+{formatMoney(ops.filter(o=>o.shift_id===openShift.id && o.direction==="in").reduce((s,o)=>s+Number(o.amount),0))}</b></div>
                    <div className="flex justify-between"><span>{tr("Расход дар смена")}</span><b className="text-red-600">−{formatMoney(ops.filter(o=>o.shift_id===openShift.id && o.direction==="out").reduce((s,o)=>s+Number(o.amount),0))}</b></div>
                    <div className="flex justify-between text-base border-t pt-2"><span>{tr("Мондаи системавӣ")}</span><b>{formatMoney(Number(openShift.opened_balance) + ops.filter(o=>o.shift_id===openShift.id).reduce((s,o)=>s+(o.direction==="in"?1:-1)*Number(o.amount),0))}</b></div>
                  </div>
                  <div><Label>{tr("Мондаи фактӣ дар касса")}</Label><Input type="number" value={declared} onChange={e=>setDeclared(e.target.value)} /></div>
                  <div><Label>{tr("Эзоҳ")}</Label><Textarea value={closeNote} onChange={e=>setCloseNote(e.target.value)} /></div>
                </div>
                <DialogFooter><Button onClick={()=>closeShiftMut.mutate()} disabled={closeShiftMut.isPending}>{tr("Бастан")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Dialog open={openDlg} onOpenChange={setOpenDlg}>
            <DialogTrigger asChild><Button size="sm"><Play className="h-4 w-4 mr-1" />{tr("Кушодани смена")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tr("Кушодани смена")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{tr("Мондаи саршуда")}</Label><Input type="number" value={openBal} onChange={e=>setOpenBal(e.target.value)} /></div>
                <div><Label>{tr("Эзоҳ")}</Label><Textarea value={openNote} onChange={e=>setOpenNote(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={()=>openShiftMut.mutate()} disabled={openShiftMut.isPending}>{tr("Кушодан")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={tr("Мондаи ҷорӣ")} value={`${formatMoney(Number(balance))} ${activeRegister?.currency ?? ""}`} icon={Wallet} />
        <StatCard label={tr("Ҷамъи даромад")} value={formatMoney(totalIn)} icon={Play} />
        <StatCard label={tr("Ҷамъи расход")} value={formatMoney(totalOut)} icon={Square} />
        <StatCard label={tr("Ҳамаи амалҳо")} value={String(ops.length)} icon={Wallet} />
      </div>

      <Tabs defaultValue="ops">
        <TabsList>
          <TabsTrigger value="ops">{tr("Амалҳо")}</TabsTrigger>
          <TabsTrigger value="shifts">{tr("Сменаҳо")}</TabsTrigger>
          <TabsTrigger value="transfer">{tr("Гузаронидан")}</TabsTrigger>
        </TabsList>

        <TabsContent value="ops" className="space-y-3">
          <div className="flex gap-2">
            <Dialog open={opDlg.open && opDlg.direction === "in"} onOpenChange={(o)=>setOpDlg({open:o, direction:"in"})}>
              <DialogTrigger asChild><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />{tr("Даромад")}</Button></DialogTrigger>
              <OpDialog {...{ direction: "in", opAmount, setOpAmount, opCp, setOpCp, opNote, setOpNote, addOpMut, tr }} />
            </Dialog>
            <Dialog open={opDlg.open && opDlg.direction === "out"} onOpenChange={(o)=>setOpDlg({open:o, direction:"out"})}>
              <DialogTrigger asChild><Button size="sm" variant="destructive"><Plus className="h-4 w-4 mr-1" />{tr("Расход")}</Button></DialogTrigger>
              <OpDialog {...{ direction: "out", opAmount, setOpAmount, opCp, setOpCp, opNote, setOpNote, addOpMut, tr }} />
            </Dialog>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">{tr("Сана")}</th>
                  <th className="p-2 text-left">{tr("Намуд")}</th>
                  <th className="p-2 text-left">{tr("Ҷониб")}</th>
                  <th className="p-2 text-left">{tr("Эзоҳ")}</th>
                  <th className="p-2 text-right">{tr("Даромад")}</th>
                  <th className="p-2 text-right">{tr("Расход")}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {ops.map(o => (
                  <tr key={o.id} className="border-t">
                    <td className="p-2">{formatDate(o.operation_date)}</td>
                    <td className="p-2">{sourceLabel(o.source)}</td>
                    <td className="p-2">{o.counterparty ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{o.note ?? ""}</td>
                    <td className="p-2 text-right text-emerald-600 font-medium">{o.direction === "in" ? formatMoney(Number(o.amount)) : ""}</td>
                    <td className="p-2 text-right text-red-600 font-medium">{o.direction === "out" ? formatMoney(Number(o.amount)) : ""}</td>
                    <td className="p-2 flex gap-1">
                      <Button size="sm" variant="ghost" onClick={()=>printReceipt(o)}><Printer className="h-3 w-3" /></Button>
                      {isOwner && <Button size="sm" variant="ghost" onClick={()=>delOpMut.mutate(o.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>}
                    </td>
                  </tr>
                ))}
                {!ops.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{tr("Амал нест")}</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="shifts">
          <ShiftHistory registerId={activeId} formatMoney={formatMoney} tr={tr} />
        </TabsContent>

        <TabsContent value="transfer" className="space-y-3">
          <div className="rounded-lg border p-4 max-w-md space-y-3">
            <h3 className="font-medium">{tr("Гузаронидан аз касса ба касса")}</h3>
            <div><Label>{tr("Аз касса")}</Label><Input value={activeRegister?.name ?? ""} disabled /></div>
            <div><Label>{tr("Ба касса")}</Label>
              <Select value={xferTo} onValueChange={setXferTo}>
                <SelectTrigger><SelectValue placeholder={tr("Интихоб кунед")} /></SelectTrigger>
                <SelectContent>
                  {registers.filter(r => r.id !== activeId).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name} • {r.currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{tr("Маблағ")}</Label><Input type="number" value={xferAmt} onChange={e=>setXferAmt(e.target.value)} /></div>
            <div><Label>{tr("Эзоҳ")}</Label><Textarea value={xferNote} onChange={e=>setXferNote(e.target.value)} /></div>
            <Button onClick={()=>xferMut.mutate()} disabled={!xferTo || !xferAmt || xferMut.isPending}>
              <ArrowLeftRight className="h-4 w-4 mr-1" />{tr("Гузаронидан")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OpDialog({ direction, opAmount, setOpAmount, opCp, setOpCp, opNote, setOpNote, addOpMut, tr }: any) {
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{direction === "in" ? tr("Даромади дастӣ") : tr("Расходи дастӣ")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{tr("Маблағ")}</Label><Input type="number" value={opAmount} onChange={e=>setOpAmount(e.target.value)} /></div>
        <div><Label>{tr("Ҷониб")}</Label><Input value={opCp} onChange={e=>setOpCp(e.target.value)} /></div>
        <div><Label>{tr("Эзоҳ")}</Label><Textarea value={opNote} onChange={e=>setOpNote(e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={()=>addOpMut.mutate()} disabled={addOpMut.isPending}>{tr("Сабт")}</Button></DialogFooter>
    </DialogContent>
  );
}

function NewRegisterDialog({ newRegName, setNewRegName, newRegProject, setNewRegProject, newRegCur, setNewRegCur, projects, createRegMut, tr }: any) {
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{tr("Сохтани касса")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{tr("Ном")}</Label><Input value={newRegName} onChange={e=>setNewRegName(e.target.value)} placeholder={tr("Кассаи асосӣ")} /></div>
        <div><Label>{tr("Мансуб ба лоиҳа/ЖК/блок")}</Label>
          <Select value={newRegProject} onValueChange={setNewRegProject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__company__">{tr("Умумии ширкат")}</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>{tr("Асъор")}</Label>
          <Select value={newRegCur} onValueChange={setNewRegCur}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TJS">TJS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={()=>createRegMut.mutate()} disabled={createRegMut.isPending}>{tr("Сохтан")}</Button></DialogFooter>
    </DialogContent>
  );
}

function ShiftHistory({ registerId, formatMoney, tr }: any) {
  const { data: shifts = [] } = useQuery({
    queryKey: ["cash-shifts", registerId],
    queryFn: async () => {
      if (!registerId) return [];
      const { data } = await supabase.from("cash_shifts" as any)
        .select("*").eq("register_id", registerId).order("opened_at", { ascending: false }).limit(100);
      return (data ?? []) as unknown as Shift[];
    },
    enabled: !!registerId,
  });
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50"><tr>
          <th className="p-2 text-left">{tr("Кушода")}</th>
          <th className="p-2 text-left">{tr("Баста")}</th>
          <th className="p-2 text-right">{tr("Мондаи саршуда")}</th>
          <th className="p-2 text-right">{tr("Системавӣ")}</th>
          <th className="p-2 text-right">{tr("Эълоншуда")}</th>
          <th className="p-2 text-right">{tr("Фарқ")}</th>
          <th className="p-2 text-left">{tr("Ҳолат")}</th>
        </tr></thead>
        <tbody>
          {shifts.map(s => (
            <tr key={s.id} className="border-t">
              <td className="p-2">{new Date(s.opened_at).toLocaleString()}</td>
              <td className="p-2">{s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"}</td>
              <td className="p-2 text-right">{formatMoney(Number(s.opened_balance))}</td>
              <td className="p-2 text-right">{s.closed_balance_system != null ? formatMoney(Number(s.closed_balance_system)) : "—"}</td>
              <td className="p-2 text-right">{s.closed_balance_declared != null ? formatMoney(Number(s.closed_balance_declared)) : "—"}</td>
              <td className={`p-2 text-right font-medium ${Number(s.diff) === 0 ? "" : Number(s.diff) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {s.diff != null ? formatMoney(Number(s.diff)) : "—"}
              </td>
              <td className="p-2"><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? tr("Кушода") : tr("Баста")}</Badge></td>
            </tr>
          ))}
          {!shifts.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{tr("Смена нест")}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
