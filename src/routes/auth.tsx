import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppLogo } from "@/lib/app-logos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import { getStableSession, rememberSession } from "@/lib/auth-session";
import { MfaChallenge } from "@/components/mfa-challenge";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { ShowcaseCompanies } from "@/components/showcase-companies";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — Binosoz.tj" },
      { name: "description", content: "Войдите в Binosoz.tj через Google или оставьте заявку на подключение вашей строительной компании." },
      { property: "og:title", content: "Вход в Binosoz.tj" },
      { property: "og:description", content: "Доступ для владельцев строительных компаний и сотрудников: Google-вход и заявка на регистрацию." },
      { property: "og:url", content: "https://binosoz.tj/auth" },
    ],
    links: [{ rel: "canonical", href: "https://binosoz.tj/auth" }],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await getStableSession(2, 150);
    if (!session) return;
    // Keep the user on /auth until MFA is completed.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return;
    // Signed-in users go straight into the app, not back to the landing page.
    const userId = session.user?.id;
    if (userId) {
      const { data: pa } = await (supabase as any)
        .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (pa) throw redirect({ to: "/admin" as any });
      const { data: roles } = await (supabase as any)
        .from("user_roles").select("role").eq("user_id", userId);
      const isDirector = ((roles as { role: string }[] | null) ?? []).some((r) => r.role === "director");
      throw redirect({ to: (isDirector ? "/dashboard" : "/projects") as any });
    }
    throw redirect({ to: "/projects" as any });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { tr } = useT();
  const logoUrl = useAppLogo("light");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaPending, setMfaPending] = useState<null | { userId: string }>(null);

  async function finishLogin(userId: string) {
    await getStableSession(4, 150);
    const [{ data: pa }, { data: roles }] = await Promise.all([
      (supabase as any).from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      (supabase as any).from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (pa) { navigate({ to: "/admin" as any, replace: true }); return; }
    // Директор аввал дашбордро мебинад.
    const isDirector = ((roles as { role: string }[] | null) ?? []).some((r) => r.role === "director");
    navigate({ to: isDirector ? ("/dashboard" as any) : ("/projects" as any), replace: true });
  }

  async function googleSignIn() {
    try { sessionStorage.setItem("binosoz_google_signup", "1"); } catch {}
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) { toast.error(result.error.message); return; }
    if (result.redirected) return;
    navigate({ to: "/pending" as any, replace: true });
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      rememberSession(data.session);
    }
    // If user has verified MFA factor, next assurance level == aal2 → require code.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      setMfaPending({ userId: data.user.id });
      return;
    }
    toast.success(tr("Добро пожаловать"));
    await finishLogin(data.user.id);
  }




  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {mfaPending && (
        <MfaChallenge
          onSuccess={async () => {
            toast.success(tr("Добро пожаловать"));
            const userId = mfaPending.userId;
            setMfaPending(null);
            await finishLogin(userId);
          }}
          onCancel={() => setMfaPending(null)}
        />
      )}
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle />
      </div>
      <div className="relative hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white overflow-hidden">
            <img src={logoUrl} alt="Binosoz.tj" className="h-full w-full object-contain" />
          </div>
          <span className="font-display text-lg font-semibold">Binosoz.tj</span>
        </div>
        <div className="space-y-4">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            {tr("Платформа для строительных компаний.")}
          </h2>
          <p className="max-w-md text-sm text-sidebar-foreground/70">
            {tr("Каждая компания — отдельный контур. Проекты, продажи, платежи и расходы в одном месте.")}
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/40">© {new Date().getFullYear()} Binosoz.tj</p>
      </div>

      <div className="surface-light flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <img src={logoUrl} alt="Binosoz.tj" className="mb-6 h-16 w-16 object-contain lg:hidden" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">{tr("Вход в систему")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Войдите или отправьте заявку компании.")}</p>


          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="signin">{tr("Вход")}</TabsTrigger>
            </TabsList>


            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tr("Пароль")}</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : tr("Войти")}
                </Button>
              </form>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />{tr("или")}<div className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" className="w-full gap-2" onClick={googleSignIn}>
                <svg viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.6 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {tr("Продолжить работу с Google")}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">{tr("Новая компания получает 14 дней бесплатно")}</p>
            </TabsContent>

          </Tabs>

          <ShowcaseCompanies />
        </div>
      </div>

    </div>
  );
}
