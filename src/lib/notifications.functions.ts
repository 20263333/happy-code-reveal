import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getNotificationViewCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: pa } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!pa) return {} as Record<string, number>;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("notification_view_counts");
    if (error) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
      map[row.notification_id] = Number(row.viewers) || 0;
    }
    return map;
  });
