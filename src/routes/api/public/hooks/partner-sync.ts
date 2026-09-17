import { createFileRoute } from "@tanstack/react-router";

/**
 * Синхронизатсияи худкори баланси «Шарики фурӯш» бо барномаи дуюм.
 * Аз ҷониби кори доимии VPS ҳар 3 сония даъват мешавад (header: x-cron-secret).
 */
async function run(request: Request) {
  const url = new URL(request.url);
  const got =
    request.headers.get("x-cron-secret") ??
    url.searchParams.get("secret") ??
    "";
  if (!got) return new Response("unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { getSalesPartnerWebhookConfig } = await import("@/lib/webhook-config.server");
  const { secret: configuredSecret } = await getSalesPartnerWebhookConfig();
  let allowed = !!configuredSecret && got === configuredSecret;
  if (!allowed) {
    const { data } = await (supabaseAdmin as any).rpc("verify_integration_secret", {
      _key: "partner_sync_cron",
      _value: got,
    });
    allowed = data === true;
  }
  if (!allowed) return new Response("unauthorized", { status: 401 });

  const { pushCompanyPartnersSnapshot } = await import("@/lib/distribution-sync.server");

  const { data: companies, error } = await (supabaseAdmin as any)
    .from("companies")
    .select("id")
    .limit(500);
  if (error) return new Response(error.message, { status: 500 });


  const results: Array<{ company: string; ok: boolean; error?: string }> = [];
  for (const c of companies ?? []) {
    const res = await pushCompanyPartnersSnapshot(supabaseAdmin, c.id);
    results.push({ company: c.id, ok: !!res?.ok, error: (res as any)?.error });
  }
  return Response.json({ ok: true, synced: results.length, results });
}

export const Route = createFileRoute("/api/public/hooks/partner-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
