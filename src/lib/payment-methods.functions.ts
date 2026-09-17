import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicPaymentMethod = {
  id: string;
  provider: string;
  label: string | null;
  card_number: string | null;
  holder_name: string | null;
  note: string | null;
};

// Returns active payment methods to Super Admin and company owners.
// We authorize by userId from the request bearer (via requireSupabaseAuth),
// then read with supabaseAdmin — the SECURITY DEFINER RPC relies on auth.uid()
// which is NULL under the service role, so calling it directly would filter
// everything out.
export const listActivePaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicPaymentMethod[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const userId = context.userId;

    const [{ data: pa }, { data: ownedCompany }, { data: rolesRows }] = await Promise.all([
      admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      admin.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner"),
    ]);

    const isAuthorized = !!pa || !!ownedCompany || (Array.isArray(rolesRows) && rolesRows.length > 0);
    if (!isAuthorized) return [];

    const { data, error } = await admin
      .from("payment_methods")
      .select("id, provider, label, card_number, holder_name, note")
      .eq("is_active", true)
      .order("provider");
    if (error) throw new Error(error.message);
    return (data ?? []) as PublicPaymentMethod[];
  });
