import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Move, Check, Loader2, Sparkles, MapPin, Layers, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type PinCoord = { slot: number; x: number; y: number };

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; glow: string }> = {
  empty: { label: "Холӣ", bg: "bg-emerald-500", border: "border-emerald-400", glow: "shadow-emerald-500/40" },
  installment: { label: "Рассрочка", bg: "bg-blue-500", border: "border-blue-400", glow: "shadow-blue-500/40" },
  sold: { label: "Фурӯхта", bg: "bg-red-500", border: "border-red-400", glow: "shadow-red-500/40" },
  unavailable: { label: "Банд", bg: "bg-amber-500", border: "border-amber-400", glow: "shadow-amber-500/40" },
};

function getDefaultPinPosition(slotIndex: number, totalSlots: number): { x: number; y: number } {
  if (totalSlots <= 1) return { x: 50, y: 50 };
  const cols = Math.min(totalSlots, Math.max(2, Math.ceil(Math.sqrt(totalSlots * 1.6))));
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);
  const totalRows = Math.ceil(totalSlots / cols);

  const stepX = 76 / Math.max(1, cols);
  const stepY = 66 / Math.max(1, totalRows);

  return {
    x: Math.round((12 + stepX * (col + 0.5)) * 10) / 10,
    y: Math.round((16 + stepY * (row + 0.5)) * 10) / 10,
  };
}

