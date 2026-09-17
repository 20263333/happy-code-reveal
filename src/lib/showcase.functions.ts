import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Public read: returns safe showcase data for a project, no auth ----
export const getPublicShowcase = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: project } = await admin
      .from("projects")
      .select("id, name, location, description, status, public_showcase, show_prices, company_id, cover_url")
      .eq("id", data.id)
      .maybeSingle();

    if (!project || !project.public_showcase) {
      return { ok: false as const };
    }

    const { data: company } = await admin
      .from("companies")
      .select("name, phone")
      .eq("id", project.company_id)
      .maybeSingle();

    const { data: floors } = await admin
      .from("floors")
      .select("id, floor_number, apartments(id, apartment_number, area, rooms, status, price, plan_image_path)")
      .eq("project_id", data.id)
      .order("floor_number", { ascending: true });

    const showPrices = !!project.show_prices;

    // Collect all plan paths and create signed URLs in one batch.
    const planPaths: string[] = [];
    for (const f of floors ?? []) {
      for (const a of (f as any).apartments ?? []) {
        if (a.plan_image_path) planPaths.push(a.plan_image_path);
      }
    }
    const planUrlMap = new Map<string, string>();
    if (planPaths.length) {
      const { data: signed } = await admin.storage
        .from("apartment-plans")
        .createSignedUrls(planPaths, 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) planUrlMap.set(s.path, s.signedUrl);
      }
    }

    const cleanFloors = (floors ?? [])
      .map((f: any) => ({
        floor_number: f.floor_number,
        apartments: (f.apartments ?? [])
          .map((a: any) => ({
            apartment_number: a.apartment_number,
            area: a.area,
            rooms: a.rooms,
            status: a.status,
            price: showPrices ? a.price : null,
            plan_url: a.plan_image_path ? planUrlMap.get(a.plan_image_path) ?? null : null,
          }))
          .sort((a: any, b: any) =>
            String(a.apartment_number).localeCompare(String(b.apartment_number), "ru", { numeric: true }),
          ),
      }))
      .sort((a: any, b: any) => Number(a.floor_number) - Number(b.floor_number));

    const allApts = cleanFloors.flatMap((f: any) => f.apartments);

    return {
      ok: true as const,
      showPrices,
      project: {
        name: project.name,
        location: project.location,
        description: project.description,
        status: project.status,
        cover_url: project.cover_url,
      },
      company: { name: company?.name ?? null, phone: company?.phone ?? null },
      floors: cleanFloors,
      stats: {
        total: allApts.length,
        sold: allApts.filter((a: any) => a.status === "sold").length,
        installment: allApts.filter((a: any) => a.status === "installment").length,
        empty: allApts.filter((a: any) => a.status === "empty").length,
        reserved: allApts.filter((a: any) => a.status === "reserved").length,
      },
    };
  });

// ---- Owner-only: toggle showcase / price visibility ----
export const setProjectShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        public_showcase: z.boolean().optional(),
        show_prices: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const patch: Record<string, boolean> = {};
    if (typeof data.public_showcase === "boolean") patch.public_showcase = data.public_showcase;
    if (typeof data.show_prices === "boolean") patch.show_prices = data.show_prices;
    if (Object.keys(patch).length === 0) throw new Error("Ягон тағйирот нест");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error("Лоиҳа ёфт нашуд");

    const [{ data: isPlatformAdmin }, { data: isOwnerRole }, { data: companyId }, { data: company, error: companyError }] =
      await Promise.all([
        admin.rpc("is_platform_admin", { _user_id: userId }),
        admin.rpc("has_role", { _user_id: userId, _role: "owner" }),
        admin.rpc("user_company_id", { _user_id: userId }),
        admin.from("companies").select("id, owner_user_id").eq("id", project.company_id).maybeSingle(),
      ]);
    if (companyError) throw new Error(companyError.message);

    const canManage =
      !!isPlatformAdmin ||
      company?.owner_user_id === userId ||
      (!!isOwnerRole && companyId === project.company_id);
    if (!canManage) throw new Error("Танҳо соҳиби ширкат метавонад тағйир диҳад");

    const { data: updated, error } = await admin
      .from("projects")
      .update(patch)
      .eq("id", data.id)
      .select("id, public_showcase, show_prices")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Лоиҳа ёфт нашуд ё дастрасӣ нест");
    return { ok: true, project: updated };
  });
