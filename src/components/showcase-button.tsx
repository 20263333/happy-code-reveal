import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useServerFn } from "@tanstack/react-start";
import { QrCode, Printer, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { setProjectShowcase } from "@/lib/showcase.functions";
import { toast } from "sonner";

export function ShowcaseButton({
  projectId,
  projectName,
  publicShowcase,
  showPrices,
  onChange,
}: {
  projectId: string;
  projectName: string;
  publicShowcase: boolean;
  showPrices: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(!!publicShowcase);
  const [prices, setPrices] = useState(!!showPrices);
  const [copied, setCopied] = useState(false);
  const save = useServerFn(setProjectShowcase);

  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${projectId}` : "";

  useEffect(() => {
    setEnabled(!!publicShowcase);
    setPrices(!!showPrices);
  }, [publicShowcase, showPrices]);

  const toggleShowcase = async (v: boolean) => {
    setEnabled(v);
    try {
      const result = await save({ data: { id: projectId, public_showcase: v } });
      setEnabled(!!result.project.public_showcase);
      setPrices(!!result.project.show_prices);
      toast.success(v ? "Намоиши оммавӣ фаъол шуд" : "Намоиши оммавӣ хомӯш шуд");
      onChange();
    } catch (e: any) {
      setEnabled(!v);
      toast.error(e.message ?? "Хато");
    }
  };

  const togglePrices = async (v: boolean) => {
    setPrices(v);
    try {
      const result = await save({ data: { id: projectId, show_prices: v } });
      setEnabled(!!result.project.public_showcase);
      setPrices(!!result.project.show_prices);
      onChange();
    } catch (e: any) {
      setPrices(!v);
      toast.error(e.message ?? "Хато");
    }
  };

  const copyLink = async () => {
    await ensureEnabled();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Линк нусха шуд");
    setTimeout(() => setCopied(false), 1500);
  };

  const ensureEnabled = async () => {
    if (enabled) return;
    await toggleShowcase(true);
  };

  const printQr = async () => {
    await ensureEnabled();
    const canvas = document.getElementById("showcase-qr") as HTMLCanvasElement | null;
    const img = canvas?.toDataURL("image/png");
    if (!img) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR — ${projectName}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:40px;}
        h1{font-size:26px;margin:0 0 4px;}
        p{color:#555;margin:0 0 24px;font-size:16px;}
        img{width:340px;height:340px;}
        .hint{margin-top:20px;font-size:18px;font-weight:600;}
      </style></head>
      <body>
        <h1>${projectName}</h1>
        <p>Сканер кунед — холати фурӯши хонаҳоро бубинед</p>
        <img src="${img}" />
        <div class="hint">📱 Сканер кунед</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <QrCode className="mr-1.5 h-4 w-4" /> QR-код
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Намоиши оммавӣ (QR-код)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Намоиши оммавӣ</Label>
              <p className="text-xs text-muted-foreground">Одам бе ворид шудан хонаҳоро мебинад</p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleShowcase} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Нархҳоро нишон додан</Label>
              <p className="text-xs text-muted-foreground">Нархи хонаҳои холӣ дар саҳифа</p>
            </div>
            <Switch checked={prices} onCheckedChange={togglePrices} disabled={!enabled} />
          </div>

          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-4">
            <div className="rounded-lg bg-white p-3">
              <QRCodeCanvas id="showcase-qr" value={url || " "} size={200} level="M" marginSize={2} />
            </div>
            {!enabled && (
              <p className="text-center text-xs text-warning-foreground">
                Барои кор кардани саҳифа калиди «Намоиши оммавӣ»-ро фаъол кунед.
              </p>
            )}
            <div className="flex w-full items-center gap-2">
              <input
                readOnly
                value={url}
                className="min-w-0 flex-1 rounded-md border border-border bg-muted px-2 py-1.5 text-xs"
              />
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={printQr}>
              <Printer className="mr-1.5 h-4 w-4" /> Чоп кардан
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
