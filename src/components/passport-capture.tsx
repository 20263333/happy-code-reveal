import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Image as ImageIcon, Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  extractPassport,
  getPassportScanCredits,
  type PassportExtractResult,
} from "@/lib/passport.functions";
import { kioskExtractPassport } from "@/lib/kiosk.functions";
import { toast } from "sonner";
import { compressImageFile } from "@/lib/image-compress";

type Props = {
  onExtracted?: (
    data: PassportExtractResult,
    files: { front: File | null; back: File | null },
  ) => void;
  compact?: boolean;
  mode?: "auth" | "kiosk";
};

type ScanStage = "idle" | "uploading" | "reading" | "extracting" | "filling" | "completed";

const SCAN_STAGE_LABELS: Record<Exclude<ScanStage, "idle">, string> = {
  uploading: "Uploading...",
  reading: "Reading passport...",
  extracting: "Extracting data...",
  filling: "Filling form...",
  completed: "Completed.",
};

const PASSPORT_RECOGNITION_ERROR = "Passport could not be recognized. Please take a clearer photo.";

function parseOcrDebug(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const marker = "OCR_DEBUG:";
  const index = message.indexOf(marker);
  if (index < 0) return null;
  try {
    return JSON.parse(message.slice(index + marker.length));
  } catch {
    return { message };
  }
}

