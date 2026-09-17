/**
 * PaddleOCR (Paddle.js PP-OCR) text recognition — recognition only.
 * No parsing, no MRZ decoding, no AI, no backend.
 */

export type OcrLine = {
  text: string;
  /** [x, y] quad points in image coordinates: TL, TR, BR, BL */
  box: [number, number][];
  confidence: number; // 0..1
};

export type OcrResult = {
  fullText: string;
  lines: OcrLine[];
  avgConfidence: number;
  timeMs: number;
  width: number;
  height: number;
  language: string;
};

let enginePromise: Promise<any> | null = null;

const OCR_CDN = "https://cdn.jsdelivr.net/npm/@paddlejs-models/ocr@1.2.4/lib/index.js";

/** Load the UMD bundle from CDN (browser only) — keeps it out of the SSR bundle. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-ocr="1"]`);
    if (existing) {
      existing.dataset.loaded === "1"
        ? resolve()
        : existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("ocr script failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.ocr = "1";
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("ocr script failed"));
    document.head.appendChild(s);
  });
}

/** Load + warm up the PP-OCR models (detection + recognition). */
export function initOcr(): Promise<any> {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (typeof window === "undefined") throw new Error("OCR is browser-only");
      await loadScript(OCR_CDN);
      const ocr = (window as any).paddlejs?.ocr ?? (window as any).ocr;
      if (!ocr) throw new Error("OCR bundle did not expose a global");
      await ocr.init();
      return ocr;
    })().catch((e) => {
      enginePromise = null;
      throw e;
    });
  }
  return enginePromise;
}


function boxOf(points: any): [number, number][] {
  const pts = (points ?? []).map((p: any) => [Number(p[0]) || 0, Number(p[1]) || 0] as [number, number]);
  while (pts.length < 4) pts.push([0, 0]);
  return pts.slice(0, 4);
}

const LATIN = /[A-Za-z]/;
const CYRILLIC = /[А-Яа-яЁё]/;
const DIGIT = /[0-9]/;
const MRZ = /^[A-Z0-9<]{20,}$/;
const NOISE = /[^A-Za-zА-Яа-яЁё0-9<>.,:;''"()\-/\\ №]/g;

/**
 * Per-line confidence estimate.
 * Paddle.js exposes recognized text and detection quads but not the raw
 * softmax scores, so the score is derived from box geometry and character
 * consistency of the recognized string.
 */
function estimateConfidence(text: string, box: [number, number][], imgH: number): number {
  const t = text.trim();
  if (!t) return 0;

  const ys = box.map((p) => p[1]);
  const xs = box.map((p) => p[0]);
  const h = Math.max(...ys) - Math.min(...ys);
  const w = Math.max(...xs) - Math.min(...xs);

  let score = 0.72;

  // taller lines (relative to the page) are recognised far more reliably
  const relH = imgH > 0 ? h / imgH : 0;
  score += Math.min(0.14, relH * 3.5);

  // reasonable aspect ratio for a text line
  if (h > 0 && w / h > 1.5) score += 0.05;

  // character consistency
  const noise = (t.match(NOISE) ?? []).length / t.length;
  score -= noise * 0.55;

  // single stray glyphs are usually garbage
  if (t.length <= 2) score -= 0.2;
  else if (t.length >= 5) score += 0.05;

  // clean MRZ-style or clean word/number lines
  if (MRZ.test(t.replace(/\s/g, ""))) score += 0.1;
  if (/^[A-ZА-Я0-9\s.\-/]+$/.test(t) && t.length > 4) score += 0.04;

  // mixed scripts inside one short token signal misreads
  if (LATIN.test(t) && CYRILLIC.test(t) && t.length < 8) score -= 0.12;

  return Math.max(0, Math.min(0.99, score));
}

function detectLanguage(text: string): string {
  const cyr = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  const dig = (text.match(/[0-9]/g) ?? []).length;
  if (!cyr && !lat) return dig ? "Цифры" : "—";
  if (cyr && lat) return "Русский + English";
  if (cyr) return "Русский";
  return "English / Latin";
}

function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
}

/** Run PP-OCR over a data URL image. Fully asynchronous. */
export async function recognizeImage(dataUrl: string): Promise<OcrResult> {
  const ocr = await initOcr();
  const img = await loadImage(dataUrl);
  const canvas = toCanvas(img);
  const started = performance.now();

  // yield to the browser so the progress UI can paint before the heavy work
  await new Promise((r) => setTimeout(r, 0));

  const raw: any = await ocr.recognize(canvas, { canvas: undefined, style: {} }).catch(async () => {
    return ocr.recognize(canvas);
  });

  const texts: string[] = (raw?.text ?? []).map((t: any) => (Array.isArray(t) ? t.join("") : String(t ?? "")));
  const points: any[] = raw?.points ?? [];

  const lines: OcrLine[] = texts
    .map((text, i) => {
      const box = boxOf(points[i]);
      return { text: text.trim(), box, confidence: estimateConfidence(text, box, canvas.height) };
    })
    .filter((l) => l.text.length > 0);

  const timeMs = Math.round(performance.now() - started);
  const fullText = lines.map((l) => l.text).join("\n");
  const avgConfidence = lines.length
    ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length
    : 0;

  return {
    fullText,
    lines,
    avgConfidence,
    timeMs,
    width: canvas.width,
    height: canvas.height,
    language: detectLanguage(fullText),
  };
}
