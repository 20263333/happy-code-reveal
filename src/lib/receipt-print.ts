import { esc } from "./print";

export type ReceiptTemplate = {
  bg?: string | null;
  stamp?: string | null;
  inn?: string | null;
  address?: string | null;
  signer?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
};

export type ReceiptData = {
  receiptNo: string | number;
  date: string; // pre-formatted
  customerName: string;
  customerPhone?: string | null;
  projectName?: string | null;
  apartmentNumber?: string | number | null;
  amountText: string; // formatted with currency
  amountWords?: string | null; // amount spelled out in words
  method?: string | null;
  note?: string | null;
  fullPriceText?: string | null;
  paidTotalText?: string | null;
  remainingText?: string | null;
};

function qrUrl(text: string, size = 90) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

/** Opens print window with a filled receipt (uses company template background if set). */
export function openReceiptPrint(opts: {
  template: ReceiptTemplate;
  data: ReceiptData;
  qrPayload?: string;
  labels: {
    title: string; // "Квитанция"
    no: string;
    date: string;
    client: string;
    phone: string;
    project: string;
    apt: string;
    method: string;
    amount: string;
    fullPrice: string;
    paidTotal: string;
    remaining: string;
    signer: string;
    signature: string;
    inn: string;
    address: string;
    note: string;
    verify: string;
    copyClient?: string;
    copyOffice?: string;
    cutHere?: string;
  };
}) {
  const { template, data, qrPayload, labels } = opts;
  const useBg = !!template.bg;

  const rowsHtml = `
    <div class="row"><span>${esc(labels.no)}:</span><b>№ ${esc(String(data.receiptNo))}</b></div>
    <div class="row"><span>${esc(labels.date)}:</span><b>${esc(data.date)}</b></div>
    <div class="row"><span>${esc(labels.client)}:</span><b>${esc(data.customerName)}</b></div>
    ${data.customerPhone ? `<div class="row"><span>${esc(labels.phone)}:</span><b>${esc(data.customerPhone)}</b></div>` : ""}
    ${data.projectName ? `<div class="row"><span>${esc(labels.project)}:</span><b>${esc(data.projectName)}${data.apartmentNumber ? ` · ${esc(labels.apt)} ${esc(String(data.apartmentNumber))}` : ""}</b></div>` : ""}
    ${data.method ? `<div class="row"><span>${esc(labels.method)}:</span><b>${esc(data.method)}</b></div>` : ""}
    ${data.note ? `<div class="row"><span>${esc(labels.note)}:</span><b>${esc(data.note)}</b></div>` : ""}
  `;

  const totalsHtml = `
    <div class="amount-box">
      <div class="amount-label">${esc(labels.amount)}</div>
      <div class="amount-value">${esc(data.amountText)}</div>
      ${data.amountWords ? `<div class="amount-words">${esc(data.amountWords)}</div>` : ""}
    </div>
    ${(data.fullPriceText || data.paidTotalText || data.remainingText) ? `
    <table class="totals">
      ${data.fullPriceText ? `<tr><td>${esc(labels.fullPrice)}</td><td class="num">${esc(data.fullPriceText)}</td></tr>` : ""}
      ${data.paidTotalText ? `<tr><td>${esc(labels.paidTotal)}</td><td class="num">${esc(data.paidTotalText)}</td></tr>` : ""}
      ${data.remainingText ? `<tr class="remain"><td>${esc(labels.remaining)}</td><td class="num">${esc(data.remainingText)}</td></tr>` : ""}
    </table>` : ""}
  `;

  const stampHtml = template.stamp
    ? `<img class="stamp" src="${esc(template.stamp)}" alt="stamp" />`
    : "";

  const qrHtml = qrPayload
    ? `<div class="qr"><img src="${esc(qrUrl(qrPayload))}" alt="qr"/><div class="qr-txt">${esc(labels.verify)}</div></div>`
    : "";

  const bodyContent = useBg
    ? `
    <div class="overlay-wrap">
      <img class="bg" src="${esc(template.bg!)}" alt="bg" />
      <div class="overlay">
        <div class="content">
          <h1>${esc(labels.title)}</h1>
          ${rowsHtml}
          ${totalsHtml}
          <div class="foot">
            <div class="signer">
              ${template.signer ? `<div class="signer-name">${esc(template.signer)}</div>` : ""}
              <div class="signer-line">${esc(labels.signature)}: __________________</div>
            </div>
            ${stampHtml}
            ${qrHtml}
          </div>
        </div>
      </div>
    </div>`
    : `
    <div class="card">
      <div class="head">
        <div class="brand">${esc(template.companyName || "")}</div>
        <div class="meta">
          ${template.companyPhone ? `<div>☎ ${esc(template.companyPhone)}</div>` : ""}
          ${template.inn ? `<div>${esc(labels.inn)}: ${esc(template.inn)}</div>` : ""}
          ${template.address ? `<div>${esc(labels.address)}: ${esc(template.address)}</div>` : ""}
        </div>
      </div>
      <h1>${esc(labels.title)}</h1>
      ${rowsHtml}
      ${totalsHtml}
      <div class="foot">
        <div class="signer">
          ${template.signer ? `<div class="signer-name">${esc(template.signer)}</div>` : ""}
          <div class="signer-line">${esc(labels.signature)}: __________________</div>
        </div>
        ${stampHtml}
        ${qrHtml}
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(labels.title)} № ${esc(String(data.receiptNo))}</title>
    <style>
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; padding: 20px; background: #f4f4f4; color: #111; }
      h1 { font-size: 22px; margin: 8px 0 14px; text-align: center; letter-spacing: 1px; }
      .card { max-width: 720px; margin: 0 auto; background: #fff; padding: 28px 32px; border: 1px solid #ddd; border-radius: 8px; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #333; margin-bottom: 14px; }
      .brand { font-size: 22px; font-weight: bold; }
      .meta { font-size: 11px; color: #555; text-align: right; line-height: 1.5; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ddd; font-size: 13px; }
      .row span { color: #666; }
      .row b { color: #111; text-align: right; }
      .amount-box { margin: 18px 0; padding: 14px; border: 2px solid #111; text-align: center; border-radius: 6px; }
      .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
      .amount-value { font-size: 26px; font-weight: bold; margin-top: 4px; }
      table.totals { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
      table.totals td { padding: 5px 8px; border: 1px solid #ccc; }
      table.totals td.num { text-align: right; font-weight: 600; }
      table.totals tr.remain td { background: #fff5f5; color: #b00; font-weight: bold; }
      .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; gap: 20px; }
      .signer { flex: 1; font-size: 12px; }
      .signer-name { font-weight: bold; margin-bottom: 6px; }
      .stamp { max-width: 110px; max-height: 110px; opacity: 0.85; }
      .qr { text-align: center; }
      .qr img { display: block; }
      .qr-txt { font-size: 9px; color: #888; margin-top: 2px; }
      .amount-words { margin-top: 6px; font-size: 12px; font-style: italic; color: #333; }

      /* Duplicate copies with a cut line between */
      .copy-label { text-align: right; font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin: 0 auto 4px; max-width: 720px; }
      .cut { max-width: 720px; margin: 18px auto; border-top: 1px dashed #999; position: relative; text-align: center; }
      .cut span { position: relative; top: -9px; background: #f4f4f4; padding: 0 8px; font-size: 10px; color: #888; letter-spacing: 2px; }

      /* Overlay mode (custom background) */
      .overlay-wrap { position: relative; max-width: 800px; margin: 0 auto; }
      .overlay-wrap .bg { width: 100%; display: block; }
      .overlay { position: absolute; inset: 0; padding: 40px 50px; }
      .overlay .content { background: rgba(255,255,255,0.85); padding: 20px; border-radius: 8px; }

      @media print {
        body { background: #fff; padding: 0; margin: 10mm; }
        .card { border: none; box-shadow: none; padding: 0; }
        .cut span { background: #fff; }
      }
    </style></head><body>
    <div class="copy-label">${esc(labels.copyClient || "Нусхаи муштарӣ")}</div>
    ${bodyContent}
    <div class="cut"><span>${esc(labels.cutHere || "✂ буред")}</span></div>
    <div class="copy-label">${esc(labels.copyOffice || "Нусхаи ширкат")}</div>
    ${bodyContent}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); }</script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
