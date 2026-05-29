"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Truck, Lock, AlertTriangle, Activity } from "lucide-react";
import type {
  ProductividadKPIs,
  CamionHistorialItem,
  AdelantoMes,
  EvolucionMes,
} from "./types";

interface Props {
  kpis: ProductividadKPIs;
  historial: CamionHistorialItem[];
  adelantos: AdelantoMes[];
  evolucion: EvolucionMes[];
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(fechaISO: string): string {
  const d = new Date(fechaISO + "T00:00:00");
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtMoneda(n: number, moneda: string): string {
  if (n === 0) return moneda === "USD" ? "US$ 0" : "$ 0";
  return `${moneda === "USD" ? "US$" : "$"} ${fmtNum(n)}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR");
}

function scoreConfig(score: number | null): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  if (score === null) return { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", label: "Sin actividad" };
  if (score >= 80) return { color: "text-[#10B981]", bg: "bg-[#10B981]/10", border: "border-[#10B981]/30", label: "Bueno" };
  if (score >= 60) return { color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/30", label: "Regular" };
  return { color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", border: "border-[#EF4444]/30", label: "Bajo" };
}

export default function ChoferProductividadTab({ kpis, historial, adelantos, evolucion }: Props) {
  const periodoLabel = nombreMes(kpis.periodo_desde);
  const sc = scoreConfig(kpis.score);
  const mesActual = kpis.periodo_desde.slice(0, 7);

  return (
    <div className="space-y-6">
      {/* Score operativo */}
      <div className={`rounded-[8px] border px-5 py-4 flex items-center justify-between ${sc.bg} ${sc.border}`}>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70 mb-1">
            Score operativo — {periodoLabel}
          </p>
          {kpis.score !== null ? (
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-bold ${sc.color}`}>{kpis.score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin viajes registrados este mes.</p>
          )}
        </div>
        <div className={`text-sm font-semibold px-3 py-1.5 rounded-md border ${sc.color} ${sc.bg} ${sc.border}`}>
          {sc.label}
        </div>
      </div>

