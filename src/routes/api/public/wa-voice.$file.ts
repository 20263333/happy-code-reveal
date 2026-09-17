import { createFileRoute } from "@tanstack/react-router";

// Аудиои содиротӣ (голос) — линки кушода барои Wappi.
// Файл дар bucket-и хусусии `notification-media` (папкаи wa-voice/) нигоҳ дошта мешавад
// ва аз ин ҷо ҳамчун линки оддии public дода мешавад.

const TYPES: Record<string, string> = {
  ogg: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  aac: "audio/aac",
};

export const Route = createFileRoute("/api/public/wa-voice/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = String((params as any).file ?? "");
        if (!/^[\w.-]+$/.test(file)) return new Response("bad request", { status: 400 });
        const ext = file.split(".").pop()?.toLowerCase() ?? "ogg";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await (supabaseAdmin as any).storage
          .from("notification-media")
          .download(`wa-voice/${file}`);
        if (error || !data) return new Response("not found", { status: 404 });

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "content-type": TYPES[ext] ?? "application/octet-stream",
            "content-length": String(buf.byteLength),
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
