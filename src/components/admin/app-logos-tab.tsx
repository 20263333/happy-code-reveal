import { uuid } from "@/lib/uuid";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { invalidateAppLogos, LOGO_FALLBACK, type AppLogos, type LogoSlot } from "@/lib/app-logos";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

const SLOTS: { key: LogoSlot; label: string; hint: string }[] = [
  { key: "light", label: "Логотипи асосӣ (равшан)", hint: "Auth, Trust, PWA install" },
  { key: "dark", label: "Логотипи торик", hint: "Sidebar / favicon" },
  { key: "kiosk", label: "Логотипи Kiosk", hint: "Экрани фурӯш" },
];

export function AppLogosTab() {
  const [logos, setLogos] = useState<AppLogos>({});
  const [busy, setBusy] = useState<LogoSlot | null>(null);
  const refs = useRef<Record<LogoSlot, HTMLInputElement | null>>({
    light: null,
    dark: null,
    kiosk: null,
  });

  async function load() {
    const { data } = await (supabase as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "app_logos")
      .maybeSingle();
    setLogos((data?.value ?? {}) as AppLogos);
  }

  useEffect(() => {
    load();
  }, []);

  async function persist(next: AppLogos) {
    const { error } = await (supabase as any)
      .from("platform_settings")
      .upsert({ key: "app_logos", value: next }, { onConflict: "key" });
    if (error) throw error;
    setLogos(next);
    invalidateAppLogos();
  }

  async function upload(slot: LogoSlot, file: File) {
    try {
      setBusy(slot);
      const prev = logos[slot];
      if (prev?.path) {
        await supabase.storage.from("app-logos").remove([prev.path]).catch(() => {});
      }
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${slot}-${uuid()}.${ext}`;
      const { error } = await supabase.storage
        .from("app-logos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data, error: sErr } = await supabase.storage
        .from("app-logos")
        .createSignedUrl(path, TEN_YEARS);
      if (sErr || !data?.signedUrl) throw sErr ?? new Error("Signed URL error");
      await persist({ ...logos, [slot]: { path, url: data.signedUrl } });
      toast.success("Логотип нав шуд");
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ");
    } finally {
      setBusy(null);
      const inp = refs.current[slot];
      if (inp) inp.value = "";
    }
  }

  async function reset(slot: LogoSlot) {
    if (!confirm("Ба ҳолати аслӣ баргардонам?")) return;
    try {
      setBusy(slot);
      const prev = logos[slot];
      if (prev?.path) {
        await supabase.storage.from("app-logos").remove([prev.path]).catch(() => {});
      }
      const next = { ...logos };
      delete next[slot];
      await persist(next);
      toast.success("Ба ҳолати аслӣ баргардонда шуд");
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Логотипҳои барнома</h2>
        <p className="text-xs text-muted-foreground">
          Иваз кардани логотипҳои асосии система. Барои қатъ кардани иваз — «Аслӣ».
        </p>
      </div>

      <div className="grid gap-3">
        {SLOTS.map(({ key, label, hint }) => {
          const current = logos[key];
          const shown = current?.url ?? LOGO_FALLBACK[key];
          return (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-muted">
                {shown ? (
                  <img src={shown} alt={label} className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {current ? "Иваз шуда" : "Аслӣ"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === key}
                onClick={() => refs.current[key]?.click()}
              >
                {busy === key ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                Аз галерея
              </Button>
              {current && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy === key}
                  onClick={() => reset(key)}
                  title="Ба ҳолати аслӣ"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
              <input
                ref={(el) => {
                  refs.current[key] = el;
                }}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(key, f);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
