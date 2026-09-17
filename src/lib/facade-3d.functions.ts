import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "project-3d-models";

// Owner sets or clears the 3D model path for a project/block.
export const setProject3dModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      project_id: z.string().uuid(),
      path: z.string().max(500).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project } = await supabase
      .from("projects")
      .select("id, company_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (!project?.company_id) throw new Error("Лоиҳа ёфт нашуд");

    const { data: company } = await supabase
      .from("companies")
      .select("owner_user_id")
      .eq("id", project.company_id)
      .maybeSingle();
    if (!company || company.owner_user_id !== userId) {
      throw new Error("Танҳо соҳиби ширкат метавонад");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Remove the previous file if replacing/clearing.
    const { data: current } = await admin
      .from("projects")
      .select("model_3d_path")
      .eq("id", data.project_id)
      .maybeSingle();
    if (current?.model_3d_path && current.model_3d_path !== data.path) {
      await admin.storage.from(BUCKET).remove([current.model_3d_path]);
    }

    const { error } = await admin
      .from("projects")
      .update({ model_3d_path: data.path })
      .eq("id", data.project_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// Returns a short-lived signed URL for the block's 3D model (authenticated).
export const getProject3dSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project } = await supabase
      .from("projects")
      .select("model_3d_path")
      .eq("id", data.project_id)
      .maybeSingle();
    if (!project?.model_3d_path) return { url: null as string | null };

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(project.model_3d_path, 60 * 60 * 24);
    return { url: signed?.signedUrl ?? null };
  });

// Public: signed URL for a showcase-enabled project (no auth).
export const getPublic3dSignedUrl = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: project } = await admin
      .from("projects")
      .select("model_3d_path, public_showcase")
      .eq("id", data.project_id)
      .maybeSingle();
    if (!project?.public_showcase || !project.model_3d_path) return { url: null as string | null };
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(project.model_3d_path, 60 * 60 * 24);
    return { url: signed?.signedUrl ?? null };
  });