function waitForUi() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function PassportCapture({ onExtracted, compact, mode = "auth" }: Props) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ScanStage>("idle");
  const frontCamInput = useRef<HTMLInputElement>(null);
  const backCamInput = useRef<HTMLInputElement>(null);
  const frontGalleryInput = useRef<HTMLInputElement>(null);
  const backGalleryInput = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractPassport);
  const kioskExtract = useServerFn(kioskExtractPassport);
  const creditsFn = useServerFn(getPassportScanCredits);
  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ["passport-scan-credits"],
    queryFn: () => creditsFn(),
    enabled: mode === "auth",
    staleTime: 30_000,
  });
  const freeLeft = credits ? Math.max(0, credits.scan_free_limit - credits.scan_free_used) : null;

  const pick = (file: File | null, which: "front" | "back") => {
    setStage("idle");
    if (which === "front") {
      setFront(file);
      setFrontUrl(file ? URL.createObjectURL(file) : null);
    } else {
      setBack(file);
      setBackUrl(file ? URL.createObjectURL(file) : null);
    }
  };

  const scan = async () => {
    if (!front) {
      toast.error("Сначала сделайте фото лицевой стороны паспорта");
      return;
    }
    setLoading(true);
    setStage("uploading");
    try {
      await waitForUi();
      const frontB64 = await compressImageFile(front);
      const backB64 = back ? await compressImageFile(back) : null;
      const payload = { front: frontB64, back: backB64 };
      setStage("reading");
      await waitForUi();

      let data: PassportExtractResult | null = null;
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          setStage(attempt === 1 ? "extracting" : "reading");
          await waitForUi();
          const result =
            mode === "kiosk"
              ? await kioskExtract({ data: payload })
              : await extract({ data: payload });
          data = result as PassportExtractResult;
          break;
        } catch (error) {
          lastError = error;
          console.warn("[passport-capture] OCR attempt failed", {
            attempt,
            mode,
            message: error instanceof Error ? error.message : String(error),
            ocrDebug: parseOcrDebug(error),
          });
          if (attempt === 2) throw lastError;
        }
      }

      if (!data) throw new Error(PASSPORT_RECOGNITION_ERROR);
      console.info("[passport-capture] Raw OCR response", {
        mode,
        debug: data.debug,
        raw_ocr_text: data.raw_ocr_text,
        raw_ocr_response: data.raw_ocr_response,
        extracted: data,
      });
      setStage("filling");
      await waitForUi();
      onExtracted?.(data, { front, back });
      setStage("completed");
      toast.success("Completed.");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const ocrDebug = parseOcrDebug(e);
      console.error("[passport-capture] OCR failed", { mode, message: msg, ocrDebug });
      const reason = typeof ocrDebug?.debug?.reason === "string" ? ocrDebug.debug.reason : "";
      const userMessage = msg.includes("no_scan_credits")
        ? "Кредитҳои сканер тамом шуданд. Барои идома дар саҳифаи 'Скан Кредитҳо' пакет харед."
        : msg.includes("kiosk_locked")
          ? "Kiosk қулф аст — PIN-ро ворид кунед"
          : msg.includes("Ширкат ёфт нашуд")
            ? "Ширкат ёфт нашуд — профили корбар ба ширкат пайваст нест."
            : msg.includes("Unauthorized") || msg.includes("401")
              ? "Сессия тамом шуд — лутфан аз нав ворид шавед."
              : reason.includes("OCR detected text")
                ? "Дар расм матн ёфт шуд, аммо маълумоти паспорт ёфт нашуд. Лутфан тарафи маълумотдори паспортро пурра акс гиред."
                : reason.includes("Unsupported image MIME")
                  ? "Формати расм дастгирӣ намешавад. Лутфан JPG ё PNG фиристед."
                  : reason.includes("LOVABLE_API_KEY")
                    ? "Хизматрасонии OCR ҳоло танзим нашудааст."
                    : reason
                      ? `${PASSPORT_RECOGNITION_ERROR} (${reason.slice(0, 160)})`
                      : PASSPORT_RECOGNITION_ERROR;
      toast.error(userMessage);

    } finally {
      setLoading(false);
      setStage((current) => (current === "completed" ? current : "idle"));
      if (mode === "auth") refetchCredits();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">📷 Сурати паспорт</Label>
        {(front || back) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              pick(null, "front");
              pick(null, "back");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2"}`}>
        <Slot
          label="Пеш"
          url={frontUrl}
          onCamera={() => frontCamInput.current?.click()}
          onGallery={() => frontGalleryInput.current?.click()}
        />
        <Slot
          label="Кафо"
          url={backUrl}
          onCamera={() => backCamInput.current?.click()}
          onGallery={() => backGalleryInput.current?.click()}
        />
      </div>
      <input
        ref={frontCamInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null, "front");
          e.target.value = "";
        }}
      />
      <input
        ref={backCamInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null, "back");
          e.target.value = "";
        }}
      />
      <input
        ref={frontGalleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null, "front");
          e.target.value = "";
        }}
      />
      <input
        ref={backGalleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null, "back");
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        className="w-full"
        onClick={scan}
        disabled={loading || !front}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <ScanLine className="mr-1.5 h-4 w-4" />
        )}
        {loading ? "Сканирование..." : "Сканировать и заполнить"}
      </Button>
      {mode === "auth" && freeLeft !== null && (
        <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span>
            {freeLeft > 0
              ? `Скани ройгон: ${freeLeft} аз ${credits?.scan_free_limit}`
              : `Лимити ройгон тамом шуд · кредити харидашуда: ${credits?.paid_balance ?? 0}`}
          </span>
          <Link to="/scan-credits" className="underline hover:text-foreground">
            Харид
          </Link>
        </div>
      )}
      {stage !== "idle" && (
        <div
          className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {SCAN_STAGE_LABELS[stage]}
        </div>
      )}
    </div>
  );
}

function Slot({
  label,
  url,
  onCamera,
  onGallery,
}: {
  label: string;
  url: string | null;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative aspect-[3/2] overflow-hidden rounded-md border border-border bg-background">
        {url ? (
          <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Camera className="h-5 w-5" />
            <span className="text-xs">{label}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onCamera}
        >
          <Camera className="mr-1 h-3.5 w-3.5" />
          Камера
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onGallery}
        >
          <ImageIcon className="mr-1 h-3.5 w-3.5" />
          Галерея
        </Button>
      </div>
    </div>
  );
}
