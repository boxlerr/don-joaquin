"use client";

// "De dónde sale cada número": el mapa de procedencia del mes, agrupado por
// fuente. Responde de un vistazo qué métricas el sistema ya genera solo, cuáles
// dependen todavía de las planillas del Drive, y cuál no se puede obtener.
//
// Diseño: columnas alineadas en grilla (métrica · campo · estado) para poder
// barrerlo en vertical, y la explicación larga UNA vez por grupo — repetirla
// en cada fila la volvía ilegible.

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ArrowUpRight } from "lucide-react";
import type { MetricasData } from "../actions";
import { KPIS } from "./metricas-def";
import {
  estadoDeKpis, estadoCostoEstudio, FUENTES,
  type EstadoKpi, type EstadoDato, type FuenteId,
} from "./metricas-origen";

const PUNTO: Record<EstadoDato, string> = {
  ok: "bg-emerald-500",
  parcial: "bg-amber-500",
  no_obtenible: "bg-muted-foreground/30",
};

/** Orden: primero lo que el sistema ya resuelve solo. */
const ORDEN: FuenteId[] = ["hoja_ruta", "sueldos_admin", "planillas", "estudio"];

/**
 * Contexto del grupo, dicho una vez y no por fila. El de "planillas" cambia
 * según si este mes el dato llegó (mes cerrado) o falta (mes en vivo): decir
 * "no se obtiene" en un mes donde el número está a la vista sería falso.
 */
function notaGrupo(fuente: FuenteId, hayFaltantes: boolean): string | null {
  if (fuente === "estudio") return "Es un número por mes que arma el contador; se carga a mano.";
  if (fuente !== "planillas") return null;
  return hayFaltantes
    ? "Los sueldos de choferes se liquidan aparte (falta la tabla de tarifas por concepto) y el km al 100% ni siquiera se registra por viaje: su definición sigue sin confirmar."
    : "Este mes los trajo la planilla del Drive. El sistema todavía no puede generarlos solo.";
}

type Fila = { label: string; origen: EstadoKpi };

export default function ProcedenciaPanel({ data }: { data: MetricasData }) {
  const [abierto, setAbierto] = useState(true);

  const estados = estadoDeKpis(data);
  const filas: Fila[] = KPIS
    .filter((k) => estados[k.id])
    .map((k) => ({ label: k.label, origen: estados[k.id] }));
  filas.push({ label: "Costo estudio $/km", origen: estadoCostoEstudio(data) });

  const porFuente = ORDEN
    .map((id) => ({ fuente: FUENTES[id], filas: filas.filter((f) => f.origen.fuente.id === id) }))
    .filter((g) => g.filas.length > 0);

  const saliendoDelSistema = filas.filter((f) => f.origen.fuente.automatica).length;
  const automatizables = filas.filter((f) => f.origen.automatizable).length;
  const incompletas = filas.filter((f) => f.origen.estado === "parcial").length;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">De dónde sale cada número</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {saliendoDelSistema > 0 ? (
              <><span className="font-medium text-foreground">{saliendoDelSistema} de {filas.length}</span> salen del sistema este mes</>
            ) : (
              <>Este mes viene entero de afuera · el sistema <span className="font-medium text-foreground">puede generar {automatizables} de {filas.length}</span> con la hoja de ruta</>
            )}
            {incompletas > 0 && <>, <span className="text-amber-600 dark:text-amber-500">{incompletas} con datos incompletos</span></>}
          </p>
        </div>
        {abierto ? <ChevronUp size={15} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={15} className="shrink-0 text-muted-foreground" />}
      </button>

      {abierto && (
        <div className="space-y-5 border-t border-border px-3 pb-4 pt-3 sm:px-4">
          {porFuente.map(({ fuente, filas: fs }) => {
            const nota = notaGrupo(fuente.id, fs.some((f) => f.origen.estado === "no_obtenible"));
            return (
            <section key={fuente.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h4 className="text-[13px] font-semibold text-foreground">{fuente.label}</h4>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    fuente.automatica
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {fuente.automatica ? "se actualiza sola" : "fuera del sistema"}
                </span>
                {fuente.href && (
                  <Link href={fuente.href} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                    Ir <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>

              {nota && (
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{nota}</p>
              )}

              <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
                {fs.map((f) => {
                  const fila = (
                    <>
                      <span className={`size-1.5 shrink-0 rounded-full ${PUNTO[f.origen.estado]}`} />
                      <span className="text-[13px] text-foreground truncate">{f.label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/70 truncate max-md:col-start-2">{f.origen.campo}</span>
                      <span
                        className={`text-xs tabular-nums md:text-right ${
                          f.origen.estado === "parcial"
                            ? "text-amber-600 dark:text-amber-500"
                            : f.origen.estado === "ok"
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground"
                        } max-md:col-start-2`}
                      >
                        {f.origen.notaCorta ?? "completo"}
                      </span>
                    </>
                  );
                  // En celular las 4 columnas no entran: se apilan en dos
                  // (punto + texto) y el campo y el estado bajan de renglón.
                  const grid = "grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 px-3 py-2 md:grid-cols-[auto_minmax(0,11rem)_1fr_auto] md:gap-x-3";
                  return (
                    <li key={f.label} title={f.origen.nota ?? undefined}>
                      {f.origen.accion ? (
                        // Va al listado del mes ya filtrado por lo que falta.
                        <Link href={f.origen.accion.href} className={`${grid} hover:bg-muted/50 transition-colors`}>
                          {fila}
                        </Link>
                      ) : (
                        <div className={grid}>{fila}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
