import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Center, Bounds, useBounds, Html } from "@react-three/drei";
import * as THREE from "three";
import { Loader2, Sun, Moon, Layers, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Apartment = {
  id: string;
  apartment_number: string | number;
  area?: number | null;
  rooms?: number | null;
  status?: string | null;
  price?: number | null;
  floor_number?: number | null;
};

type Props = {
  modelUrl: string;
  apartments?: Apartment[];
  onApartmentClick?: (apt: Apartment) => void;
  className?: string;
};

function parseFloorFromName(name: string): number | null {
  const m = name.match(/floor[_-]?(\d+)/i);
  return m ? Number(m[1]) : null;
}
function parseAptFromName(name: string): string | null {
  const m = name.match(/apt[_-]?([\w\d]+)/i);
  return m ? m[1] : null;
}

function Model({
  url,
  visibleFloor,
  hoveredApt,
  onPick,
  onDiscover,
}: {
  url: string;
  visibleFloor: number | null;
  hoveredApt: string | null;
  onPick: (aptKey: string | null) => void;
  onDiscover: (info: { floors: number[]; apts: string[] }) => void;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const originalMats = useRef(new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>());

  useEffect(() => {
    const floors = new Set<number>();
    const apts = new Set<string>();
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        if (!originalMats.current.has(o)) originalMats.current.set(o, o.material);
        const fn = parseFloorFromName(o.name);
        if (fn != null) floors.add(fn);
        const an = parseAptFromName(o.name);
        if (an) apts.add(an);
      }
    });
    onDiscover({ floors: [...floors].sort((a, b) => a - b), apts: [...apts] });
  }, [cloned, onDiscover]);

  useEffect(() => {
    cloned.traverse((o: any) => {
      if (!o.isMesh) return;
      const fn = parseFloorFromName(o.name);
      const visible = visibleFloor == null || fn == null || fn === visibleFloor;
      o.visible = visible;
      const an = parseAptFromName(o.name);
      const orig = originalMats.current.get(o);
      if (an && an === hoveredApt) {
        o.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#3b82f6"),
          emissive: new THREE.Color("#1d4ed8"),
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.85,
        });
      } else if (orig) {
        o.material = orig;
      }
    });
  }, [cloned, visibleFloor, hoveredApt]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        const an = parseAptFromName((e.object as any).name ?? "");
        onPick(an);
      }}
      onPointerMissed={() => onPick(null)}
    >
      <primitive object={cloned} />
    </group>
  );
}

function FitOnLoad() {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      onClick={onReset}
      className="rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
      title="Аз нав"
    >
      <RotateCcw className="h-4 w-4" />
    </button>
  );
}

export function FacadeViewer({ modelUrl, apartments = [], onApartmentClick, className }: Props) {
  const [night, setNight] = useState(false);
  const [floors, setFloors] = useState<number[]>([]);
  const [visibleFloor, setVisibleFloor] = useState<number | null>(null);
  const [availableApts, setAvailableApts] = useState<string[]>([]);
  const [hoveredApt, setHoveredApt] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const aptMap = useMemo(() => {
    const m = new Map<string, Apartment>();
    for (const a of apartments) m.set(String(a.apartment_number), a);
    return m;
  }, [apartments]);

  const handlePick = (aptKey: string | null) => {
    if (!aptKey) return;
    const a = aptMap.get(aptKey);
    if (a && onApartmentClick) onApartmentClick(a);
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-neutral-900", className)}>
      <Canvas
        key={resetKey}
        camera={{ position: [12, 8, 12], fov: 45 }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        shadows
      >
        <color attach="background" args={[night ? "#0b1220" : "#eef2f7"]} />
        <ambientLight intensity={night ? 0.25 : 0.55} />
        <directionalLight
          position={[10, 15, 8]}
          intensity={night ? 0.35 : 1.2}
          color={night ? "#93c5fd" : "#ffffff"}
          castShadow
        />
        <Suspense
          fallback={
            <Html center>
              <div className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-white">
                <Loader2 className="h-4 w-4 animate-spin" /> Модели 3D бор шуда истодааст…
              </div>
            </Html>
          }
        >
          <Environment preset={night ? "night" : "city"} />
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <Model
                url={modelUrl}
                visibleFloor={visibleFloor}
                hoveredApt={hoveredApt}
                onPick={handlePick}
                onDiscover={({ floors: f, apts }) => {
                  setFloors(f);
                  setAvailableApts(apts);
                }}
              />
            </Center>
            <FitOnLoad />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>

      {/* Top-right controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button
          onClick={() => setNight((v) => !v)}
          className="rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
          title={night ? "Рӯз" : "Шаб"}
        >
          {night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <ResetButton onReset={() => setResetKey((k) => k + 1)} />
      </div>

      {/* Floor filter */}
      {floors.length > 0 && (
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-black/60 p-1 text-white">
          <Layers className="ml-1 h-4 w-4 opacity-70" />
          <button
            onClick={() => setVisibleFloor(null)}
            className={cn(
              "rounded px-2 py-1 text-xs",
              visibleFloor === null ? "bg-white text-black" : "hover:bg-white/10",
            )}
          >
            Ҳама
          </button>
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setVisibleFloor(f)}
              className={cn(
                "rounded px-2 py-1 text-xs",
                visibleFloor === f ? "bg-white text-black" : "hover:bg-white/10",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Apartment hover strip */}
      {availableApts.length > 0 && apartments.length > 0 && (
        <div className="pointer-events-auto absolute bottom-3 left-3 right-3 flex flex-wrap gap-1 rounded-lg bg-black/60 p-2 text-white">
          {apartments
            .filter((a) => availableApts.includes(String(a.apartment_number)))
            .map((a) => (
              <button
                key={a.id}
                onMouseEnter={() => setHoveredApt(String(a.apartment_number))}
                onMouseLeave={() => setHoveredApt(null)}
                onClick={() => onApartmentClick?.(a)}
                className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/25"
              >
                №{a.apartment_number}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

useGLTF.preload = useGLTF.preload ?? (() => {});
