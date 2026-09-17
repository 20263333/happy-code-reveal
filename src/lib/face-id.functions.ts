import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FACE_MODEL = "openai/gpt-5.4-mini";
const MIN_CONFIDENCE = 0.75;

function asDataUrl(s: string): string {
  return s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;
}

function dataUrlMime(s: string): string {
  const m = s.match(/^data:([^;,]+);base64,/);
  return m ? m[1] : "image/jpeg";
}

async function gatewayCompareFaces(enrolledDataUrl: string, capturedDataUrl: string): Promise<{ match: boolean; confidence: number }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI Gateway key not configured");

  const body = {
    model: FACE_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You compare two face photos and decide if they show the same person. Respond ONLY with JSON: {\"match\": boolean, \"confidence\": number 0-1}. Be strict: return match=true only when facial features, structure, and visible details clearly indicate the same individual. Lighting, angle, and expression may vary.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Photo 1 = enrolled reference face. Photo 2 = live captured face. Are they the same person? Return JSON only." },
          { type: "image_url", image_url: { url: enrolledDataUrl } },
          { type: "image_url", image_url: { url: capturedDataUrl } },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Lovable-API-Key": apiKey.trim(),
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`AI Gateway error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = text ? JSON.parse(text) : null;
    const content = json?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content || "{}");
    const match = !!parsed.match;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    return { match, confidence };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- Enroll face (owner/manager in attendance page) ----------
export const enrollWorkerFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      worker_id: z.string().uuid(),
      image_base64: z.string().min(100),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller can manage this worker's company
    const { data: worker } = await supabase
      .from("workers")
      .select("id, company_id, fullname")
      .eq("id", data.worker_id)
      .maybeSingle();
    if (!worker) throw new Error("Коргар ёфт нашуд");

    const { data: company } = await supabase
      .from("companies")
      .select("id, owner_user_id")
      .eq("id", worker.company_id)
      .maybeSingle();
    if (!company) throw new Error("Ширкат ёфт нашуд");

    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    if (company.owner_user_id !== userId && !isAdmin) {
      throw new Error("Танҳо соҳиби ширкат ё админ метавонад акс сабт кунад");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const ext = dataUrlMime(data.image_base64) === "image/png" ? "png" : "jpg";
    const path = `${worker.company_id}/${data.worker_id}/face.${ext}`;
    const base64 = data.image_base64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(base64, "base64");

    const { error: upErr } = await admin.storage.from("worker-faces").upload(path, bytes, {
      contentType: ext === "png" ? "image/png" : "image/jpeg",
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    const { error } = await admin
      .from("workers")
      .update({ face_photo_path: path, face_enrolled_at: new Date().toISOString() })
      .eq("id", data.worker_id);
    if (error) throw new Error(error.message);

    return { ok: true as const, path };
  });

// ---------- Kiosk verification ----------
async function requireKioskSession() {
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<{ unlocked?: boolean; company_id?: string }>({
    password: (process.env["SESSION_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"] || "kiosk-dev-secret-please-set-SESSION_SECRET-32chars").padEnd(32, "x"),
    name: "kiosk-gate",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  });
  if (!session.data.unlocked || !session.data.company_id) throw new Error("kiosk_locked");
  return session.data as { unlocked: true; company_id: string };
}

async function runFaceVerification(
  admin: any,
  companyId: string,
  workerId: string,
  capturedBase64: string,
): Promise<{ ok: true; confidence: number; verification_photo_path: string | null } | { ok: false; reason: string; message: string; confidence?: number; verification_photo_path?: string | null }> {
  const { data: worker } = await admin
    .from("workers")
    .select("id, company_id, fullname, face_photo_path, face_required")
    .eq("id", workerId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!worker) throw new Error("Коргар ёфт нашуд");

  if (!worker.face_photo_path) {
    return {
      ok: false as const,
      reason: "no_enrolled_face",
      message: "Акси рӯй сабт нашудааст. Лутфан аввал акс гиред.",
    };
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("worker-faces")
    .createSignedUrl(worker.face_photo_path, 300);
  if (signErr || !signed?.signedUrl) {
    throw new Error("Акси сабтшуда дастрас нест");
  }

  const enrolledRes = await fetch(signed.signedUrl);
  if (!enrolledRes.ok) throw new Error("Акси сабтшуда бор карда нашуд");
  const enrolledBuf = Buffer.from(await enrolledRes.arrayBuffer());
  const enrolledDataUrl = `data:image/jpeg;base64,${enrolledBuf.toString("base64")}`;

  const { match, confidence } = await gatewayCompareFaces(enrolledDataUrl, asDataUrl(capturedBase64));

  // Save captured verification photo regardless of result (for audit)
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const verificationPath = `${worker.company_id}/${workerId}/verifications/${ts}.jpg`;
  const capturedBase64Raw = capturedBase64.replace(/^data:[^;]+;base64,/, "");
  const capturedBytes = Buffer.from(capturedBase64Raw, "base64");
  const { error: upErr } = await admin.storage.from("worker-faces").upload(verificationPath, capturedBytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) console.error("[face-id] verification upload failed", upErr.message);

  if (!match || confidence < MIN_CONFIDENCE) {
    return {
      ok: false as const,
      reason: "face_mismatch",
      message: `Рӯй мувофиқат накард (иштимок: ${Math.round(confidence * 100)}%). Қайд қабул намешавад.`,
      confidence,
      verification_photo_path: upErr ? null : verificationPath,
    };
  }

  return { ok: true as const, confidence, verification_photo_path: upErr ? null : verificationPath };
}

export const verifyWorkerFace = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      worker_id: z.string().uuid(),
      captured_base64: z.string().min(100),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const s = await requireKioskSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runFaceVerification(supabaseAdmin as any, s.company_id, data.worker_id, data.captured_base64);
  });

export const verifyWorkerFaceAuthed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      worker_id: z.string().uuid(),
      captured_base64: z.string().min(100),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: worker } = await admin
      .from("workers")
      .select("company_id")
      .eq("id", data.worker_id)
      .maybeSingle();
    if (!worker) throw new Error("Коргар ёфт нашуд");

    const { data: company } = await admin
      .from("companies")
      .select("id, owner_user_id")
      .eq("id", worker.company_id)
      .maybeSingle();
    if (!company) throw new Error("Ширкат ёфт нашуд");

    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", { _user_id: context.userId });
    const { data: profile } = await context.supabase.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (company.owner_user_id !== context.userId && profile?.company_id !== company.id && !isAdmin) {
      throw new Error("Дастрасӣ маҳдуд аст");
    }

    return runFaceVerification(admin, company.id, data.worker_id, data.captured_base64);
  });

export const getWorkerFaceStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ worker_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await requireKioskSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: worker } = await admin
      .from("workers")
      .select("face_photo_path, face_required")
      .eq("id", data.worker_id)
      .eq("company_id", s.company_id)
      .maybeSingle();
    return {
      enrolled: !!worker?.face_photo_path,
      required: worker?.face_required ?? true,
    };
  });
