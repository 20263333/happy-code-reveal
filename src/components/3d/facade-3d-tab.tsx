import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

const FacadeViewer = lazy(() =>
  import("./facade-viewer").then((m) => ({ default: m.FacadeViewer })),
);

type Apartment = {
  id: string;
  apartment_number: string | number;
  area?: number | null;
  rooms?: number | null;
  status?: string | null;
  price?: number | null;
  floor_number?: number | null;
};

export function Facade3dTab({
  modelUrl,
  apartments,
  onApartmentClick,
  className,
}: {
  modelUrl: string | null | undefined;
  apartments?: Apartment[];
  onApartmentClick?: (apt: Apartment) => void;
  className?: string;
}) {
  if (!modelUrl) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Модели 3D барои ин блок ҳанӯз бор карда нашудааст.
      </div>
    );
  }
  return (
    <ClientOnly
      fallback={
        <div className="flex h-full min-h-[420px] items-center justify-center bg-neutral-900 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex h-full min-h-[420px] items-center justify-center bg-neutral-900 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        }
      >
        <FacadeViewer
          modelUrl={modelUrl}
          apartments={apartments}
          onApartmentClick={onApartmentClick}
          className={className}
        />
      </Suspense>
    </ClientOnly>
  );
}
