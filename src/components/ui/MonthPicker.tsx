"use client";

import { useEffect, useRef, useState } from "react";
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
function toISO(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
function mesActual(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth());
}
function fmtLabel(v: string): string {
  if (v === "total") return "Histórico";
  const p = parseMes(v);
  return p ? `${MESES_FULL[p.m]} ${p.y}` : "Elegir mes";
}
function shift(v: string, delta: number): string {
  const p = parseMes(v) ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
  const d = new Date(p.y, p.m + delta, 1);
  return toISO(d.getFullYear(), d.getMonth());
}

const btnBase =
  "inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Selector de mes propio (rápido e intuitivo): flechas ‹ › para avanzar/retroceder,
 * y un popup con grilla de meses + navegación de año. Soporta opcionalmente "Total".
 * Valor: "YYYY-MM" (o "total" si allowTotal).
 */
export default function MonthPicker({
  value,
  onChange,
  allowTotal = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  allowTotal?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [yearView, setYearView] = useState(() => parseMes(value)?.y ?? new Date().getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  const isTotal = value === "total";
  const sel = parseMes(value);
  const hoy = mesActual();

  const toggleOpen = () => {
    if (!open) setYearView(parseMes(value)?.y ?? new Date().getFullYear()); // mostrar el año del valor al abrir
    setOpen(!open);
  };

  // Cerrar al hacer click afuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (m: number) => {
    onChange(toISO(yearView, m));
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn("relative inline-flex items-center gap-1", className)}>
      <button
        type="button"
        aria-label="Mes anterior"
        disabled={isTotal}
        onClick={() => onChange(shift(value, -1))}
        className={cn(btnBase, "h-9 w-9")}
      >
        <ChevronLeft size={15} />
      </button>

      <button
        type="button"
        onClick={toggleOpen}
        className={cn(btnBase, "h-9 min-w-[150px] gap-2 px-3 text-sm font-medium")}
      >
        <Calendar size={14} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-center">{fmtLabel(value)}</span>
      </button>

      <button
        type="button"
        aria-label="Mes siguiente"
        disabled={isTotal}
        onClick={() => onChange(shift(value, +1))}
        className={cn(btnBase, "h-9 w-9")}
      >
        <ChevronRight size={15} />
      </button>

      {/* Mismo criterio que CalendarioPopover: en celular se centra como
          mini-modal en vez de colgar del botón, así los 264px nunca se van del
          borde de la pantalla. */}
      {open && (
        <div className="z-50 rounded-xl border border-border bg-popover p-2 shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-1.5 sm:w-[264px]">
          <div className="flex items-center justify-between px-1 py-0.5">
            <button type="button" onClick={() => setYearView((y) => y - 1)} className={cn(btnBase, "h-7 w-7")} aria-label="Año anterior">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-foreground">{yearView}</span>
            <button type="button" onClick={() => setYearView((y) => y + 1)} className={cn(btnBase, "h-7 w-7")} aria-label="Año siguiente">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1">
            {MESES_ABR.map((label, m) => {
              const isSel = !isTotal && sel?.y === yearView && sel?.m === m;
              const isHoy = toISO(yearView, m) === hoy;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(m)}
                  className={cn(
                    "h-9 rounded-md text-xs font-medium capitalize transition-colors",
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : isHoy
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-1 flex items-center justify-between border-t border-border px-1 pt-2">
            <button
              type="button"
              onClick={() => { onChange(hoy); setOpen(false); }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Este mes
            </button>
            {allowTotal && (
              <button
                type="button"
                onClick={() => { onChange("total"); setOpen(false); }}
                className={cn(
                  "text-xs hover:underline",
                  isTotal ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                Histórico (todos)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
