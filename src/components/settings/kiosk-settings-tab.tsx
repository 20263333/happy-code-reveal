import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Monitor, Trash2, UserPlus, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  setKioskPin, setKioskEnabled, grantKioskAccess, revokeKioskAccess, getKioskSettings,
} from "@/lib/kiosk.functions";
import { useAuth } from "@/hooks/use-auth";

export function KioskSettingsTab() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const settingsFn = useServerFn(getKioskSettings);
  const setPinFn = useServerFn(setKioskPin);
  const setEnabledFn = useServerFn(setKioskEnabled);
  const grantFn = useServerFn(grantKioskAccess);
  const revokeFn = useServerFn(revokeKioskAccess);

  const [pin, setPin] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["kiosk-settings"],
    queryFn: () => settingsFn(),
  });

  // List of staff to grant access to
  const { data: staff = [] } = useQuery({
    queryKey: ["kiosk-staff-candidates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any).from("profiles")
        .select("id, fullname, phone").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const savePin = useMutation({
    mutationFn: async () => {
      if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN 4-6 рақам бошад");
      await setPinFn({ data: { pin, enabled: true } });
    },
    onSuccess: () => { toast.success("PIN сабт шуд"); setPin(""); qc.invalidateQueries({ queryKey: ["kiosk-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => setEnabledFn({ data: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kiosk-settings"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: async (user_id: string) => grantFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Дастрасӣ дода шуд"); qc.invalidateQueries({ queryKey: ["kiosk-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (user_id: string) => revokeFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Хориҷ шуд"); qc.invalidateQueries({ queryKey: ["kiosk-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const accessUserIds = new Set((settings?.access ?? []).map((a: any) => a.user_id));
  const candidates = staff.filter((s: any) => !accessUserIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold">Kiosk Mode</h3>
            <p className="text-sm text-muted-foreground">
              Экрани сенсорӣ дар офис — клиент бо ёрии соҳиб/менеҷер квартираро интихоб мекунад, 3D-турашро мебинад ва мехарад.
            </p>
          </div>
          <Switch
            checked={!!settings?.enabled}
            onCheckedChange={(v) => toggle.mutate(v)}
            disabled={!settings?.pin_set}
          />
        </div>
        {settings?.enabled && settings.pin_set && (
          <div className="mt-4 space-y-3">
            <Button
              size="lg"
              className="h-12"
              onClick={() => window.open("/kiosk?start=1", "_blank", "noopener")}
            >
              Кушодани Kiosk <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
            {settings.kiosk_token && (
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                <div className="text-sm font-medium">Линки Kiosk барои экрани алоҳида</div>
                <p className="text-xs text-muted-foreground">
                  Ин линкро дар планшет/экрани дигар кушоед — бе логин, танҳо бо PIN.
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/kiosk-screen/${settings.kiosk_token}`}
                    className="text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/kiosk-screen/${settings.kiosk_token}`);
                      toast.success("Линк нусха шуд");
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Нусха
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">PIN-код</h3>
        <p className="text-sm text-muted-foreground">4-6 рақам. Барои даромадан ба Kiosk истифода мешавад.</p>
        <div className="flex gap-2">
          <Input
            type="password" inputMode="numeric" maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={settings?.pin_set ? "PIN сабт шудааст • иваз кардан" : "••••"}
            className="max-w-[180px] text-center text-xl tracking-widest"
          />
          <Button onClick={() => savePin.mutate()} disabled={savePin.isPending || !pin}>
            {settings?.pin_set ? "Иваз" : "Сабт"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Кормандони дастрасидошта</h3>
        <p className="text-sm text-muted-foreground">Шумо ва ин корманд­он метавонанд PIN-и Kiosk-ро истифода баранд.</p>

        {(settings?.access ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Ҳоло касе илова нашудааст (танҳо соҳиб).</p>
        ) : (
          <div className="space-y-2">
            {(settings!.access as any[]).map((a: any) => (
              <div key={a.user_id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-medium">{a.profile?.fullname ?? a.user_id.slice(0, 8)}</div>
                  {a.profile?.phone && <div className="text-xs text-muted-foreground">{a.profile.phone}</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(a.user_id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {candidates.length > 0 && (
          <div className="pt-3 border-t border-border">
            <Label className="text-xs">Илова кардан</Label>
            <div className="mt-2 space-y-1.5">
              {candidates.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-dashed border-border p-2">
                  <div className="text-sm">{s.fullname ?? s.id.slice(0, 8)}</div>
                  <Button size="sm" variant="outline" onClick={() => grant.mutate(s.id)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Илова
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
