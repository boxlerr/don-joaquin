"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import IlustracionCompliance, { type TonoIlustracion } from "./IlustracionCompliance";
import { NIVEL_LABEL, type ComplianceEstadoRow, type ComplianceNivel } from "../types";

/**
 * La cabecera de cada alcance —Empresa, Unidades, Choferes— como tarjeta.
 *
 * Antes era un renglón de texto en mayúsculas con un "Mostrar" a la derecha: se
 * leía como un título y no como algo que se abre, y no decía nada de cómo venía
 * ese grupo. Ahora la misma cabecera cuenta cuántos documentos son, qué
 * porcentaje está al día y qué falta, y sigue siendo el botón que despliega la
 * lista. Es el bloque del mockup del 26/08/2026, pero fundido con el acordeón
 * que ya existía en vez de sumado arriba: si no, la pantalla diría dos veces lo
 * mismo, una en tarjetas y otra en encabezados.
 *
 * Los números salen de las filas VISIBLES, así que con un filtro puesto la
 * tarjeta habla del recorte que se está mirando, igual que el resto de la
 * pantalla.
 */

const NIVEL_SUB: Record<ComplianceNivel, string> = {
  empresa: "Se presenta una vez para toda la flota",
  unidad: "Uno por cada unidad",
  chofer: "Uno por cada chofer",
};

const NIVEL_ARTE: Record<ComplianceNivel, "empresa" | "unidad" | "chofer"> = {
  empresa: "empresa",
  unidad: "unidad",
  chofer: "chofer",
};

/**
 * Un color por alcance, sólo en el filete y en el dibujo. El verde de "unidades"
 * del mockup se cambió por verde-azulado a propósito: en esta pantalla el verde
 * ya significa "al día", y un filete verde al lado de un anillo verde se lee
 * como un estado en vez de como una categoría.
 */
const NIVEL_TONO: Record<ComplianceNivel, { tono: TonoIlustracion; filete: string }> = {
  empresa: { tono: "azul", filete: "#0088D1" },
  unidad: { tono: "teal", filete: "#0F9488" },
  chofer: { tono: "violeta", filete: "#7C3AED" },
};

type Conteo = {
  total: number;
  alDia: number;
  porVencer: number;
  vencidos: number;
  faltantes: number;
  pct: number;
};

/** Cuántas unidades o choferes distintos hay detrás de esos documentos. */
function contarEntidades(rows: ComplianceEstadoRow[], nivel: ComplianceNivel): number {
  if (nivel === "empresa") return 0;
  const vistos = new Set<string>();
  for (const r of rows) {
    const id = nivel === "unidad" ? r.camion_id : r.chofer_id;
    if (id) vistos.add(id);
  }
  return vistos.size;
}

export function contarPorEstado(rows: ComplianceEstadoRow[]): Conteo {
  let alDia = 0;
  let porVencer = 0;
  let vencidos = 0;
  let faltantes = 0;
  for (const r of rows) {
    if (r.estado === "vigente") alDia++;
    else if (r.estado === "por_vencer") porVencer++;
    else if (r.estado === "vencido") vencidos++;
    else faltantes++;
  }
  return {
    total: rows.length,
    alDia,
    porVencer,
    vencidos,
    faltantes,
    pct: rows.length > 0 ? Math.round((alDia / rows.length) * 100) : 0,
  };
}

/** El color del anillo lo decide lo PEOR que haya, igual que el resto de la pantalla. */
function colorDelEstado(c: Conteo): string {
  if (c.vencidos > 0) return "#EF4444";
  if (c.porVencer > 0) return "#F59E0B";
  if (c.faltantes > 0) return "#94A3B8";
  return "#22C55E";
}

