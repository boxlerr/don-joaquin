"use client";

// Dashboard de métricas históricas — rediseño 11/07. Las 6 planillas de
// gestión con: KPIs clickeables con tendencia, cobertura de datos explícita,
// cada métrica en formato tabla (estilo Excel, con totales) / gráfico /
// evolución, drawer de detalle por chofer, planilla anual (Evolución),
// export de todo junto en un click y modo EN VIVO para meses sin planillas.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { coincideBusqueda } from "@/lib/texto";
import {
  BarChart3, Search, Table2, ChartBarBig, ChartLine, ExternalLink,
} from "lucide-react";
import type { MetricasData, MetricaChofer, Flota, TotalesMes } from "./actions";
import { METRICAS, KPIS, type MetricaId, metricaPorId } from "./components/metricas-def";
import { money, numAr, mesLabel, mesCorto, delta, deltaPP } from "./components/format";
import KpiCard from "./components/KpiCard";
import CoberturaBanner from "./components/CoberturaBanner";
import ProcedenciaPanel from "./components/ProcedenciaPanel";
import { estadoDeKpis } from "./components/metricas-origen";
import MetricaTable from "./components/MetricaTable";
import MetricaChart from "./components/MetricaChart";
import EvolucionChart from "./components/EvolucionChart";
import EvolucionTab from "./components/EvolucionTab";
import ResumenTab from "./components/ResumenTab";
import ChoferDrawer from "./components/ChoferDrawer";
import LiveBanner from "./components/LiveBanner";
import CompararSelector from "./components/CompararSelector";

type TabId = "resumen" | MetricaId | "evolucion";
type FlotaSel = "todas" | Flota;
type Vista = "tabla" | "grafico" | "evolucion";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  ...METRICAS.map((m) => ({ id: m.id as TabId, label: m.tab })),
  { id: "evolucion", label: "Evolución" },
];

