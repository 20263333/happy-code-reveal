import { supabase } from "@/integrations/supabase/client";
import { amountToTajikWords } from "@/lib/num-to-words";

export type ContractCtx = {
  contract_number: string;
  contract_date: string;
  client_full_name: string;
  client_birth_year: string;
  client_tin: string;
  passport_series: string;
  passport_authority: string;
  passport_issue_date: string;
  client_address: string;
  client_phone: string;
  project_name: string;
  block_name: string;
  floor_number: string;
  apt_number: string;
  area: string;
  price_per_m2: string;
  base_price_per_m2: string;
  total_price: number;
  total_price_words: string;
  price_usd: string;
  price_usd_words: string;
  usd_rate: number;
  down_payment: number;
  down_payment_words: string;
  advance_payment_usd: string;
  advance_payment_price_words: string;
  advance_payment_usd_words: string;
  remaining: number;
  remaining_words: string;
  monthly_payment: number;
  monthly_payment_words: string;
  installment_months: number;
  first_payment_date: string;
  company_name: string;
  company_director: string;
  company_director_position: string;
  company_tin: string;
  company_address: string;
  company_account: string;
  company_mfo: string;
  company_bank: string;
  company_phone: string;
  construction_deadline: string;
  company_id: string;
  docx_full_path: string;
  docx_installment_path: string;
  docx_shop_full_path: string;
  docx_shop_installment_path: string;
  is_shop: boolean;
};

// Blocks with shops on floors 0 and 1
const SHOP_BLOCKS_FLOORS_0_1 = ["А", "Б", "В", "Г", "Л", "М", "Н"];
// Blocks with shops only on floor 0
const SHOP_BLOCKS_FLOOR_0 = ["Д", "Е", "Ж", "И"];

function extractBlockLetter(name: string): string {
  const m = (name || "").toUpperCase().match(/[А-ЯA-Z]\s*$/) || (name || "").toUpperCase().match(/[А-ЯA-Z]/);
  return m ? m[0].trim() : "";
}

export function isShopUnit(blockName: string, floorNumber: number | string | null | undefined): boolean {
  if (floorNumber == null || floorNumber === "") return false;
  const f = Number(floorNumber);
  const letter = extractBlockLetter(blockName);
  if (!letter) return false;
  if (SHOP_BLOCKS_FLOOR_0.includes(letter)) return f === 0;
  if (SHOP_BLOCKS_FLOORS_0_1.includes(letter)) return f === 0 || f === 1;
  return false;
}

