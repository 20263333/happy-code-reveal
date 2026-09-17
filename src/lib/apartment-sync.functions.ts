import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ҳолати танзимоти интегратсия бо sharora.tj. */
export const getApartmentSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    configured: !!process.env["SHARORA_WEBHOOK_URL"] && !!process.env["SHARORA_WEBHOOK_SECRET"],
    url: process.env["SHARORA_WEBHOOK_URL"] ?? null,
  }));

/** Фиристодани рӯйхати пурраи хонаҳои ширкат ба барномаи sharora.tj. */
export const syncAllApartments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: owned } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!owned?.id) throw new Error("Танҳо соҳиби ширкат метавонад синхронизатсия кунад");

    const { pushApartmentEvent, toApartmentDTO, APARTMENT_SELECT } = await import(
      "@/lib/sharora-webhook.server"
    );

    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("company_id", owned.id);
    const ids = (projects ?? []).map((p: any) => p.id);
    if (!ids.length) return { ok: true, count: 0 };

    const { data: rows, error } = await supabase
      .from("apartments")
      .select(APARTMENT_SELECT)
      .in("project_id", ids)
      .limit(20000);
    if (error) throw new Error(error.message);

    const items = (rows ?? []).map(toApartmentDTO);
    const res = await pushApartmentEvent("apartment.snapshot", { apartments: items });
    if (!res.ok) throw new Error(res.error ?? "Хатои фиристодан");
    return { ok: true, count: items.length };
  });
