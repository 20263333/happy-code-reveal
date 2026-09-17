// Cash receipt (Воридварақаи хазинавӣ) — pdfmake template.
// Two-part layout: main receipt on the left, tear-off stub on the right.
// Red fields = dynamic values from the DB (check no, date, client, contract, amount).
import { getPdfMake } from "./fonts";
import { RED } from "./common";

export type CashReceiptData = {
  companyName: string;         // e.g. ҶАМЪИЯТИ ДОРОИ МАСЪУЛИЯТИ МАҲДУДИ
  companyBrand: string;        // e.g. " Восеъ 2005 "
  checkNumber: string;
  checkDate: string;           // dd.mm.yyyy
  accountCode?: string;        // Ҳисоб/зерҳисоби муҳосибӣ
  contractNumber: string;      // Рақами Шартнома (Асос)
  clientName: string;          // ФИО мизоҷ
  amount: string;              // Маблағи супоридашуда (нумерӣ, е.g. "12 500,00")
  amountWords: string;         // Маблағ бо ҳуруф
};

const BORDER = "#000000";
const CELL = { hLineWidth: () => 0.7, vLineWidth: () => 0.7, hLineColor: () => BORDER, vLineColor: () => BORDER, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 };

const red = (t: string) => ({ text: t || " ", color: RED, bold: true });
const line = (t: string) => ({ text: t, decoration: "underline" as const });

function parseDate(iso: string): { d: string; m: string; y: string } {
  // accepts dd.mm.yyyy or ISO
  if (!iso) return { d: "", m: "", y: "" };
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(iso)) {
    const [d, m, y] = iso.split(".");
    return { d, m, y };
  }
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return { d: "", m: "", y: "" };
  return { d: String(dt.getDate()).padStart(2, "0"), m: String(dt.getMonth() + 1).padStart(2, "0"), y: String(dt.getFullYear()) };
}

function buildMain(data: CashReceiptData) {
  const dt = parseDate(data.checkDate);
  return [
    { text: data.companyName, alignment: "center", bold: true, fontSize: 11 },
    { text: data.companyBrand, alignment: "center", bold: true, fontSize: 11, margin: [0, 2, 0, 10] },

    {
      columns: [
        { width: "auto", text: "ВОРИДВАРАҚАИ\nХАЗИНАВӢ   №", bold: true, fontSize: 11 },
        { width: "*", text: [red(data.checkNumber)], margin: [8, 6, 0, 0] },
      ],
      margin: [0, 0, 0, 10],
    },

    {
      alignment: "center",
      table: {
        widths: [45, 45, 55],
        body: [
          [
            { text: "Рӯз", alignment: "center", bold: true },
            { text: "Моҳ", alignment: "center", bold: true },
            { text: "Сол", alignment: "center", bold: true },
          ],
          [
            { text: dt.d, color: RED, bold: true, alignment: "center" },
            { text: dt.m, color: RED, bold: true, alignment: "center" },
            { text: dt.y, color: RED, bold: true, alignment: "center" },
          ],
        ],
      },
      layout: CELL,
      margin: [0, 0, 0, 10],
    },

    {
      alignment: "center",
      table: {
        widths: [130, 130],
        body: [
          [
            { text: "Ҳисоб/зериҳисоби\nмуҳосибӣ", alignment: "center", bold: true },
            { text: "маблағ", alignment: "center", bold: true },
          ],
          [
            { text: data.contractNumber, color: RED, bold: true, alignment: "center" },
            { text: data.amount, color: RED, bold: true, alignment: "center" },
          ],
        ],
      },
      layout: CELL,
      margin: [0, 0, 0, 14],
    },

    { text: [{ text: "Қабул шуда аз: ", bold: true }, line("  " + (data.clientName || " ").padEnd(60, " ") + "  ")], color: undefined, margin: [0, 0, 0, 4] },
    { text: [{ text: "Қабул шуда аз: ", color: "#ffffff00" }, red(data.clientName)], margin: [0, -18, 0, 4] },

    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 320, y2: 0, lineWidth: 1 }], margin: [0, 6, 0, 8] },

    { text: [{ text: "Асос:  ", bold: true }, red(data.contractNumber)] },
    { text: [{ text: "маблағи ", bold: true }, red(data.amount)] },
    { text: [{ text: "(", bold: true }, red(data.amountWords), { text: ")", bold: true }], margin: [0, 0, 0, 4] },
    { text: [{ text: "                              (бо  х у р у ф)", italics: true, fontSize: 9 }], margin: [0, 0, 0, 6] },

    { text: "Пешниҳод шуд ______________________________________", margin: [0, 4, 0, 6] },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 320, y2: 0, lineWidth: 1 }], margin: [0, 4, 0, 20] },

    { text: "Сармуҳосиб", alignment: "center", margin: [0, 0, 0, 14] },
    { text: "Хазинадор", alignment: "center" },
  ];
}

