import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePrefs } from "@/lib/preferences";
import { useT } from "@/lib/i18n";

type Row = {
  id: string;
  project_id: string | null;
  full_price: number | string;
  paid_amount: number | string;
  installment_months: number | null;
  customers: { fullname: string | null; phone: string | null } | null;
};

// Карточкаи «Пардохти ипотека (рассрочка)» — чанд муштарӣ ҳоло моҳона пул месупорад
// ва ҳамагӣ чӣ қадар маблағ боқӣ мондааст.
export function MortgageCard({
  companyId,
  projectIds,
}: {
  companyId: string | null | undefined;
  projectIds: Set<string> | null;
}) {
  const { formatMoney } = usePrefs();
  const { tr } = useT();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-mortgage", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, project_id, full_price, paid_amount, installment_months, customers(fullname, phone)")
        .eq("company_id", companyId!)
        .eq("status", "active")
        .gt("installment_months", 0)
        .limit(5000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const items = useMemo(() => {
    return rows
      .filter((r) => (projectIds ? !!r.project_id && projectIds.has(r.project_id) : true))
      .map((r) => ({
        id: r.id,
        name: r.customers?.fullname ?? tr("Номаълум"),
        phone: r.customers?.phone ?? null,
        months: r.installment_months ?? 0,
        left: Math.max(Number(r.full_price || 0) - Number(r.paid_amount || 0), 0),
      }))
      .sort((a, b) => b.left - a.left);
  }, [rows, projectIds, tr]);

  const debtors = items.filter((r) => r.left > 0.01);
  const paidOff = items.filter((r) => r.left <= 0.01);
  const total = debtors.reduce((s, r) => s + r.left, 0);

  return (
    <>
      <button type="button" className="w-full text-left" onClick={() => setOpen(true)}>
        <StatCard
          label={tr("Пардохти ипотека (рассрочка)")}
          value={isLoading ? "…" : formatMoney(total)}
          icon={Landmark}
          accent="accent"
          trend={paidOff.length > 0
            ? `${debtors.length} ${tr("қарздор")} · ${paidOff.length} ${tr("пардохт кард")}`
            : `${tr("аз")} ${items.length} ${tr("муштарӣ")}`}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("Муштариёни ипотека (рассрочка)")}</DialogTitle>
          </DialogHeader>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("Маълумот нест")}</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.months} {tr("моҳ")}{it.phone ? ` · ${it.phone}` : ""}
                    </div>
                  </div>
                  {it.left <= 0.01 ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
                      ✓ {tr("пардохт кард")}
                    </span>
                  ) : (
                    <span className="tabular-nums font-medium">{formatMoney(it.left)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
