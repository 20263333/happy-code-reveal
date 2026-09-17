import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { submitCompanyRequest } from "@/lib/company.functions";
import { getStableSession, hasSavedSessionData, safeSignOut } from "@/lib/auth-session";
import { Building, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pending")({
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "pending" | "rejected" | "none">("loading");
  const [reason, setReason] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const submit = useServerFn(submitCompanyRequest);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function load() {
    const session = await getStableSession();
    if (!session) {
      if (hasSavedSessionData()) { window.setTimeout(load, 600); return; }
      navigate({ to: "/auth" });
      return;
    }
    setEmail(session.user.email ?? "");
    const meta: any = session.user.user_metadata ?? {};
    const metaName = meta.fullname || meta.full_name || meta.name || (session.user.email ?? "").split("@")[0] || "";
    const metaPhone = meta.phone || "";
    const { data: prof } = await (supabase as any).from("profiles")
      .select("fullname, phone, company_id").eq("id", session.user.id).maybeSingle();
    if (prof?.company_id) { navigate({ to: "/" }); return; }
    setFullname(prof?.fullname || metaName);
    setPhone(prof?.phone || metaPhone);

    const { data } = await (supabase as any).from("company_requests")
      .select("status, rejection_reason")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    if (!data) setStatus("none");
    else if (data.status === "approved") navigate({ to: "/" });
    else if (data.status === "rejected") { setStatus("rejected"); setReason(data.rejection_reason); }
    else setStatus("pending");
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submit({ data: { email, company_name: companyName, fullname, phone: phone || null, password } });
      toast.success("Дархост фиристода шуд");
      setCooldown(60);
      setStatus("pending");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  }

  const showForm = status === "none" || status === "rejected" || cooldown > 0;
  const formLocked = submitting || cooldown > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {status === "rejected" ? <XCircle className="h-7 w-7" /> : status === "none" ? <Building className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </div>
          <h1 className="mt-5 font-display text-xl font-semibold">
            {status === "loading" && "..."}
            {status === "pending" && "Дархости шумо дар коркард"}
            {status === "rejected" && "Дархост рад шуд"}
            {status === "none" && "Дархости ширкат фиристед"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "pending" && "Super Admin дархости шуморо дида мебарояд."}
            {status === "rejected" && (reason || "Мутаассифона, дархост рад карда шуд. Метавонед аз нав фиристед.")}
            {status === "none" && "Барои дастрасӣ ба система маълумоти ширкатро ворид кунед."}
          </p>
        </div>

        {showForm && (
          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} disabled readOnly />
            </div>
            <div className="space-y-1">
              <Label>Номи ширкат</Label>
              <Input required value={companyName} disabled={formLocked} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ному насаб</Label>
              <Input required value={fullname} disabled={formLocked} onChange={(e) => setFullname(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Телефон</Label>
              <Input value={phone} disabled={formLocked} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Пароль</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                disabled={formLocked}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || cooldown > 0}>
              {submitting ? "..." : cooldown > 0 ? `Интизор шавед ${cooldown}с` : "Отправить заявку"}
            </Button>
            {cooldown > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                Тугмаи фиристодан баъд аз {cooldown} сония дастрас мешавад
              </p>
            )}
          </form>
        )}

        <Button variant="outline" className="mt-4 w-full" onClick={async () => { await safeSignOut(); navigate({ to: "/auth" }); }}>
          Баромадан
        </Button>
      </div>
    </div>
  );
}
