import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KioskProjectView } from "@/components/kiosk/kiosk-project-view";

export const Route = createFileRoute("/_app/kiosk/$projectId")({
  component: KioskProjectRoute,
});

function KioskProjectRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  return <KioskProjectView projectId={projectId} onBack={() => navigate({ to: "/kiosk" })} />;
}
