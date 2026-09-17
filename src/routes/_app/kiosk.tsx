import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LogOut, Loader2, Monitor, Building2, Home, ScanLine, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { kioskStatus, kioskUnlock, kioskLock } from "@/lib/kiosk.functions";
import { useAppLogo } from "@/lib/app-logos";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kiosk")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { start?: "1" } =>
    s.start === "1" || s.start === 1 ? { start: "1" } : {},

  component: KioskLayout,
});

function KioskLayout() {
  const logoUrl = useAppLogo("kiosk");
  const statusFn = useServerFn(kioskStatus);
  const unlockFn = useServerFn(kioskUnlock);
  const lockFn = useServerFn(kioskLock);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const navigate = useNavigate();

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["kiosk-status"],
    queryFn: () => statusFn(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    document.documentElement.classList.add("kiosk-mode");
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("start") === "1") setShowPin(true);
    }
    return () => document.documentElement.classList.remove("kiosk-mode");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setBusy(true);
    try {
      const r = await unlockFn({ data: { pin } });
      if (r.ok) {
        toast.success("Kiosk кушода шуд");
        await refetch();
        setPin("");
      } else {
        const msgs: Record<string, string> = {
          bad_pin: "PIN-и нодуруст", disabled: "Kiosk фаъол нест",
          no_pin: "PIN танзим нашуд", no_access: "Дастрасӣ надоред",
        };
        toast.error(msgs[r.reason] ?? "Хатогӣ");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Хатогӣ");
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    await lockFn();
    await refetch();
    navigate({ to: "/dashboard" });
  };

  if (isLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!status?.unlocked && !showPin) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white z-50">
        <div className="min-h-full flex items-center justify-center p-6">
          <div className="w-full max-w-4xl space-y-8">
            <div className="text-center space-y-3">
              <div className="mx-auto w-24 h-24 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-lg">
                <img src={logoUrl} alt="Binosoz.tj" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-4xl font-bold">Binosoz.tj Kiosk</h1>
              <p className="text-slate-300 text-lg">Экрани сенсории намоиш ва фурӯши квартираҳо</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Step icon={<Building2 className="h-6 w-6" />} n="1" title="Проектро интихоб кунед" text="Аз рӯйхати проектҳо (ЖК/Комплекс) якеро зер кунед." />
              <Step icon={<Home className="h-6 w-6" />} n="2" title="Блок → Ошёна → Квартира" text="Блокҳо ва ошёнаҳо дар паҳлӯ, квартираҳо чун шахматка бо ранг: сабз=холӣ, зард=брон, кабуд=рассрочка, сурх=фурӯхта." />
              <Step icon={<Monitor className="h-6 w-6" />} n="3" title="Схема ва 3D тур" text="Схемаи квартираро дидан ё тугмаи 3D-ро пахш карда сайри 360° кушода мешавад." />
              <Step icon={<ScanLine className="h-6 w-6" />} n="4" title="Паспортро сканер кунед" text="Тугмаи «Фурӯш» → паспорт (пеш ва пас) → маълумоти клиент автоматӣ пур мешавад." />
              <Step icon={<FileText className="h-6 w-6" />} n="5" title="Шартнома ва чоп" text="Пас аз фурӯш шартнома омода — тугмаи «Шартнома»-ро пахш карда чоп мекунед." />
              <Step icon={<Lock className="h-6 w-6" />} n="6" title="Бехатарӣ бо PIN" text="Танҳо соҳиб ё корманди мансабдор бо PIN-код метавонад ба Kiosk ворид шавад." />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Button size="lg" onClick={() => setShowPin(true)} className="h-14 px-8 text-lg">
                Оғози Kiosk <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Link to="/dashboard" className="text-sm text-slate-400 hover:text-white px-4 py-2">
                Бозгашт ба dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.unlocked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white z-50">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 p-8">
          <div className="text-center space-y-2">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-lg">
              <img src={logoUrl} alt="Binosoz.tj" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold">Binosoz.tj Kiosk</h1>
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
          <button type="button" onClick={() => { setShowPin(false); setPin(""); }} className="block w-full text-center text-sm text-slate-400 hover:text-white">
            ← Бозгашт
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-border">
            <img src={logoUrl} alt="Binosoz.tj" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-lg">Binosoz.tj Kiosk</div>
            <div className="text-xs text-muted-foreground">Экрани фурӯш</div>
          </div>
        </div>
        <Button variant="outline" size="lg" onClick={lock} className="h-12">
          <LogOut className="h-5 w-5 mr-2" /> Қулф
        </Button>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function Step({ icon, n, title, text }: { icon: React.ReactNode; n: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4 flex gap-3">
      <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/20 text-primary flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-xs text-slate-400">Қадами {n}</div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-slate-300 mt-1">{text}</div>
      </div>
    </div>
  );
}
