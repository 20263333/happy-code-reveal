import { useEffect, useState } from "react";
import { Moon, Sun, Languages, Coins, Lock, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useT, type Lang } from "@/lib/i18n";
import { usePrefs, CURRENCY_LABEL, type Currency } from "@/lib/preferences";
import { NotificationsBell } from "@/components/notifications-bell";
import { FundingBell } from "@/components/funding-bell";
import { AiAssistantButton } from "@/components/ai-assistant";
import { ZhkQuickButtons } from "@/components/zhk-quick-buttons";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lockNow } from "@/lib/pin";
import { toast } from "sonner";

function ScreenRotateButton() {
  const { tr } = useT();
  const [orientation, setOrientation] = useState<"portrait" | "landscape" | "unknown">("unknown");

  useEffect(() => {
    if (typeof window === "undefined" || !window.screen?.orientation) return;
    const update = () => {
      const type = window.screen.orientation.type;
      setOrientation(type.includes("landscape") ? "landscape" : "portrait");
    };
    update();
    window.screen.orientation.addEventListener("change", update);
    return () => window.screen.orientation.removeEventListener("change", update);
  }, []);

  const toggle = async () => {
    try {
      const so = (window as any).screen?.orientation;
      if (!so) {
        toast.error(tr("Поворот экрана не поддерживается"));
        return;
      }
      const current = so.type as string;
      if (current.includes("landscape")) {
        await so.lock("portrait-primary");
      } else {
        await so.lock("landscape-primary");
      }
    } catch (e) {
      toast.error(tr("Не удалось повернуть экран. Браузер или устройство не поддерживает."));
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={tr("Повернуть экран")}
      className="hidden sm:flex"
    >
      <RotateCw className={cn("h-4 w-4", orientation === "landscape" && "rotate-90")} />
    </Button>
  );
}

export function TopbarControls({ showAi }: { showAi?: boolean }) {
  const { lang, setLang, t, tr } = useT();
  const { theme, toggleTheme, currency, setCurrency } = usePrefs();
  const { user } = useAuth();
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    if (!user) { setHasPin(false); return; }
    (supabase as any).from("profiles").select("pin_hash").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => setHasPin(!!data?.pin_hash));
  }, [user]);

  return (
    <div className="flex items-center gap-1">
      <ZhkQuickButtons />
      <AiAssistantButton show={showAi} />
      <ScreenRotateButton />
      {hasPin && (
        <Button variant="ghost" size="icon" onClick={() => lockNow()} title={tr("Заблокировать приложение")}>
          <Lock className="h-4 w-4" />
        </Button>
      )}
      <NotificationsBell />
      <FundingBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Languages className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">{lang}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <DropdownMenuRadioItem value="ru">Русский</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="tg">Тоҷикӣ</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Coins className="h-4 w-4" />
            <span className="text-xs font-medium">{currency}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("common.currency")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            {(Object.keys(CURRENCY_LABEL) as Currency[]).map((c) => (
              <DropdownMenuRadioItem key={c} value={c}>{CURRENCY_LABEL[c]}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
