import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCarDamages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("car_damages")
      .select("id, project_id, damage_date, vehicle, amount, notes, created_at")
      .eq("project_id", data.project_id)
      .order("damage_date", { ascending: false });
    if (error) throw new Error(error.message);
    const total = (rows ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    return { damages: rows ?? [], total };
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  damage_date: z.string(),
  vehicle: z.string().min(1).max(255),
  amount: z.number().min(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const upsertCarDamage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: proj, error: pErr } = await supabase
      .from("projects").select("company_id").eq("id", data.project_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!proj?.company_id) throw new Error("Лоиҳа ёфт нашуд");

    if (data.id) {
      const { error } = await supabase.from("car_damages")
        .update({
          damage_date: data.damage_date,
          vehicle: data.vehicle,
          amount: data.amount,
          notes: data.notes ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("car_damages").insert({
        company_id: proj.company_id,
        project_id: data.project_id,
        damage_date: data.damage_date,
        vehicle: data.vehicle,
        amount: data.amount,
        notes: data.notes ?? null,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCarDamage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("car_damages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
