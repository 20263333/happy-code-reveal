import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import pkg from "file-saver";
const { saveAs } = pkg;
import { amountToTajikWords } from "@/lib/num-to-words";

const TEMPLATE_URL = "/contract-templates/receipt.docx";

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
}

export type ReceiptDocxData = {
  receipt_number: string;
  receipt_date: string;
  contract_number: string;
  client_full_name: string;
  amount: number;
  qr_code?: string;
};

export async function downloadReceiptDocx(data: ReceiptDocxData) {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("Шаблони DOCX ёфт нашуд");
  const buf = await res.arrayBuffer();

  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    receipt_number: data.receipt_number || "",
    receipt_date: data.receipt_date || "",
    contract_number: data.contract_number || "",
    client_full_name: data.client_full_name || "",
    total_price: fmtMoney(data.amount),
    advance_payment_price_words: amountToTajikWords(Number(data.amount || 0)),
    qr_code: data.qr_code || "",
  });

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(out, `Cheki-${(data.receipt_number || "nav").replace(/[^\w-]+/g, "_")}.docx`);
}
