"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"];

export type CeldaCalendario = {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
};

/** Marca visual de un día (fondo + tooltip), como los días guardados de la planilla. */
export type MarcaDia = { className: string; title?: string };

/** Las 42 celdas del mes de `ancla` ("YYYY-MM-DD"), con el relleno de los meses vecinos. */
export function celdasDelMes(ancla: Date): CeldaCalendario[] {
  const year = ancla.getFullYear();
  const month = ancla.getMonth();
  const startDay = new Date(year, month, 1).getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  const cells: CeldaCalendario[] = [];
  const fecha = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevDaysInMonth - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ dateStr: fecha(y, m, d), dayNum: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: fecha(year, month, d), dayNum: d, isCurrentMonth: true });
  }

  for (let d = 1; d <= 42 - cells.length; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ dateStr: fecha(y, m, d), dayNum: d, isCurrentMonth: false });
  }

  return cells;
}

type Props = {
  /** Día seleccionado "YYYY-MM-DD"; null cuando el período no es un día suelto. */
  value: string | null;
  onSelect: (fecha: string) => void;
  /** Texto del botón que abre el calendario. */
  triggerLabel: ReactNode;
  /** Última fecha elegible "YYYY-MM-DD": las posteriores quedan deshabilitadas. */
  maxDate?: string;
  /** Primera fecha elegible "YYYY-MM-DD": las anteriores quedan deshabilitadas. */
  minDate?: string;
  /** Día que lleva el puntito de referencia (normalmente hoy). */
  hoy?: string;
  /** Resalte por día — días con datos, con cambios, etc. */
  marca?: (fecha: string) => MarcaDia | undefined;
  /** Mes abierto al inicio "YYYY-MM"; por defecto el de `value` o el de hoy. */
  mesInicial?: string;
  /** Pie del popover: leyenda o atajos. Recibe el cierre para poder usarlo. */
  pie?: (cerrar: () => void) => ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
};

/**
 * Selector de fecha con la grilla mensual de la planilla diaria: un botón que
 * abre un popover con el mes navegable y los días resaltables. Compartido para
 * que caja y planilla diaria elijan fecha de la misma manera.
 */
export default function CalendarioPopover({
  value,
  onSelect,
  triggerLabel,
  maxDate,
  minDate,
  hoy,
  marca,
  mesInicial,
  pie,
  triggerClassName = "",
  ariaLabel = "Elegir fecha",
}: Props) {
  const [open, setOpen] = useState(false);
  const [mesVisible, setMesVisible] = useState(() => {
    const base = value ?? (mesInicial ? `${mesInicial}-01` : null);
    return base ? new Date(base + "T00:00:00") : new Date();
  });

  const celdas = useMemo(() => celdasDelMes(mesVisible), [mesVisible]);

  const moverMes = (delta: number) =>
    setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + delta, 1));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] flex items-center gap-2 font-medium min-w-[130px] hover:bg-muted/30 transition-colors ${triggerClassName}`}
      >
        <CalendarClock size={15} className="text-[#0088D1]" />
        {triggerLabel}
      </button>

      {open && (
        <>
          {/* Backdrop para cerrar al hacer clic afuera */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-[42px] left-0 z-50 bg-card border border-border shadow-lg rounded-[8px] p-4 w-[280px]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm text-foreground">
                {MESES[mesVisible.getMonth()]} de {mesVisible.getFullYear()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moverMes(-1)}
                  aria-label="Mes anterior"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moverMes(1)}
                  aria-label="Mes siguiente"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1">
              {DIAS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {celdas.map((cell) => {
                const isSelected = cell.dateStr === value;
                const isToday = cell.dateStr === hoy;
                const deshabilitado =
                  (!!maxDate && cell.dateStr > maxDate) || (!!minDate && cell.dateStr < minDate);
                const resalte = marca?.(cell.dateStr);

                let btnClass =
                  "h-8 w-8 text-xs rounded-full flex items-center justify-center transition-colors relative ";
                if (!cell.isCurrentMonth) btnClass += "text-muted-foreground/30 ";
                else if (deshabilitado) btnClass += "text-muted-foreground/30 cursor-not-allowed ";
                else btnClass += "text-foreground hover:bg-muted/60 ";

                if (isSelected) {
                  btnClass += "bg-[#0088D1] text-white hover:bg-[#0088D1] font-bold ";
                } else if (resalte && cell.isCurrentMonth && !deshabilitado) {
                  btnClass += resalte.className + " ";
                }

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    disabled={deshabilitado}
                    title={resalte?.title}
                    onClick={() => {
                      onSelect(cell.dateStr);
                      setOpen(false);
                    }}
                    className={btnClass}
                  >
                    {cell.dayNum}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 size-1 bg-[#0088D1] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {pie && (
              <div className="mt-3 pt-2.5 border-t border-border">{pie(() => setOpen(false))}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
