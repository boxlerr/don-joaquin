"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { RangoKey } from "./lib";

interface Props {
  rangoActual: RangoKey;
  desdeActual: string;
  hastaActual: string;
  /** Agrega el chip "Total" (histórico completo). */
  incluirTotal?: boolean;
}

const CHIPS: Array<{ key: RangoKey; label: string }> = [
  { key: "1m", label: "Último mes" },
  { key: "3m", label: "3 meses" },
  { key: "1y", label: "1 año" },
];

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const dosDig = (n: number) => String(n).padStart(2, "0");
/** Primer y último día de un mes, en ISO local (sin pasar por UTC). */
const rangoDelMes = (y: number, m: number) => ({
  desde: `${y}-${dosDig(m + 1)}-01`,
  hasta: `${y}-${dosDig(m + 1)}-${dosDig(new Date(y, m + 1, 0).getDate())}`,
});

/** Si el rango es exactamente un mes calendario, devuelve {y, m}. */
function mesExacto(desde: string, hasta: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return null;
  const [y, m] = desde.split("-").map(Number);
  const r = rangoDelMes(y, m - 1);
  return r.desde === desde && r.hasta === hasta ? { y, m: m - 1 } : null;
}

export default function PeriodoSelector({
  rangoActual,
  desdeActual,
  hastaActual,
  incluirTotal,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mesOpen, setMesOpen] = useState(false);
  const [desde, setDesde] = useState(desdeActual);
  const [hasta, setHasta] = useState(hastaActual);
  const popRef = useRef<HTMLDivElement>(null);
  const mesRef = useRef<HTMLDivElement>(null);

  // Si el período vigente es justo un mes, el botón lo muestra y lo marca.
  const mesSel = rangoActual === "custom" ? mesExacto(desdeActual, hastaActual) : null;
  const [yearView, setYearView] = useState(() => mesSel?.y ?? new Date().getFullYear());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setDesde(desdeActual);
    setHasta(hastaActual);
  }, [desdeActual, hastaActual]);

  useEffect(() => {
    if (!open && !mesOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t)) setOpen(false);
      if (mesRef.current && !mesRef.current.contains(t)) setMesOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, mesOpen]);

  const irA = (rango: RangoKey, extra?: { desde: string; hasta: string }) => {
    const params = new URLSearchParams();
    params.set("rango", rango);
    if (rango === "custom" && extra) {
      params.set("desde", extra.desde);
      params.set("hasta", extra.hasta);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const onChipClick = (rango: RangoKey) => {
    setOpen(false);
    setMesOpen(false);
    irA(rango);
  };

  const onCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desde || !hasta || desde > hasta) return;
    setOpen(false);
    irA("custom", { desde, hasta });
  };

  const elegirMes = (y: number, m: number) => {
    setMesOpen(false);
    irA("custom", rangoDelMes(y, m));
  };

  const customActivo = rangoActual === "custom" && !mesSel;
  const customInvalido = !desde || !hasta || desde > hasta;
  const chips = incluirTotal
    ? [...CHIPS, { key: "total" as RangoKey, label: "Total" }]
    : CHIPS;

  const chipClase = (activo: boolean) =>
    `inline-flex items-center h-9 sm:h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
      activo
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  const hoy = new Date();

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-1.5">
      {chips.map((chip) => (
        <button key={chip.key} type="button" onClick={() => onChipClick(chip.key)} className={chipClase(rangoActual === chip.key)}>
          {chip.label}
        </button>
      ))}

      {/* Elegir UN mes: es lo que más se usa y con dos date pickers costaba. */}
      <div className="relative" ref={mesRef}>
        <button
          type="button"
          onClick={() => { setMesOpen((v) => !v); setOpen(false); }}
          className={`${chipClase(!!mesSel)} gap-1.5`}
        >
          <Calendar size={14} />
          {mesSel ? `${MESES_FULL[mesSel.m]} ${mesSel.y}` : "Elegir mes"}
        </button>

        {mesOpen && (
          /* En celular se centra como mini-modal (mismo criterio que MonthPicker):
             colgando del botón, los 256px se iban del borde de la pantalla. */
          <div className="z-30 rounded-lg border border-border bg-card p-3 shadow-md max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-64">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setYearView((y) => y - 1)}
                className="inline-flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
                aria-label="Año anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-foreground">{yearView}</span>
              <button
                type="button"
                onClick={() => setYearView((y) => y + 1)}
                disabled={yearView >= hoy.getFullYear()}
                className="inline-flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                aria-label="Año siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MESES_ABR.map((abr, m) => {
                const futuro = yearView > hoy.getFullYear() || (yearView === hoy.getFullYear() && m > hoy.getMonth());
                const activo = mesSel?.y === yearView && mesSel.m === m;
                return (
                  <button
                    key={abr}
                    type="button"
                    disabled={futuro}
                    onClick={() => elegirMes(yearView, m)}
                    className={`h-9 sm:h-8 rounded-md text-sm font-medium capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      activo
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {abr}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => elegirMes(hoy.getFullYear(), hoy.getMonth())}
              className="mt-2 h-9 sm:h-auto w-full rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Este mes
            </button>
          </div>
        )}
      </div>

      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setMesOpen(false); }}
          className={`${chipClase(customActivo)} gap-1.5`}
        >
          Otro rango
        </button>

        {open && (
          <form
            onSubmit={onCustomSubmit}
            className="z-30 bg-card border border-border rounded-lg shadow-md p-3 space-y-2.5 max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-72"
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full h-9 sm:h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full h-9 sm:h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <button
              type="submit"
              disabled={customInvalido}
              className="w-full inline-flex items-center justify-center gap-1.5 h-9 sm:h-8 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={14} />
              Aplicar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
