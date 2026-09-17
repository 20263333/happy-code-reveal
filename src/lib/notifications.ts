import { uuid } from "@/lib/uuid";
import { supabase } from "@/integrations/supabase/client";

export type MediaItem = { path: string; type: "image" | "video" };

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  media_items: MediaItem[];
  contact_phone: string | null;
  created_by: string | null;
  created_at: string;
};

function normalize(row: any): Notification {
  const items: MediaItem[] = Array.isArray(row.media_items) ? row.media_items : [];
  // back-compat: fold legacy single media into list
  if (items.length === 0 && row.media_url && row.media_type) {
    items.push({ path: row.media_url, type: row.media_type });
  }
  return { ...row, media_items: items } as Notification;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await (supabase as any)
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as any[]).map(normalize);
}

export async function fetchReadIds(userId: string): Promise<Set<string>> {
  const { data, error } = await (supabase as any)
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.notification_id as string));
}

export async function markRead(notificationId: string, userId: string) {
  await (supabase as any)
    .from("notification_reads")
    .upsert({ notification_id: notificationId, user_id: userId }, { onConflict: "notification_id,user_id" });
}

export async function markAllRead(ids: string[], userId: string) {
  if (!ids.length) return;
  const rows = ids.map((id) => ({ notification_id: id, user_id: userId }));
  await (supabase as any)
    .from("notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id" });
}

export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("notification-media")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadNotificationMedia(file: File): Promise<MediaItem> {
  const type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
  const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg");
  const path = `${uuid()}.${ext}`;
  const { error } = await supabase.storage
    .from("notification-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, type };
}

export async function createNotification(input: {
  title: string;
  body: string | null;
  media_items: MediaItem[];
  contact_phone?: string | null;
}) {
  const first = input.media_items[0] ?? null;
  const { error } = await (supabase as any).from("notifications").insert({
    title: input.title,
    body: input.body,
    media_url: first?.path ?? null,
    media_type: first?.type ?? null,
    media_items: input.media_items,
    contact_phone: input.contact_phone ?? null,
  });
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await (supabase as any).from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchViewCounts(): Promise<Record<string, number>> {
  const { getNotificationViewCounts } = await import("@/lib/notifications.functions");
  try {
    return await getNotificationViewCounts();
  } catch {
    return {};
  }
}
