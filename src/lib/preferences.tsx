import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
export type Currency = "TJS" | "RUB" | "USD";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  TJS: "сом.",
  RUB: "₽",
  USD: "$",
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  TJS: "Сомонӣ (TJS)",
  RUB: "Рубль (RUB)",
  USD: "Доллар (USD)",
};

interface PrefCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatMoney: (n: number | null | undefined) => string;
}

const Ctx = createContext<PrefCtx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [currency, setCurrencyState] = useState<Currency>("TJS");

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const t = localStorage.getItem("theme") as Theme | null;
    const c = localStorage.getItem("currency") as Currency | null;
    if (t === "light" || t === "dark") {
      setThemeState(t);
      document.documentElement.classList.toggle("dark", t === "dark");
    } else {
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        setThemeState("dark");
        document.documentElement.classList.add("dark");
      }
    }
    if (c === "TJS" || c === "RUB" || c === "USD") setCurrencyState(c);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", t === "dark");
    if (typeof localStorage !== "undefined") localStorage.setItem("theme", t);
  };

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    if (typeof localStorage !== "undefined") localStorage.setItem("currency", c);
  };

  const formatMoney = (n: number | null | undefined) => {
    const v = Number(n ?? 0);
    const lang = typeof document !== "undefined" ? document.documentElement.lang : "ru";
    const locale = currency === "RUB" ? "ru-RU" : currency === "USD" || lang === "en" ? "en-US" : "ru-RU";
    const symbol = currency === "TJS" && lang === "en" ? "TJS" : CURRENCY_SYMBOL[currency];
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v) + " " + symbol;
  };

  return (
    <Ctx.Provider value={{ theme, setTheme, toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"), currency, setCurrency, formatMoney }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be inside PreferencesProvider");
  return c;
}
