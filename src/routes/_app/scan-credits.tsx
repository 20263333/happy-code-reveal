import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ScanCreditsPanel } from "@/components/scan-credits-panel";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_app/scan-credits")({
  head: () => ({ meta: [{ title: "Скан Кредитҳо — Binosoz.tj" }] }),
  component: ScanCreditsPage,
});

function ScanCreditsPage() {
  const { tr } = useT();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Скан Кредитҳо"
        subtitle={tr(
          "Пакети сканери паспорт интихоб кунед, ба картаи Super Admin пардохт кунед ва чекро бор кунед.",
        )}
      />
      <ScanCreditsPanel />
    </div>
  );
}
