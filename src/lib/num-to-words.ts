// Tajik number-to-words for currency (сомонӣ + дирам)
const ONES = ["", "як", "ду", "се", "чор", "панҷ", "шаш", "ҳафт", "ҳашт", "нӯҳ"];
const TEENS = ["даҳ", "ёздаҳ", "дувоздаҳ", "сездаҳ", "чордаҳ", "понздаҳ", "шонздаҳ", "ҳабдаҳ", "ҳаждаҳ", "нуздаҳ"];
const TENS = ["", "", "бист", "сӣ", "чил", "панҷоҳ", "шаст", "ҳафтод", "ҳаштод", "навад"];
const HUNDREDS = ["", "сад", "дусад", "сесад", "чорсад", "панҷсад", "шашсад", "ҳафтсад", "ҳаштсад", "нӯҳсад"];

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]);
  if (rest === 0) return parts.join(" у ");
  if (rest < 10) parts.push(ONES[rest]);
  else if (rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    parts.push(o === 0 ? TENS[t] : `${TENS[t]} у ${ONES[o]}`);
  }
  return parts.join(" у ");
}

function intToTajikWords(n: number): string {
  if (n === 0) return "нол";
  const groups = ["", "ҳазор", "миллион", "миллиард"];
  const chunks: string[] = [];
  let g = 0;
  let x = n;
  while (x > 0) {
    const c = x % 1000;
    if (c > 0) {
      const word = c === 1 && g > 0 ? "як" : under1000(c);
      chunks.unshift(g > 0 ? `${word} ${groups[g]}` : word);
    }
    x = Math.floor(x / 1000);
    g++;
  }
  return chunks.join(" ").trim();
}

/** Format money amount as Tajik words with currency: сомонӣ/дирам or доллар/сент */
export function amountToTajikWords(amount: number, currency: "somoni" | "usd" = "somoni"): string {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const frac = Math.round((abs - whole) * 100);
  const words = intToTajikWords(whole);
  const dd = String(frac).padStart(2, "0");
  const cap = words.charAt(0).toUpperCase() + words.slice(1);
  const [main, sub] = currency === "usd" ? ["доллар", "сент"] : ["сомонӣ", "дирам"];
  return `${neg ? "минус " : ""}${cap} ${main} ${dd} ${sub}`;
}
