import { createFileRoute } from "@tanstack/react-router";

// Эндпоинти автоматӣ барои фиристодани ёдовариҳои СМС аз рӯи графики рассрочка.
// Аз ҷониби pg_cron (ҳамарӯза) даъват мешавад.
//
// Бехатарӣ: ин эндпоинт зери `/api/public/*` аст, яъне ҳама метавонад онро даъват
// кунад. Барои пешгирии сӯиистифода (исрофи кредити СМС, спам, ва ифшои рақамҳои
// телефони муштариён) даъватро бо калиди махфии муштарак (SMS_CRON_SECRET) ҳимоя
// мекунем. pg_cron бояд сарлавҳаи `x-cron-secret` (ё `Authorization: Bearer ...`)-ро
// бо ҳамин калид фиристад.
export const Route = createFileRoute("/api/public/hooks/sms-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SMS_CRON_SECRET;
        if (!expected) {
          return new Response(
            JSON.stringify({ ok: false, error: "server not configured" }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }

        const provided =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (provided !== expected) {
          return new Response(
            JSON.stringify({ ok: false, error: "Forbidden" }),
            { status: 403, headers: { "content-type": "application/json" } },
          );
        }

        try {
          const { runSmsReminders } = await import("@/lib/sms-core.server");
          const result = await runSmsReminders();
          // Танҳо ҳисобҳои ҷамъбастиро бармегардонем — рақамҳои телефон ва дигар
          // маълумоти муштариён (PII) дар ҷавоб ифшо намешаванд.
          return Response.json({
            ok: result.ok,
            scanned: result.scanned,
            sent: result.sent,
            failed: result.failed,
            skipped: result.skipped,
          });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? "unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
