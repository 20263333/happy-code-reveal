import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Calendar, TrendingUp, Trash2, Edit, ChevronDown, ChevronRight, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageTasks, useCompanyStaff, type StaffOption } from "@/components/stage-tasks";
import { StagePhotos } from "@/components/stage-photos";
import { EmptyState } from "@/components/page-header";
import { formatDate } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned:     { label: "Ба нақша",   color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Дар ҷараён", color: "bg-warning/20 text-warning-foreground" },
  done:        { label: "Иҷро шуд",   color: "bg-success/15 text-success" },
  paused:      { label: "Таваққуф",   color: "bg-destructive/15 text-destructive" },
};

export function StagesPanel({ projectId, companyId, canEdit, canDelete }: {
  projectId: string; companyId: string | null; canEdit: boolean; canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: stages = [] } = useQuery({
    queryKey: ["project-stages", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("project_stages")
        .select("*").eq("project_id", projectId).order("sort_order").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Фоизи умумӣ аз рӯи вазни ҳар марҳила ҳисоб мешавад.
  const totalWeight = stages.reduce((s: number, x: any) => s + Math.max(Number(x.weight ?? 1), 0), 0);
  const avgProgress = totalWeight === 0 ? 0 : Math.round(
    stages.reduce((s: number, x: any) => s + (x.progress || 0) * Math.max(Number(x.weight ?? 1), 0), 0) / totalWeight);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("project_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Хориҷ шуд"); qc.invalidateQueries({ queryKey: ["project-stages", projectId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">Иҷроиши умумии лоиҳа</span>
            <span className="font-bold text-lg">{avgProgress}%</span>
          </div>
          <Progress value={avgProgress} className="mt-2 h-3" />
        </div>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Марҳилаи нав</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Марҳилаи нав</DialogTitle></DialogHeader>
              <StageForm projectId={projectId} companyId={companyId}
                onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["project-stages", projectId] }); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {stages.length === 0 ? (
        <EmptyState icon={Calendar} title="Марҳилаҳо ҳоло илова нашудаанд"
          description="Марҳилаҳои сохтмонро илова кунед: Фундамент, Деворҳо, Бом ва ғайра." />
      ) : (
        <div className="space-y-3">
          {stages.map((st: any) => (
            <StageCard key={st.id} stage={st} projectId={projectId} companyId={companyId} canEdit={canEdit} canDelete={canDelete}
              onDelete={() => { if (confirm(`Хориҷ кардани "${st.name}"?`)) del.mutate(st.id); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, projectId, companyId, canEdit, canDelete, onDelete }: any) {
  const qc = useQueryClient();
  const [updOpen, setUpdOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: staff = [] } = useCompanyStaff(companyId ?? stage.company_id ?? null);
  const assignee = staff.find((s) => s.id === stage.assignee_id)?.fullname ?? null;
  const st = STATUS_LABELS[stage.status] ?? STATUS_LABELS.planned;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{stage.name}</h3>
            <Badge className={cn("border-transparent", st.color)}>{st.label}</Badge>
          </div>
          {stage.description && <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {stage.start_date && <span>📅 {formatDate(stage.start_date)}</span>}
            {stage.end_date && <span>→ {formatDate(stage.end_date)}</span>}
            <span>вазн: {stage.weight ?? 1}</span>
            {assignee && <span className="flex items-center gap-1"><User className="h-3 w-3" />{assignee}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold">{stage.progress}%</div>
        </div>
      </div>
      <Progress value={stage.progress} className="mt-3 h-2" />
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}Корҳо ва аксҳо
        </Button>
        {canEdit && (
          <>
            <Dialog open={updOpen} onOpenChange={setUpdOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><TrendingUp className="h-3.5 w-3.5 mr-1" />Навсозӣ</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Навсозии фоиз</DialogTitle></DialogHeader>
                <StageUpdateForm stage={stage} projectId={projectId}
                  onDone={() => { setUpdOpen(false); qc.invalidateQueries({ queryKey: ["project-stages", projectId] }); }} />
              </DialogContent>
            </Dialog>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost"><Edit className="h-3.5 w-3.5" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Таҳрири марҳила</DialogTitle></DialogHeader>
                <StageForm stage={stage} projectId={projectId} companyId={stage.company_id}
                  onDone={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["project-stages", projectId] }); }} />
              </DialogContent>
            </Dialog>
          </>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {open && (
        <>
          <StageTasks stage={stage} projectId={projectId} companyId={companyId ?? stage.company_id ?? null}
            canEdit={canEdit} canDelete={canDelete} />
          <StagePhotos stageId={stage.id} projectId={projectId} companyId={companyId ?? stage.company_id ?? null}
            canEdit={canEdit} canDelete={canDelete} />
        </>
      )}
    </div>
  );
}

function StageForm({ stage, projectId, companyId, onDone }: {
  stage?: any; projectId: string; companyId: string | null; onDone: () => void;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [description, setDescription] = useState(stage?.description ?? "");
  const [startDate, setStartDate] = useState(stage?.start_date ?? "");
  const [endDate, setEndDate] = useState(stage?.end_date ?? "");
  const [progress, setProgress] = useState<number>(stage?.progress ?? 0);
  const [weight, setWeight] = useState<number>(stage?.weight ?? 1);
  const [assignee, setAssignee] = useState<string>(stage?.assignee_id ?? "none");
  const { data: staff = [] } = useCompanyStaff(companyId);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Ном ворид кунед");
      const payload: any = {
        name: name.trim(), description: description.trim() || null,
        start_date: startDate || null, end_date: endDate || null,
        progress: Math.max(0, Math.min(100, progress)),
        weight: Math.max(0, weight || 0),
        assignee_id: assignee === "none" ? null : assignee,
      };
      if (stage) {
        const { error } = await (supabase as any).from("project_stages").update(payload).eq("id", stage.id);
        if (error) throw error;
      } else {
        if (!companyId) throw new Error("Ширкат ёфт нашуд");
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from("project_stages").insert({
          ...payload, project_id: projectId, company_id: companyId, created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Захира шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="space-y-1.5"><Label>Ном</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="масалан: Фундамент" required /></div>
      <div className="space-y-1.5"><Label>Шарҳ</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Оғоз</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Анҷом</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Вазн (аҳамият)</Label>
          <Input type="number" min={0} step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Масъул</Label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue placeholder="Интихоб" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— нест —</SelectItem>
              {staff.map((s: StaffOption) => <SelectItem key={s.id} value={s.id}>{s.fullname}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Фоизи иҷроиш ({progress}%)</Label>
        <Input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></div>
      <DialogFooter><Button type="submit" disabled={save.isPending}>Захира</Button></DialogFooter>
    </form>
  );
}

function StageUpdateForm({ stage, projectId, onDone }: { stage: any; projectId: string; onDone: () => void }) {
  const [progress, setProgress] = useState<number>(stage.progress ?? 0);
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("stage_updates").insert({
        stage_id: stage.id, project_id: projectId,
        progress: Math.max(0, Math.min(100, progress)),
        note: note.trim() || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Навсозӣ шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="space-y-1.5"><Label>Фоизи нав: {progress}%</Label>
        <Input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></div>
      <div className="space-y-1.5"><Label>Шарҳ (ихтиёрӣ)</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="масалан: Деворҳои этажи 3 тайёранд" /></div>
      <DialogFooter><Button type="submit" disabled={save.isPending}>Навсозӣ</Button></DialogFooter>
    </form>
  );
}
