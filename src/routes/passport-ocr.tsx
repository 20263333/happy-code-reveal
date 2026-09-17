import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Gauge,
  Image as ImageIcon,
  Languages,
  Loader2,
  RotateCcw,
  ScanText,
  Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getOcrSource } from "@/lib/passport-scan-store";
import { clearPassportResult, findMrz, setOcrPayload } from "@/lib/passport-structure";
import { recognizeImage, type OcrResult } from "@/lib/paddle-ocr";

export const Route = createFileRoute("/passport-ocr")({
  head: () => ({
    meta: [
      { title: "Распознавание паспорта — Binosoz.tj" },
      { name: "description", content: "Распознавание текста документа движком PaddleOCR прямо в браузере." },
      { property: "og:title", content: "Распознавание паспорта — Binosoz.tj" },
      { property: "og:description", content: "Распознавание текста документа движком PaddleOCR прямо в браузере." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassportOcrPage,
});

const STEPS = ["Подготовка изображения", "Распознавание текста", "Проверка качества"] as const;
const MIN_AVG_CONFIDENCE = 0.8;

function PassportOcrPage() {
  const navigate = useNavigate();
  const galleryInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{ dataUrl: string | null; variant: string | null }>({
    dataUrl: null,
    variant: null,
  });
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);

  const isDev = import.meta.env.DEV;

  const run = useCallback(async (dataUrl: string) => {
    setRunning(true);
    setResult(null);
    setError(null);
    setStep(0);
    try {
      await new Promise((r) => setTimeout(r, 250));
      setStep(1);
      const res = await recognizeImage(dataUrl);
      setStep(2);
      await new Promise((r) => setTimeout(r, 250));
      setResult(res);
      setStep(3);
    } catch {
      setError("Не удалось запустить движок распознавания. Проверьте подключение к сети и попробуйте снова.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    const src = getOcrSource();
    setSource(src);
    if (src.dataUrl) void run(src.dataUrl);
    else {
      setRunning(false);
      setError("Изображение не найдено — сделайте снимок паспорта заново.");
    }
  }, [run]);

  const lowQuality = !!result && result.avgConfidence < MIN_AVG_CONFIDENCE;
  const avgPct = result ? Math.round(result.avgConfidence * 100) : 0;

  const sorted = useMemo(
    () => (result ? [...result.lines].sort((a, b) => a.box[0][1] - b.box[0][1]) : []),
    [result],
  );

  return (
    <main className="min-h-svh bg-gradient-to-b from-background via-background to-muted/40">
      <div className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              <ScanText className="h-6 w-6 text-primary" />
              Распознавание паспорта
            </h1>
            <p className="text-sm text-muted-foreground">
              Движок PaddleOCR работает локально в браузере — изображение никуда не отправляется.
            </p>
          </div>
          {isDev && (
            <Button
              variant={debug ? "default" : "outline"}
              size="sm"
              className="rounded-xl"
              onClick={() => setDebug((d) => !d)}
            >
              <Bug className="mr-2 h-4 w-4" />
              Debug
            </Button>
          )}
        </header>

        {/* progress */}
        {running && (
          <Card className="animate-fade-in overflow-hidden rounded-2xl border-border/70 bg-card/80 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Идёт обработка документа…</span>
            </div>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${((step + 0.4) / STEPS.length) * 100}%` }}
              />
            </div>
            <ul className="mt-6 space-y-3">
              {STEPS.map((label, i) => {
                const done = step > i;
                const activeStep = step === i;
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 ${
                        done
                          ? "bg-emerald-500/15 text-emerald-500"
                          : activeStep
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : activeStep ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <span className={done || activeStep ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* error */}
        {!running && error && (
          <Card className="animate-fade-in rounded-2xl border-border/70 bg-card/80 p-6 text-center shadow-lg backdrop-blur">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <Actions navigate={navigate} onPick={() => galleryInput.current?.click()} />
          </Card>
        )}

        {/* low confidence */}
        {!running && result && lowQuality && (
          <Card className="animate-fade-in rounded-2xl border-amber-500/40 bg-card/80 p-6 text-center shadow-lg backdrop-blur">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <h2 className="mt-3 text-lg font-semibold">Не удалось качественно распознать документ.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Средняя уверенность распознавания: {avgPct}%. Сделайте более чёткий снимок при хорошем освещении.
            </p>
            <Actions navigate={navigate} onPick={() => galleryInput.current?.click()} />
          </Card>
        )}

        {/* success */}
        {!running && result && !lowQuality && (
          <div className="animate-fade-in space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={<Gauge className="h-4 w-4" />} label="Средняя уверенность" value={`${avgPct}%`} />
              <Metric icon={<Clock className="h-4 w-4" />} label="Время распознавания" value={`${result.timeMs} мс`} />
              <Metric icon={<Languages className="h-4 w-4" />} label="Язык" value={result.language} />
            </div>

            <Card className="overflow-hidden rounded-2xl border-border/70 bg-card/80 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                <span className="text-sm font-medium">Распознанный текст</span>
                <span className="text-xs text-muted-foreground">{result.lines.length} строк</span>
              </div>
              <ScrollArea className="h-[360px]">
                <ul className="divide-y divide-border/50">
                  {sorted.map((line, i) => (
                    <li key={`${i}-${line.text}`} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 w-6 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 break-words font-mono text-sm">{line.text}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          line.confidence >= 0.85
                            ? "bg-emerald-500/15 text-emerald-500"
                            : line.confidence >= 0.7
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {Math.round(line.confidence * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </Card>

            <Button
              size="lg"
              className="h-12 w-full rounded-xl"
              onClick={() => {
                setOcrPayload({
                  text: result.fullText,
                  lines: result.lines.map((l) => ({ text: l.text, confidence: l.confidence })),
                  language: result.language,
                  avgConfidence: result.avgConfidence,
                  mrz: findMrz(result.lines.map((l) => l.text)),
                });
                clearPassportResult();
                navigate({ to: "/passport-review" });
              }}
            >
              Продолжить
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Actions navigate={navigate} onPick={() => galleryInput.current?.click()} />

          </div>
        )}

        {/* debug panel — development only */}
        {isDev && debug && result && (
          <Card className="mt-6 rounded-2xl border-dashed border-border bg-muted/30 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Bug className="h-4 w-4" />
              Developer Mode
            </h3>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Источник: {source.variant ?? "—"}</span>
              <span>
                Размер: {result.width}×{result.height} px
              </span>
              <span>Время: {result.timeMs} мс</span>
              <span>Строк: {result.lines.length}</span>
            </div>
            {source.dataUrl && (
              <div className="relative mt-4 overflow-hidden rounded-xl border border-border/60">
                <img src={source.dataUrl} alt="Отладочный кадр" className="block w-full" />
                <svg
                  viewBox={`0 0 ${result.width} ${result.height}`}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  {result.lines.map((l, i) => (
                    <polygon
                      key={i}
                      points={l.box.map((p) => `${p[0]},${p[1]}`).join(" ")}
                      fill="rgba(52,211,153,0.12)"
                      stroke="rgb(52,211,153)"
                      strokeWidth={Math.max(1, result.width / 400)}
                    />
                  ))}
                </svg>
              </div>
            )}
            <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-background/70 p-3 text-[11px] leading-relaxed">
              {JSON.stringify(
                result.lines.map((l) => ({ text: l.text, confidence: +l.confidence.toFixed(3), box: l.box })),
                null,
                2,
              )}
            </pre>
          </Card>
        )}
      </div>

      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={() => navigate({ to: "/passport-scan" })}
      />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

function Actions({ navigate, onPick }: { navigate: ReturnType<typeof useNavigate>; onPick: () => void }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <Button variant="outline" size="lg" className="h-12 rounded-xl" onClick={() => navigate({ to: "/passport-scanner" })}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Повторить
      </Button>
      <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={onPick}>
        <ImageIcon className="mr-2 h-4 w-4" />
        Выбрать другое фото
      </Button>
    </div>
  );
}