      {/* KPIs del mes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Indicadores — {periodoLabel}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KPI label="Viajes" value={String(kpis.viajes_count)} color="text-primary" />
          <KPI
            label="Km totales"
            value={`${fmtNum(kpis.km_total)} km`}
            color="text-foreground"
          />
          <KPI
            label="Km vacíos"
            value={`${fmtNum(kpis.km_vacios)} km`}
            sub={kpis.km_total > 0 ? `${kpis.pct_vacios.toFixed(1)}%` : "—"}
            color={kpis.pct_vacios > 25 ? "text-[#EF4444]" : "text-foreground"}
          />
          <KPI label="Toneladas" value={fmtNum(kpis.toneladas)} color="text-foreground" />
          <KPI
            label="Liquidación al chofer"
            value={fmtMoneda(kpis.liquidacion_chofer_mes, "ARS")}
            sub="$ de la hoja de ruta"
            color="text-[#10B981]"
          />
          {kpis.facturacion_ars > 0 && (
            <KPI
              label="Facturación ARS"
              value={fmtMoneda(kpis.facturacion_ars, "ARS")}
              color="text-[#10B981]"
            />
          )}
          <KPI
            label="Adelantos ARS"
            value={fmtMoneda(kpis.adelantos_viaticos_ars, "ARS")}
            color="text-[#EF4444]"
          />
          {kpis.eficiencia_combustible !== null && (
            <KPI
              label="Eficiencia gasoil"
              value={`${kpis.eficiencia_combustible.toFixed(1)} L/100km`}
              sub={`${fmtNum(kpis.litros_mes)} L cargados`}
              color="text-foreground"
            />
          )}
          <KPI
            label="Veces al taller"
            value={String(kpis.taller_visitas_mes)}
            sub={kpis.taller_visitas_mes > 0 ? "reparación / gomería" : undefined}
            color={kpis.taller_visitas_mes > 0 ? "text-[#F59E0B]" : "text-foreground"}
          />
          <KPI
            label="Roturas de gomas"
            value={kpis.roturas_mes === 0 ? "0" : `${kpis.roturas_mes} event.`}
            sub={kpis.roturas_cantidad_mes > 0 ? `${kpis.roturas_cantidad_mes} gomas` : undefined}
            color={kpis.roturas_mes > 0 ? "text-[#F59E0B]" : "text-foreground"}
          />
          <KPI
            label="Apercibimientos"
            value={String(kpis.apercibimientos_mes)}
            sub={kpis.apercibimientos_graves_mes > 0 ? `${kpis.apercibimientos_graves_mes} graves` : undefined}
            color={kpis.apercibimientos_mes > 0 ? "text-[#EF4444]" : "text-foreground"}
          />
          <KPI
            label="Licencias médicas"
            value={kpis.licencias_activas > 0 ? "En curso" : kpis.licencias_dias_mes > 0 ? `${kpis.licencias_dias_mes} días` : "0"}
            sub={kpis.licencias_activas > 0 ? "activa" : undefined}
            color={kpis.licencias_activas > 0 ? "text-[#F59E0B]" : "text-foreground"}
          />
          <KPI
            label="Préstamos activos"
            value={String(kpis.prestamos_activos)}
            color={kpis.prestamos_activos > 0 ? "text-[#F59E0B]" : "text-foreground"}
          />
        </div>

        {(kpis.facturacion_usd > 0 || kpis.adelantos_viaticos_usd > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpis.facturacion_usd > 0 && (
              <KPI
                label="Facturación USD"
                value={fmtMoneda(kpis.facturacion_usd, "USD")}
                color="text-[#10B981]"
              />
            )}
            {kpis.adelantos_viaticos_usd > 0 && (
              <KPI
                label="Adelantos USD"
                value={fmtMoneda(kpis.adelantos_viaticos_usd, "USD")}
                color="text-[#EF4444]"
              />
            )}
          </div>
        )}

        {/* Eficiencia de combustible: placeholder solo si no hay datos suficientes este mes */}
        {kpis.eficiencia_combustible === null && (
          <div className="flex items-start gap-2 bg-muted/20 rounded-[8px] border border-dashed border-border px-4 py-3">
            <Lock size={12} className="text-muted-foreground/70 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Eficiencia combustible (L/100km)</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {kpis.cargas_combustible_count > 0
                  ? "Falta una segunda carga del mismo camión para calcular el consumo"
                  : "Disponible cuando se carguen consumos de gasoil del chofer"}
              </p>
            </div>
          </div>
        )}

        {/* % sueldo / facturación: pendiente del módulo de Sueldos (F4) */}
        <div className="flex items-start gap-2 bg-muted/20 rounded-[8px] border border-dashed border-border px-4 py-3">
          <Lock size={12} className="text-muted-foreground/70 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">% sueldo / facturación</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Disponible cuando se cargue el módulo de Sueldos</p>
          </div>
        </div>
      </section>

      {/* Gráfico evolución 6 meses */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity size={14} className="text-muted-foreground" />
          Evolución — últimos 6 meses
        </h3>

        {evolucion.every((m) => m.km_total === 0) ? (
          <div className="rounded-[8px] border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Sin datos de viajes en los últimos 6 meses.
          </div>
        ) : (
          <div className="rounded-[8px] border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground/70 mb-3 uppercase tracking-wide">KM recorridos por mes</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={evolucion} barSize={28} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => `${fmtNum(Number(value))} km`}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                />
                <Bar dataKey="km_total" radius={[3, 3, 0, 0]}>
                  {evolucion.map((entry) => (
                    <Cell
                      key={entry.mes}
                      fill={entry.mes === mesActual ? "#0088D1" : "hsl(var(--muted-foreground)/0.3)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              {evolucion.map((m) => (
                <div key={m.mes} className="text-center flex-1">
                  <p className={`text-[10px] font-medium ${m.mes === mesActual ? "text-primary" : "text-muted-foreground/70"}`}>
                    {m.viajes} viaje{m.viajes !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Apercibimientos graves del mes — alerta visual */}
      {kpis.apercibimientos_graves_mes > 0 && (
        <div className="flex items-start gap-3 rounded-[8px] border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3">
          <AlertTriangle size={14} className="text-[#EF4444] mt-0.5 shrink-0" />
          <p className="text-sm text-[#EF4444]">
            {kpis.apercibimientos_graves_mes === 1
              ? "1 apercibimiento grave este mes."
              : `${kpis.apercibimientos_graves_mes} apercibimientos graves este mes.`}
          </p>
        </div>
      )}

      {/* Cronología camiones */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Cronología de camiones
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {historial.length} {historial.length === 1 ? "asignación" : "asignaciones"}
          </span>
        </h3>

        {historial.length === 0 ? (
          <div className="rounded-[8px] border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Sin historial de camiones registrados.
          </div>
        ) : (
          <ul className="space-y-2">
            {historial.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-[8px] border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                  <Truck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {h.patente}
                    {h.marca && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                        {h.marca}{h.modelo && ` ${h.modelo}`}
                      </span>
                    )}
                  </p>
                  {h.motivo_cambio && (
                    <p className="text-xs text-muted-foreground truncate">{h.motivo_cambio}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Desde {fmtFecha(h.desde)}</p>
                  <p>
                    {h.hasta ? `Hasta ${fmtFecha(h.hasta)}` : (
                      <span className="text-[#10B981] font-medium">Asignación actual</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Adelantos del mes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Adelantos de viáticos — {periodoLabel}
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {adelantos.length} registro{adelantos.length !== 1 ? "s" : ""}
          </span>
        </h3>

        <div className="rounded-[8px] border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                {["Fecha", "Viaje", "Moneda", "Monto"].map((col) => (
                  <TableHead
                    key={col}
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adelantos.length === 0 ? (
                <EmptyTableRow message="Sin adelantos este mes" />
              ) : (
                adelantos.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/40">
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtFecha(a.fecha_entrega)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      {a.viaje_codigo ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.moneda}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-[#EF4444]">
                      {fmtMoneda(a.monto_adelanto, a.moneda)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card rounded-[8px] border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground/70 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
