"use client";

// Lo que no entra en la barra: localidad, marca del camión, si tiene camión,
// antigüedad y si el legajo está completo. Van en un panel y no sueltos, que la
// barra ya tiene las áreas, el estado, el orden, el buscador y los accesos
// rápidos.
//
// Mismo patrón que el popover de la flota (cerrar por click afuera o Escape, y
// mini-modal centrado en celular): dos paneles de filtros que se comportan
// distinto se sienten como dos sistemas.

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  ANTIGUEDAD_LABEL,
  CAMION_LABEL,
  FILTROS_AVANZADOS_VACIOS,
  LEGAJO_LABEL,
  contarAvanzados,
  type AntiguedadFiltro,
  type CamionFiltro,
  type FiltrosAvanzados,
  type LegajoFiltro,
  type Opcion,
} from "../filtros";

function Chip({
  label,
  n,
  activo,
  onToggle,
}: {
  label: string;
  n?: number;
  activo: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={activo}
      // El conteo es un `<span>` pegado al texto: sin esto se lee "AZUL13".
      aria-label={n != null ? `${label}: ${n}` : label}
      className={`inline-flex min-h-9 items-center rounded-[6px] border px-2.5 py-1 text-[12px] transition-colors sm:min-h-0 sm:px-2 ${
        activo
          ? "border-primary/60 bg-primary/5 font-medium text-primary"
          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {label}
      {n != null && (
        <span
          className={`ml-1 tabular-nums ${activo ? "text-primary/70" : "text-muted-foreground/80"}`}
        >
          {n}
        </span>
      )}
    </button>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function FiltrosAvanzadosPopover({
  filtros,
  onChange,
  localidades,
  marcas,
}: {
  filtros: FiltrosAvanzados;
  onChange: (f: FiltrosAvanzados) => void;
  localidades: Opcion[];
  marcas: Opcion[];
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

  /** Prende o apaga un valor de una lista (localidades, marcas). */
  const toggleLista = (clave: "localidades" | "marcas", valor: string) => {
    const actual = filtros[clave];
    onChange({
      ...filtros,
      [clave]: actual.includes(valor)
        ? actual.filter((v) => v !== valor)
        : [...actual, valor],
    });
  };

  /** Los grupos de una sola opción se apagan tocando la que ya estaba puesta. */
  const elegir = <K extends "camion" | "antiguedad" | "legajo">(
    clave: K,
    valor: FiltrosAvanzados[K],
    vacio: FiltrosAvanzados[K],
  ) => onChange({ ...filtros, [clave]: filtros[clave] === valor ? vacio : valor });

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        ref={disparador}
        // Lleva el conteo, que si no se leería pegado al texto ("Filtros
        // avanzados2"). Empieza con el texto visible, como pide WCAG 2.5.3.
        aria-label={
          activos > 0
            ? `Filtros avanzados: ${activos} puesto${activos !== 1 ? "s" : ""}`
            : "Filtros avanzados"
        }
        className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
          activos > 0
            ? "border-primary/50 bg-primary/5 text-primary"
            : "border-border bg-card text-foreground hover:bg-muted"
        }`}
      >
        <SlidersHorizontal size={14} />
        <span className="hidden sm:inline">Filtros avanzados</span>
        <span className="sm:hidden">Filtros</span>
        {activos > 0 && (
          <span className="ml-0.5 rounded-[4px] bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
            {activos}
          </span>
        )}
      </button>

      {abierto && (
        // En celular no puede colgar del botón: es más ancho que la pantalla y
        // la tarjeta que lo contiene recorta. Ahí va como mini-modal centrado.
        <div
          data-panel-filtros
          className="z-50 space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:max-h-[80dvh] max-sm:-translate-y-1/2 max-sm:overflow-y-auto sm:absolute sm:right-0 sm:top-full sm:mt-1.5 sm:w-[24rem]"
        >
          {localidades.length > 1 && (
            <Grupo titulo="Localidad">
              {localidades.map((o) => (
                <Chip
                  key={o.valor}
                  label={o.label}
                  n={o.n}
                  activo={filtros.localidades.includes(o.valor)}
                  onToggle={() => toggleLista("localidades", o.valor)}
                />
              ))}
            </Grupo>
          )}

          {marcas.length > 1 && (
            <Grupo titulo="Marca del camión">
              {marcas.map((o) => (
                <Chip
                  key={o.valor}
                  label={o.label}
                  n={o.n}
                  activo={filtros.marcas.includes(o.valor)}
                  onToggle={() => toggleLista("marcas", o.valor)}
                />
              ))}
            </Grupo>
          )}

          <Grupo titulo="Camión">
            {(["con", "sin"] as CamionFiltro[]).map((v) => (
              <Chip
                key={v}
                label={CAMION_LABEL[v]}
                activo={filtros.camion === v}
                onToggle={() => elegir("camion", v, "todos")}
              />
            ))}
          </Grupo>

          <Grupo titulo="Antigüedad">
            {(["menos_1", "1_5", "5_10", "mas_10"] as AntiguedadFiltro[]).map((v) => (
              <Chip
                key={v}
                label={ANTIGUEDAD_LABEL[v]}
                activo={filtros.antiguedad === v}
                onToggle={() => elegir("antiguedad", v, "todas")}
              />
            ))}
          </Grupo>

          <Grupo titulo="Legajo">
            {(["completo", "incompleto"] as LegajoFiltro[]).map((v) => (
              <Chip
                key={v}
                label={LEGAJO_LABEL[v]}
                activo={filtros.legajo === v}
                onToggle={() => elegir("legajo", v, "todos")}
              />
            ))}
          </Grupo>

          {activos > 0 && (
            <button
              type="button"
              onClick={() => onChange(FILTROS_AVANZADOS_VACIOS)}
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
