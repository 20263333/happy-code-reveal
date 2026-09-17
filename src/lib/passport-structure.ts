/**
 * Structured passport data derived from OCR output.
 * No OCR here — this module only defines the shape, validation,
 * normalization and the session-storage bridge between screens.
 */
import { z } from "zod";

export const PASSPORT_FIELDS = [
  "last_name",
  "first_name",
  "middle_name",
  "passport_number",
  "personal_number",
  "birth_date",
  "issue_date",
  "expiry_date",
  "gender",
  "nationality",
  "place_of_birth",
  "issuing_authority",
  "document_type",
  "mrz",
] as const;

export type PassportField = (typeof PASSPORT_FIELDS)[number];

const nullableStr = z.union([z.string(), z.null()]).transform((v) => {
  if (v === null) return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length ? t : null;
});

export const passportDataSchema = z.object({
  last_name: nullableStr,
  first_name: nullableStr,
  middle_name: nullableStr,
  passport_number: nullableStr,
  personal_number: nullableStr,
  birth_date: nullableStr,
  issue_date: nullableStr,
  expiry_date: nullableStr,
  gender: nullableStr,
  nationality: nullableStr,
  place_of_birth: nullableStr,
  issuing_authority: nullableStr,
  document_type: nullableStr,
  mrz: nullableStr,
});

export type PassportData = z.infer<typeof passportDataSchema>;

export type PassportConfidence = Partial<Record<PassportField, number>>;

export type PassportResult = {
  data: PassportData;
  confidence: PassportConfidence;
  overall: number;
};

export const emptyPassportData = (): PassportData =>
  PASSPORT_FIELDS.reduce((acc, k) => ({ ...acc, [k]: null }), {} as PassportData);

/* ------------------------------ normalization ----------------------------- */

const DIGIT_FIX: Record<string, string> = { O: "0", o: "0", Q: "0", I: "1", l: "1", "|": "1", B: "8", S: "5", Z: "2", G: "6" };
const ALPHA_FIX: Record<string, string> = { "0": "O", "1": "I", "8": "B", "5": "S", "2": "Z", "6": "G" };

export function fixDigits(s: string): string {
  return s.replace(/[OoQIl|BSZG]/g, (c) => DIGIT_FIX[c] ?? c);
}

export function fixAlpha(s: string): string {
  return s.replace(/[0185 26]/g, (c) => ALPHA_FIX[c] ?? c);
}

/** dd.mm.yyyy — accepts most common OCR/date shapes, otherwise null. */
export function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = fixDigits(raw).replace(/[^\d]/g, "");
  let d: string, m: string, y: string;
  if (s.length === 8) {
    // ddmmyyyy or yyyymmdd
    if (Number(s.slice(0, 4)) > 1300 && Number(s.slice(0, 4)) < 2200) {
      y = s.slice(0, 4); m = s.slice(4, 6); d = s.slice(6, 8);
    } else {
      d = s.slice(0, 2); m = s.slice(2, 4); y = s.slice(4, 8);
    }
  } else if (s.length === 6) {
    // MRZ yymmdd
    y = String(Number(s.slice(0, 2)) > 40 ? 1900 + Number(s.slice(0, 2)) : 2000 + Number(s.slice(0, 2)));
    m = s.slice(2, 4); d = s.slice(4, 6);
  } else return null;

  const dn = Number(d), mn = Number(m), yn = Number(y);
  if (!dn || dn > 31 || !mn || mn > 12 || yn < 1900 || yn > 2100) return null;
  return `${String(dn).padStart(2, "0")}.${String(mn).padStart(2, "0")}.${yn}`;
}

export function normalizePassportNumber(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  const m = s.match(/^([A-Z0-9]{1,2})(\d{6,9})$/);
  if (m) return fixAlpha(m[1]) + fixDigits(m[2]);
  return s;
}

export function normalizeGender(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (/^(M|МУЖ|МУЖСКОЙ|MALE|МАРД)/.test(s)) return "M";
  if (/^(F|W|ЖЕН|ЖЕНСКИЙ|FEMALE|ЗАН)/.test(s)) return "F";
  return null;
}

export function normalizePersonalNumber(raw: string | null): string | null {
  if (!raw) return null;
  const s = fixDigits(raw).replace(/[^0-9]/g, "");
  return s.length >= 6 ? s : null;
}

