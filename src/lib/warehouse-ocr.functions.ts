import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReceiptDocsScanResult = {
  check_number: string | null;
  patent_number: string | null;
};

type OcrProvider = {
  name: string;
  url: string;
  headerVariants: Record<string, string>[];
  models: string[];
};

// Дар Lovable Cloud — AI Gateway; дар сервери худӣ (VPS) — калиди OpenAI.
function resolveProvider(): OcrProvider {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  const preferOpenAI = forced === "openai" && !!openaiKey;

  if (!preferOpenAI && lovableKey) {
    return {
      name: "Lovable AI Gateway",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headerVariants: [
        { authorization: `Bearer ${lovableKey}` },
        { "Lovable-API-Key": lovableKey },
      ],
      models: ["openai/gpt-5.5", "openai/gpt-5.4", "google/gemini-3.6-flash"],
    };
  }
  if (openaiKey) {
    const flash = process.env.OPENAI_OCR_MODEL?.trim() || "gpt-4o-mini";
    const pro = process.env.OPENAI_OCR_MODEL_PRO?.trim() || "gpt-4o";
    return {
      name: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      headerVariants: [{ authorization: `Bearer ${openaiKey}` }],
      models: Array.from(new Set([pro, flash])),
    };
  }
  throw new Error("Сканер танзим нашудааст (LOVABLE_API_KEY ё OPENAI_API_KEY)");
}

function gatewayError(status: number, text: string): Error {
  if (status === 429) return new Error("Дархостҳо аз ҳад зиёд — каме сабр кунед");
  if (status === 402) return new Error("Кредити AI тамом шуд");
  if (status === 403) return new Error("Сурат қабул нашуд — интернетро санҷед ва сурати хурдтар/равшантар гиред");
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return new Error(`AI Gateway: ${status} ${clean.slice(0, 200)}`);
}

function asDataUrl(s: string): string {
  return s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;
}

// Ширкати корбар — барои санҷиши роҳи файл дар анбор.
async function resolveCompanyId(supabase: any, userId: string): Promise<string> {
  const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (prof?.company_id) return prof.company_id as string;
  const { data: owned } = await supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle();
  if (owned?.id) return owned.id as string;
  throw new Error("Ширкат ёфт нашуд");
}

// Суратҳо аз анбори файлҳо гирифта, ба data URL табдил меёбанд.
// Ин роҳ дархостҳои калони base64-ро аз браузери планшет/телефон нест мекунад.
async function pathsToDataUrls(supabase: any, userId: string, paths: string[]): Promise<string[]> {
  const companyId = await resolveCompanyId(supabase, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: string[] = [];
  for (const p of paths) {
    if (!p.startsWith(`${companyId}/`)) throw new Error("Роҳи сурат нодуруст аст");
    const { data, error } = await (supabaseAdmin as any).storage.from("warehouse-docs").download(p);
    if (error || !data) throw new Error("Сурат аз анбор гирифта нашуд");
    const buf = Buffer.from(await data.arrayBuffer());
    out.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
  }
  return out;
}

// Дархост ду навъи сарлавҳаи калид месанҷад: агар яке 401/403 диҳад, дигараш санҷида мешавад.
async function postGateway(provider: OcrProvider, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  let last: Response | null = null;
  for (const auth of provider.headerVariants) {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth },
      body,
    });
    if (res.status !== 401 && res.status !== 403) return res;
    last = res;
  }
  return last!;
}

async function callGateway(provider: OcrProvider, model: string, content: any[]): Promise<string> {
  const res = await postGateway(provider, ({
      model,
      max_completion_tokens: 1500,
      messages: [
        {
          role: "system",
          content:
            "You are an OCR assistant for store receipts (чек) and patents (патент) from Tajikistan markets/shops. " +
            "Extract the receipt/check number and the patent number exactly as printed. " +
            "Check numbers may be labelled: № чека, чек №, receipt, № документа, налоговый чек, фискальный номер. " +
            "Patent numbers may be labelled: патент №, № патента, свидетельство, серия. " +
            "Copy digits/letters character-for-character. If a value is not visible, return null.",
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt_docs",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              check_number: { type: ["string", "null"] },
              patent_number: { type: ["string", "null"] },
            },
            required: ["check_number", "patent_number"],
          },
        },
      },
  }));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw gatewayError(res.status, text);
  }
  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content;
  if (typeof out !== "string" || !out.trim()) throw new Error("Ҷавоби холӣ аз AI");
  return out;
}

