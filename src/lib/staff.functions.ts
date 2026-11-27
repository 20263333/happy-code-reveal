import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helper to resolve company and verify owner permissions
async function resolveOwnerAndCompany(admin: any, userId: string) {
  const [profRes, ownedRes, roleRes, paRes] = await Promise.all([
    admin.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
    admin.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle(),
    admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  const ownedCompanyId = (ownedRes.data as any)?.id ?? null;
  const profileCompanyId = ((profRes.data as any)?.company_id as string | null) ?? null;
  const companyId = ownedCompanyId ?? profileCompanyId;
  const isOwner = !!ownedCompanyId || !!roleRes.data || !!paRes.data;

  if (companyId && !profileCompanyId) {
    await admin.from("profiles").upsert({ id: userId, company_id: companyId }, { onConflict: "id" });
  }

  return { companyId, isOwner };
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullname: z.string().min(1),
        phone: z.string().optional().nullable(),
        role: z.enum(["manager", "accountant", "warehouse"]),
        department: z.enum(["sales", "legal", "accounting", "construction", "hr"]).optional().nullable(),
        project_ids: z.array(z.string().uuid()).max(200).optional(),
        extra_pages: z.array(z.string().max(100)).max(200).optional(),
        denied_pages: z.array(z.string().max(100)).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, context.userId);
    if (!isOwner) {
      throw new Error("Танҳо соҳиби ширкат метавонад корманд илова кунад");
    }
    if (!companyId) {
      throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред");
    }

    let userId: string | null = null;
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { fullname: data.fullname.trim(), phone: data.phone || null },
    });

    if (userError) {
      const msg = (userError.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user_already_exists") ||
        (userError as any).code === "email_exists";
      if (!alreadyExists) {
        throw new Error(userError.message);
      }
      // User with this email already exists — reuse it and just grant access.
      // Find by paginating listUsers (Supabase admin API has no direct getByEmail).
      const target = data.email.trim().toLowerCase();
      let page = 1;
      while (page <= 20 && !userId) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listErr) throw new Error(listErr.message);
        const found = list.users.find((u) => (u.email || "").toLowerCase() === target);
        if (found) {
          userId = found.id;
          break;
        }
        if (list.users.length < 200) break;
        page += 1;
      }
      if (!userId) {
        throw new Error("Корбар бо ин email мавҷуд аст, аммо ёфт нашуд");
      }
      // Ensure the account has the requested password / metadata so the owner
      // can share credentials with the employee.
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { fullname: data.fullname.trim(), phone: data.phone || null },
      });
    } else {
      userId = userData!.user.id;
    }

    if (!userId) {
      throw new Error("Корбар сохта нашуд");
    }

    // Only set company_id if profile has none — never steal a user from another company.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (existingProfile?.company_id && existingProfile.company_id !== companyId) {
      throw new Error("Ин корбар аллакай ба ширкати дигар тааллуқ дорад");
    }

    const { error: profErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        fullname: data.fullname.trim(),
        phone: data.phone || null,
        company_id: companyId,
        department: data.department ?? null,
        extra_pages: data.extra_pages ?? [],
        denied_pages: data.denied_pages ?? [],
      }, { onConflict: "id" });
    if (profErr) throw new Error(profErr.message);

    // Replace existing role assignments so re-granting access updates the role.
    const { error: delRoleErr } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (delRoleErr) throw new Error(delRoleErr.message);
    const { error: insRoleErr } = await admin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
    });
    if (insRoleErr) throw new Error(insRoleErr.message);

    // Assign project access without crashing on ON CONFLICT or missing constraints
    if (data.project_ids && data.project_ids.length > 0) {
      const { data: companyProjects } = await admin
        .from("projects")
        .select("id")
        .eq("company_id", companyId);

      const companyIds = new Set(((companyProjects ?? []) as { id: string }[]).map((p) => p.id));
      const toAssign = data.project_ids.filter((id) => companyIds.has(id));

      if (toAssign.length > 0) {
        const { data: existingPs } = await admin
          .from("project_staff")
          .select("project_id")
          .eq("user_id", userId);
        const existingSet = new Set(((existingPs ?? []) as { project_id: string }[]).map((p) => p.project_id));
        const missing = toAssign.filter((pid) => !existingSet.has(pid));
        if (missing.length > 0) {
          const { error: psErr } = await admin
            .from("project_staff")
            .insert(missing.map((pid) => ({ user_id: userId, project_id: pid })));
          if (psErr) throw new Error(psErr.message);
        }
      }
    }

    return { userId };
  });

export const changeEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["owner", "manager", "accountant", "warehouse", "director"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, context.userId);
    if (!isOwner) throw new Error("Танҳо соҳиби ширкат метавонад нақшро иваз кунад");

    // Target must belong to owner's company
    const { data: targetProf } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Корманд дар ширкати шумо ёфт нашуд");
    }

    await admin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await admin.from("user_roles").insert({
      user_id: data.user_id,
      role: data.role,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { companyId, isOwner } = await resolveOwnerAndCompany(admin, context.userId);
    if (!isOwner || !companyId) {
      throw new Error("Танҳо соҳиби ширкат метавонад кормандро нест кунад");
    }

    if (data.user_id === context.userId) {
      throw new Error("Шумо наметавонед худро нест кунед");
    }

    const { data: targetProf } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!targetProf || targetProf.company_id !== companyId) {
      throw new Error("Корманд дар ширкати шумо ёфт нашуд");
    }

    await admin.from("project_staff").delete().eq("user_id", data.user_id);
    await admin.from("user_roles").delete().eq("user_id", data.user_id);
    await admin.from("profiles").delete().eq("id", data.user_id);

    try {
      await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    } catch {
      // ignore auth user deletion error if not found
    }

    return { ok: true };
  });
