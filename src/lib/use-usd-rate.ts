import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsdRate } from "@/lib/exchange-rate.functions";

/**
 * Hook: courent USD→TJS rate from the National Bank of Tajikistan.
 * Refreshed every 6 hours; cached in the DB per date.
 */
export function useUsdRate() {
  const fn = useServerFn(getUsdRate);
  const q = useQuery({
    queryKey: ["nbt-usd-rate"],
    queryFn: async () => {
      try {
        return await fn();
      } catch {
        return { rate: null } as { rate: number | null };
      }
    },
    staleTime: 6 * 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return q.data?.rate ?? null;
}

/**
 * Format a TJS amount with USD equivalent in parentheses, e.g. "500 000 сомонӣ ($54 054)".
 * When currency is USD or rate is null, returns just the base string.
 */
export function formatWithUsd(
  amountTjs: number | null | undefined,
  formatMoney: (n: number) => string,
  usdRate: number | null,
): string {
  if (amountTjs == null || !isFinite(Number(amountTjs))) return formatMoney(0);
  const base = formatMoney(Number(amountTjs));
  if (!usdRate || usdRate <= 0) return base;
  const usd = Number(amountTjs) / usdRate;
  const rounded = usd >= 100 ? Math.round(usd) : Math.round(usd * 100) / 100;
  const usdStr = rounded.toLocaleString("en-US", {
    maximumFractionDigits: usd >= 100 ? 0 : 2,
  });
  return `${base} ($${usdStr})`;
}
