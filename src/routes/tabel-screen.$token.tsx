import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LogOut, Loader2, HardHat, Search, Clock, CheckCircle2, X, CircleSlash, Users, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { kioskStatus, kioskPublicUnlock, kioskLock } from "@/lib/kiosk.functions";
import { tabelListWorkers, tabelListToday, tabelMark } from "@/lib/tabel-kiosk.functions";
import { verifyWorkerFace } from "@/lib/face-id.functions";
import { FaceCaptureDialog } from "@/components/face-capture-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tabel-screen/$token")({
  ssr: false,
  component: TabelScreen,
});

function TabelScreen() {
  const { token } = Route.useParams();
  const statusFn = useServerFn(kioskStatus);
  const unlockFn = useServerFn(kioskPublicUnlock);
  const lockFn = useServerFn(kioskLock);
  const qc = useQueryClient();

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["kiosk-status-tabel"],
    queryFn: () => statusFn(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    document.documentElement.classList.add("kiosk-mode");
    return () => document.documentElement.classList.remove("kiosk-mode");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setBusy(true);
    try {
      const r = await unlockFn({ data: { token, pin } });
      if (r.ok) {
        toast.success("Экран кушода шуд");
        await refetch();
        setPin("");
      } else {
        const msgs: Record<string, string> = {
          bad_pin: "PIN-и нодуруст", disabled: "Kiosk фаъол нест",
          no_pin: "PIN танзим нашуд", no_access: "Линк нодуруст аст",
        };
        toast.error(msgs[r.reason] ?? "Хатогӣ");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Хатогӣ");
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    await lockFn();
    qc.removeQueries({ queryKey: ["tabel-kiosk-workers"] });
    qc.removeQueries({ queryKey: ["tabel-kiosk-today"] });
    await refetch();
  };

  if (isLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!status?.unlocked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white z-50">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 p-8">
          <div className="text-center space-y-2">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Табел-Kiosk</h1>
            <p className="text-sm text-white/70">PIN-ро ворид кунед</p>
          </div>
          <Input
            type="password" inputMode="numeric" autoFocus
            value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="h-14 text-center text-2xl tracking-widest bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
          <Button type="submit" disabled={busy || !pin} className="w-full h-12 text-base">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Кушодан"}
          </Button>
        </form>
      </div>
    );
  }

  return <TabelBoard onLock={lock} />;
}

function TabelBoard({ onLock }: { onLock: () => void }) {
  const workersFn = useServerFn(tabelListWorkers);
  const todayFn = useServerFn(tabelListToday);
  const markFn = useServerFn(tabelMark);
  const verifyFn = useServerFn(verifyWorkerFace);
  const qc = useQueryClient();

  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState("");
  const [picker, setPicker] = useState<any>(null);
  const [faceWorker, setFaceWorker] = useState<any>(null);
  const [pendingMark, setPendingMark] = useState<{ status: "full" | "half" | "absent"; hours: number } | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = now.toISOString().slice(0, 10);

  const { data: workers = [] } = useQuery({
    queryKey: ["tabel-kiosk-workers"],
    queryFn: () => workersFn(),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["tabel-kiosk-today", today],
    queryFn: () => todayFn({ data: { date: today } }),
    refetchInterval: 30_000,
  });

  const attMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of attendance as any[]) m.set(a.worker_id, a);
    return m;
  }, [attendance]);

  const mark = useMutation({
    mutationFn: (v: { worker_id: string; status: "full" | "half" | "absent"; hours: number; face_verified?: boolean; verification_photo_path?: string | null; face_confidence?: number | null }) =>
      markFn({ data: { ...v, date: today } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabel-kiosk-today", today] });
      toast.success("Қайд шуд ✓");
      setPicker(null);
      setFaceWorker(null);
      setPendingMark(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Хатогӣ"),
  });

  const startMark = (worker: any, status: "full" | "half" | "absent", customHours?: number | null) => {
    const hours = customHours ?? (status === "full" ? 8 : status === "half" ? 4 : 0);
    if (worker.face_photo_path) {
      setFaceWorker(worker);
      setPendingMark({ status, hours });
    } else {
      // Коргар акси рӯй надорад — қайд бе тасдиқи рӯй сабт мешавад
      mark.mutate({ worker_id: worker.id, status, hours, face_verified: false });
    }
  };


  const onFaceCapture = async (base64: string) => {
    if (!faceWorker || !pendingMark) return;
    setVerifying(true);
    try {
      const res = await verifyFn({ data: { worker_id: faceWorker.id, captured_base64: base64 } });
      if (!res.ok) {
        toast.error(res.message ?? "Тасдиқи рӯй номувофиқ");
        return;
      }
      mark.mutate({
        worker_id: faceWorker.id,
        status: pendingMark.status,
        hours: pendingMark.hours,
        face_verified: true,
        verification_photo_path: res.verification_photo_path ?? null,
        face_confidence: res.confidence ?? null,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Хатогӣ дар тасдиқи рӯй");
    } finally {
      setVerifying(false);
    }
  };

  const filtered = (workers as any[]).filter((w) =>
    !search || w.fullname.toLowerCase().includes(search.toLowerCase()));

  // Group workers by position
  const groups = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const w of filtered) {
      const key = (w.position || "Бе гурӯҳ").trim() || "Бе гурӯҳ";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(w);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const currentGroup = activeGroup ?? (groups[0]?.[0] ?? null);
  const currentWorkers = groups.find(([k]) => k === currentGroup)?.[1] ?? [];

  const stats = {
    marked: (attendance as any[]).length,
    full: (attendance as any[]).filter((a) => a.status === "full").length,
    half: (attendance as any[]).filter((a) => a.status === "half").length,
    absent: (attendance as any[]).filter((a) => a.status === "absent").length,
    total: (workers as any[]).length,
  };

  const quickMark = (worker: any, status: "full" | "half" | "absent") => {
    startMark(worker, status);
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-3 py-1.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight">Табел — Kiosk</div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">
            {now.toLocaleDateString("tg-TJ", { day: "numeric", month: "long", year: "numeric" })}
            {" • "}
            {now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs">
          <span className="font-bold">{stats.marked}/{stats.total}</span>
          <span className="text-success">✓ {stats.full}</span>
          <span className="text-warning-foreground">½ {stats.half}</span>
          <span className="text-destructive">✗ {stats.absent}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onLock} className="gap-1.5 h-8">
          <LogOut className="h-3.5 w-3.5" />Пӯшидан
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Groups + Workers list */}
        <aside className="w-52 border-r border-border bg-muted/30 flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Ҷустуҷӯ..." className="pl-8 h-8 text-sm" />
            </div>
          </div>

          {/* Groups (top) */}
          <div className="p-2 border-b border-border">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <Users className="h-3 w-3" /> Гурӯҳҳо
            </div>
            <div className="space-y-0.5">
              {groups.length === 0 && (
                <div className="text-xs text-muted-foreground">Гурӯҳ нест</div>
              )}
              {groups.map(([name, list]) => (
                <button
                  key={name}
                  onClick={() => setActiveGroup(name)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded-md text-xs flex items-center justify-between transition",
                    currentGroup === name
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-accent"
                  )}
                >
                  <span className="truncate">{name}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    currentGroup === name ? "bg-primary-foreground/20" : "bg-muted"
                  )}>{list.length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Workers list (bottom) */}
          <div className="flex-1 overflow-auto p-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <HardHat className="h-3 w-3" /> Устоҳо ({currentWorkers.length})
            </div>
            <div className="space-y-0.5">
              {currentWorkers.map((w: any) => {
                const rec = attMap.get(w.id);
                return (
                  <div key={w.id} className="flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-accent">
                    <div className="flex-1 truncate font-medium">{w.fullname}</div>
                    {rec?.status && (
                      <span className="text-[10px]">
                        {rec.status === "full" ? "✓" : rec.status === "half" ? "½" : "✗"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right: Daily attendance table */}
        <main className="flex-1 overflow-auto">
          {currentWorkers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <HardHat className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Коргаре нест
            </div>
          ) : (
            <div className="p-2">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-[11px] font-semibold w-6">№</th>
                      <th className="text-left px-2 py-1.5 text-[11px] font-semibold">Ном</th>
                      <th className="text-center px-2 py-1.5 text-[11px] font-semibold">Пур</th>
                      <th className="text-center px-2 py-1.5 text-[11px] font-semibold">Ним</th>
                      <th className="text-center px-2 py-1.5 text-[11px] font-semibold">Набуд</th>
                      <th className="text-center px-2 py-1.5 text-[11px] font-semibold w-16">Соат</th>
                      <th className="text-center px-2 py-1.5 text-[11px] font-semibold w-14">⚙</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentWorkers.map((w: any, idx: number) => {
                      const rec = attMap.get(w.id);
                      const st = rec?.status;
                      return (
                        <tr key={w.id} className={cn(
                          "border-t border-border transition",
                          st === "full" && "bg-success/10",
                          st === "half" && "bg-warning/10",
                          st === "absent" && "bg-destructive/10",
                        )}>
                          <td className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</td>
                          <td className="px-2 py-1">
                            <div className="font-medium text-sm leading-tight">{w.fullname}</div>
                            {w.position && <div className="text-[10px] text-muted-foreground leading-tight">{w.position}</div>}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <CheckBox active={st === "full"} tone="success" onClick={() => quickMark(w, "full")} />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <CheckBox active={st === "half"} tone="warning" onClick={() => quickMark(w, "half")} />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <CheckBox active={st === "absent"} tone="destructive" onClick={() => quickMark(w, "absent")} />
                          </td>
                          <td className="px-2 py-1 text-center text-xs font-semibold">
                            {rec?.hours != null ? `${rec.hours}с` : "—"}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPicker({ worker: w, current: rec })}>
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {picker && (
        <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">{picker.worker.fullname}</DialogTitle>
              {picker.worker.position && (
                <div className="text-sm text-muted-foreground">{picker.worker.position}</div>
              )}
            </DialogHeader>
            <PickForm
              current={picker.current}
              onSubmit={(status, hours) => startMark(picker.worker, status, hours)}
              busy={mark.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      <FaceCaptureDialog
        open={!!faceWorker}
        onOpenChange={(o) => { if (!o) { setFaceWorker(null); setPendingMark(null); } }}
        title={faceWorker ? `Тасдиқи рӯй — ${faceWorker.fullname}` : "Тасдиқи рӯй"}
        subtitle="Рӯятонро дар доираи камера нигоҳ доред ва акс гиред"
        onCapture={onFaceCapture}
        busy={verifying || mark.isPending}
      />
    </div>
  );
}

function CheckBox({ active, tone, onClick }: { active: boolean; tone: "success" | "warning" | "destructive"; onClick: () => void }) {
  const toneClass = active
    ? tone === "success" ? "bg-success border-success text-success-foreground"
      : tone === "warning" ? "bg-warning border-warning text-warning-foreground"
      : "bg-destructive border-destructive text-destructive-foreground"
    : "border-border hover:border-primary bg-background";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-md border-2 transition active:scale-90",
        toneClass
      )}
    >
      {active && (tone === "destructive" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />)}
    </button>
  );
}

function PickForm({ current, onSubmit, busy }: {
  current: any; onSubmit: (status: "full" | "half" | "absent", hours: number) => void; busy: boolean;
}) {
  const [status, setStatus] = useState<"full" | "half" | "absent">(current?.status ?? "full");
  const [hours, setHours] = useState<string>(() => current?.hours != null ? String(current.hours) : "8");

  const setPreset = (s: "full" | "half" | "absent") => {
    setStatus(s);
    setHours(s === "full" ? "8" : s === "half" ? "4" : "0");
  };

  const hoursNum = status === "absent" ? 0 : Math.max(0, Math.min(24, Number(hours) || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setPreset("full")}
          className={cn("rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition",
            status === "full" ? "bg-success text-success-foreground border-success" : "border-border hover:border-success")}>
          <CheckCircle2 className="h-6 w-6" /><span className="text-sm font-bold">Пур</span><span className="text-[10px] opacity-80">8 соат</span>
        </button>
        <button type="button" onClick={() => setPreset("half")}
          className={cn("rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition",
            status === "half" ? "bg-warning text-warning-foreground border-warning" : "border-border hover:border-warning")}>
          <CircleSlash className="h-6 w-6" /><span className="text-sm font-bold">Ним</span><span className="text-[10px] opacity-80">4 соат</span>
        </button>
        <button type="button" onClick={() => setPreset("absent")}
          className={cn("rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition",
            status === "absent" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:border-destructive")}>
          <X className="h-6 w-6" /><span className="text-sm font-bold">Набуд</span><span className="text-[10px] opacity-80">0 соат</span>
        </button>
      </div>

      {status !== "absent" && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Clock className="h-4 w-4" />Соатҳои корӣ
          </label>
          <Input type="number" min={0} max={24} step={0.5}
            value={hours} onChange={(e) => setHours(e.target.value)}
            className="h-12 text-lg text-center" />
        </div>
      )}

      <DialogFooter>
        <Button type="button" size="lg" className="w-full h-12 text-base"
          disabled={busy}
          onClick={() => onSubmit(status, status === "absent" ? 0 : hoursNum)}>
          Захира кардан
        </Button>
      </DialogFooter>
    </div>
  );
}
