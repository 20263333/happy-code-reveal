import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAiProvider } from "./ai-provider.server";
import {
  PASSPORT_FIELDS,
  emptyPassportData,
  normalizePassport,
  passportDataSchema,
  type PassportConfidence,
  type PassportData,
  type PassportResult,
} from "@/lib/passport-structure";

type Input = {
  text: string;
  lines: { text: string; confidence: number }[];
  language: string;
  mrz: string | null;
};

const SYSTEM = `Ты — движок Intelligent Document Processing. Тебе передают ГОТОВЫЙ результат OCR паспорта (Таджикистан, СНГ или международный).
Твоя задача — превратить текст OCR в структурированные данные паспорта.

Правила:
- Исправляй типичные ошибки OCR: O↔0, I↔1, B↔8, S↔5, Z↔2, G↔6, лишние пробелы.
- Даты приводи к формату ДД.ММ.ГГГГ.
- Номер паспорта — только латинские буквы и цифры, без пробелов.
- gender: только "M" или "F".
- Если данных нет или ты не уверен, что поле присутствует в тексте — ставь null.
- НИКОГДА не выдумывай значения, которых нет в OCR.
- Для каждого поля дай уверенность в процентах (0-100), основанную на качестве OCR-строки и однозначности сопоставления.

Верни СТРОГО JSON без markdown:
{"data":{"last_name":null,"first_name":null,"middle_name":null,"passport_number":null,"personal_number":null,"birth_date":null,"issue_date":null,"expiry_date":null,"gender":null,"nationality":null,"place_of_birth":null,"issuing_authority":null,"document_type":null,"mrz":null},"confidence":{"last_name":0}}`;

export const structurePassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as Partial<Input>;
    if (!x?.text || typeof x.text !== "string" || !x.text.trim()) throw new Error("Пустой текст OCR");
    return {
      text: x.text.slice(0, 12000),
      lines: Array.isArray(x.lines) ? x.lines.slice(0, 200) : [],
      language: typeof x.language === "string" ? x.language : "—",
      mrz: typeof x.mrz === "string" ? x.mrz.slice(0, 200) : null,
    } as Input;
  })
  .handler(async ({ data }): Promise<PassportResult> => {
    const provider = requireAiProvider();

    const linesBlock = data.lines
      .map((l, i) => `${i + 1}. ${l.text}  [conf ${Math.round((l.confidence ?? 0) * 100)}%]`)
      .join("\n");

    const userPrompt = [
      `Язык OCR: ${data.language}`,
      data.mrz ? `MRZ:\n${data.mrz}` : "MRZ: не найдена",
      "",
      "Строки OCR с уверенностью:",
      linesBlock || data.text,
      "",
      "Полный текст OCR:",
      data.text,
    ].join("\n");

    const res = await fetch(provider.chatUrl, {
      method: "POST",
      headers: { ...provider.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model("mini"),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Лимит запросов AI превышен, попробуйте позже");
    if (res.status === 402) throw new Error("Кредиты AI исчерпаны");
    if (!res.ok) throw new Error(`AI: ${res.status} ${(await res.text()).slice(0, 200)}`);

    const json: any = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const jsonText = String(raw).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("AI вернул неразборчивый ответ");
    }

    const safe: PassportData = normalizePassport(
      passportDataSchema.parse({ ...emptyPassportData(), ...(parsed?.data ?? {}) }),
    );
    if (!safe.mrz && data.mrz) safe.mrz = data.mrz.toUpperCase().replace(/\s+/g, "");

    const confIn = (parsed?.confidence ?? {}) as Record<string, unknown>;
    const confidence: PassportConfidence = {};
    for (const f of PASSPORT_FIELDS) {
      if (safe[f] == null) continue;
      const n = Number(confIn[f]);
      confidence[f] = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 70;
    }

    const values = Object.values(confidence);
    const overall = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

    return { data: safe, confidence, overall };
  });
