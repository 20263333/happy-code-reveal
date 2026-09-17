import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLogo } from "@/lib/app-logos";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const iconUrl = useAppLogo("light");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires beforeinstallprompt — show manual instructions.
    if (isIos()) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => {
        window.removeEventListener("beforeinstallprompt", onPrompt);
        clearTimeout(t);
      };
    }

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    if (typeof localStorage !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (isIos()) {
      setIosHelp(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img
            src={iconUrl}
            alt="PLATFORM.TJ"
            className="h-14 w-14 shrink-0 rounded-xl border border-border"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-tight">Установить PLATFORM.TJ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Добавьте приложение на главный экран — быстрый запуск и работа как в обычной программе.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {iosHelp ? (
          <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              1. Нажмите <Share className="inline h-4 w-4" /> «Поделиться»
            </p>
            <p className="mt-1 flex items-center gap-2">
              2. Выберите <Plus className="inline h-4 w-4" /> «На экран Домой»
            </p>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button onClick={install} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Установить приложение
            </Button>
            <Button variant="ghost" onClick={dismiss}>
              Позже
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
