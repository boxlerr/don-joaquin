"use client";

// Evolución 13 meses de una métrica: línea general (gruesa) + escalables y
// tolvas (finas), para ver si el mes es tendencia o excepción.

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceDot,
} from "recharts";
import type { SerieMes } from "../actions";
import type { MetricaDef } from "./metricas-def";
import { mesCorto, mesLabel } from "./format";

export default function EvolucionChart({
  def, serie, mesActivo, height = 280,
}: {
  def: MetricaDef;
  serie: SerieMes[];
  mesActivo: string;
  height?: number;
}) {
  const datos = useMemo(
    () =>
      serie.map((s) => ({
        mes: s.mes,
        label: mesCorto(s.mes),
        general: def.valorTotales(s.general),
        escalables: def.valorTotales(s.escalables),
        tolvas: def.valorTotales(s.tolvas),
      })),
    [serie, def],
  );

  const puntoActivo = datos.find((d) => d.mes === mesActivo);
  const hayDatos = datos.some((d) => d.general != null || d.escalables != null || d.tolvas != null);
  if (!hayDatos) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin serie histórica para esta métrica.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={datos} margin={{ right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          tick={{ fontSize: 10 }}
          width={64}
          tickFormatter={(v: number) => def.fmt(v)}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = datos.find((x) => x.label === label);
            return (
              <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-semibold text-foreground">{d ? mesLabel(d.mes) : label}</p>
                {payload.map((p) => (
                  <p key={p.dataKey as string} className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="capitalize text-muted-foreground">{p.name}:</span>
                    <span className="font-mono text-foreground">{p.value == null ? "s/d" : def.fmt(Number(p.value))}</span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="general" name="General" stroke="#0088D1" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
        <Line type="monotone" dataKey="escalables" name="Escalables" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="1 0" dot={false} connectNulls />
        <Line type="monotone" dataKey="tolvas" name="Tolvas" stroke="#F59E0B" strokeWidth={1.5} dot={false} connectNulls />
        {puntoActivo?.general != null && (
          <ReferenceDot x={puntoActivo.label} y={puntoActivo.general} r={5} fill="#0088D1" stroke="var(--card)" strokeWidth={2} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
