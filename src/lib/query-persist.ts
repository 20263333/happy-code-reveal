import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Keeps the last loaded screens in localStorage so returning to a page (or a
// full page reload) paints instantly from cache while fresh data loads in the
// background. Critical on the self-hosted VPS where round-trips are slower.
const KEY_PREFIX = "binosoz-query-cache-v2";
const OWNER_KEY = `${KEY_PREFIX}:owner`;
const MAX_AGE = 12 * 60 * 60 * 1000; // 12h
const MAX_BYTES = 3_000_000; // stay well under the localStorage quota

let activeQueryClient: QueryClient | null = null;
let activeUserId: string | null = null;

function cacheKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`;
}

function removeAllPersistedQueries() {
  if (typeof window === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith("binosoz-query-cache-")) localStorage.removeItem(key);
  }
}

export async function setupQueryPersistence(qc: QueryClient) {
  if (typeof window === "undefined") return;
  const flagged = qc as QueryClient & { __persistSetup?: boolean };
  if (flagged.__persistSetup) return;
  flagged.__persistSetup = true;
  activeQueryClient = qc;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  if (!userId) {
    qc.clear();
    removeAllPersistedQueries();
    return;
  }
  activeUserId = userId;
  const previousOwner = localStorage.getItem(OWNER_KEY);
  if (previousOwner && previousOwner !== userId) {
    qc.clear();
    removeAllPersistedQueries();
  }
  localStorage.setItem(OWNER_KEY, userId);
  const key = cacheKey(userId);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { ts: number; state: unknown };
      if (parsed?.ts && Date.now() - parsed.ts < MAX_AGE) {
        hydrate(qc, parsed.state as any);
      } else {
        localStorage.removeItem(key);
      }
    }
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    try {
      const state = dehydrate(qc, {
        shouldDehydrateQuery: (q) => q.state.status === "success",
      });
      const payload = JSON.stringify({ ts: Date.now(), state });
      if (payload.length > MAX_BYTES) return;
      localStorage.setItem(key, payload);
    } catch {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  };

  qc.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 2_000);
  });

  window.addEventListener("pagehide", save);
}

export function clearQueryPersistence() {
  activeQueryClient?.clear();
  activeUserId = null;
  try { removeAllPersistedQueries(); } catch { /* ignore */ }
}

export function switchQueryPersistenceUser(userId: string) {
  if (typeof window === "undefined") return;
  const previousOwner = localStorage.getItem(OWNER_KEY);
  if (activeUserId === userId && (!previousOwner || previousOwner === userId)) return;
  activeQueryClient?.clear();
  removeAllPersistedQueries();
  localStorage.setItem(OWNER_KEY, userId);
  activeUserId = userId;
}
