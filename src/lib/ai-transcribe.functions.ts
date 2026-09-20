import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAiProvider } from "./ai-provider.server";

// Client sends { base64, mime } — we forward as multipart to Lovable AI STT.
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { base64?: string; mime?: string };
    if (!x?.base64 || typeof x.base64 !== "string") throw new Error("base64 лозим");
    return { base64: x.base64, mime: x.mime || "audio/webm" };
  })
  .handler(async ({ data }) => {
    const provider = requireAiProvider();

    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const mime = data.mime;
    const ext =
      mime.includes("mp4") || mime.includes("m4a") ? "mp4" :
      mime.includes("wav") ? "wav" :
      mime.includes("mpeg") || mime.includes("mp3") ? "mp3" :
      mime.includes("ogg") ? "ogg" : "webm";

    const fd = new FormData();
    fd.append("model", provider.model("stt"));
    fd.append("file", new Blob([bin], { type: mime }), `recording.${ext}`);

    const res = await fetch(provider.sttUrl, {
      method: "POST",
      headers: provider.headers,
      body: fd,
    });
    if (res.status === 429) throw new Error("Лимит зиёд шуд, каме сабр кунед");
    if (res.status === 402) throw new Error("Кредити AI Gateway тамом шуд");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`STT: ${res.status} ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    return { text: (json?.text ?? "").toString() };
  });
