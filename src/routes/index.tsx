import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStableSession, hasSavedSessionData } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Binosoz.tj — ERP/CRM для строительных компаний" },
      { name: "description", content: "Платформа для застройщиков Таджикистана: проекты, продажи квартир, платежи, склад, смета и рассрочки в одном месте." },
      { property: "og:title", content: "Binosoz.tj — ERP/CRM для застройщиков" },
      { property: "og:description", content: "Ведите проекты, продажи квартир, рассрочки и финансы строительной компании в одной системе." },
      { property: "og:url", content: "https://binosoz.tj/" },
    ],
    links: [{ rel: "canonical", href: "https://binosoz.tj/" }],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getStableSession();
      if (cancelled) return;
      if (!session) {
        // If a refresh token still exists, do not bounce the owner to /auth on
        // a slow laptop/network. Let the protected app layout keep retrying.
        if (hasSavedSessionData()) {
          navigate({ to: "/projects", replace: true });
          return;
        }
        navigate({ to: "/auth", replace: true });
        return;
      }
      const uid = session.user.id;
      const [{ data: pa }, { data: prof }, { data: ownedCompany }, { data: roles }] = await Promise.all([
        (supabase as any).from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle(),
        (supabase as any).from("profiles").select("company_id").eq("id", uid).maybeSingle(),
        (supabase as any).from("companies").select("id").eq("owner_user_id", uid).maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (cancelled) return;
      if (pa) { navigate({ to: "/admin" as any, replace: true }); return; }
      if (!prof?.company_id && !ownedCompany?.id) { navigate({ to: "/pending" as any, replace: true }); return; }
      // Директор аввал дашбордро мебинад, на рӯйхати лоиҳаҳо.
      const isDirector = ((roles as { role: string }[] | null) ?? []).some((r) => r.role === "director");
      navigate({ to: isDirector ? ("/dashboard" as any) : "/projects", replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