function buildStub(data: CashReceiptData) {
  const dt = parseDate(data.checkDate);
  return [
    { text: data.companyName, alignment: "center", bold: true, fontSize: 10 },
    { text: data.companyBrand, alignment: "center", bold: true, fontSize: 10, margin: [0, 2, 0, 12] },

    { text: "Б А Р Г И", alignment: "center", bold: true, fontSize: 11 },
    { text: "ВОРИДВАРАҚАИ  ХАЗИНАВӢ", alignment: "center", bold: true, fontSize: 11, margin: [0, 0, 0, 10] },

    { text: [{ text: "№      ", bold: true }, red(data.checkNumber)], margin: [0, 0, 0, 12] },

    { text: [{ text: "Қабул шуда аз:", bold: true }], margin: [0, 0, 0, 2] },
    { text: [{ text: "Ному насаби пардохткунанда:", italics: true, decoration: "underline" as const, fontSize: 9 }], margin: [0, 0, 0, 2] },
    { text: red(data.clientName), margin: [0, 0, 0, 10] },

    { text: [{ text: "Асос: ", bold: true }, red(data.contractNumber)] },
    { text: [{ text: "маблағи  ", bold: true }, red(data.amount)], margin: [0, 2, 0, 0] },
    { text: [{ text: "     (", bold: true }, red(data.amountWords), { text: ")", bold: true }], margin: [0, 2, 0, 2] },
    { text: "        (бо  х у р у ф)", italics: true, fontSize: 9, margin: [0, 0, 0, 12] },

    { text: "ҶМ", bold: true, margin: [0, 6, 0, 10] },
    { text: red(data.checkDate + " с"), alignment: "center", margin: [0, 0, 0, 20] },

    { text: "Сармуҳосиб", margin: [0, 0, 0, 14] },
    { text: "Хазинадор" },
  ];
}

export async function buildCashReceiptDoc(data: CashReceiptData) {
  return {
    pageSize: "A4" as const,
    pageOrientation: "landscape" as const,
    pageMargins: [30, 30, 30, 30] as [number, number, number, number],
    defaultStyle: { font: "PTSerif", fontSize: 10, lineHeight: 1.2 },
    content: [
      {
        columns: [
          { width: "*", stack: buildMain(data) },
          {
            width: 1,
            canvas: [{ type: "line", x1: 0, y1: 0, x2: 0, y2: 520, lineWidth: 0.5, dash: { length: 3 } }],
          },
          { width: 260, stack: buildStub(data), margin: [10, 0, 0, 0] },
        ],
        columnGap: 14,
      },
    ],
  };
}

export async function downloadCashReceipt(data: CashReceiptData) {
  const pdfMake = await getPdfMake();
  const doc = await buildCashReceiptDoc(data);
  const filename = `Cheki-${(data.checkNumber || "receipt").replace(/[^\w-]+/g, "_")}.pdf`;
  await new Promise<void>((resolve) => {
    pdfMake.createPdf(doc).download(filename, () => resolve());
  });
}
