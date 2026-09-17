/**
 * OpenCV.js document detection / quality analysis / crop / enhancement.
 * Pure computer vision — no OCR, no parsing, no network.
 */

export type Point = { x: number; y: number };

export type FrameAnalysis = {
  quad: Point[] | null; // 4 corners in source-image coordinates (TL,TR,BR,BL)
  sharpness: number; // Laplacian variance
  brightness: number; // 0..255 mean
  glare: number; // 0..1 fraction of blown-out pixels
  coverage: number; // quad area / frame area
  fullyInside: boolean;
};

const PROC_W = 480;

function orderCorners(pts: Point[]): Point[] {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]]; // TL, TR, BR, BL
}

function polyArea(p: Point[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
}

/** Analyze a video frame drawn into a small working canvas. */
export function analyzeFrame(cv: any, source: CanvasImageSource, srcW: number, srcH: number, work: HTMLCanvasElement): FrameAnalysis {
  const scale = PROC_W / srcW;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);

  const src = cv.imread(work);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const lap = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  let quad: Point[] | null = null;
  let sharpness = 0;
  let brightness = 0;
  let glare = 0;
  let coverage = 0;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // brightness + glare
    const mean = cv.mean(gray);
    brightness = mean[0];
    const bright = new cv.Mat();
    cv.threshold(gray, bright, 245, 255, cv.THRESH_BINARY);
    glare = cv.countNonZero(bright) / (w * h);
    bright.delete();

    // sharpness (variance of Laplacian)
    cv.Laplacian(gray, lap, cv.CV_64F);
    const m = new cv.Mat();
    const sd = new cv.Mat();
    cv.meanStdDev(lap, m, sd);
    const sdv = sd.doubleAt(0, 0);
    sharpness = sdv * sdv;
    m.delete();
    sd.delete();

    // edges
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 60, 160);
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.dilate(edges, edges, kernel);
    kernel.delete();

    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const frameArea = w * h;
    let best: Point[] | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area > frameArea * 0.12) {
        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const pts: Point[] = [];
          for (let k = 0; k < 4; k++) {
            pts.push({ x: approx.intAt(k, 0), y: approx.intAt(k, 1) });
          }
          if (area > bestArea) {
            bestArea = area;
            best = orderCorners(pts);
          }
        }
        approx.delete();
      }
      c.delete();
    }

    if (best) {
      coverage = polyArea(best) / frameArea;
      quad = best.map((p) => ({ x: p.x / scale, y: p.y / scale }));
    }
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    lap.delete();
    contours.delete();
    hierarchy.delete();
  }

  const margin = 4;
  const fullyInside =
    !!quad &&
    quad.every((p) => p.x > margin && p.y > margin && p.x < srcW - margin && p.y < srcH - margin);

  return { quad, sharpness, brightness, glare, coverage, fullyInside };
}

/** Perspective-correct + crop the document out of a full-resolution canvas. */
export function warpDocument(cv: any, sourceCanvas: HTMLCanvasElement, quad: Point[]): string {
  const [tl, tr, br, bl] = quad;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  let outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  let outH = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
  outW = Math.max(outW, 64);
  outH = Math.max(outH, 64);

  const src = cv.imread(sourceCanvas);
  const dst = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(src, dst, M, new cv.Size(outW, outH), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  // rotate to landscape if needed
  let out = dst;
  let rotated: any = null;
  if (outH > outW) {
    rotated = new cv.Mat();
    cv.rotate(dst, rotated, cv.ROTATE_90_CLOCKWISE);
    out = rotated;
  }

  const canvas = document.createElement("canvas");
  cv.imshow(canvas, out);
  const url = canvas.toDataURL("image/jpeg", 0.95);

  src.delete();
  dst.delete();
  rotated?.delete();
  srcTri.delete();
  dstTri.delete();
  M.delete();
  return url;
}

/** Brightness / contrast / white balance / denoise / sharpen. */
export function enhanceImage(cv: any, sourceCanvas: HTMLCanvasElement): string {
  const src = cv.imread(sourceCanvas);
  const rgb = new cv.Mat();
  const lab = new cv.Mat();
  const channels = new cv.MatVector();
  const merged = new cv.Mat();
  const denoised = new cv.Mat();
  const blur = new cv.Mat();
  const sharp = new cv.Mat();

  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

    // white balance: scale each channel to a common mean
    const chs = new cv.MatVector();
    cv.split(rgb, chs);
    const means = [0, 1, 2].map((i) => cv.mean(chs.get(i))[0] || 1);
    const target = (means[0] + means[1] + means[2]) / 3;
    for (let i = 0; i < 3; i++) {
      const c = chs.get(i);
      c.convertTo(c, -1, target / means[i], 0);
    }
    cv.merge(chs, rgb);
    for (let i = 0; i < 3; i++) chs.get(i).delete();
    chs.delete();

    // CLAHE on L channel (contrast + brightness normalisation)
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    cv.split(lab, channels);
    const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
    clahe.apply(channels.get(0), channels.get(0));
    clahe.delete();
    cv.merge(channels, merged);
    cv.cvtColor(merged, merged, cv.COLOR_Lab2RGB);

    // noise reduction + unsharp mask
    cv.bilateralFilter(merged, denoised, 5, 45, 45, cv.BORDER_DEFAULT);
    cv.GaussianBlur(denoised, blur, new cv.Size(0, 0), 3);
    cv.addWeighted(denoised, 1.5, blur, -0.5, 0, sharp);

    const canvas = document.createElement("canvas");
    cv.imshow(canvas, sharp);
    return canvas.toDataURL("image/jpeg", 0.95);
  } finally {
    src.delete();
    rgb.delete();
    lab.delete();
    for (let i = 0; i < channels.size(); i++) channels.get(i).delete();
    channels.delete();
    merged.delete();
    denoised.delete();
    blur.delete();
    sharp.delete();
  }
}

export function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
}