function Anillo({ pct, color, size = 54 }: { pct: number; color: string; size?: number }) {
  const grosor = 6;
  const r = (size - grosor) / 2;
  const largo = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={grosor} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={`${(largo * pct) / 100} ${largo}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function TarjetaAlcance({
  nivel,
  rows,
  abierto,
  onToggle,
  soldada = false,
  vacia = false,
}: {
  nivel: ComplianceNivel;
  /** Las filas visibles de ese alcance (ya filtradas). */
  rows: ComplianceEstadoRow[];
  abierto: boolean;
  onToggle: () => void;
  /** Abierta y con la lista pegada abajo: se dibujan como un solo bloque. */
  soldada?: boolean;
  /** El filtro no dejó nada de este alcance. La tarjeta se muestra igual. */
  vacia?: boolean;
}) {
  const c = contarPorEstado(rows);
  const color = colorDelEstado(c);
  const { tono, filete } = NIVEL_TONO[nivel];
  // 372 documentos no es lo mismo que 372 camiones: son 6 papeles por unidad.
  // El dato estaba sólo en la columna de la derecha, que no existe en pantallas
  // angostas y que ahora dice lo mismo que esta tarjeta.
  const entidades = contarEntidades(rows, nivel);

  return (
    <button
      type="button"
      onClick={vacia ? undefined : onToggle}
      disabled={vacia}
      aria-expanded={vacia ? undefined : abierto}
      className={`group relative flex w-full flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden border bg-card px-3 py-3 pl-5 text-left transition-colors sm:px-4 sm:pl-6 ${
        soldada ? "rounded-t-[12px] border-b-0" : "rounded-[12px]"
      } ${vacia ? "border-dashed border-border opacity-60" : "border-border"} ${
        !abierto && !vacia ? "hover:border-primary/40" : ""
      }`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: filete }} />

      <IlustracionCompliance nombre={NIVEL_ARTE[nivel]} tono={tono} size={42} />

      {/* Quién es. Ocupa el ancho que sobre para que los números queden juntos. */}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-foreground">{NIVEL_LABEL[nivel]}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{NIVEL_SUB[nivel]}</span>
      </span>

      <span className="flex shrink-0 flex-col items-center px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Documentos
        </span>
        <span
          className={`text-[22px] font-bold leading-tight tabular-nums ${
            vacia ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {c.total}
        </span>
        {entidades > 0 && (
          <span className="text-[11px] leading-tight text-muted-foreground">
            en {entidades} {nivel === "unidad" ? "unidades" : "choferes"}
          </span>
        )}
      </span>

      {/* Cómo viene. El anillo se lee de lejos; el desglose, de cerca. */}
      {vacia ? (
        <span className="shrink-0 text-[12px] text-muted-foreground">
          Nada de este alcance coincide con el filtro
        </span>
      ) : (
      <span className="flex shrink-0 items-center gap-2.5 border-l border-border pl-4">
        <Anillo pct={c.pct} color={color} />
        <span className="flex flex-col gap-0.5 text-[12px] leading-tight">
          <span className="text-[#166534]">
            <strong className="tabular-nums">{c.alDia}</strong> al día
          </span>
          {c.vencidos > 0 && (
            <span className="text-[#B91C1C]">
              <strong className="tabular-nums">{c.vencidos}</strong> vencido{c.vencidos === 1 ? "" : "s"}
            </span>
          )}
          {c.porVencer > 0 && (
            <span className="text-[#B45309]">
              <strong className="tabular-nums">{c.porVencer}</strong> por vencer
            </span>
          )}
          {c.faltantes > 0 && (
            <span className="text-muted-foreground">
              <strong className="tabular-nums">{c.faltantes}</strong> sin cargar
            </span>
          )}
        </span>
      </span>
      )}

      {/* La acción. Es la misma tarjeta la que abre: el botón es la señal. */}
      {!vacia && (
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-[12px] font-semibold transition-colors max-sm:w-full max-sm:justify-center ${
          abierto
            ? "text-muted-foreground group-hover:text-foreground"
            : "bg-primary/5 text-primary group-hover:bg-primary/10"
        }`}
      >
        {abierto ? "Ocultar" : "Ver documentos"}
        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
      )}
    </button>
  );
}
