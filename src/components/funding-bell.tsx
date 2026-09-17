import { useEffect, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/preferences";
import { playDing } from "@/lib/notify-sound";
import { clearFundingNotifications, fundingInbox } from "@/lib/funding.functions";

export function FundingBell() {
  const { user } = useAuth();
  const { tr } = useT();
  const { formatMoney } = usePrefs();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const inbox = useServerFn(fundingInbox);
  const clearFn = useServerFn(clearFundingNotifications);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["funding-inbox", user?.id],
    queryFn: () => inbox(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  type Item = { id: string; project_id: string; project_name: string; category: string; amount: number; status: string };
  const pending = (data?.pending ?? []) as Item[];
  const decided = (data?.decided ?? []) as Item[];
  const count = pending.length + decided.length;

  const prev = useRef(count);
  const inited = useRef(false);
  useEffect(() => {
    if (!inited.current) { inited.current = true; prev.current = count; return; }
    if (count > prev.current) { playDing(); playDing(0.25); }
    prev.current = count;
  }, [count]);

  const clear = useMutation({
    mutationFn: () => clearFn({ data: { ids: [...pending, ...decided].map((r) => r.id) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funding-inbox"] }),
  });

  if (!user) return null;

  const go = (projectId: string) => {
    setOpen(false);
    navigate({ to: "/projects/$id", params: { id: projectId }, search: { tab: "requests" } as any });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title={tr("Заявка")}>
          <ClipboardList className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>📝 {tr("Заявка")}</span>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs font-normal"
              disabled={clear.isPending}
              onClick={(e) => { e.preventDefault(); clear.mutate(); }}
            >
              {tr("Тоза кардан")}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {tr("Заявкаи нав нест")}
          </div>
        )}
        {pending.map((r) => (
          <DropdownMenuItem key={r.id} className="flex flex-col items-start gap-0.5" onSelect={() => go(r.project_id)}>
            <span className="text-sm font-medium">{formatMoney(r.amount)} · {tr(r.category)}</span>
            <span className="text-xs text-muted-foreground">
              {r.project_name} — {tr("Тасдиқро интизор аст")}
            </span>
          </DropdownMenuItem>
        ))}
        {decided.map((r) => (
          <DropdownMenuItem key={r.id} className="flex flex-col items-start gap-0.5" onSelect={() => go(r.project_id)}>
            <span className="text-sm font-medium">{formatMoney(r.amount)} · {tr(r.category)}</span>
            <span className={`text-xs ${r.status === "approved" ? "text-emerald-600" : "text-destructive"}`}>
              {r.project_name} — {r.status === "approved" ? tr("Қабул шуд") : tr("Рад шуд")}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
