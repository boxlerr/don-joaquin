"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users, UserPlus, UserMinus, Percent, Plus, Pencil, Trash2, ArrowRight,
  TrendingUp, TrendingDown, Minus, Loader2, GitCompareArrows, Calendar, X,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { choferSlug } from "@/lib/chofer-slug";
import type { RotacionDataset } from "./lib";
import {
  computeMetricas, aplicarFiltros, hayFiltros, FILTROS_VACIOS, tramoDeMeses, antiguedadTexto,
  nivelBenchmark, BENCHMARK_MIN, BENCHMARK_MAX,
  TIPO_BAJA_LABEL, TIPO_BAJA_OPTIONS, TRAMOS, TRAMO_LABEL, TRAMO_COLOR, CLASE_BAJA, CLASE_COLOR,
  type Filtros, type MetricasAnio, type BajaRotacion, type TipoBaja, type TramoAntiguedad,
} from "./compute";
import { EvolucionRotacionChart, BajasPorTipoChart, AntiguedadTramosChart } from "./RotacionCharts";
import GestionBajaDialog from "./GestionBajaDialog";
import { eliminarBajaAction, guardarParametrosAnioAction } from "./actions";

const card = "bg-card border border-border rounded-[8px] p-4 sm:p-5";

export default function RotacionClient({
  dataset, canWrite, anioInicial,
}: {
  dataset: RotacionDataset;
  canWrite: boolean;
  anioInicial: number;
}) {
  const router = useRouter();
  const [anio, setAnio] = useState(anioInicial);
  const [modo, setModo] = useState<"anio" | "comparar">("anio");
  const [anioB, setAnioB] = useState(() => dataset.anios.find((a) => a !== anioInicial) ?? anioInicial);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBaja, setEditBaja] = useState<BajaRotacion | null>(null);

  const paramDe = (a: number) => dataset.params.find((p) => p.anio === a) ?? null;
  const estimadaDe = (a: number) => dataset.estimadas.find((e) => e.anio === a) ?? null;
  const altasCountDe = (a: number) => dataset.altas.filter((x) => x.fecha_ingreso.slice(0, 4) === String(a)).length;

  const metricasDe = useMemo(
    () => (a: number, aplicar: boolean): MetricasAnio => {
      const base = dataset.bajas.filter((b) => b.anio === a);
      const bajas = aplicar ? aplicarFiltros(base, filtros) : base;
      return computeMetricas({ anio: a, bajas, param: paramDe(a), estimada: estimadaDe(a), altasCount: altasCountDe(a) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataset, filtros],
  );

  const mA = useMemo(() => metricasDe(anio, true), [metricasDe, anio]);
  const mB = useMemo(() => metricasDe(anioB, true), [metricasDe, anioB]);
  const comparar = modo === "comparar";

  // Serie interanual (sin filtros) para el gráfico de evolución.
  const serie = useMemo(
    () => dataset.anios
      .map((a) => {
        const m = metricasDe(a, false);
        return { anio: a, ir_total: m.ir_total, ir_voluntaria: m.ir_voluntaria, ir_involuntaria: m.ir_involuntaria };
      })
      .sort((a, b) => a.anio - b.anio),
    [dataset.anios, metricasDe],
  );

  // Delta del IR total vs. el año anterior (para el KPI hero).
  const irAnioPrevio = serie.find((s) => s.anio === anio - 1)?.ir_total ?? null;
  const deltaIr = irAnioPrevio != null ? Math.round((mA.ir_total - irAnioPrevio) * 10) / 10 : null;

  const altasDelAnio = useMemo(
    () => dataset.altas.filter((x) => x.fecha_ingreso.slice(0, 4) === String(anio))
      .sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso)),
    [dataset.altas, anio],
  );

  const anioOptions = dataset.anios.map((a) => ({ id: String(a), label: String(a) }));
  const filtrosActivos = hayFiltros(filtros);

  const toggleTipo = (t: TipoBaja) =>
    setFiltros((f) => ({ ...f, tipos: f.tipos.includes(t) ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] }));
  const toggleTramo = (t: TramoAntiguedad) =>
    setFiltros((f) => ({ ...f, tramos: f.tramos.includes(t) ? f.tramos.filter((x) => x !== t) : [...f.tramos, t] }));

  const abrirNueva = () => { setEditBaja(null); setDialogOpen(true); };
  const abrirEditar = (b: BajaRotacion) => { setEditBaja(b); setDialogOpen(true); };

  const descripcion = comparar ? `Comparación · ${anio} vs ${anioB}` : `Año ${anio}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <PageHeader
        title="Índice de rotación de choferes"
        description={descripcion}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <Button variant="brand" size="sm" onClick={abrirNueva}>
                <Plus size={14} /> Cargar baja
              </Button>
            )}
            <Link href="/choferes" className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Users size={14} /> Ver legajos
            </Link>
          </div>
        }
      />

      {/* Egresados del legajo que no llegaron a rotación. Lo normal es que esto
          no se vea nunca. Si aparece, el índice está por debajo de la realidad —
          que fue exactamente lo que encontró Bárbara el 31/08/2026, sumando a
          mano. Se avisa acá para que no haya que darse cuenta. */}
      {dataset.sin_cruzar.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[8px] border border-amber-300/70 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {dataset.sin_cruzar.length === 1
                ? "Hay un chofer egresado en el legajo que no figura acá."
                : `Hay ${dataset.sin_cruzar.length} choferes egresados en el legajo que no figuran acá.`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              El índice está calculado sin ellos, así que da más bajo de lo que
              corresponde. Cargalos con <strong className="font-semibold">Cargar baja</strong>{" "}
              (los fleteros no cuentan y no se listan).
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {dataset.sin_cruzar.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/choferes/${choferSlug(c)}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {[c.apellido, c.nombre].filter(Boolean).join(", ")}
                  </Link>
                  {c.fecha_egreso && (
                    <span className="ml-1 text-muted-foreground/70">
                      · {c.fecha_egreso.split("-").reverse().join("/")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Barra de control: año + modo + comparar + filtros */}
      <div className={`${card} flex flex-wrap items-center gap-2 sm:gap-3`}>
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-muted-foreground" />
          <Combobox value={String(anio)} onValueChange={(v) => setAnio(Number(v))} options={anioOptions} searchable={dataset.anios.length > 7} triggerClassName="h-9 w-28" aria-label="Año" />
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          {(["anio", "comparar"] as const).map((mo) => (
            <button key={mo} type="button" onClick={() => setModo(mo)}
              className={`px-3 h-8 sm:h-7 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1.5 ${modo === mo ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {mo === "comparar" && <GitCompareArrows size={12} />}
              {mo === "anio" ? "Año" : "Comparar"}
            </button>
          ))}
        </div>
        {comparar && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">vs</span>
            <Combobox value={String(anioB)} onValueChange={(v) => setAnioB(Number(v))} options={anioOptions} searchable={dataset.anios.length > 7} triggerClassName="h-9 w-28" aria-label="Año a comparar" />
          </div>
        )}

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        {/* Filtros por tipo */}
        <div className="flex items-center gap-1 flex-wrap">
          {TIPO_BAJA_OPTIONS.filter((o) => dataset.bajas.some((b) => b.tipo_baja === o.value)).map((o) => (
            <button key={o.value} type="button" onClick={() => toggleTipo(o.value)}
              className={`px-2.5 h-8 sm:h-7 text-[11px] font-medium rounded-full border transition-colors ${filtros.tipos.includes(o.value) ? "bg-[#0088D1] text-white border-[#0088D1]" : "bg-card text-muted-foreground border-border hover:border-[#0088D1]/50"}`}>
              {o.label}
            </button>
          ))}
        </div>
        {dataset.bases.length > 0 && (
          <Combobox
            value={filtros.base ?? ""}
            onValueChange={(v) => setFiltros((f) => ({ ...f, base: v || null }))}
            options={[{ id: "", label: "Todas las bases" }, ...dataset.bases.map((b) => ({ id: b, label: b }))]}
            triggerClassName="h-9 sm:h-8 w-full sm:w-40 text-xs" aria-label="Base / zona"
          />
        )}
        {filtrosActivos && (
          <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)} className="inline-flex items-center gap-1 h-8 sm:h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Filtros de tramo (segunda fila, chips) */}
      <div className="flex items-center gap-1.5 flex-wrap -mt-1 px-1">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mr-1">Antigüedad:</span>
        {TRAMOS.filter((t) => t !== "sin_dato" || dataset.bajas.some((b) => tramoDeMeses(b.antiguedad_meses) === "sin_dato")).map((t) => (
          <button key={t} type="button" onClick={() => toggleTramo(t)}
            className={`px-2.5 h-7 sm:h-6 text-[11px] font-medium rounded-full border transition-colors inline-flex items-center gap-1 ${filtros.tramos.includes(t) ? "text-white border-transparent" : "bg-card text-muted-foreground border-border hover:border-foreground/30"}`}
            style={filtros.tramos.includes(t) ? { background: TRAMO_COLOR[t] } : undefined}>
            <span className="size-2 rounded-full" style={{ background: TRAMO_COLOR[t] }} /> {TRAMO_LABEL[t]}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {comparar ? (
        <ComparacionKpis a={mA} b={mB} anioA={anio} anioB={anioB} anioActual={dataset.anio_actual} dotacionActual={dataset.dotacion_actual} />
      ) : (
        <KpisAnio m={mA} deltaIr={deltaIr} dotacionActual={dataset.dotacion_actual} />
      )}

      {/* Evolución (siempre) */}
      <EvolucionRotacionChart serie={serie} anioSel={anio} />

      {/* Composición */}
      {comparar ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{anio}</p>
            <BajasPorTipoChart m={mA} /><AntiguedadTramosChart m={mA} />
          </div>
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{anioB}</p>
            <BajasPorTipoChart m={mB} /><AntiguedadTramosChart m={mB} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BajasPorTipoChart m={mA} /><AntiguedadTramosChart m={mA} />
        </div>
      )}

      {/* Parámetros del año (edición) */}
      {canWrite && !comparar && <ParametrosAnioCard anio={anio} m={mA} onSaved={() => router.refresh()} />}

      {/* Tabla */}
      <RotacionTabla
        bajas={mA.bajas_detalle} altas={altasDelAnio} anio={anio} canWrite={canWrite}
        onEditar={abrirEditar} onEliminada={() => router.refresh()}
      />

      <GestionBajaDialog open={dialogOpen} onOpenChange={setDialogOpen} baja={editBaja} anioDefault={anio} onSaved={() => router.refresh()} />
    </div>
  );
}

