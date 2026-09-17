import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ApartmentRow = z.object({
  floor_number: z.number().int().min(0).max(200),
  apartment_number: z.string().min(1).max(50),
  area: z.number().min(0).max(100000),
  price: z.number().min(0).max(1_000_000_000_000),
  rooms: z.number().int().min(0).max(50).optional().nullable(),
});

const ImportApartmentsSchema = z.object({
  project_id: z.string().uuid(),
  rows: z.array(ApartmentRow).min(1).max(2000),
});

export const importApartmentsFromExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImportApartmentsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user is owner and has access to the project
    const { data: prof } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Шумо ба ягон ширкат тааллуқ надоред");

    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!role) throw new Error("Танҳо соҳиби ширкат метавонад импорт кунад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: project } = await admin
      .from("projects").select("id, company_id").eq("id", data.project_id).maybeSingle();
    if (!project || project.company_id !== prof.company_id) {
      throw new Error("Лоиҳа ёфт нашуд");
    }

    // Group rows by floor_number
    const byFloor = new Map<number, typeof data.rows>();
    for (const r of data.rows) {
      const list = byFloor.get(r.floor_number) ?? [];
      list.push(r);
      byFloor.set(r.floor_number, list);
    }

    // Load existing floors for this project
    const { data: existingFloors } = await admin
      .from("floors").select("id, floor_number").eq("project_id", data.project_id);
    const floorIdByNumber = new Map<number, string>(
      (existingFloors ?? []).map((f: any) => [f.floor_number, f.id]),
    );

    // Create missing floors
    const missingFloorNums = [...byFloor.keys()].filter((n) => !floorIdByNumber.has(n));
    if (missingFloorNums.length > 0) {
      const { data: createdFloors, error: fErr } = await admin
        .from("floors")
        .insert(missingFloorNums.map((n) => ({ project_id: data.project_id, floor_number: n })))
        .select("id, floor_number");
      if (fErr) throw new Error("Ошёна: " + fErr.message);
      for (const f of createdFloors ?? []) floorIdByNumber.set(f.floor_number, f.id);
    }

    // Load existing apartments (to update vs insert)
    const floorIds = [...floorIdByNumber.values()];
    const { data: existingApts } = await admin
      .from("apartments").select("id, floor_id, apartment_number")
      .in("floor_id", floorIds.length > 0 ? floorIds : ["00000000-0000-0000-0000-000000000000"]);
    const aptKey = (floorId: string, num: string) => `${floorId}::${num.trim().toLowerCase()}`;
    const aptIdByKey = new Map<string, string>(
      (existingApts ?? []).map((a: any) => [aptKey(a.floor_id, a.apartment_number), a.id]),
    );

    let created = 0;
    let updated = 0;
    const inserts: any[] = [];

    for (const r of data.rows) {
      const floor_id = floorIdByNumber.get(r.floor_number)!;
      const price_per_sqm = r.area > 0 ? Math.round((r.price / r.area) * 100) / 100 : 0;
      const key = aptKey(floor_id, r.apartment_number);
      const existingId = aptIdByKey.get(key);
      if (existingId) {
        const { error } = await admin.from("apartments").update({
          area: r.area,
          price: r.price,
          price_per_sqm,
          rooms: r.rooms ?? null,
        }).eq("id", existingId);
        if (error) throw new Error("Навсозӣ: " + error.message);
        updated++;
      } else {
        inserts.push({
          project_id: data.project_id,
          floor_id,
          apartment_number: r.apartment_number,
          area: r.area,
          price: r.price,
          price_per_sqm,
          rooms: r.rooms ?? null,
          status: "empty",
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await admin.from("apartments").insert(inserts);
      if (error) throw new Error("Илова: " + error.message);
      created = inserts.length;
    }

    return { ok: true as const, created, updated, floors_created: missingFloorNums.length };
  });
