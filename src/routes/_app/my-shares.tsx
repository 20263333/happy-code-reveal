import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, TrendingUp, Building2, Percent, DollarSign } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader, StatCard, EmptyState } from "@/components/page-header";
import { usePrefs } from "@/lib/preferences";
import { getPartnerSummary, listPartnerPayouts, listPartnerDistributions } from "@/lib/distribution.functions";
import { formatDate } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useUsdRate, formatWithUsd } from "@/lib/use-usd-rate";
import { SalesTeamPanel } from "@/components/sales-team-panel";

export const Route = createFileRoute("/_app/my-shares")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ҳиссаи ман — BINO SOZ" },
      { name: "description", content: "Дашборди директор: даромад, пардохт ва ҳисса аз лоиҳаҳо" },
    ],
  }),
  component: MySharesPage,
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function MySharesPage() {
  const { user, isDirector, isOwner } = useAuth();
  const { formatMoney } = usePrefs();
  const usdRate = useUsdRate();
  const summaryFn = useServerFn(getPartnerSummary);
  const payFn = useServerFn(listPartnerPayouts);
  const distFn = useServerFn(listPartnerDistributions);

  const { data: sum } = useQuery({
    queryKey: ["my-shares-summary", user?.id],
    queryFn: () => summaryFn({ data: {} }),
    enabled: !!user?.id && (isDirector || isOwner),
  });
  const { data: payData } = useQuery({
    queryKey: ["my-shares-payouts", user?.id],
    queryFn: () => payFn({ data: { director_user_id: user!.id } }),
    enabled: !!user?.id,
  });
  const { data: distData } = useQuery({
    queryKey: ["my-shares-dist", user?.id],
    queryFn: () => distFn({ data: { director_user_id: user!.id } }),
    enabled: !!user?.id,
  });

  const shares: any[] = sum?.shares ?? [];
  const payouts: any[] = payData?.payouts ?? [];
  const dist: any[] = distData?.distributions ?? [];
  const monthly: { month: string; amount: number }[] = sum?.monthly ?? [];

  // Per-project aggregates
  const perProject = useMemo(() => {
    const map = new Map<string, { project_id: string; name: string; percent: number; earned: number; paid: number }>();
    for (const s of shares) {
      map.set(s.project_id, {
        project_id: s.project_id,
        name: s.projects?.name ?? "—",
        percent: Number(s.percent || 0),
        earned: 0,
        paid: 0,
      });
    }
    for (const d of dist) {
      const row = map.get(d.project_id);
      if (row) row.earned += Number(d.amount || 0);
    }
    for (const p of payouts) {
      const row = map.get(p.project_id);
      if (row) row.paid += Number(p.amount || 0);
    }
    return Array.from(map.values()).map((r) => ({ ...r, balance: r.earned - r.paid }));
  }, [shares, dist, payouts]);

  const monthlyPretty = monthly.map((m) => ({ ...m, label: m.month.slice(2).replace("-", "/") }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ҳиссаи ман"
        subtitle="Дашборди директор: даромад ва пардохт аз лоиҳаҳое, ки шумо шарик ҳастед"
        actions={
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">Курси USD (БМТ):</span>
            <b>{usdRate ? `${usdRate.toFixed(4)} сомонӣ` : "—"}</b>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ба ман рост омад" value={formatWithUsd(sum?.earned ?? 0, formatMoney, usdRate)} icon={TrendingUp} accent="success" />
        <StatCard label="Гирифтам" value={formatWithUsd(sum?.paid ?? 0, formatMoney, usdRate)} icon={Wallet} />
        <StatCard label="Қарзи ҷорӣ" value={formatWithUsd(sum?.balance ?? 0, formatMoney, usdRate)} icon={Wallet} accent={(sum?.balance ?? 0) > 0 ? "warning" : undefined} />
        <StatCard label="Лоиҳаҳо" value={String(shares.length)} icon={Building2} />
      </div>

      <SalesTeamPanel />

      {shares.length === 0 ? (
        <EmptyState icon={Building2} title="Ҳанӯз ҳисса нест" description="Соҳиби ширкат шуморо ҳамчун шарик илова накардааст." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" /> Даромад аз рӯи моҳҳо
              </h3>
              {monthlyPretty.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Ҳанӯз маълумот нест</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPretty}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}к` : String(v))} />
                      <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" /> Тақсими даромад аз рӯи лоиҳа
              </h3>
              {perProject.filter((p) => p.earned > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Ҳанӯз даромад нест</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={perProject.filter((p) => p.earned > 0)}
                        dataKey="earned" nameKey="name"
                        innerRadius={40} outerRadius={80} paddingAngle={2}
                      >
                        {perProject.filter((p) => p.earned > 0).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold mb-3">Лоиҳаҳо ва ҳиссаҳо</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-3">Лоиҳа</th>
                    <th className="py-2 pr-3">Фоиз</th>
                    <th className="py-2 pr-3">Ба ман рост омад</th>
                    <th className="py-2 pr-3">Гирифтам</th>
                    <th className="py-2 pr-3">Қарз</th>
                    <th className="py-2 pr-3 text-right">Амал</th>
                  </tr>
                </thead>
                <tbody>
                  {perProject.map((p) => (
                    <tr key={p.project_id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{p.name}</td>
                      <td className="py-2 pr-3">{p.percent}%</td>
                      <td className="py-2 pr-3">{formatMoney(p.earned)}</td>
                      <td className="py-2 pr-3 text-emerald-600">{formatMoney(p.paid)}</td>
                      <td className={`py-2 pr-3 font-semibold ${p.balance > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {formatMoney(p.balance)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Link to="/projects/$id" params={{ id: p.project_id }} className="text-primary hover:underline text-xs">
                          Кушодан
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Ҳисоб (охирин)</h3>
              {dist.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ҳанӯз ҳисоб нест</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {dist.slice(0, 30).map((d: any) => (
                    <div key={d.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(d.created_at)}</span>
                      <span className="font-semibold">{formatMoney(d.amount)} <span className="text-xs text-muted-foreground">({d.percent}%)</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Пардохтҳои гирифташуда</h3>
              {payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ҳанӯз пардохт нест</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(p.paid_date)}</span>
                      <span className="font-semibold text-emerald-600">{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
