import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Box, LayoutGrid, Map as MapIcon } from "lucide-react";
import { kioskGetProject, kioskSignedUrl, kioskSaveSchemePins } from "@/lib/kiosk.functions";
import { getProject3dSignedUrl } from "@/lib/facade-3d.functions";
import { ApartmentModal } from "@/components/kiosk/apartment-modal";
import { Facade3dTab } from "@/components/3d/facade-3d-tab";
import { KioskInteractiveScheme, type PinCoord } from "@/components/kiosk/kiosk-interactive-scheme";
import { cn } from "@/lib/utils";
import { fixStorageUrl } from "@/lib/storage-url";

const STATUS_COLOR: Record<string, string> = {
  empty: "bg-emerald-500 hover:bg-emerald-600",
  installment: "bg-blue-500 hover:bg-blue-600",
  sold: "bg-red-500 hover:bg-red-600",
  unavailable: "bg-amber-500 hover:bg-amber-600",
};

export function KioskProjectView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const getFn = useServerFn(kioskGetProject);
  const signFn = useServerFn(getProject3dSignedUrl);
  const kioskSignFn = useServerFn(kioskSignedUrl);
  const savePinsFn = useServerFn(kioskSaveSchemePins);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["kiosk-project", projectId],
    queryFn: () => getFn({ data: { project_id: projectId } }),
  });

  const [blockId, setBlockId] = useState<string | null>(null);
  const [selectedApt, setSelectedApt] = useState<any>(null);
  const [view, setView] = useState<"scheme" | "floors" | "3d">("scheme");

  const activeBlockId = blockId ?? data?.blocks?.[0]?.id ?? null;
  const activeBlock = useMemo(
    () => data?.blocks?.find((b: any) => b.id === activeBlockId) ?? data?.blocks?.[0] ?? null,
    [data, activeBlockId],
  );

  const schemePath = activeBlock?.scheme_image_path || data?.project?.scheme_image_path || null;
  const initialPins = useMemo(
    () => ((activeBlock?.scheme_pins as PinCoord[]) ?? (data?.project?.scheme_pins as PinCoord[]) ?? []),
    [activeBlock, data],
  );

  // If active block has no scheme, and no user preference yet, fall back to floors
  useEffect(() => {
    if (data && !schemePath && view === "scheme") {
      setView("floors");
    }
  }, [data, schemePath]);

  const { data: signed3d } = useQuery({
    queryKey: ["kiosk-3d", activeBlockId],
    queryFn: () => signFn({ data: { project_id: activeBlockId! } }),
    enabled: !!activeBlockId && view === "3d",
  });

  const { data: signedScheme, isFetching: schemeLoading } = useQuery({
    queryKey: ["kiosk-scheme", activeBlockId, schemePath],
    queryFn: async () => {
      if (!schemePath) return null;
      try {
        const res = await kioskSignFn({ data: { bucket: "project-3d-models", path: schemePath } });
        return res;
      } catch {
        return null;
      }
    },
    enabled: !!schemePath,
  });

  const floors = useMemo(
    () =>
      (data?.floors ?? [])
        .filter((f: any) => f.project_id === activeBlockId)
        .slice()
        .sort((a: any, b: any) => Number(a.floor_number) - Number(b.floor_number)),
    [data, activeBlockId],
  );

  const apartmentsByFloor = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of data?.apartments ?? []) {
      if (!m.has(a.floor_id)) m.set(a.floor_id, []);
      m.get(a.floor_id)!.push(a);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const na = parseInt(String(a.apartment_number).replace(/\D/g, "")) || 0;
        const nb = parseInt(String(b.apartment_number).replace(/\D/g, "")) || 0;
        return na - nb;
      });
    }
    return m;
  }, [data]);

  const blockApartments = useMemo(() => {
    const blockFloorIds = new Set(floors.map((f: any) => f.id));
    return (data?.apartments ?? []).filter((a: any) => blockFloorIds.has(a.floor_id));
  }, [data, floors]);

  const handleSavePins = async (newPins: PinCoord[]) => {
    const targetId = activeBlockId || data?.project?.id;
    if (!targetId) return;
    await savePinsFn({ data: { project_id: targetId, pins: newPins } });
    await refetch();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return <div className="p-8">Ёфт нашуд</div>;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" /> Проектҳо
        </button>
        <div className="text-lg font-bold truncate max-w-sm">{data.project.name}</div>

        <div className="ml-auto flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-background p-0.5">
            <button
              onClick={() => setView("scheme")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition",
                view === "scheme"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <MapIcon className="h-3.5 w-3.5" /> Схемаи ошёна
            </button>
            <button
              onClick={() => setView("floors")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition",
                view === "floors"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Шахматка
            </button>
            <button
              onClick={() => setView("3d")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition",
                view === "3d"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Box className="h-3.5 w-3.5" /> 3D фасад
            </button>
          </div>

          {/* Color Legend (Corrected) */}
          <div className="hidden lg:flex items-center gap-2.5 text-xs border-l border-border pl-3">
            <Legend color="bg-emerald-500" label="Холӣ" />
            <Legend color="bg-blue-500" label="Рассрочка" />
            <Legend color="bg-red-500" label="Фурӯхта" />
            <Legend color="bg-amber-500" label="Банд" />
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 grid grid-cols-[220px_1fr] overflow-hidden">
        {/* Left Blocks / Entrances Sidebar */}
        <aside className="border-r border-border bg-card overflow-y-auto p-3 shrink-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2">Блокҳо</div>
          {data.blocks.map((b: any) => (
            <button
              key={b.id}
              onClick={() => setBlockId(b.id)}
              className={cn(
                "w-full text-left px-3.5 py-3 rounded-xl mb-1 text-base font-semibold transition flex items-center justify-between",
                b.id === activeBlockId
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted text-card-foreground"
              )}
            >
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </aside>

        {/* View Content */}
        <section className="overflow-hidden flex flex-col h-full bg-background">
          {view === "scheme" ? (
            schemeLoading && !signedScheme?.url ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <KioskInteractiveScheme
                floors={floors}
                apartments={blockApartments}
                schemeUrl={fixStorageUrl(signedScheme?.url) ?? null}
                initialPins={initialPins}
                onApartmentClick={(a: any) => setSelectedApt(a)}
                onSavePins={handleSavePins}
                onSwitchToChessboard={() => setView("floors")}
                canConfigure={true}
              />
            )
          ) : view === "3d" ? (
            <div className="h-full min-h-[500px] p-4">
              <Facade3dTab
                modelUrl={fixStorageUrl(signed3d?.url) ?? null}
                apartments={(data.apartments ?? [])
                  .filter((a: any) =>
                    (data.floors ?? []).some((f: any) => f.id === a.floor_id && f.project_id === activeBlockId),
                  )
                  .map((a: any) => {
                    const f = (data.floors ?? []).find((fl: any) => fl.id === a.floor_id);
                    return { ...a, floor_number: f?.floor_number ?? null };
                  })}
                onApartmentClick={(a: any) => setSelectedApt(a)}
              />
            </div>
          ) : floors.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-lg">
              Ошёна нест
            </div>
          ) : (
            /* Classic Chessboard (Шахматка) */
            <div className="overflow-auto p-4 divide-y divide-border">
              {floors.map((f: any) => {
                const apts = apartmentsByFloor.get(f.id) ?? [];
                return (
                  <div key={f.id} className="flex items-stretch gap-4 py-3">
                    <div className="w-20 shrink-0 flex flex-col items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                      <div className="text-4xl font-bold text-primary leading-none">{f.floor_number}</div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-1">ошёна</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {apts.length === 0 ? (
                        <div className="h-full flex items-center text-sm text-muted-foreground">Квартира нест</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {apts.map((a: any) => (
                            <button
                              key={a.id}
                              onClick={() => setSelectedApt(a)}
                              className={cn(
                                "text-white rounded-lg p-4 w-32 min-h-[110px] flex flex-col items-center justify-center transition-transform hover:scale-105 shadow",
                                STATUS_COLOR[a.status] ?? "bg-muted",
                              )}
                            >
                              <div className="text-3xl font-bold">№{a.apartment_number}</div>
                              {a.area ? <div className="text-xs opacity-90 mt-1">{a.area} м²</div> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedApt && (
        <ApartmentModal
          apartment={selectedApt}
          projectName={data.project.name}
          onClose={() => setSelectedApt(null)}
          onSaleComplete={() => refetch()}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-3 h-3 rounded-full", color)} />
      <span className="font-medium text-foreground/80">{label}</span>
    </div>
  );
}
