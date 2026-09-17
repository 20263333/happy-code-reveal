import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

// Keeps the last loaded screens in localStorage so returning to a page (or a
// full page reload) paints instantly from cache while fresh data loads in the
// background. Critical on the self-hosted VPS where round-trips are slower.
const KEY = "binosoz-query-cache-v1";
const MAX_AGE = 12 * 60 * 60 * 1000; // 12h
const MAX_BYTES = 3_000_000; // stay well under the localStorage quota

export function setupQueryPersistence(qc: QueryClient) {
  if (typeof window === "undefined") return;
  const flagged = qc as QueryClient & { __persistSetup?: boolean };
  if (flagged.__persistSetup) return;
  flagged.__persistSetup = true;

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { ts: number; state: unknown };
      if (parsed?.ts && Date.now() - parsed.ts < MAX_AGE) {
        hydrate(qc, parsed.state as any);
      } else {
        localStorage.removeItem(KEY);
      }
    }
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    try {
      const state = dehydrate(qc, {
        shouldDehydrateQuery: (q) => q.state.status === "success",
      });
      const payload = JSON.stringify({ ts: Date.now(), state });
      if (payload.length > MAX_BYTES) return;
      localStorage.setItem(KEY, payload);
    } catch {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
  };

  qc.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 2_000);
  });

  window.addEventListener("pagehide", save);
}

export function clearQueryPersistence() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
