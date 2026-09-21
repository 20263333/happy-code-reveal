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
            </TabsContent>

          </Tabs>

          <ShowcaseCompanies />
        </div>
      </div>

    </div>
  );
}
