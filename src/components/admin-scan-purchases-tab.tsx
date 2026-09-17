import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Eye, Clock, ScanLine, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listScanCreditPurchases,
  approveScanCreditPurchase,
  rejectScanCreditPurchase,
  setCompanyScanFreeLimit,
  grantScanCredits,
  getReceiptSignedUrlScan,
} from "@/lib/scan-credits.functions";

export function ScanPurchasesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listScanCreditPurchases);
  const approveFn = useServerFn(approveScanCreditPurchase);
  const rejectFn = useServerFn(rejectScanCreditPurchase);
  const setLimitFn = useServerFn(setCompanyScanFreeLimit);
  const grantFn = useServerFn(grantScanCredits);
  const signFn = useServerFn(getReceiptSignedUrlScan);

  const { data: items = [] } = useQuery({
    queryKey: ["scan-credit-purchases-admin"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Кредитҳои сканер илова шуданд");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectFn({ data: { id, reason } }),
    onSuccess: () => {
      toast.success("Рад шуд");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const setLimit = useMutation({
    mutationFn: ({
      company_id,
      scan_free_limit,
    }: {
      company_id: string;
      scan_free_limit: number;
    }) => setLimitFn({ data: { company_id, scan_free_limit } }),
    onSuccess: () => {
      toast.success("Лимит нав шуд");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const grant = useMutation({
    mutationFn: ({ company_id, amount }: { company_id: string; amount: number }) =>
      grantFn({ data: { company_id, amount } }),
    onSuccess: (r: any) => {
      toast.success(`Бақияи нав: ${r?.new_balance ?? "—"}`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openReceipt = async (path: string) => {
    try {
      const { url } = await signFn({ data: { path } });
      if (url) window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const { data: companies = [] } = useQuery({
    queryKey: ["scan-companies-limits"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("companies")
        .select("id, name, ai_credits(scan_free_limit, scan_free_used, scan_paid_balance)")
        .order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PackagesEditor />

      <section>
        <h3 className="font-display text-lg font-semibold mb-3">Дархостҳои хариди скан</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Дархосте нест.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it: any) => (
              <div
                key={it.id}
                className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-3"
              >
                <ScanLine className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">
                    {it.company?.name ?? "—"} · {it.package_size} скан
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(it.amount).toLocaleString()} сомонӣ ·{" "}
                    {new Date(it.created_at).toLocaleString()}
                  </div>
                  {it.note && <div className="text-xs mt-1">💬 {it.note}</div>}
                </div>
                {it.status === "pending" && (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Дар тафтиш
                  </Badge>
                )}
                {it.status === "approved" && (
                  <Badge>
                    <Check className="h-3 w-3 mr-1" />
                    Қабул
                  </Badge>
                )}
                {it.status === "rejected" && (
                  <Badge variant="destructive">
                    <X className="h-3 w-3 mr-1" />
                    Рад
                  </Badge>
                )}

                {it.receipt_path && (
                  <Button size="sm" variant="outline" onClick={() => openReceipt(it.receipt_path)}>
                    <Eye className="h-4 w-4" /> Чек
                  </Button>
                )}
                {it.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => approve.mutate(it.id)}>
                      <Check className="h-4 w-4" /> Қабул
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const reason = prompt("Сабаби рад (ихтиёрӣ):") ?? "";
                        reject.mutate({ id: it.id, reason });
                      }}
                    >
                      <X className="h-4 w-4" /> Рад
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold mb-3">
          Доступи кредити скан барои ҳар ширкат
        </h3>
        <div className="space-y-2">
          {companies.map((c: any) => {
            const ac = Array.isArray(c.ai_credits) ? c.ai_credits[0] : (c.ai_credits ?? {});
            return (
              <CompanyLimitRow
                key={c.id}
                company={c}
                ac={ac}
                onSave={(fl) => setLimit.mutate({ company_id: c.id, scan_free_limit: fl })}
                onGrant={(n) => grant.mutate({ company_id: c.id, amount: n })}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PackagesEditor() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ size: "200", amount: "80", label: "", is_best: false });
  const { data: pkgs = [] } = useQuery({
    queryKey: ["scan-credit-packages-admin"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("scan_credit_packages")
          .select("*")
          .order("sort_order")
          .order("size")
      ).data ?? [],
  });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("scan_credit_packages").insert({
        size: parseInt(form.size, 10) || 0,
        amount: parseFloat(form.amount) || 0,
        label: form.label || "",
        is_best: form.is_best,
        sort_order: pkgs.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Илова шуд");
      setForm({ size: "200", amount: "80", label: "", is_best: false });
      qc.invalidateQueries({ queryKey: ["scan-credit-packages-admin"], exact: false });
      qc.invalidateQueries({ queryKey: ["scan-credit-packages"], exact: false });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any)
        .from("scan_credit_packages")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scan-credit-packages-admin"], exact: false });
      qc.invalidateQueries({ queryKey: ["scan-credit-packages"], exact: false });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("scan_credit_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scan-credit-packages-admin"], exact: false });
      qc.invalidateQueries({ queryKey: ["scan-credit-packages"], exact: false });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Нархномаи Скан Кредитҳо</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Ин пакетҳо ба соҳибони ширкат ҳангоми харидории кредитҳои сканер намоиш дода мешаванд.
        </p>
      </div>

      <form
        className="grid gap-2 sm:grid-cols-5 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className="text-xs">Ном</label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Миёна"
          />
        </div>
        <div>
          <label className="text-xs">Скан</label>
          <Input
            type="number"
            min={1}
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs">Нарх (сомонӣ)</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_best}
            onChange={(e) => setForm({ ...form, is_best: e.target.checked })}
          />{" "}
          Беҳтарин
        </label>
        <Button type="submit" disabled={create.isPending}>
          Илова
        </Button>
      </form>

      <div className="space-y-2">
        {pkgs.map((p: any) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-sm"
          >
            <div className="flex-1 min-w-[160px]">
              <div className="font-medium">
                {p.label || "—"} {p.is_best && <Badge className="ml-1">Беҳтарин</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.size} скан · {Number(p.amount).toLocaleString()} сомонӣ · ~
                {(Number(p.amount) / Math.max(p.size, 1)).toFixed(2)} сом/скан
              </div>
            </div>
            <Input
              className="w-20"
              type="number"
              defaultValue={p.size}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v && v !== p.size) update.mutate({ id: p.id, patch: { size: v } });
              }}
            />
            <Input
              className="w-24"
              type="number"
              step="0.01"
              defaultValue={p.amount}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v !== Number(p.amount))
                  update.mutate({ id: p.id, patch: { amount: v } });
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => update.mutate({ id: p.id, patch: { is_active: !p.is_active } })}
            >
              {p.is_active ? "Скрыть" : "Показать"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => update.mutate({ id: p.id, patch: { is_best: !p.is_best } })}
            >
              {p.is_best ? "★" : "☆"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm("Удалить?")) del.mutate(p.id);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {pkgs.length === 0 && <p className="text-sm text-muted-foreground">Пакетҳо холӣ.</p>}
      </div>
    </section>
  );
}

function CompanyLimitRow({
  company,
  ac,
  onSave,
  onGrant,
}: {
  company: any;
  ac: any;
  onSave: (n: number) => void;
  onGrant: (n: number) => void;
}) {
  const [val, setVal] = useState(String(ac?.scan_free_limit ?? 50));
  const [grantVal, setGrantVal] = useState("100");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium">{company.name}</div>
        <div className="text-xs text-muted-foreground">
          Истифода: {ac?.scan_free_used ?? 0}/{ac?.scan_free_limit ?? 50} · Харидашуда:{" "}
          {ac?.scan_paid_balance ?? 0}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Лимити ройгон</span>
        <Input
          className="w-20"
          type="number"
          min={0}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={() => onSave(parseInt(val, 10) || 0)}>
          Захира
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Кредит</span>
        <Input
          className="w-20"
          type="number"
          value={grantVal}
          onChange={(e) => setGrantVal(e.target.value)}
        />
        <Button size="sm" onClick={() => onGrant(parseInt(grantVal, 10) || 0)}>
          Илова
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onGrant(-(parseInt(grantVal, 10) || 0))}
        >
          Кам
        </Button>
      </div>
    </div>
  );
}
