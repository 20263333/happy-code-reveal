import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Plus, AlertTriangle, ShieldCheck, ClipboardCheck, Trash2, Upload, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTabGate } from "@/lib/use-tab-gate";
import { PERMITS_TAB_KEYS } from "@/lib/app-pages";
import { toast } from "sonner";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_app/permits")({
  head: () => ({ meta: [{ title: "Иҷозатнома ва Актҳо — Binosoz.tj" }] }),
  component: PermitsPage,
});

function PermitsPage() {
  const { companyId, isOwner, isDirector } = useAuth();
  const tabOk = useTabGate();
  const qc = useQueryClient();
  const canModify = !isDirector;

  const { data: permits = [] } = useQuery({
    queryKey: ["permits", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("permits").select("*, project:projects(name)").eq("company_id", companyId).order("expires_at", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: acts = [] } = useQuery({
    queryKey: ["hidden-acts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("hidden_work_acts").select("*, project:projects(name)").eq("company_id", companyId).order("act_date", { ascending: false });
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

  const today = new Date();
  const expiring = permits.filter((p: any) => {
    if (!p.expires_at) return false;
    const d = Math.round((new Date(p.expires_at).getTime() - today.getTime()) / 86400000);
    return d >= 0 && d <= (p.reminder_days ?? 30);
  });
  const expired = permits.filter((p: any) => p.expires_at && new Date(p.expires_at) < today);

  return (
    <div className="space-y-6">
      <PageHeader title="Иҷозатномаҳо ва Актҳо" subtitle="Иҷозатҳо бо reminder + Актҳои корҳои пинҳонӣ" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Иҷозатномаҳо" value={String(permits.length)} icon={FileText} />
        <StatCard label="Ба зудӣ мӯҳлат" value={String(expiring.length)} icon={AlertTriangle} accent="warning" />
        <StatCard label="Мӯҳлат гузашт" value={String(expired.length)} icon={AlertTriangle} accent="destructive" />
        <StatCard label="Актҳои пинҳонӣ" value={String(acts.length)} icon={ClipboardCheck} accent="accent" />
      </div>

      <Tabs defaultValue={([["permits", PERMITS_TAB_KEYS.permits], ["acts", PERMITS_TAB_KEYS.acts]] as const).find(([, k]) => tabOk(k))?.[0]}>
        <TabsList>
          {tabOk(PERMITS_TAB_KEYS.permits) && <TabsTrigger value="permits">Иҷозатномаҳо</TabsTrigger>}
          {tabOk(PERMITS_TAB_KEYS.acts) && <TabsTrigger value="acts">Актҳои пинҳонӣ</TabsTrigger>}
        </TabsList>

        {tabOk(PERMITS_TAB_KEYS.permits) && <TabsContent value="permits" className="pt-4 space-y-3">
          {canModify && <PermitForm projects={projects} companyId={companyId} onSaved={() => qc.invalidateQueries({ queryKey: ["permits", companyId] })} />}

          {permits.length === 0 ? <EmptyState icon={ShieldCheck} title="Иҷозатнома нест" /> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Ном</th>
                    <th className="px-4 py-3 text-left">Рақам</th>
                    <th className="px-4 py-3 text-left">Мақомот</th>
                    <th className="px-4 py-3 text-left">Лоиҳа</th>
                    <th className="px-4 py-3 text-left">Мӯҳлат</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((p: any) => {
                    const days = p.expires_at ? Math.round((new Date(p.expires_at).getTime() - today.getTime()) / 86400000) : null;
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3">{p.permit_number || "—"}</td>
                        <td className="px-4 py-3 text-xs">{p.authority || "—"}</td>
                        <td className="px-4 py-3 text-xs">{p.project?.name || "—"}</td>
                        <td className="px-4 py-3">
                          {p.expires_at ? formatDate(p.expires_at) : "—"}
                          {days !== null && days < 0 && <Badge variant="destructive" className="ml-2 text-[10px]">гузашт</Badge>}
                          {days !== null && days >= 0 && days <= (p.reminder_days ?? 30) && (
                            <Badge className="ml-2 text-[10px] bg-warning/30 text-warning-foreground">{days} рӯз</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                           {isOwner && canModify && <Button size="sm" variant="ghost" onClick={async () => {
                            if (!confirm("Ҳазф?")) return;
                            await (supabase as any).from("permits").delete().eq("id", p.id);
                            qc.invalidateQueries({ queryKey: ["permits", companyId] });
                          }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {tabOk(PERMITS_TAB_KEYS.acts) && <TabsContent value="acts" className="pt-4 space-y-3">
          {canModify && <ActForm projects={projects} companyId={companyId} onSaved={() => qc.invalidateQueries({ queryKey: ["hidden-acts", companyId] })} />}

          {acts.length === 0 ? <EmptyState icon={ClipboardCheck} title="Акт нест" description="Актҳои корҳои пинҳонӣ илова кунед" /> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">№ акт</th>
                    <th className="px-4 py-3 text-left">Сана</th>
                    <th className="px-4 py-3 text-left">Лоиҳа</th>
                    <th className="px-4 py-3 text-left">Тавсиф</th>
                    <th className="px-4 py-3 text-left">Ҷой</th>
                    <th className="px-4 py-3 text-left">Имзоҳо</th>
                  </tr>
                </thead>
                <tbody>
                  {acts.map((a: any) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{a.act_number}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(a.act_date)}</td>
                      <td className="px-4 py-3 text-xs">{a.project?.name || "—"}</td>
                      <td className="px-4 py-3 max-w-md truncate">{a.work_description}</td>
                      <td className="px-4 py-3 text-xs">{a.location || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {a.contractor_signature && <Badge variant="outline" className="mr-1 text-[10px]">Пудратчӣ ✓</Badge>}
                        {a.customer_signature && <Badge variant="outline" className="text-[10px]">Мизоҷ ✓</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}
      </Tabs>
    </div>
  );
}

function PermitForm({ projects, companyId, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", permit_number: "", authority: "", project_id: "", issued_date: "", expires_at: "", reminder_days: "30", note: "" });

  const save = async () => {
    if (!f.name) return toast.error("Ном лозим");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("permits").insert({
      company_id: companyId, name: f.name, permit_number: f.permit_number, authority: f.authority,
      project_id: f.project_id || null,
      issued_date: f.issued_date || null, expires_at: f.expires_at || null,
      reminder_days: Number(f.reminder_days) || 30, note: f.note, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Илова шуд"); setOpen(false);
    setF({ name: "", permit_number: "", authority: "", project_id: "", issued_date: "", expires_at: "", reminder_days: "30", note: "" });
    onSaved();
  };

  return (
    <div className="flex justify-end">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Иҷозатнома</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Иҷозатномаи нав</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Ном *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Рақам</Label><Input value={f.permit_number} onChange={(e) => setF({ ...f, permit_number: e.target.value })} /></div>
              <div><Label>Мақомот</Label><Input value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} placeholder="Комитет..." /></div>
            </div>
            <div>
              <Label>Лоиҳа</Label>
              <Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Санаи додашуда</Label><Input type="date" value={f.issued_date} onChange={(e) => setF({ ...f, issued_date: e.target.value })} /></div>
              <div><Label>Мӯҳлат</Label><Input type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
              <div><Label>Reminder (рӯз)</Label><Input type="number" value={f.reminder_days} onChange={(e) => setF({ ...f, reminder_days: e.target.value })} /></div>
            </div>
            <div><Label>Эзоҳ</Label><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Сабт</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActForm({ projects, companyId, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ act_number: "", project_id: "", work_description: "", location: "", materials_used: "", act_date: new Date().toISOString().slice(0, 10), contractor_signature: "", customer_signature: "", inspector_name: "" });

  const save = async () => {
    if (!f.act_number || !f.project_id || !f.work_description) return toast.error("Майдонҳои * лозим");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("hidden_work_acts").insert({
      company_id: companyId, project_id: f.project_id, act_number: f.act_number,
      work_description: f.work_description, location: f.location, materials_used: f.materials_used,
      act_date: f.act_date, contractor_signature: f.contractor_signature,
      customer_signature: f.customer_signature, inspector_name: f.inspector_name, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Илова шуд"); setOpen(false); onSaved();
    setF({ act_number: "", project_id: "", work_description: "", location: "", materials_used: "", act_date: new Date().toISOString().slice(0, 10), contractor_signature: "", customer_signature: "", inspector_name: "" });
  };

  return (
    <div className="flex justify-end">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Акт</Button></DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Акти корҳои пинҳонӣ (нав)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>№ акт *</Label><Input value={f.act_number} onChange={(e) => setF({ ...f, act_number: e.target.value })} placeholder="АКТ-001" /></div>
              <div><Label>Сана</Label><Input type="date" value={f.act_date} onChange={(e) => setF({ ...f, act_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>Лоиҳа *</Label>
              <Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Тавсифи кор *</Label><Textarea value={f.work_description} onChange={(e) => setF({ ...f, work_description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ҷой (ошёна, блок)</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
              <div><Label>Нозир</Label><Input value={f.inspector_name} onChange={(e) => setF({ ...f, inspector_name: e.target.value })} /></div>
            </div>
            <div><Label>Маводҳо</Label><Input value={f.materials_used} onChange={(e) => setF({ ...f, materials_used: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Имзои пудратчӣ</Label><Input value={f.contractor_signature} onChange={(e) => setF({ ...f, contractor_signature: e.target.value })} placeholder="ФИО" /></div>
              <div><Label>Имзои мизоҷ</Label><Input value={f.customer_signature} onChange={(e) => setF({ ...f, customer_signature: e.target.value })} placeholder="ФИО" /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Сабт</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
