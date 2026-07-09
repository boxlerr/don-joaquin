"use client";

// Dashboard de métricas históricas — réplica viva del dashboard HTML que usan
// hoy (video de Bárbara 08/07): KPIs grandes, pestañas por métrica y barras
// por chofer, más lo que pidió por audio: comparación contra el MES ANTERIOR
// y contra el MISMO MES DEL AÑO ANTERIOR, y los aumentos de tarifa de
// clientes como contexto de la facturación.

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Truck, Route, Gauge, Weight,
  Wallet, Trash2, Plus, ArrowUpRight,
} from "lucide-react";
import CargarAumentoDialog from "./CargarAumentoDialog";
import { eliminarAumentoClienteAction, type MetricasData, type Flota } from "./actions";
import { useRouter } from "next/navigation";

const money = (n: number | null | undefined, dec = 0) =>
  n == null ? "—" : "$" + n.toLocaleString("es-AR", { maximumFractionDigits: dec });
const numAr = (n: number | null | undefined, dec = 0) =>
  n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: dec });
const pct = (n: number | null | undefined, dec = 1) =>
  n == null ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: dec })}%`;
const compactMoney = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toLocaleString("es-AR", { maximumFractionDigits: 2 })} MM` :
  n >= 1e6 ? `$${(n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 0 })} M` : money(n);

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};
const mesCorto = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1].slice(0, 3)} ${y.slice(2)}`;
};

// Delta % entre dos valores (null-safe).
const delta = (actual: number | null | undefined, previo: number | null | undefined): number | null =>
  actual == null || previo == null || previo === 0 ? null : (actual / previo - 1) * 100;

/** Badge de variación: verde si mejora, rojo si empeora (según si subir es bueno). */
function DeltaBadge({ valor, subirEsBueno, etiqueta, puntos }: {
  valor: number | null;
  subirEsBueno: boolean;
  etiqueta: string;
  /** true → la variación se muestra en puntos porcentuales (pp), no en %. */
  puntos?: boolean;
}) {
  if (valor == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60" title={`Sin datos de ${etiqueta}`}>
        <Minus size={10} /> {etiqueta}: s/d
      </span>
    );
  }
  const mejora = subirEsBueno ? valor >= 0 : valor <= 0;
  const Icon = valor >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        mejora ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
      title={`vs ${etiqueta}`}
    >
      <Icon size={10} />
      {valor >= 0 ? "+" : ""}
      {valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
      {puntos ? " pp" : "%"} {etiqueta}
    </span>
  );
}

type TabId = "resumen" | "factkm" | "vacios" | "km100" | "toneladas" | "sueldo";
const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "factkm", label: "Facturación por km" },
  { id: "vacios", label: "KM vacíos" },
  { id: "km100", label: "KM al 100%" },
  { id: "toneladas", label: "Toneladas" },
  { id: "sueldo", label: "Sueldo s/ facturación" },
];

export default function MetricasClient({ data }: { data: MetricasData }) {
  const [tab, setTab] = useState<TabId>("resumen");
  const [flota, setFlota] = useState<Flota>("escalables");
  const [aumentoOpen, setAumentoOpen] = useState(false);
  const router = useRouter();

  const t = data.totales.general;
  const tPrev = data.mesAnterior?.general ?? null;
  const tYoY = data.anioAnterior?.general ?? null;

  const choferesFlota = useMemo(
    () => data.choferes.filter((c) => c.flota === flota),
    [data.choferes, flota],
  );

  // Datos de la pestaña activa (barras por chofer).
  const serieChofer = useMemo(() => {
    const base = choferesFlota.map((c) => ({
      nombre: c.nombre,
      parcial: c.ingresoParcial,
      factkm: c.km > 0 ? c.facturacion / c.km : 0,
      vacios: c.km > 0 ? (c.kmVacios / c.km) * 100 : 0,
      km100: c.km > 0 ? (c.km100 / c.km) * 100 : 0,
      toneladas: c.toneladas,
      sueldo: c.facturacion > 0 ? (c.sueldoTotal / c.facturacion) * 100 : 0,
    }));
    const key = tab === "resumen" ? "factkm" : tab;
    // En % de vacíos y sueldo, menos es mejor → orden ascendente = mejores arriba.
    const asc = tab === "vacios" || tab === "sueldo";
    return base
      .map((b) => ({ ...b, valor: b[key as keyof typeof b] as number }))
      .sort((a, b2) => (asc ? a.valor - b2.valor : b2.valor - a.valor));
  }, [choferesFlota, tab]);

  if (!t) {
    return (
      <EmptyState
        icon={BarChart3}
        message="Todavía no hay planillas cargadas. Se importan con scripts/parse-planillas-metricas.ts desde los PDFs del Drive de Bárbara."
      />
    );
  }

  const kpis: {
    label: string; icon: React.ElementType; valor: string; sub?: string;
    dPrev: number | null; dYoY: number | null; subirEsBueno: boolean; puntos?: boolean;
  }[] = [
    {
      label: "Facturación total", icon: TrendingUp, valor: compactMoney(t.facturacion),
      sub: `${t.camiones} camiones`, subirEsBueno: true,
      dPrev: delta(t.facturacion, tPrev?.facturacion), dYoY: delta(t.facturacion, tYoY?.facturacion),
    },
    {
      label: "KM totales", icon: Route, valor: `${numAr(t.km)} km`,
      sub: `prom. ${numAr(t.km / t.camiones)} por camión`, subirEsBueno: true,
      dPrev: delta(t.km, tPrev?.km), dYoY: delta(t.km, tYoY?.km),
    },
    {
      label: "Facturación por km", icon: Gauge, valor: money(t.factPorKm, 2),
      sub: data.serieCosto.at(-1)?.costoKm ? `costo estudio ${money(data.serieCosto.at(-1)!.costoKm, 2)}` : undefined,
      subirEsBueno: true,
      dPrev: delta(t.factPorKm, tPrev?.factPorKm ?? data.serieCosto.at(-2)?.factKm),
      dYoY: delta(t.factPorKm, tYoY?.factPorKm),
    },
    {
      label: "% KM vacíos", icon: Truck, valor: pct(t.pctVacios), subirEsBueno: false, puntos: true,
      dPrev: t.pctVacios != null && tPrev?.pctVacios != null ? t.pctVacios - tPrev.pctVacios : null,
      dYoY: t.pctVacios != null && tYoY?.pctVacios != null ? t.pctVacios - tYoY.pctVacios : null,
    },
    {
      label: "% KM al 100%", icon: Gauge, valor: pct(t.pctKm100), subirEsBueno: true, puntos: true,
      dPrev: t.pctKm100 != null && tPrev?.pctKm100 != null ? t.pctKm100 - tPrev.pctKm100 : null,
      dYoY: t.pctKm100 != null && tYoY?.pctKm100 != null ? t.pctKm100 - tYoY.pctKm100 : null,
    },
    {
      label: "% Sueldo / facturación", icon: Wallet, valor: pct(t.pctSueldoFact), subirEsBueno: false, puntos: true,
      dPrev: t.pctSueldoFact != null && tPrev?.pctSueldoFact != null ? t.pctSueldoFact - tPrev.pctSueldoFact : null,
      dYoY: t.pctSueldoFact != null && tYoY?.pctSueldoFact != null ? t.pctSueldoFact - tYoY.pctSueldoFact : null,
    },
    {
      label: "Toneladas promedio", icon: Weight, valor: numAr(t.toneladasProm, 2), subirEsBueno: true,
      dPrev: delta(t.toneladasProm, tPrev?.toneladasProm), dYoY: delta(t.toneladasProm, tYoY?.toneladasProm),
    },
  ];

  const unidadTab: Record<Exclude<TabId, "resumen">, { fmt: (n: number) => string; title: string }> = {
    factkm: { fmt: (n) => money(n, 0), title: "$ / km por chofer" },
    vacios: { fmt: (n) => pct(n), title: "% de km vacíos por chofer (mejor arriba)" },
    km100: { fmt: (n) => pct(n), title: "% de km al 100% por chofer" },
    toneladas: { fmt: (n) => numAr(n, 2), title: "Toneladas promedio por chofer" },
    sueldo: { fmt: (n) => pct(n), title: "% sueldo / facturación por chofer (mejor arriba)" },
  };

  const handleEliminarAumento = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el aumento de ${nombre}?`)) return;
    const res = await eliminarAumentoClienteAction(id);
    if ("error" in res) alert(res.error);
    else router.refresh();
  };

  const barKey = tab === "resumen" ? null : tab;

  return (
    <div className="space-y-5">
      {/* Aviso de cobertura de datos */}
      {(!data.mesAnterior || !data.anioAnterior) && (
        <p className="text-xs text-muted-foreground">
          {`Comparaciones disponibles cuando se carguen las planillas de ${[
            !data.mesAnterior ? mesLabel(addM(data.mes, -1)) : null,
            !data.anioAnterior ? mesLabel(addM(data.mes, -12)) : null,
          ].filter(Boolean).join(" y ")} (Drive de Bárbara → script de importación).`}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon size={13} /> {k.label}
              </div>
              <p className="mt-1 text-2xl font-bold font-mono text-foreground leading-tight">{k.valor}</p>
              {k.sub && <p className="text-[11px] text-muted-foreground/70">{k.sub}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <DeltaBadge valor={k.dPrev} subirEsBueno={k.subirEsBueno} etiqueta="mes ant." puntos={k.puntos} />
                <DeltaBadge valor={k.dYoY} subirEsBueno={k.subirEsBueno} etiqueta="interanual" puntos={k.puntos} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs + selector de flota */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg flex-wrap">
          {TABS.map((tb) => (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              className={`px-3 h-8 text-xs font-medium rounded-md transition-all ${tab === tb.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {tb.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          {(["escalables", "tolvas"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFlota(f)}
              className={`px-3 h-8 text-xs font-medium rounded-md capitalize transition-all ${flota === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f} ({data.choferes.filter((c) => c.flota === f).length})
            </button>
          ))}
        </div>
      </div>

      {tab === "resumen" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Facturación vs costo por km (planilla COSTO VS KM) */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">Facturación vs costo por km (estudio)</h3>
            {data.serieCosto.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.serieCosto.map((r) => ({ ...r, label: mesCorto(r.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${numAr(v)}`} width={70} />
                  <Tooltip formatter={(v) => money(Number(v), 2)} />
                  <Legend />
                  <Line type="monotone" dataKey="factKm" name="Facturación $/km" stroke="#0088D1" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="costoKm" name="Costo estudio $/km" stroke="#EF4444" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Sin serie de costo cargada.</p>
            )}
            {data.serieCosto.length > 0 && data.serieCosto.at(-1)!.costoKm != null && t.factPorKm != null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t.factPorKm >= (data.serieCosto.at(-1)!.costoKm ?? 0)
                  ? "La facturación por km cubre el costo del estudio."
                  : `⚠️ El costo por km del estudio (${money(data.serieCosto.at(-1)!.costoKm, 2)}) está por encima de la facturación por km (${money(t.factPorKm, 2)}).`}
              </p>
            )}
          </div>

          {/* Aumentos de tarifa de clientes */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Aumentos de tarifa de clientes</h3>
              {data.canWrite && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAumentoOpen(true)}>
                  <Plus size={13} /> Cargar aumento
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Para leer bien una suba de facturación: ¿fue producción propia o aumento de tarifa?
              Se muestran los aumentos de los últimos 12 meses.
            </p>
            {data.aumentos.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.aumentos.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                    <ArrowUpRight size={14} className="shrink-0 text-amber-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        <span className="font-medium">{a.clienteNombre}</span>{" "}
                        <span className="font-mono text-amber-600 dark:text-amber-400">+{numAr(a.porcentaje, 2)}%</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        desde el {a.vigenteDesde.split("-").reverse().join("/")}
                        {a.observaciones ? ` · ${a.observaciones}` : ""}
                      </p>
                    </div>
                    {data.canWrite && (
                      <button type="button" onClick={() => handleEliminarAumento(a.id, a.clienteNombre)}
                        className="text-muted-foreground/60 hover:text-red-500 transition-colors" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">Sin aumentos registrados en el período.</p>
            )}
          </div>

          {/* Comparativa por flota */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-2 overflow-x-auto">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por flota — {mesLabel(data.mes)}</h3>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Flota</th>
                  <th className="py-2 pr-4 font-medium text-right">Camiones</th>
                  <th className="py-2 pr-4 font-medium text-right">KM</th>
                  <th className="py-2 pr-4 font-medium text-right">Facturación</th>
                  <th className="py-2 pr-4 font-medium text-right">$/km</th>
                  <th className="py-2 pr-4 font-medium text-right">% vacíos</th>
                  <th className="py-2 pr-4 font-medium text-right">% al 100%</th>
                  <th className="py-2 font-medium text-right">% sueldo/fact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(["escalables", "tolvas"] as const).map((f) => {
                  const tf = data.totales[f];
                  if (!tf) return null;
                  return (
                    <tr key={f}>
                      <td className="py-2 pr-4 capitalize text-foreground">{f}</td>
                      <td className="py-2 pr-4 text-right font-mono">{tf.camiones}</td>
                      <td className="py-2 pr-4 text-right font-mono">{numAr(tf.km)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{compactMoney(tf.facturacion)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{money(tf.factPorKm, 2)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{pct(tf.pctVacios)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{pct(tf.pctKm100)}</td>
                      <td className="py-2 text-right font-mono">{pct(tf.pctSueldoFact)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Barras por chofer de la métrica activa
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {unidadTab[barKey as Exclude<TabId, "resumen">].title}
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3 capitalize">
            {flota} · {mesLabel(data.mes)} · las filas con ◐ entraron/salieron a mitad de mes
          </p>
          <ResponsiveContainer width="100%" height={Math.max(240, serieChofer.length * 22)}>
            <BarChart data={serieChofer} layout="vertical" margin={{ left: 40, right: 50 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nombre" width={140}
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => {
                  const c = serieChofer.find((s) => s.nombre === v);
                  return c?.parcial ? `◐ ${v}` : v;
                }} />
              <Tooltip formatter={(v) => unidadTab[barKey as Exclude<TabId, "resumen">].fmt(Number(v))} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 9, formatter: (v: unknown) => unidadTab[barKey as Exclude<TabId, "resumen">].fmt(Number(v)) }}>
                {serieChofer.map((c, i) => (
                  <Cell key={c.nombre}
                    fill={`hsl(${Math.round(120 - (i / Math.max(serieChofer.length - 1, 1)) * 120)}, 70%, 45%)`}
                    opacity={c.parcial ? 0.45 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.canWrite && (
        <CargarAumentoDialog open={aumentoOpen} onOpenChange={setAumentoOpen} onDone={() => router.refresh()} />
      )}
    </div>
  );
}

// Suma meses a un ISO YYYY-MM-01 (helper local del client).
function addM(mesISO: string, d: number): string {
  const [y, m] = mesISO.split("-").map((n) => parseInt(n, 10));
  const total = y * 12 + (m - 1) + d;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}
