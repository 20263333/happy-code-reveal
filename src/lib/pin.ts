// Per-user PIN lock. The unlocked state lives only in memory for the current
// page instance — any reload, tab close/reopen, or return after the tab was
// hidden re-locks the app (phone-style).

let unlockedFor: string | null = null;

export async function hashPin(userId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}::${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isUnlocked(userId: string): boolean {
  return unlockedFor === userId;
}

export function markUnlocked(userId: string) {
  unlockedFor = userId;
}

export function lockNow() {
  unlockedFor = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("binosoz:pin-lock"));
  }
}

if (typeof window !== "undefined") {
  // Re-lock as soon as the tab is hidden (user switched apps / minimized /
  // locked the phone). When they come back the PIN screen is waiting.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") lockNow();
  });
  // Belt-and-braces: also lock on pagehide (mobile Safari fires this
  // instead of visibilitychange when the tab is backgrounded).
  window.addEventListener("pagehide", () => lockNow());
}
