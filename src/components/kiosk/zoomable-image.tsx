import { useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export function ZoomableImage({ src, alt = "" }: { src: string; alt?: string }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const clamp = (s: number) => Math.min(6, Math.max(1, s));

  const zoomAt = useCallback((delta: number, cx?: number, cy?: number, rect?: DOMRect) => {
    setScale((prev) => {
      const next = clamp(prev * delta);
      if (rect && cx != null && cy != null) {
        const ox = cx - rect.left - rect.width / 2;
        const oy = cy - rect.top - rect.height / 2;
        setTx((t) => t + (ox - (ox - t) * (next / prev)) - t);
        setTy((t) => t + (oy - (oy - t) * (next / prev)) - t);
      }
      if (next === 1) { setTx(0); setTy(0); }
      return next;
    });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY, rect);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setTx(dragging.current.tx + (e.clientX - dragging.current.x));
    setTy(dragging.current.ty + (e.clientY - dragging.current.y));
  };
  const onPointerUp = () => { dragging.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch.current = { dist: Math.hypot(dx, dy), scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      setScale(clamp(pinch.current.scale * (d / pinch.current.dist)));
    }
  };
  const onTouchEnd = () => { pinch.current = null; };

  const reset = () => { setScale(1); setTx(0); setTy(0); };

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none touch-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2))}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 m-auto max-h-full max-w-full object-contain will-change-transform"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: dragging.current || pinch.current ? "none" : "transform 0.15s",
          cursor: scale > 1 ? "grab" : "zoom-in",
        }}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-2 bg-background/90 backdrop-blur rounded-xl border border-border shadow-lg p-1.5">
        <button onClick={() => setScale((s) => clamp(s * 1.3))}
          className="h-11 w-11 rounded-lg hover:bg-muted flex items-center justify-center" aria-label="Наздик">
          <ZoomIn className="h-5 w-5" />
        </button>
        <button onClick={() => setScale((s) => clamp(s / 1.3))}
          className="h-11 w-11 rounded-lg hover:bg-muted flex items-center justify-center" aria-label="Дур">
          <ZoomOut className="h-5 w-5" />
        </button>
        <button onClick={reset}
          className="h-11 w-11 rounded-lg hover:bg-muted flex items-center justify-center" aria-label="Аслӣ">
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>
      {scale > 1 && (
        <div className="absolute top-3 left-3 text-xs bg-background/80 backdrop-blur rounded-md px-2 py-1 border border-border">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
