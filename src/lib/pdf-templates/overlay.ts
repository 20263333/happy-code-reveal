// Overlay-based contract renderer.
// Loads the ORIGINAL master PDF (user's official template) and only patches
// the red placeholder regions with real values. Everything else — legal text,
// fonts, layout, page breaks, tables, signatures — is left untouched.
import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ContractCtx } from "./context";

const PAGE_H = 841.89; // A4 pt

/** Placeholder rectangle in pdfplumber coordinates (top-down y). */
type Rect = { page: number; x0: number; top: number; x1: number; size: number };

/** A field = one or more rects (multi-line placeholder) + value producer. */
type Field = {
  key: string;
  rects: Rect[];
  value: (ctx: ContractCtx) => string;
  align?: "left" | "center";
  bold?: boolean;
};

// ---------- FULL PAYMENT + INSTALLMENT (page 1 is identical) ----------
const P1_COMMON: Field[] = [
  { key: "contract_number", rects: [{ page: 1, x0: 290.4, top: 37.6, x1: 409.7, size: 14 }], value: c => c.contract_number },
  { key: "contract_date", rects: [{ page: 1, x0: 36.0, top: 168.1, x1: 256.5, size: 14 }], value: c => c.contract_date },
  { key: "client_full_name", rects: [{ page: 1, x0: 235.5, top: 331.5, x1: 393.9, size: 14 }], value: c => c.client_full_name },
  { key: "client_birth_year", rects: [{ page: 1, x0: 424.6, top: 331.5, x1: 520.2, size: 14 }], value: c => c.client_birth_year, bold: true },
  { key: "client_tin", rects: [{ page: 1, x0: 36.0, top: 350.1, x1: 154.8, size: 14 }], value: c => c.client_tin },
  { key: "passport_series", rects: [{ page: 1, x0: 311.8, top: 350.1, x1: 415.6, size: 14 }], value: c => c.passport_series },
  {
    key: "passport_authority",
    rects: [
      { page: 1, x0: 531.2, top: 350.1, x1: 562.9, size: 14 },
      { page: 1, x0: 36.0, top: 368.6, x1: 205.5, size: 14 },
    ],
    value: c => c.passport_authority,
  },
  { key: "client_address", rects: [{ page: 1, x0: 436.1, top: 368.6, x1: 537.6, size: 14 }], value: c => c.client_address },
  { key: "floor_number", rects: [{ page: 1, x0: 195.8, top: 676.3, x1: 257.0, size: 14 }], value: c => c.floor_number },
  { key: "apt_number", rects: [{ page: 1, x0: 319.8, top: 676.3, x1: 413.6, size: 14 }], value: c => c.apt_number },
  { key: "block_name", rects: [{ page: 1, x0: 446.8, top: 676.3, x1: 537.7, size: 14 }], value: c => c.block_name || c.project_name },
  { key: "area", rects: [{ page: 1, x0: 102.3, top: 713.3, x1: 243.6, size: 14 }], value: c => c.area },
];

// ---------- FULL PAYMENT page 2 (total price twice) ----------
const FULL_P2: Field[] = [
  { key: "total_price", rects: [{ page: 2, x0: 145.0, top: 195.8, x1: 276.4, size: 14 }], value: c => moneyTJ(c.total_price) },
  { key: "total_price_words", rects: [{ page: 2, x0: 281.4, top: 195.8, x1: 392.4, size: 14 }], value: c => c.total_price_words },
  { key: "price_usd_combo", rects: [{ page: 2, x0: 133.6, top: 214.3, x1: 438.1, size: 14 }], value: c => `${c.price_usd} (${c.price_usd_words})` },
  {
    key: "total_price_2",
    rects: [{ page: 2, x0: 422.6, top: 335.4, x1: 559.4, size: 14 }],
    value: c => moneyTJ(c.total_price),
  },
  { key: "total_price_words_2", rects: [{ page: 2, x0: 36.0, top: 354.0, x1: 145.6, size: 14 }], value: c => c.total_price_words },
  {
    key: "price_usd_line",
    rects: [
      { page: 2, x0: 416.1, top: 354.0, x1: 562.9, size: 14 },
      { page: 2, x0: 36.0, top: 372.5, x1: 193.9, size: 14 },
    ],
    value: c => `${c.price_usd} (${c.price_usd_words})`,
  },
];

