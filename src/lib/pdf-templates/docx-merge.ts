import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import pkg from "file-saver";
const { saveAs } = pkg;
import { buildContractContext } from "./context";
import { amountToTajikWords } from "@/lib/num-to-words";


const TEMPLATES = {
  full: "/contract-templates/full-payment.docx",
  installment: "/contract-templates/installment.docx",
  schedule: "/contract-templates/payment-schedule.docx",
} as const;

export type TemplateKind = keyof typeof TEMPLATES;

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
}

function parseDateDDMMYYYY(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const TJ_MONTHS = [
  "январи", "феврали", "марти", "апрели", "майи", "июни",
  "июли", "августи", "сентябри", "октябри", "ноябри", "декабри",
];

function fmtDateTj(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd} ${TJ_MONTHS[d.getMonth()]} соли ${d.getFullYear()}`;
}

type ScheduleRow = { n: string; date: string; amount_line: string };

function buildScheduleRows(ctx: Awaited<ReturnType<typeof buildContractContext>>): ScheduleRow[] {
  const months = Math.max(0, Math.floor(ctx.installment_months || 0));
  if (months <= 0) return [];
  const monthly = ctx.monthly_payment || 0;
  const start = parseDateDDMMYYYY(ctx.first_payment_date) || new Date();
  const rows: ScheduleRow[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    rows.push({
      n: String(i + 1),
      date: fmtDateTj(d),
      amount_line: `${fmtMoney(monthly)} сомонӣ (${amountToTajikWords(Math.round(monthly))}) бо асъори миллӣ дар рӯзи пардохт`,
    });
  }
  return rows;
}

function buildScheduleText(ctx: Awaited<ReturnType<typeof buildContractContext>>): string {
  return buildScheduleRows(ctx)
    .map((r) => `${r.n}. ${r.date} — ${r.amount_line}`)
    .join("\n");
}


function describeDocxError(e: unknown): string {
  const err = e as any;
  const list: any[] = err?.properties?.errors ?? [];
  if (list.length) {
    const details = list
      .slice(0, 5)
      .map((x) => {
        const p = x?.properties ?? {};
        const tag = p.xtag || p.id || "";
        return `${p.explanation || x?.message || "хатоги"}${tag ? ` (${tag})` : ""}`;
      })
      .join("; ");
    return `Шаблони Word хато дорад: ${details}. Тегҳоро дар файли Word тафтиш кунед (масалан {{client_full_name}} бояд пурра ва бе фосила бошад).`;
  }
  return err?.message || "Хатоги ҳангоми сохтани ҳуҷҷат";
}


async function loadTemplateBuffer(kind: TemplateKind, ctx: Awaited<ReturnType<typeof buildContractContext>>): Promise<ArrayBuffer> {
  // Prefer a template uploaded by the company on the «Договор» page.
  const shop = (ctx as any).is_shop === true;
  const path =
    kind === "full"
      ? (shop && ctx.docx_shop_full_path) || ctx.docx_full_path
      : kind === "installment"
        ? (shop && ctx.docx_shop_installment_path) || ctx.docx_installment_path
        : "";
  if (path) {
    const { supabase } = await import("@/integrations/supabase/client");
    const dl = await supabase.storage.from("contract-templates").download(path);
    if (dl.data) return await dl.data.arrayBuffer();
  }
  const res = await fetch(TEMPLATES[kind]);
  if (!res.ok) throw new Error("Шаблони DOCX ёфт нашуд");
  return await res.arrayBuffer();
}

/** Repairs common Word typos: a placeholder that lost its opening «{{» (e.g. «block_name}}»). */
function repairTemplateZip(zip: PizZip) {
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) continue;
    const xml = zip.files[name].asText();
    const fixed = xml.replace(/>([^<>{}]*?)([A-Za-z_][A-Za-z0-9_]*)\}\}</g, (m, pre: string, tag: string) =>
      pre.includes("{{") || /\{\{\s*$/.test(pre) ? m : `>${pre}{{${tag}}}<`,
    );
    if (fixed !== xml) zip.file(name, fixed);
  }
}

export async function downloadContractDocx(kind: TemplateKind, saleId: string, usdRate = 10.9) {
  const ctx = await buildContractContext(saleId, { usdRate });
  const buf = await loadTemplateBuffer(kind, ctx);




  const zip = new PizZip(buf);
  repairTemplateZip(zip);

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
  } catch (e) {
    throw new Error(describeDocxError(e));
  }


  const data: Record<string, unknown> = {
    contract_number: ctx.contract_number,
    contract_date: ctx.contract_date,
    client_full_name: ctx.client_full_name,
    client_birth_year: ctx.client_birth_year,
    client_tin: ctx.client_tin,
    passport_series: ctx.passport_series,
    passport_authority: ctx.passport_authority,
    passport_issue_date: ctx.passport_issue_date,
    Issue_date: ctx.passport_issue_date,
    client_address: ctx.client_address,
    client_phone: ctx.client_phone,
    project_name: ctx.project_name,
    block_name: ctx.block_name,
    floor_number: ctx.floor_number,
    // Aliases — Word шаблонҳо ошёнаро бо номҳои гуногун меноманд.
    floor: ctx.floor_number,
    floor_no: ctx.floor_number,
    floor_num: ctx.floor_number,
    etaj: ctx.floor_number,
    etazh: ctx.floor_number,
    oshyona: ctx.floor_number,

    apt_number: ctx.apt_number,
    area: ctx.area,
    total_price: fmtMoney(ctx.total_price),
    total_price_words: ctx.total_price_words,
    price_usd: ctx.price_usd,
    price_usd_words: ctx.price_usd_words,
    down_payment: fmtMoney(ctx.down_payment),
    down_payment_words: ctx.down_payment_words,
    advance_payment: fmtMoney(ctx.down_payment),
    advance_payment_words: ctx.down_payment_words,
    advance_payment_usd: (ctx as any).advance_payment_usd || "0",
    advance_payment_price_words: (ctx as any).advance_payment_price_words || ctx.down_payment_words || "",
    advance_payment_usd_words_us_dollars: (ctx as any).advance_payment_usd_words || "",
    price_usd_words_us_dollars: ctx.price_usd_words,
    mortgage_payment_schedule: buildScheduleText(ctx),
    rows: buildScheduleRows(ctx),
  };


  try {
    doc.render(data);
  } catch (e) {
    throw new Error(describeDocxError(e));
  }

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const prefix = kind === "schedule" ? "График-пардохтҳо" : "Шартнома";
  saveAs(out, `${prefix}-${ctx.contract_number || "нав"}.docx`);
}
