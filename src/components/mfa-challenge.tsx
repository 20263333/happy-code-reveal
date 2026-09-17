import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

/**
 * MFA challenge screen — shown after password login when the user's
 * assurance level needs to be elevated to aal2.
 * onSuccess() is called after supabase.auth.mfa.verify succeeds.
 * onCancel() signs out and returns to login.
 */
export function MfaChallenge({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { tr } = useT();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const verified = (data?.totp ?? []).find((f: any) => f.status === "verified");
      if (!verified) {
        // Shouldn't happen — if AAL requires aal2 but no verified factor.
        onSuccess();
        return;
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: verified.id,
      });
      if (chErr) {
        setError(chErr.message);
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setChallengeId(ch.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setVerifying(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    setVerifying(false);
    if (error) {
      toast.error(tr("Коди нодуруст"));
      // Fresh challenge for next try.
      const { data: ch } = await supabase.auth.mfa.challenge({ factorId });
      if (ch) setChallengeId(ch.id);
      setCode("");
      return;
    }
    onSuccess();
  }

  async function cancel() {
    await supabase.auth.signOut();
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            {tr("Тасдиқи дуқабата")}
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {tr("Коди 6-рақамаро аз Google Authenticator ворид кунед.")}
        </p>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">...</div>
        ) : error ? (
          <div className="space-y-3">
            <div className="text-sm text-destructive">{error}</div>
            <Button variant="outline" className="w-full" onClick={cancel}>
              {tr("Баромадан")}
            </Button>
          </div>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <div className="space-y-1.5">
              <Label>{tr("Код")}</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={verifying || code.length !== 6}
            >
              {verifying ? "..." : tr("Тасдиқ")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={cancel}
            >
              {tr("Баромадан")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
