import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutGrid, Table2, BarChart3, LayoutDashboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export type DashboardMetric = {
  key: string;
  label: string;
  value: ReactNode;
  raw?: number;
  money?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "default" | "success" | "warning" | "destructive" | "accent";
  to?: string;
  render?: (props: { metric: DashboardMetric }) => ReactNode;
};

export type DashboardViewMode = "cards" | "table" | "analytics" | "bento";

const MODES: { id: DashboardViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "cards", label: "Карточкаҳо", icon: LayoutGrid },
  { id: "table", label: "Ҷадвали компактӣ", icon: Table2 },
  { id: "analytics", label: "Ҷадвали таҳлилӣ", icon: BarChart3 },
  { id: "bento", label: "Намуди васеъ", icon: LayoutDashboard },
];

/** Choice is stored per company so each company sees its own dashboard layout. */
export function useDashboardView(companyId?: string | null) {
  const storageKey = `dashboard-view:${companyId ?? "none"}`;
  const [mode, setMode] = useState<DashboardViewMode>("cards");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey) as DashboardViewMode | null;
    setMode(saved && MODES.some((m) => m.id === saved) ? saved : "cards");
  }, [storageKey]);

  const change = (next: DashboardViewMode) => {
    setMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, next);
  };

  return { mode, setMode: change };
}

export function DashboardViewSwitcher({ mode, onChange }: { mode: DashboardViewMode; onChange: (m: DashboardViewMode) => void }) {
  const { tr } = useT();
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{tr(current.label)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <DropdownMenuLabel>{tr("Намуди ҷадвал")}</DropdownMenuLabel>
        {MODES.map((m) => {
          const MIcon = m.icon;
          return (
            <DropdownMenuItem key={m.id} onSelect={() => onChange(m.id)} className="gap-2">
              <MIcon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{tr(m.label)}</span>
              {m.id === mode && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ACCENT_TEXT: Record<string, string> = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
  accent: "text-accent",
};
const ACCENT_BG: Record<string, string> = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  accent: "bg-accent",
};

export function DashboardMetrics({ metrics, mode }: { metrics: DashboardMetric[]; mode: DashboardViewMode }) {
  const { tr } = useT();

  if (mode === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          if (m.render) {
            return <m.render key={m.key} metric={m} />;
          }
          return <StatCard key={m.key} label={m.label} value={m.value} icon={m.icon} accent={m.accent} to={m.to} />;
        })}
      </div>
    );
  }

  if (mode === "table") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{tr("Нишондиҳанда")}</th>
              <th className="px-4 py-3 text-right">{tr("Қиймат")}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const Icon = m.icon;
              const row = (
                <>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", ACCENT_TEXT[m.accent ?? "default"])} />
                      {m.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-display text-base font-semibold tabular-nums">{m.value}</td>
                </>
              );
              return (
                <tr key={m.key} className="border-t border-border transition hover:bg-muted/40">
                  {m.to ? (
                    <>
                      <td className="p-0" colSpan={2}>
                        <Link to={m.to} className="block">
                          <table className="w-full"><tbody><tr>{row}</tr></tbody></table>
                        </Link>
                      </td>
                    </>
                  ) : row}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (mode === "analytics") {
    const max = Math.max(1, ...metrics.map((m) => Math.abs(m.raw ?? 0)));
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{tr("Нишондиҳанда")}</th>
              <th className="px-4 py-3 text-right">{tr("Қиймат")}</th>
              <th className="hidden px-4 py-3 sm:table-cell">{tr("Ҳисса")}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const Icon = m.icon;
              const pct = Math.round((Math.abs(m.raw ?? 0) / max) * 100);
              return (
                <tr key={m.key} className="border-t border-border transition hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", ACCENT_TEXT[m.accent ?? "default"])} />
                      {m.to ? <Link to={m.to} className="hover:underline">{m.label}</Link> : m.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-display text-base font-semibold tabular-nums">{m.value}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all", ACCENT_BG[m.accent ?? "default"])} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // bento
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        const wide = i % 5 === 0;
        const content = (
          <>
            <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", ACCENT_BG[m.accent ?? "default"], "bg-opacity-15")}>
              <Icon className={cn("h-4 w-4", ACCENT_TEXT[m.accent ?? "default"])} />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</p>
            <p className={cn("mt-2 font-display font-semibold tracking-tight", wide ? "text-3xl" : "text-xl")}>{m.value}</p>
          </>
        );
        const cls = cn(
          "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elegant)]",
          wide && "col-span-2 md:row-span-1",
        );
        return m.to
          ? <Link key={m.key} to={m.to} className={cn(cls, "block hover:border-primary/40")}>{content}</Link>
          : <div key={m.key} className={cls}>{content}</div>;
      })}
    </div>
  );
}
