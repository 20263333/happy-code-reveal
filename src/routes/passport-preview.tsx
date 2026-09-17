import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Crop, Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fileToDataUrl,
  getScanVariants,
  setScanVariants,
  setSelectedVariant,
  type ScanVariants,
} from "@/lib/passport-scan-store";

export const Route = createFileRoute("/passport-preview")({
  head: () => ({
    meta: [
      { title: "Проверка фото паспорта — Binosoz.tj" },
      { name: "description", content: "Сравните оригинал, улучшенное и обрезанное изображение паспорта." },
      { property: "og:title", content: "Проверка фото паспорта — Binosoz.tj" },
      { property: "og:description", content: "Сравните оригинал, улучшенное и обрезанное изображение паспорта." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassportPreviewPage,
});

const MIN_W = 1280;
const MIN_H = 720;

type Variant = keyof ScanVariants;

const LABELS: Record<Variant, string> = {
  original: "Оригинал",
  enhanced: "Улучшенное",
  cropped: "Обрезанное",
};

function PassportPreviewPage() {
  const navigate = useNavigate();
  const galleryInput = useRef<HTMLInputElement>(null);
  const [variants, setVariants] = useState<ScanVariants>({ original: null, enhanced: null, cropped: null });
  const [active, setActive] = useState<Variant>("original");
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [lowQuality, setLowQuality] = useState(false);

  useEffect(() => {
    const v = getScanVariants();
    setVariants(v);
    setActive(v.cropped ? "cropped" : v.enhanced ? "enhanced" : "original");
    setReady(true);
  }, []);

  const tabs = useMemo(
    () => (Object.keys(LABELS) as Variant[]).filter((k) => !!variants[k]),
    [variants],
  );
  const url = variants[active] ?? variants.original;

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const data = await fileToDataUrl(file);
    setScanVariants({ original: data, enhanced: null, cropped: null });
    setVariants({ original: data, enhanced: null, cropped: null });
    setActive("original");
    setDims(null);
  };

  const onUse = (variant: Variant) => {
    if (!dims) return;
    const long = Math.max(dims.w, dims.h);
    const short = Math.min(dims.w, dims.h);
    if (long < MIN_W || short < MIN_H) {
      setLowQuality(true);
      return;
    }
    setSelectedVariant(variant);
    navigate({ to: "/passport-ocr" });
  };

  return (
    <main className="min-h-svh bg-gradient-to-b from-background via-background to-muted/40">
      <div className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Проверьте фото</h1>
          <p className="text-sm text-muted-foreground">
            Сравните варианты и выберите наиболее читаемое изображение документа.
          </p>
        </header>

        {tabs.length > 1 && (
          <div className="mb-4 inline-flex rounded-xl border border-border/70 bg-card/70 p-1 backdrop-blur">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActive(t);
                  setDims(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  active === t
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {LABELS[t]}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-3 shadow-lg backdrop-blur sm:p-4">
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-muted">
            {!ready && <div className="absolute inset-0 animate-pulse bg-muted" />}
            {ready && url && (
              <img
                key={active}
                src={url}
                alt={`Фото паспорта — ${LABELS[active]}`}
                className="animate-fade-in absolute inset-0 h-full w-full object-contain"
                onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
            )}
            {ready && !url && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Фото не выбрано — вернитесь и сделайте снимок паспорта.
              </div>
            )}
          </div>
          {dims && (
            <p className="px-1 pt-3 text-xs text-muted-foreground">
              {LABELS[active]} · {dims.w}×{dims.h} px
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            className="h-12 rounded-xl shadow-lg shadow-primary/20"
            disabled={!variants.enhanced || !dims}
            onClick={() => {
              setActive("enhanced");
              onUse("enhanced");
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Использовать улучшенное
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="h-12 rounded-xl"
            disabled={!variants.original || !dims}
            onClick={() => {
              setActive("original");
              onUse("original");
            }}
          >
            <Check className="mr-2 h-4 w-4" />
            Использовать оригинал
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 rounded-xl"
            onClick={() => navigate({ to: "/passport-scanner" })}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Переснять
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 rounded-xl"
            onClick={() => galleryInput.current?.click()}
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            Выбрать другое фото
          </Button>
        </div>

        {variants.cropped && (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Crop className="h-3.5 w-3.5" />
            Границы документа определены автоматически, перспектива выровнена.
          </p>
        )}
      </div>

      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
      />

      <AlertDialog open={lowQuality} onOpenChange={setLowQuality}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Низкое качество изображения</AlertDialogTitle>
            <AlertDialogDescription>
              Качество изображения слишком низкое. Сделайте фотографию еще раз.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setLowQuality(false);
                navigate({ to: "/passport-scanner" });
              }}
            >
              Сделать снова
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
