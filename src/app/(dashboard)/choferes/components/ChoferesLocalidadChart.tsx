"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type LocalidadData = { localidad: string; cantidad: number };

interface Props {
  data: LocalidadData[];
}

const COLOR_PRINCIPAL = "#0088D1";
const COLOR_RESTO = "#93C5FD";

export default function ChoferesLocalidadChart({ data }: Props) {
  if (data.length === 0) return null;

  const top = data[0];

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">Distribución por localidad</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choferes activos e inactivos agrupados por localidad de residencia
        </p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <XAxis
            dataKey="localidad"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as LocalidadData;
              return (
                <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                  <p className="font-semibold text-foreground">{d.localidad}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {d.cantidad} {d.cantidad === 1 ? "chofer" : "choferes"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell
                key={entry.localidad}
                fill={entry.localidad === top.localidad ? COLOR_PRINCIPAL : COLOR_RESTO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
