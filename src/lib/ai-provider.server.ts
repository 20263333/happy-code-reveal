// Ягона ҷои интихоби провайдери AI.
// Агар OPENAI_API_KEY гузошта шуда бошад — аккаунти шахсии ChatGPT (OpenAI) истифода мешавад,
// вагарна Lovable AI Gateway. Бо AI_PROVIDER=lovable|openai маҷбуран интихоб кардан мумкин аст.

export type AiProvider = {
  name: "OpenAI" | "Lovable AI Gateway";
  isOpenAI: boolean;
  chatUrl: string;
  sttUrl: string;
  headers: Record<string, string>;
  /** Номи моделро мувофиқи провайдер мегардонад. */
  model: (kind: "pro" | "mini" | "stt") => string;
};

const LOVABLE_MODELS = {
  pro: "openai/gpt-5.4",
  mini: "openai/gpt-5.4-mini",
  stt: "openai/gpt-4o-mini-transcribe",
} as const;

export function resolveAiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();

  const useOpenAI = forced === "openai" && !!openaiKey;

  if (useOpenAI && openaiKey) {
    const pro = process.env.OPENAI_CHAT_MODEL?.trim() || process.env.OPENAI_OCR_MODEL_PRO?.trim() || "gpt-4o";
    const mini = process.env.OPENAI_CHAT_MODEL_MINI?.trim() || process.env.OPENAI_OCR_MODEL?.trim() || "gpt-4o-mini";
    const stt = process.env.OPENAI_STT_MODEL?.trim() || "gpt-4o-mini-transcribe";
    return {
      name: "OpenAI",
      isOpenAI: true,
      chatUrl: "https://api.openai.com/v1/chat/completions",
      sttUrl: "https://api.openai.com/v1/audio/transcriptions",
      headers: { Authorization: `Bearer ${openaiKey}` },
      model: (kind) => (kind === "pro" ? pro : kind === "mini" ? mini : stt),
    };
  }

  if (lovableKey) {
    return {
      name: "Lovable AI Gateway",
      isOpenAI: false,
      chatUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
      sttUrl: "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      headers: { Authorization: `Bearer ${lovableKey}`, "Lovable-API-Key": lovableKey },
      model: (kind) => LOVABLE_MODELS[kind],
    };
  }

  return null;
}

export function requireAiProvider(): AiProvider {
  const p = resolveAiProvider();
  if (!p) throw new Error("AI танзим нашудааст (OPENAI_API_KEY ё LOVABLE_API_KEY)");
  return p;
}
