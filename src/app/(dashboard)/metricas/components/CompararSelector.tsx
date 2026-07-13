"use client";

// Selector de mes de comparación: elegís cualquier otro mes (con planillas o
// en vivo) y el dashboard suma la comparación en KPIs y tablas (?compare=).

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GitCompareArrows, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { mesLabel } from "./format";

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default function CompararSelector({
  compare, mesActual, mesesDisponibles, hoyMes,
}: {
  /** Mes de comparación activo (YYYY-MM) o null. */
  compare: string | null;
  /** Mes visto (ISO día 1) — no se puede comparar contra sí mismo. */
  mesActual: string;
  mesesDisponibles: string[];
  hoyMes: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [yearView, setYearView] = useState(() =>
    parseInt((compare ?? mesActual).slice(0, 4), 10));
  const ref = useRef<HTMLDivElement>(null);

  const disponibles = new Set(mesesDisponibles.map((m) => m.slice(0, 7)));
  const hoy = hoyMes.slice(0, 7);

  const setCompare = (mes: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mes) params.set("compare", mes);
    else params.delete("compare");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className={cn(
        "flex items-center gap-1 rounded-lg border px-2 h-8 text-xs font-medium transition-colors",
        compare ? "border-violet-400/60 bg-violet-500/5 text-violet-700" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}>
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5" title="Comparar contra otro mes">
          <GitCompareArrows size={13} />
          {compare ? `vs ${mesLabel(`${compare}-01`)}` : "Comparar con…"}
        </button>
        {compare && (
          <button type="button" onClick={() => setCompare(null)} title="Quitar comparación" className="hover:text-red-500 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYearView(yearView - 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted/50">
              <ChevronLeft size={13} />
            </button>
            <span className="text-sm font-semibold text-foreground">{yearView}</span>
            <button type="button" onClick={() => setYearView(yearView + 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted/50">
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESES_ABR.map((abr, m) => {
              const iso = `${yearView}-${String(m + 1).padStart(2, "0")}`;
              const esMesVisto = `${iso}-01` === mesActual;
              const conDatos = disponibles.has(iso);
              const enVivo = !conDatos && iso <= hoy;
              const activo = compare === iso;
              return (
                <button
                  key={abr}
                  type="button"
                  disabled={esMesVisto || (!conDatos && !enVivo)}
                  onClick={() => setCompare(iso)}
                  className={cn(
                    "relative flex h-9 flex-col items-center justify-center rounded-md text-xs font-medium capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                    activo ? "bg-violet-600 text-white"
                      : conDatos ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/60 hover:bg-muted/50",
                  )}
                  title={esMesVisto ? "Es el mes que estás viendo" : conDatos ? "Con planillas" : enVivo ? "En vivo (desde viajes)" : "Sin datos"}
                >
                  {abr}
                  <span className={cn(
                    "absolute bottom-1 h-1 w-1 rounded-full",
                    conDatos ? (activo ? "bg-white" : "bg-primary") : "bg-transparent",
                  )} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
            La comparación aparece en los KPIs y como columnas extra en las tablas.
          </p>
        </div>
      )}
    </div>
  );
}
