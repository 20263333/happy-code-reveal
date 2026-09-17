// Shared pdfmake helpers for contract templates.
// Red inline placeholder text (values from DB), regular black text is the legal body.
export const RED = "#d92b2b";

export type Inline = string | { text: string; bold?: boolean; italics?: boolean; color?: string; decoration?: string };

/** Red DB value inline. */
export const v = (text: string): Inline => ({ text, color: RED, bold: true });

/** Bold black. */
export const b = (text: string): Inline => ({ text, bold: true });

/** Italic. */
export const i = (text: string): Inline => ({ text, italics: true });

export const A4_MARGINS: [number, number, number, number] = [70, 60, 55, 55];

export const baseStyles = {
  defaultStyle: {
    font: "PTSerif",
    fontSize: 11,
    lineHeight: 1.15,
    alignment: "justify" as const,
  },
  styles: {
    h1: { fontSize: 14, bold: true, alignment: "center" as const, margin: [0, 0, 0, 12] as [number, number, number, number] },
    h2: { fontSize: 12, bold: true, alignment: "center" as const, margin: [0, 10, 0, 6] as [number, number, number, number] },
    section: { fontSize: 11, bold: true, alignment: "center" as const, margin: [0, 8, 0, 6] as [number, number, number, number] },
    para: { margin: [0, 0, 0, 6] as [number, number, number, number] },
  },
};

export function pageFooter(currentPage: number, _pageCount: number) {
  return { text: String(currentPage), alignment: "center", fontSize: 10, margin: [0, 20, 0, 0] };
}
