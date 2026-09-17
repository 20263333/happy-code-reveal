import { createFileRoute } from "@tanstack/react-router";

/**
 * Рӯйхати ҳамаи файлҳои захира бо истинодҳои имзошуда (барои кӯчонидан ба сервери худӣ).
 * Формати ҷавоб: сатрҳои `bucket<TAB>path<TAB>url`
 */
async function authorize(request: Request) {
  const url = new URL(request.url);
  const got = request.headers.get("x-export-secret") ?? url.searchParams.get("secret") ?? "";
  if (!got) return false;
  const envSecret = process.env["MIGRATION_EXPORT_SECRET"];
  if (envSecret && got === envSecret) return true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).rpc("verify_integration_secret", {
    _key: "migration_export",
    _value: got,
  });
  return data === true;
}

async function run(request: Request) {
  if (!(await authorize(request))) return new Response("unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const all: Array<{ bucket_id: string; object_name: string }> = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await admin.rpc("export_storage_objects", { _limit: 1000, _offset: off });
    if (error) return new Response(error.message, { status: 500 });
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < 1000) break;
    if (off > 100000) break;
  }

  const byBucket = new Map<string, string[]>();
  for (const r of all) {
    if (!r.bucket_id || !r.object_name) continue;
    const arr = byBucket.get(r.bucket_id) ?? [];
    arr.push(r.object_name);
    byBucket.set(r.bucket_id, arr);
  }

  const lines: string[] = [];
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrls(chunk, 60 * 60 * 24 * 7);
      if (error) {
        lines.push(`# ERROR ${bucket}: ${error.message}`);
        continue;
      }
      for (const item of data ?? []) {
        if (!item.signedUrl || !item.path) continue;
        const base = process.env["SUPABASE_URL"] ?? new URL(request.url).origin;
        const url = new URL(item.signedUrl, base).toString();
        lines.push(`${bucket}\t${item.path}\t${url}`);
      }
    }
  }

  return new Response(lines.join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/export/storage")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
