import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(150),
  location: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["planning", "in_progress", "completed", "paused"]).default("in_progress"),
  cover_url: z.string().max(500).optional().nullable(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof, error: pErr } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof?.company_id) throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред");

    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!role) throw new Error("Танҳо соҳиби ширкат метавонад лоиҳа созад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Enforce the project quota set by the Super Admin for this company.
    const { data: company } = await (supabaseAdmin as any)
      .from("companies").select("max_projects").eq("id", prof.company_id).maybeSingle();
    const { count: projectCount } = await (supabaseAdmin as any)
      .from("projects").select("id", { count: "exact", head: true }).eq("company_id", prof.company_id).is("parent_id", null);
    const maxProjects = company?.max_projects ?? 0;
    if ((projectCount ?? 0) >= maxProjects) {
      throw new Error(`Лимити лоиҳаҳо пур шуд (${maxProjects}). Бо Super Admin тамос гиред.`);
    }


    const { data: created, error } = await (supabaseAdmin as any)
      .from("projects")
      .insert({
        name: data.name,
        location: data.location ?? null,
        description: data.description ?? null,
        status: data.status,
        cover_url: data.cover_url ?? null,
        company_id: prof.company_id,
        parent_id: null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ok: true, project: created };
  });
