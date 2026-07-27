"use client";

// Qué se puede COMPARAR este mes. La procedencia y el estado de cada métrica
// los cuenta ProcedenciaPanel; acá va solo lo transversal, que es de dónde
// salen los badges de tendencia: mes anterior, interanual y la serie de 13
// meses que alimenta sparklines y la pestaña Evolución.
//
// Incluye el aviso de lectura más importante: comparar un mes EN VIVO (que se
// está armando) contra meses cerrados exagera todos los deltas.

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { MetricasData } from "../actions";
import { mesLabel, addM } from "./format";

type Item = { ok: boolean; label: string; detalle?: string };

export function calcularCobertura(data: MetricasData): Item[] {
  const items: Item[] = [
    {
      ok: data.mesAnterior != null,
      label: "Comparación vs mes anterior",
      detalle: data.mesAnterior == null ? `falta cargar ${mesLabel(addM(data.mes, -1))}` : undefined,
    },
    {
      ok: data.anioAnterior != null,
      label: "Comparación interanual",
      detalle: data.anioAnterior == null ? `falta cargar ${mesLabel(addM(data.mes, -12))}` : undefined,
    },
  ];

  // Huecos en la serie (afectan la pestaña Evolución y los sparklines).
  const huecos = data.serieHistorica.filter((s) => s.general == null).map((s) => mesLabel(s.mes));
  items.push({
    ok: huecos.length === 0,
    label: "Serie histórica de 13 meses",
    detalle: huecos.length ? `sin datos: ${huecos.join(", ")}` : undefined,
  });

  // El mes en vivo se compara contra meses cerrados: los deltas exageran.
  if (data.esLive) {
    items.push({
      ok: false,
      label: "Ojo con los porcentajes de variación",
      detalle:
        "este mes se está armando y se compara contra meses ya cerrados, así que las caídas van a verse enormes hasta que termine de cargarse",
    });
  }

  return items;
}

export default function CoberturaBanner({ data }: { data: MetricasData }) {
  const [abierto, setAbierto] = useState(false);
  const items = useMemo(() => calcularCobertura(data), [data]);
  const faltantes = items.filter((i) => !i.ok);

  if (!data.choferes.length) return null; // el estado vacío lo maneja el shell

  if (!faltantes.length) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 size={13} className="text-emerald-500" />
        Ambas comparaciones disponibles y la serie de 13 meses completa.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400"
      >
        <AlertTriangle size={13} className="shrink-0" />
        <span className="flex-1">
          Sobre las comparaciones: {faltantes.map((f) => f.label).join(" · ")}
        </span>
        {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {abierto && (
        <ul className="mt-2 space-y-1 pl-5">
          {items.map((i) => (
            <li key={i.label} className="flex items-start gap-1.5 text-[11px]">
              {i.ok
                ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                : <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />}
              <span className={i.ok ? "text-muted-foreground" : "text-foreground"}>
                {i.label}
                {i.detalle && <span className="text-muted-foreground"> — {i.detalle}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
