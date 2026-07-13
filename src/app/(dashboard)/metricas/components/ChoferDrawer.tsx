"use client";

// Drawer de detalle del chofer: al hacer click en una fila o barra se abre
// este panel con TODAS sus métricas del mes (comparadas contra el promedio de
// su flota), el desglose del sueldo y su evolución de 13 meses, más accesos
// directos al legajo y a sus viajes.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot,
} from "recharts";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { User, Route as RouteIcon, ArrowUpRight } from "lucide-react";
import type { MetricaChofer, ChoferHistPunto, TotalesMes } from "../actions";
import { METRICAS, flotaLabel, type MetricaId } from "./metricas-def";
import { money, numAr, mesCorto, mesLabel, addM } from "./format";

export default function ChoferDrawer({
  chofer, onClose, totalesFlota, hist, mes, esLive,
}: {
  chofer: MetricaChofer | null;
  onClose: () => void;
  /** Totales de la flota del chofer en el mes (para comparar contra el promedio). */
  totalesFlota: TotalesMes | null;
  /** Historial del chofer en la ventana de 13 meses. */
  hist: ChoferHistPunto[];
  mes: string;
  /** true → mes en vivo: sueldo y km-100 no existen (mostrar s/d). */
  esLive?: boolean;
}) {
  const [metricaSel, setMetricaSel] = useState<MetricaId>("factkm");

  // Ventana completa de 13 meses con huecos en null (para que el eje X sea estable).
  const serieEvolucion = useMemo(() => {
    if (!chofer) return [];
    const porMes = new Map(hist.map((p) => [p.mes, p]));
    const def = METRICAS.find((m) => m.id === metricaSel)!;
    const out: { mes: string; label: string; valor: number | null }[] = [];
    for (let i = -12; i <= 0; i++) {
      const m = addM(mes, i);
      const punto = porMes.get(m);
      out.push({ mes: m, label: mesCorto(m), valor: punto ? def.valorHist(punto) : null });
    }
    return out;
  }, [chofer, hist, mes, metricaSel]);

  const defSel = METRICAS.find((m) => m.id === metricaSel)!;
  const puntoActivo = serieEvolucion.find((p) => p.mes === mes);

  const desglose = useMemo(() => {
    if (!chofer) return [];
    return [
      { label: "Sueldo neto", valor: chofer.sueldoNeto, color: "bg-primary" },
      { label: "Retenciones", valor: chofer.retenciones, color: "bg-amber-500" },
      { label: "Adelantos", valor: chofer.adelantos, color: "bg-violet-500" },
      { label: "Devol. préstamo", valor: chofer.devolPrestamo, color: "bg-sky-400" },
      { label: "Embargo judicial", valor: chofer.embargoJudicial, color: "bg-red-400" },
      { label: "Aguinaldo", valor: chofer.aguinaldo, color: "bg-emerald-500" },
    ].filter((d) => d.valor != null && d.valor > 0) as { label: string; valor: number; color: string }[];
  }, [chofer]);

  return (
    <Sheet open={chofer != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg! p-0">
        {chofer && (
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader className="shrink-0 border-b border-border p-4 pb-3 pr-12">
              <SheetTitle className="flex items-center gap-2 text-base">
                {chofer.nombre}
                {chofer.ingresoParcial && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    ◐ mes parcial
                  </span>
                )}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{flotaLabel(chofer)}</span>
                <span>{mesLabel(mes)}</span>
              </SheetDescription>
              <div className="mt-1 flex flex-wrap gap-2">
                {chofer.slug && (
                  <Link
                    href={`/choferes/${chofer.slug}`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <User size={12} /> Ver legajo
                  </Link>
                )}
                {chofer.choferId && (
                  <Link
                    href={`/viajes?choferId=${chofer.choferId}`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <RouteIcon size={12} /> Ver viajes
                  </Link>
                )}
                {!chofer.choferId && (
                  <p className="text-[10px] text-muted-foreground self-center">
                    Sin legajo linkeado (nombre de planilla sin match en Choferes).
                  </p>
                )}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {/* Métricas del mes vs promedio de la flota */}
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  El mes vs. promedio de {flotaLabel(chofer)}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {METRICAS.map((def) => {
                    const sinDatoLive = esLive && (def.id === "sueldo" || def.id === "km100");
                    const valor = sinDatoLive ? null : def.valorChofer(chofer);
                    const prom = sinDatoLive ? null : def.valorTotales(totalesFlota);
                    const diff = valor != null && prom != null
                      ? def.enPuntos ? valor - prom : prom !== 0 ? ((valor / prom) - 1) * 100 : null
                      : null;
                    const mejor = diff != null && (def.mejorMenos ? diff <= 0 : diff >= 0);
                    return (
                      <button
                        key={def.id}
                        type="button"
                        onClick={() => setMetricaSel(def.id)}
                        className={`rounded-md border p-2.5 text-left transition-colors ${
                          metricaSel === def.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                        title="Ver evolución de esta métrica"
                      >
                        <p className="text-[10px] text-muted-foreground">{def.tab}</p>
                        <p className="font-mono text-base font-bold text-foreground">{def.fmt(valor)}</p>
                        {diff != null ? (
                          <p className={`text-[10px] font-medium ${mejor ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                            {diff >= 0 ? "+" : ""}{diff.toLocaleString("es-AR", { maximumFractionDigits: 1 })}{def.enPuntos ? " pp" : "%"} vs prom.
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/60">s/d</p>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-md bg-muted/50 py-1.5">
                    <p className="text-muted-foreground">KM</p>
                    <p className="font-mono font-semibold text-foreground">{numAr(chofer.km)}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 py-1.5">
                    <p className="text-muted-foreground">Facturación</p>
                    <p className="font-mono font-semibold text-foreground">{money(chofer.facturacion)}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 py-1.5">
                    <p className="text-muted-foreground">Sueldo total</p>
                    <p className="font-mono font-semibold text-foreground">{money(chofer.sueldoTotal)}</p>
                  </div>
                </div>
              </section>

              {/* Desglose del sueldo (denominador defensivo: hay planillas
                  donde neto + conceptos no cierra exactamente contra el total) */}
              {desglose.length > 0 && chofer.sueldoTotal > 0 && (() => {
                const base = Math.max(chofer.sueldoTotal, desglose.reduce((s, d) => s + d.valor, 0));
                return (
                  <section>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Desglose del sueldo — {money(chofer.sueldoTotal)}
                    </h4>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      {desglose.map((d) => (
                        <div
                          key={d.label}
                          className={d.color}
                          style={{ width: `${(d.valor / base) * 100}%` }}
                          title={`${d.label}: ${money(d.valor)}`}
                        />
                      ))}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {desglose.map((d) => (
                        <li key={d.label} className="flex items-center gap-2 text-xs">
                          <span className={`h-2 w-2 rounded-full ${d.color}`} />
                          <span className="flex-1 text-muted-foreground">{d.label}</span>
                          <span className="font-mono text-foreground">{money(d.valor)}</span>
                          <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">
                            {((d.valor / base) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })()}

              {/* Evolución 13 meses */}
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Evolución 13 meses — {defSel.tab}
                </h4>
                <div className="mb-2 flex flex-wrap gap-1">
                  {METRICAS.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => setMetricaSel(def.id)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        metricaSel === def.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {def.tab}
                    </button>
                  ))}
                </div>
                {serieEvolucion.some((p) => p.valor != null) ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={serieEvolucion} margin={{ right: 8, top: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} width={56} tickFormatter={(v: number) => defSel.fmt(v)} domain={["auto", "auto"]} />
                      <Tooltip
                        formatter={(v) => [defSel.fmt(Number(v)), defSel.tab]}
                        labelFormatter={(label) => {
                          const p = serieEvolucion.find((x) => x.label === label);
                          return p ? mesLabel(p.mes) : label;
                        }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Line type="monotone" dataKey="valor" stroke="#0088D1" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                      {puntoActivo?.valor != null && (
                        <ReferenceDot x={puntoActivo.label} y={puntoActivo.valor} r={4.5} fill="#0088D1" stroke="var(--card)" strokeWidth={2} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">Sin historial de esta métrica en la ventana.</p>
                )}
                {hist.length < 13 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {hist.length} {hist.length === 1 ? "mes" : "meses"} con planilla en la ventana de 13.
                  </p>
                )}
              </section>

              {/* Fuente del dato */}
              <p className="flex items-center gap-1 border-t border-border pt-3 text-[10px] text-muted-foreground">
                <ArrowUpRight size={11} />
                Dato de la planilla mensual (Drive) — se cruza con Viajes y Sueldos del sistema.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
