import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserCog, X, Trash2, Plus, HardHat, KeyRound, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ROLE_LABELS } from "@/lib/constants";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { revokeProjectAccess, addStaffToProject } from "@/lib/access.functions";
import { createEmployee } from "@/lib/staff.functions";
import { deleteWorkerWithRefund } from "@/lib/workers.functions";
import { setStaffPages, setStaffPassword } from "@/lib/staff-pages.functions";
import { APP_PAGES, DEPARTMENT_LABEL, defaultPagesForDepartment } from "@/lib/app-pages";
import { useSalarySummaries, SalaryBalanceBox, type SalarySummary } from "@/components/worker-salary";
import { usePrefs } from "@/lib/preferences";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/staff")({
  head: () => ({ meta: [{ title: "Сотрудники — Binosoz.tj" }] }),
  component: StaffPage,
});

function StaffPage() {
  const { isOwner, companyId } = useAuth();
  const { t, tr } = useT();
  const { formatMoney } = usePrefs();
  const qc = useQueryClient();
  const revokeFn = useServerFn(revokeProjectAccess);
  const addProjFn = useServerFn(addStaffToProject);
  const deleteWorkerFn = useServerFn(deleteWorkerWithRefund);
  const [addOpen, setAddOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-min", companyId],
    queryFn: async () => companyId ? (await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name")).data ?? [] : [],
    enabled: !!companyId,
  });

  const { data: projectsTree = [] } = useQuery({
    queryKey: ["projects-min-with-parent", companyId],
    queryFn: async () => companyId ? (await supabase.from("projects").select("id, name, parent_id").eq("company_id", companyId).order("name")).data ?? [] : [],
    enabled: !!companyId,
  });


  const { data: workers = [] } = useQuery({
    queryKey: ["workers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("workers").select("*").eq("company_id", companyId).order("fullname");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: salary = {} } = useSalarySummaries(companyId);


  const { data: staff = [] } = useQuery({
    queryKey: ["staff-full", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const [{ data: profiles }, { data: roles }, { data: ps }, { data: projects }] = await Promise.all([
        supabase.from("profiles").select("*").eq("company_id", companyId),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("project_staff").select("user_id, project_id"),
        supabase.from("projects").select("id, name").eq("company_id", companyId),
      ]);
      const projById = new Map((projects ?? []).map((p) => [p.id, p]));
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
        projects: (ps ?? []).filter((x) => x.user_id === p.id).map((x) => projById.get(x.project_id)).filter(Boolean),
      }));
    },
    enabled: !!companyId,
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OK"); qc.invalidateQueries({ queryKey: ["staff-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async ({ user_id, project_id }: { user_id: string; project_id: string }) =>
      revokeFn({ data: { user_id, project_id } }),
    onSuccess: () => { toast.success("OK"); qc.invalidateQueries({ queryKey: ["staff-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addProj = useMutation({
    mutationFn: async ({ user_id, project_id }: { user_id: string; project_id: string }) =>
      addProjFn({ data: { user_id, project_id } }),
    onSuccess: () => { toast.success(tr("Доступ к проекту выдан")); qc.invalidateQueries({ queryKey: ["staff-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeStaff = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("project_staff").delete().eq("user_id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Сотрудник удалён")); qc.invalidateQueries({ queryKey: ["staff-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeWorker = useMutation({
    mutationFn: async (id: string) => deleteWorkerFn({ data: { worker_id: id } }),
    onSuccess: (r: any) => {
      const back = Number(r?.refunded ?? 0);
      toast.success(
        back > 0
          ? `${tr("Рабочий удалён")} — ${formatMoney(back)} ${tr("возвращено")}`
          : tr("Рабочий удалён"),
      );
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["salary-summary"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOwner) {
    return <EmptyState icon={UserCog} title={tr("Доступ запрещён")} description={tr("Только владелец управляет сотрудниками.")} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={tr("Рабочие")}
        subtitle={tr("Список рабочих (устохо) для начисления зарплаты.")}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{tr("Добавить рабочего")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tr("Добавить рабочего")}</DialogTitle></DialogHeader>
              <AddWorkerForm companyId={companyId} projects={projectsTree as any[]} onClose={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["workers"] }); }} />
            </DialogContent>
          </Dialog>
        }
      />

      {workers.length === 0 ? (
        <EmptyState icon={HardHat} title={tr("Рабочих нет")} description={tr("Добавьте рабочих, чтобы выбирать их при выплате зарплаты.")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((w: any) => (
            <WorkerCard
              key={w.id}
              worker={w}
              projects={projectsTree as any[]}
              summary={salary[w.id]}
              onDelete={() => { if (confirm(`${tr("Удалить рабочего")} "${w.fullname}"?\n${tr("Все выплаченные ему деньги будут возвращены.")}`)) removeWorker.mutate(w.id); }}
            />
          ))}
        </div>
      )}


      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("nav.staff")}</h2>
            <p className="text-sm text-muted-foreground">{tr("Роли, проекты и доступ.")}</p>
          </div>
          <Dialog open={empOpen} onOpenChange={setEmpOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{tr("Создать сотрудника")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tr("Создать сотрудника")}</DialogTitle></DialogHeader>
              <CreateEmployeeForm onClose={() => { setEmpOpen(false); qc.invalidateQueries({ queryKey: ["staff-full"] }); }} />
            </DialogContent>
          </Dialog>
        </div>
        {staff.length === 0 ? (
          <EmptyState icon={UserCog} title={tr("Сотрудников нет")} />
        ) : (
          <div className="grid gap-4">
            {staff.map((s: any) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-semibold">{s.fullname || "—"}</h3>
                    <p className="text-xs text-muted-foreground">{s.phone || "—"}</p>
                    <div className="mt-2 flex gap-1">
                      {s.roles.map((r: AppRole) => (
                        <Badge key={r} variant="secondary">{tr(ROLE_LABELS[r])}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(v) => setRole.mutate({ userId: s.id, role: v as AppRole })}>
                      <SelectTrigger className="w-40"><SelectValue placeholder={tr("Сменить роль")} /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                          <SelectItem key={r} value={r}>{tr(ROLE_LABELS[r])}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <StaffPagesButton staff={s} />
                    <StaffPasswordButton staff={s} />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { if (confirm(`${tr("Удалить сотрудника")} "${s.fullname || s.id}"? ${tr("Все доступы будут отозваны.")}`)) removeStaff.mutate(s.id); }}
                      className="text-destructive hover:bg-destructive/10"
                    ><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("staff.projects")}</p>
                  {s.projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("staff.noProjects")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {s.projects.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-3 pr-1 py-1 text-xs">
                          <span>{p.name}</span>
                          <button
                            onClick={() => revoke.mutate({ user_id: s.id, project_id: p.id })}
                            disabled={revoke.isPending}
                            title={t("staff.revoke")}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const assignedIds = new Set(s.projects.map((p: any) => p.id));
                    const available = allProjects.filter((p: any) => !assignedIds.has(p.id));
                    if (available.length === 0) return null;
                    return (
                      <div className="mt-3 flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select onValueChange={(v) => addProj.mutate({ user_id: s.id, project_id: v })}>
                          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder={tr("Добавить проект к доступу")} /></SelectTrigger>
                          <SelectContent>
                            {available.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Cost-center picker: general project employee vs. employee of one block. */
export function CostCenterFields({
  projects, costCenter, setCostCenter, projectId, setProjectId, blockId, setBlockId,
}: {
  projects: any[];
  costCenter: string; setCostCenter: (v: string) => void;
  projectId: string; setProjectId: (v: string) => void;
  blockId: string; setBlockId: (v: string) => void;
}) {
  const { tr } = useT();
  const tops = projects.filter((p) => !p.parent_id);
  const blocks = projects.filter((p) => p.parent_id === projectId);
  return (
    <>
      <div className="space-y-1.5">
        <Label>{tr("Тип привязки расходов")}</Label>
        <Select value={costCenter} onValueChange={(v) => { setCostCenter(v); if (v === "project") setBlockId(""); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="project">{tr("Общий сотрудник проекта")}</SelectItem>
            <SelectItem value="block">{tr("Сотрудник конкретного блока")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{tr("Проект")}</Label>
        <Select value={projectId} onValueChange={(v) => { setProjectId(v); setBlockId(""); }}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {tops.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {costCenter === "block" && (
        <div className="space-y-1.5">
          <Label>{tr("Блок")}</Label>
          <Select value={blockId} onValueChange={setBlockId}>
            <SelectTrigger><SelectValue placeholder={tr("Блокро интихоб кунед")} /></SelectTrigger>
            <SelectContent>
              {blocks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

function AddWorkerForm({ companyId, projects, onClose }: { companyId: string | null; projects: any[]; onClose: () => void }) {
  const { tr } = useT();
  const [fullname, setFullname] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [salary, setSalary] = useState("");
  const [costCenter, setCostCenter] = useState("project");
  const [projectId, setProjectId] = useState("");
  const [blockId, setBlockId] = useState("");


  const add = useMutation({
    mutationFn: async () => {
      if (!fullname.trim()) throw new Error(tr("Укажите ФИО"));
      if (!companyId) throw new Error(tr("Компания не найдена"));
      if (costCenter === "block" && !blockId) throw new Error(tr("Выберите блок"));
      const { error } = await supabase.from("workers").insert({
        company_id: companyId,
        fullname: fullname.trim(),
        position: position.trim() || null,
        phone: phone.trim() || null,
        monthly_salary: Number(salary) || 0,
        cost_center: costCenter,
        project_id: projectId || null,
        block_id: costCenter === "block" ? blockId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tr("Рабочий добавлен")); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
      <div className="space-y-1.5"><Label>{tr("ФИО")}</Label><Input value={fullname} onChange={(e) => setFullname(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>{tr("Специальность")}</Label><Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder={tr("например: каменщик, маляр")} /></div>
      <div className="space-y-1.5"><Label>{tr("Телефон")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="space-y-1.5">
        <Label>{tr("Фиксированная зарплата в месяц")}</Label>
        <Input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0" />
      </div>
      <CostCenterFields
        projects={projects}
        costCenter={costCenter} setCostCenter={setCostCenter}
        projectId={projectId} setProjectId={setProjectId}
        blockId={blockId} setBlockId={setBlockId}
      />
      <DialogFooter><Button type="submit" disabled={add.isPending}>{tr("Добавить")}</Button></DialogFooter>
    </form>
  );

}

function WorkerCard({ worker, projects, summary, onDelete }: { worker: any; projects: any[]; summary?: SalarySummary; onDelete: () => void }) {
  const { tr } = useT();
  const qc = useQueryClient();
  const { formatMoney } = usePrefs();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [salary, setSalary] = useState(String(worker.monthly_salary ?? 0));
  const [costCenter, setCostCenter] = useState(String(worker.cost_center ?? "project"));
  const [projectId, setProjectId] = useState(String(worker.project_id ?? ""));
  const [blockId, setBlockId] = useState(String(worker.block_id ?? ""));
  const [fullname, setFullname] = useState(String(worker.fullname ?? ""));
  const [position, setPosition] = useState(String(worker.position ?? ""));
  const [phone, setPhone] = useState(String(worker.phone ?? ""));

  const saveInfo = useMutation({
    mutationFn: async () => {
      if (!fullname.trim()) throw new Error(tr("Укажите ФИО"));
      if (costCenter === "block" && !blockId) throw new Error(tr("Выберите блок"));
      const { error } = await supabase
        .from("workers")
        .update({
          fullname: fullname.trim(),
          position: position.trim() || null,
          phone: phone.trim() || null,
          monthly_salary: Number(salary) || 0,
          cost_center: costCenter,
          project_id: projectId || null,
          block_id: costCenter === "block" ? blockId : null,
        })
        .eq("id", worker.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("Сохранено"));
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["salary-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const blockName = projects.find((p) => p.id === worker.block_id)?.name ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (costCenter === "block" && !blockId) throw new Error(tr("Выберите блок"));
      const { error } = await supabase
        .from("workers")
        .update({
          monthly_salary: Number(salary) || 0,
          cost_center: costCenter,
          project_id: projectId || null,
          block_id: costCenter === "block" ? blockId : null,
        })
        .eq("id", worker.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("Сохранено"));
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["salary-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HardHat className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">{worker.fullname}</h3>
          </div>
          {worker.position && <p className="mt-1 text-xs text-muted-foreground">{worker.position}</p>}
          {worker.phone && <p className="text-xs text-muted-foreground">{worker.phone}</p>}
          <div className="mt-2">
            <Badge variant={worker.cost_center === "block" ? "default" : "secondary"}>
              {worker.cost_center === "block"
                ? `${tr("Блок")}: ${blockName ?? "—"}`
                : tr("Общие расходы проекта")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title={tr("Изменить")}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tr("Изменить")} — {worker.fullname}</DialogTitle></DialogHeader>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveInfo.mutate(); }}>
                <div className="space-y-1.5"><Label>{tr("ФИО")}</Label><Input value={fullname} onChange={(e) => setFullname(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>{tr("Специальность")}</Label><Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder={tr("например: каменщик, маляр")} /></div>
                <div className="space-y-1.5"><Label>{tr("Телефон")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>{tr("Фиксированная зарплата в месяц")}</Label>
                  <Input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} />
                </div>
                <CostCenterFields
                  projects={projects}
                  costCenter={costCenter} setCostCenter={setCostCenter}
                  projectId={projectId} setProjectId={setProjectId}
                  blockId={blockId} setBlockId={setBlockId}
                />
                <DialogFooter><Button type="submit" disabled={saveInfo.isPending}>{tr("Сохранить")}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>


      <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tr("Фиксированная зарплата")}</span>
          <span className="font-medium">{formatMoney(Number(worker.monthly_salary ?? 0))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tr("Доступно к выплате")}</span>
          <span className="font-semibold text-primary">{formatMoney(summary?.balance ?? 0)}</span>
        </div>
      </div>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="mt-3 w-full">{tr("Зарплата")}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{tr("Зарплата")} — {worker.fullname}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{tr("Фиксированная зарплата в месяц")}</Label>
                <Input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} />
              </div>
              <CostCenterFields
                projects={projects}
                costCenter={costCenter} setCostCenter={setCostCenter}
                projectId={projectId} setProjectId={setProjectId}
                blockId={blockId} setBlockId={setBlockId}
              />
              <Button onClick={() => save.mutate()} disabled={save.isPending}>{tr("Сохранить")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr("Изменение применяется только к будущим начислениям и новым расходам. Прошлые выплаты остаются там, где были учтены.")}
            </p>

            <SalaryBalanceBox workerId={worker.id} summary={summary} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


type Department = "sales" | "legal" | "accounting" | "construction" | "hr";

const DEPARTMENTS: { value: Department; label: string; role: "manager" | "accountant" | "warehouse" }[] = [
  { value: "sales", label: "Шуъбаи Фурӯш", role: "manager" },
  { value: "legal", label: "Шуъбаи Ҳуқуқӣ", role: "manager" },
  { value: "accounting", label: "Шуъбаи Муҳосибот", role: "accountant" },
  { value: "construction", label: "Шуъбаи Назорати Сохтмон", role: "manager" },
  { value: "hr", label: "Шуъбаи Кадр", role: "manager" },
];

function CreateEmployeeForm({ onClose }: { onClose: () => void }) {
  const { tr } = useT();
  const { companyId } = useAuth();
  const createFn = useServerFn(createEmployee);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState<Department>("sales");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set(defaultPagesForDepartment("sales")));

  // Reset page selection when department changes.
  const changeDept = (v: Department) => {
    setDepartment(v);
    setAllowed(new Set(defaultPagesForDepartment(v)));
  };

  const togglePage = (url: string) =>
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });

  const byGroup = APP_PAGES.reduce<Record<string, typeof APP_PAGES>>((acc, p) => {
    const key = p.group ?? DEPARTMENT_LABEL[p.department];
    (acc[key] ??= [] as any).push(p);
    return acc;
  }, {});


  const role = DEPARTMENTS.find((d) => d.value === department)!.role;

  // Only top-level projects (ЖК) — blocks are granted automatically with their parent.
  const { data: topProjects = [] } = useQuery({
    queryKey: ["projects-top", companyId],
    queryFn: async () =>
      companyId ? (await supabase.from("projects").select("id, name").eq("company_id", companyId).is("parent_id", null).order("name")).data ?? [] : [],
    enabled: !!companyId,
  });

  // Managers see only assigned projects, so for them a project must be chosen.
  const needsProjects = role === "manager";

  const toggleProject = (id: string) =>
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const add = useMutation({
    mutationFn: async () => {
      if (!fullname.trim()) throw new Error(tr("Укажите ФИО"));
      if (!email.trim()) throw new Error(tr("Укажите email"));
      if (password.length < 6) throw new Error(tr("Пароль не менее 6 символов"));
      if (needsProjects && projectIds.length === 0) throw new Error(tr("Выберите хотя бы один проект"));
      const defaults = new Set(defaultPagesForDepartment(department));
      const extra_pages: string[] = [];
      const denied_pages: string[] = [];
      for (const p of APP_PAGES) {
        const on = allowed.has(p.url);
        const isDefault = defaults.has(p.url);
        if (on && !isDefault) extra_pages.push(p.url);
        if (!on && isDefault) denied_pages.push(p.url);
      }
      return createFn({
        data: {
          email: email.trim(),
          password,
          fullname: fullname.trim(),
          phone: phone.trim() || undefined,
          role,
          department,
          project_ids: role === "warehouse" ? undefined : projectIds,
          extra_pages,
          denied_pages,
        },
      });
    },
    onSuccess: () => { toast.success(tr("Сотрудник создан")); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
      <div className="space-y-1.5"><Label>{tr("ФИО")}</Label><Input value={fullname} onChange={(e) => setFullname(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>{tr("Email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>{tr("Пароль")}</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>{tr("Телефон")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="space-y-1.5">
        <Label>{tr("Шуъба")}</Label>
        <Select value={department} onValueChange={(v) => changeDept(v as Department)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.value} value={d.value}>{tr(d.label)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{tr("Доступ к страницам")}</Label>
        <div className="max-h-60 space-y-3 overflow-y-auto rounded-md border border-border p-2">
          {(Object.keys(byGroup) as string[]).map((label) => (
            <div key={label}>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{tr(label)}</p>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {byGroup[label]!.map((p: (typeof APP_PAGES)[number]) => (
                  <label key={p.url} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={allowed.has(p.url)}
                      onChange={() => togglePage(p.url)}
                    />
                    <span>{tr(p.label)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {role !== "warehouse" && (
        <div className="space-y-1.5">
          <Label>{tr("Доступ к проектам")}</Label>
          {topProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr("Сначала создайте проект.")}</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {topProjects.map((p: any) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={projectIds.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          )}
          {role === "manager" && (
            <p className="text-xs text-muted-foreground">{tr("Прораб видит только выбранные проекты (и их блоки).")}</p>
          )}
          {role === "accountant" && (
            <p className="text-xs text-muted-foreground">{tr("Бухгалтер видит все проекты компании.")}</p>
          )}
        </div>
      )}

      <DialogFooter><Button type="submit" disabled={add.isPending}>{tr("Создать")}</Button></DialogFooter>
    </form>
  );
}

function StaffPasswordButton({ staff }: { staff: any }) {
  const { tr } = useT();
  const saveFn = useServerFn(setStaffPassword);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error(tr("Минимум 6 символов")); return; }
    setSaving(true);
    try {
      await saveFn({ data: { user_id: staff.id, password } });
      toast.success(tr("Пароль изменён"));
      setOpen(false);
      setPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title={tr("Сменить пароль")}>
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Сменить пароль")}: {staff.fullname || "—"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tr("Новый пароль")}</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("Минимум 6 символов")}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{tr("Сохранить")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffPagesButton({ staff }: { staff: any }) {
  const { tr } = useT();
  const qc = useQueryClient();
  const saveFn = useServerFn(setStaffPages);
  const [open, setOpen] = useState(false);

  const dept = staff.department as import("@/hooks/use-auth").Department | null;
  const defaults = new Set(dept ? defaultPagesForDepartment(dept) : []);
  const extra: string[] = staff.extra_pages ?? [];
  const denied: string[] = staff.denied_pages ?? [];

  const initial = new Set<string>(defaults);
  for (const u of extra) initial.add(u);
  for (const u of denied) initial.delete(u);

  const [allowed, setAllowed] = useState<Set<string>>(initial);

  const toggle = (url: string) => {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const nextExtra: string[] = [];
      const nextDenied: string[] = [];
      for (const p of APP_PAGES) {
        const isDefault = defaults.has(p.url);
        const isOn = allowed.has(p.url);
        if (isOn && !isDefault) nextExtra.push(p.url);
        if (!isOn && isDefault) nextDenied.push(p.url);
      }
      return saveFn({ data: { user_id: staff.id, extra_pages: nextExtra, denied_pages: nextDenied } });
    },
    onSuccess: () => {
      toast.success(tr("Доступ обновлён"));
      qc.invalidateQueries({ queryKey: ["staff-full"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const byGroup = APP_PAGES.reduce<Record<string, typeof APP_PAGES>>((acc, p) => {
    const key = p.group ?? DEPARTMENT_LABEL[p.department];
    (acc[key] ??= [] as any).push(p);
    return acc;
  }, {});


  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) setAllowed(new Set(initial));
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          {tr("Доступ к страницам")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tr("Доступ к страницам")}: {staff.fullname || "—"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
          {(Object.keys(byGroup) as string[]).map((label) => (
            <div key={label}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tr(label)}
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {byGroup[label]!.map((p: (typeof APP_PAGES)[number]) => (
                  <label key={p.url} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={allowed.has(p.url)}
                      onChange={() => toggle(p.url)}
                    />
                    <span>{tr(p.label)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{tr("Отмена")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{tr("Сохранить")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
