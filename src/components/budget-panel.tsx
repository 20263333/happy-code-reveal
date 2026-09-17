import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { StatCard } from "@/components/page-header";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, AlertTriangle } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

function categoryLabel(v: string, t: (k: any) => string): string {
  const c = EXPENSE_CATEGORIES.find((x) => x.value === v);
  return c ? t(c.labelKey) : v;
}

export function BudgetPanel({ projectId, companyId, canEdit, totalSales, totalExpenses, expenses }: {
  projectId: string; companyId: string | null; canEdit: boolean;
  totalSales: number; totalExpenses: number; expenses: any[];
}) {
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();
  const [addOpen, setAddOpen] = useState(false);

  const { data: budgets = [] } = useQuery({
    queryKey: ["project-budgets", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("project_budgets")
        .select("*").eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: floors = [] } = useQuery({
    queryKey: ["floors-simple", projectId],
    queryFn: async () =>
      (await supabase.from("floors").select("id, floor_number").eq("project_id", projectId).order("floor_number")).data ?? [],
  });

  const floorLabel = (id: string | null) => {
    if (!id) return "Умумӣ (бе этаж)";
    const f = (floors as any[]).find((x) => x.id === id);
    return f ? `Этаж ${f.floor_number}` : "Этаж";
  };

  // Group expenses by floor + category
  const key = (floorId: string | null, cat: string) => `${floorId ?? ""}|${cat}`;
  const factByCat = new Map<string, number>();
  for (const e of expenses) {
    const k = key(e.floor_id ?? null, e.category);
    factByCat.set(k, (factByCat.get(k) || 0) + Number(e.amount || 0));
  }

  const profit = totalSales - totalExpenses;
  const totalPlanned = budgets.reduce((s: number, b: any) => s + Number(b.planned_amount || 0), 0);

  // Build combined rows: all budget entries + any expense buckets not yet budgeted
  const allKeys = new Set<string>();
  budgets.forEach((b: any) => allKeys.add(key(b.floor_id ?? null, b.category)));
  factByCat.forEach((_, k) => allKeys.add(k));

  const rows = Array.from(allKeys).map((k) => {
    const [fidRaw, cat] = k.split("|");
    const floorId = fidRaw || null;
    const b = budgets.find((x: any) => x.category === cat && (x.floor_id ?? null) === floorId);
    const planned = Number(b?.planned_amount || 0);
    const fact = factByCat.get(k) || 0;
    const diff = planned - fact;
    const pct = planned > 0 ? Math.round((fact / planned) * 100) : (fact > 0 ? 100 : 0);
    const qty = b?.quantity != null ? Number(b.quantity) : null;
    const unit = b?.unit ?? null;
    return { key: k, cat, floorId, planned, fact, diff, pct, qty, unit, budgetId: b?.id ?? null };
  }).sort((a, b) => {
    const fn = (id: string | null) => {
      if (!id) return Number.POSITIVE_INFINITY; // rows without floor go last
      const f = (floors as any[]).find((x) => x.id === id);
      return f ? Number(f.floor_number) : Number.POSITIVE_INFINITY;
    };
    const d = fn(a.floorId) - fn(b.floorId);
    if (d !== 0) return d;
    return b.fact - a.fact;
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("project_budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Хориҷ шуд"); qc.invalidateQueries({ queryKey: ["project-budgets", projectId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { t } = useT();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Даромад (факт)" value={formatMoney(totalSales)} icon={TrendingUp} accent="success" />
        <StatCard label="Хароҷот (факт)" value={formatMoney(totalExpenses)} icon={TrendingDown} accent="warning" />
        <StatCard label="Фоидаи соф" value={formatMoney(profit)} icon={Wallet} accent={profit >= 0 ? "success" : "destructive"} />
        <StatCard label="Буджети умумӣ" value={formatMoney(totalPlanned)} icon={Wallet} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Буджет vs Факт аз рӯи категорияҳо</h3>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Илова / Тағйир</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Буджети категория</DialogTitle></DialogHeader>
              <BudgetForm projectId={projectId} companyId={companyId} existing={budgets}
                onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["project-budgets", projectId] }); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          Ҳоло на буджет илова шудааст, на хароҷот. Буджет илова кунед, то муқоиса намоён шавад.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Этаж</th>
                <th className="px-4 py-3 text-left">Категория</th>
                <th className="px-4 py-3 text-right">Миқдор</th>
                <th className="px-4 py-3 text-right">План</th>
                <th className="px-4 py-3 text-right">Факт</th>
                <th className="px-4 py-3 text-right">Фарқ</th>
                <th className="px-4 py-3 text-left w-48">Иҷроиш</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overBudget = r.planned > 0 && r.fact > r.planned;
                const near = r.planned > 0 && r.pct >= 80 && r.pct <= 100;
                return (
                  <tr key={r.key} className={cn("border-t border-border", overBudget && "bg-destructive/5")}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{floorLabel(r.floorId)}</td>
                    <td className="px-4 py-3 font-medium">
                      {categoryLabel(r.cat, t)}
                      {overBudget && <AlertTriangle className="inline h-4 w-4 ml-2 text-destructive" />}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                      {r.qty ? `${r.qty} ${r.unit ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.planned > 0 ? formatMoney(r.planned) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(r.fact)}</td>
                    <td className={cn("px-4 py-3 text-right font-semibold", r.diff < 0 ? "text-destructive" : "text-success")}>
                      {r.planned > 0 ? formatMoney(r.diff) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.planned > 0 ? (
                        <div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full transition-all",
                              overBudget ? "bg-destructive" : near ? "bg-warning" : "bg-success")}
                              style={{ width: `${Math.min(100, r.pct)}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{r.pct}%</div>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">буджет нест</span>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        {r.budgetId && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm("Хориҷ кардан?")) del.mutate(r.budgetId!); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetForm({ projectId, companyId, existing, onDone }: {
  projectId: string; companyId: string | null; existing: any[]; onDone: () => void;
}) {
  const { t } = useT();
  const { formatMoney } = usePrefs();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].value);
  const [floorId, setFloorId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [unit, setUnit] = useState<string>("шт");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const computed = (Number(qty) || 0) * (Number(unitPrice) || 0);
  const effectiveAmount = computed > 0 ? computed : Number(amount) || 0;

  const { data: floors = [] } = useQuery({
    queryKey: ["floors-simple", projectId],
    queryFn: async () =>
      (await supabase.from("floors").select("id, floor_number").eq("project_id", projectId).order("floor_number")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Ширкат ёфт нашуд");
      const amt = effectiveAmount;
      if (!amt || amt <= 0) throw new Error("Сумма нодуруст");
      const fid = floorId || null;
      const q = Number(qty) || null;
      const up = Number(unitPrice) || null;
      const { data: { user } } = await supabase.auth.getUser();
      const found = existing.find((b: any) => b.category === category && (b.floor_id ?? null) === fid);
      if (found) {
        const { error } = await (supabase as any).from("project_budgets")
          .update({ planned_amount: amt, note: note.trim() || null, quantity: q, unit: q ? unit : null, unit_price: up }).eq("id", found.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("project_budgets").insert({
          project_id: projectId, company_id: companyId, category, floor_id: fid,
          planned_amount: amt, note: note.trim() || null, created_by: user?.id,
          quantity: q, unit: q ? unit : null, unit_price: up,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Захира шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="space-y-1.5"><Label>Этаж</Label>
        <Select value={floorId || "__all__"} onValueChange={(v) => setFloorId(v === "__all__" ? "" : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Умумӣ (бе этаж)</SelectItem>
            {(floors as any[]).map((f) => (
              <SelectItem key={f.id} value={f.id}>Этаж {f.floor_number}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Категория</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{categoryLabel(c.value, t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5"><Label>Миқдор</Label>
          <Input type="number" step="any" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="5" /></div>
        <div className="space-y-1.5"><Label>Воҳид</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["шт", "кг", "тонна", "м", "м²", "м³", "литр", "қоп"].map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Нархи 1 воҳид</Label>
          <Input type="number" step="any" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="1000" /></div>
      </div>
      <div className="space-y-1.5"><Label>Суммаи банақшагирифта</Label>
        <Input type="number" value={computed > 0 ? String(computed) : amount}
          onChange={(e) => setAmount(e.target.value)} readOnly={computed > 0} min={1} />
        {computed > 0 && (
          <p className="text-xs text-muted-foreground">
            {qty} {unit} × {formatMoney(Number(unitPrice) || 0)} = <span className="font-semibold text-foreground">{formatMoney(computed)}</span>
          </p>
        )}
      </div>
      <div className="space-y-1.5"><Label>Шарҳ</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <DialogFooter><Button type="submit" disabled={save.isPending}>Захира</Button></DialogFooter>
    </form>
  );
}
