import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Check,
  Loader2,
  MapPin,
  Layers,
  LayoutGrid,
  Home,
  Maximize2,
  Minimize2,
  Tag,
  ArrowRight,
  Info,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type PinCoord = { slot: number; x: number; y: number };

const MIN_SCALE = 0.5;
const MAX_SCALE = 20;
const ZOOM_PRESETS = [0.5, 1, 2, 4, 8, 15, 20];

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; glow: string; text: string; dot: string }
> = {
  empty: {
    label: "Холӣ",
    bg: "bg-emerald-500",
    border: "border-emerald-400",
    glow: "shadow-emerald-500/50",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  installment: {
    label: "Рассрочка",
    bg: "bg-blue-500",
    border: "border-blue-400",
    glow: "shadow-blue-500/50",
    text: "text-blue-400",
    dot: "bg-blue-500",
  },
  sold: {
    label: "Фурӯхта",
    bg: "bg-red-500",
    border: "border-red-400",
    glow: "shadow-red-500/50",
    text: "text-red-400",
    dot: "bg-red-500",
  },
  unavailable: {
    label: "Банд",
    bg: "bg-amber-500",
    border: "border-amber-400",
    glow: "shadow-amber-500/50",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
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

  // Hovered and Selected apartment state
  const [hoveredAptId, setHoveredAptId] = useState<string | null>(null);
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);

  // Scheme visibility: Clean scheme toggle (show/hide pins)
  const [showPins, setShowPins] = useState(true);

  // Pin style: "compact" (sleek small circular pin - default) vs "cards" (larger rectangular badge)
  const [pinStyle, setPinStyle] = useState<"compact" | "cards">("compact");

  // When floor changes, reset hover and pick the first apartment as selected
  useEffect(() => {
    if (currentApartments.length > 0) {
      setSelectedAptId(currentApartments[0].id);
    } else {
      setSelectedAptId(null);
    }
    setHoveredAptId(null);
  }, [activeFloorId]);

  // Active apartment for the Left Info Card (hover takes instant priority, else selected)
  const activeApt = useMemo(() => {
    if (hoveredAptId) {
      const found = currentApartments.find((a) => a.id === hoveredAptId);
      if (found) return found;
    }
    if (selectedAptId) {
      const found = currentApartments.find((a) => a.id === selectedAptId);
      if (found) return found;
    }
    return currentApartments[0] ?? null;
  }, [hoveredAptId, selectedAptId, currentApartments]);

  // Pins state
  const [pins, setPins] = useState<PinCoord[]>(initialPins ?? []);
  useEffect(() => {
    if (initialPins) setPins(initialPins);
  }, [initialPins]);

  const [isEditing, setIsEditing] = useState(false);
  const [savingPins, setSavingPins] = useState(false);

  // High-Precision Smooth Zoom / Pan State
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const schemeViewportRef = useRef<HTMLDivElement>(null);
  const schemeContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startTx: number; startTy: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);
  const draggingPin = useRef<{ slot: number } | null>(null);

  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(1);
  const initialPinchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const clampScale = useCallback((s: number) => {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 1000) / 1000));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Zoom relative to pointer cursor position or center
  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const vp = schemeViewportRef.current;
    setScale((prevScale) => {
      const nextScale = clampScale(prevScale * factor);
      if (nextScale === prevScale) return prevScale;

      if (vp && clientX !== undefined && clientY !== undefined) {
        const rect = vp.getBoundingClientRect();
        const mouseX = clientX - rect.left - rect.width / 2;
        const mouseY = clientY - rect.top - rect.height / 2;
        const ratio = nextScale / prevScale;
        setTx((prevTx) => mouseX - (mouseX - prevTx) * ratio);
        setTy((prevTy) => mouseY - (mouseY - prevTy) * ratio);
      } else {
        const ratio = nextScale / prevScale;
        setTx((prevTx) => prevTx * ratio);
        setTy((prevTy) => prevTy * ratio);
      }
      return nextScale;
    });
  }, [clampScale]);

  const setZoomLevel = useCallback((targetScale: number) => {
    const nextScale = clampScale(targetScale);
    setScale((prevScale) => {
      if (nextScale === prevScale) return prevScale;
      const ratio = nextScale / prevScale;
      setTx((prevTx) => prevTx * ratio);
      setTy((prevTy) => prevTy * ratio);
      return nextScale;
    });
    setShowZoomMenu(false);
  }, [clampScale]);

  // Smooth mouse wheel zoom anchored at cursor
  useEffect(() => {
    const vp = schemeViewportRef.current;
    if (!vp) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = vp.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      // Smooth geometric zoom
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.15 : 1 / 1.15;

      setScale((prevScale) => {
        const nextScale = clampScale(prevScale * factor);
        if (nextScale === prevScale) return prevScale;
        const ratio = nextScale / prevScale;
        setTx((prevTx) => mouseX - (mouseX - prevTx) * ratio);
        setTy((prevTy) => mouseY - (mouseY - prevTy) * ratio);
        return nextScale;
      });
    };

    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      vp.removeEventListener("wheel", handleWheel);
    };
  }, [clampScale]);

  // Track Fullscreen changes
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    const vp = schemeViewportRef.current;
    if (!vp) return;
    if (!document.fullscreenElement) {
      vp.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
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
    activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-finger touch pinch-to-zoom
    if (activeTouchesRef.current.size === 2) {
      const pts = Array.from(activeTouchesRef.current.values());
      initialPinchDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchScaleRef.current = scale;
      const vp = schemeViewportRef.current;
      if (vp) {
        const rect = vp.getBoundingClientRect();
        initialPinchCenterRef.current = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2,
          y: (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2,
        };
      }
      dragStartRef.current = null;
      setIsDraggingCanvas(false);
      return;
    }

    if (e.button !== 0) return; // Only primary mouse button

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startTx: tx,
      startTy: ty,
    };
    dragMovedRef.current = false;
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    // Pin dragging in edit mode
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

    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // 2-finger touch pinch zoom
    if (activeTouchesRef.current.size >= 2 && initialPinchDistRef.current && initialPinchDistRef.current > 0) {
      const pts = Array.from(activeTouchesRef.current.values());
      const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = curDist / initialPinchDistRef.current;
      const targetScale = clampScale(initialPinchScaleRef.current * ratio);
      const center = initialPinchCenterRef.current;

      setScale((prevScale) => {
        if (prevScale === targetScale) return prevScale;
        const r = targetScale / prevScale;
        setTx((prevTx) => center.x - (center.x - prevTx) * r);
        setTy((prevTy) => center.y - (center.y - prevTy) * r);
        return targetScale;
      });
      return;
    }

    // 1-pointer pan
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    if (!dragMovedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragMovedRef.current = true;
      setIsDraggingCanvas(true);
    }

    if (dragMovedRef.current) {
      setTx(dragStartRef.current.startTx + dx);
      setTy(dragStartRef.current.startTy + dy);
    }
  };

  const handlePointerUpCanvas = (e: React.PointerEvent) => {
    activeTouchesRef.current.delete(e.pointerId);
    if (activeTouchesRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }
    dragStartRef.current = null;
    setIsDraggingCanvas(false);
    draggingPin.current = null;
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (scale > 1.2) {
      resetZoom();
    } else {
      zoomBy(2.5, e.clientX, e.clientY);
    }
  };

  const startEditing = () => {
    setShowPins(true);
    setIsEditing(true);
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
    const defs: PinCoord[] = [];
    for (let i = 0; i < total; i++) {
      const pos = getDefaultPinPosition(i, total);
      defs.push({ slot: i, x: pos.x, y: pos.y });
    }
    setPins(defs);
    toast.info("Мавқеъҳо ба ҳолати аввала (пешфарз) баргардонида шуданд");
  }

  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId);

  // Counter-scaling factor so markers stay compact, crisp and clickable at any zoom level up to 20x
  // without ballooning and obscuring the blueprint details
  const pinScaleFactor = useMemo(() => {
    if (scale <= 1) return 1;
    return Math.max(0.16, Math.min(1.0, 1 / Math.pow(scale, 0.72)));
  }, [scale]);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* Top Bar: Floor Selection Tabs */}
      <div className="border-b border-border bg-card/60 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Ошёнаҳо:
          </span>
          <div className="flex items-center gap-1.5 flex-nowrap">
            {sortedFloors.map((fl) => {
              const aptsCount = apartmentsByFloor.get(fl.id)?.length ?? 0;
              const isActive = fl.id === activeFloorId;
              return (
                <button
                  key={fl.id}
                  onClick={() => setActiveFloorId(fl.id)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50",
                  )}
                >
                  <span>{fl.floor_number}-ум ошёна</span>
                  {aptsCount > 0 && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold",
                        isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-foreground",
                      )}
                    >
                      {aptsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit mode controls */}
        {isEditing && (
          <div className="flex items-center gap-2 shrink-0 animate-in fade-in">
            <span className="text-xs text-amber-400 font-medium hidden sm:inline">
              Доирачаҳоро ба болои нақша кашед
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetDefaultPositions}
              className="h-8 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            >
              Пешфарз
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPins(initialPins ?? []);
                setIsEditing(false);
              }}
              className="h-8 text-xs"
            >
              Бекор кардан
            </Button>
            <Button
              size="sm"
              onClick={handleSavePins}
              disabled={savingPins}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1 font-semibold"
            >
              {savingPins ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Сабти схема
            </Button>
          </div>
        )}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Sidebar: Detailed Apartment Info Card */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-card/30 backdrop-blur flex flex-col shrink-0 overflow-y-auto max-h-[35vh] lg:max-h-full">
          <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Home className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Маълумоти хона
                  </span>
                </div>
                {activeApt && (
                  <span
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-bold border shadow-sm",
                      STATUS_CONFIG[activeApt.status]?.bg ?? "bg-emerald-500",
                      "text-white border-white/20",
                    )}
                  >
                    {STATUS_CONFIG[activeApt.status]?.label ?? "Холӣ"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Мушро ба болои доирачаҳо дар нақша баред ё пахш кунед.
              </p>
            </div>

            {activeApt ? (
              <div className="space-y-3 bg-card/80 border border-border/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">Рақами манзил</span>
                    <div className="text-2xl font-black text-foreground tracking-tight">
                      №{activeApt.apartment_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground font-medium">Ошёна</span>
                    <div className="text-base font-bold text-foreground">
                      {activeFloor?.floor_number ?? "-"}-ум ошёна
                    </div>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-muted/60 rounded-xl p-2.5 border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                      <Maximize2 className="h-3 w-3 text-emerald-400" />
                      Масоҳат
                    </div>
                    <div className="text-base font-black text-foreground mt-0.5 font-mono">
                      {activeApt.area ? `${activeApt.area} м²` : "—"}
                    </div>
                  </div>

                  <div className="bg-muted/60 rounded-xl p-2.5 border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                      <Tag className="h-3 w-3 text-emerald-400" />
                      Ҳуҷраҳо
                    </div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {activeApt.rooms ? `${activeApt.rooms}-ҳуҷрагӣ` : "Истиқоматӣ"}
                    </div>
                  </div>
                </div>

                {/* Pricing Info */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-semibold text-emerald-400">Нархи умумӣ</div>
                  <div className="text-xl font-black text-emerald-300 mt-0.5 font-mono">
                    {activeApt.price ? `${Number(activeApt.price).toLocaleString()} TJS` : "Бо маслиҳат"}
                  </div>
                  {activeApt.price_per_sqm || (activeApt.price && activeApt.area) ? (
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                      {activeApt.price_per_sqm
                        ? `${Number(activeApt.price_per_sqm).toLocaleString()} TJS / м²`
                        : `${Math.round(Number(activeApt.price) / Number(activeApt.area)).toLocaleString()} TJS / м²`}
                    </div>
                  ) : null}
                </div>

                {/* Open Modal / Purchase Button */}
                <div className="pt-2">
                  <Button
                    onClick={() => onApartmentClick(activeApt)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 text-xs sm:text-sm rounded-xl shadow-md gap-1.5 transition-all hover:shadow-emerald-500/25"
                  >
                    <span>Маълумоти пурра ва харид</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground mt-2 flex items-center justify-center gap-1">
                    <Info className="h-3 w-3" /> Барои дидани тарҳ ё фармоиш пахш кунед
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-2xl text-muted-foreground space-y-2">
                <MapPin className="h-8 w-8 text-muted-foreground/60 animate-pulse" />
                <div className="text-xs font-semibold text-foreground">Хона интихоб нашудааст</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  Мушро ба болои хона дар нақша баред ё пахш кунед, то маълумоти пурраи он дар инҷо намоиш ёбад.
                </div>
              </div>
            )}
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
              {activeApt && (
                <span className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Фаъол: №{activeApt.apartment_number} ({activeApt.area} м²)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Clean Scheme Toggle (Show/Hide Pins) */}
              {schemeUrl && !isEditing && (
                <Button
                  size="sm"
                  variant={showPins ? "outline" : "default"}
                  className={cn(
                    "h-8 text-xs gap-1.5 transition-all",
                    !showPins
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                      : "border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setShowPins((v) => !v)}
                  title={
                    showPins
                      ? "Пинҳон кардани меткаҳо барои нишон додани нақшаи тоза ба муштарӣ"
                      : "Нишон додани меткаҳо дар болои нақша"
                  }
                >
                  {showPins ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Схемаи тоза</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Нишон додани меткаҳо</span>
                    </>
                  )}
                </Button>
              )}

              {/* Pin Style Toggle (Compact circles vs Detailed cards) */}
              {schemeUrl && showPins && !isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 border-border hover:bg-muted text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                  onClick={() => setPinStyle((s) => (s === "compact" ? "cards" : "compact"))}
                  title="Иваз кардани тарзи намоиши меткаҳо (доирачаҳои хурд ё карточкаҳои васеъ)"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>{pinStyle === "compact" ? "Доирачаҳо" : "Карточкаҳо"}</span>
                </Button>
              )}

              {canConfigure && schemeUrl && onSavePins && !isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-border hover:bg-muted"
                  onClick={startEditing}
                  title="Танзими ҷойгиршавии хонаҳо дар болои схема"
                >
                  <Move className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Танзими меткаҳо</span>
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
                  <span className="hidden sm:inline">Шахматка</span>
                </Button>
              )}
            </div>
          </div>

          {/* Scheme Viewport Canvas */}
          <div
            ref={schemeViewportRef}
            className="flex-1 relative overflow-hidden bg-neutral-950 flex items-center justify-center touch-none select-none"
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
            onPointerCancel={handlePointerUpCanvas}
            onDoubleClick={handleDoubleClickCanvas}
          >
            {/* Notification Banner when Clean View is Active */}
            {!showPins && !isEditing && schemeUrl && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-neutral-200 text-xs px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-2 z-30 animate-in fade-in slide-in-from-top-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ҳолати схемаи тоза: нақша бе ягон монеа намоиш ёфтааст</span>
                <button
                  onClick={() => setShowPins(true)}
                  className="text-emerald-400 underline hover:text-emerald-300 font-semibold ml-1"
                >
                  Бозгардонидан
                </button>
              </div>
            )}

            {/* Scheme Blueprint and Interactive Overlays */}
            {schemeUrl ? (
              <div
                ref={schemeContainerRef}
                className={cn(
                  "relative max-h-full max-w-full aspect-[4/3] flex items-center justify-center origin-center",
                  !isDraggingCanvas && "transition-transform duration-100 ease-out",
                )}
                style={{
                  transform: scale === 1 && tx === 0 && ty === 0 ? undefined : `translate(${tx}px, ${ty}px) scale(${scale})`,
                  cursor: isEditing ? (draggingPin.current ? "grabbing" : "crosshair") : isDraggingCanvas ? "grabbing" : "grab",
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
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
                  const isSelected = selectedAptId === apt.id;
                  const isActiveGreen = isHovered || isSelected;

                  // If showPins is false, show pin ONLY if user specifically hovered/selected this apartment
                  const isVisible = showPins || isEditing || isActiveGreen;
                  if (!isVisible) return null;

                  const pinDynamicScale = isActiveGreen ? pinScaleFactor * 1.25 : pinScaleFactor;

                  return (
                    <div
                      key={apt.id}
                      style={{
                        left: `${coord.x}%`,
                        top: `${coord.y}%`,
                        transform: `translate(-50%, -50%) scale(${pinDynamicScale})`,
                        transformOrigin: "center center",
                        zIndex: isActiveGreen ? 50 : 20,
                      }}
                      onPointerDown={(e) => {
                        if (isEditing) {
                          e.stopPropagation();
                          draggingPin.current = { slot: slotIndex };
                        }
                      }}
                      onClick={(e) => {
                        if (dragMovedRef.current) return;
                        if (!isEditing) {
                          e.stopPropagation();
                          setSelectedAptId(apt.id);
                          onApartmentClick(apt);
                        }
                      }}
                      onMouseEnter={() => {
                        setHoveredAptId(apt.id);
                        setSelectedAptId(apt.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredAptId(null);
                      }}
                      className={cn(
                        "absolute cursor-pointer transition-all duration-150 group",
                        isEditing && "cursor-move ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
                      )}
                    >
                      {/* Radial green aura glow when hovered/active */}
                      {isActiveGreen && !isEditing && (
                        <div className="absolute inset-0 -m-3 rounded-full bg-emerald-500/40 blur-md pointer-events-none animate-pulse" />
                      )}

                      {/* COMPACT PIN MODE: Sleek circular pin that leaves blueprint 100% visible */}
                      {pinStyle === "compact" && !isEditing ? (
                        <div
                          className={cn(
                            "relative w-7 h-7 sm:w-8 sm:h-8 rounded-full font-black text-xs sm:text-sm border-2 shadow-lg backdrop-blur-md transition-all flex items-center justify-center",
                            isActiveGreen
                              ? "bg-emerald-500 text-white border-white scale-110 ring-4 ring-emerald-400/50 shadow-[0_0_22px_rgba(16,185,129,0.95)]"
                              : "bg-neutral-900/90 text-white border-neutral-600/80 shadow-md hover:border-emerald-400 hover:scale-105",
                          )}
                        >
                          <span className="leading-none drop-shadow-sm font-bold">
                            {apt.apartment_number}
                          </span>

                          {/* Mini Status Dot on Top-Right */}
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neutral-950 border border-neutral-700 shadow-sm flex items-center justify-center">
                            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                          </div>
                        </div>
                      ) : (
                        /* DETAILED RECTANGULAR CARD PIN (Used in Edit Mode or if user switches to Cards) */
                        <div
                          className={cn(
                            "relative px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-medium border shadow-lg backdrop-blur-md transition-all flex flex-col items-center justify-center min-w-[62px]",
                            isActiveGreen
                              ? "bg-emerald-500 text-white border-emerald-300 ring-4 ring-emerald-400/40 shadow-[0_0_25px_rgba(16,185,129,0.9)]"
                              : "bg-neutral-900/85 text-white border-neutral-700/80 shadow-md hover:border-neutral-500",
                            isEditing && "ring-2 ring-amber-400",
                          )}
                        >
                          <div className="flex items-center gap-1 leading-none">
                            <span
                              className={cn(
                                "text-sm sm:text-base font-black tracking-tight drop-shadow",
                                isActiveGreen ? "text-white" : "text-neutral-100",
                              )}
                            >
                              №{apt.apartment_number}
                            </span>
                          </div>
                          {apt.area ? (
                            <div
                              className={cn(
                                "text-[9px] sm:text-[10px] font-medium leading-tight mt-0.5",
                                isActiveGreen ? "text-emerald-100 font-bold" : "text-neutral-300",
                              )}
                            >
                              {apt.area} м²
                            </div>
                          ) : null}

                          {/* Status Dot / Indicator */}
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-neutral-900 border border-neutral-700 shadow-sm flex items-center justify-center">
                            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                          </div>
                        </div>
                      )}

                      {/* High-Resolution Crisp Floating Tooltip on Hover / Selection */}
                      {!isEditing && (
                        <div
                          className={cn(
                            "absolute bottom-full left-1/2 mb-2.5 px-3.5 py-2.5 bg-neutral-950/98 text-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.85)] border border-neutral-700/90 whitespace-nowrap pointer-events-none transition-opacity duration-150 z-50",
                            isActiveGreen ? "opacity-100" : "opacity-0 pointer-events-none",
                          )}
                          style={{
                            // Counter-scale tooltip so text is always 100% sharp and readable at standard font size
                            transform: `translate(-50%, 0) scale(${1 / (scale * pinDynamicScale)})`,
                            transformOrigin: "bottom center",
                            WebkitFontSmoothing: "antialiased",
                            MozOsxFontSmoothing: "grayscale",
                            textRendering: "geometricPrecision",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-emerald-400 tracking-tight">
                              Хонаи №{apt.apartment_number}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                              {cfg.label}
                            </span>
                          </div>

                          {apt.area && (
                            <div className="text-xs font-semibold text-neutral-100 mt-1.5 flex items-center gap-1.5 font-mono">
                              <span className="text-neutral-300 font-sans font-medium">Масоҳат:</span>
                              <strong className="text-white font-black text-sm">{apt.area} м²</strong>
                            </div>
                          )}

                          {apt.price ? (
                            <div className="text-sm font-black text-emerald-300 font-mono mt-1">
                              {Number(apt.price).toLocaleString()} TJS
                            </div>
                          ) : null}

                          <div className="text-xs font-medium text-neutral-300 mt-1.5 pt-1.5 border-t border-neutral-800/90">
                            Барои тафсилот пахш кунед
                          </div>
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

            {/* Hint pill for gestures */}
            {schemeUrl && (
              <div className="absolute bottom-4 left-4 hidden md:flex items-center gap-2 bg-neutral-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-neutral-800 text-[11px] text-neutral-300 pointer-events-none select-none z-20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Чархаки муш (wheel) ё 2 ангушт барои зум то 2000% · Кашола кардан барои ҳаракат</span>
              </div>
            )}

            {/* Scheme Zoom Controls Dock */}
            {schemeUrl && (
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-30">
                {/* Presets dropdown popover */}
                {showZoomMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-neutral-900/95 backdrop-blur-xl border border-neutral-700 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 min-w-[130px] animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-[10px] font-bold uppercase text-neutral-400 px-2 py-1">
                      Зуми фаврӣ
                    </div>
                    {ZOOM_PRESETS.map((val) => (
                      <button
                        key={val}
                        onClick={() => setZoomLevel(val)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-lg text-left font-mono font-semibold transition flex items-center justify-between",
                          Math.round(scale * 100) === Math.round(val * 100)
                            ? "bg-emerald-500 text-white font-bold"
                            : "text-neutral-200 hover:bg-neutral-800",
                        )}
                      >
                        <span>{Math.round(val * 100)}%</span>
                        {val === 1 && <span className="text-[10px] opacity-75 font-sans">Аввала</span>}
                        {val === 20 && <span className="text-[10px] opacity-75 font-sans">Макс</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-700/80 shadow-2xl p-1.5 flex items-center gap-1 text-white">
                  {/* Zoom Out Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => zoomBy(1 / 1.35)}
                    disabled={scale <= MIN_SCALE}
                    className="h-9 w-9 rounded-xl hover:bg-neutral-800 text-neutral-200 hover:text-white transition disabled:opacity-40"
                    title="Дур кардан (Zoom Out)"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>

                  {/* Percentage Display & Presets Trigger */}
                  <button
                    onClick={() => setShowZoomMenu((v) => !v)}
                    className="px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 hover:bg-neutral-800/80 rounded-lg transition flex items-center gap-1"
                    title="Интихоби фоизи зум"
                  >
                    <span>{Math.round(scale * 100)}%</span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>

                  {/* Zoom In Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => zoomBy(1.35)}
                    disabled={scale >= MAX_SCALE}
                    className="h-9 w-9 rounded-xl hover:bg-neutral-800 text-neutral-200 hover:text-white transition disabled:opacity-40"
                    title="Наздик кардан (Zoom In)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>

                  <div className="w-[1px] h-5 bg-neutral-700 mx-0.5" />

                  {/* Reset 100% Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={resetZoom}
                    className="h-9 w-9 rounded-xl hover:bg-neutral-800 text-neutral-300 hover:text-white transition"
                    title="Андозаи аввала (100%)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>

                  {/* Fullscreen Toggle */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleFullscreen}
                    className="h-9 w-9 rounded-xl hover:bg-neutral-800 text-neutral-300 hover:text-white transition"
                    title={isFullscreen ? "Баромадан аз тамоми экран" : "Намоиш дар тамоми экран"}
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Strip: Current Floor Apartments Quick Carousel */}
          {currentApartments.length > 0 && (
            <div className="border-t border-border bg-card/80 backdrop-blur-sm p-3 shrink-0">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center justify-between">
                <span>Хонаҳои {activeFloor?.floor_number}-ум ошёна</span>
                <span className="text-[10px] lowercase text-muted-foreground">мушро ба болояш баред ё пахш кунед</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {currentApartments.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.empty;
                  const isHovered = hoveredAptId === a.id;
                  const isSelected = selectedAptId === a.id;
                  const isActiveGreen = isHovered || isSelected;

                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedAptId(a.id);
                        onApartmentClick(a);
                      }}
                      onMouseEnter={() => {
                        setHoveredAptId(a.id);
                        setSelectedAptId(a.id);
                      }}
                      onMouseLeave={() => setHoveredAptId(null)}
                      className={cn(
                        "rounded-xl p-2.5 min-w-[100px] flex flex-col items-center justify-center transition-all shrink-0 shadow",
                        isActiveGreen
                          ? "bg-emerald-500 text-white ring-2 ring-emerald-300 scale-105 shadow-emerald-500/40"
                          : "bg-muted/80 text-foreground hover:bg-muted border border-border/80",
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
