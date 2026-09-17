import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Check, X, Clock, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EXPENSE_CATEGORIES, REQUEST_CATEGORIES, formatDate } from "@/lib/constants";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listFundingRequests, createFundingRequest, decideFundingRequest, listApprovers, deleteFundingRequest,
} from "@/lib/funding.functions";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Интизорӣ", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  approved: { label: "Қабулшуда", cls: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Радшуда", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function FundingRequestsPanel({ projectId, canCreate = true }: { projectId: string; canCreate?: boolean }) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const catLabel = (v: string) => {
    const c = EXPENSE_CATEGORIES.find((x) => x.value === v);
    return c ? t(c.labelKey as any) : v;
  };

  const { data } = useQuery({
    queryKey: ["funding-requests", projectId],
    queryFn: () => listFundingRequests({ data: { project_id: projectId } }),
  });
  const requests = data?.requests ?? [];
  const me = data?.userId;

  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decideFundingRequest({ data: v }),
    onSuccess: (r: any) => {
      toast.success(r.status === "approved" ? "Заявка қабул шуд" : "Заявка рад шуд");
      qc.invalidateQueries({ refetchType: "all" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFundingRequest({ data: { id } }),
    onSuccess: () => { toast.success("Заявка нест шуд"); qc.invalidateQueries({ refetchType: "all" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = requests.filter((r: any) => r.status === "pending");
  const others = requests.filter((r: any) => r.status !== "pending");

  const Row = ({ r }: { r: any }) => {
    const canDecide = r.status === "pending" && (r.approver_id === me || !r.approver_id);
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-sm">
        <div className="min-w-40 flex-1">
          <div className="font-medium">{catLabel(r.category)}</div>
          <div className="text-xs text-muted-foreground">
            {r.floor_number != null ? `Этаж ${r.floor_number}` : "Умумӣ"} · {r.requester_name ?? "—"} · {formatDate(r.created_at)}
          </div>
          {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
        </div>
        <div className="font-semibold">{formatMoney(Number(r.amount))}</div>
        <Badge variant="outline" className={cn(STATUS[r.status]?.cls)}>{STATUS[r.status]?.label ?? r.status}</Badge>
        {canDecide ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>
              <Check className="mr-1 h-3.5 w-3.5" />Қабул
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" disabled={decide.isPending}
              onClick={() => decide.mutate({ id: r.id, approve: false })}>
              <X className="mr-1 h-3.5 w-3.5" />Рад
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {r.status === "pending"
              ? `Тасдиқкунанда: ${(r.approver_names?.length ? r.approver_names.join(", ") : r.approver_name) ?? "—"}`
              : ""}
          </span>
        )}
        {r.status !== "approved" && (
          <Button size="icon" variant="ghost" className="text-destructive" disabled={del.isPending}
            title="Нест кардан"
            onClick={() => { if (confirm("Ин заявка нест карда шавад?")) del.mutate(r.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Заявкаҳо (дархости маблағ)</h3>
        {canCreate && <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Заявкаи нав</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Заявкаи нав</DialogTitle></DialogHeader>
            <RequestForm projectId={projectId} onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["funding-requests", projectId] });
            }} />
          </DialogContent>
        </Dialog>}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />Барои тасдиқ ({pending.length})
        </div>
        {pending.length === 0
          ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">Заявкаи интизорӣ нест</div>
          : pending.map((r: any) => <Row key={r.id} r={r} />)}
      </div>

      {others.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="bg-muted/50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Таърих</div>
          {others.map((r: any) => <Row key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function RequestForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { t } = useT();
  const { formatMoney } = usePrefs();
  const [floorId, setFloorId] = useState<string>("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [approverId, setApproverId] = useState<string>("");

  const catLabel = (v: string) => {
    const c = EXPENSE_CATEGORIES.find((x) => x.value === v);
    return c ? t(c.labelKey as any) : v;
  };

  const { data: floors = [] } = useQuery({
    queryKey: ["floors-simple", projectId],
    queryFn: async () =>
      (await supabase.from("floors").select("id, floor_number").eq("project_id", projectId).order("floor_number")).data ?? [],
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["project-budgets", projectId],
    queryFn: async () =>
      ((await (supabase as any).from("project_budgets").select("*").eq("project_id", projectId)).data ?? []) as any[],
  });

  const { data: approvers } = useQuery({
    queryKey: ["funding-approvers", projectId],
    queryFn: () => listApprovers({ data: { project_id: projectId } }),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-floor", projectId],
    queryFn: async () =>
      ((await supabase.from("expenses").select("amount, category, floor_id").eq("project_id", projectId)).data ?? []) as any[],
  });

  // Categories that have a budget for the chosen floor, with remaining balance.
  const options = useMemo(() => {
    const fid = floorId || null;
    return (REQUEST_CATEGORIES as readonly string[]).map((cat) => {
      const b = budgets.find((x: any) => x.category === cat && (x.floor_id ?? null) === fid);
      if (!b) return null;
      const spent = expenses
        .filter((e: any) => e.category === cat && (e.floor_id ?? null) === fid)
        .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      return {
        cat,
        planned: Number(b.planned_amount || 0),
        remaining: Number(b.planned_amount || 0) - spent,
        unit: (b.unit as string) || "",
        unitPrice: Number(b.unit_price || 0),
      };
    }).filter(Boolean) as Array<{ cat: string; planned: number; remaining: number; unit: string; unitPrice: number }>;
  }, [budgets, expenses, floorId]);

  const amountOf = (cat: string) => {
    const q = Number(qtys[cat]);
    const p = Number(prices[cat]);
    if (q > 0 && p > 0) return Math.round(q * p * 100) / 100;
    return Number(amounts[cat]) || 0;
  };

  const picked = options.filter((o) => amountOf(o.cat) > 0);
  const overs = picked.filter((o) => amountOf(o.cat) > o.remaining + 0.005);
  const total = picked.reduce((s, o) => s + amountOf(o.cat), 0);

  const save = useMutation({
    mutationFn: async () => {
      for (const o of picked) {
        const q = Number(qtys[o.cat]);
        const p = Number(prices[o.cat]);
        const detail = q > 0 && p > 0 ? `${q} ${o.unit || ""} × ${p}` : "";
        const fullNote = [note.trim(), detail].filter(Boolean).join(" — ");
        await createFundingRequest({
          data: {
            project_id: projectId,
            floor_id: floorId || null,
            category: o.cat,
            amount: amountOf(o.cat),
            note: fullNote || null,
            approver_ids: [approverId],
          },
        });
      }
    },
    onSuccess: () => { toast.success("Заявка фиристода шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (cat: string, on: boolean) =>
    setAmounts((prev) => {
      const next = { ...prev };
      if (on) {
        next[cat] = next[cat] ?? "";
        const o = options.find((x) => x.cat === cat);
        if (o?.unitPrice) setPrices((p) => ({ ...p, [cat]: p[cat] ?? String(o.unitPrice) }));
      } else {
        delete next[cat];
        setQtys((p) => { const n = { ...p }; delete n[cat]; return n; });
        setPrices((p) => { const n = { ...p }; delete n[cat]; return n; });
      }
      return next;
    });


  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="space-y-1.5">
        <Label>Этаж</Label>
        <Select value={floorId || "__all__"} onValueChange={(v) => { setFloorId(v === "__all__" ? "" : v); setAmounts({}); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Умумӣ (бе этаж)</SelectItem>
            {floors.map((f: any) => <SelectItem key={f.id} value={f.id}>Этаж {f.floor_number}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Категорияҳо (метавон якчандтоашро интихоб кард)</Label>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-2">
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">Барои ин этаж ҳанӯз буджет таъин нашудааст.</p>
          )}
          {options.map((o) => {
            const on = amounts[o.cat] !== undefined;
            const amt = amountOf(o.cat);
            const over = amt > o.remaining + 0.005;
            const auto = Number(qtys[o.cat]) > 0 && Number(prices[o.cat]) > 0;
            return (
              <div key={o.cat} className="space-y-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={on} onCheckedChange={(v) => toggle(o.cat, !!v)} />
                  <span className="flex-1">{catLabel(o.cat)}</span>
                  <span className="text-xs text-muted-foreground">бақия {formatMoney(o.remaining)}</span>
                </label>
                {on && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder={o.unit ? `Миқдор (${o.unit})` : "Миқдор"}
                        value={qtys[o.cat] ?? ""}
                        onChange={(e) => setQtys((p) => ({ ...p, [o.cat]: e.target.value }))}
                      />
                      <Input
                        type="number"
                        step="any"
                        placeholder={o.unit ? `Нарх барои 1 ${o.unit}` : "Нарх барои 1"}
                        value={prices[o.cat] ?? ""}
                        onChange={(e) => setPrices((p) => ({ ...p, [o.cat]: e.target.value }))}
                      />
                    </div>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Сумма"
                      readOnly={auto}
                      value={auto ? String(amt) : (amounts[o.cat] ?? "")}
                      onChange={(e) => setAmounts((p) => ({ ...p, [o.cat]: e.target.value }))}
                    />
                    {auto && (
                      <p className="text-xs text-muted-foreground">
                        {qtys[o.cat]} {o.unit} × {formatMoney(Number(prices[o.cat]))} = {formatMoney(amt)}
                      </p>
                    )}
                    {over && <p className="text-xs text-destructive">Аз бақия зиёд: {formatMoney(o.remaining)}</p>}
                  </>
                )}
              </div>
            );
          })}

        </div>
        {picked.length > 0 && (
          <p className="text-xs text-muted-foreground">Ҳамагӣ: {formatMoney(total)}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Масъул</Label>
        <Select value={approverId} onValueChange={setApproverId}>
          <SelectTrigger><SelectValue placeholder="Масъулро интихоб кунед" /></SelectTrigger>
          <SelectContent>
            {(approvers?.users ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.fullname}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5"><Label>Тавзеҳ</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>

      <DialogFooter>
        <Button type="submit" disabled={!approverId || picked.length === 0 || overs.length > 0 || save.isPending}>
          Фиристодан
        </Button>
      </DialogFooter>
    </form>
  );
}

