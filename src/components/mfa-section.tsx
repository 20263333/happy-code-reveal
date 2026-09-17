import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Shield, Copy, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

export function MfaSection() {
  const { tr } = useT();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState<null | {
    factorId: string;
    qr: string;
    secret: string;
  }>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const verified = factors.find((f) => f.status === "verified");

  async function startEnroll() {
    // Clean up any unverified factors first
    const unverified = factors.filter((f) => f.status !== "verified");
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `BINO SOZ ${new Date().toLocaleDateString()}`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrolling({
      factorId: data.id,
      qr: (data as any).totp.qr_code,
      secret: (data as any).totp.secret,
    });
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setVerifying(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: enrolling.factorId,
    });
    if (chErr) {
      setVerifying(false);
      toast.error(chErr.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    setVerifying(false);
    if (error) {
      toast.error(tr("Коди нодуруст"));
      return;
    }
    toast.success(tr("2FA фаъол шуд"));
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function disableMfa() {
    if (!verified) return;
    if (!confirm(tr("Хомӯш кардани 2FA? Ҳисоби шумо камтар ҳимоя мешавад."))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("2FA хомӯш карда шуд"));
    refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold">
        <ShieldCheck className="h-4 w-4" />
        {tr("Тасдиқи дуқабата (2FA)")}
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        {tr(
          "Барномаи Google Authenticator (ё Microsoft Authenticator / Authy)-ро дар телефон насб кунед.",
        )}
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground">...</div>
      ) : verified ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
              <Shield className="mr-1 h-3 w-3" />
              {tr("Фаъол")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {verified.friendly_name}
            </span>
          </div>
          <Button variant="destructive" size="sm" onClick={disableMfa}>
            {tr("Хомӯш кардани 2FA")}
          </Button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-2 text-sm font-medium">
              {tr("1. QR-кодро бо Google Authenticator скан кунед")}
            </div>
            <div className="flex justify-center rounded-md bg-white p-3">
              {/* qr_code is an SVG data URI */}
              <img src={enrolling.qr} alt="QR" className="h-48 w-48" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {tr("Ё ин калиди махфиро дастӣ ворид кунед:")}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
                {enrolling.secret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(enrolling.secret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <form onSubmit={verifyEnroll} className="space-y-2">
            <Label>{tr("2. Коди 6-рақамаро аз барнома ворид кунед")}</Label>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={verifying || code.length !== 6}>
                {verifying ? "..." : tr("Тасдиқ ва фаъолсозӣ")}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEnroll}>
                {tr("Бекор")}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{tr("Хомӯш")}</Badge>
          </div>
          <Button onClick={startEnroll}>{tr("Фаъол кардани 2FA")}</Button>
        </div>
      )}
    </div>
  );
}
