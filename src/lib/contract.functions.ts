import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  pages: z.array(z.string().min(10)).min(1).max(8),
});

export type ContractExtractResult = {
  contract_title: string | null;
  number_prefix: string | null;
  director_name: string | null;
  director_position: string | null;
  inn: string | null;
  legal_address: string | null;
  bank_details: string | null;
  phone: string | null;
  intro_text: string | null;
  body_text: string | null;
  footer_text: string | null;
};

function asDataUrl(s: string): string {
  return s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;
}

export const extractContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ContractExtractResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const userParts: any[] = [
      {
        type: "text",
        text:
          "Это фотографии бумажного шаблона договора купли-продажи квартиры (строительная компания). " +
          "Извлеки реквизиты и текст договора строго в JSON по схеме. " +
          "intro_text — вступительная часть (преамбула, кто/с кем). " +
          "body_text — основные условия (пункты, права, оплата). " +
          "footer_text — заключение и место для подписей. " +
          "В тексте сохрани плейсхолдеры в фигурных скобках если они есть: " +
          "{client} {passport} {phone} {address} {project} {floor} {apartment} {area} {rooms} {price} {date}. " +
          "Если в тексте упомянуты ФИО клиента, № квартиры, цена и т.п. — замени их на соответствующий плейсхолдер. " +
          "Если поле не видно — поставь null.",
      },
      ...data.pages.map((p) => ({ type: "image_url", image_url: { url: asDataUrl(p) } })),
    ];

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Ты — OCR-ассистент. Возвращай ТОЛЬКО валидный JSON-объект без пояснений и markdown.",
        },
        { role: "user", content: userParts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "contract_extract",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              contract_title: { type: ["string", "null"] },
              number_prefix: { type: ["string", "null"] },
              director_name: { type: ["string", "null"] },
              director_position: { type: ["string", "null"] },
              inn: { type: ["string", "null"] },
              legal_address: { type: ["string", "null"] },
              bank_details: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              intro_text: { type: ["string", "null"] },
              body_text: { type: ["string", "null"] },
              footer_text: { type: ["string", "null"] },
            },
            required: [
              "contract_title",
              "number_prefix",
              "director_name",
              "director_position",
              "inn",
              "legal_address",
              "bank_details",
              "phone",
              "intro_text",
              "body_text",
              "footer_text",
            ],
          },
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Лимит запросов исчерпан, попробуйте позже");
    if (res.status === 402) throw new Error("Закончились AI-кредиты. Пополните в настройках Lovable.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI Gateway: ${res.status} ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    return {
      contract_title: parsed.contract_title ?? null,
      number_prefix: parsed.number_prefix ?? null,
      director_name: parsed.director_name ?? null,
      director_position: parsed.director_position ?? null,
      inn: parsed.inn ?? null,
      legal_address: parsed.legal_address ?? null,
      bank_details: parsed.bank_details ?? null,
      phone: parsed.phone ?? null,
      intro_text: parsed.intro_text ?? null,
      body_text: parsed.body_text ?? null,
      footer_text: parsed.footer_text ?? null,
    };
  });
