"use client";

// Pestaña Resumen: cómo fue el mes, de arriba hacia abajo y en orden de
// importancia — los números del mes por flota, el mejor/peor por métrica, y
// después los dos análisis (costo vs facturación y paridad de aumentos).
//
// Criterios de diseño (pedido de Julián 25/07): nada de texto de 10px —
// lo usa gente de todas las edades— y sin huecos blancos: la grilla va con
// `items-start` para que una tarjeta corta no se estire al alto de la larga,
// y la tabla de aumentos mes a mes (13 filas, casi todas vacías) arranca
// plegada para que las dos columnas queden parejas.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Trophy, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { MetricasData, MetricaChofer } from "../actions";
import { eliminarAumentoClienteAction } from "../actions";
import { METRICAS } from "./metricas-def";
import { money, numAr, pct, mesLabel, mesCorto } from "./format";
import CargarAumentoDialog from "../CargarAumentoDialog";

/** Encabezado de sección: título legible + una línea que explica qué se está viendo. */
function TituloSeccion({ titulo, explica, accion }: { titulo: string; explica: string; accion?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-muted-foreground">{explica}</p>
      </div>
      {accion}
    </div>
  );
}

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
  const [verMesAMes, setVerMesAMes] = useState(false);
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
      const mejor = conValor[0];
      const peor = conValor[conValor.length - 1];
      // Si el mejor y el peor valen lo mismo (típico del mes en vivo, con todo
      // en $0) no hay nada que destacar: mostrarlo confunde más que ayuda.
      if (mejor.v === peor.v) return null;
      return { def, mejor, peor };
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
  // a la fila de abajo y NO a una celda mensual.
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

  const fmtPct = (n: number | null) =>
    n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;

  const filasFlota = (["escalables", "tolvas"] as const)
    .map((f) => ({ f, tf: data.totales[f] }))
    .filter((r) => r.tf != null);

  return (
    <div className="space-y-4">
      {/* ── 1. Los números del mes: es lo primero que se quiere ver ─────── */}
      <section className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
        <TituloSeccion
          titulo={`Cómo viene ${mesLabel(data.mes)}`}
          explica="Los totales del mes separados por flota. La última fila es el conjunto de la empresa."
        />
        {/* Tabla de consulta (3 filas × 8 columnas): scrollea de costado y la
            columna de flota queda fija para no perder la referencia. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-[15px]">
            <thead>
              <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card shadow-[1px_0_0_var(--border)] py-2 pr-4 font-medium">Flota</th>
                <th className="py-2 pr-4 text-right font-medium">Camiones</th>
                <th className="py-2 pr-4 text-right font-medium">KM</th>
                <th className="py-2 pr-4 text-right font-medium">Facturación</th>
                <th className="py-2 pr-4 text-right font-medium">$ por km</th>
                <th className="py-2 pr-4 text-right font-medium">% vacíos</th>
                <th className="py-2 pr-4 text-right font-medium">% al 100%</th>
                <th className="py-2 text-right font-medium">% sueldo/fact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filasFlota.map(({ f, tf }) => (
                <tr key={f}>
                  <td className="sticky left-0 z-10 bg-card shadow-[1px_0_0_var(--border)] py-2.5 pr-4 capitalize text-foreground">{f}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{tf!.camiones}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{numAr(tf!.km)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{money(tf!.facturacion)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{money(tf!.factPorKm, 2)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{pct(tf!.pctVacios)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{pct(tf!.pctKm100)}</td>
                  <td className="py-2.5 text-right font-mono">{pct(tf!.pctSueldoFact)}</td>
                </tr>
              ))}
              {t && (
                <tr className="bg-muted/40 font-semibold text-foreground">
                  {/* El tinte de la fila se repite con ::before para que la
                      celda fija tenga fondo opaco al scrollear. */}
                  <td className="sticky left-0 z-10 bg-card shadow-[1px_0_0_var(--border)] py-2.5 pr-4 before:absolute before:inset-0 before:bg-muted/40">
                    <span className="relative">TOTAL</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono">{t.camiones}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{numAr(t.km)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{money(t.facturacion)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{money(t.factPorKm, 2)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{pct(t.pctVacios)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{pct(t.pctKm100)}</td>
                  <td className="py-2.5 text-right font-mono">{pct(t.pctSueldoFact)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2. Quién se destacó ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
        <TituloSeccion
          titulo="El mejor y el peor de cada métrica"
          explica="Solo choferes con el mes completo. Tocá un nombre para ver su detalle."
          accion={
            <Link
              href="/choferes/ranking"
              className="inline-flex shrink-0 items-center text-[13px] font-medium text-primary hover:underline max-md:min-h-9"
            >
              Ranking completo →
            </Link>
          }
        />
        {destacados.length ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {destacados.map(({ def, mejor, peor }) => (
              <div key={def.id} className="rounded-md border border-border p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{def.tab}</p>
                <button
                  type="button"
                  onClick={() => onChofer(mejor.c)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[13px] hover:bg-emerald-500/10 max-md:py-2"
                  title={`Ver detalle de ${mejor.c.nombre}`}
                >
                  <Trophy size={13} className="shrink-0 text-emerald-500" />
                  <span className="flex-1 truncate text-foreground">{mejor.c.nombre}</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{def.fmt(mejor.v)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChofer(peor.c)}
                  className="mt-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[13px] hover:bg-red-500/10 max-md:py-2"
                  title={`Ver detalle de ${peor.c.nombre}`}
                >
                  <AlertTriangle size={13} className="shrink-0 text-red-400" />
                  <span className="flex-1 truncate text-foreground">{peor.c.nombre}</span>
                  <span className="font-mono font-semibold text-red-500">{def.fmt(peor.v)}</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no hay con qué comparar: hacen falta al menos 2 choferes con el mes completo y valores distintos.
          </p>
        )}
      </section>

      {/* ── 3. Los dos análisis, lado a lado. items-start = sin estirar ──── */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {/* Facturación vs costo por km (planilla COSTO VS KM) */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
          <TituloSeccion
            titulo="¿El km se cobra más de lo que cuesta?"
            explica="Si la línea azul (lo que se factura) cae por debajo de la roja (lo que cuesta según el estudio), se está trabajando a pérdida."
          />
          {data.serieCosto.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.serieCosto.map((r) => ({ ...r, label: mesCorto(r.mes) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${numAr(v)}`} width={70} />
                <Tooltip formatter={(v) => money(Number(v), 2)} contentStyle={{ fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="factKm" name="Se factura $/km" stroke="#0088D1" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
                <Line type="monotone" dataKey="costoKm" name="Cuesta $/km" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Sin serie de costo cargada.</p>
          )}
          {/* El veredicto compara las DOS líneas del gráfico (misma fila de la
              misma planilla). Antes usaba el KPI general de arriba, que se
              calcula distinto y no coincidía con el último punto del azul. */}
          {costoActual?.costoKm != null && costoActual.factKm != null && (
            <p
              className={`mt-3 rounded-md border px-3 py-2 text-[13px] leading-snug ${
                costoActual.factKm >= costoActual.costoKm
                  ? "border-emerald-500/30 text-foreground"
                  : "border-red-500/30 font-medium text-red-600 dark:text-red-400"
              }`}
            >
              {costoActual.factKm >= costoActual.costoKm
                ? `Bien: en ${mesLabel(data.mes)} cada km se factura ${money(costoActual.factKm, 2)} y cuesta ${money(costoActual.costoKm, 2)}.`
                : `Atención: en ${mesLabel(data.mes)} cada km cuesta ${money(costoActual.costoKm, 2)} y se factura ${money(costoActual.factKm, 2)}. Son ${money(costoActual.costoKm - costoActual.factKm, 2)} de pérdida por km.`}
            </p>
          )}

          {/* De dónde sale cada línea: es la pregunta que aparece siempre. */}
          <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/20 p-3 text-[13px] leading-snug">
            <p className="font-semibold text-foreground">De dónde sale cada línea</p>
            <p className="text-muted-foreground">
              <span className="font-medium text-red-600 dark:text-red-400">Cuesta $/km</span> — lo que le sale a la
              empresa hacer un kilómetro. Es la columna{" "}
              <span className="font-mono text-[12px]">ESTUDIO DE COSTO</span> de la planilla COSTO VS KM: un número
              por mes que arma el estudio contable por fuera del sistema. No se calcula acá ni sale de los viajes,
              y —como la línea azul— está armado sobre <span className="font-medium text-foreground">escalables</span>.
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-[#0088D1]">Se factura $/km</span> — columna
              {" "}<span className="font-mono text-[12px]">FACTURACION POR KM</span> de la misma planilla: el
              promedio del $/km de cada chofer de <span className="font-medium text-foreground">escalables</span>,
              sin contar a los que entraron o salieron a mitad de mes.
            </p>
            {t?.factPorKm != null && costoActual?.factKm != null &&
              Math.abs(t.factPorKm - costoActual.factKm) > 1 && (
              <p className="border-t border-border pt-2 text-muted-foreground">
                No confundir con el KPI <span className="font-medium text-foreground">Facturación por km</span> de
                arriba ({money(t.factPorKm, 2)}): ese es facturación total ÷ km totales e incluye las tolvas, que
                facturan más por km. Por eso da distinto de los {money(costoActual.factKm, 2)} de este gráfico.
              </p>
            )}
          </div>
        </section>

        {/* Aumentos: clientes vs sueldos (paridad interanual — pedido Bárbara 14/07) */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
          <TituloSeccion
            titulo="¿Los aumentos van a la par?"
            explica={`Lo que se le aumentó a los clientes contra lo que se le aumentó a la gente, con la inflación de referencia. Últimos 12 meses hasta ${mesLabel(data.mes)}.`}
            accion={
              data.canWrite ? (
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setAumentoOpen(true)}>
                  <Plus size={14} /> Cargar aumento
                </Button>
              ) : undefined
            }
          />

          {(() => {
            const p = data.paridad;
            const sueldosDisp = [p.sueldoChoferes.pct, p.sueldoAdmin.pct].filter((n): n is number => n != null);
            const sueldosProm = sueldosDisp.length ? sueldosDisp.reduce((s, n) => s + n, 0) / sueldosDisp.length : null;
            const brecha = p.clientes.promedio != null && sueldosProm != null ? p.clientes.promedio - sueldosProm : null;
            const nDec = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

            // Dos barras a la misma escala: lo que entra (aumentos a clientes)
            // contra lo que sale (aumentos a la gente), con la inflación como
            // tercera referencia. La escala la fija el mayor de los tres.
            const filas = [
              {
                k: "A los clientes",
                v: p.clientes.promedio,
                color: "bg-sky-500",
                pie: p.clientes.porCliente.length
                  ? `${p.clientes.porCliente.length} cliente${p.clientes.porCliente.length > 1 ? "s" : ""}`
                  : "sin aumentos cargados",
              },
              {
                k: "A la gente",
                v: sueldosProm,
                color: "bg-amber-500",
                pie:
                  sueldosDisp.length === 2
                    ? `choferes ${fmtPct(p.sueldoChoferes.pct)} · admin y taller ${fmtPct(p.sueldoAdmin.pct)}`
                    : p.sueldoChoferes.pct != null
                      ? `solo choferes (falta admin y taller)`
                      : p.sueldoAdmin.pct != null
                        ? `solo admin y taller (falta choferes)`
                        : "sin datos de sueldos",
              },
              {
                k: "Inflación",
                v: p.inflacion.pct,
                color: "bg-muted-foreground/50",
                pie: p.inflacion.hastaMes
                  ? p.inflacion.completa
                    ? "IPC INDEC, mismos 12 meses"
                    : `IPC INDEC hasta ${mesLabel(p.inflacion.hastaMes)} (falta publicar el resto)`
                  : "sin dato de INDEC",
              },
            ];
            const tope = Math.max(1, ...filas.map((f) => f.v ?? 0));

            return (
              <div className="space-y-3">
                <div className="space-y-2">
                  {filas.map((f) => (
                    <div key={f.k} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[12px] text-muted-foreground sm:w-28">{f.k}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-[3px] bg-muted">
                        {f.v != null && f.v > 0 && (
                          <span
                            className={`block h-full rounded-[3px] ${f.color}`}
                            style={{ width: `${Math.min(100, (f.v / tope) * 100)}%` }}
                          />
                        )}
                      </span>
                      <span
                        className={`w-16 shrink-0 text-right font-mono text-[15px] font-bold ${f.v == null ? "text-muted-foreground/40" : "text-foreground"}`}
                      >
                        {fmtPct(f.v)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] leading-snug text-muted-foreground">
                  {filas.map((f) => `${f.k}: ${f.pie}`).join(" · ")}
                </p>

                {brecha != null ? (
                  /* Sin fondo de color: el borde izquierdo y el número alcanzan.
                     Y la cuenta escrita, para que el número no salga de la nada. */
                  <p
                    className={`border-l-2 pl-3 text-[13px] leading-snug ${
                      Math.abs(brecha) <= 3
                        ? "border-emerald-500"
                        : brecha < 0
                          ? "border-red-500"
                          : "border-sky-500"
                    }`}
                  >
                    <span className="font-medium text-foreground">
                      {Math.abs(brecha) <= 3
                        ? "Van a la par."
                        : brecha < 0
                          ? `A la gente le subiste ${nDec(Math.abs(brecha))} puntos más de lo que le aumentaste a los clientes.`
                          : `A los clientes les aumentaste ${nDec(brecha)} puntos más de lo que le subiste a la gente.`}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {fmtPct(p.clientes.promedio)} contra {fmtPct(sueldosProm)}: {nDec(Math.abs(brecha))} puntos de
                      diferencia.
                    </span>
                  </p>
                ) : (
                  <p className="border-l-2 border-amber-500 pl-3 text-[13px] leading-snug text-muted-foreground">
                    {p.clientes.promedio == null
                      ? "Faltan los aumentos de los clientes (YPF, Loma…). Cargalos con el botón de arriba y la comparación se arma sola."
                      : "Faltan datos de sueldos para poder comparar."}
                  </p>
                )}

                {p.clientes.porCliente.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.clientes.porCliente.map((c) => {
                      const chip = (
                        <>
                          {c.nombre} <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{fmtPct(c.acumulado)}</span>
                          {c.cantidad > 1 ? ` · ${c.cantidad} aumentos` : ""}
                        </>
                      );
                      return data.canTarifas ? (
                        <Link
                          key={c.nombre}
                          href={`/tarifas?tab=aumentos&cliente=${encodeURIComponent(c.nombre)}`}
                          title={`Ver el historial de ${c.nombre} en Tarifas`}
                          className="inline-flex items-center rounded-[6px] border border-border px-2 py-1 text-[12px] text-foreground transition-colors hover:border-primary/40 hover:text-primary max-md:min-h-9"
                        >
                          {chip}
                        </Link>
                      ) : (
                        <span key={c.nombre} className="inline-flex items-center rounded-[6px] border border-border px-2 py-1 text-[12px] text-foreground max-md:min-h-9">
                          {chip}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* El detalle mes a mes arranca plegado: son 13 filas casi vacías que
              estiraban esta tarjeta al doble que la de al lado. */}
          {aumentosMes.clientes.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVerMesAMes(!verMesAMes)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-primary max-md:min-h-9"
                >
                  {verMesAMes ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  Ver el detalle mes a mes
                </button>
                <Link
                  href={data.canTarifas ? "/tarifas?tab=aumentos" : "/clientes"}
                  className="inline-flex shrink-0 items-center text-[13px] text-primary hover:underline max-md:min-h-9"
                >
                  {data.canTarifas ? "Historial en Tarifas →" : "Clientes →"}
                </Link>
              </div>

              {verMesAMes && (
                <>
                  {/* Matriz meses × clientes: scroll de costado con la columna
                      del mes fija (los clientes se van sumando con el tiempo). */}
                  <div className="mt-2.5 overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[280px] border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-muted">
                          <th className="sticky left-0 z-10 shadow-[1px_0_0_var(--border)] bg-muted px-2.5 py-2 text-left font-medium text-muted-foreground">Mes</th>
                          {aumentosMes.clientes.map((c) => (
                            <th key={c} className="px-2.5 py-2 text-right font-medium text-foreground">
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
                            <td className="sticky left-0 z-10 whitespace-nowrap shadow-[1px_0_0_var(--border)] bg-card px-2.5 py-1.5 text-muted-foreground max-md:py-2.5">{mesCorto(m)}</td>
                            {aumentosMes.clientes.map((c) => {
                              const a = aumentosMes.idx.get(`${c}|${m.slice(0, 7)}`);
                              return (
                                <td key={c} className="px-2.5 py-1.5 text-right font-mono max-md:py-2.5">
                                  {a ? (
                                    <span className="group inline-flex items-center justify-end gap-1">
                                      <span className="text-amber-600 dark:text-amber-400">+{numAr(a.porcentaje, 2)}%</span>
                                      {data.canWrite && (
                                        <button
                                          type="button"
                                          onClick={() => handleEliminarAumento(a.id, a.clienteNombre)}
                                          // En celular no hay hover: el tacho tiene que verse siempre.
                                          className="inline-flex items-center justify-center text-transparent transition-colors group-hover:text-muted-foreground/60 hover:!text-red-500 max-md:size-9 max-md:text-muted-foreground/60"
                                          title="Eliminar"
                                        >
                                          <Trash2 size={12} />
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
                        <tr className="border-t-2 border-border bg-muted font-semibold">
                          <td className="sticky left-0 z-10 shadow-[1px_0_0_var(--border)] bg-muted px-2.5 py-2 text-left text-muted-foreground">Interanual</td>
                          {aumentosMes.clientes.map((c) => {
                            const v = aumentosMes.interanual.get(c);
                            const io = aumentosMes.interanualOnly.get(c);
                            return (
                              <td key={c} className="px-2.5 py-2 text-right font-mono text-amber-700 dark:text-amber-300">
                                <span className="group inline-flex items-center justify-end gap-1">
                                  {v == null ? "—" : `+${numAr(v, 1)}%`}
                                  {io && data.canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => handleEliminarAumento(io.id, io.clienteNombre)}
                                      className="inline-flex items-center justify-center text-transparent transition-colors group-hover:text-muted-foreground/60 hover:!text-red-500 max-md:size-9 max-md:text-muted-foreground/60"
                                      title="Eliminar interanual"
                                    >
                                      <Trash2 size={12} />
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
                    <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                      {Array.from(aumentosMes.interanualOnly.keys()).join(", ")}: por ahora solo el interanual (última fila).
                      Cuando llegue el detalle mes a mes se completan las celdas de arriba.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {data.canWrite && (
        <CargarAumentoDialog open={aumentoOpen} onOpenChange={setAumentoOpen} onDone={() => router.refresh()} />
      )}
    </div>
  );
}
