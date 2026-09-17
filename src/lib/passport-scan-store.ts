/** UI-only store for the passport scanner flow (no OCR / no backend). */
const KEY = "passport-scan-preview";
const KEY_ENHANCED = "passport-scan-enhanced";
const KEY_CROPPED = "passport-scan-cropped";

export type ScanVariants = {
  original: string | null;
  enhanced: string | null;
  cropped: string | null;
};

export function setScanPreview(dataUrl: string) {
  try {
    sessionStorage.setItem(KEY, dataUrl);
  } catch {
    /* ignore */
  }
}

export function setScanVariants(v: Partial<ScanVariants>) {
  try {
    if (v.original !== undefined) {
      v.original ? sessionStorage.setItem(KEY, v.original) : sessionStorage.removeItem(KEY);
    }
    if (v.enhanced !== undefined) {
      v.enhanced ? sessionStorage.setItem(KEY_ENHANCED, v.enhanced) : sessionStorage.removeItem(KEY_ENHANCED);
    }
    if (v.cropped !== undefined) {
      v.cropped ? sessionStorage.setItem(KEY_CROPPED, v.cropped) : sessionStorage.removeItem(KEY_CROPPED);
    }
  } catch {
    /* ignore */
  }
}

export function getScanVariants(): ScanVariants {
  try {
    return {
      original: sessionStorage.getItem(KEY),
      enhanced: sessionStorage.getItem(KEY_ENHANCED),
      cropped: sessionStorage.getItem(KEY_CROPPED),
    };
  } catch {
    return { original: null, enhanced: null, cropped: null };
  }
}

export function getScanPreview(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearScanPreview() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY_ENHANCED);
    sessionStorage.removeItem(KEY_CROPPED);
  } catch {
    /* ignore */
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const KEY_SELECTED = "passport-scan-selected";

/** Which variant the user chose to send to OCR ("enhanced" | "cropped" | "original"). */
export function setSelectedVariant(v: keyof ScanVariants) {
  try {
    sessionStorage.setItem(KEY_SELECTED, v);
  } catch {
    /* ignore */
  }
}

export function getSelectedVariant(): keyof ScanVariants | null {
  try {
    const v = sessionStorage.getItem(KEY_SELECTED);
    return v === "original" || v === "enhanced" || v === "cropped" ? v : null;
  } catch {
    return null;
  }
}

/** Image that should be OCR'd: never the raw frame when a processed copy exists. */
export function getOcrSource(): { dataUrl: string | null; variant: keyof ScanVariants | null } {
  const v = getScanVariants();
  const chosen = getSelectedVariant();
  if (chosen && v[chosen]) return { dataUrl: v[chosen], variant: chosen };
  if (v.enhanced) return { dataUrl: v.enhanced, variant: "enhanced" };
  if (v.cropped) return { dataUrl: v.cropped, variant: "cropped" };
  return { dataUrl: v.original, variant: v.original ? "original" : null };
}
