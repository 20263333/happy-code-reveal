// Client-side image downscale + JPEG re-encode.
// Prevents "413 / RPC size" errors when big desktop or tablet photos are sent to server fns.
// Tablet cameras (iPad/Android) often produce HEIC or 12+ MP photos with EXIF rotation,
// so we always decode -> re-encode to JPEG and shrink until the payload is small enough.

const DEFAULT_MAX_BYTES = 900_000; // ~900 KB base64 — safe through proxies/WAF

async function decode(file: File): Promise<{ w: number; h: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void } | null> {
  // createImageBitmap handles EXIF orientation and more formats (incl. HEIC on Safari 17+).
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
      return { w: bmp.width, h: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h) };
    } catch {
      /* fall through */
    }
  }
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    URL.revokeObjectURL(url);
    return {
      w: img.naturalWidth || img.width,
      h: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } catch {
    return null;
  }
}

export async function compressImageFile(
  file: File,
  opts: { maxSize?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  let maxSize = opts.maxSize ?? 1600;
  let quality = opts.quality ?? 0.85;

  const src = await decode(file);
  if (!src || !src.w || !src.h) {
    throw new Error(
      "Ин сурат хонда нашуд. Лутфан дар танзимоти камера формати JPEG-ро интихоб кунед ё скриншот гиред.",
    );
  }

  let out = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, maxSize / Math.max(src.w, src.h));
    const w = Math.max(1, Math.round(src.w * scale));
    const h = Math.max(1, Math.round(src.h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    src.draw(ctx, w, h);

    try {
      out = canvas.toDataURL("image/jpeg", quality);
    } catch {
      break;
    }
    if (out.length <= maxBytes) return out;

    // Too big: shrink further, then lower quality.
    if (maxSize > 900) maxSize = Math.round(maxSize * 0.8);
    else quality = Math.max(0.5, quality - 0.1);
  }

  if (!out) {
    throw new Error("Сурат коркард нашуд — сурати дигар гиред.");
  }
  return out;
}
