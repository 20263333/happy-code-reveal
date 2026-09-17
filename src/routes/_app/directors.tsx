import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserCog, Plus, Trash2, KeyRound, Building2, RefreshCw } from "lucide-react";
import {
  listCompanyDirectors, createCompanyDirector, deleteCompanyDirector, resetDirectorPassword,
} from "@/lib/directors.functions";
import { upsertPartnerShare } from "@/lib/distribution.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/directors")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Директорҳо — PLATFORM.TJ" },
      { name: "description", content: "Идоракунии директорҳо ва шарикони ширкати сохтмонӣ." },
      { property: "og:title", content: "Директорҳо — PLATFORM.TJ" },
      { property: "og:description", content: "Идоракунии директорҳо ва шарикони ширкати сохтмонӣ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DirectorsPage,
});

type ProjectNode = { id: string; name: string; parent_id: string | null };
type ShareRow = { project_id: string; percent: string };

function DirectorsPage() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listCompanyDirectors);
  const createFn = useServerFn(createCompanyDirector);
  const deleteFn = useServerFn(deleteCompanyDirector);
  const resetFn = useServerFn(resetDirectorPassword);
  const shareFn = useServerFn(upsertPartnerShare);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["company-directors"],
    queryFn: () => listFn({}),
    enabled: isOwner,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const directors: any[] = data?.directors ?? [];

  const { data: projectsData } = useQuery({
    queryKey: ["director-add-projects"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, parent_id")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectNode[];
    },
  });
  const zhkList = (projectsData ?? []).filter((p) => !p.parent_id);
  const blocksByParent = (projectsData ?? []).reduce<Record<string, ProjectNode[]>>((acc, p) => {
    if (p.parent_id) (acc[p.parent_id] ||= []).push(p);
    return acc;
  }, {});

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ fullname: "", email: "", password: "" });
  const [shares, setShares] = useState<Record<string, ShareRow>>({});
  const [resetOpen, setResetOpen] = useState<null | { id: string; email: string }>(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!addOpen) setShares({});
  }, [addOpen]);

  const toggleShare = (projectId: string) => {
    setShares((s) => {
      const next = { ...s };
      if (next[projectId]) delete next[projectId];
      else next[projectId] = { project_id: projectId, percent: "" };
      return next;
    });
  };

  const createM = useMutation({
    mutationFn: async (v: typeof form) => {
      const res: any = await createFn({ data: v });
      const uid = res?.user_id as string | undefined;
      if (uid) {
        for (const row of Object.values(shares)) {
          const pct = Number(row.percent);
          if (!row.project_id || !pct || pct <= 0) continue;
          try {
            await shareFn({ data: { project_id: row.project_id, director_user_id: uid, percent: pct } });
          } catch (e: any) {
            toast.error(`Ҳисса: ${e?.message ?? "хатогӣ"}`);
          }
        }
      }
      return res;
    },
    onSuccess: () => {
      toast.success("Директор илова шуд");
      setAddOpen(false); setForm({ fullname: "", email: "", password: "" });
      qc.invalidateQueries({ queryKey: ["company-directors"] });
      qc.invalidateQueries({ queryKey: ["partner-shares"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { director_id: id } }),
    onSuccess: () => { toast.success("Нест шуд"); qc.invalidateQueries({ queryKey: ["company-directors"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  const resetM = useMutation({
    mutationFn: (v: { id: string; password: string }) => resetFn({ data: { director_id: v.id, password: v.password } }),
    onSuccess: () => { toast.success("Парол иваз шуд"); setResetOpen(null); setNewPw(""); },
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  if (!isOwner) {
    return <div className="p-6 text-muted-foreground">Танҳо соҳиби ширкат ба ин саҳифа дастрасӣ дорад.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><UserCog className="h-6 w-6" /> Директорҳо</h1>
          <p className="text-sm text-muted-foreground">
            Директор танҳо назорат мекунад — маълумотро мебинад, вале ягон чиз илова, тағйир ё нест карда наметавонад.
            Ҳадди аксар 10 директор барои як ширкат.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={directors.length >= 10}>
          <Plus className="mr-2 h-4 w-4" /> Илова кардани директор
        </Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Боркунӣ...</div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 p-6" role="alert">
            <p className="text-sm text-destructive">
              Рӯйхати директорҳо бор нашуд: {error instanceof Error ? error.message : "хатогии номаълум"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Такрор кардан
            </Button>
          </div>
        ) : directors.length === 0 ? (
          <div className="p-6 text-muted-foreground">Ҳоло директор илова нашудааст.</div>
        ) : (
          <div className="divide-y">
            {directors.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.fullname}</div>
                  <div className="truncate text-sm text-muted-foreground">{d.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setResetOpen({ id: d.id, email: d.email })}>
                    <KeyRound className="mr-1 h-4 w-4" /> Парол
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      if (confirm(`Директор "${d.fullname}"-ро нест кунем?`)) deleteM.mutate(d.id);
                    }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Нест
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Илова кардани директор</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label>ФИО</Label>
              <Input value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Парол (ҳадди аққал 6 аломат)</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label className="m-0">ЖК ва блокҳо (фоизи ҳисса)</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                ЖК ё блокеро интихоб кунед ва фоизи ҳиссаи директорро аз даромади он ворид кунед.
                Метавонед холӣ гузоред — баъдтар аз саҳифаи лоиҳа илова кардан мумкин.
              </p>
              {zhkList.length === 0 ? (
                <div className="text-sm text-muted-foreground">Ҳоло лоиҳа нест.</div>
              ) : (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  {zhkList.map((zhk) => {
                    const blocks = blocksByParent[zhk.id] ?? [];
                    return (
                      <div key={zhk.id} className="space-y-2">
                        <ShareRowUI
                          label={zhk.name}
                          bold
                          checked={!!shares[zhk.id]}
                          percent={shares[zhk.id]?.percent ?? ""}
                          onToggle={() => toggleShare(zhk.id)}
                          onPercent={(v) => setShares((s) => ({ ...s, [zhk.id]: { project_id: zhk.id, percent: v } }))}
                        />
                        {blocks.length > 0 && (
                          <div className="ml-6 space-y-1.5">
                            {blocks.map((b) => (
                              <ShareRowUI
                                key={b.id}
                                label={b.name}
                                checked={!!shares[b.id]}
                                percent={shares[b.id]?.percent ?? ""}
                                onToggle={() => toggleShare(b.id)}
                                onPercent={(v) => setShares((s) => ({ ...s, [b.id]: { project_id: b.id, percent: v } }))}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Бекор</Button>
            <Button
              onClick={() => createM.mutate(form)}
              disabled={createM.isPending || !form.email || !form.password || !form.fullname}
            >
              {createM.isPending ? "..." : "Илова кардан"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetOpen} onOpenChange={(v) => !v && setResetOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Иваз кардани парол — {resetOpen?.email}</DialogTitle></DialogHeader>
          <div>
            <Label>Пароли нав</Label>
            <Input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetOpen(null); setNewPw(""); }}>Бекор</Button>
            <Button
              onClick={() => resetOpen && resetM.mutate({ id: resetOpen.id, password: newPw })}
              disabled={resetM.isPending || newPw.length < 6}
            >
              {resetM.isPending ? "..." : "Нигоҳ доштан"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShareRowUI({
  label, bold, checked, percent, onToggle, onPercent,
}: {
  label: string; bold?: boolean; checked: boolean; percent: string;
  onToggle: () => void; onPercent: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox checked={checked} onCheckedChange={onToggle} id={`sh-${label}`} />
      <label htmlFor={`sh-${label}`} className={`flex-1 text-sm ${bold ? "font-semibold" : ""}`}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Input
          type="number" step="0.01" min="0" max="100"
          className="w-24 h-8"
          disabled={!checked}
          value={percent}
          onChange={(e) => onPercent(e.target.value)}
          placeholder="0"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    </div>
  );
}
