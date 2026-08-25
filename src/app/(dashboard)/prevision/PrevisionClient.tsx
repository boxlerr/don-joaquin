"use client";

import { useState } from "react";
import { AlertTriangle, Info, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopesFinanzasDialog from "./TopesFinanzasDialog";
import {
  FUENTE_LABEL,
  hayAlgunTopeFinanzas,
  primerMesComplicado,
  type MesProyectado,
} from "@/domain/finanzas/proyeccion";
import type { DatosPrevision } from "./actions";

/**
 * Qué meses vienen apretados.
 *
 * Pedido de Bárbara, 30/07: *"que me empiece a decir: che, fijate que en
 * septiembre te las vas a ver negras"*. La pantalla está armada alrededor de
 * esa frase — primero la conclusión en una línea, después de qué está hecha.
 *
 * Dos reglas que vienen del propio módulo de cálculo y que la pantalla tiene
 * que respetar para no mentir:
 *
 *  · **Sin umbral no hay alerta.** Nosotros no definimos qué es un mes
 *    complicado; hasta que ellos pongan el número, la pantalla muestra los
 *    datos y no pinta nada de rojo.
 *  · **El total siempre subestima**, porque no todos los costos están
 *    cargados. Por eso cada mes dice de qué está hecho y qué le falta, en vez
 *    de mostrar un número redondo que nadie puede auditar.
 */

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number) as [number, number];
  return `${MESES[m - 1]} ${y}`;
}

