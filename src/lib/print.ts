import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type CompanyHeader = { name: string | null; phone: string | null } | null;

/** Fetches the current company's name and phone for print headers. */
export function useCompanyHeader() {
  const { companyId } = useAuth();
  const { data } = useQuery({
    queryKey: ["company-header", companyId],
    queryFn: async () =>
      companyId
        ? (await supabase.from("companies").select("name, phone").eq("id", companyId).maybeSingle()).data
        : null,
    enabled: !!companyId,
  });
  return (data as CompanyHeader) ?? null;
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

/**
 * Opens a clean print window containing ONLY the given data (company header +
 * content), instead of printing the whole app page with the menu/sidebar.
 *
 * Unified "warehouse" layout:
 *   №________ (top-left)
 *   Centered company name (no phone)
 *   Content
 *   Small USD conversion box (manual fill after print)
 *   5-signature block: 1.Мухосиб · 2.Таъминотчи · 3.Прораб / 4.Роҳбар · 5.Роҳбар
 */
export function openPrintWindow(opts: {
  title: string;
  company: CompanyHeader;
  contentHtml: string;
  /** Retained for backwards-compat; phone is no longer rendered. */
  phoneLabel?: string;
  showUsdBox?: boolean;
  showSignatures?: boolean;
  showDocNumber?: boolean;
}) {
  const {
    title, company, contentHtml,
    showUsdBox = true, showSignatures = true, showDocNumber = true,
  } = opts;

  const docNoHtml = showDocNumber ? `<div class="doc-no">№________</div>` : "";

  const usdBoxHtml = showUsdBox ? `
    <div class="usd-box">
      <table>
        <thead><tr>
          <th>Курси доллар ($)</th>
          <th>Маблағ бо $</th>
        </tr></thead>
        <tbody><tr><td></td><td></td></tr></tbody>
      </table>
    </div>` : "";

  const signsBlockHtml = showSignatures ? `
    <div class="signs">
      <div class="signs-grid">
        <div class="signs-row">
          <div class="line"><span class="num">1.</span><span class="title">Мухосиб</span><span class="blank"></span></div>
          <div class="line"><span class="num">2.</span><span class="title">Таъминотчи</span><span class="blank"></span></div>
          <div class="line"><span class="num">3.</span><span class="title">Прораб</span><span class="blank"></span></div>
        </div>
        <div class="signs-row">
          <div class="line"><span class="num">4.</span><span class="title">Роҳбар</span><span class="blank"></span></div>
          <div class="line"><span class="num">5.</span><span class="title">Роҳбар</span><span class="blank"></span></div>
        </div>
      </div>
    </div>` : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 32px; color: #1a1a1a; }
      .doc-no { text-align: left; font-size: 13px; margin-bottom: 6px; }
      .company-header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
      .company-header .name { font-size: 26px; font-weight: bold; letter-spacing: 0.5px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 15px; margin: 4px 0 16px; color: #555; font-weight: normal; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 8px; }
      th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
      th { background: #f0f0f0; }
      td.num, th.num { text-align: right; }
      tfoot td { font-weight: bold; background: #fafafa; }
      .total { margin-top: 16px; font-size: 14px; font-weight: bold; text-align: right; }
      .usd-box { margin-top: 10px; }
      .usd-box table { width: auto; margin-left: auto; font-size: 11px; }
      .usd-box th { background: #f7f7f7; text-align: center; padding: 3px 10px; }
      .usd-box td { height: 20px; text-align: right; padding: 3px 10px; min-width: 100px; }
      .signs { margin-top: 30px; font-size: 12px; }
      .signs-grid { display: flex; flex-direction: column; gap: 18px; }
      .signs-row { display: flex; gap: 24px; justify-content: space-between; }
      .signs-row .line { display: flex; align-items: baseline; flex: 1; }
      .signs-row .num { min-width: 18px; }
      .signs-row .title { min-width: 90px; }
      .signs-row .blank { flex: 1; border-bottom: 1px solid #333; margin-left: 4px; min-width: 100px; }
      @media print { body { margin: 12mm; } }
    </style></head><body>
    ${docNoHtml}
    <div class="company-header">
      <div class="name">${esc(company?.name || "PLATFORM.TJ")}</div>
    </div>
    ${contentHtml}
    ${usdBoxHtml}
    ${signsBlockHtml}
    <script>window.onload = function(){ window.print(); }</script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
