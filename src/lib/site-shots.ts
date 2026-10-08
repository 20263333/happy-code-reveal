import { fixStorageUrl } from "@/lib/storage-url";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShotKey = "dashboard" | "warehouse";
export type ShotLang = "ru" | "tg" | "en";
export type SiteShots = Partial<Record<ShotKey, Partial<Record<ShotLang, { path: string; url: string }>>>>;

export const SITE_SHOTS_KEY = "site_shots";

export async function fetchSiteShots(): Promise<SiteShots> {
  const { data } = await (supabase as any)
    .from("platform_settings").select("value").eq("key", SITE_SHOTS_KEY).maybeSingle();
  const v = (data?.value ?? {}) as SiteShots;
  for (const k of Object.keys(v) as ShotKey[]) {
    const byLang = v[k] ?? {};
    for (const l of Object.keys(byLang) as ShotLang[]) {
      const e = byLang[l];
      if (e?.url) byLang[l] = { ...e, url: fixStorageUrl(e.url) };
    }
  }
  return v;
}

export function useSiteShots(): SiteShots {
  const [v, setV] = useState<SiteShots>({});
  useEffect(() => {
    let alive = true;
    fetchSiteShots().then((s) => alive && setV(s)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return v;
}
