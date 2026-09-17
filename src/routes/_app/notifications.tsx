import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, ChevronLeft, ChevronRight, Eye, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import {
  fetchNotifications,
  fetchReadIds,
  fetchViewCounts,
  getSignedMediaUrl,
  markAllRead,
  type Notification,
  type MediaItem,
} from "@/lib/notifications";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Уведомления — PLATFORM.TJ" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, isOwner, isPlatformAdmin, loading } = useAuth();
  const { tr } = useT();
  const qc = useQueryClient();

  const enabled = !!user && (isOwner || isPlatformAdmin);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: fetchNotifications,
    enabled,
  });
  const { data: readIds = new Set<string>() } = useQuery({
    queryKey: ["notifications-read", user?.id],
    queryFn: () => fetchReadIds(user!.id),
    enabled,
  });
  const { data: views = {} } = useQuery({
    queryKey: ["notifications-views"],
    queryFn: fetchViewCounts,
    enabled,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!enabled || !user || items.length === 0) return;
    const unread = items.filter((n) => !readIds.has(n.id)).map((n) => n.id);
    if (unread.length > 0) {
      markAllRead(unread, user.id).then(() => {
        qc.invalidateQueries({ queryKey: ["notifications-read", user.id] });
        qc.invalidateQueries({ queryKey: ["notifications-views"] });
      });
    }
  }, [enabled, user, items, readIds, qc]);

  if (loading) return null;
  if (!enabled) return <EmptyState icon={Bell} title="—" description="" />;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/projects">
          <ArrowLeft className="mr-1 h-4 w-4" /> {tr("Назад")}
        </Link>
      </Button>
      <PageHeader title={tr("Уведомления")} subtitle="" />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title={tr("Пока нет уведомлений")} description="" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <NotificationCard
              key={n.id}
              n={n}
              unread={!readIds.has(n.id)}
              viewers={views[n.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ n, unread, viewers }: { n: Notification; unread: boolean; viewers: number }) {
  const { tr } = useT();
  const [idx, setIdx] = useState(0);
  const media = n.media_items;
  const total = media.length;
  const current = total > 0 ? media[Math.min(idx, total - 1)] : null;

  const go = (delta: number) => {
    if (total === 0) return;
    setIdx((i) => (i + delta + total) % total);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {current ? (
          <MediaTile item={current} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {unread && (
          <Badge className="absolute left-3 top-3 h-6 px-2 text-[10px] shadow">{tr("Новое")}</Badge>
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); go(-1); }}
              aria-label={tr("Назад")}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); go(1); }}
              aria-label={tr("Вперёд")}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
              {Math.min(idx, total - 1) + 1} / {total}
            </span>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
              {media.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold">{n.title}</h3>
        {n.body && <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>}
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>{new Date(n.created_at).toLocaleString()}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {viewers} {tr("просмотров")}
          </span>
        </div>
        {n.contact_phone && (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
            <a
              href={`https://wa.me/${n.contact_phone.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#25D366] px-3 text-sm font-medium text-white hover:bg-[#1ebe5b]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
            <a
              href={`tel:${n.contact_phone}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Phone className="h-4 w-4" />
              {tr("Заказать")}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function MediaTile({ item }: { item: MediaItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    setUrl(null);
    getSignedMediaUrl(item.path).then((u) => { if (!cancel) setUrl(u); });
    return () => { cancel = true; };
  }, [item.path]);

  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  if (item.type === "video") {
    return <video src={url} controls className="h-full w-full bg-black object-cover" />;
  }
  return <img src={url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />;
}
