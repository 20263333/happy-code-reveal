import { GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { AI_SERVICE_MESSAGES, type AiFailureKind } from "./ai-service-errors";

export class AiServiceError extends Error {
  readonly name = "AiServiceError";
  constructor(readonly kind: AiFailureKind) { super(AI_SERVICE_MESSAGES[kind]); }
}

const quotaCodes = new Set(["insufficient_quota", "billing_hard_limit_reached", "billing_not_active", "usage_limit_reached", "credit_balance_exhausted", "credits_exhausted", "insufficient_credits", "payment_required"]);
const rateCodes = new Set(["rate_limit_exceeded", "rate_limited", "rate_limit_error", "too_many_requests"]);

function classify(status: number | undefined, codes: (string | number | undefined)[]): AiFailureKind {
  if (codes.some(code => typeof code === "string" && quotaCodes.has(code)) || status === 402) return "quota";
  if (codes.some(code => typeof code === "string" && rateCodes.has(code))) return "rate_limit";
  if (status === 429) return "limit_unknown";
  if (status === 401 || codes.includes("authentication_error") || codes.includes("configuration_error")) return "authentication";
  if (status === 403 || codes.includes("permission_denied")) return "permission";
  return "unavailable";
}

// Never surface/log the upstream body or message: it can contain credentials or customer data.
const failureSchema = z.object({
  error: z.object({ code: z.string().optional(), type: z.string().optional() }).optional(),
  code: z.string().optional(),
});

export async function providerFailure(response: Response): Promise<AiServiceError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = failureSchema.safeParse(body);
  const details = parsed.success ? parsed.data : undefined;
  const kind = classify(response.status, [details?.error?.code, details?.error?.type, details?.code]);
  console.error("[ai-assistant] provider request rejected", { status: response.status, kind });
  return new AiServiceError(kind);
}

export function gatewayFailure(error: GatewayError): AiServiceError {
  const kind = classify(error.httpStatus, [error.remote?.code, error.remote?.type, error.code]);
  console.error("[ai-assistant] gateway request rejected", { code: error.code, status: error.httpStatus, kind, ids: error.ids });
  return new AiServiceError(kind);
}