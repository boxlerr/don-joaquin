"use client";

// Lo que no entra en la barra: a qué plataforma va el documento, si el papel
// está digitalizado y en qué ventana vence. Van en un panel y no sueltos, que
// la barra ya tiene el buscador, el tipo, el estado y el alcance.
//
// Mismo patrón que el popover de Legajos y el de la flota (cerrar por click
// afuera o Escape, y mini-modal centrado en celular): dos paneles de filtros
// que se comportan distinto se sienten como dos sistemas.

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type {
  FiltroArchivo,
  FiltroPlataforma,
  FiltroVence,
  FiltrosCompliance,
} from "./ComplianceResumen";

const PLATAFORMA: { id: FiltroPlataforma; label: string }[] = [
  { id: "AMBOS", label: "Va a todas" },
  { id: "YPF", label: "Solo YPF" },
  { id: "LOMA_NEGRA", label: "Solo Loma" },
];

const ARCHIVO: { id: FiltroArchivo; label: string; ayuda: string }[] = [
  { id: "con", label: "Con archivo", ayuda: "El papel está digitalizado en el sistema." },
  {
    id: "sin",
    label: "Sin archivo",
    ayuda: "Se anotó el vencimiento pero no se adjuntó el documento.",
  },
];

const VENCE: { id: FiltroVence; label: string }[] = [
  { id: "30", label: "30 días" },
  { id: "60", label: "60 días" },
  { id: "90", label: "90 días" },
];

/** Cuántos de los tres avanzados están puestos. */
export function contarAvanzados(f: FiltrosCompliance): number {
  return (
    (f.plataforma !== "todos" ? 1 : 0) + (f.archivo !== "todos" ? 1 : 0) + (f.vence !== "todos" ? 1 : 0)
  );
}

function Chip({
  label,
  activo,
  onToggle,
  title,
}: {
  label: string;
  activo: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={activo}
      title={title}
      className={`inline-flex min-h-9 items-center rounded-[6px] border px-2.5 py-1 text-[12px] transition-colors sm:min-h-0 sm:px-2 ${
        activo
          ? "border-primary/60 bg-primary/5 font-medium text-primary"
          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Grupo({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {ayuda && <p className="text-[11px] leading-snug text-muted-foreground/80">{ayuda}</p>}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function FiltrosAvanzadosCompliance({
  filtros,
  onChange,
}: {
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const activos = contarAvanzados(filtros);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      // Sin esto el foco se cae al <body> y hay que retabular desde arriba.
      disparador.current?.focus();
    };
    // `mousedown` y no `click`: si no, cerrar el panel dispara además el click
    // de lo que haya debajo.
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  /** Los grupos de una sola opción se apagan tocando la que ya estaba puesta. */
  const elegir = <K extends "plataforma" | "archivo" | "vence">(
    clave: K,
    valor: FiltrosCompliance[K],
  ) => onChange({ ...filtros, [clave]: filtros[clave] === valor ? "todos" : valor });

  return (
    <div className="relative shrink-0 sm:self-stretch" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        ref={disparador}
        // Lleva el conteo, que si no se leería pegado al texto ("Filtros2").
        aria-label={activos > 0 ? `Más filtros: ${activos} puesto${activos !== 1 ? "s" : ""}` : "Más filtros"}
        className={`inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition-colors sm:h-[52px] sm:w-auto ${
          activos > 0
            ? "border-primary/50 bg-primary/5 text-primary"
            : "border-border bg-card text-foreground hover:bg-muted"
        }`}
      >
        <SlidersHorizontal size={14} />
        Más filtros
        {activos > 0 && (
          <span className="rounded-[4px] bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
            {activos}
          </span>
        )}
      </button>

      {abierto && (
        // En celular no puede colgar del botón: es más ancho que la pantalla.
        // Ahí va como mini-modal centrado.
        <div
          data-panel-filtros
          className="z-50 space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:max-h-[80dvh] max-sm:-translate-y-1/2 max-sm:overflow-y-auto sm:absolute sm:right-0 sm:top-full sm:mt-1.5 sm:w-[21rem]"
        >
          <Grupo titulo="Plataforma" ayuda="A quién se le presenta ese documento.">
            {PLATAFORMA.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                activo={filtros.plataforma === o.id}
                onToggle={() => elegir("plataforma", o.id)}
              />
            ))}
          </Grupo>

          <Grupo titulo="Archivo adjunto">
            {ARCHIVO.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                title={o.ayuda}
                activo={filtros.archivo === o.id}
                onToggle={() => elegir("archivo", o.id)}
              />
            ))}
          </Grupo>

          <Grupo titulo="Vence dentro de" ayuda="Solo los que todavía no vencieron.">
            {VENCE.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                activo={filtros.vence === o.id}
                onToggle={() => elegir("vence", o.id)}
              />
            ))}
          </Grupo>

          {activos > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...filtros, plataforma: "todos", archivo: "todos", vence: "todos" })}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[6px] border border-border text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-auto sm:py-1.5"
            >
              <X size={12} />
              Limpiar {activos} filtro{activos !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
