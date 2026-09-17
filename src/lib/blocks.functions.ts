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

export const createBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateBlockSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof, error: pErr } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof?.company_id) throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред");

    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
    if (!role) throw new Error("Танҳо соҳиби ширкат метавонад блок созад");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // The parent must be a top-level project owned by this company.
    const { data: parent } = await admin
      .from("projects").select("id, company_id, parent_id").eq("id", data.parent_id).maybeSingle();
    if (!parent || parent.company_id !== prof.company_id) {
      throw new Error("Лоиҳаи асосӣ ёфт нашуд");
    }
    if (parent.parent_id) {
      throw new Error("Дар дохили блок боз блок сохтан мумкин нест");
    }

    // Enforce the block quota set by the Super Admin (company-wide child count).
    const { data: company } = await admin
      .from("companies").select("max_blocks").eq("id", prof.company_id).maybeSingle();
    const { count: blockCount } = await admin
      .from("projects").select("id", { count: "exact", head: true })
      .eq("company_id", prof.company_id).not("parent_id", "is", null);
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
        company_id: prof.company_id,
        parent_id: data.parent_id,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { ok: true, block: created };
  });
