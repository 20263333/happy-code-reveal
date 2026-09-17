import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, BellRing, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { materialUnitLabel, formatDate } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { checkLowStock } from "@/lib/supply.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/supply")({
  head: () => ({
    meta: [
      { title: "Снабженец — Binosoz.tj" },
      { name: "description", content: "Назорати захираи камшудаи склад ва огоҳии снабженец." },
      { property: "og:title", content: "Снабженец — Binosoz.tj" },
      { property: "og:description", content: "Захираи камшудаи склад ва огоҳиҳо." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplyPage,
});

function SupplyPage() {
  const { tr } = useT();
  const { companyId } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["supply-items", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("warehouse_items")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["supply-alerts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("supply_alerts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  const low = items.filter((i: any) => Number(i.quantity ?? 0) < Number(i.min_quantity ?? 10));

  const setMin = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await (supabase as any)
        .from("warehouse_items")
        .update({ min_quantity: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply-items", companyId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const runCheck = useMutation({
    mutationFn: async () => await checkLowStock(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["supply-alerts", companyId] });
      if (r.smsError) toast.warning(r.smsError);
      else if (r.smsSent) toast.success(tr("СМС фиристода шуд") + `: ${r.smsSent}`);
      else toast.success(tr("Санҷиш анҷом ёфт") + ` — ${r.low.length}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("supply_alerts")
        .update({ resolved: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply-alerts", companyId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={tr("Снабженец")}
        subtitle={tr("Маводҳое, ки дар склад кам мондаанд ва огоҳиҳо.")}
        actions={
          <Button onClick={() => runCheck.mutate()} disabled={runCheck.isPending}>
            <BellRing className="mr-2 h-4 w-4" />
            {tr("Санҷиш ва огоҳӣ")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={tr("Позиций материалов")} value={items.length} icon={Boxes} />
        <StatCard
          label={tr("Кам мондааст")}
          value={low.length}
          icon={AlertTriangle}
          accent="destructive"
        />
        <StatCard
          label={tr("Огоҳиҳои кушода")}
          value={alerts.filter((a: any) => !a.resolved).length}
          icon={BellRing}
          accent="accent"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{tr("Захираи кам")}</h2>
        {low.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={tr("Ҳама чиз хуб аст")}
            description={tr("Ҳоло ягон мавод аз ҳадди ақал кам нест.")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">{tr("Наименование товара")}</th>
                  <th className="px-4 py-2.5 text-left">{tr("Ед.изм")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Количество")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Ҳадди ақал")}</th>
                </tr>
              </thead>
              <tbody>
                {low.map((i: any) => (
                  <tr key={i.id} className="low-stock-row border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{i.name}</td>
                    <td className="px-4 py-2.5">{materialUnitLabel(i.unit)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-destructive">
                      {Number(i.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Input
                        type="number"
                        className="ml-auto h-8 w-24 text-right"
                        defaultValue={Number(i.min_quantity ?? 10)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v !== Number(i.min_quantity ?? 10))
                            setMin.mutate({ id: i.id, value: v });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{tr("Огоҳиҳо")}</h2>
        {alerts.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title={tr("Огоҳӣ нест")}
            description={tr("Ҳангоми кам шудани мавод дар инҷо огоҳӣ пайдо мешавад.")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">{tr("Дата")}</th>
                  <th className="px-4 py-2.5 text-left">{tr("Наименование товара")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Количество")}</th>
                  <th className="px-4 py-2.5 text-left">{tr("СМС")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a: any) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-2.5 font-medium">{a.item_name}</td>
                    <td className="px-4 py-2.5 text-right">
                      {Number(a.quantity).toLocaleString()} / {Number(a.threshold).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {a.sms_status ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {a.resolved ? (
                        <Badge variant="outline">{tr("Ҳал шуд")}</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => resolveAlert.mutate(a.id)}>
                          <Check className="mr-1 h-4 w-4" />
                          {tr("Ҳал шуд")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
