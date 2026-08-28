import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function ProductRail({ children, label }: { children: ReactNode; label: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.72, 260), behavior: "smooth" });
  };

  return (
    <div className="product-rail-shell">
      <button
        className="rail-arrow rail-arrow-left"
        type="button"
        aria-label={`Ver productos anteriores en ${label}`}
        onClick={() => move(-1)}
        disabled={!canScrollLeft}
      >
        ‹
      </button>
      <div className="product-grid" ref={railRef}>
        {children}
      </div>
      <button
        className="rail-arrow rail-arrow-right"
        type="button"
        aria-label={`Ver más productos en ${label}`}
        onClick={() => move(1)}
        disabled={!canScrollRight}
      >
        ›
      </button>
    </div>
  );
}
