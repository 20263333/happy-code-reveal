/**
 * MRZ (Machine Readable Zone) parsing + check-digit verification.
 * Supports TD3 (passport booklet, 2×44) and TD1 (ID card, 3×30).
 * Pure functions — no OCR, no network.
 */

export type MrzCheck = {
  label: string;
  ok: boolean;
  /** value the check digit was computed over (for debugging/UI) */
  field: string;
};

export type MrzParsed = {
  format: "TD3" | "TD1";
  document_type: string | null;
  issuing_country: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  passport_number: string | null;
  nationality: string | null;
  birth_date: string | null; // dd.mm.yyyy
  expiry_date: string | null; // dd.mm.yyyy
  gender: "M" | "F" | null;
  personal_number: string | null;
  checks: MrzCheck[];
  /** true when every check digit present in the MRZ matched */
  valid: boolean;
};

const charValue = (c: string): number => {
  if (c === "<") return 0;
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A = 10
  return 0;
};

/** ICAO 9303 check digit with 7-3-1 weights. */
export function mrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) sum += charValue(input[i]) * weights[i % 3];
  return sum % 10;
}

function verify(label: string, field: string, digit: string): MrzCheck {
  // "<" or a non-digit means the issuer left the check digit blank → treat as pass-through
  const ok = /^\d$/.test(digit) ? mrzCheckDigit(field) === Number(digit) : true;
  return { label, ok, field };
}

/** yymmdd → dd.mm.yyyy (century inferred: >40 ⇒ 19xx) */
function mrzDate(s: string): string | null {
  if (!/^\d{6}$/.test(s)) return null;
  const yy = Number(s.slice(0, 2));
  const mm = Number(s.slice(2, 4));
  const dd = Number(s.slice(4, 6));
  if (!mm || mm > 12 || !dd || dd > 31) return null;
  const year = yy > 40 ? 1900 + yy : 2000 + yy;
  return `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${year}`;
}

const clean = (s: string) => s.replace(/</g, " ").replace(/\s+/g, " ").trim().toUpperCase() || null;
const strip = (s: string) => s.replace(/</g, "").trim().toUpperCase() || null;

function splitNames(raw: string) {
  const [surname = "", given = ""] = raw.split("<<");
  const givenParts = given.split("<").filter(Boolean);
  return {
    last_name: clean(surname),
    first_name: givenParts[0] ? clean(givenParts[0]) : null,
    middle_name: givenParts.length > 1 ? clean(givenParts.slice(1).join(" ")) : null,
  };
}

function normalizeLines(mrz: string): string[] {
  return mrz
    .toUpperCase()
    .split(/[\r\n]+/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter((l) => l.length >= 25 && /^[A-Z0-9<]+$/.test(l));
}

export function parseMrz(mrz: string | null | undefined): MrzParsed | null {
  if (!mrz) return null;
  const lines = normalizeLines(mrz);
  if (lines.length < 2) return null;

  const td3 = lines.filter((l) => l.length >= 42 && l.length <= 46);
  if (td3.length >= 2) return parseTd3(td3[td3.length - 2].padEnd(44, "<"), td3[td3.length - 1].padEnd(44, "<"));

  const td1 = lines.filter((l) => l.length >= 28 && l.length <= 32);
  if (td1.length >= 3) {
    const [a, b, c] = td1.slice(-3);
    return parseTd1(a.padEnd(30, "<"), b.padEnd(30, "<"), c.padEnd(30, "<"));
  }
  return null;
}

function parseTd3(l1: string, l2: string): MrzParsed {
  const names = splitNames(l1.slice(5));
  const docNum = l2.slice(0, 9);
  const docCd = l2.slice(9, 10);
  const nationality = l2.slice(10, 13);
  const dob = l2.slice(13, 19);
  const dobCd = l2.slice(19, 20);
  const sex = l2.slice(20, 21);
  const exp = l2.slice(21, 27);
  const expCd = l2.slice(27, 28);
  const personal = l2.slice(28, 42);
  const personalCd = l2.slice(42, 43);
  const finalCd = l2.slice(43, 44);
  const composite = docNum + docCd + dob + dobCd + exp + expCd + personal + personalCd;

  const checks = [
    verify("Номер паспорта", docNum, docCd),
    verify("Дата рождения", dob, dobCd),
    verify("Срок действия", exp, expCd),
    verify("Персональный номер", personal, personalCd),
    verify("Контрольная сумма MRZ", composite, finalCd),
  ];

  return {
    format: "TD3",
    document_type: strip(l1.slice(0, 2)),
    issuing_country: strip(l1.slice(2, 5)),
    ...names,
    passport_number: strip(docNum),
    nationality: strip(nationality),
    birth_date: mrzDate(dob),
    expiry_date: mrzDate(exp),
    gender: sex === "M" ? "M" : sex === "F" ? "F" : null,
    personal_number: strip(personal),
    checks,
    valid: checks.every((c) => c.ok),
  };
}

function parseTd1(l1: string, l2: string, l3: string): MrzParsed {
  const docNum = l1.slice(5, 14);
  const docCd = l1.slice(14, 15);
  const optional1 = l1.slice(15, 30);
  const dob = l2.slice(0, 6);
  const dobCd = l2.slice(6, 7);
  const sex = l2.slice(7, 8);
  const exp = l2.slice(8, 14);
  const expCd = l2.slice(14, 15);
  const nationality = l2.slice(15, 18);
  const optional2 = l2.slice(18, 29);
  const finalCd = l2.slice(29, 30);
  const composite = docNum + docCd + optional1 + dob + dobCd + exp + expCd + optional2;

  const checks = [
    verify("Номер документа", docNum, docCd),
    verify("Дата рождения", dob, dobCd),
    verify("Срок действия", exp, expCd),
    verify("Контрольная сумма MRZ", composite, finalCd),
  ];

  return {
    format: "TD1",
    document_type: strip(l1.slice(0, 2)),
    issuing_country: strip(l1.slice(2, 5)),
    ...splitNames(l3),
    passport_number: strip(docNum),
    nationality: strip(nationality),
    birth_date: mrzDate(dob),
    expiry_date: mrzDate(exp),
    gender: sex === "M" ? "M" : sex === "F" ? "F" : null,
    personal_number: strip(optional1) ?? strip(optional2),
    checks,
    valid: checks.every((c) => c.ok),
  };
}
