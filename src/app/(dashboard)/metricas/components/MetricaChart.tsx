"use client";

// Barras por chofer de una métrica. Paleta sobria: azul de marca para todos,
// verde solo el top 3 y rojo solo el fondo 3 (chau arcoíris). Línea de
// referencia en el promedio de la selección y click en la barra → drawer.

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import type { MetricaChofer } from "../actions";
import type { MetricaDef } from "./metricas-def";
import { flotaLabel } from "./metricas-def";

const AZUL = "#0088D1";
const VERDE = "#10B981";
const ROJO = "#EF4444";

export default function MetricaChart({
  def, choferes, onChofer,
}: {
  def: MetricaDef;
  choferes: MetricaChofer[];
  onChofer: (c: MetricaChofer) => void;
}) {
  const serie = useMemo(() => {
    const conValor = choferes
      .map((c) => ({ chofer: c, valor: def.valorChofer(c) }))
      .filter((r): r is { chofer: MetricaChofer; valor: number } => r.valor != null);
    // Mejor arriba siempre (asc si menos es mejor).
    conValor.sort((a, b) => (def.mejorMenos ? a.valor - b.valor : b.valor - a.valor));
    return conValor.map((r, i) => ({
      nombre: r.chofer.nombre,
      etiqueta: `${r.chofer.ingresoParcial ? "◐ " : ""}${r.chofer.nombre}`,
      flota: flotaLabel(r.chofer),
      valor: r.valor,
      parcial: r.chofer.ingresoParcial,
      rank: i,
      chofer: r.chofer,
    }));
  }, [choferes, def]);

  const promedio = useMemo(() => {
    if (!serie.length) return null;
    return serie.reduce((s, r) => s + r.valor, 0) / serie.length;
  }, [serie]);

  if (!serie.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos de {def.titulo.toLowerCase()} para los filtros elegidos.</p>;
  }

  const colorDe = (rank: number) => {
    if (serie.length >= 6) {
      if (rank < 3) return VERDE;
      if (rank >= serie.length - 3) return ROJO;
    }
    return AZUL;
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(240, serie.length * 24)}>
        <BarChart data={serie} layout="vertical" margin={{ left: 30, right: 56, top: 4 }}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="etiqueta"
            width={150}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,136,209,0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof serie)[number];
              return (
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-foreground">{p.nombre}</p>
                  <p className="text-muted-foreground">{p.flota}{p.parcial ? " · entró/salió a mitad de mes" : ""}</p>
                  <p className="mt-1 font-mono text-foreground">{def.fmt(p.valor)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Click para ver el detalle del chofer</p>
                </div>
              );
            }}
          />
          {promedio != null && (
            <ReferenceLine
              x={promedio}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 3"
              label={{
                value: `Prom. ${def.fmt(promedio)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
          <Bar
            dataKey="valor"
            radius={[0, 4, 4, 0]}
            onClick={(_, index) => onChofer(serie[index].chofer)}
            cursor="pointer"
            label={{
              position: "right",
              fontSize: 9,
              fill: "var(--muted-foreground)",
              formatter: (v: unknown) => def.fmt(Number(v)),
            }}
          >
            {serie.map((r) => (
              <Cell key={r.nombre + r.flota} fill={colorDe(r.rank)} opacity={r.parcial ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: VERDE }} /> Mejores 3</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: AZUL }} /> Resto</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: ROJO }} /> Últimos 3</span>
        <span>◐ = entró/salió a mitad de mes</span>
        <span className="border-l border-border pl-3">- - promedio de la selección</span>
      </div>
    </div>
  );
}
