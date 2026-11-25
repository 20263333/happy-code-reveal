import { generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";
import type { OpenAIChatFields, OpenAIChatMessage } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { resolveAiProvider } from "./ai-provider.server";
import { gatewayFailure, providerFailure } from "./ai-service-errors.server";

const responseSchema = z.object({ choices: z.array(z.object({ message: z.object({
  content: z.string().nullable().optional(),
  tool_calls: z.array(z.object({ id: z.string(), type: z.literal("function"), function: z.object({ name: z.string(), arguments: z.string() }) })).optional(),
}) })) });

export async function completeAiChat(messages: OpenAIChatMessage[], tools: OpenAIChatFields["tools"]) {
  // Preserve the existing own-key/proxy deployment paths; Gateway calls use its SDK.
  const provider = resolveAiProvider();
  try {
    if (provider && (provider.isOpenAI || !provider.chatUrl.startsWith("https://ai.gateway.lovable.dev/"))) {
      const result = await fetch(provider.chatUrl, {
        method: "POST", headers: { ...provider.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ model: provider.model("pro"), messages, ...(tools ? { tools } : {}), max_tokens: 4000 }),
      });
      if (!result.ok) throw await providerFailure(result);
      return responseSchema.parse(await result.json()).choices[0]?.message;
    }
    const response = await generateChatCompletion({ model: "openai/gpt-5.4", messages, ...(tools ? { tools } : {}), max_completion_tokens: 4000 });
    return responseSchema.parse(response).choices[0]?.message;
  } catch (error) {
    if (error instanceof GatewayError) {
      throw gatewayFailure(error);
    }
    throw error;
  }
}