"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Download, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botón de exportar de la Hoja de Ruta.
 *
 * Antes era un link fijo que bajaba el mes en el que estabas parado y siempre
 * con todos los choferes. La oficina pidió (Nico, 31/07/2026) poder elegir un
 * rango de fechas y poder bajar una sola hoja — la del chofer que está abierto —
 * en vez de las de toda la flota.
 *
 * Las tres cosas viven en un solo panel: período (el mes que ves o un rango) y
 * alcance (todos o uno). La descarga es un <a> a /viajes/hoja-ruta/export.
 */

type Props = {
  /** Mes que se está viendo: "YYYY-MM" o "total". */
  mes: string;
  /** Chofer abierto en el panel derecho (null si se está viendo otra cosa). */
  choferId: string | null;
  /** "APELLIDO, Nombre" para mostrar en la opción de una sola hoja. */
  choferLabel: string | null;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function labelMes(mes: string): string {
  if (mes === "total") return "Todo el histórico";
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return "El mes que estás viendo";
  return `${MESES[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

/** Primer y último día del mes que se está viendo (default del rango). */
function limitesDelMes(mes: string): { desde: string; hasta: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  const hoy = new Date();
  const y = m ? parseInt(m[1], 10) : hoy.getFullYear();
  const mm = m ? parseInt(m[2], 10) : hoy.getMonth() + 1;
  const ultimo = new Date(y, mm, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { desde: `${y}-${p(mm)}-01`, hasta: `${y}-${p(mm)}-${p(ultimo)}` };
}

const btnBase =
  "inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted/50";

export default function ExportarHojaRuta({ mes, choferId, choferLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [porRango, setPorRango] = useState(false);
  const [soloChofer, setSoloChofer] = useState(false);
  const limites = useMemo(() => limitesDelMes(mes), [mes]);
  const [desde, setDesde] = useState(limites.desde);
  const [hasta, setHasta] = useState(limites.hasta);
  const ref = useRef<HTMLDivElement>(null);

  // Al cambiar de mes, el rango vuelve a proponer ese mes completo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional: el rango sigue al mes que se está viendo
    setDesde(limites.desde);
    setHasta(limites.hasta);
  }, [limites]);

  // Si no hay un chofer abierto, "una sola hoja" no aplica: se exporta a todos.
  const soloEsteChofer = soloChofer && !!choferId;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const rangoInvertido = porRango && !!desde && !!hasta && desde > hasta;
  const rangoIncompleto = porRango && (!desde || !hasta);
  const puedeDescargar = !rangoInvertido && !rangoIncompleto;

  const href = useMemo(() => {
    const p = new URLSearchParams();
    if (porRango) {
      p.set("desde", desde);
      p.set("hasta", hasta);
    } else {
      p.set("mes", mes);
    }
    if (soloEsteChofer && choferId) p.set("chofer", choferId);
    return `/viajes/hoja-ruta/export?${p.toString()}`;
  }, [porRango, desde, hasta, mes, soloEsteChofer, choferId]);

  const resumen = porRango
    ? rangoIncompleto
      ? "Completá las dos fechas"
      : rangoInvertido
        ? "El desde va antes que el hasta"
        : `Del ${fmt(desde)} al ${fmt(hasta)}`
    : labelMes(mes);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(btnBase, "h-9 gap-1.5 px-3 text-sm font-medium")}
        title="Exportar la hoja de ruta a Excel: todos los choferes o uno solo, por mes o por rango"
      >
        <FileSpreadsheet size={14} className="text-[#10B981]" />
        Exportar a Excel
      </button>

      {open && (
        // En el celular el panel no puede colgar del botón: el botón es angosto
        // y queda a la izquierda, así que `right-0` + 330px lo tiraba casi entero
        // fuera de la pantalla. Abajo de `sm` se centra como mini-modal (mismo
        // patrón que MonthPicker y CalendarioPopover).
        <div className="z-50 rounded-xl border border-border bg-popover p-3 shadow-lg space-y-3 max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-1.5 sm:w-[330px]">
          {/* Período */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Período
            </p>
            <Segmented
              opciones={[
                { v: false, label: labelMes(mes) },
                { v: true, label: "Un rango" },
              ]}
              value={porRango}
              onChange={setPorRango}
            />
            {porRango && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <CampoFecha label="Desde" value={desde} onChange={setDesde} />
                <CampoFecha label="Hasta" value={hasta} onChange={setHasta} />
              </div>
            )}
          </div>

          {/* Alcance: la flota entera o sólo la hoja del chofer abierto */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Choferes
            </p>
            <Segmented
              opciones={[
                { v: false, label: "Todos", title: "Una hoja del Excel por cada chofer con viajes" },
                {
                  v: true,
                  label: choferLabel ? soloTexto(choferLabel) : "Un solo chofer",
                  disabled: !choferId,
                  title: choferId
                    ? `Solo la hoja de ${choferLabel}`
                    : "Abrí un chofer en la lista para exportar su hoja sola",
                },
              ]}
              value={soloEsteChofer}
              onChange={setSoloChofer}
            />
          </div>

          {(rangoInvertido || rangoIncompleto) && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#B45309]">
              <AlertTriangle size={12} className="shrink-0" />
              {rangoInvertido
                ? "La fecha de inicio es posterior a la del final."
                : "Elegí las dos fechas del rango."}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
            <span className="text-[11px] text-muted-foreground">{resumen}</span>
            {puedeDescargar ? (
              <a
                href={href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-md bg-[#0F172A] text-white text-xs font-bold hover:bg-[#1E293B] transition-colors shrink-0"
              >
                <Download size={13} />
                Descargar
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-md bg-muted text-muted-foreground text-xs font-bold cursor-not-allowed shrink-0">
                <Download size={13} />
                Descargar
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** "2026-07-15" → "15/07/2026". Con año: un rango puede cruzar de un año a otro. */
function fmt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "PEREZ, Juan Carlos" → "Solo PEREZ" (el botón es angosto). */
function soloTexto(label: string): string {
  return `Solo ${label.split(",")[0].trim()}`;
}

function Segmented<T extends string | boolean>({
  opciones,
  value,
  onChange,
}: {
  opciones: { v: T; label: string; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border overflow-hidden">
      {opciones.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            title={o.title}
            disabled={o.disabled}
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 px-2 h-9 sm:h-8 text-[11px] font-semibold transition-colors truncate",
              i > 0 && "border-l border-border",
              o.disabled
                ? "bg-card text-muted-foreground/40 cursor-not-allowed"
                : active
                  ? "bg-[#0088D1]/10 text-[#0277BD]"
                  : "bg-card text-muted-foreground hover:bg-muted/40",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CampoFecha({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 sm:h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground outline-none focus:border-[#0088D1] focus:ring-2 focus:ring-[#0088D1]/20"
      />
    </label>
  );
}
