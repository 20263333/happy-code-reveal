import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxSide = 1200, quality = 0.82): Promise<string> {
  const url = await fileToDataUrl(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, w, h);
      const isPng = file.type === "image/png";
      resolve(c.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : quality));
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = url;
  });
}

export function ReceiptSettingsSection({ companyId }: { companyId: string }) {
  const { tr } = useT();
  const qc = useQueryClient();
  const [bg, setBg] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [inn, setInn] = useState("");
  const [address, setAddress] = useState("");
  const [signer, setSigner] = useState("");
  const [saving, setSaving] = useState(false);
  const bgInput = useRef<HTMLInputElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["company-receipt", companyId],
    queryFn: async () =>
      (await (supabase as any)
        .from("companies")
        .select("receipt_bg, receipt_stamp, receipt_inn, receipt_address, receipt_signer")
        .eq("id", companyId)
        .maybeSingle()).data,
  });

  useEffect(() => {
    if (data) {
      setBg(data.receipt_bg ?? null);
      setStamp(data.receipt_stamp ?? null);
      setInn(data.receipt_inn ?? "");
      setAddress(data.receipt_address ?? "");
      setSigner(data.receipt_signer ?? "");
    }
  }, [data]);

  const pick = async (kind: "bg" | "stamp", f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error(tr("Танҳо расм")); return; }
    try {
      const url = await compressImage(f, kind === "bg" ? 1400 : 500, 0.85);
      if (url.length > 900_000) { toast.error(tr("Расм хеле бузург аст")); return; }
      if (kind === "bg") setBg(url); else setStamp(url);
    } catch {
      toast.error(tr("Хатогӣ ҳангоми хондани расм"));
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("companies").update({
      receipt_bg: bg,
      receipt_stamp: stamp,
      receipt_inn: inn.trim() || null,
      receipt_address: address.trim() || null,
      receipt_signer: signer.trim() || null,
    }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(tr("Нигоҳ дошта шуд"));
      qc.invalidateQueries({ queryKey: ["company-receipt", companyId] });
      qc.invalidateQueries({ queryKey: ["company-receipt-template"] });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-1">
        <Receipt className="h-4 w-4" />{tr("Шаблони чек / квитанция")}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {tr("Расми чеки худро уплод кунед — маълумоти клиент худкор пур мешавад ҳангоми чоп.")}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{tr("Расми чек (замина)")}</Label>
          <input ref={bgInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => pick("bg", e.target.files?.[0])} />
          {bg ? (
            <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
              <img src={bg} alt="bg" className="w-full h-40 object-contain" />
              <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-7 px-2"
                onClick={() => setBg(null)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => bgInput.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />{tr("Уплод кардан")}
            </Button>
          )}
          {bg && <Button variant="outline" size="sm" onClick={() => bgInput.current?.click()}>{tr("Иваз кардан")}</Button>}
        </div>

        <div className="space-y-2">
          <Label>{tr("Мӯҳр / имзо (PNG)")}</Label>
          <input ref={stampInput} type="file" accept="image/png,image/*" className="hidden"
            onChange={(e) => pick("stamp", e.target.files?.[0])} />
          {stamp ? (
            <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
              <img src={stamp} alt="stamp" className="w-full h-40 object-contain" />
              <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-7 px-2"
                onClick={() => setStamp(null)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => stampInput.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />{tr("Уплод кардан")}
            </Button>
          )}
          {stamp && <Button variant="outline" size="sm" onClick={() => stampInput.current?.click()}>{tr("Иваз кардан")}</Button>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{tr("ИНН/РМА")}</Label>
          <Input value={inn} onChange={(e) => setInn(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tr("Ном ва насаби имзогузор")}</Label>
          <Input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={tr("Директор: Ф.И.О.")} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>{tr("Суроға")}</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <div className="mt-5">
        <Button onClick={save} disabled={saving}>{tr("Нигоҳ доштан")}</Button>
      </div>
    </div>
  );
}
