import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopbarControls } from "@/components/topbar-controls";
import { AiAssistant, AiAssistantProvider } from "@/components/ai-assistant";
import { DemoFeedbackChat } from "@/components/demo-feedback-chat";
import { SocialDock } from "@/components/social-dock";
import { PinLock } from "@/components/pin-lock";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { companyModuleEnabled } from "@/lib/constants";
import { computeAllowedPages } from "@/lib/app-pages";
import { getStableSession, hasSavedSessionData } from "@/lib/auth-session";

let lastAalUserId: string | null = null;
let lastAalCheckAt = 0;
const AAL_CHECK_TTL = 5 * 60_000;

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await getStableSession();
    // Only kick to /auth when there is NO saved session data at all. If a
    // refresh token still exists in storage, keep the user in the app —
    // useAuth will keep retrying recovery in the background. Otherwise a
    // transient network hiccup or expired access token throws users out
    // mid-work (the exact "мепартояд" symptom).
    if (!session && !hasSavedSessionData()) throw redirect({ to: "/auth" });
    // 2FA gate: if the user enrolled TOTP but hasn't completed the challenge
    // this session, force them back to /auth to enter the code.
    const shouldCheckAal = session && (
      lastAalUserId !== session.user.id || Date.now() - lastAalCheckAt > AAL_CHECK_TTL
    );
    if (shouldCheckAal) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        throw redirect({ to: "/auth" });
      }
      lastAalUserId = session.user.id;
      lastAalCheckAt = Date.now();
    }
  },
  component: AppLayout,
});

// Routes every signed-in staff member may open regardless of granted pages.
const ALWAYS_ALLOWED_SEGMENTS = new Set([
  "", "support", "notifications", "pending", "kiosk", "tabel-kiosk", "my-shares", "my-earnings",
]);

function AppLayout() {
  const { user, loading, companyId, isPlatformAdmin, isWarehouse, isOwner, isAccountant, isDirector, profileLoaded, department, extraPages, deniedPages } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const warehouseOnly = isWarehouse && !isOwner && !isAccountant;


  const { data: company } = useQuery({
    queryKey: ["company-access", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await (supabase as any).from("companies")
        .select("subscription_tariff_id, subscription_expires_at, enabled_modules, is_demo").eq("id", companyId).single();
      return data;
    },
    enabled: !!companyId && !isPlatformAdmin,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (loading) return;
    // NOTE: intentionally do NOT navigate to /auth from here — the route
    // beforeLoad is the only auth gate. Redirecting on transient !user
    // (e.g. a spurious SIGNED_OUT during token refresh) throws users out
    // of the app mid-work. If the session is really gone, the next
    // navigation hits beforeLoad and redirects cleanly.
    if (!user) return;
    // Wait until profile is confirmed loaded — otherwise a transient
    // network failure that leaves companyId=null would kick the owner
    // straight to /pending on a fresh laptop cold-load.
    if (!companyId && !isPlatformAdmin && !isDirector) { if (profileLoaded) navigate({ to: "/pending" as any }); return; }
    // A warehouse keeper only works inside the warehouse module.
    if (warehouseOnly) {
      const seg = pathname.split("/")[1] ?? "";
      if (seg !== "warehouse" && seg !== "settings") { navigate({ to: "/warehouse" as any }); return; }
    }
    if (isDirector) {
      const seg = pathname.split("/")[1] ?? "";
      if (seg === "settings") { navigate({ to: "/dashboard" as any }); return; }
    }
    // Per-staff page access: an employee may only open the pages granted by
    // the company owner (department defaults + extras − denied). Without this
    // guard a denied page stayed reachable by URL even though it was hidden
    // in the sidebar.
    if (!isPlatformAdmin && !isOwner && !isDirector && !warehouseOnly && profileLoaded) {
      const seg = pathname.split("/")[1] ?? "";
      if (!ALWAYS_ALLOWED_SEGMENTS.has(seg)) {
        const allowed = computeAllowedPages(department, extraPages, deniedPages);
        if (!allowed.has(`/${seg}`)) {
          const fallback = [...allowed].find((u) => u.startsWith("/")) ?? "/support";
          navigate({ to: fallback as any, replace: true });
          return;
        }
      }
    }

    if (companyId && !isPlatformAdmin && company !== undefined) {
      const mods = (company?.enabled_modules as string[] | null) ?? null;
      const seg = pathname.split("/")[1] ?? "";
      const expires = company?.subscription_expires_at ? new Date(company.subscription_expires_at) : null;
      const active = !!company?.subscription_tariff_id && (!expires || expires > new Date());
      const billingAllowed = companyModuleEnabled(mods, "billing");
      if (!active && billingAllowed && pathname !== "/billing" && pathname !== "/settings") {
        navigate({ to: "/billing" as any });
        return;
      }
      // Block direct navigation to a module disabled by the Super Admin.
      // "kiosk" and "directors" are always allowed (not company modules —
      // kiosk gated by its own PIN; directors is owner-only management).
      if (mods && seg && seg !== "kiosk" && seg !== "directors" && !companyModuleEnabled(mods, seg)) {
        navigate({ to: billingAllowed ? "/projects" as any : "/projects" as any });
      }
    }
  }, [loading, user, companyId, isPlatformAdmin, isOwner, company, pathname, navigate, warehouseOnly, isDirector, profileLoaded, department, extraPages, deniedPages]);




  const showAi = (isOwner || isPlatformAdmin) && !company?.is_demo && !pathname.startsWith("/kiosk");

  return (
    <AiAssistantProvider>
      <PinLock>
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur lg:gap-3 lg:px-6">
                <SidebarTrigger />
                <span className="hidden truncate text-sm text-muted-foreground sm:inline">{t("app.name")}</span>
                <div className="ml-auto"><TopbarControls showAi={showAi} /></div>
              </header>
              {(() => {
                if (isPlatformAdmin || !company?.subscription_expires_at || company?.is_demo) return null;
                const expires = new Date(company.subscription_expires_at);
                const now = new Date();
                const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
                if (daysLeft > 14 || daysLeft < 0) return null;
                const critical = daysLeft <= 3;
                return (
                  <div className={`px-4 py-2 text-sm font-medium border-b ${critical ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"}`}>
                    ⚠️ Тарифи шумо баъд аз <b>{daysLeft}</b> рӯз тамом мешавад ({expires.toLocaleDateString("ru-RU")}). Барои давом додан ба{" "}
                    <a href="/billing" className="underline font-semibold">Тарифы и оплата</a> гузаред.
                  </div>
                );
              })()}
              <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
                <Outlet />
              </main>
            </div>
            {showAi && <AiAssistant />}
            {!pathname.startsWith("/kiosk") && <SocialDock />}
          </div>
        </SidebarProvider>
      </PinLock>
    </AiAssistantProvider>
  );
}
