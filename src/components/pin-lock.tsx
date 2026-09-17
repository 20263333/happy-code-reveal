import { useEffect, useRef, useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { hashPin, isUnlocked, markUnlocked } from "@/lib/pin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PIN_LEN = 6;

export function PinLock({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { tr } = useT();
  const [pinHash, setPinHash] = useState<string | null | undefined>(undefined); // undefined = loading
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const uid = user?.id ?? null;
  const inputRef = useRef<HTMLInputElement>(null);

  // Load pin_hash whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    if (!uid) { setPinHash(null); setUnlocked(false); return; }
    setUnlocked(isUnlocked(uid));
    (async () => {
      const { data } = await (supabase as any).from("profiles").select("pin_hash").eq("id", uid).maybeSingle();
      if (cancelled) return;
      setPinHash((data?.pin_hash as string | null) ?? null);
    })();
    const onLock = () => setUnlocked(isUnlocked(uid));
    window.addEventListener("binosoz:pin-lock", onLock);
    return () => { cancelled = true; window.removeEventListener("binosoz:pin-lock", onLock); };
  }, [uid]);

  const locked = !!uid && pinHash && !unlocked;

  useEffect(() => { if (locked) setTimeout(() => inputRef.current?.focus(), 50); }, [locked]);

  if (!uid || pinHash === undefined || !locked) return <>{children}</>;

  const submit = async (value: string) => {
    if (value.length !== PIN_LEN || checking) return;
    setChecking(true);
    const h = await hashPin(uid, value);
    setChecking(false);
    if (h === pinHash) {
      markUnlocked(uid);
      setUnlocked(true);
      setInput("");
    } else {
      setInput("");
      toast.error(tr("Нодуруст PIN"));
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-semibold">{tr("Барномаро кушоед")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr("PIN-кодро ворид кунед")}</p>

        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <div key={i} className={`h-3 w-3 rounded-full border ${i < input.length ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
          ))}
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_LEN}
          value={input}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, PIN_LEN);
            setInput(v);
            if (v.length === PIN_LEN) submit(v);
          }}
          className="mt-6 w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono outline-none focus:ring-2 focus:ring-primary"
          disabled={checking}
        />

        <Button
          variant="ghost"
          size="sm"
          className="mt-6 gap-1.5 text-muted-foreground"
          onClick={() => { void signOut(); }}
        >
          <LogOut className="h-3.5 w-3.5" />
          {tr("Баромадан аз аккаунт")}
        </Button>
      </div>
    </div>
  );
}