// ---------- INSTALLMENT page 2 (adds down payment / remaining) ----------
const INST_P2: Field[] = [
  { key: "total_price", rects: [{ page: 2, x0: 145.2, top: 195.8, x1: 274.3, size: 14 }], value: c => moneyTJ(c.total_price) },
  { key: "total_price_words", rects: [{ page: 2, x0: 279.4, top: 195.8, x1: 394.4, size: 14 }], value: c => c.total_price_words },
  { key: "price_usd_combo", rects: [{ page: 2, x0: 133.8, top: 214.3, x1: 440.3, size: 14 }], value: c => `${c.price_usd} (${c.price_usd_words})` },
  {
    key: "total_price_2",
    rects: [
      { page: 2, x0: 424.6, top: 335.4, x1: 559.3, size: 14 },
    ],
    value: c => moneyTJ(c.total_price),
  },
  { key: "total_price_words_2", rects: [{ page: 2, x0: 36.0, top: 354.0, x1: 149.4, size: 14 }], value: c => c.total_price_words },
  {
    key: "price_usd_line",
    rects: [
      { page: 2, x0: 418.2, top: 354.0, x1: 562.9, size: 14 },
      { page: 2, x0: 36.0, top: 372.5, x1: 200.5, size: 14 },
    ],
    value: c => `${c.price_usd} (${c.price_usd_words})` ,
  },
  {
    key: "down_payment",
    rects: [
      { page: 2, x0: 506.2, top: 428.1, x1: 562.9, size: 14 },
      { page: 2, x0: 36.0, top: 446.6, x1: 113.1, size: 14 },
    ],
    value: c => moneyTJ(c.down_payment),
  },
  {
    key: "down_payment_words",
    rects: [{ page: 2, x0: 121.8, top: 446.6, x1: 244.0, size: 14 }],
    value: c => c.down_payment_words,
  },
  { key: "remaining", rects: [{ page: 2, x0: 152.5, top: 465.1, x1: 264.7, size: 14 }], value: c => moneyTJ(c.remaining) },
  { key: "remaining_words", rects: [{ page: 2, x0: 269.1, top: 465.1, x1: 382.9, size: 14 }], value: c => c.remaining_words },
];

// ---------- FULL page 3 / INSTALLMENT page 4: "(Болок)" ----------
const FULL_BOLOK: Field[] = [
  { key: "block_ref", rects: [{ page: 3, x0: 348.2, top: 692.3, x1: 396.9, size: 14 }], value: c => c.block_name || c.project_name },
];
const INST_BOLOK: Field[] = [
  { key: "block_ref", rects: [{ page: 4, x0: 348.2, top: 84.7, x1: 396.9, size: 14 }], value: c => c.block_name || c.project_name },
];

// ---------- FULL page 6 signature block ----------
const FULL_P6: Field[] = [
  { key: "sig_name", rects: [{ page: 6, x0: 300.4, top: 473.9, x1: 383.1, size: 14 }], value: c => c.client_full_name },
  { key: "sig_addr", rects: [{ page: 6, x0: 346.6, top: 492.4, x1: 467.9, size: 14 }], value: c => c.client_address },
  { key: "sig_tin", rects: [{ page: 6, x0: 338.1, top: 510.9, x1: 411.7, size: 14 }], value: c => c.client_tin },
  { key: "sig_phone", rects: [{ page: 6, x0: 329.6, top: 603.5, x1: 360.7, size: 14 }], value: c => c.client_phone },
];

// ---------- INSTALLMENT page 6 signature block ----------
const INST_P6: Field[] = [
  { key: "sig_name", rects: [{ page: 6, x0: 300.4, top: 604.2, x1: 383.1, size: 14 }], value: c => c.client_full_name },
  { key: "sig_addr", rects: [{ page: 6, x0: 346.6, top: 622.7, x1: 467.9, size: 14 }], value: c => c.client_address },
  { key: "sig_tin", rects: [{ page: 6, x0: 338.1, top: 641.2, x1: 411.7, size: 14 }], value: c => c.client_tin },
  { key: "sig_phone", rects: [{ page: 6, x0: 329.6, top: 733.8, x1: 360.7, size: 14 }], value: c => c.client_phone },
];

const FULL_FIELDS: Field[] = [...P1_COMMON, ...FULL_P2, ...FULL_BOLOK, ...FULL_P6];
const INST_FIELDS: Field[] = [...P1_COMMON, ...INST_P2, ...INST_BOLOK, ...INST_P6];