// ── KPIs modo Año ──────────────────────────────────────────────────────────
function KpisAnio({ m, deltaIr, dotacionActual }: { m: MetricasAnio; deltaIr: number | null; dotacionActual: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* IR total hero (2 columnas) */}
      <div className={`${card} sm:col-span-2 flex flex-col`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Percent size={14} /> Índice de rotación total
          </div>
          {deltaIr != null && <DeltaBadge delta={deltaIr} unidad="pp" invertirColor />}
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 mt-1">
          <p className="text-3xl sm:text-4xl font-bold text-[#0088D1]">{m.ir_total}%</p>
          <p className="text-xs text-muted-foreground mb-1.5">{m.bajas} bajas ÷ {m.dotacion_promedio} dotación prom.</p>
        </div>
        <BenchmarkGauge ir={m.ir_total} />
      </div>
      <Kpi label="Dotación" icon={Users} tone="text-foreground"
        value={<span className="inline-flex items-center gap-1.5">{m.flota_inicial ?? "—"} <ArrowRight size={16} className="text-muted-foreground" /> {m.flota_final ?? "—"}</span>}
        hint={`promedio ${m.dotacion_promedio}${m.flota_fuente === "estimada" ? " · estimado" : ""}`} />
      <div className="grid grid-cols-2 sm:grid-cols-1 sm:grid-rows-2 gap-3 sm:gap-4">
        <Kpi label={`Altas ${m.anio}`} icon={UserPlus} tone="text-emerald-600" value={m.altas} hint="ingresos" compact />
        <Kpi label={`Bajas ${m.anio}`} icon={UserMinus} tone="text-red-600" value={m.bajas} hint="egresos" compact />
      </div>
      {/* Sub-fila IR desagregado */}
      <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <MiniIr label="IR voluntaria" value={m.ir_voluntaria} count={m.por_clase.find((c) => c.clase === "voluntaria")?.count ?? 0} color={CLASE_COLOR.voluntaria} />
        <MiniIr label="IR involuntaria" value={m.ir_involuntaria} count={m.por_clase.find((c) => c.clase === "involuntaria")?.count ?? 0} color={CLASE_COLOR.involuntaria} />
        <MiniIr label="IR jubilación" value={m.ir_jubilacion} count={m.por_clase.find((c) => c.clase === "jubilacion")?.count ?? 0} color={CLASE_COLOR.jubilacion} />
      </div>
      <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-muted-foreground/70 -mt-1">Dotación actual: {dotacionActual} choferes activos hoy.</p>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone, compact }: { label: string; value: React.ReactNode; hint: string; icon: React.ElementType; tone: string; compact?: boolean }) {
  return (
    <div className={`${card} ${compact ? "!p-3 sm:!p-3.5" : ""} flex flex-col justify-center`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"><Icon size={14} /> {label}</div>
      <p className={`mt-1 ${compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"} font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>
    </div>
  );
}

function MiniIr({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  return (
    <div className={`${card} !p-3 sm:!p-3.5 flex items-center justify-between gap-2`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate text-sm text-foreground">{label}</span>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold text-foreground leading-none">{value}%</p>
        <p className="text-[11px] text-muted-foreground">{count} {count === 1 ? "baja" : "bajas"}</p>
      </div>
    </div>
  );
}

function BenchmarkGauge({ ir }: { ir: number }) {
  const max = Math.max(BENCHMARK_MAX + 8, Math.ceil(ir) + 4, 28);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const nivel = nivelBenchmark(ir);
  const colorMarker = nivel === "alto" ? "#EF4444" : nivel === "dentro" ? "#F59E0B" : "#10B981";
  return (
    <div className="mt-3">
      <div className="relative h-2.5 rounded-full bg-muted/50 overflow-hidden">
        <div className="absolute inset-y-0 bg-amber-200/50" style={{ left: pct(BENCHMARK_MIN), width: `${((BENCHMARK_MAX - BENCHMARK_MIN) / max) * 100}%` }} />
      </div>
      <div className="relative h-0">
        <div className="absolute -top-[13px] size-3 rounded-full border-2 border-white shadow" style={{ left: `calc(${pct(ir)} - 6px)`, background: colorMarker }} title={`${ir}%`} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>Benchmark del sector {BENCHMARK_MIN}%–{BENCHMARK_MAX}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

function DeltaBadge({ delta, unidad, invertirColor }: { delta: number; unidad: string; invertirColor?: boolean }) {
  const subio = delta > 0;
  const neutro = delta === 0;
  // Para rotación, subir es "malo" (rojo).
  const bueno = invertirColor ? !subio : subio;
  const cls = neutro ? "text-muted-foreground bg-muted/50" : bueno ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50";
  const Icon = neutro ? Minus : subio ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      <Icon size={12} /> {subio ? "+" : ""}{delta} {unidad}
    </span>
  );
}

// ── KPIs modo Comparar ─────────────────────────────────────────────────────
function ComparacionKpis({ a, b, anioA, anioB, anioActual, dotacionActual }: { a: MetricasAnio; b: MetricasAnio; anioA: number; anioB: number; anioActual: number; dotacionActual: number }) {
  const filas: { label: string; va: number; vb: number; suf: string }[] = [
    { label: "IR total", va: a.ir_total, vb: b.ir_total, suf: "%" },
    { label: "IR voluntaria", va: a.ir_voluntaria, vb: b.ir_voluntaria, suf: "%" },
    { label: "IR involuntaria", va: a.ir_involuntaria, vb: b.ir_involuntaria, suf: "%" },
    { label: "Bajas", va: a.bajas, vb: b.bajas, suf: "" },
    { label: "Altas", va: a.altas, vb: b.altas, suf: "" },
    { label: "Dotación prom.", va: a.dotacion_promedio, vb: b.dotacion_promedio, suf: "" },
  ];
  return (
    <div className={card}>
      {/* En el celular las columnas se achican en vez de empujar la tarjeta:
          los rótulos ("IR involuntaria") necesitan el resto del ancho. */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 sm:gap-x-4 gap-y-2 items-center">
        <div />
        <div className="text-xs sm:text-sm font-bold text-[#0088D1] text-right w-14 sm:w-20">{anioA}{anioA === anioActual ? " (parcial)" : ""}</div>
        <div className="text-xs sm:text-sm font-bold text-foreground text-right w-14 sm:w-20">{anioB}{anioB === anioActual ? " (parcial)" : ""}</div>
        <div className="text-xs font-semibold text-muted-foreground text-right w-16 sm:w-24">Δ</div>
        {filas.map((f) => {
          const delta = Math.round((f.va - f.vb) * 10) / 10;
          return (
            <div key={f.label} className="contents">
              <div className="text-[13px] sm:text-sm text-foreground border-t border-border/60 pt-2">{f.label}</div>
              <div className="text-[13px] sm:text-sm font-semibold text-foreground text-right border-t border-border/60 pt-2">{f.va}{f.suf}</div>
              <div className="text-[13px] sm:text-sm text-muted-foreground text-right border-t border-border/60 pt-2">{f.vb}{f.suf}</div>
              <div className="text-right border-t border-border/60 pt-2">
                <DeltaBadge delta={delta} unidad={f.suf === "%" ? "pp" : ""} invertirColor={f.label.startsWith("IR") || f.label === "Bajas"} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground/70 mt-3">Dotación actual: {dotacionActual} choferes activos hoy.</p>
    </div>
  );
}

// ── Parámetros del año ─────────────────────────────────────────────────────
function ParametrosAnioCard({ anio, m, onSaved }: { anio: number; m: MetricasAnio; onSaved: () => void }) {
  const [ini, setIni] = useState(m.flota_inicial != null ? String(m.flota_inicial) : "");
  const [fin, setFin] = useState(m.flota_final != null ? String(m.flota_final) : "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  // Resync si cambia el año.
  const [ultimoAnio, setUltimoAnio] = useState(anio);
  if (ultimoAnio !== anio) {
    setUltimoAnio(anio);
    setIni(m.flota_inicial != null ? String(m.flota_inicial) : "");
    setFin(m.flota_final != null ? String(m.flota_final) : "");
    setMsg(null);
  }
  const guardar = () => {
    setMsg(null);
    start(async () => {
      const res = await guardarParametrosAnioAction(anio, {
        flota_inicial: ini === "" ? null : Number(ini),
        flota_final: fin === "" ? null : Number(fin),
      });
      if (res.error) setMsg(res.error);
      else { setMsg("Guardado."); onSaved(); }
    });
  };
  return (
    <div className={`${card} flex flex-wrap items-end gap-3 sm:gap-4`}>
      <div className="w-full sm:w-auto">
        <p className="text-xs font-semibold text-foreground">Parámetros de {anio}</p>
        <p className="text-[11px] text-muted-foreground">Flota inicial y final del año → dotación promedio del índice.{m.flota_fuente === "estimada" && " (hoy estimado desde legajos)"}</p>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Flota inicial</Label>
        <Input type="number" value={ini} onChange={(e) => setIni(e.target.value)} className="h-9 sm:h-8 w-24 text-sm" placeholder="—" />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Flota final</Label>
        <Input type="number" value={fin} onChange={(e) => setFin(e.target.value)} className="h-9 sm:h-8 w-24 text-sm" placeholder="—" />
      </div>
      <Button variant="outline" size="sm" onClick={guardar} disabled={pending} className="h-9 sm:h-8">
        {pending ? <Loader2 size={13} className="animate-spin" /> : "Guardar"}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}

// ── Tabla (Bajas / Ingresos) ───────────────────────────────────────────────
function RotacionTabla({
  bajas, altas, anio, canWrite, onEditar, onEliminada,
}: {
  bajas: BajaRotacion[];
  altas: { id: string; nombre: string; apellido: string; localidad: string | null; fecha_ingreso: string; estado: string }[];
  anio: number;
  canWrite: boolean;
  onEditar: (b: BajaRotacion) => void;
  onEliminada: () => void;
}) {
  const [tab, setTab] = useState<"bajas" | "ingresos">("bajas");
  const [borrando, setBorrando] = useState<string | null>(null);
  const [bajaAEliminar, setBajaAEliminar] = useState<BajaRotacion | null>(null);

  const fmt = (s: string | null) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return d ? `${d}/${m}/${y}` : s;
  };

  const eliminar = async () => {
    if (!bajaAEliminar) return;
    setBorrando(bajaAEliminar.id);
    await eliminarBajaAction(bajaAEliminar.id);
    setBorrando(null);
    setBajaAEliminar(null);
    onEliminada();
  };

  return (
    <div className="bg-card border border-border rounded-[8px] overflow-hidden">
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30 overflow-x-auto">
        {(["bajas", "ingresos"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-3 h-9 sm:h-8 text-xs font-medium rounded-md transition-all ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "bajas" ? `Bajas (${bajas.length})` : `Ingresos (${altas.length})`}
          </button>
        ))}
      </div>

      {tab === "bajas" ? (
        bajas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin bajas para los filtros de {anio}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="bg-muted/40">
                  {["Chofer", "Base/zona", "Egreso", "Antigüedad", "Tipo", "Motivo", canWrite ? "" : null].filter((h) => h !== null).map((h, i) => (
                    /* La primera columna queda fija al scrollear de costado:
                       sin el nombre, las demás celdas no dicen de quién son. */
                    <th key={i} className={`px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[11px] border-b border-border whitespace-nowrap ${i === 0 ? "sticky left-0 z-20 bg-[#F9FBFD] shadow-[1px_0_0_0_rgba(0,0,0,0.08)]" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bajas.map((b) => {
                  const clase = CLASE_BAJA[b.tipo_baja];
                  const tramo = tramoDeMeses(b.antiguedad_meses);
                  return (
                    <tr key={b.id} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.08)] px-3 py-2 font-medium text-foreground whitespace-nowrap">{b.nombre}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{b.base_zona ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(b.fecha_egreso)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="size-2 rounded-full" style={{ background: TRAMO_COLOR[tramo] }} />
                          {b.antiguedad_texto ?? antiguedadTexto(b.antiguedad_meses)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex text-[11px] font-medium rounded-full px-2 py-0.5 border" style={{ background: `${CLASE_COLOR[clase]}1a`, color: CLASE_COLOR[clase], borderColor: `${CLASE_COLOR[clase]}55` }}>
                          {TIPO_BAJA_LABEL[b.tipo_baja]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={b.motivo ?? ""}>{b.motivo ?? "—"}</td>
                      {canWrite && (
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => onEditar(b)} className="p-2 sm:p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10" title="Editar"><Pencil size={14} /></button>
                            {borrando === b.id ? <Loader2 size={14} className="animate-spin text-red-400" /> : (
                              <button type="button" onClick={() => setBajaAEliminar(b)} className="p-2 sm:p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50" title="Eliminar"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : altas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin ingresos en {anio}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {["Chofer", "Localidad", "Ingreso", "Estado"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[11px] border-b border-border whitespace-nowrap ${i === 0 ? "sticky left-0 z-20 bg-[#F9FBFD] shadow-[1px_0_0_0_rgba(0,0,0,0.08)]" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {altas.map((a) => (
                <tr key={a.id} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.08)] px-3 py-2 font-medium text-foreground whitespace-nowrap">
                    <Link href={`/choferes/${choferSlug(a)}`} className="hover:text-primary hover:underline">{a.apellido}, {a.nombre}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{a.localidad ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(a.fecha_ingreso)}</td>
                  <td className="px-3 py-2">
                    {/* Punto + texto, como en camiones: el color va en el punto,
                        no en un fondo pastel detrás de la palabra. */}
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          background:
                            a.estado === "activo" ? "#10B981" : a.estado === "baja" ? "#94A3B8" : "#CBD5E1",
                        }}
                        aria-hidden
                      />
                      {a.estado === "baja" ? "egresado" : a.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!bajaAEliminar}
        onOpenChange={(o) => { if (!o) setBajaAEliminar(null); }}
        title="Eliminar baja"
        description={bajaAEliminar ? <>Se va a eliminar la baja de <strong className="text-foreground">{bajaAEliminar.nombre}</strong>. Esta acción no se puede deshacer.</> : null}
        onConfirm={eliminar}
        loading={borrando != null}
      />
    </div>
  );
}
