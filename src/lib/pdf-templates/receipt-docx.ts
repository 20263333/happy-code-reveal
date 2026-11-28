import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import pkg from "file-saver";
const { saveAs } = pkg;
import { buildContractContext } from "./context";
import { buildContractTags, buildReceiptTags } from "./template-tags";

const TEMPLATE_URL = "/contract-templates/receipt.docx";

export type ReceiptDocxData = {
  receipt_number: string;
  receipt_date: string;
  contract_number: string;
  client_full_name: string;
  amount: number;
  sale_id?: string;
  usd_rate?: number;
  qr_code?: string;
};

export async function downloadReceiptDocx(data: ReceiptDocxData) {
  const ctx = data.sale_id ? await buildContractContext(data.sale_id, data.usd_rate ? { usdRate: data.usd_rate } : {}) : null;
  let buf: ArrayBuffer;
  if (ctx?.docx_receipt_path) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: file, error } = await supabase.storage.from("contract-templates").download(ctx.docx_receipt_path);
    if (error || !file) throw new Error("Шаблони чеки ширкат бор нашуд");
    buf = await file.arrayBuffer();
  } else {
    const res = await fetch(TEMPLATE_URL);
    if (!res.ok) throw new Error("Шаблони DOCX ёфт нашуд");
    buf = await res.arrayBuffer();
  }

  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render({
    contract_number: data.contract_number || "",
    client_full_name: data.client_full_name || "",
    qr_code: data.qr_code || "",
    // Bundled legacy receipt uses total_price for the individual payment.
    ...buildReceiptTags(ctx ? buildContractTags(ctx) : {}, data, !ctx?.docx_receipt_path),
  });

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(out, `Cheki-${(data.receipt_number || "nav").replace(/[^\w-]+/g, "_")}.docx`);
}