// ---------- SCHEDULE ----------
// Header fields (page 1)
const SCHED_HEADER: Field[] = [
  {
    key: "sched_client",
    rects: [
      { page: 1, x0: 504.9, top: 29.9, x1: 534.2, size: 12 },
      { page: 1, x0: 56.7, top: 43.8, x1: 158.2, size: 12 },
    ],
    value: c => c.client_full_name,
  },
  { key: "sched_number", rects: [{ page: 1, x0: 334.4, top: 43.8, x1: 436.3, size: 12 }], value: c => c.contract_number },
  {
    key: "sched_date",
    rects: [
      { page: 1, x0: 456.4, top: 43.8, x1: 537.1, size: 12 },
      { page: 1, x0: 56.7, top: 57.7, x1: 165.0, size: 12 },
    ],
    value: c => c.contract_date,
  },
];

// Table row coordinates: [page, dateTop, dateX0, dateX1, amtTop, amtX0, amtX1]
const SCHED_ROWS: Array<{ page: number; dateTop: number; dateX0: number; dateX1: number; amtTop: number; amtX0: number; amtX1: number }> = [
  { page: 1, dateTop: 135.9, dateX0: 92.7, dateX1: 249.8, amtTop: 129.1, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 157.0, dateX0: 92.7, dateX1: 246.9, amtTop: 157.3, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 199.4, dateX0: 92.7, dateX1: 246.9, amtTop: 199.7, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 241.8, dateX0: 92.7, dateX1: 246.9, amtTop: 242.1, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 284.2, dateX0: 92.7, dateX1: 246.9, amtTop: 284.5, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 326.6, dateX0: 92.7, dateX1: 246.9, amtTop: 326.9, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 369.0, dateX0: 92.7, dateX1: 246.9, amtTop: 369.3, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 411.3, dateX0: 92.7, dateX1: 246.9, amtTop: 411.6, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 453.7, dateX0: 92.7, dateX1: 246.9, amtTop: 454.0, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 496.1, dateX0: 92.7, dateX1: 246.9, amtTop: 496.4, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 538.5, dateX0: 92.7, dateX1: 246.9, amtTop: 538.8, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 580.9, dateX0: 92.7, dateX1: 246.9, amtTop: 581.2, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 623.3, dateX0: 92.7, dateX1: 246.9, amtTop: 623.6, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 665.7, dateX0: 92.7, dateX1: 246.9, amtTop: 666.0, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 708.1, dateX0: 92.7, dateX1: 246.9, amtTop: 708.4, amtX0: 281.9, amtX1: 430.9 },
  { page: 1, dateTop: 750.5, dateX0: 92.7, dateX1: 246.9, amtTop: 750.8, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 56.4, dateX0: 92.7, dateX1: 246.9, amtTop: 56.7, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 98.8, dateX0: 92.7, dateX1: 246.9, amtTop: 99.1, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 141.3, dateX0: 92.7, dateX1: 246.9, amtTop: 141.6, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 183.7, dateX0: 92.7, dateX1: 246.9, amtTop: 184.0, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 226.1, dateX0: 92.7, dateX1: 246.9, amtTop: 226.4, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 268.5, dateX0: 92.7, dateX1: 246.9, amtTop: 268.8, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 310.9, dateX0: 92.7, dateX1: 246.9, amtTop: 311.2, amtX0: 281.9, amtX1: 430.9 },
  { page: 2, dateTop: 353.3, dateX0: 92.7, dateX1: 246.9, amtTop: 353.6, amtX0: 281.9, amtX1: 430.9 },
];
const SCHED_SIG: Field[] = [
  { key: "sig_name", rects: [{ page: 2, x0: 321.1, top: 463.6, x1: 391.9, size: 12 }], value: c => c.client_full_name },
  { key: "sig_addr", rects: [{ page: 2, x0: 360.6, top: 477.4, x1: 464.6, size: 12 }], value: c => c.client_address },
  { key: "sig_tin", rects: [{ page: 2, x0: 353.6, top: 491.2, x1: 416.5, size: 12 }], value: c => c.client_tin },
  { key: "sig_phone", rects: [{ page: 2, x0: 346.1, top: 560.1, x1: 372.6, size: 12 }], value: c => c.client_phone },
];

// ---------- helpers ----------
function moneyTJ(n: number): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

async function loadMasterBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Cannot load template: ${url}`);
  return await r.arrayBuffer();
}
async function loadFontBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Cannot load font: ${url}`);
  return await r.arrayBuffer();
}

