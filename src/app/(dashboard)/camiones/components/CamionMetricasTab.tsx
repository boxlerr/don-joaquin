"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, Briefcase, Route, Package, DollarSign, Wrench, Fuel } from "lucide-react";
import { getCamionMetricasAction, type CamionMetricas } from "../actions";

interface Props {
  camionId: string;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

/**
 * Tab "Métricas" del detalle de camión: las métricas operativas clave de la
 * unidad para el mes en curso, análogo al tab Productividad del chofer.
 * Carga perezosa: solo pide datos cuando el tab se monta.
 */
export default function CamionMetricasTab({ camionId }: Props) {
  const [data, setData] = useState<CamionMetricas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    getCamionMetricasAction(camionId).then((res) => {
      if (!cancel) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [camionId]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Calculando métricas…</span>
      </div>
    );
  }

  const sinActividad = data.viajes_count === 0;
  const maxKm = Math.max(1, ...data.evolucion.map((m) => m.km));

  return (
    <div className="space-y-6 py-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Métricas — {data.periodo_label}
        </h3>
        <span className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">Mes en curso</span>
      </div>

      {sinActividad && (
        <div className="rounded-[8px] border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Esta unidad no registra viajes este mes.
        </div>
      )}

      {/* 5 métricas clave + gasoil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KPI icon={Briefcase} label="Viajes del mes" value={String(data.viajes_count)} color="text-primary" />
        <KPI
          icon={Route}
          label="Km recorridos"
          value={`${fmtNum(data.km_total)} km`}
          sub={data.km_total > 0 ? `${data.pct_vacios.toFixed(0)}% vacíos` : undefined}
          color={data.pct_vacios > 30 ? "text-[#EF4444]" : "text-foreground"}
        />
        <KPI
          icon={Package}
          label="Toneladas"
          value={fmtNum(data.toneladas)}
          sub={
            data.viajes_count > 0
              ? `${(data.toneladas / data.viajes_count).toFixed(1)} tn/viaje`
              : undefined
          }
          color="text-foreground"
        />
        <KPI
          icon={DollarSign}
          label="Facturación generada"
          value={fmtMoney(data.facturacion_ars)}
          sub={data.facturacion_por_km != null ? `${fmtMoney(data.facturacion_por_km)}/km c/carga` : undefined}
          color="text-[#10B981]"
        />
        <KPI
          icon={Wrench}
          label="Visitas a taller"
          value={String(data.taller_visitas)}
          sub={data.taller_visitas > 0 ? "reparación / gomería" : undefined}
          color={data.taller_visitas > 0 ? "text-[#F59E0B]" : "text-foreground"}
        />
        <KPI
          icon={Fuel}
          label="Gasoil del mes"
          value={data.litros_mes > 0 ? `${fmtNum(data.litros_mes)} L` : "0 L"}
          sub={data.cargas_combustible > 0 ? `${data.cargas_combustible} carga${data.cargas_combustible !== 1 ? "s" : ""}` : undefined}
          color="text-foreground"
        />
      </div>

      {/* Evolución 6 meses (km) */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Activity size={13} className="text-muted-foreground" />
          Km — últimos 6 meses
        </h4>
        <div className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex items-end gap-2 h-28">
            {data.evolucion.map((m) => {
              const h = Math.round((m.km / maxKm) * 100);
              const esActual = m.mes === data.mes_actual;
              return (
                <div key={m.mes} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                  <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                    {m.km > 0 ? fmtNum(m.km) : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-[3px] transition-all ${esActual ? "bg-primary" : "bg-muted-foreground/25"}`}
                    style={{ height: `${Math.max(h, m.km > 0 ? 6 : 2)}%` }}
                    title={`${m.label}: ${fmtNum(m.km)} km · ${m.viajes} viaje(s)`}
                  />
                  <span className={`text-[10px] font-medium capitalize ${esActual ? "text-primary" : "text-muted-foreground/70"}`}>
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card rounded-[8px] border border-border px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} className="text-muted-foreground/70" />
        <p className="text-xs text-muted-foreground/70">{label}</p>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}
