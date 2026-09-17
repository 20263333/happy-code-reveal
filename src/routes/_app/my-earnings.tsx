import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Wallet, Percent } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/page-header";
import { myTeamEarnings } from "@/lib/sales-team.functions";
import { usePrefs } from "@/lib/preferences";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_app/my-earnings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Даромади ман — PLATFORM.TJ" },
      { name: "description", content: "Дашборди менеҷер: даромад, пардохт ва бақияи маблағ" },
      { property: "og:title", content: "Даромади ман — PLATFORM.TJ" },
      { property: "og:description", content: "Дашборди менеҷери фурӯш: даромад ва бақия" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyEarningsPage,
});

function MyEarningsPage() {
  const { formatMoney } = usePrefs();
  const fn = useServerFn(myTeamEarnings);
  const { data } = useQuery({ queryKey: ["my-team-earnings"], queryFn: () => fn({}) });

  if (data && !data.member) {
    return (
      <div className="space-y-6">
        <PageHeader title="Даромади ман" subtitle="Дашборди менеҷер" />
        <EmptyState icon={Wallet} title="Маълумот нест" description="Шумо ҳанӯз ба дастаи фурӯш илова нашудаед." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Даромади ман" subtitle={data?.member?.fullname ?? ""} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Кор кардам" value={formatMoney(data?.earned ?? 0)} icon={TrendingUp} accent="success" />
        <StatCard label="Гирифтам" value={formatMoney(data?.paid ?? 0)} icon={Wallet} />
        <StatCard
          label="Бақияи сумма"
          value={formatMoney(data?.balance ?? 0)}
          icon={Wallet}
          accent={(data?.balance ?? 0) > 0 ? "warning" : undefined}
        />
        <StatCard label="Фоиз" value={`${Number(data?.member?.percent ?? 0)}%`} icon={Percent} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Таърихи пардохтҳо</h3>
        {(data?.payouts?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Ҳанӯз пардохт нест</p>
        ) : (
          <div className="space-y-1 text-sm">
            {data!.payouts.map((p: any) => (
              <div key={p.id} className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">{formatDate(p.paid_at)}{p.note ? ` — ${p.note}` : ""}</span>
                <span className="font-semibold">{formatMoney(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
