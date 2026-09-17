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
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, Users, CheckCircle2, Phone, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/subcontractors")({
  head: () => ({ meta: [{ title: "Пудратчиён — PLATFORM.TJ" }] }),
  component: SubcontractorsPage,
});

const SPECIALTIES = [
  { v: "general", l: "Умумӣ" },
  { v: "concrete", l: "Бетонщик" },
  { v: "electric", l: "Электрик" },
  { v: "plumbing", l: "Сантехник" },
  { v: "welding", l: "Кафшергар" },
  { v: "finishing", l: "Ремонт/Отделка" },
  { v: "roofing", l: "Бомпӯш" },
  { v: "other", l: "Дигар" },
];

function SubcontractorsPage() {
  const { isOwner, isDirector, companyId } = useAuth();
  const qc = useQueryClient();
  const canModify = !isDirector;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ brigade_name: "", foreman_name: "", specialty: "general", phone: "", inn: "", note: "" });

  const { data: list = [] } = useQuery({
    queryKey: ["subcontractors", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("subcontractors")
        .select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: works = [] } = useQuery({
    queryKey: ["all-subcontract-works", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("subcontract_works")
        .select("*, project:projects(name), subcontractor:subcontractors(brigade_name)")
        .eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.brigade_name) throw new Error("Номи бригада лозим");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("subcontractors").insert({
        ...form, company_id: companyId, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Бригада илова шуд");
      setOpen(false);
      setForm({ brigade_name: "", foreman_name: "", specialty: "general", phone: "", inn: "", note: "" });
      qc.invalidateQueries({ queryKey: ["subcontractors", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("subcontractors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ҳазф шуд");
      qc.invalidateQueries({ queryKey: ["subcontractors", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeWorks = works.filter((w: any) => w.status === "active").length;
  const totalContractValue = works.reduce((s: number, w: any) => s + Number(w.contract_amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Пудратчиён (Бригадаҳо)" subtitle="Идоракунии бригадаҳо, КС-2 / КС-3 актҳо, пардохт" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Бригадаҳо" value={String(list.length)} icon={Users} />
        <StatCard label="Шартномаҳои фаъол" value={String(activeWorks)} icon={CheckCircle2} accent="success" />
        <StatCard label="Ҳаҷми умумии шартномаҳо" value={totalContractValue.toLocaleString() + " сом."} icon={Wrench} accent="warning" />
      </div>

      {canModify && <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Илова кардани бригада</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Бригадаи нав</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Номи бригада *</Label><Input value={form.brigade_name} onChange={(e) => setForm({ ...form, brigade_name: e.target.value })} /></div>
              <div><Label>Роҳбари бригада</Label><Input value={form.foreman_name} onChange={(e) => setForm({ ...form, foreman_name: e.target.value })} /></div>
              <div>
                <Label>Ихтисос</Label>
                <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Телефон</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>ИНН</Label><Input value={form.inn} onChange={(e) => setForm({ ...form, inn: e.target.value })} /></div>
              </div>
              <div><Label>Эзоҳ</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Сабт</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>}

      {list.length === 0 ? (
        <EmptyState icon={Wrench} title="Бригадаҳо ҳоло нестанд" description="Бригадаи нав илова кунед" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Бригада</th>
                <th className="px-4 py-3 text-left">Ихтисос</th>
                <th className="px-4 py-3 text-left">Роҳбар</th>
                <th className="px-4 py-3 text-left">Телефон</th>
                <th className="px-4 py-3 text-left">ИНН</th>
                {isOwner && canModify && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{s.brigade_name}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{SPECIALTIES.find(x => x.v === s.specialty)?.l ?? s.specialty}</Badge></td>
                  <td className="px-4 py-3">{s.foreman_name || "—"}</td>
                  <td className="px-4 py-3">{s.phone ? <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{s.phone}</a> : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.inn || "—"}</td>
                  {isOwner && canModify && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => confirm(`Ҳазф кардани "${s.brigade_name}"?`) && del.mutate(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Шартномаҳои иҷрошавандаи бригадаҳо</h3>
        {works.length === 0 ? (
          <p className="text-sm text-muted-foreground">Шартномаҳо дар лоиҳаҳо кушода нашудаанд. Дар саҳифаи лоиҳа → таб "Пудратчӣ" илова кунед.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Лоиҳа</th>
                <th className="px-2 py-2 text-left">Бригада</th>
                <th className="px-2 py-2 text-left">Кор</th>
                <th className="px-2 py-2 text-right">План</th>
                <th className="px-2 py-2 text-right">Иҷро</th>
                <th className="px-2 py-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w: any) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-2 py-2">{w.project?.name}</td>
                  <td className="px-2 py-2 font-medium">{w.subcontractor?.brigade_name}</td>
                  <td className="px-2 py-2">{w.work_name}</td>
                  <td className="px-2 py-2 text-right">{w.planned_qty} {w.unit}</td>
                  <td className="px-2 py-2 text-right">{w.done_qty} {w.unit}</td>
                  <td className="px-2 py-2 text-right font-semibold">{Number(w.contract_amount).toLocaleString()} сом.</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
