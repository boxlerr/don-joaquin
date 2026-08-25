"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { evolucionPorMes, type ChequeParaMes } from "../por-mes";

/**
 * Cuánto vence por mes, separando lo que entra de lo que sale.
 *
 * **Barras y no curvas, por un motivo concreto.** La primera versión usaba una
 * curva suave y con tres meses cargados dibujaba un arco que llegaba a 450M
 * entre dos puntos que valían cero: la interpolación inventaba plata que no
 * existe en ningún cheque. Una barra por mes no puede hacer eso — mide lo que
 * hay y nada más.
 *
 * Va al final de la pantalla a propósito (pedido de Julián): arriba están los
 * números con los que se decide algo hoy, esto es el contexto que se mira
 * después.
 *
 * Grafica VENCIMIENTOS, no el estado histórico de la cartera: no guardamos en
 * qué estado estaba cada cheque hace tres meses.
 */

const ENTRA = "#0088D1";
const SALE = "#E11D48";

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
  hoy,
}: {
  cheques: ChequeParaMes[];
  hoy: string;
}) {
  const datos = useMemo(() => evolucionPorMes(cheques, hoy), [cheques, hoy]);

  if (datos.length === 0) return null;

  const peor = datos.reduce((a, m) => (m.neto < a.neto ? m : a), datos[0]!);
  const mesHoy = hoy.slice(0, 7);

  return (
    <section className="mt-6 rounded-[8px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">Qué vence cada mes</h2>
        <p className="text-xs text-muted-foreground">Sólo los cheques que siguen abiertos</p>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {peor.neto < 0 ? (
          <>
            El mes más ajustado es{" "}
            <span className="font-semibold text-foreground">{peor.label}</span>: salen{" "}
            <span className="font-semibold text-rose-700">{ars(-peor.neto)}</span> más de lo que
            entran.
          </>
        ) : (
          <>Todos los meses cierran con más entradas que salidas.</>
        )}
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={datos} margin={{ top: 16, right: 8, bottom: 0, left: 4 }} barGap={4}>
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
            width={44}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            formatter={(v, name) => [ars(Number(v) || 0), name]}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            }}
          />
          <Bar dataKey="aCobrar" name="Entra (a cobrar)" fill={ENTRA} radius={[3, 3, 0, 0]} maxBarSize={44}>
            {datos.map((d) => (
              // El mes en curso va lleno; los demás, atenuados. Es el que se
              // está viviendo y tiene que saltar sin leer el eje.
              <Cell key={d.mes} fillOpacity={d.mes === mesHoy ? 1 : 0.55} />
            ))}
            <LabelList
              dataKey="aCobrar"
              position="top"
              formatter={(v: unknown) => (Number(v) > 0 ? corto(Number(v)) : "")}
              style={{ fontSize: 10, fill: "#64748B" }}
            />
          </Bar>
          <Bar dataKey="aPagar" name="Sale (a pagar)" fill={SALE} radius={[3, 3, 0, 0]} maxBarSize={44}>
            {datos.map((d) => (
              <Cell key={d.mes} fillOpacity={d.mes === mesHoy ? 1 : 0.55} />
            ))}
            <LabelList
              dataKey="aPagar"
              position="top"
              formatter={(v: unknown) => (Number(v) > 0 ? corto(Number(v)) : "")}
              style={{ fontSize: 10, fill: "#64748B" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Leyenda propia: la de recharts dibuja el mismo cuadrito para las dos
          series y acá el color ES el dato. */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: ENTRA }} />
          Entra (a cobrar)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: SALE }} />
          Sale (a pagar)
        </span>
      </div>
    </section>
  );
}
