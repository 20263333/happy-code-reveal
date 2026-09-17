import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";


export function PageHeader({
  title, subtitle, actions, className,
}: { title: string; subtitle?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6", className)}>
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, trend, accent, to,
}: {
  label: string;
  value: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  accent?: "default" | "success" | "warning" | "destructive" | "accent";
  to?: string;
}) {
  const accentMap = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    accent: "bg-accent/15 text-accent",
  };
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{value}</p>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accentMap[accent ?? "default"])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </>
  );
  const base = "group relative block overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elegant)]";
  if (to) {
    return (
      <Link to={to} className={cn(base, "cursor-pointer hover:border-primary/40")}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}


export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
