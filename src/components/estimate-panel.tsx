import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, ArrowLeft, FileText, Trash2, Upload, FileDown, FileSpreadsheet,
  Printer, History, Paperclip, Lock, TrendingDown, TrendingUp, Percent, Wallet, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePrefs } from "@/lib/preferences";
import {
  ESTIMATE_KINDS, ESTIMATE_STATUS, MATERIAL_UNITS, formatDate,
  estimateKindLabel, estimateStatusLabel, estimateLocked,
} from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; company_id: string; location?: string | null };

export function EstimatePanel({
  project, canEdit, actualExpenses,
}: { project: Project; canEdit: boolean; actualExpenses: number }) {
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);

  if (selectedRoot) {
    return (
      <EstimateDetail
        rootId={selectedRoot}
        project={project}
        canEdit={canEdit}
        actualExpenses={actualExpenses}
        onBack={() => setSelectedRoot(null)}
      />
    );
  }
  return <EstimateList project={project} canEdit={canEdit} onOpen={setSelectedRoot} />;
}

// ============ LIST ============
function EstimateList({ project, canEdit, onOpen }: { project: Project; canEdit: boolean; onOpen: (rootId: string) => void }) {
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["estimates", project.id],
    queryFn: async () =>
      (await supabase.from("estimates").select("*").eq("project_id", project.id).eq("is_current", true)
        .order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-4">
      {canEdit && <NewEstimateButton project={project} onAdded={() => qc.invalidateQueries({ queryKey: ["estimates", project.id] })} />}
      {isLoading ? (
        <EmptyState icon={FileText} title="Боркунӣ…" />
      ) : estimates.length === 0 ? (
        <EmptyState icon={FileText} title="Смета нест" description="Барои ин проект ҳанӯз смета сохта нашудааст." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {estimates.map((e: any) => (
            <button key={e.id} onClick={() => onOpen(e.root_id)}
              className="rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{e.name}</h3>
                <Badge variant="outline" className="shrink-0">V{e.version}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className={cn("border", (ESTIMATE_STATUS as any)[e.status]?.color)}>{estimateStatusLabel(e.status)}</Badge>
                {estimateLocked(e.status) && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              {e.customer && <p className="mt-2 text-sm text-muted-foreground">Фармоишгар: {e.customer}</p>}
              <p className="mt-3 font-display text-xl font-semibold tabular-nums">{formatMoney(e.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(e.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewEstimateButton({ project, onAdded }: { project: Project; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [responsible, setResponsible] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Номи смета лозим аст"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("estimates").insert({
        company_id: project.company_id,
        project_id: project.id,
        name: name.trim(),
        customer: customer.trim() || null,
        responsible: responsible.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Смета сохта шуд");
      setOpen(false); setName(""); setCustomer(""); setResponsible("");
      onAdded();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Сметаи нав</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Сметаи нав</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Номи смета</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Масалан: Смета бинои истиқоматӣ" /></div>
          <div><Label>Фармоишгар</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          <div><Label>Масъул</Label><Input value={responsible} onChange={(e) => setResponsible(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? "Нигоҳдорӣ…" : "Сохтан"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DETAIL ============
function EstimateDetail({
  rootId, project, canEdit, actualExpenses, onBack,
}: { rootId: string; project: Project; canEdit: boolean; actualExpenses: number; onBack: () => void }) {
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();
  const [viewVersionId, setViewVersionId] = useState<string | null>(null);

  // All versions in this root, newest first
  const { data: versions = [] } = useQuery({
    queryKey: ["estimate-versions", rootId],
    queryFn: async () =>
      (await supabase.from("estimates").select("*").eq("root_id", rootId).order("version", { ascending: false })).data ?? [],
  });

  const current = versions.find((v: any) => v.is_current) ?? versions[0];
  const estimate = (viewVersionId ? versions.find((v: any) => v.id === viewVersionId) : current) ?? current;

  // Миқдори воқеан қабулшуда аз актҳои қабули мавод
  const { data: acts = [] } = useQuery({
    queryKey: ["estimate-acts", project.id],
    queryFn: async () =>
      ((await (supabase as any).from("material_acceptance_acts")
        .select("estimate_item_id, actual_qty, loss_amount")
        .eq("project_id", project.id)).data ?? []) as any[],
  });

  const acceptedByItem = new Map<string, { qty: number; loss: number }>();
  for (const a of acts) {
    if (!a.estimate_item_id) continue;
    const cur = acceptedByItem.get(a.estimate_item_id) ?? { qty: 0, loss: 0 };
    cur.qty += Number(a.actual_qty) || 0;
    cur.loss += Math.max(Number(a.loss_amount) || 0, 0);
    acceptedByItem.set(a.estimate_item_id, cur);
  }
  const shortageSum = Array.from(acceptedByItem.values()).reduce((s2, v) => s2 + v.loss, 0);

  const { data: items = [] } = useQuery({
    queryKey: ["estimate-items", estimate?.id],
    enabled: !!estimate?.id,
    queryFn: async () =>
      (await supabase.from("estimate_items").select("*").eq("estimate_id", estimate.id)
        .order("kind").order("sort_order").order("created_at")).data ?? [],
  });

  if (!estimate) return <EmptyState icon={FileText} title="Боркунӣ…" />;

  const locked = estimateLocked(estimate.status) || !estimate.is_current;
  const editable = canEdit && !locked;

  const total = Number(estimate.total) || 0;
  const diff = total - actualExpenses;            // >0 = иқтисод, <0 = аз смета зиёд
  const execPct = total > 0 ? Math.min(Math.round((actualExpenses / total) * 100), 999) : 0;

  const sumByKind = (k: string) => items.filter((i: any) => i.kind === k).reduce((s: number, i: any) => s + Number(i.total), 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["estimate-items", estimate.id] });
    qc.invalidateQueries({ queryKey: ["estimate-versions", rootId] });
    qc.invalidateQueries({ queryKey: ["estimates", project.id] });
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("estimates").update({ status }).eq("id", estimate.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Статус нав шуд");
    refresh();
  };

  const newVersion = async () => {
    const { data, error } = await supabase.rpc("create_estimate_version", { _estimate_id: estimate.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Версияи нав сохта шуд");
    setViewVersionId(null);
    qc.invalidateQueries({ queryKey: ["estimate-versions", rootId] });
    qc.invalidateQueries({ queryKey: ["estimates", project.id] });
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Ба рӯйхати сметаҳо
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">{estimate.name}</h2>
            <Badge variant="outline">V{estimate.version}</Badge>
            {!estimate.is_current && <Badge variant="secondary">Версияи кӯҳна</Badge>}
            {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {estimate.customer ? `Фармоишгар: ${estimate.customer}` : ""}
            {estimate.responsible ? `  ·  Масъул: ${estimate.responsible}` : ""}
            {`  ·  ${formatDate(estimate.created_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && estimate.is_current ? (
            <Select value={estimate.status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ESTIMATE_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge className={cn("border", (ESTIMATE_STATUS as any)[estimate.status]?.color)}>{estimateStatusLabel(estimate.status)}</Badge>
          )}
          {canEdit && <Button variant="outline" size="sm" onClick={newVersion}><History className="h-4 w-4" />Версияи нав</Button>}
        </div>
      </div>

      {/* Version selector */}
      {versions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Версияҳо:</span>
          {versions.map((v: any) => (
            <Button key={v.id} size="sm" variant={v.id === estimate.id ? "default" : "outline"}
              onClick={() => setViewVersionId(v.is_current ? null : v.id)}>
              V{v.version}{v.is_current ? " (ҷорӣ)" : ""}
            </Button>
          ))}
        </div>
      )}

      {/* Comparison cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompareCard label="Сметаи умумӣ" value={formatMoney(total)} icon={FileText} accent="primary" />
        <CompareCard label="Хароҷоти воқеӣ" value={formatMoney(actualExpenses)} icon={Receipt} accent="warning" />
        <CompareCard
          label={diff >= 0 ? "Иқтисод" : "Аз смета зиёд"}
          value={formatMoney(Math.abs(diff))}
          icon={diff >= 0 ? TrendingDown : TrendingUp}
          accent={diff >= 0 ? "success" : "destructive"}
        />
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Иҷроиш</span>
            <Percent className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{execPct}%</p>
          <Progress value={Math.min(execPct, 100)} className="mt-2" />
        </div>
      </div>

      {/* Totals breakdown + export */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {ESTIMATE_KINDS.map((k) => (
              <div key={k.value}>
                <span className="text-muted-foreground">{k.label}: </span>
                <span className="font-semibold tabular-nums">{formatMoney(sumByKind(k.value))}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportEstimateExcel(estimate, items)}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button size="sm" variant="outline" onClick={() => exportEstimatePDF(estimate, items, actualExpenses)}><FileDown className="h-4 w-4" />PDF</Button>
            <Button size="sm" variant="outline" onClick={() => printEstimate(estimate, items, actualExpenses, formatMoney)}><Printer className="h-4 w-4" />Чоп</Button>
          </div>
        </div>
      </div>

      {/* Items by kind */}
      {ESTIMATE_KINDS.map((k) => {
        const list = items.filter((i: any) => i.kind === k.value);
        return (
          <div key={k.value} className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="font-display font-semibold">{k.label}</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{formatMoney(sumByKind(k.value))}</span>
                {editable && <EstimateItemDialog estimateId={estimate.id} projectId={project.id} kind={k.value} onSaved={refresh} />}
              </div>
            </div>
            {list.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Сатр нест</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Ном</th>
                      <th className="px-4 py-2 text-left">Раздел</th>
                      <th className="px-4 py-2 text-right">Миқдор</th>
                      <th className="px-4 py-2 text-right">Қабулшуда</th>
                      <th className="px-4 py-2 text-right">Фарқи миқдор</th>
                      <th className="px-4 py-2 text-left">Воҳид</th>
                      <th className="px-4 py-2 text-right">Нарх</th>
                      <th className="px-4 py-2 text-right">Ҷамъ</th>
                      {editable && <th className="px-4 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((it: any) => {
                      const acc = acceptedByItem.get(it.id);
                      const qtyDiff = acc ? acc.qty - Number(it.quantity) : null;
                      return (
                      <tr key={it.id} className={cn("border-t border-border", qtyDiff !== null && qtyDiff < 0 && "bg-destructive/10")}>
                        <td className="px-4 py-2 font-medium">{it.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{it.section ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{Number(it.quantity)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{acc ? acc.qty : "—"}</td>
                        <td className={cn("px-4 py-2 text-right tabular-nums font-semibold", qtyDiff !== null && (qtyDiff < 0 ? "text-destructive" : "text-success"))}>
                          {qtyDiff === null ? "—" : `${qtyDiff > 0 ? "+" : ""}${Number(qtyDiff.toFixed(2))}`}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{it.unit ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatMoney(it.unit_price)}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMoney(it.total)}</td>
                        {editable && (
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <EstimateItemDialog estimateId={estimate.id} projectId={project.id} kind={k.value} item={it} onSaved={refresh} />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                              onClick={async () => {
                                const { error } = await supabase.from("estimate_items").delete().eq("id", it.id);
                                if (error) { toast.error(error.message); return; }
                                refresh();
                              }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {shortageSum > 0 && (
        <div className="rounded-2xl border-2 border-destructive/50 bg-destructive/10 px-5 py-4 flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-destructive">Камомади мавод аз рӯи актҳо</span>
          <span className="font-display text-2xl font-bold tabular-nums text-destructive">{formatMoney(shortageSum)}</span>
        </div>
      )}

      {/* Grand total */}
      <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 px-5 py-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold">Арзиши умумии лоиҳа</span>
        <span className="font-display text-2xl font-bold tabular-nums">{formatMoney(total)}</span>
      </div>

      {/* Documents */}
      <EstimateDocuments estimateId={estimate.id} projectId={project.id} canEdit={canEdit} />
    </div>
  );
}

function CompareCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: "primary" | "success" | "destructive" | "warning" }) {
  const tone = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ============ ITEM DIALOG (add/edit) ============
function EstimateItemDialog({
  estimateId, projectId, kind, item, onSaved,
}: { estimateId: string; projectId: string; kind: string; item?: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [section, setSection] = useState(item?.section ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [quantity, setQuantity] = useState(String(item?.quantity ?? ""));
  const [price, setPrice] = useState(String(item?.unit_price ?? ""));
  const [saving, setSaving] = useState(false);
  const presets = ESTIMATE_KINDS.find((k) => k.value === kind)?.presets ?? [];
  const lineTotal = (Number(quantity) || 0) * (Number(price) || 0);

  const submit = async () => {
    if (!name.trim()) { toast.error("Ном лозим аст"); return; }
    setSaving(true);
    try {
      const payload = {
        estimate_id: estimateId, project_id: projectId, kind,
        name: name.trim(), section: section.trim() || null, unit: unit || null,
        quantity: Number(quantity) || 0, unit_price: Number(price) || 0,
      };
      const { error } = item
        ? await supabase.from("estimate_items").update(payload).eq("id", item.id)
        : await supabase.from("estimate_items").insert(payload);
      if (error) throw error;
      toast.success(item ? "Нав шуд" : "Илова шуд");
      setOpen(false);
      if (!item) { setName(""); setSection(""); setUnit(""); setQuantity(""); setPrice(""); }
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item
          ? <Button size="icon" variant="ghost" className="h-8 w-8"><FileText className="h-4 w-4" /></Button>
          : <Button size="sm" variant="outline"><Plus className="h-4 w-4" />Сатр</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{estimateKindLabel(kind)} — {item ? "таҳрир" : "сатри нав"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ном</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} list={`presets-${kind}`} placeholder="Номро нависед ё интихоб кунед" />
            <datalist id={`presets-${kind}`}>{presets.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div><Label>Раздел (ихтиёрӣ)</Label><Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Масалан: Фундамент" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Миқдор</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <div>
              <Label>Воҳид</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{MATERIAL_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Нарх</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Ҷамъ: <span className="font-semibold tabular-nums">{new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(lineTotal)}</span>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? "Нигоҳдорӣ…" : "Нигоҳ доштан"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DOCUMENTS ============
function docTypeFromName(fname: string): string {
  const ext = fname.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "photo";
  if (["doc", "docx"].includes(ext)) return "contract";
  return "other";
}

function EstimateDocuments({ estimateId, projectId, canEdit }: { estimateId: string; projectId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["estimate-docs", estimateId],
    queryFn: async () =>
      (await supabase.from("estimate_documents").select("*").eq("estimate_id", estimateId).order("created_at", { ascending: false })).data ?? [],
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${projectId}/${estimateId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("estimate-docs").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("estimate_documents").insert({
        estimate_id: estimateId, project_id: projectId, file_path: path,
        file_name: file.name, doc_type: docTypeFromName(file.name), uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Ҳуҷҷат бор шуд");
      qc.invalidateQueries({ queryKey: ["estimate-docs", estimateId] });
    } catch (err: any) { toast.error(err.message); } finally { setUploading(false); e.target.value = ""; }
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("estimate-docs").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: any) => {
    await supabase.storage.from("estimate-docs").remove([d.file_path]);
    await supabase.from("estimate_documents").delete().eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["estimate-docs", estimateId] });
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-display font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" />Ҳуҷҷатҳо</h3>
        {canEdit && (
          <label className="inline-flex">
            <input type="file" className="hidden" onChange={onUpload} accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp" />
            <Button size="sm" variant="outline" asChild disabled={uploading}>
              <span><Upload className="h-4 w-4" />{uploading ? "Боркунӣ…" : "Илова кардан"}</span>
            </Button>
          </label>
        )}
      </div>
      {docs.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Ҳуҷҷат нест</p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d: any) => (
            <li key={d.id} className="flex items-center justify-between px-5 py-3">
              <button onClick={() => openDoc(d.file_path)} className="flex items-center gap-2 text-sm hover:text-primary">
                <FileText className="h-4 w-4 text-muted-foreground" />{d.file_name}
                <Badge variant="outline" className="text-[10px]">{d.doc_type}</Badge>
              </button>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============ EXPORTS ============
const moneyRu = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Number(n) || 0);

async function exportEstimateExcel(estimate: any, items: any[]) {
  const XLSX = await import("xlsx");
  const rows: any[][] = [
    ["Смета", estimate.name],
    ["Версия", `V${estimate.version}`],
    ["Статус", estimateStatusLabel(estimate.status)],
    ["Фармоишгар", estimate.customer ?? ""],
    ["Масъул", estimate.responsible ?? ""],
    [],
    ["Раздел", "Ном", "Подраздел", "Миқдор", "Воҳид", "Нарх", "Ҷамъ"],
  ];
  for (const k of ESTIMATE_KINDS) {
    const list = items.filter((i) => i.kind === k.value);
    for (const it of list) {
      rows.push([k.label, it.name, it.section ?? "", Number(it.quantity), it.unit ?? "", Number(it.unit_price), Number(it.total)]);
    }
  }
  rows.push([]);
  rows.push(["", "", "", "", "", "Арзиши умумӣ", Number(estimate.total)]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Смета");
  XLSX.writeFile(wb, `Smeta_${estimate.name}_V${estimate.version}.xlsx`);
}

async function exportEstimatePDF(estimate: any, items: any[], actual: number) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(15); doc.text("Binosoz.tj — Smeta", 14, 18);
  doc.setFontSize(10);
  doc.text(`${estimate.name}  (V${estimate.version})`, 14, 26);
  doc.text(`Status: ${estimateStatusLabel(estimate.status)}`, 14, 32);
  const body: any[] = [];
  for (const k of ESTIMATE_KINDS) {
    for (const it of items.filter((i) => i.kind === k.value)) {
      body.push([k.label, it.name, Number(it.quantity), it.unit ?? "", moneyRu(it.unit_price), moneyRu(it.total)]);
    }
  }
  autoTable(doc, {
    startY: 38,
    head: [["Razdel", "Nomi", "Miqdor", "Vohid", "Narx", "Jam"]],
    body,
    styles: { fontSize: 9 }, headStyles: { fillColor: [37, 99, 235] },
  });
  const y = (doc as any).lastAutoTable?.finalY ?? 38;
  const diff = Number(estimate.total) - actual;
  autoTable(doc, {
    startY: y + 6,
    body: [
      ["Smeta umumi", moneyRu(estimate.total)],
      ["Xarojoti voqei", moneyRu(actual)],
      [diff >= 0 ? "Iqtisod" : "Az smeta ziyod", moneyRu(Math.abs(diff))],
    ],
    styles: { fontSize: 10 }, columnStyles: { 1: { halign: "right" } },
  });
  doc.save(`Smeta_${estimate.name}_V${estimate.version}.pdf`);
}

function printEstimate(estimate: any, items: any[], actual: number, formatMoney: (n: number) => string) {
  const diff = Number(estimate.total) - actual;
  const rows = ESTIMATE_KINDS.map((k) => {
    const list = items.filter((i) => i.kind === k.value);
    if (list.length === 0) return "";
    return `<tr><td colspan="5" style="background:#f1f5f9;font-weight:600">${k.label}</td></tr>` +
      list.map((it) => `<tr>
        <td>${it.name}</td><td>${it.section ?? ""}</td>
        <td style="text-align:right">${Number(it.quantity)} ${it.unit ?? ""}</td>
        <td style="text-align:right">${formatMoney(it.unit_price)}</td>
        <td style="text-align:right">${formatMoney(it.total)}</td></tr>`).join("");
  }).join("");
  const html = `<html><head><title>Смета — ${estimate.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
    h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
    th{background:#e2e8f0}.tot{margin-top:16px;font-size:15px;font-weight:700}</style></head>
    <body>
    <h1>Смета: ${estimate.name} (V${estimate.version})</h1>
    <p>Статус: ${estimateStatusLabel(estimate.status)}${estimate.customer ? ` · Фармоишгар: ${estimate.customer}` : ""}${estimate.responsible ? ` · Масъул: ${estimate.responsible}` : ""}</p>
    <table><thead><tr><th>Ном</th><th>Раздел</th><th style="text-align:right">Миқдор</th><th style="text-align:right">Нарх</th><th style="text-align:right">Ҷамъ</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="tot">Арзиши умумӣ: ${formatMoney(estimate.total)}</p>
    <p>Хароҷоти воқеӣ: ${formatMoney(actual)}</p>
    <p>${diff >= 0 ? "Иқтисод" : "Аз смета зиёд"}: ${formatMoney(Math.abs(diff))}</p>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Браузер равзанаро баст"); return; }
  w.document.write(html); w.document.close(); w.focus(); w.print();
}
