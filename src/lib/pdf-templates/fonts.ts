// Lazy pdfmake loader with PT Serif TTFs fetched from /fonts.
// Keeps main bundle light and gives Cyrillic + Tajik character support.
let pdfMakeSingleton: any = null;
let loadingPromise: Promise<any> | null = null;

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font ${url}`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

export async function getPdfMake(): Promise<any> {
  if (pdfMakeSingleton) return pdfMakeSingleton;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const mod: any = await import("pdfmake/build/pdfmake");
    const pdfMake = mod.default ?? mod;
    const [reg, bold, ital, bital] = await Promise.all([
      fetchBase64("/fonts/PTSerif-Regular.ttf"),
      fetchBase64("/fonts/PTSerif-Bold.ttf"),
      fetchBase64("/fonts/PTSerif-Italic.ttf"),
      fetchBase64("/fonts/PTSerif-BoldItalic.ttf"),
    ]);
    pdfMake.vfs = {
      "PTSerif-Regular.ttf": reg,
      "PTSerif-Bold.ttf": bold,
      "PTSerif-Italic.ttf": ital,
      "PTSerif-BoldItalic.ttf": bital,
    };
    pdfMake.fonts = {
      PTSerif: {
        normal: "PTSerif-Regular.ttf",
        bold: "PTSerif-Bold.ttf",
        italics: "PTSerif-Italic.ttf",
        bolditalics: "PTSerif-BoldItalic.ttf",
      },
    };
    pdfMakeSingleton = pdfMake;
    return pdfMake;
  })();
  return loadingPromise;
}
