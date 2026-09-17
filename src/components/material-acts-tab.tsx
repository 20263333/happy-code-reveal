import { uuid } from "@/lib/uuid";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Camera, PackageCheck, AlertTriangle, TrendingDown, Truck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { usePrefs } from "@/lib/preferences";
import { compressImageFile } from "@/lib/image-compress";
import { formatDate, MATERIAL_UNITS, materialUnitLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BUCKET = "construction-photos";

type Act = any;

// Акти қабули мавод: миқдори фармоишшуда бо миқдори воқеан қабулшуда
// муқоиса мешавад; фарқ ва зарар худкор ҳисоб мешавад.
export function MaterialActsTab({ projects }: { projects: any[] }) {
  const { companyId, isOwner, isDirector, isPlatformAdmin } = useAuth();
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();
  const canDelete = isOwner || isDirector || isPlatformAdmin;
  const [open, setOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-variance", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("companies")
        .select("id, material_variance_threshold").eq("id", companyId).maybeSingle();
      return data;
    },
  });
  const threshold = Number(company?.material_variance_threshold ?? 2);

  const { data: acts = [] } = useQuery({
    queryKey: ["material-acts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("material_acceptance_acts")
        .select("*, project:projects(name)").order("act_date", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const shortage = acts.filter((a: Act) => Number(a.variance_pct) < -threshold);
  const lossSum = shortage.reduce((s: number, a: Act) => s + Math.max(Number(a.loss_amount) || 0, 0), 0);

  const refresh = () => qc.invalidateQueries({ queryKey: ["material-acts", companyId] });

  const remove = async (a: Act) => {
    if (!confirm("Актро тоза кунем?")) return;
    const { error } = await (supabase as any).from("material_acceptance_acts").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    if (a.photo_paths?.length) await supabase.storage.from(BUCKET).remove(a.photo_paths);
    toast.success("Тоза шуд");
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Актҳо" value={String(acts.length)} icon={PackageCheck} />
        <StatCard label="Камомад (аз ҳад зиёд)" value={String(shortage.length)} icon={AlertTriangle} accent="destructive" />
        <StatCard label="Зарари камомад" value={formatMoney(lossSum)} icon={TrendingDown} accent="warning" />
        <StatCard label="Ҳадди иҷозат" value={`${threshold}%`} icon={Truck} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canDelete ? <ThresholdEditor companyId={companyId!} value={threshold} onSaved={() => qc.invalidateQueries({ queryKey: ["company-variance", companyId] })} /> : <span />}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Акти нав</Button></DialogTrigger>
          <ActDialog projects={projects} threshold={threshold} onClose={() => setOpen(false)} onSaved={refresh} />
        </Dialog>
      </div>

      {acts.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Акт нест" description="Ҳангоми қабули мавод (масалан бетон) миқдори воқеиро чен карда сабт кунед." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">Сана</th>
                <th className="px-3 py-3 text-left">Лоиҳа</th>
                <th className="px-3 py-3 text-left">Мавод</th>
                <th className="px-3 py-3 text-right">Фармоиш</th>
                <th className="px-3 py-3 text-right">Воқеӣ</th>
                <th className="px-3 py-3 text-right">Фарқ</th>
                <th className="px-3 py-3 text-right">Зарар</th>
                <th className="px-3 py-3 text-left">Таъминкунанда</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {acts.map((a: Act) => {
                const pct = Number(a.variance_pct) || 0;
                const bad = pct < -threshold;
                const over = pct > threshold;
                return (
                  <tr key={a.id} className={cn("border-t border-border", bad && "bg-destructive/10")}>
                    <td className="px-3 py-3">{formatDate(a.act_date)}</td>
                    <td className="px-3 py-3">{a.project?.name ?? "—"}</td>
                    <td className="px-3 py-3 font-medium">
                      {a.material_name}
                      {a.mixer_count ? <span className="ml-1 text-xs text-muted-foreground">({a.mixer_count}×{a.mixer_volume})</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(a.ordered_qty)} {a.unit ? materialUnitLabel(a.unit) : ""}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(a.actual_qty)} {a.unit ? materialUnitLabel(a.unit) : ""}</td>
                    <td className={cn("px-3 py-3 text-right font-semibold tabular-nums", bad ? "text-destructive" : over ? "text-warning-foreground" : "text-success")}>
                      {Number(a.variance) > 0 ? "+" : ""}{Number(a.variance)} ({pct.toFixed(1)}%)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(a.loss_amount) > 0 ? formatMoney(a.loss_amount) : "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{a.supplier || "—"}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {a.photo_paths?.length ? <ActPhotos paths={a.photo_paths} /> : null}
                      {bad && <Badge variant="destructive" className="ml-2">Камомад</Badge>}
                      {canDelete && (
                        <Button size="icon" variant="ghost" className="ml-1 h-8 w-8 text-destructive" onClick={() => remove(a)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
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

function ThresholdEditor({ companyId, value, onSaved }: { companyId: string; value: number; onSaved: () => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const save = async () => {
    const { error } = await (supabase as any).from("companies")
      .update({ material_variance_threshold: Number(v) || 0 }).eq("id", companyId);
    if (error) return toast.error(error.message);
    toast.success("Ҳадди фарқ нав шуд");
    onSaved();
  };
  return (
    <div className="flex items-end gap-2">
      <div>
        <Label className="text-xs">Ҳадди иҷозатшудаи фарқ (%)</Label>
        <Input className="w-28" type="number" step="0.1" value={v} onChange={(e) => setV(e.target.value)} />
      </div>
      <Button variant="outline" size="sm" onClick={save}>Нигоҳ доштан</Button>
    </div>
  );
}

function ActPhotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const out: string[] = [];
      for (const p of paths) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push(data.signedUrl);
      }
      setUrls(out);
    })();
  }, [open, paths]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><Camera className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Суратҳои акт</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {urls.map((u) => <img key={u} src={u} alt="Сурати акти қабули мавод" className="w-full rounded-lg" />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActDialog({ projects, threshold, onClose, onSaved }: any) {
  const { companyId } = useAuth();
  const { formatMoney } = usePrefs();
  const [form, setForm] = useState({
    project_id: "", estimate_item_id: "", material_name: "", unit: "m3",
    ordered_qty: "", actual_qty: "", mixer_count: "", mixer_volume: "",
    unit_price: "", supplier: "", inspector: "", note: "",
    act_date: new Date().toISOString().slice(0, 10),
  });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: estItems = [] } = useQuery({
    queryKey: ["estimate-items-for-act", form.project_id],
    enabled: !!form.project_id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("estimate_items")
        .select("id, name, unit, quantity, unit_price, estimate:estimates(is_current)")
        .eq("project_id", form.project_id).limit(500);
      return (data ?? []).filter((i: any) => i.estimate?.is_current !== false);
    },
  });

  const mixerTotal = (Number(form.mixer_count) || 0) * (Number(form.mixer_volume) || 0);
  const actual = Number(form.actual_qty) || mixerTotal;
  const ordered = Number(form.ordered_qty) || 0;
  const variance = actual - ordered;
  const pct = ordered > 0 ? (variance / ordered) * 100 : 0;
  const loss = Math.max(ordered - actual, 0) * (Number(form.unit_price) || 0);
  const bad = ordered > 0 && pct < -threshold;

  const pickItem = (id: string) => {
    const it = estItems.find((x: any) => x.id === id);
    setForm((f) => ({
      ...f,
      estimate_item_id: id,
      material_name: it?.name ?? f.material_name,
      unit: it?.unit ?? f.unit,
      ordered_qty: it ? String(it.quantity) : f.ordered_qty,
      unit_price: it ? String(it.unit_price) : f.unit_price,
    }));
  };

  const save = async () => {
    if (!form.project_id || !form.material_name) return toast.error("Лоиҳа ва номи мавод лозим");
    if (!actual) return toast.error("Миқдори воқеӣ лозим");
    if (files.length === 0) return toast.error("Ҳадди аққал 1 сурати чен кардан лозим");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const paths: string[] = [];
      for (const f of files) {
        const dataUrl = await compressImageFile(f, { maxSize: 1800, quality: 0.85 });
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${companyId}/acts/${uuid()}.jpg`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { error } = await (supabase as any).from("material_acceptance_acts").insert({
        company_id: companyId,
        project_id: form.project_id,
        estimate_item_id: form.estimate_item_id || null,
        material_name: form.material_name.trim(),
        unit: form.unit || null,
        ordered_qty: ordered,
        actual_qty: actual,
        mixer_count: form.mixer_count ? Number(form.mixer_count) : null,
        mixer_volume: form.mixer_volume ? Number(form.mixer_volume) : null,
        unit_price: Number(form.unit_price) || 0,
        supplier: form.supplier.trim() || null,
        inspector: form.inspector.trim() || null,
        act_date: form.act_date,
        note: form.note.trim() || null,
        photo_paths: paths,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success(bad ? "Сабт шуд — камомад қайд гардид" : "Сабт шуд");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Акти қабули мавод</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Лоиҳа *</Label>
            <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, estimate_item_id: "" })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Сана</Label><Input type="date" value={form.act_date} onChange={(e) => setForm({ ...form, act_date: e.target.value })} /></div>
        </div>

        {estItems.length > 0 && (
          <div>
            <Label>Сатри смета (ихтиёрӣ)</Label>
            <Select value={form.estimate_item_id} onValueChange={pickItem}>
              <SelectTrigger><SelectValue placeholder="Аз смета интихоб кунед" /></SelectTrigger>
              <SelectContent>
                {estItems.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.name} — {Number(i.quantity)} {i.unit ?? ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Номи мавод *</Label><Input value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} placeholder="мис.: Бетон М300" /></div>
          <div>
            <Label>Воҳид</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MATERIAL_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><Label>Фармоиш (смета)</Label><Input type="number" value={form.ordered_qty} onChange={(e) => setForm({ ...form, ordered_qty: e.target.value })} /></div>
          <div><Label>Воқеан қабулшуда</Label><Input type="number" value={form.actual_qty} onChange={(e) => setForm({ ...form, actual_qty: e.target.value })} placeholder={mixerTotal ? String(mixerTotal) : ""} /></div>
          <div><Label>Нархи воҳид</Label><Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
        </div>

        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">Ҳисоби миксерҳо (барои бетон)</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Шумораи миксер</Label><Input type="number" value={form.mixer_count} onChange={(e) => setForm({ ...form, mixer_count: e.target.value })} /></div>
            <div><Label className="text-xs">Ҳаҷми як миксер</Label><Input type="number" step="0.1" value={form.mixer_volume} onChange={(e) => setForm({ ...form, mixer_volume: e.target.value })} /></div>
            <div className="flex items-end"><p className="text-sm tabular-nums">Ҷамъ: <b>{mixerTotal || 0} {materialUnitLabel(form.unit)}</b></p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Таъминкунанда</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
          <div><Label>Қабулкунанда</Label><Input value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} /></div>
        </div>

        <div>
          <Label>Суратҳои чен кардан * (миксер, накладная, ҷои рехтан)</Label>
          <Input type="file" accept="image/*" multiple capture="environment"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          {files.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{files.length} сурат интихоб шуд</p>}
        </div>

        <div><Label>Эзоҳ</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>

        {ordered > 0 && (
          <div className={cn("rounded-xl border p-3 text-sm", bad ? "border-destructive bg-destructive/10" : "border-border")}>
            <p>Фарқ: <b className="tabular-nums">{variance > 0 ? "+" : ""}{variance} {materialUnitLabel(form.unit)} ({pct.toFixed(1)}%)</b></p>
            {loss > 0 && <p>Зарари эҳтимолӣ: <b className="tabular-nums">{formatMoney(loss)}</b></p>}
            {bad && <p className="mt-1 font-semibold text-destructive">Диққат! Камомад аз ҳадди {threshold}% зиёд аст — директор огоҳ карда мешавад.</p>}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Сабт…</> : "Сабт"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
