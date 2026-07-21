"use client";

// Pestaña Resumen: lo mejor/peor del mes de un vistazo, facturación vs costo
// del estudio, aumentos de tarifa (contexto) y la comparativa por flota.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Trophy, AlertTriangle } from "lucide-react";
import type { MetricasData, MetricaChofer } from "../actions";
import { eliminarAumentoClienteAction } from "../actions";
import { METRICAS } from "./metricas-def";
import { money, numAr, pct, compactMoney, mesLabel, mesCorto } from "./format";
import CargarAumentoDialog from "../CargarAumentoDialog";

export default function ResumenTab({
  data, onChofer, esLive,
}: {
  data: MetricasData;
  onChofer: (c: MetricaChofer) => void;
  /** true → sin sueldos ni km-100 (los viajes no los traen). */
  esLive?: boolean;
}) {
  const router = useRouter();
  const [aumentoOpen, setAumentoOpen] = useState(false);
  const t = data.totales.general;

  // Destacados del mes: mejor y peor por métrica (con mínimo de km para no
  // premiar meses parciales). En vivo, solo las métricas que salen de viajes.
  const metricasDisponibles = useMemo(
    () => (esLive ? METRICAS.filter((m) => m.id !== "sueldo" && m.id !== "km100") : METRICAS),
    [esLive],
  );
  const destacados = useMemo(() => {
    const elegibles = data.choferes.filter((c) => !c.ingresoParcial && c.km > 0);
    return metricasDisponibles.map((def) => {
      const conValor = elegibles
        .map((c) => ({ c, v: def.valorChofer(c) }))
        .filter((r): r is { c: MetricaChofer; v: number } => r.v != null);
      if (conValor.length < 2) return null;
      conValor.sort((a, b) => (def.mejorMenos ? a.v - b.v : b.v - a.v));
      return { def, mejor: conValor[0], peor: conValor[conValor.length - 1] };
    }).filter(Boolean) as { def: (typeof METRICAS)[number]; mejor: { c: MetricaChofer; v: number }; peor: { c: MetricaChofer; v: number } }[];
  }, [data.choferes, metricasDisponibles]);

  const handleEliminarAumento = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el aumento de ${nombre}?`)) return;
    const res = await eliminarAumentoClienteAction(id);
    if ("error" in res) alert(res.error);
    else router.refresh();
  };

  const costoActual = data.serieCosto.find((r) => r.mes === data.mes);

  // Aumentos mes a mes (matriz meses × clientes). Los meses sin dato se muestran
  // igual, para ir completándolos con el tiempo. Las entradas marcadas
  // "Interanual" (ej. YPF, que hoy solo trae el interanual, no el mes a mes) van
  // a la fila de abajo y NO a una celda mensual, así el año queda visible y
  // vacío para cargar cuando llegue el detalle.
  const aumentosMes = useMemo(() => {
    const esInteranual = (a: (typeof data.aumentos)[number]) =>
      !!a.observaciones && a.observaciones.trim().toLowerCase().startsWith("interanual");
    const orden = data.paridad.clientes.porCliente.map((c) => c.nombre);
    const set = new Set(orden);
    for (const a of data.aumentos) if (!set.has(a.clienteNombre)) { set.add(a.clienteNombre); orden.push(a.clienteNombre); }
    const meses = data.serieHistorica.map((s) => s.mes);
    const idx = new Map<string, (typeof data.aumentos)[number]>();
    const interanualOnly = new Map<string, (typeof data.aumentos)[number]>();
    for (const a of data.aumentos) {
      if (esInteranual(a)) interanualOnly.set(a.clienteNombre, a);
      else idx.set(`${a.clienteNombre}|${a.vigenteDesde.slice(0, 7)}`, a);
    }
    const interanual = new Map(data.paridad.clientes.porCliente.map((c) => [c.nombre, c.acumulado]));
    return { clientes: orden, meses, idx, interanual, interanualOnly };
  }, [data.aumentos, data.paridad, data.serieHistorica]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Mejores y peores del mes */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Destacados del mes — {mesLabel(data.mes)}</h3>
        {destacados.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {destacados.map(({ def, mejor, peor }) => (
              <div key={def.id} className="rounded-md border border-border p-2.5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{def.tab}</p>
                <button
                  type="button"
                  onClick={() => onChofer(mejor.c)}
                  className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-emerald-500/10"
                  title={`Ver detalle de ${mejor.c.nombre}`}
                >
                  <Trophy size={11} className="shrink-0 text-emerald-500" />
                  <span className="flex-1 truncate font-medium text-foreground">{mejor.c.nombre}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{def.fmt(mejor.v)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChofer(peor.c)}
                  className="mt-0.5 flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-red-500/10"
                  title={`Ver detalle de ${peor.c.nombre}`}
                >
                  <AlertTriangle size={11} className="shrink-0 text-red-400" />
                  <span className="flex-1 truncate font-medium text-foreground">{peor.c.nombre}</span>
                  <span className="font-mono text-red-500">{def.fmt(peor.v)}</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Se necesitan al menos 2 choferes con mes completo.</p>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Solo choferes con mes completo. Click en un nombre abre su detalle. El ranking formal con score está en{" "}
          <Link href="/choferes/ranking" className="text-primary hover:underline">Ranking de choferes</Link>.
        </p>
      </div>

      {/* Facturación vs costo por km (planilla COSTO VS KM) */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Facturación vs costo por km (estudio)</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">
          De la planilla COSTO VS KM: si la línea azul cae abajo de la roja, el km se factura por debajo del costo.
        </p>
        {data.serieCosto.length ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.serieCosto.map((r) => ({ ...r, label: mesCorto(r.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${numAr(v)}`} width={64} />
              <Tooltip formatter={(v) => money(Number(v), 2)} contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="factKm" name="Facturación $/km" stroke="#0088D1" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
              <Line type="monotone" dataKey="costoKm" name="Costo estudio $/km" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">Sin serie de costo cargada.</p>
        )}
        {costoActual?.costoKm != null && t?.factPorKm != null && (
          <p className={`mt-2 text-xs ${t.factPorKm >= costoActual.costoKm ? "text-muted-foreground" : "text-red-500 font-medium"}`}>
            {t.factPorKm >= costoActual.costoKm
              ? `La facturación por km (${money(t.factPorKm, 2)}) cubre el costo del estudio (${money(costoActual.costoKm, 2)}).`
              : `⚠️ El costo por km del estudio (${money(costoActual.costoKm, 2)}) está por encima de la facturación por km (${money(t.factPorKm, 2)}).`}
          </p>
        )}
      </div>

      {/* Aumentos: clientes vs sueldos (paridad interanual — pedido Bárbara 14/07) */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Aumentos: clientes vs sueldos (interanual)</h3>
          {data.canWrite && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAumentoOpen(true)}>
              <Plus size={13} /> Cargar aumento
            </Button>
          )}
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          La referencia: que el promedio de aumentos a los clientes vaya <span className="font-semibold">a la par</span> de
          lo que se le aumenta a la gente. Últimos 12 meses hasta {mesLabel(data.mes)}.
        </p>

        {(() => {
          const p = data.paridad;
          const sueldosDisp = [p.sueldoChoferes.pct, p.sueldoAdmin.pct].filter((n): n is number => n != null);
          const sueldosProm = sueldosDisp.length ? sueldosDisp.reduce((s, n) => s + n, 0) / sueldosDisp.length : null;
          const brecha = p.clientes.promedio != null && sueldosProm != null ? p.clientes.promedio - sueldosProm : null;
          const fmtPct = (n: number | null) =>
            n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
          return (
            <div className="mb-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Clientes (prom.)</p>
                  <p className={`font-mono text-lg font-bold ${p.clientes.promedio == null ? "text-muted-foreground/50" : "text-foreground"}`}>
                    {fmtPct(p.clientes.promedio)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.clientes.porCliente.length
                      ? `${p.clientes.porCliente.length} cliente${p.clientes.porCliente.length > 1 ? "s" : ""} con aumentos`
                      : "sin aumentos cargados"}
                  </p>
                </div>
                <div className="rounded-md border border-border p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sueldos choferes</p>
                  <p className={`font-mono text-lg font-bold ${p.sueldoChoferes.pct == null ? "text-muted-foreground/50" : "text-foreground"}`}>
                    {fmtPct(p.sueldoChoferes.pct)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.sueldoChoferes.mesBase ? `prom. por chofer vs ${mesLabel(p.sueldoChoferes.mesBase)}` : "falta el mismo mes del año pasado"}
                  </p>
                </div>
                <div className="rounded-md border border-border p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Admin y taller</p>
                  <p className={`font-mono text-lg font-bold ${p.sueldoAdmin.pct == null ? "text-muted-foreground/50" : "text-foreground"}`}>
                    {fmtPct(p.sueldoAdmin.pct)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.sueldoAdmin.mesBase
                      ? `sueldo base vs ${mesLabel(p.sueldoAdmin.mesBase)}${p.sueldoAdmin.parcial ? " (serie incompleta)" : ""}`
                      : "sin matriz de sueldos base"}
                  </p>
                </div>
              </div>

              {brecha != null ? (
                <div className={`rounded-md px-3 py-2 text-xs font-medium ${
                  Math.abs(brecha) <= 3
                    ? "bg-emerald-500/10 text-emerald-700"
                    : brecha < 0
                      ? "bg-red-500/10 text-red-600"
                      : "bg-sky-500/10 text-sky-700"
                }`}>
                  {Math.abs(brecha) <= 3
                    ? `Van a la par: ${Math.abs(brecha).toLocaleString("es-AR", { maximumFractionDigits: 1 })} pp de diferencia.`
                    : brecha < 0
                      ? `⚠️ Los sueldos suben ${Math.abs(brecha).toLocaleString("es-AR", { maximumFractionDigits: 1 })} pp por encima de los aumentos a clientes.`
                      : `Los aumentos a clientes van ${brecha.toLocaleString("es-AR", { maximumFractionDigits: 1 })} pp por encima de los sueldos.`}
                </div>
              ) : (
                <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                  {p.clientes.promedio == null
                    ? "Falta cargar los aumentos de los clientes (YPF, Loma…). Cuando llegue la planilla con los aumentos, cargalos con el botón de arriba y la comparación se arma sola."
                    : "Faltan datos de sueldos para comparar."}
                </div>
              )}

              {p.clientes.porCliente.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.clientes.porCliente.map((c) => {
                    const chip = (
                      <>
                        {c.nombre} <span className="font-mono text-amber-600">{fmtPct(c.acumulado)}</span>
                        {c.cantidad > 1 ? ` (${c.cantidad} aumentos)` : ""}
                      </>
                    );
                    return data.canTarifas ? (
                      <Link
                        key={c.nombre}
                        href={`/tarifas?tab=aumentos&cliente=${encodeURIComponent(c.nombre)}`}
                        title={`Ver el historial de ${c.nombre} en Tarifas`}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        {chip}
                      </Link>
                    ) : (
                      <span key={c.nombre} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                        {chip}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Aumentos de tarifa mes a mes — la fila <span className="font-medium">Interanual</span> se compone y alimenta el card de arriba.
          </p>
          {data.canTarifas ? (
            <Link href="/tarifas?tab=aumentos" className="shrink-0 text-[11px] text-primary hover:underline">
              Ver historial en Tarifas →
            </Link>
          ) : (
            <Link href="/clientes" className="shrink-0 text-[11px] text-primary hover:underline">Clientes</Link>
          )}
        </div>
        {aumentosMes.clientes.length ? (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[280px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Mes</th>
                    {aumentosMes.clientes.map((c) => (
                      <th key={c} className="px-2 py-1.5 text-right font-medium text-foreground">
                        {data.canTarifas ? (
                          <Link
                            href={`/tarifas?tab=aumentos&cliente=${encodeURIComponent(c)}`}
                            title={`Ver el historial de ${c} en Tarifas`}
                            className="hover:text-primary hover:underline"
                          >
                            {c}
                          </Link>
                        ) : (
                          c
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aumentosMes.meses.map((m) => (
                    <tr key={m} className="border-b border-border/50 last:border-0">
                      <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{mesCorto(m)}</td>
                      {aumentosMes.clientes.map((c) => {
                        const a = aumentosMes.idx.get(`${c}|${m.slice(0, 7)}`);
                        return (
                          <td key={c} className="px-2 py-1 text-right font-mono">
                            {a ? (
                              <span className="group inline-flex items-center justify-end gap-1">
                                <span className="text-amber-600 dark:text-amber-400">+{numAr(a.porcentaje, 2)}%</span>
                                {data.canWrite && (
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarAumento(a.id, a.clienteNombre)}
                                    className="text-transparent transition-colors group-hover:text-muted-foreground/60 hover:!text-red-500"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/25">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="px-2 py-1.5 text-left text-muted-foreground">Interanual</td>
                    {aumentosMes.clientes.map((c) => {
                      const v = aumentosMes.interanual.get(c);
                      const io = aumentosMes.interanualOnly.get(c);
                      return (
                        <td key={c} className="px-2 py-1.5 text-right font-mono text-amber-700 dark:text-amber-300">
                          <span className="group inline-flex items-center justify-end gap-1">
                            {v == null ? "—" : `+${numAr(v, 1)}%`}
                            {io && data.canWrite && (
                              <button
                                type="button"
                                onClick={() => handleEliminarAumento(io.id, io.clienteNombre)}
                                className="text-transparent transition-colors group-hover:text-muted-foreground/60 hover:!text-red-500"
                                title="Eliminar interanual"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            {aumentosMes.interanualOnly.size > 0 && (
              <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                {Array.from(aumentosMes.interanualOnly.keys()).join(", ")}: por ahora solo el interanual (última fila). Cuando llegue el detalle mes a mes se completan las celdas de arriba.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground/70">Sin aumentos registrados en el período.</p>
        )}
      </div>

      {/* Comparativa por flota */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Por flota — {mesLabel(data.mes)}</h3>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Flota</th>
              <th className="py-2 pr-4 text-right font-medium">Camiones</th>
              <th className="py-2 pr-4 text-right font-medium">KM</th>
              <th className="py-2 pr-4 text-right font-medium">Facturación</th>
              <th className="py-2 pr-4 text-right font-medium">$/km</th>
              <th className="py-2 pr-4 text-right font-medium">% vacíos</th>
              <th className="py-2 pr-4 text-right font-medium">% al 100%</th>
              <th className="py-2 text-right font-medium">% sueldo/fact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(["escalables", "tolvas"] as const).map((f) => {
              const tf = data.totales[f];
              if (!tf) return null;
              return (
                <tr key={f}>
                  <td className="py-2 pr-4 capitalize text-foreground">{f}</td>
                  <td className="py-2 pr-4 text-right font-mono">{tf.camiones}</td>
                  <td className="py-2 pr-4 text-right font-mono">{numAr(tf.km)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{compactMoney(tf.facturacion)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{money(tf.factPorKm, 2)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{pct(tf.pctVacios)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{pct(tf.pctKm100)}</td>
                  <td className="py-2 text-right font-mono">{pct(tf.pctSueldoFact)}</td>
                </tr>
              );
            })}
            {t && (
              <tr className="bg-muted/40 font-semibold text-foreground">
                <td className="py-2 pr-4">TOTAL</td>
                <td className="py-2 pr-4 text-right font-mono">{t.camiones}</td>
                <td className="py-2 pr-4 text-right font-mono">{numAr(t.km)}</td>
                <td className="py-2 pr-4 text-right font-mono">{compactMoney(t.facturacion)}</td>
                <td className="py-2 pr-4 text-right font-mono">{money(t.factPorKm, 2)}</td>
                <td className="py-2 pr-4 text-right font-mono">{pct(t.pctVacios)}</td>
                <td className="py-2 pr-4 text-right font-mono">{pct(t.pctKm100)}</td>
                <td className="py-2 text-right font-mono">{pct(t.pctSueldoFact)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.canWrite && (
        <CargarAumentoDialog open={aumentoOpen} onOpenChange={setAumentoOpen} onDone={() => router.refresh()} />
      )}
    </div>
  );
}
