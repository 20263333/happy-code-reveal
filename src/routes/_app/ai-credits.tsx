import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { AiCreditsPanel } from "@/components/ai-credits-panel";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_app/ai-credits")({
  head: () => ({ meta: [
    { title: "Кредитҳои AI | Binosoz.tj" },
    { name: "description", content: "Кредитҳо ва пардохтҳои ёрдамчии AI ва сканерҳои ширкат." },
    { property: "og:title", content: "Кредитҳои AI | Binosoz.tj" },
    { property: "og:description", content: "Кредитҳо ва пардохтҳои ёрдамчии AI ва сканерҳои ширкат." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
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
