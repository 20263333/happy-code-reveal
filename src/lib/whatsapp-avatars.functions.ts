import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Аксҳои профили лидҳои кӯҳнаро аз Wappi боргирӣ карда, ҳамчун data-URL нигоҳ медорад.
 * Танҳо соҳиб / директор / админ. Талаб мекунад, ки профили WhatsApp фаъол (authorized) бошад.
 */
export const backfillWhatsappAvatars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: companyId } = await supabase.rpc("user_company_id", { _user_id: userId });
    if (!companyId) throw new Error("Ширкат ёфт нашуд");

    const [{ data: isOwner }, { data: isDirector }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
      supabase.rpc("is_director", { _user_id: userId }),
      supabase.rpc("is_platform_admin", { _user_id: userId }),
    ]);
    if (!isOwner && !isDirector && !isAdmin) throw new Error("Иҷозат нест");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cacheAvatar, fetchWappiAvatar } = await import("@/lib/whatsapp.server");
    const admin = supabaseAdmin as any;

    const { data: acc } = await admin
      .from("whatsapp_accounts")
      .select("profile_id")
      .eq("company_id", companyId)
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    if (!acc?.profile_id) throw new Error("Профили Wappi танзим нашудааст");

    const { data: chats } = await admin
      .from("whatsapp_chats")
      .select("id, phone, avatar_url")
      .eq("company_id", companyId)
      .limit(1000);

    let updated = 0;
    let failed = 0;
    for (const c of chats ?? []) {
      if (String(c.avatar_url ?? "").startsWith("data:")) continue;
      const fresh = await fetchWappiAvatar(acc.profile_id, c.phone);
      const cached = (await cacheAvatar(fresh)) ?? (await cacheAvatar(c.avatar_url));
      if (!cached) {
        failed++;
        continue;
      }
      await admin.from("whatsapp_chats").update({ avatar_url: cached }).eq("id", c.id);
      updated++;
    }

    return { ok: true, updated, failed, total: (chats ?? []).length };
  });
