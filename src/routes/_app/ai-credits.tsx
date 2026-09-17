import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { AiCreditsPanel } from "@/components/ai-credits-panel";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_app/ai-credits")({
  component: AiCreditsPage,
});

function AiCreditsPage() {
  const { tr } = useT();
  return (
    <div className="space-y-6">
      <PageHeader title="AI Кредитҳо" subtitle={tr("Пакет интихоб кунед, ба картаи Super Admin пардохт кунед ва чекро бор кунед.")} />
      <AiCreditsPanel />
    </div>
  );
}
