import { amountToTajikWords } from "@/lib/num-to-words";

export const CONTRACT_TAGS = [
  ["contract_number", "Рақами шартнома"], ["contract_date", "Санаи бастани шартнома"],
  ["client_full_name", "Ному насаби пурраи муштарӣ"], ["client_birth_year", "Соли таваллуди муштарӣ"],
  ["client_tin", "РМА-и муштарӣ"], ["passport_series", "Силсила ва рақами шиноснома"],
  ["passport_authority", "Мақомоте, ки шиноснома додааст"], ["Issue_date", "Санаи дода шудани шиноснома"],
  ["client_address", "Суроғаи истиқомати муштарӣ"], ["client_phone", "Рақами телефони муштарӣ"],
  ["apt_number", "Рақами хона (квартира)"], ["floor_number", "Ошёнаи ҷойгиршавии хона"],
  ["rooms_number", "Шумораи ҳуҷраҳои хона"], ["area", "Масоҳати умумии хона (м²)"],
  ["price_per_sqm_tjs", "Нархи 1 м² бо сомонӣ (рақам)"], ["price_per_sqm_tjs_words", "Нархи 1 м² бо сомонӣ (бо ҳарф)"],
  ["price_per_sqm_usd", "Нархи 1 м² бо доллар (рақам)"], ["price_per_sqm_usd_words", "Нархи 1 м² бо доллар (бо ҳарф)"],
  ["total_price", "Арзиши умумии хона бо сомонӣ (рақам)"], ["total_price_words", "Арзиши умумии хона бо сомонӣ (бо ҳарф)"],
  ["price_usd", "Арзиши умумии хона бо доллар (рақам)"], ["price_usd_words_us_dollars", "Арзиши умумии хона бо доллар (бо ҳарф)"],
] as const;
export const RECEIPT_TAGS = [
  ["receipt_number", "Рақами чек"], ["receipt_date", "Санаи пардохт"],
  ["amount", "Маблағи ҳамин пардохт"], ["amount_words", "Маблағи ҳамин пардохт бо ҳарф"],
  ["advance_payment_price_words", "Маблағи ҳамин пардохт бо ҳарф (теги пешина)"],
] as const;
const fmt = (value: number) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export type ContractTagSource = {
  contract_number: string; contract_date: string; client_full_name: string; client_birth_year: string; client_tin: string;
  passport_series: string; passport_authority: string; passport_issue_date: string; client_address: string; client_phone: string;
  apt_number: string; floor_number: string; rooms_number: string; area: string; total_price: number; usd_rate: number;
  sale_price_per_m2: number;
};

/** The sale snapshot, not today's edited apartment area, determines prices in issued documents. */
export function buildContractTags(ctx: ContractTagSource): Record<string, string> {
  const price = ctx.sale_price_per_m2;
  const usdPrice = ctx.usd_rate > 0 ? price / ctx.usd_rate : 0;
  const usdTotal = ctx.usd_rate > 0 ? ctx.total_price / ctx.usd_rate : 0;
  return {
    contract_number: ctx.contract_number, contract_date: ctx.contract_date, client_full_name: ctx.client_full_name,
    client_birth_year: ctx.client_birth_year, client_tin: ctx.client_tin, passport_series: ctx.passport_series,
    passport_authority: ctx.passport_authority, Issue_date: ctx.passport_issue_date, passport_issue_date: ctx.passport_issue_date,
    client_address: ctx.client_address, client_phone: ctx.client_phone, apt_number: ctx.apt_number, floor_number: ctx.floor_number,
    rooms_number: ctx.rooms_number, area: ctx.area, price_per_sqm_tjs: fmt(price), price_per_sqm_tjs_words: amountToTajikWords(price),
    price_per_sqm_usd: fmt(usdPrice), price_per_sqm_usd_words: amountToTajikWords(usdPrice, "usd"),
    total_price: fmt(ctx.total_price), total_price_words: amountToTajikWords(ctx.total_price),
    price_usd: fmt(usdTotal), price_usd_words_us_dollars: amountToTajikWords(usdTotal, "usd"),
  };
}

export function buildReceiptTags(contract: Record<string, string>, data: { receipt_number: string; receipt_date: string; amount: number }, legacyTemplate = false): Record<string, string> & { amount: string; amount_words: string; receipt_number: string; receipt_date: string; advance_payment_price_words: string } {
  return { ...contract, receipt_number: data.receipt_number, receipt_date: data.receipt_date,
    amount: fmt(data.amount), amount_words: amountToTajikWords(data.amount), advance_payment_price_words: amountToTajikWords(data.amount),
    ...(legacyTemplate ? { total_price: fmt(data.amount) } : {}) };
}

/** Replaces double-brace tags before legacy single-brace placeholders are processed. */
export function fillDocumentTags(text: string, tags: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (match, key: string) => tags[key] ?? match);
}

export function contractTagsFromRecords(sale: Record<string, any>, customer: Record<string, any>, apartment: Record<string, any>, usdRate: number) {
  const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("ru-RU") : "";
  const area = Number(sale['area_snapshot'] ?? apartment['area'] ?? 0);
  const total = Number(sale['full_price'] ?? 0);
  return buildContractTags({
    contract_number: String(sale['sale_number'] ?? ""), contract_date: date(sale['created_at']),
    client_full_name: String(customer['fullname'] ?? ""), client_birth_year: customer['birth_date'] ? String(new Date(customer['birth_date']).getFullYear()) : "",
    client_tin: String(customer['inn'] ?? ""), passport_series: [customer['passport_series'], customer['passport_number']].filter(Boolean).join(" "),
    passport_authority: String(customer['passport_issued_by'] ?? ""), passport_issue_date: date(customer['passport_issued_date']),
    client_address: String(customer['address'] ?? ""), client_phone: String(customer['phone'] ?? ""),
    apt_number: String(apartment['apartment_number'] ?? ""), floor_number: String(apartment['floor']?.floor_number ?? apartment['floor_number'] ?? ""),
    rooms_number: String(apartment['rooms'] ?? ""), area: String(area), total_price: total, usd_rate: usdRate,
    sale_price_per_m2: Number(sale['sale_price_per_m2'] ?? (area > 0 ? total / area : 0)),
  });
}