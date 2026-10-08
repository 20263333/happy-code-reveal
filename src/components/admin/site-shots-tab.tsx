import { uuid } from "@/lib/uuid";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { fetchSiteShots, SITE_SHOTS_KEY, type ShotKey, type ShotLang, type SiteShots } from "@/lib/site-shots";
import dashboardRu from "@/assets/product/dashboard-app-ru.png.asset.json";
import dashboardTg from "@/assets/product/dashboard-app-tg.png.asset.json";
import dashboardEn from "@/assets/product/dashboard-app-en.png.asset.json";
import warehouseRu from "@/assets/product/warehouse-app-ru.png.asset.json";
import warehouseTg from "@/assets/product/warehouse-app-tg.png.asset.json";
import warehouseEn from "@/assets/product/warehouse-app-en.png.asset.json";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const FALLBACK: Record<ShotKey, Record<ShotLang, string>> = {
  dashboard: { ru: dashboardRu.url, tg: dashboardTg.url, en: dashboardEn.url },
  warehouse: { ru: warehouseRu.url, tg: warehouseTg.url, en: warehouseEn.url },
};
const KEYS: { key: ShotKey; label: string }[] = [
  { key: "dashboard", label: "Дашборд" },
  { key: "warehouse", label: "Анбор (Склад)" },
];
const LANGS: { key: ShotLang; label: string }[] = [
  { key: "tg", label: "Тоҷикӣ" }, { key: "ru", label: "Русский" }, { key: "en", label: "English" },
];

export function SiteShotsTab() {
  const [shots, setShots] = useState<SiteShots>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { fetchSiteShots().then(setShots); }, []);

  async function persist(next: SiteShots) {
    const { error } = await (supabase as any).from("platform_settings")
      .upsert({ key: SITE_SHOTS_KEY, value: next }, { onConflict: "key" });
    if (error) throw error;
    setShots(next);
  }

  async function upload(k: ShotKey, l: ShotLang, file: File) {
    const id = `${k}-${l}`;
    try {
      setBusy(id);
      const prev = shots[k]?.[l];
      if (prev?.path) await supabase.storage.from("app-logos").remove([prev.path]).catch(() => {});
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `site-${k}-${l}-${uuid()}.${ext}`;
      const { error } = await supabase.storage.from("app-logos").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data, error: sErr } = await supabase.storage.from("app-logos").createSignedUrl(path, TEN_YEARS);
      if (sErr || !data?.signedUrl) throw sErr ?? new Error("URL error");
      await persist({ ...shots, [k]: { ...(shots[k] ?? {}), [l]: { path, url: data.signedUrl } } });
      toast.success("Сурат нав шуд");
    } catch (e: any) { toast.error(e?.message ?? "Хатогӣ"); } finally { setBusy(null); }
  }

  async function reset(k: ShotKey, l: ShotLang) {
    const prev = shots[k]?.[l];
    if (!prev) return;
    try {
      setBusy(`${k}-${l}`);
      await supabase.storage.from("app-logos").remove([prev.path]).catch(() => {});
      const nextK = { ...(shots[k] ?? {}) }; delete nextK[l];
      await persist({ ...shots, [k]: nextK });
      toast.success("Ба сурати аслӣ баргашт");
    } catch (e: any) { toast.error(e?.message ?? "Хатогӣ"); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">Суратҳои барнома, ки дар вебсайт нишон дода мешаванд. Барои ҳар забон алоҳида.</p>
      {KEYS.map(({ key, label }) => (
        <div key={key} className="space-y-3">
          <h3 className="font-semibold">{label}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {LANGS.map(({ key: l, label: ll }) => {
              const cur = shots[key]?.[l]?.url ?? FALLBACK[key][l];
              const id = `${key}-${l}`;
              return (
                <div key={l} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="text-sm font-medium">{ll}</div>
                  <img src={cur} alt={`${label} ${ll}`} className="aspect-video w-full rounded-md border border-border object-cover object-top" />
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1" disabled={busy === id}>
                      <label className="cursor-pointer">
                        {busy === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Иваз
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(key, l, f); }} />
                      </label>
                    </Button>
                    {shots[key]?.[l] && (
                      <Button size="sm" variant="ghost" onClick={() => reset(key, l)} disabled={busy === id} title="Аслӣ">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
