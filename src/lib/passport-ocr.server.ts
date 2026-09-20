export type PassportOcrInput = {
  front: string;
  back?: string | null;
};

export type PassportOcrResult = {
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  fullname: string | null;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  passport_series: string | null;
  passport_number: string | null;
  personal_id: string | null;
  passport_issued_by: string | null;
  passport_issued_date: string | null;
  passport_expiry_date: string | null;
  issuing_authority: string | null;
  address: string | null;
  inn: string | null;
  raw?: string;
  raw_ocr_text?: string;
  raw_ocr_response?: string;
  debug?: PassportOcrDebug;
};

type PassportOcrDebug = {
  provider: string;
  model: string;
  stage: "configuration" | "upload" | "vision_ocr" | "text_extraction" | "image_extraction" | "parsing" | "completed";
  reason?: string;
  status?: number;
  log_id?: string | null;
  run_id?: string | null;
  raw_response?: string;
  raw_text?: string;
  image_mime_types?: string[];
};

function asDataUrl(s: string): string {
  return s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const OCR_ERROR_MESSAGE = "Passport could not be recognized. Please take a clearer photo.";
// Gemini reads ID documents reliably and does not refuse personal documents,
// so it is the primary OCR model; the OpenAI model stays as a second opinion.
const FLASH_MODEL = "google/gemini-3.8-flash";
const PRO_MODEL = "google/gemini-3.8-flash";
const FALLBACK_MODEL = "google/gemini-3.8-flash";
type OcrProvider = {
  name: string;
  url: string;
  headers: Record<string, string>;
  flash: string;
  pro: string;
  fallback: string;
};

function resolveOcrProvider(): OcrProvider | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  const openaiKeyPref = process.env.OPENAI_API_KEY?.trim();
  const preferOpenAI = forced === "openai" && !!openaiKeyPref;
  const lovableKey = process.env.LOVABLE_API_KEY?.trim() || process.env.LOVABLE_AI_GATEWAY_KEY?.trim();
  if (!preferOpenAI && lovableKey) {
    return {
      name: "Lovable AI Gateway",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      flash: FLASH_MODEL,
      pro: PRO_MODEL,
      fallback: FALLBACK_MODEL,
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (preferOpenAI && openaiKey) {
    return {
      name: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${openaiKey}` },
      flash: process.env.OPENAI_OCR_MODEL?.trim() || "gpt-4o-mini",
      pro: process.env.OPENAI_OCR_MODEL_PRO?.trim() || "gpt-4o",
      fallback: process.env.OPENAI_OCR_MODEL_PRO?.trim() || "gpt-4o",
    };
  }
  return null;
}

export function assertPassportOcrConfigured() {
  if (!resolveOcrProvider()) {
    throw toDebugError({
      provider: "Lovable AI Gateway",
      model: FLASH_MODEL,
      stage: "configuration",
      reason: "LOVABLE_API_KEY is empty on this server. A separately hosted VPS does not receive Lovable Cloud secrets automatically.",
    }, "Сканери AI дар сервер танзим нашудааст: калиди Lovable дар VPS нест.");
  }
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Қоидаҳои махсуси майдонҳо — рақами паспорт, ИНН/РМА ва «Кӣ додаст». */
const FIELD_RULES_TJ =
  "ҚОИДАҲОИ МАЙДОНҲО: " +
  "0) Майдонҳоро аз ҶОЙГИРШАВӢ ва нишонаи чопшудаи назди онҳо хон. НОМ/Имя/Given names = first_name; НАСАБ/Фамилия/Surname = last_name; НОМИ ПАДАР/Отчество/Patronymic = middle_name. Номи як сатрро ба майдони дигар нагузор. fullname бояд маҳз last_name + first_name + middle_name бошад. Номи лотинӣ ва MRZ-ро танҳо барои санҷиш истифода бар, на барои иваз кардани номи кириллӣ. " +
  "1) passport_series + passport_number: дар паспорти тоҷикӣ рақам чун 'A01234567' ё 'AB 1234567' чоп мешавад — ҳарф(ҳо)-ро ба passport_series ва танҳо рақамҳоро ба passport_number гузор. Ҳарфро партофтан мумкин нест. Рақамро аз минтақаи намоён гир, на аз MRZ, ва 0↔O, 1↔I, 5↔S, 8↔B-ро дуруст фарқ кун. " +
  "2) inn — ин РМА/ИНН (Рақами мушаххаси андозсупоранда, 'РМА', 'ИНН', 'TIN'), ДАҚИҚ 9 рақам аст ва аксар вақт бо фосила ҳамчун 3 гурӯҳи 3-рақама чоп мешавад. Онро дар ҳар ду тарафи ҳуҷҷат, махсусан назди нишонаи РМА/ИНН/TIN ва қисми поёнӣ, махсус ҷустуҷӯ кун. РМА номи ҳамин майдон аст, на personal_id (рақами шахсӣ/ЖШШР). Танҳо 9 рақамро баргардон. Агар аломати рақам ба O/I/S/B монанд бошад, аз рӯйи қатори 9-рақама онро ҳамчун 0/1/5/8 бихон. " +
  "3) issuing_authority ва passport_issued_by — ин 'Кӣ додаст' / 'Кем выдан' / 'Authority' мебошад (масалан 'ШВКД ВКД ш. Душанбе' ё 'Хадамоти шиносномавӣ'). Матни пурраи чопшударо ҳамон тавре ки ҳаст, бо кириллӣ нусха бардор; ихтисорҳоро васеъ накун ва тарҷума накун. " +
  "4) Агар ин майдонҳо дар тасвир набошанд — null гузор, ҳеҷ гоҳ тахмин накун. ";


function passportOcrLog(message: string, details?: Record<string, unknown>) {
  console.info("[passport-ocr]", message, details ?? {});
}

function stringifyForDebug(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 8000);
  try {
    return JSON.stringify(value).slice(0, 8000);
  } catch {
    return String(value).slice(0, 8000);
  }
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toDebugError(debug: PassportOcrDebug, message = OCR_ERROR_MESSAGE): Error {
  return new Error(`OCR_DEBUG:${JSON.stringify({ message, debug })}`);
}

function imageInfo(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) {
    return { dataUrl: `data:image/jpeg;base64,${value}`, mime: "image/jpeg", chars: value.length };
  }
  return { dataUrl: value, mime: match[1].toLowerCase(), chars: match[2].length };
}

function normalizeDate(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!dotted) return text;
  const day = dotted[1].padStart(2, "0");
  const month = dotted[2].padStart(2, "0");
  return `${dotted[3]}-${month}-${day}`;
}

const CYR_TO_LAT: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", У: "Y", Х: "X",
};

function latinizeCode(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join("");
}

function normalizePassportSeries(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  return latinizeCode(text).replace(/[^A-Z]/g, "") || null;
}

/** Паспорти тоҷикӣ: A01234567 — ҳарфи серия + рақамҳо. Ҳарфро нигоҳ медорем. */
function normalizePassportNumber(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  return latinizeCode(text).replace(/[^A-Z0-9]/g, "") || null;
}

function normalizeDigits(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  return text.replace(/\D/g, "") || null;
}

function normalizeOcrDigits(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  const digits = text
    .replace(/[ОOОQ]/gi, "0")
    .replace(/[ІIӀIl|]/g, "1")
    .replace(/[ЗZ]/gi, "2")
    .replace(/[ББ]/g, "6")
    .replace(/[ВB]/g, "8")
    .replace(/[СS]/g, "5")
    .replace(/\D/g, "");
  return digits || null;
}

/** РМА/ИНН-и Тоҷикистон аз 9 рақам иборат аст. */
function normalizeInn(value: unknown): string | null {
  const digits = normalizeOcrDigits(value);
  if (!digits) return null;
  if (digits.length === 9) return digits;
  const embedded = digits.match(/(?:^|\D)(\d{9})(?:\D|$)/)?.[1];
  return embedded ?? null;
}

function findInnInText(text: string): string | null {
  const labels = /(?:Р\s*[МM]\s*[АA]|И\s*[НH]\s*[НH]|INN|TIN|Рақами\s+(?:мушаххаси\s+)?андоз[^\n:]*)/gi;
  for (const match of text.matchAll(labels)) {
    const start = (match.index ?? 0) + match[0].length;
    const nearby = text.slice(start, start + 90);
    const candidate = nearby.match(/(?:[0-9ОOОQІIӀIl|ЗZБВBСS][\s.:/\-]*){9}/)?.[0];
    const inn = normalizeInn(candidate);
    if (inn) return inn;
  }
  return null;
}

function findAuthorityInText(text: string): string | null {
  const m = text.match(
    /(?:Кӣ\s+додаст|Ки\s+додаст|Кем\s+выдан|Authority|Issued\s+by|Мақоми\s+додашуда)\s*[:\-]?\s*([^\n]{3,120})/i,
  );
  return m ? compactLine(m[1]) : null;
}


function compactLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractJsonObject(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]); } catch { return {}; }
  }
}

function parseMrzDate(value: string, kind: "birth" | "expiry"): string | null {
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const currentYear = new Date().getFullYear() % 100;
  const century = kind === "birth" && year > currentYear ? 1900 : 2000;
  return `${century + year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseMrzFallback(rawText: string): Partial<PassportOcrResult> {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s/g, "").toUpperCase())
    .filter((line) => line.includes("<") && line.length >= 20);
  const result: Partial<PassportOcrResult> = {};
  const nameLine = lines.find((line) => /^[A-Z0-9<]{1,2}[A-Z]{3}/.test(line) && line.includes("<<"));
  if (nameLine) {
    const withoutPrefix = nameLine.replace(/^[A-Z0-9<]{1,2}[A-Z]{3}/, "");
    const [last, rest = ""] = withoutPrefix.split("<<");
    const firstParts = rest.split("<").filter(Boolean);
    result.last_name = compactLine(last.replace(/</g, " ")) || null;
    result.first_name = compactLine(firstParts[0] ?? "") || null;
    result.middle_name = compactLine(firstParts.slice(1).join(" ")) || null;
  }
  const dataLine = lines.find((line) => /\d{6}[0-9A-Z<]\d{6}/.test(line));
  if (dataLine) {
    const passportMatch = dataLine.match(/^([A-Z0-9<]{6,12})/);
    const dateMatch = dataLine.match(/(\d{6})[0-9A-Z<]([MF<])([0-9]{6})/);
    if (passportMatch) result.passport_number = normalizePassportNumber(passportMatch[1]);
    if (dateMatch) {
      result.birth_date = parseMrzDate(dateMatch[1], "birth");
      result.gender = dateMatch[2] === "<" ? null : dateMatch[2];
      result.passport_expiry_date = parseMrzDate(dateMatch[3], "expiry");
    }
  }
  const fullname = [result.last_name, result.first_name, result.middle_name].filter(Boolean).join(" ");
  if (fullname) result.fullname = fullname;
  return result;
}

function parsePassportText(text: string): PassportOcrResult {
  const parsed: any = extractJsonObject(text);
  const rawText = [
    parsed.raw_ocr_text,
    parsed.visible_text,
    parsed.ocr_text,
    parsed.raw_text,
    parsed.text,
    typeof text === "string" ? text : "",
  ].filter((v) => typeof v === "string").join("\n");
  const mrz = parseMrzFallback(rawText);

  const inn =
    normalizeInn(
      parsed.inn ?? parsed.taxpayer_id ?? parsed.tax_id ?? parsed.tin ?? parsed.rma ?? parsed.pma ?? parsed.rma_number,
    ) ?? findInnInText(rawText);
  const issuingAuthority =
    nullableString(parsed.issuing_authority) ??
    nullableString(parsed.passport_issued_by) ??
    nullableString(parsed.issued_by) ??
    nullableString(parsed.authority) ??
    findAuthorityInText(rawText);
  const firstName = nullableString(parsed.first_name) ?? mrz.first_name ?? null;
  const lastName = nullableString(parsed.last_name) ?? mrz.last_name ?? null;
  const middleName = nullableString(parsed.middle_name) ?? mrz.middle_name ?? null;
  const mergedName = [lastName, firstName, middleName].filter(Boolean).join(" ");
  const fullname = nullableString(parsed.fullname) ?? mrz.fullname ?? (mergedName || null);

  let series = normalizePassportSeries(parsed.passport_series);
  let number = normalizePassportNumber(parsed.passport_number) ?? mrz.passport_number ?? null;
  // "A01234567" → серия A, рақам 01234567 (агар серия алоҳида набошад)
  if (number) {
    const split = number.match(/^([A-Z]{1,2})(\d{6,9})$/);
    if (split) {
      if (!series) series = split[1];
      if (series === split[1]) number = split[2];
    }
  }

  return {
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
    fullname,
    birth_date: normalizeDate(parsed.birth_date) ?? mrz.birth_date ?? null,
    gender: nullableString(parsed.gender) ?? mrz.gender ?? null,
    nationality: nullableString(parsed.nationality),
    passport_series: series,
    passport_number: number,
    personal_id: normalizeDigits(parsed.personal_id),
    passport_issued_by: issuingAuthority,
    passport_issued_date: normalizeDate(parsed.passport_issued_date),
    passport_expiry_date: normalizeDate(parsed.passport_expiry_date) ?? mrz.passport_expiry_date ?? null,
    issuing_authority: issuingAuthority,
    address: nullableString(parsed.address),
    inn,
  };
}


async function postPassportOcr(provider: OcrProvider, body: unknown, attempt: number, stage: PassportOcrDebug["stage"]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const started = Date.now();
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...provider.headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    passportOcrLog("gateway response", {
      stage,
      attempt,
      status: res.status,
      duration_ms: Date.now() - started,
      log_id: res.headers.get("X-Lovable-AIG-Log-ID"),
      run_id: res.headers.get("X-Lovable-AIG-Run-ID"),
    });
    return res;
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    passportOcrLog("gateway request failed", { stage, attempt, name, message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  }
  return Math.min(750 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250), 10_000);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function callGatewayJson(provider: OcrProvider, body: unknown, stage: PassportOcrDebug["stage"], imageMimes: string[]) {
  let lastDebug: PassportOcrDebug | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let res: Response;
    try {
      res = await postPassportOcr(provider, body, attempt, stage);
    } catch (error) {
      lastDebug = {
        provider: provider.name,
        model: (body as any)?.model ?? provider.flash,
        stage,
        reason: error instanceof Error ? error.message : String(error),
        image_mime_types: imageMimes,
      };
      if (attempt === 1) continue;
      throw toDebugError(lastDebug);
    }

    const text = await res.text().catch((error) => {
      lastDebug = {
        provider: provider.name,
        model: (body as any)?.model ?? provider.flash,
        stage,
        status: res.status,
        reason: error instanceof Error ? error.message : String(error),
        log_id: res.headers.get("X-Lovable-AIG-Log-ID"),
        run_id: res.headers.get("X-Lovable-AIG-Run-ID"),
        image_mime_types: imageMimes,
      };
      return "";
    });

    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    const debug: PassportOcrDebug = {
      provider: provider.name,
      model: (body as any)?.model ?? provider.flash,
      stage,
      status: res.status,
      log_id: res.headers.get("X-Lovable-AIG-Log-ID"),
      run_id: res.headers.get("X-Lovable-AIG-Run-ID"),
      raw_response: stringifyForDebug(json ?? text.slice(0, 4000)),
      image_mime_types: imageMimes,
    };

    if (res.ok) {
      const refusal = json?.choices?.[0]?.message?.refusal;
      const content = messageContentText(json);
      if (typeof refusal === "string" && refusal.trim()) {
        throw toDebugError({ ...debug, reason: refusal.trim() });
      }
      if (!content.trim()) {
        throw toDebugError({ ...debug, reason: "AI returned an empty OCR result" });
      }
      return { json, text, debug };
    }

    const errorText = typeof json?.error?.message === "string" ? json.error.message : text.slice(0, 500);
    lastDebug = { ...debug, reason: errorText || `HTTP ${res.status}` };
    passportOcrLog("gateway error", {
      stage,
      attempt,
      status: res.status,
      reason: lastDebug.reason,
      retrying: attempt === 1 && RETRYABLE_STATUSES.has(res.status),
      log_id: debug.log_id,
      run_id: debug.run_id,
    });

    if (res.status === 402) throw toDebugError({ ...lastDebug, reason: "AI credits exhausted" }, "AI кредитҳо тамом шуданд. Лутфан кредитҳоро пур кунед.");
    if (attempt === 1 && RETRYABLE_STATUSES.has(res.status)) {
      await wait(retryDelayMs(res, attempt));
      continue;
    }
    throw toDebugError(lastDebug);
  }
  throw toDebugError(lastDebug ?? { provider: provider.name, model: provider.flash, stage, reason: "unknown_gateway_failure", image_mime_types: imageMimes });
}

function messageContentText(gatewayJson: any): string {
  const content = gatewayJson?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === "string" ? part.text : "").join("\n");
  }
  return "";
}

function flattenText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(flattenText).filter(Boolean).join("\n");
  }
  return "";
}

