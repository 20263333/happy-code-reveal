import { createFileRoute } from "@tanstack/react-router";

/**
 * Содироти пурраи маълумот ҳамчун SQL (INSERT-ҳо) барои кӯчонидан ба сервери худӣ.
 * Танҳо бо калиди махфӣ: header `x-export-secret` ё ?secret=
 * Мисол:
 *   curl -H "x-export-secret: ..." https://<app>/api/public/export/database -o dump.sql
 */
const PAGE = 300;

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

  const { data: tables, error } = await admin.rpc("export_table_list");
  if (error) return new Response(error.message, { status: 500 });

  const list: Array<{ schema_name: string; table_name: string; row_count: number }> = (tables ?? [])
    .filter((t: any) => Number(t.row_count) > 0)
    .sort((a: any, b: any) => {
      // auth-ро аввал мегузорем
      const rank = (s: string) => (s === "auth" ? 0 : 1);
      return rank(a.schema_name) - rank(b.schema_name) || a.table_name.localeCompare(b.table_name);
    });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (s: string) => controller.enqueue(encoder.encode(s));
      push("-- PLATFORM.TJ data export\n");
      push("SET session_replication_role = replica;\n\n");
      for (const t of list) {
        push(`\n-- ${t.schema_name}.${t.table_name} (${t.row_count} rows)\n`);
        for (let off = 0; off < Number(t.row_count); off += PAGE) {
          const { data: sql, error: e } = await admin.rpc("export_table_sql", {
            _schema: t.schema_name,
            _table: t.table_name,
            _limit: PAGE,
            _offset: off,
          });
          if (e) {
            push(`-- ERROR ${t.schema_name}.${t.table_name}: ${e.message}\n`);
            break;
          }
          if (sql) push(sql + "\n");
        }
      }
      push("\nSET session_replication_role = DEFAULT;\n");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/sql; charset=utf-8",
      "content-disposition": 'attachment; filename="platform-tj-dump.sql"',
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/public/export/database")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
