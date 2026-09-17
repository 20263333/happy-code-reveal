import { useRef, useState } from "react";
import { Camera, Loader2, ScanLine, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { extractContract, type ContractExtractResult } from "@/lib/contract.functions";
import { toast } from "sonner";
import { compressImageFile } from "@/lib/image-compress";

type Props = {
  onExtracted?: (data: ContractExtractResult) => void;
};

export function ContractCapture({ onExtracted }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractContract);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).slice(0, 8 - files.length);
    setFiles((f) => [...f, ...next]);
    setUrls((u) => [...u, ...next.map((f) => URL.createObjectURL(f))]);
  };

  const removeAt = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setUrls((u) => u.filter((_, idx) => idx !== i));
  };

  const scan = async () => {
    if (!files.length) {
      toast.error("Сначала добавьте хотя бы одну страницу договора");
      return;
    }
    setLoading(true);
    try {
      const pages = await Promise.all(files.map((f) => compressImageFile(f)));
      const data = await extract({ data: { pages } });
      onExtracted?.(data);
      toast.success("Договор распознан — проверьте поля");
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось распознать договор");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">📷 Сканировать договор (бумажный)</Label>
        {files.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setFiles([]); setUrls([]); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Сфотографируйте все страницы (до 8). AI распознает текст и заполнит поля шаблона ниже.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {urls.map((u, i) => (
          <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-background">
            <img src={u} alt={`page-${i}`} className="absolute inset-0 h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
              {i + 1}
            </div>
          </div>
        ))}
        {files.length < 8 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background text-muted-foreground transition hover:bg-muted"
          >
            {files.length === 0 ? <Camera className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            <span className="text-xs">{files.length === 0 ? "Сурат" : "Илова"}</span>
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />

      <Button type="button" size="sm" className="w-full" onClick={scan} disabled={loading || !files.length}>
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ScanLine className="mr-1.5 h-4 w-4" />}
        {loading ? "Сканирование..." : "Распознать и заполнить"}
      </Button>
    </div>
  );
}
