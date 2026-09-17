import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CameraOff,
  Image as ImageIcon,
  Loader2,
  RefreshCcw,
  ScanLine,
  Settings,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToDataUrl, setScanVariants } from "@/lib/passport-scan-store";
import { loadOpenCv } from "@/lib/opencv-loader";
import { analyzeFrame, enhanceImage, warpDocument, type Point } from "@/lib/doc-detect";

export const Route = createFileRoute("/passport-scanner")({
  head: () => ({
    meta: [
      { title: "Камера сканера паспорта — Binosoz.tj" },
      { name: "description", content: "Автоматическое определение границ документа и съёмка паспорта." },
      { property: "og:title", content: "Камера сканера паспорта — Binosoz.tj" },
      { property: "og:description", content: "Автоматическое определение границ документа и съёмка паспорта." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PassportScannerPage,
});

type Facing = "environment" | "user";
type Status = "idle" | "starting" | "ready" | "denied" | "error";

const HINT_DEFAULT = "Поместите паспорт внутрь рамки";
const MIN_SHARPNESS = 55;
const MIN_BRIGHTNESS = 60;
const MIN_COVERAGE = 0.2;
const STABLE_FRAMES = 8; // ~1s at detection cadence

function quadCenter(q: Point[]) {
  return {
    x: q.reduce((s, p) => s + p.x, 0) / 4,
    y: q.reduce((s, p) => s + p.y, 0) / 4,
  };
}

function PassportScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cvRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastQuad = useRef<Point[] | null>(null);
  const stableRef = useRef(0);
  const lastRunRef = useRef(0);
  const busyRef = useRef(false);

  const [facing, setFacing] = useState<Facing>("environment");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [cvReady, setCvReady] = useState(false);
  const [hint, setHint] = useState(HINT_DEFAULT);
  const [detected, setDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [processing, setProcessing] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const start = useCallback(
    async (mode: Facing) => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus("starting");
      setErrorMsg("");
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMsg("Камера недоступна в этом браузере.");
        return;
      }
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: true, audio: false },
      ];
      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
          setTorchOn(false);
          setStatus("ready");
          return;
        } catch (err) {
          const e = err as DOMException;
          if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
            setStatus("denied");
            return;
          }
        }
      }
      setStatus("error");
      setErrorMsg("Не удалось запустить камеру. Проверьте, не используется ли она другим приложением.");
    },
    [],
  );

  useEffect(() => {
    void start(facing);
    return stop;
  }, [facing, start, stop]);

  useEffect(() => {
    let alive = true;
    loadOpenCv()
      .then((cv) => {
        if (!alive) return;
        cvRef.current = cv;
        setCvReady(true);
      })
      .catch(() => setCvReady(false));
    return () => {
      alive = false;
    };
  }, []);

  const grabFullFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, [facing]);

  const doCapture = useCallback(
    async (quad: Point[] | null) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setFlash(true);
      setProcessing(true);
      setCountdown(null);
      try {
        const canvas = grabFullFrame();
        if (!canvas) return;
        const original = canvas.toDataURL("image/jpeg", 0.95);
        let cropped: string | null = null;
        let enhanced: string | null = null;
        const cv = cvRef.current;
        if (cv) {
          try {
            if (quad) cropped = warpDocument(cv, canvas, quad);
          } catch {
            cropped = null;
          }
          try {
            const base = cropped
              ? await (await import("@/lib/doc-detect")).dataUrlToCanvas(cropped)
              : canvas;
            enhanced = enhanceImage(cv, base);
          } catch {
            enhanced = null;
          }
        }
        setScanVariants({ original, cropped, enhanced });
        stop();
        navigate({ to: "/passport-preview" });
      } finally {
        setTimeout(() => setFlash(false), 220);
        setTimeout(() => {
          setProcessing(false);
          busyRef.current = false;
        }, 600);
      }
    },
    [grabFullFrame, navigate, stop],
  );

  // Detection loop
  useEffect(() => {
    if (status !== "ready" || !cvReady) return;
    if (!workRef.current) workRef.current = document.createElement("canvas");

    let stopped = false;
    let countdownStart = 0;

    const drawOverlay = (quad: Point[] | null, ok: boolean) => {
      const video = videoRef.current;
      const canvas = overlayRef.current;
      if (!video || !canvas) return;
      const rect = video.getBoundingClientRect();
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!quad) return;
      // object-cover mapping
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const offX = (canvas.width - video.videoWidth * scale) / 2;
      const offY = (canvas.height - video.videoHeight * scale) / 2;
      ctx.beginPath();
      quad.forEach((p, i) => {
        const x = p.x * scale + offX;
        const y = p.y * scale + offY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ok ? "rgba(52,211,153,0.95)" : "rgba(250,204,21,0.9)";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 16;
      ctx.fillStyle = ok ? "rgba(52,211,153,0.12)" : "rgba(250,204,21,0.08)";
      ctx.fill();
      ctx.stroke();
    };

    const tick = (ts: number) => {
      if (stopped) return;
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const cv = cvRef.current;
      if (!video?.videoWidth || !cv || busyRef.current) return;
      if (ts - lastRunRef.current < 125) {
        drawOverlay(lastQuad.current, stableRef.current > 0);
        return;
      }
      lastRunRef.current = ts;

      let a;
      try {
        a = analyzeFrame(cv, video, video.videoWidth, video.videoHeight, workRef.current!);
      } catch {
        return;
      }

      const quad = a.quad;
      lastQuad.current = quad;
      setDetected(!!quad);

      let message = HINT_DEFAULT;
      let ok = false;

      if (!quad || a.coverage < MIN_COVERAGE) {
        message = HINT_DEFAULT;
        stableRef.current = 0;
      } else if (!a.fullyInside) {
        message = "Поместите документ полностью";
        stableRef.current = 0;
      } else if (a.brightness < MIN_BRIGHTNESS) {
        message = "Недостаточно освещения";
        stableRef.current = 0;
      } else if (a.glare > 0.06) {
        message = "Уберите блики";
        stableRef.current = 0;
      } else if (a.sharpness < MIN_SHARPNESS) {
        message = "Изображение размыто";
        stableRef.current = 0;
      } else {
        // movement check
        const prev = (tick as any)._prevCenter as Point | undefined;
        const c = quadCenter(quad);
        const moved = prev ? Math.hypot(c.x - prev.x, c.y - prev.y) : 0;
        (tick as any)._prevCenter = c;
        if (prev && moved > video.videoWidth * 0.02) {
          message = "Держите камеру неподвижно";
          stableRef.current = 0;
        } else {
          ok = true;
          stableRef.current += 1;
          message = "Документ найден — не двигайтесь";
        }
      }

      setHint(message);
      drawOverlay(quad, ok);

      if (ok) {
        if (stableRef.current === 1) countdownStart = ts;
        const remaining = 3 - Math.floor((ts - countdownStart) / 350);
        setCountdown(Math.max(1, Math.min(3, remaining)));
        if (stableRef.current >= STABLE_FRAMES) {
          stableRef.current = 0;
          void doCapture(quad);
        }
      } else {
        setCountdown(null);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status, cvReady, doCapture]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchOn(next);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setProcessing(true);
    try {
      const original = await fileToDataUrl(file);
      let enhanced: string | null = null;
      const cv = cvRef.current;
      if (cv) {
        try {
          const { dataUrlToCanvas } = await import("@/lib/doc-detect");
          enhanced = enhanceImage(cv, await dataUrlToCanvas(original));
        } catch {
          enhanced = null;
        }
      }
      setScanVariants({ original, enhanced, cropped: null });
      stop();
      navigate({ to: "/passport-preview" });
    } finally {
      setProcessing(false);
    }
  };

  if (status === "denied") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-neutral-950 px-6 text-center text-neutral-50">
        <div className="animate-fade-in flex max-w-sm flex-col items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
            <CameraOff className="h-9 w-9 text-neutral-300" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Нет доступа к камере</h1>
          <p className="text-sm text-neutral-400">
            Для сканирования паспорта необходимо предоставить доступ к камере.
          </p>
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
            <Button className="h-12 flex-1 rounded-xl" onClick={() => void start(facing)}>
              <Settings className="mr-2 h-4 w-4" />
              Настройки
            </Button>
            <Button
              variant="ghost"
              className="h-12 flex-1 rounded-xl text-neutral-300 hover:bg-white/10 hover:text-neutral-50"
              onClick={() => navigate({ to: "/passport-scan" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-black text-neutral-50">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          status === "ready" ? "opacity-100" : "opacity-0"
        } ${facing === "user" ? "scale-x-[-1]" : ""}`}
      />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* frame + dark overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`relative aspect-[125/88] w-[88%] max-w-2xl rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ring-1 transition-colors duration-300 ${
            detected ? "ring-emerald-400/80" : "ring-white/25"
          }`}
        >
          {["-left-1 -top-1 border-l-[3px] border-t-[3px]", "-right-1 -top-1 border-r-[3px] border-t-[3px]", "-bottom-1 -left-1 border-b-[3px] border-l-[3px]", "-bottom-1 -right-1 border-b-[3px] border-r-[3px]"].map(
            (c) => (
              <span
                key={c}
                className={`absolute h-9 w-9 rounded-[10px] shadow-[0_0_16px_rgba(52,211,153,0.45)] sm:h-12 sm:w-12 ${
                  detected ? "border-emerald-400" : "border-white/70 motion-safe:animate-pulse"
                } ${c}`}
              />
            ),
          )}
        </div>
      </div>

      {flash && <div className="pointer-events-none absolute inset-0 z-30 animate-[fade-out_0.22s_ease-out] bg-white" />}

      {/* countdown */}
      {countdown !== null && !processing && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span
            key={countdown}
            className="animate-scale-in flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/25 text-5xl font-semibold text-emerald-300 ring-2 ring-emerald-400/70 backdrop-blur"
          >
            {countdown}
          </span>
        </div>
      )}

      {processing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 text-sm text-neutral-200 backdrop-blur-sm">
          <Loader2 className="h-7 w-7 animate-spin" />
          Обработка изображения…
        </div>
      )}

      {status === "starting" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 text-sm text-neutral-300">
          <Loader2 className="h-7 w-7 animate-spin" />
          Запуск камеры…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center">
          <CameraOff className="h-8 w-8 text-neutral-400" />
          <p className="max-w-sm text-sm text-neutral-300">{errorMsg}</p>
          <Button className="h-11 rounded-xl" onClick={() => void start(facing)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </div>
      )}

      {/* top */}
      <header className="relative z-10 flex items-start gap-3 px-5 pt-6 sm:pt-8">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Назад"
          className="h-10 w-10 shrink-0 rounded-full bg-black/40 text-neutral-100 backdrop-blur hover:bg-black/60 hover:text-white"
          onClick={() => {
            stop();
            navigate({ to: "/passport-scan" });
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1 pr-10 text-center">
          <h1 className="text-base font-semibold tracking-tight drop-shadow sm:text-lg">Сканирование паспорта</h1>
          <p className="mt-0.5 text-xs text-neutral-300 drop-shadow sm:text-sm">
            Поместите паспорт полностью внутрь рамки
          </p>
        </div>
      </header>

      {/* live hint */}
      <div className="relative z-10 mt-4 flex justify-center px-5">
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium backdrop-blur transition-colors duration-300 sm:text-sm ${
            detected && hint.startsWith("Документ")
              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
              : "border-white/15 bg-black/45 text-neutral-200"
          }`}
        >
          <ScanLine className="h-4 w-4" />
          {cvReady ? hint : "Инициализация детектора документа…"}
        </div>
      </div>

      <div className="flex-1" />

      {/* bottom controls */}
      <footer className="relative z-10 bg-gradient-to-t from-black/85 to-transparent px-5 pb-8 pt-10">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <ControlButton label="Галерея" onClick={() => galleryInput.current?.click()}>
            <ImageIcon className="h-5 w-5" />
          </ControlButton>

          <ControlButton label="Вспышка" active={torchOn} onClick={() => void toggleTorch()}>
            {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </ControlButton>

          <button
            type="button"
            aria-label="Сделать снимок"
            disabled={status !== "ready" || processing}
            onClick={() => void doCapture(lastQuad.current)}
            className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white/20 ring-2 ring-white/70 transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 sm:h-20 sm:w-20"
          >
            <span className="block h-[58px] w-[58px] rounded-full bg-white shadow-xl sm:h-16 sm:w-16" />
          </button>

          <ControlButton
            label="Камера"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          >
            <RefreshCcw className="h-5 w-5" />
          </ControlButton>

          <ControlButton
            label="Отмена"
            onClick={() => {
              stop();
              navigate({ to: "/passport-scan" });
            }}
          >
            <X className="h-5 w-5" />
          </ControlButton>
        </div>
      </footer>

      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
      />
    </main>
  );
}

function ControlButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={onClick}
        className={`h-12 w-12 rounded-full backdrop-blur transition-transform hover:scale-105 ${
          active
            ? "bg-emerald-400 text-neutral-900 hover:bg-emerald-300"
            : "bg-white/10 text-neutral-100 hover:bg-white/20 hover:text-white"
        }`}
      >
        {children}
      </Button>
      <span className="text-[10px] text-neutral-400">{label}</span>
    </div>
  );
}