export const scanReceiptDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        check_image: z.string().min(100).max(8_000_000).optional().nullable(),
        patent_image: z.string().min(100).max(8_000_000).optional().nullable(),
        check_path: z.string().min(3).max(400).optional().nullable(),
        patent_path: z.string().min(3).max(400).optional().nullable(),
      })
      .refine((v) => v.check_image || v.patent_image || v.check_path || v.patent_path, {
        message: "Сурат лозим аст",
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ReceiptDocsScanResult> => {
    const provider = resolveProvider();

    const content: any[] = [
      {
        type: "text",
        text:
          "Read the attached photo(s). They may contain a store receipt (чек) and/or a patent (патент). " +
          "Return JSON with check_number and patent_number.",
      },
    ];
    const paths = [data.check_path, data.patent_path].filter(Boolean) as string[];
    if (paths.length) {
      const urls = await pathsToDataUrls(context.supabase, context.userId, paths);
      for (const u of urls) content.push({ type: "image_url", image_url: { url: u } });
    }
    if (data.check_image) content.push({ type: "image_url", image_url: { url: asDataUrl(data.check_image) } });
    if (data.patent_image) content.push({ type: "image_url", image_url: { url: asDataUrl(data.patent_image) } });

    let raw: string;
    try {
      raw = await callGateway(provider, provider.models[0]!, content);
    } catch {
      try {
        raw = await callGateway(provider, provider.models[1] ?? provider.models[0]!, content);
      } catch {
        raw = await callGateway(provider, provider.models[provider.models.length - 1]!, content);
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }
    const clean = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t ? t : null;
    };
    return { check_number: clean(parsed.check_number), patent_number: clean(parsed.patent_number) };
  });

export type ScannedItem = {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

const ITEMS_SYSTEM =
  "You are an OCR assistant for supplier invoices / delivery notes (накладная, счёт-фактура, чек) " +
  "from Tajikistan shops and warehouses. Extract every line item exactly as printed: " +
  "product name, unit of measure, quantity and price per unit. " +
  "If only a total sum per line is printed, divide it by quantity to get unit price. " +
  "Return each product name in clear Tajik Cyrillic. Translate Russian product names into Tajik; " +
  "keep brands, model codes and sizes exactly as printed. Normalize units to one of these values: " +
  "dona, kg, tonna, litr, metr, m2, m3, qop. Never invent rows. " +
  "Use 0 when a number is not readable.";

class GatewayRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function callItemsGateway(provider: OcrProvider, model: string, content: any[]): Promise<string> {
  const res = await postGateway(provider, ({
      model,
      max_completion_tokens: 6000,
      messages: [
        { role: "system", content: ITEMS_SYSTEM },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "invoice_items",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    unit: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                  },
                  required: ["name", "unit", "quantity", "unit_price"],
                },
              },
            },
            required: ["items"],
          },
        },
      },
  }));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GatewayRequestError(res.status, gatewayError(res.status, text).message);
  }
  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content;
  if (typeof out !== "string" || !out.trim()) throw new Error("Ҷавоби холӣ аз AI");
  return out;
}

export const scanInvoiceItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        images: z.array(z.string().min(100).max(8_000_000)).max(4).optional(),
        paths: z.array(z.string().min(3).max(400)).max(4).optional(),
      })
      .refine((v) => (v.images?.length ?? 0) + (v.paths?.length ?? 0) > 0, { message: "Сурат лозим аст" })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ items: ScannedItem[] }> => {
    const provider = resolveProvider();

    const fromPaths = data.paths?.length
      ? await pathsToDataUrls(context.supabase, context.userId, data.paths)
      : [];

    const content: any[] = [
      {
        type: "text",
        text:
          "Накладнойро пурра хонед. Ҳар як молро бо номи тоҷикӣ баргардонед: " +
          "name, unit, quantity, unit_price (нархи ЯК воҳид). Рақамҳо ва маблағҳоро айнан санҷед.",
      },
      ...fromPaths.map((url) => ({ type: "image_url", image_url: { url } })),
      ...(data.images ?? []).map((img) => ({ type: "image_url", image_url: { url: asDataUrl(img) } })),
    ];

    // Ҳар як модел санҷида мешавад; аввалин ҷавоби дорои товар қабул мегардад.
    let parsed: any = null;
    let lastErr: unknown = null;
    for (const model of provider.models) {
      try {
        const raw = await callItemsGateway(provider, model, content);
        let p: any;
        try {
          p = JSON.parse(raw);
        } catch {
          const m = raw.match(/\{[\s\S]*\}/);
          p = m ? JSON.parse(m[0]) : {};
        }
        parsed = p;
        if (Array.isArray(p?.items) && p.items.length > 0) break;
      } catch (e) {
        lastErr = e;
        // Танҳо 400/401/402 воқеан ниҳоӣ ҳастанд; 403/429/5xx бо модели дигар санҷида мешавад.
        if (
          e instanceof GatewayRequestError &&
          (e.status === 400 || e.status === 401 || e.status === 402)
        ) {
          throw e;
        }
      }
    }
    if (!parsed) throw (lastErr instanceof Error ? lastErr : new Error("Сканер кор накард"));

    const num = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const items: ScannedItem[] = Array.isArray(parsed?.items)
      ? parsed.items
          .map((it: any) => ({
            name: typeof it?.name === "string" ? it.name.trim() : "",
            unit: typeof it?.unit === "string" && it.unit.trim() ? it.unit.trim() : "dona",
            quantity: num(it?.quantity),
            unit_price: num(it?.unit_price),
          }))
          .filter((it: ScannedItem) => it.name.length > 0)
      : [];

    return { items };
  });
