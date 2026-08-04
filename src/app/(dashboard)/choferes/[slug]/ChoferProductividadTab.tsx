"use client";

import { useState, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Truck, Lock, Activity, Settings, Trophy } from "lucide-react";
import { updatePesosScoreAction } from "./actions";
import type {
  ProductividadKPIs,
  CamionHistorialItem,
  AdelantoMes,
  EvolucionMes,
  RoturaDetalle,
  PesosScore,
} from "./types";

interface Props {
  kpis: ProductividadKPIs;
  historial: CamionHistorialItem[];
  adelantos: AdelantoMes[];
  evolucion: EvolucionMes[];
  roturas: RoturaDetalle[];
  pesos: PesosScore | null;
  is_admin: boolean;
  /** Puede ver montos de sueldo (liquidación/adelantos). Subsección confidencial. */
  can_ver_sueldos: boolean;
  onRefresh: () => void;
}

type ChartMetric = "km" | "toneladas" | "facturacion";

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

export default function ChoferProductividadTab({
  kpis,
  historial,
  adelantos,
  evolucion,
  roturas,
  pesos,
  is_admin,
  can_ver_sueldos,
  onRefresh,
}: Props) {
  const periodoLabel = nombreMes(kpis.periodo_desde);
  const sc = scoreConfig(kpis.score);
  const mesActual = kpis.periodo_desde.slice(0, 7);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("km");

  return (
    <div className="space-y-6">
      {/* Score operativo + ranking */}
      <div className={`rounded-[8px] border px-4 py-3.5 sm:px-5 sm:py-4 flex items-start justify-between gap-3 sm:gap-4 ${sc.bg} ${sc.border}`}>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70 mb-1">
            Score operativo — {periodoLabel}
          </p>
          {kpis.score !== null ? (
            <div className="flex items-baseline gap-3">
              <span className={`text-3xl sm:text-4xl font-bold ${sc.color}`}>{kpis.score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin viajes registrados este mes.</p>
          )}

          {/* Ranking */}
          {kpis.ranking_pos !== null && kpis.ranking_total > 1 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Trophy size={12} className="text-muted-foreground/70" />
              <span className="text-xs text-muted-foreground">
                Posición{" "}
                <span className="font-semibold text-foreground">
                  #{kpis.ranking_pos}
                </span>{" "}
                de {kpis.ranking_total} choferes activos este mes
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0 text-right">
          <div className={`text-xs sm:text-sm font-semibold px-2.5 py-1.5 sm:px-3 rounded-md border ${sc.color} ${sc.bg} ${sc.border}`}>
            {sc.label}
          </div>
          {is_admin && (
            <ConfigPesosDialog pesos={pesos} onSaved={onRefresh} />
          )}
        </div>
      </div>

      {/* KPIs del mes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Indicadores — {periodoLabel}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
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
            label="% utilización"
            value={kpis.utilizacion_pct !== null ? `${kpis.utilizacion_pct.toFixed(0)}%` : "—"}
            sub={kpis.utilizacion_pct !== null ? "tn cargadas / capacidad" : "sin capacidad de camión"}
            color={
              kpis.utilizacion_pct === null
                ? "text-muted-foreground"
                : kpis.utilizacion_pct >= 90
                  ? "text-[#10B981]"
                  : kpis.utilizacion_pct >= 75
                    ? "text-[#F59E0B]"
                    : "text-[#EF4444]"
            }
          />
          {can_ver_sueldos && (
            <KPI
              label="Liquidación al chofer"
              value={fmtMoneda(kpis.liquidacion_chofer_mes, "ARS")}
              sub="$ de hoja de ruta"
              color="text-[#10B981]"
            />
          )}
          {kpis.facturacion_ars > 0 && (
            <KPI
              label="Facturación ARS"
              value={fmtMoneda(kpis.facturacion_ars, "ARS")}
              color="text-[#10B981]"
            />
          )}
          {kpis.facturacion_por_km !== null && (
            <KPI
              label="$ por km cargado"
              value={fmtMoneda(kpis.facturacion_por_km, "ARS")}
              sub="facturación / km c/carga"
              color="text-[#10B981]"
            />
          )}
          {can_ver_sueldos && (
            <KPI
              label="Adelantos ARS"
              value={fmtMoneda(kpis.adelantos_viaticos_ars, "ARS")}
              color="text-[#EF4444]"
            />
          )}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {kpis.facturacion_usd > 0 && (
              <KPI
                label="Facturación USD"
                value={fmtMoneda(kpis.facturacion_usd, "USD")}
                color="text-[#10B981]"
              />
            )}
            {can_ver_sueldos && kpis.adelantos_viaticos_usd > 0 && (
              <KPI
                label="Adelantos USD"
                value={fmtMoneda(kpis.adelantos_viaticos_usd, "USD")}
                color="text-[#EF4444]"
              />
            )}
          </div>
        )}

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity size={14} className="text-muted-foreground" />
            Evolución — últimos 6 meses
          </h3>
          <div className="flex flex-wrap items-center gap-1">
            {(["km", "toneladas", "facturacion"] as ChartMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`min-h-9 md:min-h-0 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  chartMetric === m
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {m === "km" ? "KM" : m === "toneladas" ? "Toneladas" : "Facturación"}
              </button>
            ))}
          </div>
        </div>

        {evolucion.every((m) => {
          if (chartMetric === "km") return m.km_total === 0;
          if (chartMetric === "toneladas") return m.toneladas === 0;
          return m.facturacion_ars === 0;
        }) ? (
          <div className="rounded-[8px] border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Sin datos en los últimos 6 meses.
          </div>
        ) : (
          <div className="rounded-[8px] border border-border bg-card p-3 sm:p-4">
            <p className="text-[11px] text-muted-foreground/70 mb-3 uppercase tracking-wide">
              {chartMetric === "km" ? "KM recorridos por mes" : chartMetric === "toneladas" ? "Toneladas transportadas por mes" : "Facturación ARS por mes"}
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart
                data={evolucion}
                barSize={28}
                margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => {
                    if (chartMetric === "facturacion") {
                      return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
                    }
                    return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => {
                    const n = Number(value);
                    const label = chartMetric === "km" ? "Km" : chartMetric === "toneladas" ? "Toneladas" : "Facturación";
                    const formatted =
                      chartMetric === "facturacion"
                        ? `$ ${fmtNum(n)}`
                        : chartMetric === "toneladas"
                          ? `${fmtNum(n)} tn`
                          : `${fmtNum(n)} km`;
                    return [formatted, label];
                  }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 4 }}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Bar
                  dataKey={chartMetric === "km" ? "km_total" : chartMetric === "toneladas" ? "toneladas" : "facturacion_ars"}
                  radius={[3, 3, 0, 0]}
                >
                  {evolucion.map((entry) => (
                    <Cell
                      key={entry.mes}
                      fill={entry.mes === mesActual ? "#0088D1" : "var(--muted-foreground)"}
                      fillOpacity={entry.mes === mesActual ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Los rótulos de viajes se alinean con las barras: en celular el
                gap grande los desbordaba y quedaban corridos del gráfico. */}
            <div className="flex items-center gap-1 sm:gap-4 mt-3 pt-3 border-t border-border">
              {evolucion.map((m) => (
                <div key={m.mes} className="min-w-0 flex-1 text-center">
                  <p className={`text-[10px] font-medium ${m.mes === mesActual ? "text-primary" : "text-muted-foreground/70"}`}>
                    {m.viajes} viaje{m.viajes !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
                className="flex items-center gap-3 rounded-[8px] border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3"
              >
                <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
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
                <div className="shrink-0 text-right text-xs text-muted-foreground">
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

      {/* Adelantos del mes — datos de sueldo, solo con la subsección confidencial */}
      {can_ver_sueldos && (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Adelantos de viáticos — {periodoLabel}
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {adelantos.length} registro{adelantos.length !== 1 ? "s" : ""}
          </span>
        </h3>

        {/* Tabla de consulta: scrollea adentro de su caja (la primitiva Table ya
            trae overflow-x-auto) y la fecha queda fija como referencia. */}
        <div className="rounded-[8px] border border-border overflow-hidden">
          <Table className="min-w-[420px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                {["Fecha", "Viaje", "Moneda", "Monto"].map((col, i) => (
                  <TableHead
                    key={col}
                    className={`text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                      i === 0 ? "sticky left-0 z-10 bg-muted" : ""
                    }`}
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
                    <TableCell className="sticky left-0 z-10 bg-card text-sm text-muted-foreground">
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
      )}

      {/* Roturas de gomas */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Roturas de gomas
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {roturas.length} registro{roturas.length !== 1 ? "s" : ""}
          </span>
        </h3>

        <div className="rounded-[8px] border border-border overflow-hidden">
          <Table className="min-w-[600px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                {["Fecha", "Unidad", "Posición / notas", "Cantidad", "Costo"].map((col, i) => (
                  <TableHead
                    key={col}
                    className={`text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                      i === 0 ? "sticky left-0 z-10 bg-muted" : ""
                    }`}
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roturas.length === 0 ? (
                <EmptyTableRow message="Sin roturas registradas" />
              ) : (
                roturas.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="sticky left-0 z-10 bg-card text-sm text-muted-foreground">{fmtFecha(r.fecha)}</TableCell>
                    <TableCell className="text-sm">
                      {r.unidad_patente ? (
                        <span className="inline-flex items-baseline gap-1.5">
                          {r.unidad_tipo && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                              {r.unidad_tipo === "camion" ? "Cam" : "Acop"}
                            </span>
                          )}
                          <span className="font-mono text-foreground">{r.unidad_patente}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.posicion ?? r.observaciones ?? "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-[#F59E0B]">{r.cantidad}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.costo != null ? fmtMoneda(Number(r.costo), r.moneda) : "—"}
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

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

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
    <div className="bg-card rounded-[8px] border border-border px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-xs text-muted-foreground/70 mb-1">{label}</p>
      {/* Los importes se van de la tarjeta en celular: bajan un escalón y, si
          aun así no entran, cortan en vez de empujar la grilla. */}
      <p className={`text-base sm:text-lg font-bold break-words tabular-nums ${color}`}>{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog configuración de pesos (solo admin)
// ---------------------------------------------------------------------------

const DEFAULT_PESOS: Omit<PesosScore, "id"> = {
  peso_vacios_bajo: 8,
  peso_vacios_medio: 15,
  peso_vacios_alto: 20,
  umbral_vacios_bajo: 20,
  umbral_vacios_medio: 30,
  umbral_vacios_alto: 40,
  peso_apercibimiento: 8,
  peso_rotura: 5,
  peso_licencia: 10,
};

function ConfigPesosDialog({
  pesos,
  onSaved,
}: {
  pesos: PesosScore | null;
  onSaved: () => void;
}) {
  const initial = pesos ?? DEFAULT_PESOS;
  const [form, setForm] = useState({ ...initial });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen(val: boolean) {
    if (val) setForm({ ...(pesos ?? DEFAULT_PESOS) });
    setError(null);
    setOpen(val);
  }

  function handleChange(field: keyof typeof form, raw: string) {
    const n = parseFloat(raw);
    setForm((prev) => ({ ...prev, [field]: Number.isFinite(n) ? n : 0 }));
  }

  function handleSave() {
    startTransition(async () => {
      setError(null);
      const res = await updatePesosScoreAction(form);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      onSaved();
    });
  }

  const triggerBtn = (
    <button className="flex min-h-9 items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors md:min-h-0">
      <Settings size={11} />
      Configurar pesos
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={triggerBtn} />
      {/* El max-w va con prefijo: sin él pisa el ancho seguro de la primitiva
          y el diálogo se corta en celular. */}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Pesos del score operativo</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1 mb-1">
          Cada penalidad descuenta puntos del score de 100. Configuración global — aplica a todos los choferes.
        </p>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Km vacíos (umbrales y penalidades)
            </legend>
            <PesoRow
              label={`Penalidad si vacíos > ${form.umbral_vacios_bajo}%`}
              field="peso_vacios_bajo"
              value={form.peso_vacios_bajo}
              onChange={handleChange}
            />
            <PesoRow
              label={`Penalidad si vacíos > ${form.umbral_vacios_medio}%`}
              field="peso_vacios_medio"
              value={form.peso_vacios_medio}
              onChange={handleChange}
            />
            <PesoRow
              label={`Penalidad si vacíos > ${form.umbral_vacios_alto}%`}
              field="peso_vacios_alto"
              value={form.peso_vacios_alto}
              onChange={handleChange}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {([
                ["umbral_vacios_bajo", "Umbral bajo (%)"],
                ["umbral_vacios_medio", "Umbral medio (%)"],
                ["umbral_vacios_alto", "Umbral alto (%)"],
              ] as [keyof typeof form, string][]).map(([field, label]) => (
                <div key={field}>
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">{label}</p>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-full min-w-0 text-sm border border-border rounded-[8px] px-2 py-2 sm:py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Otras penalidades
            </legend>
            <PesoRow
              label="Por apercibimiento (c/u)"
              field="peso_apercibimiento"
              value={form.peso_apercibimiento}
              onChange={handleChange}
            />
            <PesoRow
              label="Por evento de rotura (c/u)"
              field="peso_rotura"
              value={form.peso_rotura}
              onChange={handleChange}
            />
            <PesoRow
              label="Por licencia médica activa"
              field="peso_licencia"
              value={form.peso_licencia}
              onChange={handleChange}
            />
          </fieldset>
        </div>

        {error && (
          <p className="text-xs text-[#EF4444]">{error}</p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" className="w-full sm:w-auto" onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PesoRow({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: string;
  value: number;
  onChange: (field: keyof Omit<PesosScore, "id">, raw: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground flex-1">{label}</p>
      <input
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={(e) => onChange(field as keyof Omit<PesosScore, "id">, e.target.value)}
        className="w-20 sm:w-16 shrink-0 text-sm text-right border border-border rounded-[8px] px-2 py-2 sm:py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
