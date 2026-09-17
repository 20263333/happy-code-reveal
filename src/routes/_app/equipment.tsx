import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Clock, Fuel, Wrench, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTabGate } from "@/lib/use-tab-gate";
import { EQUIPMENT_TAB_KEYS } from "@/lib/app-pages";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_app/equipment")({
  head: () => ({ meta: [{ title: "Техника — Binosoz.tj" }] }),
  component: EquipmentPage,
});

const KINDS = [
  { v: "crane", l: "Кран" },
  { v: "excavator", l: "Экскаватор" },
  { v: "mixer", l: "Миксер" },
  { v: "loader", l: "Погрузчик" },
  { v: "truck", l: "Мошини боркаш" },
  { v: "generator", l: "Генератор" },
  { v: "other", l: "Дигар" },
];

function EquipmentPage() {
  const { isOwner, isDirector, companyId } = useAuth();
  const tabOk = useTabGate();
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();
  const canModify = !isDirector;
  const [open, setOpen] = useState(false);
  const [useOpen, setUseOpen] = useState<any>(null);
  const [maintOpen, setMaintOpen] = useState<any>(null);
  const [form, setForm] = useState({ name: "", kind: "other", plate_number: "", ownership: "own", rate_per_hour: "0", rate_per_day: "0", fuel_per_hour: "0", note: "" });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("equipment").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lite", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: usage = [] } = useQuery({
    queryKey: ["equipment-usage", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("equipment_usage")
        .select("*, equipment:equipment(name), project:projects(name)")
        .order("usage_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: maint = [] } = useQuery({
    queryKey: ["equipment-maintenance", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("equipment_maintenance")
        .select("*, equipment:equipment(name)")
        .order("maintenance_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Ном лозим");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("equipment").insert({
        company_id: companyId, name: form.name, kind: form.kind, plate_number: form.plate_number,
        ownership: form.ownership, rate_per_hour: Number(form.rate_per_hour) || 0,
        rate_per_day: Number(form.rate_per_day) || 0, fuel_per_hour: Number(form.fuel_per_hour) || 0,
        note: form.note, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Илова шуд"); setOpen(false);
      setForm({ name: "", kind: "other", plate_number: "", ownership: "own", rate_per_hour: "0", rate_per_day: "0", fuel_per_hour: "0", note: "" });
      qc.invalidateQueries({ queryKey: ["equipment", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ҳазф шуд"); qc.invalidateQueries({ queryKey: ["equipment", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalHours = usage.reduce((s: number, u: any) => s + Number(u.hours || 0), 0);
  const totalFuel = usage.reduce((s: number, u: any) => s + Number(u.fuel_liters || 0), 0);
  const totalCost = usage.reduce((s: number, u: any) => s + Number(u.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Техника ва мошинҳо" subtitle="Идоракунии крану экскаваторҳо, ҳисоби соатҳо, сӯзишворӣ, таъмир" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Техника" value={String(equipment.length)} icon={Truck} />
        <StatCard label="Умумӣ соат" value={totalHours.toFixed(1)} icon={Clock} />
        <StatCard label="Сӯзишворӣ (л)" value={totalFuel.toFixed(1)} icon={Fuel} accent="warning" />
        <StatCard label="Ҳароҷоти умумӣ" value={formatMoney(totalCost)} icon={Wrench} accent="destructive" />
      </div>

      <Tabs defaultValue={([["list", EQUIPMENT_TAB_KEYS.list], ["usage", EQUIPMENT_TAB_KEYS.usage], ["maint", EQUIPMENT_TAB_KEYS.maint]] as const).find(([, k]) => tabOk(k))?.[0]}>
        <TabsList>
          {tabOk(EQUIPMENT_TAB_KEYS.list) && <TabsTrigger value="list">Рӯйхати техника</TabsTrigger>}
          {tabOk(EQUIPMENT_TAB_KEYS.usage) && <TabsTrigger value="usage">Истифодабарӣ</TabsTrigger>}
          {tabOk(EQUIPMENT_TAB_KEYS.maint) && <TabsTrigger value="maint">Таъмир</TabsTrigger>}
        </TabsList>

        {tabOk(EQUIPMENT_TAB_KEYS.list) && <TabsContent value="list" className="pt-4 space-y-3">
          {canModify && <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Илова</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Техникаи нав</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Ном *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Навъ</Label>
                      <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Моликият</Label>
                      <Select value={form.ownership} onValueChange={(v) => setForm({ ...form, ownership: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">Худӣ</SelectItem>
                          <SelectItem value="rent">Иҷора</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Рақами давлатӣ</Label><Input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Нархи соатӣ</Label><Input type="number" value={form.rate_per_hour} onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })} /></div>
                    <div><Label>Нархи рӯзона</Label><Input type="number" value={form.rate_per_day} onChange={(e) => setForm({ ...form, rate_per_day: e.target.value })} /></div>
                    <div><Label>Солярка л/соат</Label><Input type="number" step="0.1" value={form.fuel_per_hour} onChange={(e) => setForm({ ...form, fuel_per_hour: e.target.value })} /></div>
                  </div>
                  <div><Label>Эзоҳ</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Сабт</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>}

          {equipment.length === 0 ? (
            <EmptyState icon={Truck} title="Техника нест" description="Илова кунед" />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Ном</th>
                    <th className="px-4 py-3 text-left">Навъ</th>
                    <th className="px-4 py-3 text-left">Рақам</th>
                    <th className="px-4 py-3 text-left">Моликият</th>
                    <th className="px-4 py-3 text-right">Соатӣ</th>
                    <th className="px-4 py-3 text-right">Рӯзона</th>
                    {canModify && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((e: any) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{KINDS.find(k => k.v === e.kind)?.l}</Badge></td>
                      <td className="px-4 py-3">{e.plate_number || "—"}</td>
                      <td className="px-4 py-3"><Badge variant={e.ownership === "own" ? "default" : "secondary"}>{e.ownership === "own" ? "Худӣ" : "Иҷора"}</Badge></td>
                      <td className="px-4 py-3 text-right">{formatMoney(e.rate_per_hour)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(e.rate_per_day)}</td>
                      {canModify && (
                        <td className="px-4 py-3 text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setUseOpen(e)}>Истифода</Button>
                          <Button size="sm" variant="outline" onClick={() => setMaintOpen(e)}>Таъмир</Button>
                          {isOwner && <Button size="sm" variant="ghost" onClick={() => confirm(`Ҳазф "${e.name}"?`) && del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {tabOk(EQUIPMENT_TAB_KEYS.usage) && <TabsContent value="usage" className="pt-4">
          {usage.length === 0 ? <EmptyState icon={Clock} title="Ҳанӯз истифода нашудааст" /> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Сана</th>
                    <th className="px-4 py-3 text-left">Техника</th>
                    <th className="px-4 py-3 text-left">Лоиҳа</th>
                    <th className="px-4 py-3 text-right">Соат</th>
                    <th className="px-4 py-3 text-right">Солярка</th>
                    <th className="px-4 py-3 text-left">Оператор</th>
                    <th className="px-4 py-3 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u: any) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-4 py-3">{formatDate(u.usage_date)}</td>
                      <td className="px-4 py-3 font-medium">{u.equipment?.name}</td>
                      <td className="px-4 py-3">{u.project?.name}</td>
                      <td className="px-4 py-3 text-right">{u.hours}</td>
                      <td className="px-4 py-3 text-right">{u.fuel_liters}</td>
                      <td className="px-4 py-3">{u.operator_name || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(u.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {tabOk(EQUIPMENT_TAB_KEYS.maint) && <TabsContent value="maint" className="pt-4">
          {maint.length === 0 ? <EmptyState icon={Wrench} title="Таъмир нест" /> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Сана</th>
                    <th className="px-4 py-3 text-left">Техника</th>
                    <th className="px-4 py-3 text-left">Тавсиф</th>
                    <th className="px-4 py-3 text-right">Ҳароҷот</th>
                  </tr>
                </thead>
                <tbody>
                  {maint.map((m: any) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3">{formatDate(m.maintenance_date)}</td>
                      <td className="px-4 py-3 font-medium">{m.equipment?.name}</td>
                      <td className="px-4 py-3">{m.description}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}
      </Tabs>

      {canModify && useOpen && <UsageDialog eq={useOpen} projects={projects} onClose={() => setUseOpen(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["equipment-usage", companyId] })} />}
      {canModify && maintOpen && <MaintDialog eq={maintOpen} onClose={() => setMaintOpen(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["equipment-maintenance", companyId] })} />}
    </div>
  );
}

function UsageDialog({ eq, projects, onClose, onSaved }: any) {
  const [projectId, setProjectId] = useState("");
  const [hours, setHours] = useState("8");
  const [fuel, setFuel] = useState(String(Number(eq.fuel_per_hour || 0) * 8));
  const [operator, setOperator] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const amount = Number(hours || 0) * Number(eq.rate_per_hour || 0);

  const save = async () => {
    if (!projectId) return toast.error("Лоиҳаро интихоб кунед");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("equipment_usage").insert({
      equipment_id: eq.id, project_id: projectId, usage_date: date,
      hours: Number(hours) || 0, fuel_liters: Number(fuel) || 0,
      operator_name: operator, amount, created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сабт шуд, ба хароҷот илова гардид");
    onSaved(); onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Истифодабарӣ — {eq.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Лоиҳа *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Сана</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Оператор</Label><Input value={operator} onChange={(e) => setOperator(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Соат</Label><Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
            <div><Label>Солярка л</Label><Input type="number" value={fuel} onChange={(e) => setFuel(e.target.value)} /></div>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            Ҳисоб: <strong>{amount.toLocaleString()} сом.</strong> ({hours} соат × {eq.rate_per_hour} сом./соат)
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>Сабт</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintDialog({ eq, onClose, onSaved }: any) {
  const [desc, setDesc] = useState("");
  const [cost, setCost] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!desc) return toast.error("Тавсиф лозим");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("equipment_maintenance").insert({
      equipment_id: eq.id, maintenance_date: date, description: desc,
      cost: Number(cost) || 0, created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сабт шуд"); onSaved(); onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Таъмир — {eq.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Сана</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Тавсиф *</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label>Ҳароҷот</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>Сабт</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