export function KioskInteractiveScheme({
  floors,
  apartments,
  schemeUrl,
  initialPins,
  onApartmentClick,
  onSavePins,
  onSwitchToChessboard,
  canConfigure = true,
}: {
  floors: Array<{ id: string; floor_number: number; project_id: string }>;
  apartments: Array<any>;
  schemeUrl: string | null;
  initialPins?: PinCoord[];
  onApartmentClick: (apt: any) => void;
  onSavePins?: (pins: PinCoord[]) => Promise<void>;
  onSwitchToChessboard?: () => void;
  canConfigure?: boolean;
}) {
  const sortedFloors = useMemo(
    () => floors.slice().sort((a, b) => Number(a.floor_number) - Number(b.floor_number)),
    [floors],
  );

  const apartmentsByFloor = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of apartments) {
      if (!map.has(a.floor_id)) map.set(a.floor_id, []);
      map.get(a.floor_id)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const na = parseInt(String(a.apartment_number).replace(/\D/g, "")) || 0;
        const nb = parseInt(String(b.apartment_number).replace(/\D/g, "")) || 0;
        return na - nb;
      });
    }
    return map;
  }, [apartments]);

  // Default to first floor with apartments, or first floor
  const defaultFloorId = useMemo(() => {
    for (const f of sortedFloors) {
      if ((apartmentsByFloor.get(f.id)?.length ?? 0) > 0) return f.id;
    }
    return sortedFloors[0]?.id ?? null;
  }, [sortedFloors, apartmentsByFloor]);

  const [activeFloorId, setActiveFloorId] = useState<string | null>(defaultFloorId);

  useEffect(() => {
    if (!activeFloorId && defaultFloorId) {
      setActiveFloorId(defaultFloorId);
    }
  }, [defaultFloorId, activeFloorId]);

  const currentApartments = useMemo(
    () => (activeFloorId ? apartmentsByFloor.get(activeFloorId) ?? [] : []),
    [apartmentsByFloor, activeFloorId],
  );

  // Pins state
  const [pins, setPins] = useState<PinCoord[]>(initialPins ?? []);
  useEffect(() => {
    if (initialPins) setPins(initialPins);
  }, [initialPins]);

  const [isEditing, setIsEditing] = useState(false);
  const [savingPins, setSavingPins] = useState(false);
  const [hoveredAptId, setHoveredAptId] = useState<string | null>(null);

  // Zoom / Pan state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const draggingCanvas = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const schemeContainerRef = useRef<HTMLDivElement>(null);

  const draggingPin = useRef<{ slot: number } | null>(null);

  const clamp = (s: number) => Math.min(4, Math.max(1, s));

  const resetZoom = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const getSlotCoord = useCallback(
    (slotIndex: number, total: number) => {
      const custom = pins.find((p) => p.slot === slotIndex);
      if (custom) return { x: custom.x, y: custom.y };
      return getDefaultPinPosition(slotIndex, total);
    },
    [pins],
  );

  const handlePointerDownCanvas = (e: React.PointerEvent) => {
    if (isEditing) return;
    if (scale <= 1) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingCanvas.current = { x: e.clientX, y: e.clientY, tx, ty };
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (draggingPin.current && isEditing && schemeContainerRef.current) {
      const rect = schemeContainerRef.current.getBoundingClientRect();
      const xPercent = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
      const yPercent = Math.min(95, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
      const slot = draggingPin.current.slot;

      setPins((prev) => {
        const next = prev.filter((p) => p.slot !== slot);
        next.push({
          slot,
          x: Math.round(xPercent * 10) / 10,
          y: Math.round(yPercent * 10) / 10,
        });
        return next;
      });
      return;
    }

    if (!draggingCanvas.current) return;
    setTx(draggingCanvas.current.tx + (e.clientX - draggingCanvas.current.x));
    setTy(draggingCanvas.current.ty + (e.clientY - draggingCanvas.current.y));
  };

  const handlePointerUpCanvas = () => {
    draggingCanvas.current = null;
    draggingPin.current = null;
  };

  async function handleSavePins() {
    if (!onSavePins) return;
    setSavingPins(true);
    try {
      await onSavePins(pins);
      toast.success("Ҷойгиршавии хонаҳо дар схема барои ҳамаи ошёнаҳо сабт шуд");
      setIsEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Хатогӣ ҳангоми сабт");
    } finally {
      setSavingPins(false);
    }
  }

  function handleResetDefaultPositions() {
    const total = currentApartments.length || 7;
    const defaults: PinCoord[] = [];
    for (let i = 0; i < total; i++) {
      defaults.push({ slot: i, ...getDefaultPinPosition(i, total) });
    }
    setPins(defaults);
    toast.info("Мавқеъҳо ба ҳолати пешфарз баргардонида шуданд. Барои тасдиқ «Сабт»-ро пахш кунед.");
  }

  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId);

  return (
    <div className="h-full flex flex-col bg-background/50 overflow-hidden select-none">
      {/* Top Banner when in Edit Mode */}
      {isEditing && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-amber-200 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 animate-pulse text-amber-400" />
            <span>
              <strong>Ҳолати танзим:</strong> Меткаҳоро бо муш кашида ба болои хонаи мувофиқи нақша гузоред. Ин тарҳрезӣ худкор ба <strong>ҳамаи ошёнаҳо</strong> татбиқ мешавад.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetDefaultPositions}
              className="px-2.5 py-1 text-xs rounded border border-amber-500/40 hover:bg-amber-500/20 text-amber-300"
            >
              Аз нав гузоштан
            </button>
            <Button
              size="sm"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs"
              onClick={handleSavePins}
              disabled={savingPins}
            >
              {savingPins ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Сабти мавқеъҳо
            </Button>
            <button
              onClick={() => {
                setPins(initialPins ?? []);
                setIsEditing(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Бекор кардан
            </button>
          </div>
        </div>
      )}

      {/* Main Container: Floors List + Scheme Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Floor Selector Column */}
        <div className="w-48 sm:w-56 shrink-0 border-r border-border bg-card/60 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/80 flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Ошёнаҳо
            </div>
            <span className="text-xs text-muted-foreground font-mono">{sortedFloors.length} ошёна</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sortedFloors.map((f) => {
              const apts = apartmentsByFloor.get(f.id) ?? [];
              const isActive = f.id === activeFloorId;
              const emptyCount = apts.filter((a) => a.status === "empty").length;

              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFloorId(f.id);
                  }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl transition flex items-center justify-between group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md scale-[1.01]"
                      : "hover:bg-muted/70 text-card-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-foreground border border-border/60"
                      )}
                    >
                      {f.floor_number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate leading-tight">
                        {f.floor_number === 0 ? "Цокол" : `${f.floor_number}-ум ошёна`}
                      </div>
                      <div className={cn("text-[11px] truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {apts.length > 0 ? `${apts.length} квартира` : "Хона нест"}
                      </div>
                    </div>
                  </div>

                  {apts.length > 0 && (
                    <div className="shrink-0 flex items-center gap-1">
                      {emptyCount > 0 ? (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold",
                            isActive
                              ? "bg-primary-foreground text-primary"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          )}
                          title={`${emptyCount} хонаи холӣ`}
                        >
                          {emptyCount} холӣ
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-red-500" title="Ҳама фурӯхта шуд" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scheme Interactive Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Canvas Bar */}
          <div className="border-b border-border bg-card/40 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                {activeFloor ? `${activeFloor.floor_number}-ум ошёна` : "Ошёна"}
              </span>
              <span className="text-xs text-muted-foreground">({currentApartments.length} хона дар нақша)</span>
            </div>

            <div className="flex items-center gap-2">
              {canConfigure && schemeUrl && onSavePins && !isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-border hover:bg-muted"
                  onClick={() => setIsEditing(true)}
                  title="Танзими ҷойгиршавии хонаҳо дар болои схема"
                >
                  <Move className="h-3.5 w-3.5 text-primary" />
                  Танзими меткаҳо
                </Button>
              )}

              {onSwitchToChessboard && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={onSwitchToChessboard}
                  title="Намоиш дар шакли шахматка"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Шахматка
                </Button>
              )}
            </div>
          </div>

          {/* Scheme Viewport Canvas */}
          <div
            className="flex-1 relative overflow-hidden bg-neutral-950 flex items-center justify-center touch-none select-none"
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
            onPointerCancel={handlePointerUpCanvas}
            onDoubleClick={resetZoom}
          >
            {schemeUrl ? (
              <div
                ref={schemeContainerRef}
                className="relative max-h-full max-w-full aspect-[4/3] flex items-center justify-center will-change-transform transition-[transform] duration-75"
                style={{
                  transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                  cursor: isEditing ? "crosshair" : scale > 1 ? "grab" : "default",
                }}
              >
                {/* Architectural Blueprint Image */}
                <img
                  src={schemeUrl}
                  alt="Схемаи ошёна"
                  draggable={false}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl pointer-events-none"
                />

                {/* Overlaid Interactive Apartment Pins */}
                {currentApartments.map((apt, slotIndex) => {
                  const coord = getSlotCoord(slotIndex, currentApartments.length);
                  const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.empty;
                  const isHovered = hoveredAptId === apt.id;

                  return (
                    <div
                      key={apt.id}
                      style={{
                        left: `${coord.x}%`,
                        top: `${coord.y}%`,
                        zIndex: isHovered ? 40 : 20,
                      }}
                      onPointerDown={(e) => {
                        if (isEditing) {
                          e.stopPropagation();
                          draggingPin.current = { slot: slotIndex };
                        }
                      }}
                      onClick={(e) => {
                        if (!isEditing) {
                          e.stopPropagation();
                          onApartmentClick(apt);
                        }
                      }}
                      onMouseEnter={() => setHoveredAptId(apt.id)}
                      onMouseLeave={() => setHoveredAptId(null)}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-150 group",
                        isHovered ? "scale-110 z-40" : "scale-100",
                        isEditing && "cursor-move ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
                      )}
                    >
                      {/* Interactive Card Pin */}
                      <div
                        className={cn(
                          "relative px-3 py-1.5 rounded-xl text-white font-medium border shadow-lg backdrop-blur-sm transition-all flex flex-col items-center justify-center min-w-[70px]",
                          cfg.bg,
                          cfg.border,
                          cfg.glow,
                          isHovered && "ring-2 ring-white shadow-2xl brightness-110"
                        )}
                      >
                        <div className="flex items-center gap-1 leading-none">
                          <span className="text-base sm:text-lg font-black tracking-tight drop-shadow">
                            №{apt.apartment_number}
                          </span>
                        </div>
                        {apt.area ? (
                          <div className="text-[10px] font-medium opacity-95 leading-tight mt-0.5">
                            {apt.area} м²
                          </div>
                        ) : null}

                        {/* Status Dot / Indicator */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white border border-neutral-900 shadow-sm flex items-center justify-center">
                          <div className={cn("w-1.5 h-1.5 rounded-full", cfg.bg)} />
                        </div>
                      </div>

                      {/* Tooltip on Hover */}
                      {!isEditing && (
                        <div
                          className={cn(
                            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-neutral-900/95 text-white text-[11px] rounded-lg shadow-xl border border-white/10 whitespace-nowrap pointer-events-none transition-opacity",
                            isHovered ? "opacity-100" : "opacity-0"
                          )}
                        >
                          <div className="font-semibold">{cfg.label}</div>
                          {apt.price ? (
                            <div className="text-emerald-400 font-mono text-[10px]">
                              {Number(apt.price).toLocaleString()} TJS
                            </div>
                          ) : null}
                          <div className="text-[9px] text-muted-foreground mt-0.5">Барои харид пахш кунед</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center max-w-md mx-auto space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto flex items-center justify-center">
                  <MapPin className="h-7 w-7 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Схемаи ошёна бор карда нашудааст</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Барои ин блок расми нақшаи меъмории ошёна бор нашудааст. Шумо метавонед расми нақшаро дар танзимоти лоиҳа бор кунед, то ба ҷои шахматка схемаи интерактивӣ намоиш дода шавад.
                  </p>
                </div>
                {onSwitchToChessboard && (
                  <Button onClick={onSwitchToChessboard} variant="default" className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Намоиш дар шакли шахматка
                  </Button>
                )}
              </div>
            )}

            {/* Scheme Zoom Controls */}
            {schemeUrl && (
              <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-card/90 backdrop-blur rounded-xl border border-border shadow-2xl p-1 z-30">
                <button
                  onClick={() => setScale((s) => clamp(s * 1.3))}
                  className="h-10 w-10 rounded-lg hover:bg-muted text-foreground flex items-center justify-center transition"
                  aria-label="Наздик кардан"
                  title="Наздик кардан"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setScale((s) => clamp(s / 1.3))}
                  className="h-10 w-10 rounded-lg hover:bg-muted text-foreground flex items-center justify-center transition"
                  aria-label="Дур кардан"
                  title="Дур кардан"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={resetZoom}
                  className="h-10 w-10 rounded-lg hover:bg-muted text-foreground flex items-center justify-center transition"
                  aria-label="Бозсозӣ"
                  title="Андозаи аввала"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Bottom Strip: Current Floor Apartments Quick Carousel */}
          {currentApartments.length > 0 && (
            <div className="border-t border-border bg-card/80 backdrop-blur-sm p-3 shrink-0">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center justify-between">
                <span>Хонаҳои {activeFloor?.floor_number}-ум ошёна</span>
                <span className="text-[10px] lowercase text-muted-foreground">барои маълумот пахш кунед</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {currentApartments.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.empty;
                  const isHovered = hoveredAptId === a.id;

                  return (
                    <button
                      key={a.id}
                      onClick={() => onApartmentClick(a)}
                      onMouseEnter={() => setHoveredAptId(a.id)}
                      onMouseLeave={() => setHoveredAptId(null)}
                      className={cn(
                        "rounded-xl p-2.5 min-w-[100px] text-white flex flex-col items-center justify-center transition-all hover:scale-105 shrink-0 shadow",
                        cfg.bg,
                        isHovered && "ring-2 ring-white brightness-110"
                      )}
                    >
                      <div className="text-xl font-black">№{a.apartment_number}</div>
                      {a.area ? <div className="text-[11px] opacity-90">{a.area} м²</div> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
