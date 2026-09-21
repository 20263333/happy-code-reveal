import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Прокси ба Lovable AI Gateway барои сервери худамон (VPS).
// VPS калиди LOVABLE_API_KEY-ро намедонад, бинобар ин дархостҳоро
// ба ин endpoint мефиристад; ин ҷо калиди ҳақиқӣ дар сервер мавҷуд аст.
// Дастрасӣ танҳо бо AI_PROXY_SECRET (ҳам дар ин ҷо, ҳам дар /root/binosoz.env).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BODY_BYTES = 25 * 1024 * 1024; // аксҳои base64 калонанд

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "ai-proxy").update(a).digest();
  const hb = createHmac("sha256", "ai-proxy").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const Route = createFileRoute("/api/public/ai-proxy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.AI_PROXY_SECRET?.trim();
        const provided = request.headers.get("x-ai-proxy-secret")?.trim() ?? "";
        if (!expected) {
          return Response.json({ error: { message: "AI proxy is not configured" } }, { status: 503 });
        }
        if (!provided || !safeEqual(provided, expected)) {
          return Response.json({ error: { message: "Invalid proxy secret" } }, { status: 401 });
        }

        const lovableKey = process.env.LOVABLE_API_KEY?.trim() || process.env.LOVABLE_AI_GATEWAY_KEY?.trim();
        if (!lovableKey) {
          return Response.json({ error: { message: "AI gateway key missing on host" } }, { status: 503 });
        }

        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) {
          return Response.json({ error: { message: "Payload too large" } }, { status: 413 });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          return Response.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
        }
        if (
          !parsed ||
          typeof parsed !== "object" ||
          typeof (parsed as { model?: unknown }).model !== "string" ||
          !Array.isArray((parsed as { messages?: unknown }).messages)
        ) {
          return Response.json({ error: { message: "Expected chat completions payload" } }, { status: 400 });
        }

        const upstream = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": lovableKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body,
        });

        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
        });
      },
    },
  },
});
