import { useEffect } from "react";
import { Check } from "lucide-react";

export function SuccessSplash({
  open,
  onDone,
  title = "Бо муваффақият тасдиқ шуд!",
  subtitle,
  duration = 1800,
}: {
  open: boolean;
  onDone: () => void;
  title?: string;
  subtitle?: string;
  duration?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(onDone, duration);
    return () => clearTimeout(id);
  }, [open, duration, onDone]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onDone}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute h-28 w-28 rounded-full bg-emerald-500/30 animate-ping" />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-lg animate-scale-in">
          <Check className="h-14 w-14 text-white" strokeWidth={3} />
        </span>
      </div>
      <p className="text-xl font-bold animate-fade-in">{title}</p>
      {subtitle && <p className="text-sm text-muted-foreground animate-fade-in">{subtitle}</p>}
    </div>
  );
}