function mesCorto(mesISO: string): string {
  const [, m] = mesISO.split("-").map(Number) as [number, number];
  const n = MESES[m - 1]!;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

const TONO: Record<MesProyectado["nivel"], { borde: string; texto: string; fondo: string }> = {
  ok: { borde: "border-border", texto: "text-foreground", fondo: "bg-card" },
  cerca: { borde: "border-amber-200", texto: "text-amber-700", fondo: "bg-amber-50/40" },
  excedido: { borde: "border-rose-200", texto: "text-rose-700", fondo: "bg-rose-50/40" },
};

export default function PrevisionClient({
  datos,
  canWrite,
}: {
  datos: DatosPrevision;
  canWrite: boolean;
}) {
  const [topesOpen, setTopesOpen] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const { proyeccion, topes, faltantes } = datos;
  const hayTope = hayAlgunTopeFinanzas(topes);
  const complicado = primerMesComplicado(proyeccion);

  return (
    <>
      {/* La conclusión primero. Es lo que ella pidió que el sistema le diga, y
          si no hay nada que decir también hay que decirlo. */}
      {!hayTope ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-dashed border-border px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Todavía no hay un límite puesto
            </p>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Sin un número que diga qué es un mes complicado, la pantalla muestra los datos pero no
              puede avisar nada. Ese número lo ponen ustedes: es lo que separa un aviso útil de uno
              que grita siempre.
            </p>
          </div>
          {canWrite && (
            <Button variant="brand" size="sm" className="gap-1.5" onClick={() => setTopesOpen(true)}>
              <Settings2 size={14} />
              Poner el límite
            </Button>
          )}
        </div>
      ) : complicado ? (
        <div className="mb-5 flex items-start gap-3 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">
              Ojo con {nombreMes(complicado.mes)}
            </p>
            <p className="mt-0.5 text-sm text-rose-800">
              Hay <span className="font-semibold">{ars(complicado.totalEgresos)}</span> comprometidos
              {complicado.facturacionProyectada != null && (
                <>
                  {" "}y se proyectan{" "}
                  <span className="font-semibold">{ars(complicado.facturacionProyectada)}</span> de
                  facturación
                </>
              )}
              {complicado.exceso && (
                <>
                  {" "}— {ars(complicado.exceso.exceso)} por encima del límite
                </>
              )}
              .
              {complicado.ausentes > 0 && (
                <>
                  {" "}Además ese mes hay{" "}
                  <span className="font-semibold">{complicado.ausentes} sin estar</span>: camiones
                  que no facturan.
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-[10px] border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm text-foreground">
            Ninguno de los próximos {proyeccion.length} meses se pasa del límite.
          </p>
        </div>
      )}

      {/* Un mes por tarjeta. Tocar una abre de qué está hecho el total: el
          número solo no se puede auditar, y este SIEMPRE es un piso. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {proyeccion.map((m) => {
          const t = TONO[m.nivel];
          const abiertoAca = abierto === m.mes;
          return (
            <div key={m.mes} className={`rounded-[10px] border ${t.borde} ${t.fondo} p-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{mesCorto(m.mes)}</p>
                {m.ausentes > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    title={`${m.ausentes} sin estar: camiones que no facturan`}
                  >
                    <Users size={12} />
                    {m.ausentes}
                  </span>
                )}
              </div>

              <p className={`mt-1 text-xl font-semibold tabular-nums ${t.texto}`}>
                {ars(m.totalEgresos)}
              </p>
              <p className="text-xs text-muted-foreground">comprometido</p>

              {m.facturacionProyectada != null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Facturación estimada{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {ars(m.facturacionProyectada)}
                  </span>
                </p>
              )}

              {/* "Falta sumar sueldos" sería mentira cuando sueldos SÍ aporta y
                  lo que le falta es la parte de choferes. Se distingue la fuente
                  que entra incompleta de la que no entra en absoluto. */}
              {m.huecos.length > 0 && (
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {(() => {
                    const parciales = m.aportes
                      .filter((a) => a.cobertura === "parcial")
                      .map((a) => FUENTE_LABEL[a.fuente].toLowerCase());
                    const sinDatos = m.aportes
                      .filter((a) => a.cobertura === "sin_datos")
                      .map((a) => FUENTE_LABEL[a.fuente].toLowerCase());
                    const partes: string[] = [];
                    if (parciales.length) partes.push(`${parciales.join(" y ")} entra incompleto`);
                    if (sinDatos.length) partes.push(`de ${sinDatos.join(" y ")} no hay datos`);
                    return `El número real es más alto: ${partes.join(", y ")}.`;
                  })()}
                </p>
              )}

              <button
                type="button"
                onClick={() => setAbierto(abiertoAca ? null : m.mes)}
                className="mt-2.5 text-xs font-semibold text-primary hover:underline"
              >
                {abiertoAca ? "Ocultar el detalle" : "De qué está hecho"}
              </button>

              {abiertoAca && (
                <ul className="mt-2 space-y-1 border-t border-border pt-2">
                  {m.aportes.map((a) => (
                    <li key={a.fuente} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {FUENTE_LABEL[a.fuente]}
                        {a.items > 0 && (
                          <span className="text-muted-foreground/70"> · {a.items}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${
                          a.cobertura === "sin_datos" ? "text-muted-foreground/60" : "text-foreground"
                        }`}
                      >
                        {a.cobertura === "sin_datos" ? "sin datos" : ars(a.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Lo que el total NO incluye. Va abajo y siempre, no sólo cuando falla:
          es la letra chica que hace que el número de arriba sea interpretable. */}
      {faltantes.length > 0 && (
        <div className="mt-5 rounded-[10px] border border-border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Info size={14} className="text-muted-foreground" />
            Lo que estos números todavía no incluyen
          </p>
          <ul className="mt-2 space-y-1.5">
            {faltantes.map((f) => (
              <li key={f.fuente} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{FUENTE_LABEL[f.fuente]}</span> —{" "}
                {f.motivo}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Mientras falte algo de esto, el total de cada mes es un piso: lo real siempre es más.
          </p>
        </div>
      )}

      {hayTope && canWrite && (
        <div className="mt-4">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTopesOpen(true)}>
            <Settings2 size={14} />
            Cambiar el límite
          </Button>
        </div>
      )}

      <TopesFinanzasDialog open={topesOpen} onOpenChange={setTopesOpen} topes={topes} />
    </>
  );
}
