import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShotKey = "dashboard" | "warehouse";
export type ShotLang = "ru" | "tg" | "en";
export type SiteShots = Partial<Record<ShotKey, Partial<Record<ShotLang, { path: string; url: string }>>>>;

export const SITE_SHOTS_KEY = "site_shots";

export async function fetchSiteShots(): Promise<SiteShots> {
  const { data } = await (supabase as any)
    .from("platform_settings").select("value").eq("key", SITE_SHOTS_KEY).maybeSingle();
  return (data?.value ?? {}) as SiteShots;
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
