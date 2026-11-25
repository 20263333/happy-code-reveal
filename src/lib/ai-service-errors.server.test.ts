import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError, PaymentRequiredError, RateLimitError } from "@lovable.dev/ai-gateway";
import { AiServiceError, providerFailure, gatewayFailure } from "./ai-service-errors.server";
import { isAiServiceFailure } from "./ai-service-errors";
import { completeAiChat } from "./ai-chat-completion.server";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;
const savedError = console.error;
afterEach(() => { process.env = { ...savedEnv }; globalThis.fetch = savedFetch; console.error = savedError; });

test("HTTP 429 with insufficient_quota is a billing failure, not a temporary rate limit", async () => {
  console.error = () => {};
  const error = await providerFailure(Response.json({ error: { code: "insufficient_quota", type: "insufficient_quota" } }, { status: 429 }));
  assert.equal(error.kind, "quota");
});
test("HTTP 429 with an explicit rate code is temporary", async () => {
  console.error = () => {};
  assert.equal((await providerFailure(Response.json({ error: { code: "rate_limit_exceeded" } }, { status: 429 }))).kind, "rate_limit");
});
test("an unclassified or non-JSON 429 does not invent a billing or frequency diagnosis", async () => {
  console.error = () => {};
  assert.equal((await providerFailure(new Response("Upstream busy", { status: 429 }))).kind, "limit_unknown");
  assert.equal((await providerFailure(Response.json({ error: "Unknown" }, { status: 429 }))).kind, "limit_unknown");
});
test("HTTP 402 is a quota failure", async () => {
  console.error = () => {};
  assert.equal((await providerFailure(Response.json({}, { status: 402 }))).kind, "quota");
});
test("final SDK errors distinguish remote quota, rate limits and authentication", () => {
  console.error = () => {};
  assert.equal(gatewayFailure(new RateLimitError("internal", { httpStatus: 429, remote: { code: "insufficient_quota" } })).kind, "quota");
  assert.equal(gatewayFailure(new RateLimitError("internal", { httpStatus: 429 })).kind, "rate_limit");
  assert.equal(gatewayFailure(new PaymentRequiredError("internal")).kind, "quota");
  assert.equal(gatewayFailure(new AuthenticationError("internal")).kind, "authentication");
});
test("upstream bodies never reach application errors or diagnostic logs", async () => {
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  const privateValue = "fictional-private-error-sentinel";
  const failure = await providerFailure(Response.json({ error: { message: privateValue, code: privateValue, type: privateValue } }, { status: 429 }));
  assert.equal(failure.kind, "limit_unknown");
  assert.equal(JSON.stringify({ error: failure.message, logs }).includes(privateValue), false);
});
test("serialized service failures stop caller retries but unrelated image errors do not", () => {
  assert.equal(isAiServiceFailure({ message: new AiServiceError("quota").message }), true);
  assert.equal(isAiServiceFailure(new Error("No image detected")), false);
  assert.equal(isAiServiceFailure(null), false);
});
test("assistant own-key 429 makes exactly one request with the configured model and preserves its output limit", async () => {
  process.env["AI_PROVIDER"] = "openai";
  process.env["OPENAI_API_KEY"] = "fictional-test-key";
  process.env["OPENAI_CHAT_MODEL"] = "gpt-4o";
  console.error = () => {};
  const payloads: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)));
    return Response.json({ error: { code: "insufficient_quota" } }, { status: 429 });
  };
  await assert.rejects(() => completeAiChat([{ role: "user", content: "Даромади моҳи ноябр?" }], undefined), (error: unknown) => error instanceof AiServiceError && error.kind === "quota");
  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0], { model: "gpt-4o", messages: [{ role: "user", content: "Даромади моҳи ноябр?" }], max_tokens: 4000 });
});