function visibleTextFromOcrPayload(payload: any): string {
  const root = extractJsonObject(messageContentText(payload));
  const visible = [root.visible_text, root.raw_text, root.ocr_text, root.text, root.mrz_lines, root.lines, root.blocks]
    .map(flattenText)
    .filter((v) => v.trim().length)
    .join("\n");
  return visible.trim() || messageContentText(payload);
}


function hasExtractedFields(parsed: PassportOcrResult) {
  return Boolean(parsed.fullname || parsed.first_name || parsed.last_name || parsed.passport_number || parsed.personal_id || parsed.birth_date);
}

export async function extractPassportFromImages(data: PassportOcrInput): Promise<PassportOcrResult> {


  const provider = resolveOcrProvider();
  if (!provider) {
    throw toDebugError({
      provider: "Lovable AI Gateway",
      model: FLASH_MODEL,
      stage: "configuration",
      reason: "LOVABLE_API_KEY is empty on this server. A separately hosted VPS does not receive Lovable Cloud secrets automatically.",
    }, "Сканери AI дар сервер танзим нашудааст: калиди Lovable дар VPS нест.");
  }


  const frontImage = imageInfo(data.front);
  const backImage = data.back ? imageInfo(data.back) : null;
  const imageMimes = [frontImage.mime, backImage?.mime].filter((v): v is string => Boolean(v));
  const unsupportedMime = imageMimes.find((mime) => !SUPPORTED_IMAGE_MIME_TYPES.has(mime));
  if (unsupportedMime) {
    const debug: PassportOcrDebug = {
      provider: provider.name,
      model: provider.flash,
      stage: "upload",
      reason: `Unsupported image MIME type: ${unsupportedMime}`,
      image_mime_types: imageMimes,
    };
    passportOcrLog("unsupported image format", debug);
    throw toDebugError(debug);
  }

  const imageCount = backImage ? 2 : 1;
  passportOcrLog("started", {
    image_count: imageCount,
    image_mime_types: imageMimes,
    front_chars: frontImage.chars,
    back_chars: backImage?.chars ?? 0,
  });

  const ocrParts: any[] = [
    {
      type: "text",
      text:
        "OCR-и воқеӣ иҷро кун. Аз тасвир(ҳо) ҲАМАИ матни намоёнро бихон, ҳатто агар ҳуҷҷат passport/ID набошад. " +
        "JSON баргардон: document_detected(boolean), document_type(string|null), visible_text(string), mrz_lines(array), notes(string|null). " +
        "Матнро бо line breaks нигоҳ дор. Ҳеҷ майдонро тахмин накун. " +
        "Дар ҳар ду тараф нишонаи РМА/ИНН/TIN ва 9 рақами баъди онро ҳатман ҷустуҷӯ ва ба visible_text дохил кун; PMA-и бо ҳарфҳои лотинӣ монанд низ РМА аст. " +
        "ХЕЛЕ МУҲИМ: матнро АНИҚ ҳамон тавре ки дар ҳуҷҷат чоп шудааст нусхабардорӣ кун — ҳарфҳои кириллиро бо кириллӣ навис, ягон ҳарфро иваз накун ва ба лотинӣ тарҷума накун. " +
        "Ном, насаб ва номи падарро ҳарф ба ҳарф аз қисмати кириллии ҳуҷҷат нусха бардор (на аз MRZ). Ҳарфҳои махсуси тоҷикӣ (Ӯ, Ҷ, Ҳ, Қ, Ғ, И, ӣ)-ро дуруст фарқ кун.",
    },
    { type: "image_url", image_url: { url: frontImage.dataUrl } },
  ];
  if (backImage) {
    ocrParts.push({ type: "image_url", image_url: { url: backImage.dataUrl } });
  }

  const ocrBody = {
    model: provider.flash,
    messages: [
      {
        role: "system",
        content: "You are a vision OCR engine. Return only valid JSON. Do not invent missing text.",
      },
      { role: "user", content: ocrParts },
    ],
    response_format: { type: "json_object" },
  };

  const buildDirectBody = (visibleText?: string, model?: string) => ({
    model: model ?? provider.pro,
    messages: [
      {
        role: "system",
        content:
          "You are a precise passport OCR engine. Extract each value only from its printed label and physical location. " +
          "Never shift values between adjacent rows. Return only valid JSON.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Read the passport/ID image itself and extract fields as JSON: first_name,last_name,middle_name,fullname,birth_date,gender,nationality,passport_series,passport_number,personal_id,passport_issued_by,passport_issued_date,passport_expiry_date,issuing_authority,address,inn. The key inn is the field printed as РМА/PMA/ИНН/TIN. " +
              "Dates YYYY-MM-DD. Null if missing or uncertain. Do not invent. Treat the front and back as pages of ONE document and never move a value into a neighboring field. " +
              "IMPORTANT: return first_name, last_name, middle_name and fullname in Tajik Cyrillic. Tajik passports print the name twice — in Cyrillic and in Latin: ALWAYS copy the Cyrillic printed version letter-by-letter exactly as shown in the visual zone (never from MRZ, never re-transliterate). Distinguish Tajik letters correctly (Ӯ, Ҷ, Ҳ, Қ, Ғ, Ӣ). Only if no Cyrillic version exists, transliterate from Latin. " +
              FIELD_RULES_TJ +
              (visibleText ? "\nA preliminary OCR transcript follows. It may contain errors and has lost layout. Use it only to verify characters; the image and printed labels are authoritative:\n" + visibleText : ""),
          },
          { type: "image_url", image_url: { url: frontImage.dataUrl } },
          ...(backImage ? [{ type: "image_url", image_url: { url: backImage.dataUrl } }] : []),
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const ocr = await callGatewayJson(provider, ocrBody, "vision_ocr", imageMimes);
  const rawOcrText = visibleTextFromOcrPayload(ocr.json);
  passportOcrLog("raw OCR response", {
    log_id: ocr.debug.log_id,
    run_id: ocr.debug.run_id,
    raw_text_chars: rawOcrText.length,
    raw_text_preview: rawOcrText.slice(0, 700),
  });

  // No usable OCR text (stage failed or returned nothing) → read the image directly,
  // first with the primary model, then with the second-opinion model.
  if (!rawOcrText.trim()) {
    const models = provider.pro === provider.fallback ? [provider.pro] : [provider.pro, provider.fallback];
    let lastDirect: { json: any; text: string; debug: PassportOcrDebug } | null = null;
    for (const model of models) {
      let direct: { json: any; text: string; debug: PassportOcrDebug };
      try {
        direct = await callGatewayJson(provider, buildDirectBody(undefined, model), "image_extraction", imageMimes);
      } catch (error) {
        passportOcrLog("direct extraction failed", { model, reason: error instanceof Error ? error.message.slice(0, 300) : String(error) });
        if (model === models[models.length - 1]) throw error;
        continue;
      }
      lastDirect = direct;
      const parsedDirect = parsePassportText(JSON.stringify(extractJsonObject(messageContentText(direct.json))));
      if (hasExtractedFields(parsedDirect)) {
        parsedDirect.raw_ocr_response = stringifyForDebug({ image_extraction: direct.debug.raw_response });
        parsedDirect.debug = { ...direct.debug, stage: "completed", model };
        passportOcrLog("completed via direct image extraction", { model, has_fullname: !!parsedDirect.fullname });
        return parsedDirect;
      }
      passportOcrLog("direct extraction returned no fields", { model });
    }
    throw toDebugError(
      { ...(lastDirect?.debug ?? { provider: provider.name, model: provider.pro, stage: "image_extraction" as const }), stage: "parsing", reason: "No text detected in image", image_mime_types: imageMimes },
      OCR_ERROR_MESSAGE,
    );
  }


  // Layout is essential for passports: extract from the images with the accurate
  // model. The preliminary transcript only helps verify ambiguous characters.
  const extracted = await callGatewayJson(provider, buildDirectBody(rawOcrText), "image_extraction", imageMimes);
  const extractionText = messageContentText(extracted.json) || "{}";
  let parsed = parsePassportText(JSON.stringify({ ...extractJsonObject(extractionText), raw_ocr_text: rawOcrText }));


  if (!hasExtractedFields(parsed)) {
    passportOcrLog("text extraction found OCR text but no fields; escalating to image extraction", {
      ocr_log_id: ocr?.debug.log_id,
      extraction_log_id: extracted.debug.log_id,
      raw_text_preview: rawOcrText.slice(0, 700),
    });
    const direct = await callGatewayJson(provider, buildDirectBody(rawOcrText, provider.fallback), "image_extraction", imageMimes);
    parsed = parsePassportText(JSON.stringify({ ...extractJsonObject(messageContentText(direct.json)), raw_ocr_text: rawOcrText }));
    parsed.raw_ocr_response = stringifyForDebug({ vision_ocr: ocr?.debug.raw_response, text_extraction: extracted.debug.raw_response, image_extraction: direct.debug.raw_response });
    parsed.debug = { ...direct.debug, stage: hasExtractedFields(parsed) ? "completed" : "parsing", raw_text: rawOcrText };
  } else {
    parsed.raw_ocr_response = stringifyForDebug({ vision_ocr: ocr?.debug.raw_response, text_extraction: extracted.debug.raw_response });
    parsed.debug = { ...extracted.debug, stage: "completed", raw_text: rawOcrText };
  }

  parsed.raw = extractionText;
  parsed.raw_ocr_text = rawOcrText;

  if (!hasExtractedFields(parsed)) {
    const reason = rawOcrText.length > 0
      ? "OCR detected text, but no passport fields could be extracted. The image may not be a passport/ID or the passport fields are outside the frame."
      : "No text detected in image";
    const debug: PassportOcrDebug = {
      provider: provider.name,
      model: provider.pro,
      stage: "parsing",
      reason,
      raw_response: parsed.raw_ocr_response,
      raw_text: rawOcrText,
      image_mime_types: imageMimes,
    };
    passportOcrLog("extraction failed with raw OCR available", debug);
    throw toDebugError(debug);
  }

  passportOcrLog("completed", {
    has_fullname: !!parsed.fullname,
    has_passport_number: !!parsed.passport_number,
    has_personal_id: !!parsed.personal_id,
    has_inn: !!parsed.inn,
    raw_text_chars: rawOcrText.length,
  });

  return parsed;
}
