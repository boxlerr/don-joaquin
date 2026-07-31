"use client";

// Tarjeta KPI: el número es lo importante, todo lo demás lo acompaña.
// Clickeable: abre la pestaña de la métrica.
//
// Al pie va UNA sola línea de procedencia — punto de estado + sección + qué
// falta en 2-3 palabras. La explicación larga vive en el tooltip: tenerla
// siempre a la vista, repetida en 8 tarjetas, era ilegible.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DeltaBadge from "./DeltaBadge";
import Sparkline from "./Sparkline";
import type { KpiDef } from "./metricas-def";
import type { EstadoKpi } from "./metricas-origen";

const PUNTO: Record<EstadoKpi["estado"], string> = {
  ok: "bg-emerald-500",
  parcial: "bg-amber-500",
  no_obtenible: "bg-muted-foreground/30",
};

/** Cuerpo del número: baja de a poco para que un monto largo entre entero. */
const tamValor = (v: string) =>
  v.length > 13 ? "text-[18px]" : v.length > 11 ? "text-[21px]" : v.length > 9 ? "text-[23px]" : "text-[26px]";

export default function KpiCard({
  def, valor, sub, dPrev, dYoY, dCmp, etiquetaCmp, serie, onClick, activa, origen,
}: {
  def: KpiDef;
  valor: string;
  sub?: string;
  dPrev: number | null;
  dYoY: number | null;
  /** Delta contra el mes de comparación elegido (si hay). */
  dCmp?: number | null;
  etiquetaCmp?: string;
  /** Serie 13 meses para el sparkline (puede tener nulls). */
  serie: (number | null)[];
  onClick?: () => void;
  activa?: boolean;
  /** Procedencia y estado del dato (metricas-origen). */
  origen?: EstadoKpi;
}) {
  const Icon = def.icon;
  const clickeable = Boolean(onClick);
  const tooltip = origen
    ? [origen.fuente.que, `Sale de: ${origen.campo}`, origen.nota].filter(Boolean).join("\n")
    : undefined;

  return (
    <div
      role={clickeable ? "button" : undefined}
      tabIndex={clickeable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickeable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative flex flex-col rounded-lg border bg-card px-4 py-3.5 shadow-sm transition-all ${
        activa ? "border-primary ring-1 ring-primary/30" : "border-border"
      } ${clickeable ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}`}
      title={clickeable ? `Ver detalle de ${def.label}` : undefined}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon size={13} className="shrink-0" /> {def.label}
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Los montos van completos (no "$1,51 MM"): el número achica el
              cuerpo si es largo en vez de abreviarse. */}
          <p className={`${tamValor(valor)} font-bold font-mono text-foreground leading-none tracking-tight`}>{valor}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground truncate" title={sub}>{sub}</p>}
        </div>
        <div className="shrink-0 text-primary/60">
          <Sparkline valores={serie} width={72} height={26} />
        </div>
      </div>

      {/* flex-1: absorbe el alto sobrante para que el pie quede alineado
          entre tarjetas de distinta altura. */}
      <div className="mt-2.5 flex flex-1 flex-col gap-0.5">
        <DeltaBadge valor={dPrev} subirEsBueno={def.subirEsBueno} neutro={def.neutro} etiqueta="mes ant." puntos={def.enPuntos} />
        <DeltaBadge valor={dYoY} subirEsBueno={def.subirEsBueno} neutro={def.neutro} etiqueta="interanual" puntos={def.enPuntos} />
        {etiquetaCmp !== undefined && (
          <DeltaBadge valor={dCmp ?? null} subirEsBueno={def.subirEsBueno} neutro={def.neutro} etiqueta={`vs ${etiquetaCmp}`} puntos={def.enPuntos} />
        )}
      </div>

      {origen && (() => {
        // Toda la línea es el link: el destino más útil es el listado del mes ya
        // filtrado por lo que falta ("¿cuáles son esos 7 viajes sin km?"), y si
        // no hay nada que completar, la sección de la que sale el dato.
        const destino = origen.accion?.href ?? origen.fuente.href;
        const contenido = (
          <>
            <span className={`size-1.5 rounded-full shrink-0 ${PUNTO[origen.estado]}`} />
            <span className="shrink-0">{origen.fuente.label}</span>
            {origen.notaCorta && (
              <span className={`truncate ${origen.estado === "parcial" ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground/60"}`}>
                · {origen.notaCorta}
              </span>
            )}
            {destino && <ArrowRight size={11} className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />}
          </>
        );
        const clases = "mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] leading-none text-muted-foreground";
        const titulo = [tooltip, origen.accion ? `\n→ ${origen.accion.label}` : null].filter(Boolean).join("");

        return destino ? (
          <Link href={destino} onClick={(e) => e.stopPropagation()} className={`${clases} hover:text-primary`} title={titulo}>
            {contenido}
          </Link>
        ) : (
          <div className={clases} title={titulo}>{contenido}</div>
        );
      })()}
    </div>
  );
}
