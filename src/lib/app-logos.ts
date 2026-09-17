import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import platformLogo from "@/assets/platform-logo.png.asset.json";

export type LogoSlot = "light" | "dark" | "kiosk";
export type AppLogos = Partial<Record<LogoSlot, { path: string; url: string }>>;

export const LOGO_FALLBACK: Record<LogoSlot, string> = {
  light: platformLogo.url,
  dark: platformLogo.url,
  kiosk: platformLogo.url,
};

let cache: AppLogos | null = null;
let inflight: Promise<AppLogos> | null = null;

export async function loadAppLogos(): Promise<AppLogos> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await (supabase as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "app_logos")
      .maybeSingle();
    cache = (data?.value ?? {}) as AppLogos;
    return cache;
  })();
  const res = await inflight;
  inflight = null;
  return res;
}

export function invalidateAppLogos() {
  cache = null;
}

export function useAppLogo(slot: LogoSlot): string {
  const [url, setUrl] = useState<string>(LOGO_FALLBACK[slot]);
  useEffect(() => {
    let alive = true;
    loadAppLogos().then((v) => {
      if (!alive) return;
      const custom = v[slot]?.url;
      if (custom) setUrl(custom);
    });
    return () => {
      alive = false;
    };
  }, [slot]);
  return url;
}
