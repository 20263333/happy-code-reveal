import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Image as ImageIcon, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToDataUrl, setScanPreview } from "@/lib/passport-scan-store";

export const Route = createFileRoute("/passport-scan")({
  head: () => ({
    meta: [
      { title: "Сканирование паспорта — PLATFORM.TJ" },
      {
        name: "description",
        content: "Загрузите документ с камеры устройства или выберите готовое фото паспорта из галереи.",
      },
      { property: "og:title", content: "Сканирование паспорта — PLATFORM.TJ" },
      {
        property: "og:description",
        content: "Загрузите документ с камеры устройства или выберите готовое фото паспорта из галереи.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassportScanPage,
});

function PassportScanPage() {
  const navigate = useNavigate();
  const galleryInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    try {
      setScanPreview(await fileToDataUrl(file));
      navigate({ to: "/passport-preview" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-svh bg-gradient-to-b from-background via-background to-muted/40">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <header className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Защищённая обработка документа
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Сканирование паспорта</h1>
          <p className="text-base text-muted-foreground">Выберите способ загрузки документа</p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <OptionCard
            icon={<Camera className="h-6 w-6" />}
            title="Сканировать"
            description="Используйте камеру устройства для фотографирования паспорта."
            action={
              <Button
                size="lg"
                className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20"
                onClick={() => navigate({ to: "/passport-scanner" })}
              >
                Открыть камеру
              </Button>
            }
          />
          <OptionCard
            icon={<ImageIcon className="h-6 w-6" />}
            title="Выбрать из галереи"
            description="Выберите уже готовую фотографию паспорта."
            action={
              <Button
                size="lg"
                variant="secondary"
                className="h-12 w-full rounded-xl text-base"
                disabled={loading}
                onClick={() => galleryInput.current?.click()}
              >
                {loading ? "Загрузка…" : "Открыть галерею"}
              </Button>
            }
          />
        </div>

        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Фото используется только для заполнения анкеты и не передаётся третьим лицам.
        </p>
      </div>
    </main>
  );
}

function OptionCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-b from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
        {icon}
      </div>
      <div className="relative space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="relative mt-auto pt-2">{action}</div>
    </div>
  );
}