function cleanName(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/[^A-Za-zА-Яа-яЁёҚқҲҳҶҷҒғӮӯӢӣ'\-\s]/g, "").replace(/\s+/g, " ").trim();
  return s ? s.toUpperCase() : null;
}

export function normalizePassport(data: PassportData): PassportData {
  return {
    ...data,
    last_name: cleanName(data.last_name),
    first_name: cleanName(data.first_name),
    middle_name: cleanName(data.middle_name),
    passport_number: normalizePassportNumber(data.passport_number),
    personal_number: normalizePersonalNumber(data.personal_number),
    birth_date: normalizeDate(data.birth_date),
    issue_date: normalizeDate(data.issue_date),
    expiry_date: normalizeDate(data.expiry_date),
    gender: normalizeGender(data.gender),
    nationality: data.nationality ? data.nationality.trim().toUpperCase() : null,
    mrz: data.mrz ? data.mrz.toUpperCase().replace(/\s+/g, "") : null,
  };
}

/* -------------------------------- validation ------------------------------- */

export type FieldError = { field: PassportField; message: string };

const toDate = (s: string | null) => {
  if (!s) return null;
  const [d, m, y] = s.split(".").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export function validatePassport(data: PassportData): FieldError[] {
  const errs: FieldError[] = [];
  const dateRe = /^\d{2}\.\d{2}\.\d{4}$/;

  if (!data.last_name) errs.push({ field: "last_name", message: "Фамилия не распознана" });
  if (!data.first_name) errs.push({ field: "first_name", message: "Имя не распознано" });

  if (!data.passport_number) errs.push({ field: "passport_number", message: "Номер паспорта не распознан" });
  else if (!/^[A-Z0-9]{6,12}$/.test(data.passport_number))
    errs.push({ field: "passport_number", message: "Неверный формат номера паспорта" });

  if (data.personal_number && !/^\d{6,16}$/.test(data.personal_number))
    errs.push({ field: "personal_number", message: "Неверный формат персонального номера" });

  for (const f of ["birth_date", "issue_date", "expiry_date"] as const) {
    const v = data[f];
    if (v && !dateRe.test(v)) errs.push({ field: f, message: "Дата должна быть в формате ДД.ММ.ГГГГ" });
  }
  if (!data.birth_date) errs.push({ field: "birth_date", message: "Дата рождения не распознана" });

  const bd = toDate(data.birth_date);
  const now = new Date();
  if (bd && (bd > now || bd < new Date(1900, 0, 1)))
    errs.push({ field: "birth_date", message: "Недопустимая дата рождения" });

  const exp = toDate(data.expiry_date);
  if (exp && exp < now) errs.push({ field: "expiry_date", message: "Срок действия паспорта истёк" });

  const iss = toDate(data.issue_date);
  if (iss && exp && iss > exp) errs.push({ field: "issue_date", message: "Дата выдачи позже срока действия" });
  if (iss && bd && iss < bd) errs.push({ field: "issue_date", message: "Дата выдачи раньше даты рождения" });

  if (data.gender && !["M", "F"].includes(data.gender))
    errs.push({ field: "gender", message: "Пол должен быть M или F" });

  if (data.nationality && data.nationality.length < 2)
    errs.push({ field: "nationality", message: "Неверное гражданство" });

  return errs;
}

export const IMPORTANT_FIELDS: PassportField[] = [
  "last_name",
  "first_name",
  "passport_number",
  "birth_date",
  "expiry_date",
];

export function confidenceLevel(v: number | undefined): "high" | "medium" | "low" {
  if (v === undefined) return "low";
  if (v >= 90) return "high";
  if (v >= 80) return "medium";
  return "low";
}

/* ------------------------------ session bridge ----------------------------- */

const OCR_KEY = "passport-ocr-payload";
const RESULT_KEY = "passport-structured-result";

export type OcrPayload = {
  text: string;
  lines: { text: string; confidence: number }[];
  language: string;
  avgConfidence: number;
  mrz?: string | null;
};

export function setOcrPayload(p: OcrPayload) {
  try {
    sessionStorage.setItem(OCR_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function getOcrPayload(): OcrPayload | null {
  try {
    const raw = sessionStorage.getItem(OCR_KEY);
    return raw ? (JSON.parse(raw) as OcrPayload) : null;
  } catch {
    return null;
  }
}

export function setPassportResult(r: PassportResult) {
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function getPassportResult(): PassportResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    return raw ? (JSON.parse(raw) as PassportResult) : null;
  } catch {
    return null;
  }
}

/** Best-effort MRZ extraction from raw OCR lines (no OCR performed). */
export function findMrz(lines: string[]): string | null {
  const cand = lines
    .map((l) => l.toUpperCase().replace(/\s+/g, ""))
    .filter((l) => l.length >= 25 && /^[A-Z0-9<]+$/.test(l) && l.includes("<"));
  return cand.length ? cand.slice(-2).join("\n") : null;
}

export function clearPassportResult() {
  try {
    sessionStorage.removeItem(RESULT_KEY);
  } catch {
    /* ignore */
  }
}
