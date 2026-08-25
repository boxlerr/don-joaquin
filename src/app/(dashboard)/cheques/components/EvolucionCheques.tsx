"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { evolucionPorMes, type ChequeParaMes } from "../por-mes";

/**
 * La curva del final: cuánto vence por mes, separando lo que entra de lo que
 * sale.
 *
 * **Va al final de la pantalla a propósito** (pedido de Julián, 25/08/2026).
 * Arriba están los números con los que se decide algo hoy; esto es el contexto
 * que se mira después, cuando ya se resolvió lo urgente.
 *
 * Grafica VENCIMIENTOS, no el estado histórico de la cartera. No guardamos en
 * qué estado estaba cada cheque hace tres meses, así que una línea de "cuánta
 * cartera había en marzo" habría que inventarla — y un gráfico inventado es
 * peor que ningún gráfico.
 */

const ENTRA = "#0088D1";
const SALE = "#E11D48";

function ars(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

/** Millones en el eje: los importes son de nueve cifras y no entran. */
function corto(n: number): string {
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

  if (datos.length < 2) return null;

  const peor = datos.reduce((a, m) => (m.neto < a.neto ? m : a), datos[0]!);

  return (
    <section className="mt-6 rounded-[8px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">Qué vence cada mes</h2>
        <p className="text-xs text-muted-foreground">
          Sólo los cheques que siguen abiertos
        </p>
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

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="chq-entra" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ENTRA} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ENTRA} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="chq-sale" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SALE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SALE} stopOpacity={0.02} />
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
            width={44}
          />
          <ReferenceLine y={0} stroke="#CBD5E1" />
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
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Area
            type="monotone"
            dataKey="aCobrar"
            name="Entra (a cobrar)"
            stroke={ENTRA}
            strokeWidth={2}
            fill="url(#chq-entra)"
            dot={{ r: 2.5, strokeWidth: 0, fill: ENTRA }}
          />
          <Area
            type="monotone"
            dataKey="aPagar"
            name="Sale (a pagar)"
            stroke={SALE}
            strokeWidth={2}
            fill="url(#chq-sale)"
            dot={{ r: 2.5, strokeWidth: 0, fill: SALE }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}
