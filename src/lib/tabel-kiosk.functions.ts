import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

const KIOSK_SESSION_NAME = "kiosk-gate";
const KIOSK_MAX_AGE = 60 * 60 * 12;

type KioskSession = { unlocked?: boolean; company_id?: string; user_id?: string };

function sessionConfig() {
  const password = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "kiosk-dev-secret-please-set-SESSION_SECRET-32chars";
  return {
    password: password.padEnd(32, "x"),
    name: KIOSK_SESSION_NAME,
    maxAge: KIOSK_MAX_AGE,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

async function requireUnlocked() {
  const session = await useSession<KioskSession>(sessionConfig());
  if (!session.data.unlocked || !session.data.company_id) {
    throw new Error("kiosk_locked");
  }
  return session.data as { unlocked: true; company_id: string };
}

export const tabelListWorkers = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data, error } = await admin.from("workers")
    .select("id, fullname, position, daily_rate, face_photo_path, face_required")
    .eq("company_id", s.company_id).eq("is_active", true)
    .order("fullname");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const tabelListToday = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    const s = await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: rows, error } = await admin.from("attendance")
      .select("id, worker_id, status, hours, date")
      .eq("company_id", s.company_id).eq("date", data.date);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const tabelMark = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    worker_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["full", "half", "absent"]),
    hours: z.number().min(0).max(24),
    face_verified: z.boolean().default(false),
    verification_photo_path: z.string().optional().nullable(),
    face_confidence: z.number().optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const s = await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Verify worker belongs to the unlocked company
    const { data: w } = await admin.from("workers")
      .select("id, face_photo_path, face_required").eq("id", data.worker_id).eq("company_id", s.company_id).maybeSingle();
    if (!w) throw new Error("worker_not_found");

    // Require face verification for active workers with enrolled face
    if (w.face_required && w.face_photo_path && !data.face_verified) {
      throw new Error("face_verification_required");
    }

    const { data: prev } = await admin.from("attendance")
      .select("id").eq("worker_id", data.worker_id).eq("date", data.date).maybeSingle();

    const payload = {
      status: data.status,
      hours: data.hours,
      face_verified: data.face_verified,
      verification_photo_path: data.verification_photo_path ?? null,
      face_confidence: data.face_confidence ?? null,
    };

    if (prev) {
      const { error } = await admin.from("attendance").update(payload).eq("id", prev.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("attendance").insert({
        worker_id: data.worker_id, company_id: s.company_id,
        date: data.date, ...payload,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
