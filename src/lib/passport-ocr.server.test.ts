import { afterEach, expect, test } from "bun:test";
import { extractPassportFromImages } from "./passport-ocr.server";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;
const savedInfo = console.info;

afterEach(() => {
  process.env = { ...savedEnv };
  globalThis.fetch = savedFetch;
  console.info = savedInfo;
});

test("passport OCR uses OpenAI when both provider credentials are configured", async () => {
  process.env.OPENAI_API_KEY = "fictional-test-credential";
  process.env.LOVABLE_API_KEY = "fictional-test-credential";
  delete process.env.AI_PROVIDER;
  delete process.env.OPENAI_OCR_MODEL;
  delete process.env.OPENAI_OCR_MODEL_PRO;
  console.info = () => {};
  const calls: { url: string; model: string }[] = [];
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(input), model: body.model });
    const content = calls.length === 1
      ? { visible_text: "НАМУНА: Насаб Санҷишӣ, Ном Намуна, A01234567" }
      : { first_name: "Намуна", last_name: "Санҷишӣ", passport_number: "A01234567" };
    return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  }) as typeof fetch;

  const result = await extractPassportFromImages({ front: "data:image/png;base64,dGVzdA==" });
  expect(calls).toEqual([
    { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
    { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" },
  ]);
  expect(result.first_name).toBe("Намуна");
  expect(result.passport_series).toBe("A");
  expect(result.passport_number).toBe("01234567");
});