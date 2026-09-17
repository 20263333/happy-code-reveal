import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GanttChartSquare, AlertTriangle, CheckCircle2, Clock, User, Building2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_app/gantt")({
  head: () => ({ meta: [{ title: "График сохтмон — Binosoz.tj" }] }),
  component: GanttPage,
});

function GanttPage() {
  const { companyId } = useAuth();
  const [projectId, setProjectId] = useState<string>("all");
  const [blockId, setBlockId] = useState<string>("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lite", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name, parent_id").eq("company_id", companyId).order("name");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // ЖК = лоиҳаҳои бе parent; Блок = зерлоиҳаҳо
  const zks = projects.filter((p: any) => !p.parent_id);
  const allBlocks = projects.filter((p: any) => !!p.parent_id);
  const blocksOfZk = projectId === "all" ? allBlocks : allBlocks.filter((b: any) => b.parent_id === projectId);

  // ID-ҳои лоиҳаҳое, ки бояд марҳилаҳояшон нишон дода шавад
  const activeProjectIds = useMemo(() => {
    if (blockId !== "all") return [blockId];
    if (projectId !== "all") return [projectId, ...blocksOfZk.map((b: any) => b.id)];
    return projects.map((p: any) => p.id);
  }, [projectId, blockId, projects, blocksOfZk]);

  const nameOfProject = (id: string) => projects.find((p: any) => p.id === id)?.name ?? "";
  const zkNameOf = (projectIdOfStage: string) => {
    const p = projects.find((x: any) => x.id === projectIdOfStage);
    if (!p) return "";
    if (!p.parent_id) return p.name;
    const parent = projects.find((x: any) => x.id === p.parent_id);
    return parent ? `${parent.name} → ${p.name}` : p.name;
  };

  const { data: stages = [] } = useQuery({
    queryKey: ["stages-gantt", activeProjectIds],
    queryFn: async () => {
      if (!activeProjectIds.length) return [];
      const { data } = await (supabase as any).from("project_stages")
        .select("*").in("project_id", activeProjectIds)
        .order("start_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
    enabled: activeProjectIds.length > 0,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["stage-tasks-gantt", activeProjectIds],
    queryFn: async () => {
      if (!activeProjectIds.length) return [];
      const { data } = await (supabase as any).from("stage_tasks")
        .select("*").in("project_id", activeProjectIds).order("sort_order").order("created_at");
      return data ?? [];
    },
    enabled: activeProjectIds.length > 0,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["gantt-staff", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("profiles").select("id, fullname").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });
  const nameOf = (id: string | null) => staff.find((s: any) => s.id === id)?.fullname ?? null;

  // Фоизи умумӣ аз рӯи вазни марҳилаҳо
  const progressOf = (list: any[]) => {
    const tw = list.reduce((a: number, s: any) => a + Math.max(Number(s.weight ?? 1), 0), 0);
    if (tw === 0) return 0;
    return Math.round(list.reduce((a: number, s: any) => a + (s.progress || 0) * Math.max(Number(s.weight ?? 1), 0), 0) / tw);
  };
  const overall = progressOf(stages);

  // Фоизи иҷроиши ҳар як ЖК (бо блокҳояш)
  const zkProgress = useMemo(() => {
    return zks.map((zk: any) => {
      const ids = [zk.id, ...allBlocks.filter((b: any) => b.parent_id === zk.id).map((b: any) => b.id)];
      const list = stages.filter((s: any) => ids.includes(s.project_id));
      const cnt = list.length;
      return { id: zk.id, name: zk.name, progress: progressOf(list), stages: cnt };
    }).filter((z: any) => z.stages > 0 || projectId === z.id || projectId === "all");
  }, [zks, allBlocks, stages, projectId]);

  const { range, today } = useMemo(() => {
    const dates = stages.flatMap((s: any) => [s.start_date, s.end_date, s.deadline].filter(Boolean)).map((d: string) => new Date(d));
    if (!dates.length) return { range: null, today: new Date() };
    const min = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
    return { range: { min, max, days: Math.max(1, (max.getTime() - min.getTime()) / 86400000) }, today: new Date() };
  }, [stages]);

  const alerts = stages.filter((s: any) => {
    if (!s.deadline || s.progress >= 100) return false;
    const days = Math.round((new Date(s.deadline).getTime() - today.getTime()) / 86400000);
    return days <= (s.alert_days ?? 3);
  });
  const overdue = stages.filter((s: any) => s.deadline && s.progress < 100 && new Date(s.deadline) < today);
  const done = stages.filter((s: any) => s.progress >= 100);

  const showZkLabel = projectId === "all" || (projectId !== "all" && blockId === "all" && blocksOfZk.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="График сохтмон (Gantt)" subtitle="Марҳилаҳо, dependencies, deadline alerts" />

      {/* Филтрҳо: ЖК ва Блок */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">ЖК:</div>
          <Select value={projectId} onValueChange={(v) => { setProjectId(v); setBlockId("all"); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Интихоб кунед" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳамаи ЖК</SelectItem>
              {zks.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">Блок:</div>
          <Select value={blockId} onValueChange={setBlockId} disabled={projectId !== "all" && blocksOfZk.length === 0}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Интихоб кунед" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ҳамаи блокҳо</SelectItem>
              {blocksOfZk.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Фоизи иҷроиши ҳар як ЖК */}
      {zkProgress.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {zkProgress.map((z: any) => (
            <div key={z.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{z.name}</span>
                <span className="text-lg font-bold">{z.progress}%</span>
              </div>
              <Progress value={z.progress} className="mt-2 h-2.5" />
              <div className="mt-1 text-[11px] text-muted-foreground">{z.stages} марҳила</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Марҳилаҳо" value={String(stages.length)} icon={GanttChartSquare} />
        <StatCard label="Иҷрошуда" value={String(done.length)} icon={CheckCircle2} accent="success" />
        <StatCard label="Огоҳкунӣ" value={String(alerts.length)} icon={Clock} accent="warning" />
        <StatCard label="Таъхиршуда" value={String(overdue.length)} icon={AlertTriangle} accent="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">Иҷроиши умумӣ (аз рӯи вазн)</span>
          <span className="text-xl font-bold">{overall}%</span>
        </div>
        <Progress value={overall} className="mt-2 h-3" />
      </div>

      {overdue.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="font-medium text-destructive flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" />Марҳилаҳои таъхиршуда</div>
          <div className="space-y-1 text-sm">
            {overdue.map((s: any) => (
              <div key={s.id}>• {zkNameOf(s.project_id)} — {s.name} — deadline: {formatDate(s.deadline)} ({s.progress}% иҷро)</div>
            ))}
          </div>
        </div>
      )}

      {stages.length === 0 ? (
        <EmptyState icon={GanttChartSquare} title="Марҳилаҳо нест" description="Дар саҳифаи лоиҳа марҳила илова кунед" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left w-56">Марҳила</th>
                  <th className="px-4 py-3 text-left w-28">Оғоз</th>
                  <th className="px-4 py-3 text-left w-28">Deadline</th>
                  <th className="px-4 py-3 text-left w-20">Иҷро</th>
                  <th className="px-4 py-3 text-left">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s: any) => {
                  const start = s.start_date ? new Date(s.start_date) : range?.min;
                  const end = s.deadline ? new Date(s.deadline) : (s.end_date ? new Date(s.end_date) : range?.max);
                  const offset = range && start ? ((start.getTime() - range.min.getTime()) / 86400000 / range.days) * 100 : 0;
                  const width = range && start && end ? Math.max(2, ((end.getTime() - start.getTime()) / 86400000 / range.days) * 100) : 5;
                  const isOverdue = s.deadline && s.progress < 100 && new Date(s.deadline) < today;
                  const isAlert = !isOverdue && s.deadline && s.progress < 100 &&
                    (new Date(s.deadline).getTime() - today.getTime()) / 86400000 <= (s.alert_days ?? 3);
                  const subTasks = tasks.filter((t: any) => t.stage_id === s.id);
                  const stageAssignee = nameOf(s.assignee_id);
                  return (
                    <Fragment key={s.id}>
                    <tr className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {s.name}
                        {showZkLabel && <div className="text-[10px] text-primary/70">{zkNameOf(s.project_id)}</div>}
                        {s.depends_on && <div className="text-[10px] text-muted-foreground">← вобаста</div>}
                        {stageAssignee && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{stageAssignee}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">{s.start_date ? formatDate(s.start_date) : "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {s.deadline ? formatDate(s.deadline) : "—"}
                        {isOverdue && <Badge variant="destructive" className="ml-1 text-[10px]">просрочка</Badge>}
                        {isAlert && <Badge className="ml-1 text-[10px] bg-warning/30 text-warning-foreground">скоро</Badge>}
                      </td>
                      <td className="px-4 py-3">{s.progress ?? 0}%</td>
                      <td className="px-4 py-3 min-w-[300px]">
                        <div className="relative h-6 bg-muted rounded overflow-hidden">
                          <div
                            className={`absolute top-0 bottom-0 rounded ${isOverdue ? 'bg-destructive/40' : isAlert ? 'bg-warning/40' : s.progress >= 100 ? 'bg-success/40' : 'bg-primary/30'}`}
                            style={{ left: `${offset}%`, width: `${width}%` }}
                          >
                            <div
                              className={`h-full ${isOverdue ? 'bg-destructive' : isAlert ? 'bg-warning' : s.progress >= 100 ? 'bg-success' : 'bg-primary'}`}
                              style={{ width: `${s.progress ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                    {subTasks.map((t: any) => {
                      const ts = t.start_date ? new Date(t.start_date) : start;
                      const te = t.end_date ? new Date(t.end_date) : end;
                      const tOffset = range && ts ? ((ts.getTime() - range.min.getTime()) / 86400000 / range.days) * 100 : offset;
                      const tWidth = range && ts && te ? Math.max(2, ((te.getTime() - ts.getTime()) / 86400000 / range.days) * 100) : width;
                      const who = nameOf(t.assignee_id);
                      return (
                        <tr key={t.id} className="border-t border-border/50 bg-muted/20">
                          <td className="px-4 py-2 pl-9 text-xs">
                            ↳ {t.name}
                            {who && <span className="text-muted-foreground"> · {who}</span>}
                          </td>
                          <td className="px-4 py-2 text-[11px]">{t.start_date ? formatDate(t.start_date) : "—"}</td>
                          <td className="px-4 py-2 text-[11px]">{t.end_date ? formatDate(t.end_date) : "—"}</td>
                          <td className="px-4 py-2 text-xs">{t.progress ?? 0}%</td>
                          <td className="px-4 py-2">
                            <div className="relative h-4 bg-muted rounded overflow-hidden">
                              <div className="absolute top-0 bottom-0 rounded bg-primary/20"
                                style={{ left: `${tOffset}%`, width: `${tWidth}%` }}>
                                <div className="h-full bg-primary/70" style={{ width: `${t.progress ?? 0}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
