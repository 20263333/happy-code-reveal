import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Upload, Loader2, Check, Clock, X, CreditCard, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { requestCreditPurchase } from "@/lib/ai-credits.functions";
import { getAiCredits } from "@/lib/ai-chat.functions";

const FALLBACK_PACKAGES = [
  { size: 30, amount: 15, label: "Хурд", is_best: false },
  { size: 100, amount: 40, label: "Миёна", is_best: true },
  { size: 500, amount: 150, label: "Калон", is_best: false },
];

const PROVIDER_LABELS: Record<string, string> = {
  dc: "Dushanbe City",
  alif: "Alif Bank",
  eskhata: "Eskhata Online",
};

export function AiCreditsPanel() {
  const { user, companyId, isOwner } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const creditsFn = useServerFn(getAiCredits);
  const requestFn = useServerFn(requestCreditPurchase);

  const { data: credits } = useQuery({
    queryKey: ["ai-credits"],
    queryFn: () => creditsFn(),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["ai-credit-purchases", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ai_credit_purchases")
        .select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { listActivePaymentMethods } = await import("@/lib/payment-methods.functions");
      return await listActivePaymentMethods();
    },
  });

  const { data: dbPackages = [] } = useQuery({
    queryKey: ["ai-credit-packages"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ai_credit_packages")
        .select("size, amount, label, is_best")
        .eq("is_active", true)
        .order("sort_order").order("size");
      return data ?? [];
    },
  });

  const PACKAGES = (dbPackages.length > 0 ? dbPackages : FALLBACK_PACKAGES) as Array<{ size: number; amount: number; label: string; is_best?: boolean }>;
  const pkg = PACKAGES[Math.min(selected, PACKAGES.length - 1)] ?? FALLBACK_PACKAGES[1];

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !companyId) throw new Error("Auth");
      let receipt_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${companyId}/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("subscription-receipts")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        receipt_path = path;
      }
      await requestFn({ data: {
        package_size: pkg.size, amount: pkg.amount,
        receipt_path, note: note || null,
      }});
    },
    onSuccess: () => {
      toast.success("Дархост фиристода шуд. Пас аз тасдиқ кредитҳо илова мешаванд.");
      setFile(null); setNote("");
      qc.invalidateQueries({ queryKey: ["ai-credit-purchases"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Хатогӣ"),
  });

  const handleSubmit = async () => {
    if (!isOwner) { toast.error("Танҳо соҳиби ширкат"); return; }
    if (!file) { toast.error("Чекро бор кунед"); return; }
    setSubmitting(true);
    try { await submit.mutateAsync(); } finally { setSubmitting(false); }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Нусха шуд");
    } catch {
      toast.error("Нусха кардан нашуд");
    }
  };

  const freeLeft = credits ? Math.max(0, credits.free_limit - credits.free_used) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Balance */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">AI Ёрдамчӣ — кредитҳо</div>
            <div className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{freeLeft}</span> ройгон боқӣ ·{" "}
              <span className="font-medium text-foreground">{credits?.paid_balance ?? 0}</span> харидашуда
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{freeLeft + (credits?.paid_balance ?? 0)}</div>
            <div className="text-xs text-muted-foreground">умумӣ</div>
          </div>
        </div>
      </div>

      {/* Packages */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Пакети харидорӣ</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PACKAGES.map((p, i) => {
            const isSel = i === selected;
            return (
              <button key={i} type="button" onClick={() => setSelected(i)}
                className={`relative text-left rounded-xl border p-4 transition ${
                  isSel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"
                }`}>
                {p.is_best && (
                  <Badge className="absolute -top-2 right-3">Беҳтарин</Badge>
                )}
                <div className="text-xs text-muted-foreground">{p.label}</div>
                <div className="mt-1 text-3xl font-bold">{p.size}</div>
                <div className="text-xs text-muted-foreground">дархост</div>
                <div className="mt-3 text-xl font-semibold">{p.amount} сомонӣ</div>
                <div className="text-xs text-muted-foreground">
                  ~{(p.amount / p.size).toFixed(2)} сом/дархост
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Instructions */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Тарзи харидорӣ</h3>
        <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
          <li>Маблағи <strong className="text-foreground">{pkg.amount} сомонӣ</strong> ба картаи Super Admin гузаронед</li>
          <li>Аз пардохт скриншот/чек гиред</li>
          <li>Чекро дар зер бор кунед ва "Дархост фиристодан"-ро зер кунед</li>
          <li>Super Admin тасдиқ мекунад ва кредитҳо ба ҳисоби шумо илова мешаванд (одатан то 30 дақиқа)</li>
        </ol>

        {methods.length > 0 ? (
          <div className="space-y-2">
            <Label>Рақамҳои Super Admin барои пардохт</Label>
            {methods.map((m: any) => (
              <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/60 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {PROVIDER_LABELS[m.provider] ?? m.provider}
                    {m.label && <span className="text-xs font-normal text-muted-foreground">· {m.label}</span>}
                  </div>
                  <div className="mt-1 font-mono text-base tracking-wider">{m.card_number}</div>
                  {m.holder_name && <div className="text-xs text-muted-foreground">Қабулкунанда: {m.holder_name}</div>}
                  {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(m.card_number)}>
                  <Copy className="h-4 w-4" /> Нусха
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Рақамҳои пардохт ҳоло намоиш дода нашуданд. Super Admin бояд усули пардохтро фаъол кунад.
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Чек об пардохт (jpg/png/pdf)</Label>
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-1.5">
          <Label>Эзоҳ (ихтиёрӣ)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
        <Button onClick={handleSubmit} disabled={submitting || !file}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Дархост фиристодан ({pkg.size} дархост барои {pkg.amount} сомонӣ)
        </Button>
      </section>

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Таърихи дархостҳо</h2>
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-medium">{h.package_size} дархост · {Number(h.amount).toLocaleString()} сомонӣ</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                  {h.rejection_reason && <div className="text-xs text-destructive mt-1">Сабаб: {h.rejection_reason}</div>}
                </div>
                {h.status === "pending" && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Дар тафтиш</Badge>}
                {h.status === "approved" && <Badge><Check className="h-3 w-3 mr-1" />Қабул шуд</Badge>}
                {h.status === "rejected" && <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Рад шуд</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
