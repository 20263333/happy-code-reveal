import { createServerFn } from "@tanstack/react-start";

/**
 * Курси доллари ИМА (USD → TJS) аз Бонки Миллии Тоҷикистон (nbt.tj).
 * Дар ҷадвали exchange_rates барои имрӯз кэш карда мешавад.
 */
export const getUsdRate = createServerFn({ method: "GET" }).handler(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Look in cache first
  const cached = await supabaseAdmin
    .from("exchange_rates" as any)
    .select("usd_rate")
    .eq("date", today)
    .maybeSingle();
  if (cached.data && (cached.data as any).usd_rate) {
    return { rate: Number((cached.data as any).usd_rate), date: today, cached: true };
  }

  // 2) Scrape nbt.tj (Tajik page)
  let rate: number | null = null;
  try {
    const res = await fetch("https://nbt.tj/tj/kurs/kurs.php", {
      headers: { "User-Agent": "Mozilla/5.0 BinoSozTJ/1.0" },
    });
    const html = await res.text();
    // Look for "Доллари ИМА" followed by the rate value in a nearby <td>
    const idx = html.indexOf("Доллари ИМА");
    if (idx >= 0) {
      const slice = html.slice(idx, idx + 1200);
      const m = slice.match(/>\s*([0-9]+[.,][0-9]+)\s*</);
      if (m) rate = Number(m[1].replace(",", "."));
    }
  } catch {
    // fall through
  }

  if (!rate || !isFinite(rate) || rate <= 0) {
    // Fallback to last cached rate
    const last = await supabaseAdmin
      .from("exchange_rates" as any)
      .select("usd_rate, date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.data) {
      return {
        rate: Number((last.data as any).usd_rate),
        date: (last.data as any).date,
        cached: true,
        stale: true,
      };
    }
    return { rate: null, date: today, cached: false, error: "unavailable" };
  }

  await supabaseAdmin
    .from("exchange_rates" as any)
    .upsert({ date: today, usd_rate: rate, source: "nbt.tj" });

  return { rate, date: today, cached: false };
});
