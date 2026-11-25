import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { extractPassportFromImages } from "./passport-ocr.server";
import { AiServiceError } from "./ai-service-errors.server";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;
const savedInfo = console.info;
const savedError = console.error;

afterEach(() => {
  process.env = { ...savedEnv };
  globalThis.fetch = savedFetch;
  console.info = savedInfo;
  console.error = savedError;
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
  assert.deepEqual(calls, [
    { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
    { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" },
  ]);
  assert.equal(result.first_name, "Намуна");
  assert.equal(result.passport_series, "A");
  assert.equal(result.passport_number, "01234567");
});

test("passport quota or rate-limit denials stop before retry or fallback model calls", async () => {
  process.env["OPENAI_API_KEY"] = "fictional-test-credential";
  delete process.env["AI_PROVIDER"];
  console.info = () => {};
  console.error = () => {};
  for (const [code, kind] of [["insufficient_quota", "quota"], ["rate_limit_exceeded", "rate_limit"]]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { code } }, { status: 429 }); };
    await assert.rejects(() => extractPassportFromImages({ front: "data:image/png;base64,dGVzdA==" }), (error: unknown) => error instanceof AiServiceError && error.kind === kind);
    assert.equal(calls, 1);
  }
});