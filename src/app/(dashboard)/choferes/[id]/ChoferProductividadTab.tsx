import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Truck, Lock } from "lucide-react";
import type {
  ProductividadKPIs,
  CamionHistorialItem,
  AdelantoMes,
} from "./types";

interface Props {
  kpis: ProductividadKPIs;
  historial: CamionHistorialItem[];
  adelantos: AdelantoMes[];
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

export default function ChoferProductividadTab({ kpis, historial, adelantos }: Props) {
  const periodoLabel = nombreMes(kpis.periodo_desde);

  return (
    <div className="space-y-6">
      {/* Header con score (placeholder hasta definir cálculo) */}
      <div className="rounded-[8px] border border-border bg-muted/30 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70 mb-1">
            Score operativo — {periodoLabel}
          </p>
          <p className="text-sm text-foreground">
            Pendiente de definición.{" "}
            <span className="text-muted-foreground">
              El ranking configurable se incorporará cuando estén los inputs
              de gasoil, roturas de gomas y apercibimientos consolidados.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 border border-dashed border-border rounded-md px-3 py-1.5">
          <Lock size={12} />
          Módulo pendiente
        </div>
      </div>

      {/* KPIs del mes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Indicadores — {periodoLabel}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI
            label="Viajes"
            value={String(kpis.viajes_count)}
            color="text-primary"
          />
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
          <KPI
            label="Toneladas"
            value={fmtNum(kpis.toneladas)}
            color="text-foreground"
          />
          <KPI
            label="Facturación ARS"
            value={fmtMoneda(kpis.facturacion_ars, "ARS")}
            color="text-[#10B981]"
          />
          <KPI
            label="Adelantos ARS"
            value={fmtMoneda(kpis.adelantos_viaticos_ars, "ARS")}
            color="text-[#EF4444]"
          />
        </div>

        {(kpis.facturacion_usd > 0 || kpis.adelantos_viaticos_usd > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

        <PendientesGrid />
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
                        {h.marca}
                        {h.modelo && ` ${h.modelo}`}
                      </span>
                    )}
                  </p>
                  {h.motivo_cambio && (
                    <p className="text-xs text-muted-foreground truncate">
                      {h.motivo_cambio}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    Desde {fmtFecha(h.desde)}
                  </p>
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

function PendientesGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Pendiente
        label="Eficiencia combustible"
        hint="Espera módulo Gasoil"
      />
      <Pendiente
        label="Roturas de gomas"
        hint="Espera carga operativa"
      />
      <Pendiente
        label="Apercibimientos del mes"
        hint="Se integrará al score"
      />
    </div>
  );
}

function Pendiente({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="bg-muted/20 rounded-[8px] border border-dashed border-border px-4 py-3 flex items-start gap-2">
      <Lock size={12} className="text-muted-foreground/70 mt-1 shrink-0" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</p>
      </div>
    </div>
  );
}