function fmt(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export async function buildContractContext(saleId: string, opts?: { usdRate?: number }): Promise<ContractCtx> {
  const saleRes = await supabase
    .from("sales")
    .select("id, sale_number, full_price, paid_amount, installment_months, payment_deadline, project_id, apartment_id, customer_id, created_at, area_snapshot, base_price_per_m2, sale_price_per_m2")
    .eq("id", saleId)
    .maybeSingle();
  if (saleRes.error || !saleRes.data) throw new Error(saleRes.error?.message || "Sale not found");
  const sale: any = saleRes.data;

  const [custRes, aptRes, projRes] = await Promise.all([
    supabase.from("customers").select("fullname, birth_date, passport_series, passport_number, passport_issued_by, passport_issued_date, phone, address, inn").eq("id", sale.customer_id).maybeSingle(),
    supabase.from("apartments").select("apartment_number, area, floor_id").eq("id", sale.apartment_id).maybeSingle(),
    supabase.from("projects").select("id, name, parent_id, company_id").eq("id", sale.project_id).maybeSingle(),
  ]);
  const c: any = custRes.data ?? {};
  const a: any = aptRes.data ?? {};
  const project: any = projRes.data ?? {};

  let floor: any = {};
  if (a.floor_id) {
    const fr = await supabase.from("floors").select("floor_number").eq("id", a.floor_id).maybeSingle();
    floor = fr.data ?? {};
  }
  // Fallback: агар хониши бевоситаи floors натиҷа надиҳад, аз тариқи embed-и apartments мегирем.
  if (floor?.floor_number == null && sale.apartment_id) {
    const alt = await supabase
      .from("apartments")
      .select("floors(floor_number)")
      .eq("id", sale.apartment_id)
      .maybeSingle();
    const fn = (alt.data as any)?.floors?.floor_number;
    if (fn != null) floor = { floor_number: fn };
  }


  // Blocks are stored as child projects, so the sale's project already names the block.
  const floorBlockName = "";

  let parentName = project?.name ?? "";
  let blockName = "";
  if (project?.parent_id) {
    blockName = project.name;
    const pr = await supabase.from("projects").select("name").eq("id", project.parent_id).maybeSingle();
    if (pr.data?.name) parentName = pr.data.name;
  }

  const companyId = project?.company_id;
  const [compRes, tplRes] = await Promise.all([
    companyId ? supabase.from("companies").select("name, phone, receipt_inn, receipt_address, receipt_signer").eq("id", companyId).maybeSingle() : Promise.resolve({ data: null } as any),
    companyId ? supabase.from("contract_templates").select("*").eq("company_id", companyId).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  const company: any = compRes.data ?? {};
  const tpl: any = tplRes.data ?? {};

  const total = Number(sale.full_price || 0);
  const paid = Number(sale.paid_amount || 0);
  const remaining = Math.max(0, total - paid);
  const months = Number(sale.installment_months || 0);
  const monthly = months > 0 ? remaining / months : 0;
  const usdRate = opts?.usdRate ?? 10.9;
  const priceUsd = usdRate > 0 ? total / usdRate : 0;

  const passport = [c.passport_series, c.passport_number].filter(Boolean).join(" ");
  const birthYear = c.birth_date ? new Date(c.birth_date).getFullYear().toString() : "";

  return {
    contract_number: sale.sale_number || "",
    contract_date: fmtDate(sale.created_at) || fmtDate(new Date().toISOString()),
    client_full_name: c.fullname || "",
    client_birth_year: birthYear,
    client_tin: c.inn || "",
    passport_series: passport,
    passport_authority: c.passport_issued_by || "",
    passport_issue_date: fmtDate(c.passport_issued_date),
    client_address: c.address || "",
    client_phone: c.phone || "",
    project_name: parentName || project?.name || "",
    block_name: blockName,
    floor_number: floor?.floor_number != null ? String(floor.floor_number) : "",
    apt_number: a?.apartment_number || "",
    area: sale.area_snapshot != null ? String(sale.area_snapshot) : (a?.area != null ? String(a.area) : ""),
    price_per_m2: fmt(Number(sale.sale_price_per_m2 ?? (Number(sale.area_snapshot ?? a?.area ?? 0) > 0 ? total / Number(sale.area_snapshot ?? a?.area) : 0))),
    base_price_per_m2: fmt(Number(sale.base_price_per_m2 ?? 0)),
    total_price: total,
    total_price_words: amountToTajikWords(total),
    price_usd: fmt(priceUsd),
    price_usd_words: amountToTajikWords(priceUsd, "usd"),
    usd_rate: usdRate,
    down_payment: paid,
    down_payment_words: amountToTajikWords(paid),
    advance_payment_usd: usdRate > 0 ? fmt(paid / usdRate) : "0",
    advance_payment_price_words: amountToTajikWords(paid),
    advance_payment_usd_words: amountToTajikWords(usdRate > 0 ? paid / usdRate : 0, "usd"),
    remaining: remaining,
    remaining_words: amountToTajikWords(remaining),
    monthly_payment: monthly,
    monthly_payment_words: amountToTajikWords(Math.round(monthly)),
    installment_months: months,
    first_payment_date: fmtDate(sale.payment_deadline) || fmtDate(sale.created_at),
    company_name: tpl?.contract_title?.match(/ҶДММ[^,\n]+/i)?.[0] || company?.name || 'ҶДММ "Восеъ-2005"',
    company_director: tpl?.director_name || company?.receipt_signer || "Саидов Сафаралӣ Манонович",
    company_director_position: tpl?.director_position || "Директор",
    company_tin: tpl?.inn || company?.receipt_inn || "030030176",
    company_address: tpl?.legal_address || company?.receipt_address || "ш.Душанбе н.Фирдавсӣ кучаи Борбад 1",
    company_account: tpl?.bank_details?.match(/\d{15,}/)?.[0] || "202029721000061000",
    company_mfo: tpl?.bank_details?.match(/МФО[:\s]*(\d+)/)?.[1] || "350101626",
    company_bank: tpl?.bank_details?.match(/Амонатбонк[^\n,]*/i)?.[0] || "Амонатбонк №6",
    company_phone: tpl?.phone || company?.phone || "",
    construction_deadline: "12.12.2029",
    company_id: companyId || "",
    docx_full_path: tpl?.docx_full_path || "",
    docx_installment_path: tpl?.docx_installment_path || "",
    docx_shop_full_path: tpl?.docx_shop_full_path || "",
    docx_shop_installment_path: tpl?.docx_shop_installment_path || "",
    is_shop: isShopUnit(floorBlockName || blockName, floor?.floor_number),
  };
}

export const money = fmt;
