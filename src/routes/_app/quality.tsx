import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Plus, CheckCircle2, XCircle, MapPin, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTabGate } from "@/lib/use-tab-gate";
import { QUALITY_TAB_KEYS } from "@/lib/app-pages";
import { toast } from "sonner";
import { formatDate } from "@/lib/constants";
import { ConstructionPhotosTab } from "@/components/construction-photos-tab";
import { MaterialActsTab } from "@/components/material-acts-tab";

export const Route = createFileRoute("/_app/quality")({
  head: () => ({ meta: [{ title: "Сифат ва Бехатарӣ — PLATFORM.TJ" }] }),
  component: QualityPage,
});

function QualityPage() {
  const { companyId, isDirector } = useAuth();
  const tabOk = useTabGate();
  const qc = useQueryClient();
  const [checkOpen, setCheckOpen] = useState(false);
  const [incOpen, setIncOpen] = useState(false);
  const canModify = !isDirector;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lite", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name, parent_id").eq("company_id", companyId).order("name");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ["quality-checks", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("quality_checks")
        .select("*, project:projects(name)").order("check_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["site-incidents", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("site_incidents")
        .select("*, project:projects(name)").order("incident_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const passed = checks.filter((c: any) => c.result === "passed").length;
  const failed = checks.filter((c: any) => c.result === "failed").length;
  const openInc = incidents.filter((i: any) => !i.resolved).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Сифат ва Бехатарӣ" subtitle="Санҷиши сифати кор, ҳодисаҳо, ва бехатарии меҳнат дар объект" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Санҷишҳо" value={String(checks.length)} icon={ShieldAlert} />
        <StatCard label="Қабулшуда" value={String(passed)} icon={CheckCircle2} accent="success" />
        <StatCard label="Радшуда" value={String(failed)} icon={XCircle} accent="destructive" />
        <StatCard label="Ҳодисаҳои кушода" value={String(openInc)} icon={AlertTriangle} accent="warning" />
      </div>

      <Tabs defaultValue={([["checks", QUALITY_TAB_KEYS.checks], ["incidents", QUALITY_TAB_KEYS.incidents], ["materials", QUALITY_TAB_KEYS.materials]] as const).find(([, k]) => tabOk(k))?.[0]}>
        <TabsList>
          {tabOk(QUALITY_TAB_KEYS.checks) && <TabsTrigger value="checks">Санҷиши сифат</TabsTrigger>}
          {tabOk(QUALITY_TAB_KEYS.incidents) && <TabsTrigger value="incidents">Ҳодисаҳо / Бехатарӣ</TabsTrigger>}
          {tabOk(QUALITY_TAB_KEYS.materials) && <TabsTrigger value="materials">Акти қабули мавод</TabsTrigger>}
          <TabsTrigger value="photos">Суратҳои объект</TabsTrigger>
        </TabsList>

        {tabOk(QUALITY_TAB_KEYS.materials) && <TabsContent value="materials" className="pt-4">
          <MaterialActsTab projects={projects} />
        </TabsContent>}

        <TabsContent value="photos" className="pt-4">
          <ConstructionPhotosTab projects={projects} />
        </TabsContent>

        {tabOk(QUALITY_TAB_KEYS.checks) && <TabsContent value="checks" className="pt-4 space-y-3">
          {canModify && <div className="flex justify-end">
            <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Санҷиши нав</Button></DialogTrigger>
              <CheckDialog projects={projects} onClose={() => setCheckOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["quality-checks", companyId] })} />
            </Dialog>
          </div>}
          {checks.length === 0 ? <EmptyState icon={ShieldAlert} title="Санҷиш нест" /> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Сана</th>
                    <th className="px-4 py-3 text-left">Лоиҳа</th>
                    <th className="px-4 py-3 text-left">Санҷиш</th>
                    <th className="px-4 py-3 text-left">Санҷанда</th>
                    <th className="px-4 py-3 text-left">Натиҷа</th>
                    <th className="px-4 py-3 text-left">Эрод</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c: any) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3">{formatDate(c.check_date)}</td>
                      <td className="px-4 py-3">{c.project?.name}</td>
                      <td className="px-4 py-3 font-medium">{c.check_name}</td>
                      <td className="px-4 py-3">{c.inspector || "—"}</td>
                      <td className="px-4 py-3">
                        {c.result === "passed" && <Badge className="bg-success text-success-foreground">Қабул</Badge>}
                        {c.result === "failed" && <Badge variant="destructive">Рад</Badge>}
                        {c.result === "pending" && <Badge variant="secondary">Дар ҷараён</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.issues || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>}

        {tabOk(QUALITY_TAB_KEYS.incidents) && <TabsContent value="incidents" className="pt-4 space-y-3">
          {canModify && <div className="flex justify-end">
            <Dialog open={incOpen} onOpenChange={setIncOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Ҳодисаи нав</Button></DialogTrigger>
              <IncidentDialog projects={projects} onClose={() => setIncOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["site-incidents", companyId] })} />
            </Dialog>
          </div>}
          {incidents.length === 0 ? <EmptyState icon={AlertTriangle} title="Ҳодиса нест" /> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Сана</th>
                    <th className="px-4 py-3 text-left">Лоиҳа</th>
                    <th className="px-4 py-3 text-left">Навъ</th>
                    <th className="px-4 py-3 text-left">Дараҷа</th>
                    <th className="px-4 py-3 text-left">Тавсиф</th>
                    <th className="px-4 py-3 text-left">GPS</th>
                    <th className="px-4 py-3 text-left">Ҳал</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((i: any) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-3">{formatDate(i.incident_date)}</td>
                      <td className="px-4 py-3">{i.project?.name}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{i.incident_type}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge variant={i.severity === "high" ? "destructive" : i.severity === "medium" ? "secondary" : "outline"}>
                          {i.severity === "high" ? "Баланд" : i.severity === "medium" ? "Миёна" : "Паст"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{i.description}</td>
                      <td className="px-4 py-3">
                        {i.latitude && i.longitude ? (
                          <a href={`https://www.google.com/maps?q=${i.latitude},${i.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <MapPin className="h-3 w-3" />Ҳарита
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {i.resolved ? <Badge className="bg-success text-success-foreground">Ҳалшуда</Badge> : <Badge variant="secondary">Кушода</Badge>}
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

function ZhkBlockSelect({ projects, value, onChange }: { projects: any[]; value: string; onChange: (v: string) => void }) {
  const zhkList = projects.filter((p) => !p.parent_id);
  const selected = projects.find((p) => p.id === value);
  const initialZhk = selected ? (selected.parent_id ?? selected.id) : "";
  const [zhkId, setZhkId] = useState<string>(initialZhk);
  const blockList = projects.filter((p) => p.parent_id === zhkId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>ЖК *</Label>
        <Select value={zhkId} onValueChange={(v) => {
          setZhkId(v);
          const hasBlocks = projects.some((p) => p.parent_id === v);
          onChange(hasBlocks ? "" : v);
        }}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{zhkList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Блок {projects.some((p) => p.parent_id === zhkId) ? "*" : ""}</Label>
        <Select value={value} onValueChange={onChange} disabled={!zhkId || blockList.length === 0}>
          <SelectTrigger><SelectValue placeholder={blockList.length ? "—" : "нест"} /></SelectTrigger>
          <SelectContent>{blockList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CheckDialog({ projects, onClose, onSaved }: any) {
  const [form, setForm] = useState({ project_id: "", check_name: "", inspector: "", result: "pending", issues: "", check_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.project_id || !form.check_name) return toast.error("Лоиҳа ва санҷиш лозим");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("quality_checks").insert({ ...form, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сабт шуд"); onSaved(); onClose();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Санҷиши сифат</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <ZhkBlockSelect projects={projects} value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })} />
        <div><Label>Номи санҷиш *</Label><Input value={form.check_name} onChange={(e) => setForm({ ...form, check_name: e.target.value })} placeholder="мис.: Санҷиши бетон блоки А" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Сана</Label><Input type="date" value={form.check_date} onChange={(e) => setForm({ ...form, check_date: e.target.value })} /></div>
          <div><Label>Санҷанда</Label><Input value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} /></div>
        </div>
        <div>
          <Label>Натиҷа</Label>
          <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Дар ҷараён</SelectItem>
              <SelectItem value="passed">Қабул</SelectItem>
              <SelectItem value="failed">Рад</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Эрод</Label><Textarea value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>Сабт</Button></DialogFooter>
    </DialogContent>
  );
}

function IncidentDialog({ projects, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    project_id: "", incident_date: new Date().toISOString().slice(0, 10),
    incident_type: "safety", severity: "low", description: "", latitude: "", longitude: "", reported_by: "",
  });
  const [saving, setSaving] = useState(false);

  const captureGPS = () => {
    if (!navigator.geolocation) return toast.error("GPS дастнорас");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        toast.success("GPS қайд шуд");
      },
      () => toast.error("GPS-ро иҷозат надодед"),
    );
  };

  const save = async () => {
    if (!form.project_id || !form.description) return toast.error("Лоиҳа ва тавсиф лозим");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("site_incidents").insert({
      ...form,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сабт шуд"); onSaved(); onClose();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Ҳодисаи объект</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <ZhkBlockSelect projects={projects} value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Сана</Label><Input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} /></div>
          <div>
            <Label>Навъ</Label>
            <Select value={form.incident_type} onValueChange={(v) => setForm({ ...form, incident_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="safety">Бехатарӣ</SelectItem>
                <SelectItem value="accident">Ҳодиса</SelectItem>
                <SelectItem value="complaint">Шикоят</SelectItem>
                <SelectItem value="quality">Сифат</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Дараҷа</Label>
          <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Паст</SelectItem>
              <SelectItem value="medium">Миёна</SelectItem>
              <SelectItem value="high">Баланд</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Тавсиф *</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div>
          <Label>GPS координата</Label>
          <div className="flex gap-2">
            <Input placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <Input placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            <Button type="button" variant="outline" onClick={captureGPS}><MapPin className="h-4 w-4" /></Button>
          </div>
        </div>
        <div><Label>Хабардиҳанда</Label><Input value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving}>Сабт</Button></DialogFooter>
    </DialogContent>
  );
}
