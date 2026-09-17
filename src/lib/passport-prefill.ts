/**
 * Bridge between the standalone passport scanner flow and the client forms
 * (Новый клиент / Новая продажа). Uses localStorage so the handoff also works
 * when the scanner was opened in a second tab.
 */
import type { PassportData } from "./passport-structure";

const KEY = "passport-prefill";
const TTL_MS = 15 * 60 * 1000;

export type PassportPrefill = {
  at: number;
  fullname: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  birth_date: string; // yyyy-mm-dd
  gender: string;
  nationality: string;
  passport_series: string;
  passport_number: string;
  personal_id: string;
  passport_issued_by: string;
  passport_issued_date: string; // yyyy-mm-dd
  passport_expiry_date: string; // yyyy-mm-dd
  address: string;
  image: string | null; // data URL of the scanned page
};

/** "dd.mm.yyyy" → "yyyy-mm-dd" (empty string when unparsable). */
export function toIsoDate(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : "";
}

/** Splits "A1234567" into series + number the way the client form expects. */
export function splitPassportNumber(v: string | null | undefined): { series: string; number: string } {
  const s = (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return { series: "", number: "" };
  const m = s.match(/^([A-Z]{1,2})(\d{5,9})$/);
  return m ? { series: m[1], number: m[2] } : { series: "", number: s };
}

export function buildPrefill(data: PassportData, image: string | null): PassportPrefill {
  const { series, number } = splitPassportNumber(data.passport_number);
  const fullname = [data.last_name, data.first_name, data.middle_name].filter(Boolean).join(" ");
  return {
    at: Date.now(),
    fullname,
    first_name: data.first_name ?? "",
    last_name: data.last_name ?? "",
    middle_name: data.middle_name ?? "",
    birth_date: toIsoDate(data.birth_date),
    gender: data.gender ?? "",
    nationality: data.nationality ?? "",
    passport_series: series,
    passport_number: number,
    personal_id: (data.personal_number ?? "").replace(/\D/g, ""),
    passport_issued_by: data.issuing_authority ?? "",
    passport_issued_date: toIsoDate(data.issue_date),
    passport_expiry_date: toIsoDate(data.expiry_date),
    address: data.place_of_birth ?? "",
    image,
  };
}

export function setPassportPrefill(p: PassportPrefill) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore quota errors */
  }
}

/** Returns a fresh prefill payload (<15 min old) without consuming it. */
export function peekPassportPrefill(): PassportPrefill | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PassportPrefill;
    if (!p?.at || Date.now() - p.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPassportPrefill() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** data:image/...;base64,xxx → Blob (for Supabase Storage upload). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
