"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Combobox } from "@/components/ui/combobox";
import {
  evolucionCartera,
  ultimosMeses,
  type ChequeParaEvolucion,
  type TransicionCheque,
} from "../evolucion";

/**
 * Cómo estaba la cartera al cierre de cada mes.
 *
 * Las cuatro series salen de `cheque_historial_estado`, que registra cada
 * transición con su fecha: el estado de un cheque a fin de julio es el de su
 * última transición anterior a esa fecha, no el que tiene hoy.
 *
 * Va al final de la pantalla a propósito (pedido de Julián): arriba están los
 * números con los que se decide algo hoy, esto es el contexto que se mira
 * después.
 */

const SERIES = [
  { key: "enCartera", label: "En cartera", color: "#2563EB" },
  { key: "porVencer", label: "Por vencer", color: "#F59E0B" },
  { key: "vencidos", label: "Vencidos", color: "#EF4444" },
  { key: "nuestros", label: "Nuestros", color: "#10B981" },
] as const;

const RANGOS = [
  { id: "6", label: "Últimos 6 meses" },
  { id: "12", label: "Últimos 12 meses" },
] as const;

function ars(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

/** Millones en el eje: los importes son de nueve cifras y no entran. */
function corto(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default function EvolucionCheques({
  cheques,
  transiciones,
  hoy,
}: {
  cheques: ChequeParaEvolucion[];
  transiciones: TransicionCheque[];
  hoy: string;
}) {
  const [rango, setRango] = useState<string>("6");

  const datos = useMemo(
    () => evolucionCartera(cheques, transiciones, ultimosMeses(hoy, Number(rango)), Number(hoy.slice(0, 4))),
    [cheques, transiciones, hoy, rango],
  );

  // Sin un solo peso en ningún mes, la grilla vacía no dice nada que no diga
  // mejor la lista de arriba.
  const hayAlgo = datos.some((d) => d.enCartera + d.porVencer + d.vencidos + d.nuestros > 0);
  if (!hayAlgo) return null;

  return (
    <section className="mt-6 rounded-[8px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Evolución mensual (importe)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cómo quedó la cartera al cierre de cada mes
          </p>
        </div>
        <Combobox
          value={rango}
          onValueChange={setRango}
          options={RANGOS.map((r) => ({ id: r.id, label: r.label }))}
          searchable={false}
          triggerClassName="h-9 w-44 text-sm sm:h-8"
          aria-label="Rango del gráfico"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="chq-cartera" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
              />
              <YAxis
                tickFormatter={corto}
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                formatter={(v, name) => [ars(Number(v) || 0), name]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                }}
              />
              {/* Sólo la cartera lleva relleno: es la serie de referencia y con
                  las cuatro sombreadas no se distingue ninguna. */}
              <Area
                type="monotone"
                dataKey="enCartera"
                name="En cartera"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#chq-cartera)"
                dot={{ r: 3, strokeWidth: 0, fill: "#2563EB" }}
                activeDot={{ r: 4 }}
              />
              {SERIES.filter((s) => s.key !== "enCartera").map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Leyenda propia, en columna a la derecha como el resto del sistema: la
            de recharts la pone abajo y en una fila que se parte en celular. */}
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 lg:w-40 lg:shrink-0 lg:flex-col lg:gap-2">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
