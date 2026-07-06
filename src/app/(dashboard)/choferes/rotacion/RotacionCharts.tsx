"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceDot, PieChart, Pie, Cell, BarChart, Bar, LabelList,
} from "recharts";
import { BENCHMARK_MIN, BENCHMARK_MAX } from "./compute";
import type { MetricasAnio } from "./compute";

const card = "bg-card border border-border rounded-[8px] p-5";

// ── Evolución del índice de rotación (multi-año) ───────────────────────────
export type SeriePunto = { anio: number; ir_total: number; ir_voluntaria: number; ir_involuntaria: number };

export function EvolucionRotacionChart({ serie, anioSel }: { serie: SeriePunto[]; anioSel: number }) {
  const puntoSel = serie.find((s) => s.anio === anioSel);
  const maxY = Math.max(BENCHMARK_MAX + 4, ...serie.map((s) => s.ir_total), 10);
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Evolución del índice de rotación</h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-[#0088D1]" /> Total</span>
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-emerald-500" /> Voluntaria</span>
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-amber-500" /> Involuntaria</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-muted/70 border border-border" /> Benchmark</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={serie} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} domain={[0, Math.ceil(maxY)]} unit="%" width={44} />
          <ReferenceArea y1={BENCHMARK_MIN} y2={BENCHMARK_MAX} fill="#94A3B8" fillOpacity={0.1} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs space-y-0.5">
                  <p className="font-semibold text-foreground">Año {label}</p>
                  {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color as string }}>
                      {p.name}: <span className="font-semibold">{p.value}%</span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="ir_voluntaria" name="Voluntaria" stroke="#10B981" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="ir_involuntaria" name="Involuntaria" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="ir_total" name="Total" stroke="#0088D1" strokeWidth={2.5} dot={{ r: 2.5 }} />
          {puntoSel && <ReferenceDot x={anioSel} y={puntoSel.ir_total} r={5} fill="#0088D1" stroke="#fff" strokeWidth={2} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Bajas por tipo (donut voluntaria/involuntaria/jubilación) ──────────────
export function BajasPorTipoChart({ m }: { m: MetricasAnio }) {
  const data = m.por_clase;
  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-foreground mb-1">Bajas por tipo</h2>
      <p className="text-xs text-muted-foreground mb-2">Voluntaria vs. involuntaria vs. jubilación</p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin bajas en el período.</p>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="50%" height={160}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
                {data.map((d) => <Cell key={d.clase} fill={d.color} />)}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                      <span className="font-semibold text-foreground">{d.label}</span>: {d.count} ({d.pct}%)
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {data.map((d) => (
              <div key={d.clase} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-foreground flex-1">{d.label}</span>
                <span className="font-semibold text-foreground">{d.count}</span>
                <span className="text-muted-foreground text-xs w-10 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Antigüedad al egresar (tramos) + conclusión ────────────────────────────
export function AntiguedadTramosChart({ m }: { m: MetricasAnio }) {
  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-foreground mb-1">Antigüedad al egresar</h2>
      <p className="text-xs text-muted-foreground mb-2">¿Se van los nuevos o los históricos?</p>
      {m.por_tramo.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de antigüedad.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={m.por_tramo} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
              <Tooltip
                cursor={{ fill: "#F1F5F9" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as MetricasAnio["por_tramo"][number];
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                      <span className="font-semibold text-foreground">{d.label}</span>: {d.count} ({d.pct}%)
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {m.por_tramo.map((d) => <Cell key={d.tramo} fill={d.color} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {m.antiguedad_promedio_meses != null && (
            <div className="mt-3 rounded-md bg-[#F0F9FF] border border-[#BAE6FD] px-3 py-2 text-xs text-[#075985]">
              <span className="font-semibold">{m.pct_menos_3_anios}%</span> de las bajas tienen menos de 3 años de antigüedad
              {m.pct_menos_3_anios >= 60 && " → el desafío es fidelizar a los nuevos, no a los históricos."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
