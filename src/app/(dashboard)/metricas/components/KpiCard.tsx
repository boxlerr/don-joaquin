"use client";

// Tarjeta KPI del encabezado: número grande + tendencia 13 meses (sparkline)
// + deltas vs mes anterior e interanual. Clickeable: abre la pestaña de la
// métrica. El link "fuente" lleva a la sección viva de la que sale el dato.

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import DeltaBadge from "./DeltaBadge";
import Sparkline from "./Sparkline";
import type { KpiDef } from "./metricas-def";

export default function KpiCard({
  def, valor, sub, dPrev, dYoY, dCmp, etiquetaCmp, serie, onClick, activa,
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
}) {
  const Icon = def.icon;
  const clickeable = Boolean(onClick);

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
      className={`group relative rounded-lg border bg-card p-4 shadow-sm transition-all ${
        activa ? "border-primary ring-1 ring-primary/30" : "border-border"
      } ${clickeable ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}`}
      title={clickeable ? `Ver detalle de ${def.label}` : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon size={13} className="shrink-0" /> {def.label}
        </div>
        {def.fuente && (
          <Link
            href={def.fuente.href}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
            title={`Ver fuente: ${def.fuente.label}`}
          >
            <ExternalLink size={12} />
          </Link>
        )}
      </div>

      <p className="mt-1 text-2xl font-bold font-mono text-foreground leading-tight">{valor}</p>
      <p className="text-[11px] text-muted-foreground/70 min-h-4 truncate">{sub ?? ""}</p>
      <div className="mt-1 text-primary/70">
        <Sparkline valores={serie} width={132} height={24} />
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <DeltaBadge valor={dPrev} subirEsBueno={def.subirEsBueno} etiqueta="mes ant." puntos={def.enPuntos} />
        <DeltaBadge valor={dYoY} subirEsBueno={def.subirEsBueno} etiqueta="interanual" puntos={def.enPuntos} />
        {etiquetaCmp !== undefined && (
          <DeltaBadge valor={dCmp ?? null} subirEsBueno={def.subirEsBueno} etiqueta={`vs ${etiquetaCmp}`} puntos={def.enPuntos} />
        )}
      </div>
    </div>
  );
}
