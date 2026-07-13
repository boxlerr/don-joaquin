"use client";

// Selector de mes de métricas: flechas ‹ ›, popup con grilla anual que marca
// QUÉ meses tienen planillas cargadas (punto azul), acceso directo a "Hoy"
// (mes actual, en vivo) y al último mes con datos.

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseMes(v: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}$/.test(v)) return null;
  const [y, m] = v.split("-").map(Number);
  return { y, m: m - 1 };
}
const toISO = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

function shift(v: string, delta: number): string {
  const p = parseMes(v)!;
  const d = new Date(p.y, p.m + delta, 1);
  return toISO(d.getFullYear(), d.getMonth());
}

const btnBase =
  "inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed";

export default function MesSelectorMetricas({
  value, mesesDisponibles, hoyMes,
}: {
  /** Mes visto, YYYY-MM. */
  value: string;
  /** Meses con planillas (ISO día 1). */
  mesesDisponibles: string[];
  /** Mes calendario actual (ISO día 1). */
  hoyMes: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const sel = parseMes(value);
  const [yearView, setYearView] = useState(() => sel?.y ?? new Date().getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  const disponibles = new Set(mesesDisponibles.map((m) => m.slice(0, 7)));
  const hoy = hoyMes.slice(0, 7);
  const ultimoConDatos = mesesDisponibles.length ? mesesDisponibles[0].slice(0, 7) : null;

  const irA = (mes: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", mes);
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

  const label = sel ? `${MESES_FULL[sel.m]} ${sel.y}` : "Elegir mes";
  const esHoy = value === hoy;
  const tieneDatos = disponibles.has(value);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => irA(shift(value, -1))}
        className={cn(btnBase, "h-9 w-9")}
      >
        <ChevronLeft size={15} />
      </button>

      <button
        type="button"
        onClick={() => {
          if (!open) setYearView(sel?.y ?? new Date().getFullYear());
          setOpen(!open);
        }}
        className={cn(btnBase, "h-9 min-w-[170px] gap-2 px-3 text-sm font-medium")}
      >
        <Calendar size={14} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            tieneDatos ? "bg-primary" : esHoy ? "bg-amber-500" : "bg-muted-foreground/30",
          )}
          title={tieneDatos ? "Mes con planillas cargadas" : esHoy ? "Mes actual: datos en vivo del sistema" : "Sin planillas cargadas"}
        />
      </button>

      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => irA(shift(value, 1))}
        className={cn(btnBase, "h-9 w-9")}
      >
        <ChevronRight size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYearView(yearView - 1)} className={cn(btnBase, "h-7 w-7")}>
              <ChevronLeft size={13} />
            </button>
            <span className="text-sm font-semibold text-foreground">{yearView}</span>
            <button type="button" onClick={() => setYearView(yearView + 1)} className={cn(btnBase, "h-7 w-7")}>
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESES_ABR.map((abr, m) => {
              const iso = toISO(yearView, m);
              const activo = value === iso;
              const conDatos = disponibles.has(iso);
              const esMesHoy = iso === hoy;
              return (
                <button
                  key={abr}
                  type="button"
                  onClick={() => irA(iso)}
                  className={cn(
                    "relative flex h-9 flex-col items-center justify-center rounded-md text-xs font-medium capitalize transition-colors",
                    activo ? "bg-primary text-primary-foreground"
                      : conDatos ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/50 hover:bg-muted/50",
                    esMesHoy && !activo ? "ring-1 ring-primary/40" : "",
                  )}
                  title={conDatos ? "Con planillas cargadas" : esMesHoy ? "Mes actual (en vivo)" : "Sin planillas"}
                >
                  {abr}
                  <span className={cn(
                    "absolute bottom-1 h-1 w-1 rounded-full",
                    conDatos ? (activo ? "bg-primary-foreground" : "bg-primary") : "bg-transparent",
                  )} />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => irA(hoy)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Hoy (en vivo)
            </button>
            {ultimoConDatos && (
              <button
                type="button"
                onClick={() => irA(ultimoConDatos)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Último con planillas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
