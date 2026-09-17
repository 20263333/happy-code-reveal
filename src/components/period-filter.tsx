import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { presetRange, type RangePreset } from "@/lib/finance";
import { useT } from "@/lib/i18n";

export type PeriodPreset = RangePreset | "all";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Все время" },
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
  { value: "custom", label: "Период" },
];

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface PeriodFilterValue {
  fromDate: Date | null;
  toDate: Date | null;
  /** Ready-to-render control bar. */
  control: React.ReactNode;
  /** Human-readable label, e.g. "2026-06-01 — 2026-06-21" or "Все время". */
  label: string;
  active: boolean;
  /** Set the filter to the whole month containing the given date. */
  setMonth: (d: Date) => void;
  /** Currently displayed "from" date (for calendar highlight). */
  from: string;
}

export function usePeriodFilter(defaultPreset: PeriodPreset = "all"): PeriodFilterValue {
  const { tr } = useT();
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const init = presetRange("month");
  const [from, setFrom] = useState(toInput(init.from));
  const [to, setTo] = useState(toInput(init.to));

  const apply = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== "custom" && p !== "all") {
      const r = presetRange(p);
      setFrom(toInput(r.from));
      setTo(toInput(r.to));
    }
  };

  // Аз рӯи тақвим: давра = тамоми моҳи интихобшуда
  const setMonth = (d: Date) => {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFrom(toInput(first));
    setTo(toInput(last));
    setPreset("custom");
  };

  // Агар "С" аз "По" калонтар бошад, ҷойҳояшонро иваз мекунем.
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  const fromDate = useMemo(() => {
    if (preset === "all") return null;
    const d = new Date(`${lo}T00:00:00`); d.setHours(0, 0, 0, 0); return d;
  }, [lo, preset]);
  const toDate = useMemo(() => {
    if (preset === "all") return null;
    const d = new Date(`${hi}T00:00:00`); d.setHours(23, 59, 59, 999); return d;
  }, [hi, preset]);

  const monthValue = from.slice(0, 7);
  const shiftMonth = (delta: number) => {
    const base = monthValue ? new Date(`${monthValue}-01T00:00:00`) : new Date();
    setMonth(new Date(base.getFullYear(), base.getMonth() + delta, 1));
  };

  const label = preset === "all" ? tr("Все время") : `${from} — ${to}`;

  const control = (
    <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={preset === p.value ? "default" : "outline"}
            onClick={() => apply(p.value)}
          >
            {tr(p.label)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">{tr("Месяц")}</Label>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" onClick={() => shiftMonth(-1)} aria-label={tr("Предыдущий месяц")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              className="w-[160px]"
              value={monthValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setMonth(new Date(`${v}-01T00:00:00`));
              }}
            />
            <Button type="button" size="icon" variant="outline" onClick={() => shiftMonth(1)} aria-label={tr("Следующий месяц")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">{tr("С")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{tr("По")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      )}
      {preset !== "all" && <Badge variant="secondary">{label}</Badge>}
    </div>
  );

  return { fromDate, toDate, control, label, active: preset !== "all", setMonth, from };
}
