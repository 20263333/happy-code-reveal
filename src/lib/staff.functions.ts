import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullname: z.string().min(1),
        phone: z.string().optional(),
        role: z.enum(["manager", "accountant", "warehouse"]),
        department: z.enum(["sales", "legal", "accounting", "construction", "hr"]).optional(),
        project_ids: z.array(z.string().uuid()).max(200).optional(),
        extra_pages: z.array(z.string().max(100)).max(200).optional(),
        denied_pages: z.array(z.string().max(100)).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only a company owner may provision new employee accounts and assign roles.
    // Other staff (manager/accountant/warehouse) must never be able to create users.
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) {
      throw new Error("Танҳо соҳиби ширкат метавонад корманд илова кунад");
    }

    const { data: prof, error: profErr } = await context.supabase
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .single();

    if (profErr || !prof?.company_id) {
      throw new Error("Company not found");
    }
    const companyId = prof.company_id;

    let userId: string | null = null;
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { fullname: data.fullname, phone: data.phone },
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
      const target = data.email.toLowerCase();
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
        user_metadata: { fullname: data.fullname, phone: data.phone },
      });
    } else {
      userId = userData!.user.id;
    }

    // Only set company_id if profile has none — never steal a user from
    // another company.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (existingProfile?.company_id && existingProfile.company_id !== companyId) {
      throw new Error("Ин корбар аллакай ба ширкати дигар тааллуқ дорад");
    }
    // Upsert: if the profile row doesn't exist yet (handle_new_user trigger
    // isn't installed), create it so the employee has a company_id and
    // isn't bounced to /pending on login.
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        fullname: data.fullname,
        phone: data.phone || null,
        company_id: companyId,
        department: data.department ?? null,
        extra_pages: data.extra_pages ?? [],
        denied_pages: data.denied_pages ?? [],
      }, { onConflict: "id" });


    // Replace existing role assignments so re-granting access updates the role.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
    });

    // Assign project access. Only the exact projects/blocks selected by the
    // owner are stored — no parent/child expansion, so an employee assigned to
    // one block never sees the other blocks of the same ЖК.
    if (data.project_ids && data.project_ids.length > 0) {
      const { data: companyProjects } = await (supabaseAdmin as any)
        .from("projects")
        .select("id")
        .eq("company_id", companyId);

      const companyIds = new Set(((companyProjects ?? []) as { id: string }[]).map((p) => p.id));
      const toAssign = data.project_ids.filter((id) => companyIds.has(id));

      if (toAssign.length > 0) {
        const { error: psErr } = await (supabaseAdmin as any)
          .from("project_staff")
          .upsert(
            toAssign.map((pid) => ({ user_id: userId, project_id: pid })),
            { onConflict: "project_id,user_id", ignoreDuplicates: true },
          );
        if (psErr) throw new Error(psErr.message);
      }
    }


    return { userId };
  });
