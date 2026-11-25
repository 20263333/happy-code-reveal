import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KioskProjectView } from "@/components/kiosk/kiosk-project-view";

export const Route = createFileRoute("/_app/kiosk/$projectId")({
  head: () => ({ meta: [
    { title: "Лоиҳа дар киоск | Binosoz.tj" },
    { name: "description", content: "Хонаҳо, схемаҳо ва экскурсияҳои лоиҳаи интихобшуда дар киоск." },
    { property: "og:title", content: "Лоиҳа дар киоск | Binosoz.tj" },
    { property: "og:description", content: "Хонаҳо, схемаҳо ва экскурсияҳои лоиҳаи интихобшуда дар киоск." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: KioskProjectRoute,
});

function KioskProjectRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  return <KioskProjectView projectId={projectId} onBack={() => navigate({ to: "/kiosk" })} />;
}