/** Cover a red rect with white and draw new text. */
function patchRects(
  pdf: PDFDocument,
  rects: Rect[],
  text: string,
  font: PDFFont,
  bold: boolean,
) {
  if (!text) {
    // Just wipe the placeholder so red text is gone
    for (const r of rects) {
      const page = pdf.getPage(r.page - 1);
      const w = r.x1 - r.x0;
      const h = r.size + 2;
      page.drawRectangle({
        x: r.x0 - 1,
        y: PAGE_H - r.top - h + 1,
        width: w + 2,
        height: h,
        color: rgb(1, 1, 1),
      });
    }
    return;
  }
  // Wipe all rects with white
  for (const r of rects) {
    const page = pdf.getPage(r.page - 1);
    const w = r.x1 - r.x0;
    const h = r.size + 2;
    page.drawRectangle({
      x: r.x0 - 1,
      y: PAGE_H - r.top - h + 1,
      width: w + 2,
      height: h,
      color: rgb(1, 1, 1),
    });
  }
  // Compose one continuous available width across rects (multi-line if needed)
  // For simplicity: draw on the first rect. If text too wide, shrink font.
  const first = rects[0];
  const page = pdf.getPage(first.page - 1);
  const targetWidth = rects.reduce((s, r) => s + (r.x1 - r.x0), 0);
  let size = first.size;
  let width = font.widthOfTextAtSize(text, size);
  while (width > targetWidth && size > 7) {
    size -= 0.5;
    width = font.widthOfTextAtSize(text, size);
  }
  // baseline y for pdf-lib
  const baseline = PAGE_H - first.top - size * 0.85;
  page.drawText(text, {
    x: first.x0,
    y: baseline,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

async function renderOverlay(url: string, ctx: ContractCtx, fields: Field[]): Promise<Uint8Array> {
  const [masterBytes, regBytes, boldBytes] = await Promise.all([
    loadMasterBytes(url),
    loadFontBytes("/fonts/PTSerif-Regular.ttf"),
    loadFontBytes("/fonts/PTSerif-Bold.ttf"),
  ]);
  const pdf = await PDFDocument.load(masterBytes);
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  for (const f of fields) {
    const val = (f.value(ctx) ?? "").toString().trim();
    patchRects(pdf, f.rects, val, f.bold ? bold : regular, !!f.bold);
  }
  return await pdf.save();
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadFullContractOverlay(ctx: ContractCtx) {
  const bytes = await renderOverlay("/contract-templates/full-payment.pdf", ctx, FULL_FIELDS);
  downloadBytes(bytes, `Шартнома-${ctx.contract_number || "нав"}.pdf`);
}

export async function downloadInstallmentContractOverlay(ctx: ContractCtx) {
  const bytes = await renderOverlay("/contract-templates/installment.pdf", ctx, INST_FIELDS);
  downloadBytes(bytes, `Шартномаи-рассрочка-${ctx.contract_number || "нав"}.pdf`);
}

export async function downloadScheduleOverlay(ctx: ContractCtx) {
  // Build schedule row fields
  const rowFields: Field[] = [];
  const total = ctx.installment_months || 0;
  const start = parseDateDDMMYYYY(ctx.first_payment_date) || new Date();
  const monthly = ctx.monthly_payment || 0;
  for (let i = 0; i < Math.min(total, SCHED_ROWS.length); i++) {
    const row = SCHED_ROWS[i];
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    rowFields.push({
      key: `date_${i}`,
      rects: [{ page: row.page, x0: row.dateX0, top: row.dateTop, x1: row.dateX1, size: 12 }],
      value: () => dateStr,
    });
    rowFields.push({
      key: `amt_${i}`,
      rects: [{ page: row.page, x0: row.amtX0, top: row.amtTop, x1: row.amtX1, size: 12 }],
      value: () => moneyTJ(monthly),
    });
  }
  // Wipe unused row placeholders too
  for (let i = total; i < SCHED_ROWS.length; i++) {
    const row = SCHED_ROWS[i];
    rowFields.push({ key: `blank_d_${i}`, rects: [{ page: row.page, x0: row.dateX0, top: row.dateTop, x1: row.dateX1, size: 12 }], value: () => "" });
    rowFields.push({ key: `blank_a_${i}`, rects: [{ page: row.page, x0: row.amtX0, top: row.amtTop, x1: row.amtX1, size: 12 }], value: () => "" });
  }
  const fields = [...SCHED_HEADER, ...rowFields, ...SCHED_SIG];
  const bytes = await renderOverlay("/contract-templates/schedule.pdf", ctx, fields);
  downloadBytes(bytes, `График-пардохтҳо-${ctx.contract_number || "нав"}.pdf`);
}

function parseDateDDMMYYYY(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
