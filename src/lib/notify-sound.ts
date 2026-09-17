// Lightweight "ding" using Web Audio API — no assets required.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    const c = ctx!;
    if (c.state === "suspended") c.resume().catch(() => {});
    return c;
  } catch { return null; }
}

export function playDing(volume = 0.35) {
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    // Two-tone chime: E5 → A5
    const play = (freq: number, start: number, dur: number) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(volume, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };
    play(659.25, 0, 0.18);
    play(880.0, 0.12, 0.28);
  } catch { /* ignore */ }
}
