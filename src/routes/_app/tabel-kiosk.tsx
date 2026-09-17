import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HardHat, ArrowLeft, Clock, CheckCircle2, X, CircleSlash, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { verifyWorkerFaceAuthed } from "@/lib/face-id.functions";
import { FaceCaptureDialog } from "@/components/face-capture-dialog";

export const Route = createFileRoute("/_app/tabel-kiosk")({
  head: () => ({ meta: [{ title: "Табел-Kiosk — Binosoz.tj" }] }),
  component: TabelKioskPage,
});

function TabelKioskPage() {
  const { companyId, isOwner, isAccountant, isManager } = useAuth();
  const canEdit = isOwner || isAccountant || isManager;
  const qc = useQueryClient();
  const verifyFn = useServerFn(verifyWorkerFaceAuthed);
  const [search, setSearch] = useState("");
  const [picker, setPicker] = useState<any>(null);
  const [now, setNow] = useState(new Date());
  const [faceWorker, setFaceWorker] = useState<any>(null);
  const [pendingMark, setPendingMark] = useState<{ workerId: string; status: string; hours: number | null } | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = now.toISOString().slice(0, 10);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-kiosk", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("workers").select("*")
        .eq("company_id", companyId).eq("is_active", true).order("fullname");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-kiosk", companyId, today],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any).from("attendance")
        .select("*").eq("company_id", companyId).eq("date", today);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const attMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of attendance) m.set(a.worker_id, a);
    return m;
  }, [attendance]);

  const mark = useMutation({
    mutationFn: async ({ workerId, status, hours, face_verified, verification_photo_path, face_confidence }: { workerId: string; status: string; hours: number | null; face_verified?: boolean; verification_photo_path?: string | null; face_confidence?: number | null }) => {
      const { data: prev } = await (supabase as any).from("attendance")
        .select("id").eq("worker_id", workerId).eq("date", today).maybeSingle();
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = { status, hours, face_verified: face_verified ?? false, verification_photo_path: verification_photo_path ?? null, face_confidence: face_confidence ?? null };
      if (prev) {
        const { error } = await (supabase as any).from("attendance")
          .update(payload).eq("id", prev.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("attendance").insert({
          worker_id: workerId, company_id: companyId, date: today, created_by: user?.id, ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-kiosk", companyId, today] });
      toast.success("Қайд шуд ✓");
      setPicker(null);
      setFaceWorker(null);
      setPendingMark(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startMark = (worker: any, status: string, hours: number | null) => {
    if (worker.face_photo_path) {
      setFaceWorker(worker);
      setPendingMark({ workerId: worker.id, status, hours });
    } else {
      // Коргар акси рӯй надорад — қайд бе тасдиқи рӯй сабт мешавад
      mark.mutate({ workerId: worker.id, status, hours, face_verified: false });
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
        workerId: faceWorker.id,
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

  const filtered = workers.filter((w: any) =>
    !search || w.fullname.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    marked: attendance.length,
    full: attendance.filter((a: any) => a.status === "full").length,
    half: attendance.filter((a: any) => a.status === "half").length,
    absent: attendance.filter((a: any) => a.status === "absent").length,
    total: workers.length,
  };

  if (!canEdit) {
    return <div className="p-8 text-center text-muted-foreground">Дастрасӣ маҳдуд аст</div>;
  }

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Link to="/attendance">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <div className="text-lg font-bold">Табел — Kiosk</div>
          <div className="text-xs text-muted-foreground">
            {now.toLocaleDateString("tg-TJ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" • "}
            {now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Қайдшуда:</span>
          <span className="font-bold">{stats.marked}/{stats.total}</span>
          <span className="text-success">✓ {stats.full}</span>
          <span className="text-warning-foreground">½ {stats.half}</span>
          <span className="text-destructive">✗ {stats.absent}</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Ном ё вазифаро ҷустуҷӯ кунед..."
            className="pl-11 h-12 text-lg" />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <HardHat className="h-12 w-12 mx-auto mb-3 opacity-40" />
            Коргаре ёфт нашуд
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-w-7xl mx-auto">
            {filtered.map((w: any) => {
              const rec = attMap.get(w.id);
              const st = rec?.status;
              const hrs = rec?.hours;
              return (
                <button
                  key={w.id}
                  onClick={() => setPicker({ worker: w, current: rec })}
                  className={cn(
                    "relative rounded-2xl border-2 p-4 min-h-[120px] flex flex-col items-center justify-center text-center transition active:scale-95",
                    st === "full" && "bg-success/20 border-success text-success-foreground",
                    st === "half" && "bg-warning/25 border-warning text-warning-foreground",
                    st === "absent" && "bg-destructive/20 border-destructive text-destructive",
                    !st && "bg-card border-border hover:border-primary hover:bg-primary/5",
                  )}
                >
                  {st && (
                    <div className="absolute top-2 right-2 text-2xl">
                      {st === "full" ? "✓" : st === "half" ? "½" : "✗"}
                    </div>
                  )}
                  <HardHat className="h-8 w-8 mb-2 opacity-70" />
                  <div className="font-bold text-sm leading-tight">{w.fullname}</div>
                  {w.position && <div className="text-[11px] opacity-70 mt-0.5">{w.position}</div>}
                  {st && hrs != null && (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">
                      <Clock className="h-3 w-3" />{hrs} с
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
              worker={picker.worker}
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

function PickForm({ worker, current, onSubmit, busy }: {
  worker: any; current: any; onSubmit: (status: string, hours: number | null) => void; busy: boolean;
}) {
  const [status, setStatus] = useState<string>(current?.status ?? "full");
  const [hours, setHours] = useState<string>(() => {
    if (current?.hours != null) return String(current.hours);
    return "8";
  });

  const setPreset = (s: string) => {
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
            <Clock className="h-4 w-4" />Соатҳои корӣ (агар лозим бошад иваз кунед)
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
