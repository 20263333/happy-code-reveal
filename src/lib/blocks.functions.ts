import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A "block" is a child project (sub-project) of a top-level project (ЖК).
const CreateBlockSchema = z.object({
  parent_id: z.string().uuid(),
  name: z.string().min(1).max(150),
  location: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["planning", "in_progress", "completed", "paused"]).default("in_progress"),
});

const ProjectIdSchema = z.object({ project_id: z.string().uuid() });

const CreateFloorSchema = z.object({
  project_id: z.string().uuid(),
  floor_number: z.number().int().min(-5).max(200),
  status: z.string().max(40).default("in_progress"),
  description: z.string().max(2000).optional().nullable(),
});

const FloorIdSchema = z.object({ floor_id: z.string().uuid() });

// Resolve the company of the current user from the profile link or direct ownership,
// and keep the profile in sync so client-side RLS reads work afterwards.
async function resolveCompany(admin: any, userId: string) {
  const [profRes, ownedRes, roleRes] = await Promise.all([
    admin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
    admin.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle(),
  ]);
  const ownedCompanyId: string | null = (ownedRes.data as any)?.id ?? null;
  const companyId: string | null = ((profRes.data as any)?.company_id as string | null) ?? ownedCompanyId;
  const isOwner = !!ownedCompanyId || !!roleRes.data;
  if (companyId && !(profRes.data as any)?.company_id) {
    await admin.from("profiles").upsert({ id: userId, company_id: companyId }, { onConflict: "id" });
  }
  return { companyId, isOwner };
}

async function assertCompanyProject(admin: any, projectId: string, companyId: string | null) {
  const { data: project } = await admin
    .from("projects").select("id, company_id, parent_id, location").eq("id", projectId).maybeSingle();
  if (!project || !companyId || project.company_id !== companyId) {
    throw new Error("Лоиҳа ёфт нашуд");
  }
  return project;
}

export const createBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateBlockSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveCompany(admin, userId);
    if (!companyId) throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред");
    if (!isOwner) throw new Error("Танҳо соҳиби ширкат метавонад блок созад");

    const parent = await assertCompanyProject(admin, data.parent_id, companyId);
    if (parent.parent_id) throw new Error("Дар дохили блок боз блок сохтан мумкин нест");

    // Enforce the block quota set by the Super Admin (company-wide child count).
    const { data: company } = await admin
      .from("companies").select("max_blocks").eq("id", companyId).maybeSingle();
    const { count: blockCount } = await admin
      .from("projects").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).not("parent_id", "is", null);
    const maxBlocks = company?.max_blocks ?? 0;
    if ((blockCount ?? 0) >= maxBlocks) {
      throw new Error(`Лимити блокҳо пур шуд (${maxBlocks}). Бо Super Admin тамос гиред.`);
    }

    const { data: created, error } = await admin
      .from("projects")
      .insert({
        name: data.name,
        location: data.location ?? parent.location ?? null,
        description: data.description ?? null,
        status: data.status,
        company_id: companyId,
        parent_id: data.parent_id,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ok: true, block: created };
  });

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ProjectIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId } = await resolveCompany(admin, userId);
    const { data: parent } = await admin
      .from("projects").select("id, company_id").eq("id", data.project_id).maybeSingle();
    const sameCompany = !!parent && !!companyId && parent.company_id === companyId;

    const client = sameCompany ? admin : (supabase as any);
    const { data: blocks, error } = await client
      .from("projects")
      .select("*")
      .eq("parent_id", data.project_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const blockIds = (blocks ?? []).map((block: any) => block.id as string);
    if (!blockIds.length) return [];
    const { data: apartments, error: apartmentsError } = await client
      .from("apartments")
      .select("id, status, project_id")
      .in("project_id", blockIds);
    if (apartmentsError) throw new Error(apartmentsError.message);
    return (blocks ?? []).map((block: any) => ({
      ...block,
      apartments: (apartments ?? []).filter((apartment: any) => apartment.project_id === block.id),
    }));
  });

export const deleteBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ block_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveCompany(admin, userId);
    if (!isOwner) throw new Error("Танҳо соҳиби ширкат метавонад блокро нест кунад");
    await assertCompanyProject(admin, data.block_id, companyId);

    const { error } = await admin.from("projects").delete().eq("id", data.block_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFloors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ProjectIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId } = await resolveCompany(admin, userId);
    const { data: project } = await admin
      .from("projects").select("id, company_id").eq("id", data.project_id).maybeSingle();
    const sameCompany = !!project && !!companyId && project.company_id === companyId;

    const client = sameCompany ? admin : (supabase as any);
    const { data: floors, error } = await client
      .from("floors")
      .select("*")
      .eq("project_id", data.project_id)
      .order("floor_number", { ascending: true });
    if (error) throw new Error(error.message);
    const floorIds = (floors ?? []).map((floor: any) => floor.id as string);
    if (!floorIds.length) return [];
    const { data: apartments, error: apartmentsError } = await client
      .from("apartments")
      .select("*")
      .in("floor_id", floorIds);
    if (apartmentsError) throw new Error(apartmentsError.message);
    return (floors ?? []).map((floor: any) => ({
      ...floor,
      apartments: (apartments ?? []).filter((apartment: any) => apartment.floor_id === floor.id),
    }));
  });

export const createFloor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateFloorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId } = await resolveCompany(admin, userId);
    await assertCompanyProject(admin, data.project_id, companyId);

    const { data: created, error } = await admin
      .from("floors")
      .insert({
        project_id: data.project_id,
        floor_number: data.floor_number,
        status: data.status,
        description: data.description ?? null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ok: true, floor: created };
  });

export const deleteFloor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FloorIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId } = await resolveCompany(admin, userId);
    const { data: floor } = await admin
      .from("floors").select("id, project_id").eq("id", data.floor_id).maybeSingle();
    if (!floor) throw new Error("Ошёна ёфт нашуд");
    await assertCompanyProject(admin, floor.project_id, companyId);

    const { error } = await admin.from("floors").delete().eq("id", data.floor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
