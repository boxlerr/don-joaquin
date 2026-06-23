"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Wrapper para tiras horizontales (tabs, chips, etc.) que indica visualmente
 * cuándo hay más contenido del lado derecho/izquierdo y permite scrollear con
 * un click en las flechitas. Las flechitas y los fades aparecen SOLO cuando
 * realmente hay overflow — en pantallas grandes donde entra todo, no se ven.
 */
export default function HorizontalScrollHint({
  children,
  className = "",
  fadeBg = "from-muted/40",
}: {
  children: React.ReactNode;
  className?: string;
  /** Clase Tailwind del color del gradient (debe coincidir con el fondo del contenedor). */
  fadeBg?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasRight, setHasRight] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setHasLeft(el.scrollLeft > 2);
      setHasRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  const scrollBy = (dx: number) => {
    ref.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} className={`overflow-x-auto ${className}`} style={{ scrollbarWidth: "thin" }}>
        {children}
      </div>

      {hasLeft && (
        <>
          <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r ${fadeBg} to-transparent`} />
          <button
            type="button"
            onClick={() => scrollBy(-200)}
            aria-label="Anterior"
            className="absolute left-1 top-1/2 -translate-y-1/2 size-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        </>
      )}

      {hasRight && (
        <>
          <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l ${fadeBg} to-transparent`} />
          <button
            type="button"
            onClick={() => scrollBy(200)}
            aria-label="Siguiente"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}
