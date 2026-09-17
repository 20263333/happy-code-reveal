import { useEffect, useState } from "react";
import { KeyRound, Lock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { hashPin, lockNow } from "@/lib/pin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PIN_LEN = 6;

export function PinCodeSection() {
  const { user } = useAuth();
  const { tr } = useT();
  const [hasPin, setHasPin] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("profiles").select("pin_hash").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => setHasPin(!!data?.pin_hash));
  }, [user]);

  const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, PIN_LEN);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (next.length !== PIN_LEN) { toast.error(tr("PIN бояд 6 рақама бошад")); return; }
    if (next !== confirm) { toast.error(tr("PIN-ҳо мувофиқат намекунанд")); return; }

    if (hasPin) {
      if (current.length !== PIN_LEN) { toast.error(tr("PIN-и ҳозираро ворид кунед")); return; }
      const { data } = await (supabase as any).from("profiles").select("pin_hash").eq("id", user.id).maybeSingle();
      const curHash = await hashPin(user.id, current);
      if (curHash !== data?.pin_hash) { toast.error(tr("PIN-и ҳозира нодуруст аст")); return; }
    }

    setSaving(true);
    const h = await hashPin(user.id, next);
    const { error } = await supabase.from("profiles").update({ pin_hash: h } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(tr("PIN сабт шуд"));
    setHasPin(true);
    setCurrent(""); setNext(""); setConfirm("");
  };

  const remove = async () => {
    if (!user) return;
    if (!window.confirm(tr("PIN-кодро тоза кунем?"))) return;
    if (hasPin) {
      const cur = window.prompt(tr("PIN-и ҳозираро ворид кунед:")) ?? "";
      if (cur.length !== PIN_LEN) return;
      const { data } = await (supabase as any).from("profiles").select("pin_hash").eq("id", user.id).maybeSingle();
      const curHash = await hashPin(user.id, cur);
      if (curHash !== data?.pin_hash) { toast.error(tr("PIN-и ҳозира нодуруст аст")); return; }
    }
    const { error } = await supabase.from("profiles").update({ pin_hash: null } as any).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr("PIN тоза шуд"));
    setHasPin(false);
    setCurrent(""); setNext(""); setConfirm("");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-1">
        <KeyRound className="h-4 w-4" />{tr("PIN-код")}
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        {tr("6-рақама PIN. Ҳангоми қулф кардани барнома барои дубора кушодан пурсида мешавад.")}
      </p>
      <form className="space-y-3" onSubmit={save}>
        {hasPin && (
          <div className="space-y-1.5">
            <Label>{tr("PIN-и ҳозира")}</Label>
            <Input type="password" inputMode="numeric" value={current} onChange={(e) => setCurrent(onlyDigits(e.target.value))} maxLength={PIN_LEN} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{hasPin ? tr("PIN-и нав") : tr("PIN-и нав (6 рақама)")}</Label>
          <Input type="password" inputMode="numeric" value={next} onChange={(e) => setNext(onlyDigits(e.target.value))} maxLength={PIN_LEN} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Такрори PIN")}</Label>
          <Input type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(onlyDigits(e.target.value))} maxLength={PIN_LEN} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>{hasPin ? tr("Иваз кардан") : tr("Гузоштани PIN")}</Button>
          {hasPin && (
            <>
              <Button type="button" variant="outline" onClick={() => lockNow()} className="gap-1.5">
                <Lock className="h-3.5 w-3.5" />{tr("Қулф кардани барнома")}
              </Button>
              <Button type="button" variant="ghost" onClick={remove} className="gap-1.5 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />{tr("Тоза кардани PIN")}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
