import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, User, Pencil } from "lucide-react";
import { toast } from "sonner";

export type StaffOption = { id: string; fullname: string };

export function useCompanyStaff(companyId: string | null) {
  return useQuery({
    queryKey: ["company-staff-lite", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("id, fullname").eq("company_id", companyId!).order("fullname");
      return (data ?? []) as StaffOption[];
    },
  });
}

/** Зермарҳилаҳо (корҳо) — фоизи марҳила аз рӯи вазни корҳо худкор ҳисоб мешавад. */
export function StageTasks({ stage, projectId, companyId, canEdit, canDelete }: {
  stage: any; projectId: string; companyId: string | null; canEdit: boolean; canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const { data: staff = [] } = useCompanyStaff(companyId);

  const { data: tasks = [] } = useQuery({
    queryKey: ["stage-tasks", stage.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("stage_tasks")
        .select("*").eq("stage_id", stage.id).order("sort_order").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stage-tasks", stage.id] });
    qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("stage_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Хориҷ шуд"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const setProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await (supabase as any).from("stage_tasks")
        .update({ progress: Math.max(0, Math.min(100, progress)) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.fullname ?? null;

  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">Корҳо ({tasks.length})</span>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Кори нав</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Кори нав</DialogTitle></DialogHeader>
              <TaskForm stage={stage} projectId={projectId} companyId={companyId} staff={staff}
                onDone={() => { setAddOpen(false); refresh(); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ҳоло кор илова нашудааст. Фоизи марҳила дастӣ гузошта мешавад.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t: any) => (
            <TaskRow key={t.id} task={t} stage={stage} projectId={projectId} companyId={companyId} staff={staff}
              canEdit={canEdit} canDelete={canDelete} assignee={nameOf(t.assignee_id)}
              onProgress={(p: number) => setProgress.mutate({ id: t.id, progress: p })}
              onDelete={() => { if (confirm(`Хориҷ кардани "${t.name}"?`)) del.mutate(t.id); }}
              onSaved={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, stage, projectId, companyId, staff, canEdit, canDelete, assignee, onProgress, onDelete, onSaved }: any) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{task.name}</div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>вазн: {task.weight}</span>
            {assignee && <span className="flex items-center gap-1"><User className="h-3 w-3" />{assignee}</span>}
          </div>
        </div>
        <div className="text-sm font-bold w-12 text-right">{task.progress}%</div>
        {canEdit && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Таҳрири кор</DialogTitle></DialogHeader>
              <TaskForm task={task} stage={stage} projectId={projectId} companyId={companyId} staff={staff}
                onDone={() => { setEditOpen(false); onSaved(); }} />
            </DialogContent>
          </Dialog>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <Progress value={task.progress} className="mt-2 h-1.5" />
      {canEdit && (
        <input type="range" min={0} max={100} defaultValue={task.progress} className="w-full mt-2"
          onMouseUp={(e) => onProgress(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onProgress(Number((e.target as HTMLInputElement).value))} />
      )}
    </div>
  );
}

function TaskForm({ task, stage, projectId, companyId, staff, onDone }: any) {
  const [name, setName] = useState(task?.name ?? "");
  const [weight, setWeight] = useState<number>(task?.weight ?? 1);
  const [progress, setProgress] = useState<number>(task?.progress ?? 0);
  const [assignee, setAssignee] = useState<string>(task?.assignee_id ?? "none");
  const [startDate, setStartDate] = useState(task?.start_date ?? "");
  const [endDate, setEndDate] = useState(task?.end_date ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Ном ворид кунед");
      const payload: any = {
        name: name.trim(),
        weight: Math.max(0, weight || 0),
        progress: Math.max(0, Math.min(100, progress)),
        assignee_id: assignee === "none" ? null : assignee,
        start_date: startDate || null,
        end_date: endDate || null,
      };
      if (task) {
        const { error } = await (supabase as any).from("stage_tasks").update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        if (!companyId) throw new Error("Ширкат ёфт нашуд");
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from("stage_tasks").insert({
          ...payload, stage_id: stage.id, project_id: projectId, company_id: companyId, created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Захира шуд"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="space-y-1.5"><Label>Номи кор</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="масалан: Қолибчинӣ" required /></div>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Оғоз</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Анҷом</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Фоизи иҷроиш ({progress}%)</Label>
        <Input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></div>
      <DialogFooter><Button type="submit" disabled={save.isPending}>Захира</Button></DialogFooter>
    </form>
  );
}
