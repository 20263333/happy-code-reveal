import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { fetchNotifications, fetchReadIds } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { playDing } from "@/lib/notify-sound";

export function NotificationsBell() {
  const { user, isOwner, isPlatformAdmin } = useAuth();
  const { tr } = useT();
  const qc = useQueryClient();
  

  const enabled = !!user && (isOwner || isPlatformAdmin);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: fetchNotifications,
    enabled,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const { data: readIds = new Set<string>() } = useQuery({
    queryKey: ["notifications-read", user?.id],
    queryFn: () => fetchReadIds(user!.id),
    enabled,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications-list"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, qc]);

  const unread = items.filter((n) => !readIds.has(n.id));

  // Play a "ding" whenever the unread count increases (new advertisement arrived).
  const prevUnreadRef = useRef<number>(unread.length);
  const initedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (!initedRef.current) { initedRef.current = true; prevUnreadRef.current = unread.length; return; }
    if (unread.length > prevUnreadRef.current) playDing();
    prevUnreadRef.current = unread.length;
  }, [enabled, unread.length]);

  if (!enabled) return null;

  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground"
      aria-label={tr("Уведомления")}
    >
      <Bell className="h-4 w-4" />
      {unread.length > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unread.length > 99 ? "99+" : unread.length}
        </span>
      )}
    </Link>
  );
}
