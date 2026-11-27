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
  Tag,
  ArrowRight,
  Info,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type PinCoord = { slot: number; x: number; y: number };

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

  // Zoom / Pan state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const draggingCanvas = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
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
    const defaults: PinCoord[] = [];
    for (let i = 0; i < total; i++) {
      defaults.push({ slot: i, ...getDefaultPinPosition(i, total) });
    }
    setPins(defaults);
    toast.info("Мавқеъҳо ба ҳолати пешфарз баргардонида шуданд. Барои тасдиқ «Сабт»-ро пахш кунед.");
  }

  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId);
  const activeAptCfg = activeApt ? STATUS_CONFIG[activeApt.status] ?? STATUS_CONFIG.empty : null;

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

      {/* Main Container: Left Sidebar (Floors + Apartment Card) + Scheme Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Floors List + Dedicated Apartment Detail Card */}
        <div className="w-72 sm:w-80 shrink-0 border-r border-border bg-card/75 flex flex-col overflow-hidden">
          {/* Floor Selector Header */}
          <div className="p-3 border-b border-border/80 flex items-center justify-between shrink-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Ошёнаҳо
            </div>
            <span className="text-xs text-muted-foreground font-mono">{sortedFloors.length} ошёна</span>
          </div>

          {/* Floors Scrollable List */}
          <div className="max-h-48 sm:max-h-56 overflow-y-auto p-2 space-y-1 shrink-0 border-b border-border/80">
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
                    "w-full text-left p-2 rounded-xl transition flex items-center justify-between group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.01]"
                      : "hover:bg-muted/70 text-card-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-foreground border border-border/60"
                      )}
                    >
                      {f.floor_number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {f.floor_number === 0 ? "Цокол" : `${f.floor_number}-ум ошёна`}
                      </div>
                      <div
                        className={cn(
                          "text-[10px] truncate",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {apts.length > 0 ? `${apts.length} квартира` : "Хона нест"}
                      </div>
                    </div>
                  </div>

                  {apts.length > 0 && (
                    <div className="shrink-0 flex items-center gap-1">
                      {emptyCount > 0 ? (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold",
                            isActive
                              ? "bg-primary-foreground text-primary"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          )}
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

          {/* DEDICATED APARTMENT CARD (Карточкаи хона) */}
          <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-card/40">
            {activeApt && activeAptCfg ? (
              <div className="flex-1 flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-card to-background p-4 shadow-lg animate-in fade-in duration-150 relative overflow-hidden">
                {/* Background decorative glow */}
                <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

                <div className="space-y-3.5 relative">
                  {/* Card Header: Badge & Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-emerald-400" />
                      Карточкаи хона
                    </span>
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 shadow-sm",
                        activeAptCfg.bg,
                        "text-white",
                        activeAptCfg.border
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {activeAptCfg.label}
                    </span>
                  </div>

                  {/* Big Apartment Title */}
                  <div className="border-b border-border/80 pb-3">
                    <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-baseline gap-2">
                      <span className="text-emerald-400">№{activeApt.apartment_number}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        ({activeFloor?.floor_number}-ум ошёна)
                      </span>
                    </div>
                  </div>

                  {/* Apartment Specs Grid */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {/* Area (Квадрат) */}
                    <div className="bg-muted/60 rounded-xl p-2.5 border border-border/60">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                        <Maximize2 className="h-3 w-3 text-emerald-400" />
                        Масоҳат
                      </div>
                      <div className="text-lg font-black text-foreground mt-0.5">
                        {activeApt.area ? `${activeApt.area} м²` : "—"}
                      </div>
                    </div>

                    {/* Rooms / Type */}
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
                </div>

                {/* Open Modal / Purchase Button */}
                <div className="pt-3">
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
                      : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
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
            className="flex-1 relative overflow-hidden bg-neutral-950 flex items-center justify-center touch-none select-none"
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
            onPointerCancel={handlePointerUpCanvas}
            onDoubleClick={resetZoom}
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
                  const isSelected = selectedAptId === apt.id;
                  const isActiveGreen = isHovered || isSelected;

                  // If showPins is false, show pin ONLY if user specifically hovered/selected this apartment
                  const isVisible = showPins || isEditing || isActiveGreen;
                  if (!isVisible) return null;

                  return (
                    <div
                      key={apt.id}
                      style={{
                        left: `${coord.x}%`,
                        top: `${coord.y}%`,
                        zIndex: isActiveGreen ? 50 : 20,
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
                        "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group",
                        isActiveGreen ? "scale-115 z-50" : "scale-100",
                        isEditing && "cursor-move ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
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
                              ? "bg-emerald-500 text-white border-white scale-125 ring-4 ring-emerald-400/50 shadow-[0_0_22px_rgba(16,185,129,0.95)]"
                              : "bg-neutral-900/90 text-white border-neutral-600/80 shadow-md hover:border-emerald-400 hover:scale-110",
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
                            isEditing && "ring-2 ring-amber-400"
                          )}
                        >
                          <div className="flex items-center gap-1 leading-none">
                            <span
                              className={cn(
                                "text-sm sm:text-base font-black tracking-tight drop-shadow",
                                isActiveGreen ? "text-white" : "text-neutral-100"
                              )}
                            >
                              №{apt.apartment_number}
                            </span>
                          </div>
                          {apt.area ? (
                            <div
                              className={cn(
                                "text-[9px] sm:text-[10px] font-medium leading-tight mt-0.5",
                                isActiveGreen ? "text-emerald-100 font-bold" : "text-neutral-300"
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

                      {/* Floating Tooltip on Hover / Selection */}
                      {!isEditing && (
                        <div
                          className={cn(
                            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-neutral-900/95 text-white text-[11px] rounded-xl shadow-2xl border border-white/15 whitespace-nowrap pointer-events-none transition-all duration-150 z-50",
                            isActiveGreen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"
                          )}
                        >
                          <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <span>Хонаи №{apt.apartment_number}</span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-white/90 font-normal">{cfg.label}</span>
                          </div>
                          {apt.area && (
                            <div className="text-[10px] text-neutral-300 font-mono">
                              Масоҳат: <strong className="text-white">{apt.area} м²</strong>
                            </div>
                          )}
                          {apt.price ? (
                            <div className="text-emerald-300 font-mono text-[10px] font-bold">
                              {Number(apt.price).toLocaleString()} TJS
                            </div>
                          ) : null}
                          <div className="text-[9px] text-neutral-400 mt-0.5">Барои тафсилот пахш кунед</div>
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
                          : "bg-muted/80 text-foreground hover:bg-muted border border-border/80"
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
