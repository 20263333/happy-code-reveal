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

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profileResult, ownedResult] = await Promise.all([
      (supabaseAdmin as any).from("profiles").select("company_id").eq("id", userId).maybeSingle(),
      (supabaseAdmin as any).from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
    ]);
    const companyId = (profileResult.data as any)?.company_id ?? (ownedResult.data as any)?.id ?? null;

    let roots: any[] = [];
    if (companyId) {
      const { data, error } = await (supabaseAdmin as any)
        .from("projects")
        .select("id, name, location, status, cover_url, created_at")
        .eq("company_id", companyId)
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      roots = data ?? [];
    } else {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, location, status, cover_url, created_at")
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      roots = data ?? [];
    }

    const rootIds = roots.map((project) => project.id as string);
    if (!rootIds.length) return [];

    const { data: children, error: childrenError } = await (supabaseAdmin as any)
      .from("projects")
      .select("id, parent_id")
      .in("parent_id", rootIds);
    if (childrenError) throw new Error(childrenError.message);

    const childIds = (children ?? []).map((project: any) => project.id as string);
    let apartments: any[] = [];
    if (childIds.length) {
      const { data, error } = await (supabaseAdmin as any)
        .from("apartments")
        .select("project_id, status")
        .in("project_id", childIds);
      if (error) throw new Error(error.message);
      apartments = data ?? [];
    }

    return roots.map((project) => ({
      ...project,
      children: (children ?? [])
        .filter((child: any) => child.parent_id === project.id)
        .map((child: any) => ({
          id: child.id,
          apartments: apartments.filter((apartment: any) => apartment.project_id === child.id),
        })),
    }));
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Company identity: either the profile link or direct ownership of a company.
    const [profRes, ownedRes, roleRes] = await Promise.all([
      (supabaseAdmin as any).from("profiles").select("company_id").eq("id", userId).maybeSingle(),
      (supabaseAdmin as any).from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
      (supabaseAdmin as any).from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle(),
    ]);

    const ownedCompanyId = (ownedRes.data as any)?.id ?? null;
    const companyId: string | null = ((profRes.data as any)?.company_id as string | null) ?? ownedCompanyId;
    if (!companyId) throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред");

    const isOwner = !!ownedCompanyId || !!roleRes.data;
    if (!isOwner) throw new Error("Танҳо соҳиби ширкат метавонад лоиҳа созад");

    // Keep the profile in sync so the rest of the app sees the company too.
    if (!(profRes.data as any)?.company_id) {
      await (supabaseAdmin as any).from("profiles").upsert({ id: userId, company_id: companyId }, { onConflict: "id" });
    }

    // Enforce the project quota set by the Super Admin for this company.
    const { data: company } = await (supabaseAdmin as any)
      .from("companies").select("max_projects").eq("id", companyId).maybeSingle();
    const { count: projectCount } = await (supabaseAdmin as any)
      .from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("parent_id", null);
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
        company_id: companyId,
        parent_id: null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ok: true, project: created };
  });
