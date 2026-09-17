import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LogOut, Loader2, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { kioskStatus, kioskPublicUnlock, kioskLock, kioskListProjects } from "@/lib/kiosk.functions";
import { KioskProjectView } from "@/components/kiosk/kiosk-project-view";
import { toast } from "sonner";

export const Route = createFileRoute("/kiosk-screen/$token")({
  ssr: false,
  component: KioskScreen,
});

function KioskScreen() {
  const { token } = Route.useParams();
  const statusFn = useServerFn(kioskStatus);
  const unlockFn = useServerFn(kioskPublicUnlock);
  const lockFn = useServerFn(kioskLock);
  const qc = useQueryClient();

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["kiosk-status"],
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
        toast.success("Kiosk кушода шуд");
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
    setProjectId(null);
    qc.removeQueries({ queryKey: ["kiosk-projects"] });
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
            <h1 className="text-3xl font-bold">Kiosk Mode</h1>
            <p className="text-slate-400">PIN-кодро ворид кунед</p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-16 text-center text-3xl tracking-[0.5em] bg-slate-800 border-slate-700 text-white"
            placeholder="••••"
          />
          <Button type="submit" size="lg" disabled={busy || !pin} className="w-full h-14 text-lg">
            {busy ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
            Кушодан
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold">BS</div>
          <div>
            <div className="font-bold text-lg">BINO SOZ • Kiosk</div>
            <div className="text-xs text-muted-foreground">Экрани фурӯш</div>
          </div>
        </div>
        <Button variant="outline" size="lg" onClick={lock} className="h-12">
          <LogOut className="h-5 w-5 mr-2" /> Қулф
        </Button>
      </header>
      <main className="flex-1 overflow-hidden">
        {projectId ? (
          <KioskProjectView projectId={projectId} onBack={() => setProjectId(null)} />
        ) : (
          <ProjectPicker onSelect={setProjectId} />
        )}
      </main>
    </div>
  );
}

function ProjectPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const listFn = useServerFn(kioskListProjects);
  const { data: projects, isLoading } = useQuery({
    queryKey: ["kiosk-projects"],
    queryFn: () => listFn(),
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!projects?.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Building2 className="h-20 w-20 mx-auto mb-4 opacity-30" />
          <p className="text-xl">Проект нест</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Проектро интихоб кунед</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p: any) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition"
          >
            <Building2 className="h-10 w-10 text-primary mb-3" />
            <div className="text-2xl font-bold">{p.name}</div>
            {p.location && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                <MapPin className="h-4 w-4" />{p.location}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
