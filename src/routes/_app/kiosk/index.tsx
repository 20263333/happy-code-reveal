import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Loader2, MapPin } from "lucide-react";
import { kioskListProjects } from "@/lib/kiosk.functions";

export const Route = createFileRoute("/_app/kiosk/")({
  component: KioskProjectPicker,
});

function KioskProjectPicker() {
  const listFn = useServerFn(kioskListProjects);
  const { data: projects, isLoading } = useQuery({
    queryKey: ["kiosk-projects"],
    queryFn: () => listFn(),
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!projects?.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Building2 className="h-20 w-20 mx-auto mb-4 opacity-30" />
          <p className="text-xl">Проект нест</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Проектро интихоб кунед</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p: any) => (
          <Link
            key={p.id}
            to="/kiosk/$projectId"
            params={{ projectId: p.id }}
            
            className="rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition"
          >
            <Building2 className="h-10 w-10 text-primary mb-3" />
            <div className="text-2xl font-bold">{p.name}</div>
            {p.location && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                <MapPin className="h-4 w-4" />{p.location}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
