import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import {
  pushApartmentEvent,
  toApartmentDTO,
  APARTMENT_SELECT,
} from "@/lib/sharora-webhook.server";

/**
 * Дохилӣ: аз триггери базаи маълумот (pg_net) даъват мешавад.
 * Хонаро мегирад ва ба барномаи sharora.tj бо имзо мефиристад.
 */
export const Route = createFileRoute("/api/public/hooks/apartment-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-sync-key") ?? "";
        const { data: setting } = await (supabaseAdmin as any)
          .from("platform_settings")
          .select("value")
          .eq("key", "apartment_sync_key")
          .maybeSingle();
        const expected = typeof setting?.value === "string" ? setting.value : "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const id = typeof body?.apartment_id === "string" ? body.apartment_id : null;
        const event = body?.event === "apartment.created" ? "apartment.created" : "apartment.updated";
        if (!id) return new Response("Bad request", { status: 400 });

        const { data: row } = await (supabaseAdmin as any)
          .from("apartments")
          .select(APARTMENT_SELECT)
          .eq("id", id)
          .maybeSingle();
        if (!row) return new Response("Not found", { status: 404 });

        const res = await pushApartmentEvent(event, toApartmentDTO(row));
        return Response.json({ ok: res.ok, error: res.error ?? null });
      },
    },
  },
});
