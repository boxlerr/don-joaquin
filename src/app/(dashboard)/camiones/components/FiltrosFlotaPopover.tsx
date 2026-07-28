"use client";

// Los parámetros que no entran en el buscador: marca, tipo, capacidad, estado y
// rango de años. Van en un panel y no sueltos en la barra, que ya tiene el
// selector de chasis/acoplados, el de tercerización y la búsqueda.

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  contarFiltros,
  FILTROS_VACIOS,
  type FiltrosFlota,
  type Opcion,
} from "../filtros";

function Chip<T extends string | number>({
  opcion,
  activo,
  onToggle,
}: {
  opcion: Opcion<T>;
  activo: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={activo}
      className={`rounded-[6px] border px-2 py-1 text-[12px] transition-colors ${
        activo
          ? "border-primary/60 bg-primary/5 font-medium text-primary"
          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {opcion.label}
      <span className={`ml-1 tabular-nums ${activo ? "text-primary/70" : "text-muted-foreground/60"}`}>
        {opcion.n}
      </span>
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

export default function FiltrosFlotaPopover({
  filtros,
  onChange,
  marcas,
  tipos,
  capacidades,
  estados,
  anios,
}: {
  filtros: FiltrosFlota;
  onChange: (f: FiltrosFlota) => void;
  marcas: Opcion<string>[];
  tipos: Opcion<string>[];
  capacidades: Opcion<number>[];
  estados: Opcion<string>[];
  anios: { min: number; max: number } | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const activos = contarFiltros(filtros);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  /** Prende o apaga un valor de una lista. */
  const toggle = <T extends string | number>(clave: keyof FiltrosFlota, valor: T) => {
    const actual = filtros[clave] as T[];
    onChange({
      ...filtros,
      [clave]: actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor],
    });
  };

  const anioNum = (v: string) => {
    const n = Number(v);
    return v.trim() === "" || !Number.isFinite(n) ? null : n;
  };

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
          activos > 0
            ? "border-primary/50 bg-primary/5 text-primary"
            : "border-border bg-card text-foreground hover:bg-muted"
        }`}
      >
        <SlidersHorizontal size={14} />
        Filtros
        {activos > 0 && (
          <span className="ml-0.5 rounded-[4px] bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
            {activos}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[22rem] space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg">
          {marcas.length > 0 && (
            <Grupo titulo="Marca">
              {marcas.map((o) => (
                <Chip
                  key={o.valor}
                  opcion={o}
                  activo={filtros.marcas.includes(o.valor)}
                  onToggle={() => toggle("marcas", o.valor)}
                />
              ))}
            </Grupo>
          )}

          {anios && (
            <Grupo titulo="Año">
              <div className="flex w-full items-center gap-2">
                <input
                  type="number"
                  min={anios.min}
                  max={anios.max}
                  value={filtros.anioDesde ?? ""}
                  onChange={(e) => onChange({ ...filtros, anioDesde: anioNum(e.target.value) })}
                  placeholder={String(anios.min)}
                  aria-label="Año desde"
                  className="h-8 w-20 rounded-[6px] border border-border bg-background px-2 text-[12px] text-foreground"
                />
                <span className="text-[12px] text-muted-foreground">a</span>
                <input
                  type="number"
                  min={anios.min}
                  max={anios.max}
                  value={filtros.anioHasta ?? ""}
                  onChange={(e) => onChange({ ...filtros, anioHasta: anioNum(e.target.value) })}
                  placeholder={String(anios.max)}
                  aria-label="Año hasta"
                  className="h-8 w-20 rounded-[6px] border border-border bg-background px-2 text-[12px] text-foreground"
                />
                <span className="text-[11px] text-muted-foreground">
                  la flota va de {anios.min} a {anios.max}
                </span>
              </div>
            </Grupo>
          )}

          {tipos.length > 1 && (
            <Grupo titulo="Tipo">
              {tipos.map((o) => (
                <Chip
                  key={o.valor}
                  opcion={o}
                  activo={filtros.tipos.includes(o.valor)}
                  onToggle={() => toggle("tipos", o.valor)}
                />
              ))}
            </Grupo>
          )}

          {capacidades.length > 1 && (
            <Grupo titulo="Capacidad">
              {capacidades.map((o) => (
                <Chip
                  key={o.valor}
                  opcion={o}
                  activo={filtros.capacidades.includes(o.valor)}
                  onToggle={() => toggle("capacidades", o.valor)}
                />
              ))}
            </Grupo>
          )}

          {estados.length > 1 && (
            <Grupo titulo="Estado">
              {estados.map((o) => (
                <Chip
                  key={o.valor}
                  opcion={o}
                  activo={filtros.estados.includes(o.valor)}
                  onToggle={() => toggle("estados", o.valor)}
                />
              ))}
            </Grupo>
          )}

          {activos > 0 && (
            <button
              type="button"
              onClick={() => onChange(FILTROS_VACIOS)}
              className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border border-border py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