export default function MetricasClient({ data }: { data: MetricasData }) {
  const searchParams = useSearchParams();
  const [tab, setTabRaw] = useState<TabId>(() => {
    const t = searchParams.get("tab");
    return t && TABS.some((x) => x.id === t) ? (t as TabId) : "resumen";
  });
  const [flota, setFlota] = useState<FlotaSel>("todas");
  const [vista, setVista] = useState<Vista>("tabla");
  const [busqueda, setBusqueda] = useState("");
  const [choferSel, setChoferSel] = useState<MetricaChofer | null>(null);

  // La pestaña queda en la URL (compartible / sobrevive un refresh).
  const setTab = (t: TabId) => {
    setTabRaw(t);
    const params = new URLSearchParams(window.location.search);
    if (t === "resumen") params.delete("tab");
    else params.set("tab", t);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const t = data.totales.general;
  const tPrev = data.mesAnterior?.general ?? null;
  const tYoY = data.anioAnterior?.general ?? null;
  const esMesActual = data.mes === data.hoyMes;

  const nEscalables = useMemo(() => data.choferes.filter((c) => c.flota === "escalables").length, [data.choferes]);
  const nTolvas = useMemo(() => data.choferes.filter((c) => c.flota === "tolvas").length, [data.choferes]);

  const choferesFiltrados = useMemo(() => {
    let rows = data.choferes;
    if (flota !== "todas") rows = rows.filter((c) => c.flota === flota);
    // La búsqueda por nombre ignora acentos ("agustin" encuentra "Agustín").
    if (busqueda.trim()) rows = rows.filter((c) => coincideBusqueda(c.nombre, busqueda));
    return rows;
  }, [data.choferes, flota, busqueda]);

  // Procedencia + estado de cada KPI (de qué sección sale y qué le falta).
  const origenPorKpi = useMemo(() => estadoDeKpis(data), [data]);

  // Serie del sparkline por KPI (13 meses, general).
  const sparkPorKpi = useMemo(() => {
    const out: Record<string, (number | null)[]> = {};
    for (const k of KPIS) {
      out[k.id] = data.serieHistorica.map((s) => k.valor(s.general));
    }
    return out;
  }, [data.serieHistorica]);

  const tCmp = data.comparacion?.totales.general ?? null;
  const kpiDeltas = (k: (typeof KPIS)[number]) => {
    const actual = k.valor(t);
    const prev = k.valor(tPrev);
    const yoy = k.valor(tYoY);
    const cmp = k.valor(tCmp);
    return k.enPuntos
      ? { dPrev: deltaPP(actual, prev), dYoY: deltaPP(actual, yoy), dCmp: deltaPP(actual, cmp) }
      : { dPrev: delta(actual, prev), dYoY: delta(actual, yoy), dCmp: delta(actual, cmp) };
  };

  const kpiSub = (id: string): string | undefined => {
    if (!t) return undefined;
    if (id === "facturacion") return `${t.camiones} camiones`;
    if (id === "km" && t.camiones > 0) return `prom. ${numAr(t.km / t.camiones)} por camión`;
    if (id === "factkm") {
      // Antes acá colgaba "costo estudio $X". Ese costo es SOLO de escalables
      // (la planilla COSTO VS KM se arma sobre esa flota) y el número grande
      // mezcla las dos, así que invitaba a una comparación que no cerraba.
      // La comparación contra el costo vive en Resumen, donde está explicada.
      const e = data.totales.escalables?.factPorKm;
      const to = data.totales.tolvas?.factPorKm;
      const partes = [
        e != null ? `escalables ${money(e, 0)}` : null,
        to != null ? `tolvas ${money(to, 0)}` : null,
      ].filter(Boolean);
      return partes.length ? partes.join(" · ") : undefined;
    }
    return undefined;
  };

  // ── Mes sin planillas ni viajes ────────────────────────────────────────
  if (!data.choferes.length) {
    return (
      <EmptyState
        icon={BarChart3}
        message={`${mesLabel(data.mes)} no tiene planillas cargadas ni viajes en el sistema. Elegí otro mes con el selector (los meses con datos tienen punto azul) o importá las planillas del Drive con scripts/cargar-metricas-drive.ts.`}
      />
    );
  }

  const defActiva = tab !== "resumen" && tab !== "evolucion" ? metricaPorId(tab) : null;
  const totalesFlotaDrawer: TotalesMes | null = choferSel ? data.totales[choferSel.flota] : null;
  // Métricas que el modo en vivo no puede calcular (no salen de los viajes).
  const noDisponibleLive = data.esLive && defActiva && (defActiva.id === "sueldo" || defActiva.id === "km100");
  const comparacionTabla = data.comparacion && defActiva
    ? { etiqueta: mesCorto(data.comparacion.mes), choferes: data.comparacion.choferes }
    : null;

  return (
    <div className="space-y-5">
      {data.esLive && <LiveBanner mes={data.mes} esMesActual={esMesActual} info={data.liveInfo} />}
      <CoberturaBanner data={data} />

      {/* KPIs con tendencia */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {KPIS.map((k) => {
          const { dPrev, dYoY, dCmp } = kpiDeltas(k);
          return (
            <KpiCard
              key={k.id}
              def={k}
              valor={k.fmt(k.valor(t))}
              sub={kpiSub(k.id)}
              dPrev={dPrev}
              dYoY={dYoY}
              dCmp={dCmp}
              etiquetaCmp={data.comparacion ? mesCorto(data.comparacion.mes) : undefined}
              serie={sparkPorKpi[k.id]}
              origen={origenPorKpi[k.id]}
              onClick={k.metrica ? () => setTab(k.metrica!) : undefined}
              activa={k.metrica === tab && k.id !== "km"}
            />
          );
        })}
      </div>

      <ProcedenciaPanel data={data} />

      {/* Pestañas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`h-8 rounded-md px-3 text-xs font-medium transition-all ${
                tab === tb.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <CompararSelector
          compare={data.comparacion ? data.comparacion.mes.slice(0, 7) : null}
          mesActual={data.mes}
          mesesDisponibles={data.mesesDisponibles}
          hoyMes={data.hoyMes}
        />
      </div>

      {/* Toolbar de filtros (métricas y evolución) */}
      {tab !== "resumen" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {([
              { id: "todas", label: `Todas (${data.choferes.length})` },
              { id: "escalables", label: `Escalables (${nEscalables})` },
              { id: "tolvas", label: `Tolvas (${nTolvas})` },
            ] as { id: FlotaSel; label: string }[]).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFlota(f.id)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-all ${
                  flota === f.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {defActiva && (
            <>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar chofer…"
                  className="h-8 w-44 pl-8 text-xs"
                />
              </div>
              <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-1">
                {([
                  { id: "tabla", label: "Tabla", icon: Table2 },
                  { id: "grafico", label: "Gráfico", icon: ChartBarBig },
                  { id: "evolucion", label: "Evolución", icon: ChartLine },
                ] as { id: Vista; label: string; icon: React.ElementType }[]).map((v) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVista(v.id)}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all ${
                        vista === v.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={13} /> {v.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Contenido */}
      {tab === "resumen" && <ResumenTab data={data} onChofer={setChoferSel} esLive={data.esLive} />}

      {tab === "evolucion" && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">
            Planilla anual — {flota === "todas" ? "general" : flota}
          </h3>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Los últimos 13 meses como en el Excel anual: una fila por mes, todas las métricas juntas.
          </p>
          <EvolucionTab
            serie={data.serieHistorica}
            mesActivo={data.mes}
            flota={flota === "todas" ? "general" : flota}
            hoyMes={data.hoyMes}
          />
        </div>
      )}

      {defActiva && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{defActiva.titulo}</h3>
              <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">{defActiva.descripcion}</p>
            </div>
            <Link
              href={defActiva.fuente.href}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              title="Ir a la sección viva de la que sale este dato"
            >
              <ExternalLink size={11} /> {defActiva.fuente.label}
            </Link>
          </div>

          {noDisponibleLive && vista !== "evolucion" ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                {defActiva.id === "sueldo" ? "Los sueldos no salen de los viajes." : "El km al 100% no se registra en la hoja de ruta."}
              </p>
              <p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">
                {defActiva.id === "sueldo"
                  ? <>Los de choferes se liquidan fuera del sistema: para calcularlos acá falta la tabla de <span className="text-foreground">tarifas por concepto</span> (km, controles de descarga, sur, pozo). Los de administración y taller sí están cargados, en <Link href="/sueldos-admin" className="text-primary hover:underline">Sueldos admin</Link>.</>
                  : <>No se registra por viaje en la hoja de ruta y hoy solo llega con la planilla del Drive. Además su <span className="text-foreground">definición sigue sin confirmar</span>: no es la resta de km totales menos vacíos.</>}
                {" "}Mientras tanto podés ver la <button type="button" onClick={() => setVista("evolucion")} className="text-primary hover:underline">evolución histórica</button>.
              </p>
            </div>
          ) : (
            <>
              {vista === "tabla" && (
                <MetricaTable
                  key={defActiva.id}
                  def={defActiva}
                  choferes={choferesFiltrados}
                  mostrarFlota={flota === "todas"}
                  onChofer={setChoferSel}
                  comparacion={comparacionTabla}
                />
              )}
              {vista === "grafico" && (
                <MetricaChart def={defActiva} choferes={choferesFiltrados} onChofer={setChoferSel} />
              )}
              {vista === "evolucion" && (
                <EvolucionChart def={defActiva} serie={data.serieHistorica} mesActivo={data.mes} />
              )}
            </>
          )}
        </div>
      )}

      <ChoferDrawer
        chofer={choferSel}
        onClose={() => setChoferSel(null)}
        totalesFlota={totalesFlotaDrawer}
        hist={
          choferSel
            ? data.choferHist[choferSel.nombre]
              ?? (choferSel.choferId ? data.choferHist[choferSel.choferId] : undefined)
              ?? []
            : []
        }
        mes={data.mes}
        esLive={data.esLive}
      />
    </div>
  );
}
