// Storage links may be saved or signed with an old/internal backend address
// (e.g. http://IP:8000 or http://127.0.0.1). Rewrite them onto the backend
// address the browser actually uses so images load on any domain.
export function fixStorageUrl<T extends string | null | undefined>(url: T): T {
  if (!url || typeof url !== "string") return url;
  const idx = url.indexOf("/storage/v1/");
  if (idx < 0) return url;
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!base) return url;
  return (base + url.slice(idx)) as T;
}
