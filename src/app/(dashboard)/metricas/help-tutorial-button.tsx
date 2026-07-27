"use client";

import HelpTutorialDialog, {
  type TutorialTab,
  MockField,
} from "@/components/help/HelpTutorialDialog";
import {
  LayoutDashboard,
  Table2,
  Trophy,
  FileSpreadsheet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Route,
  Gauge,
  Truck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ChartBarBig,
  ChartLine,
  ArrowUp,
  ArrowDown,
  User,
  Plus,
  GitCompareArrows,
  X,
  Printer,
  Lock,
  ShieldCheck,
  ArrowUpRight,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers de mockup (TODO a nivel de módulo — nunca dentro de un componente)
// ---------------------------------------------------------------------------

function Spark({ good, dir }: { good: boolean; dir: "up" | "down" }) {
  const pts = dir === "up" ? "0,13 8,10 16,11 24,6 32,7 40,3" : "0,3 8,6 16,5 24,9 32,8 40,12";
  return (
    <svg viewBox="0 0 40 16" className="h-3.5 w-10 shrink-0" fill="none" preserveAspectRatio="none">
      <polyline
        points={pts}
        stroke={good ? "#10B981" : "#EF4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatDelta({ good, dir, children }: { good: boolean; dir: "up" | "down"; children: React.ReactNode }) {
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold " +
        (good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")
      }
    >
      {dir === "up" ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
      {children}
    </span>
  );
}

function KpiMini({
  icon, label, value, dir, good, delta, active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir: "up" | "down";
  good: boolean;
  delta: string;
  active?: boolean;
}) {
  return (
    <div className={"rounded-lg border p-1.5 " + (active ? "border-primary bg-primary/5" : "border-border bg-card")}>
      <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-1">
        <span className="font-mono text-[13px] font-bold text-foreground">{value}</span>
        <Spark good={good} dir={dir} />
      </div>
      <div className="mt-1">
        <StatDelta good={good} dir={dir}>{delta}</StatDelta>
      </div>
    </div>
  );
}

function CobItem({ ok, label, detalle }: { ok: boolean; label: string; detalle?: string }) {
  return (
    <div className="flex items-start gap-1.5">
      {ok
        ? <CheckCircle2 size={11} className="mt-px shrink-0 text-emerald-500" />
        : <AlertTriangle size={11} className="mt-px shrink-0 text-amber-500" />}
      <span className="text-[10px] text-foreground">
        {label}
        {detalle && <span className="text-muted-foreground"> — {detalle}</span>}
      </span>
    </div>
  );
}

const TABLA_GRID = "grid grid-cols-[16px_1fr_48px_48px_40px] gap-2";

function FilaTabla({
  rank, nombre, flota, km, val, dot,
}: {
  rank: string;
  nombre: string;
  flota: string;
  km: string;
  val: string;
  dot: string;
}) {
  return (
    <div className={TABLA_GRID + " items-center px-2 py-1 text-[10px]"}>
      <span className="font-mono text-muted-foreground">{rank}</span>
      <span className="flex items-center gap-1 truncate font-medium text-foreground">
        <span className={"size-1.5 shrink-0 rounded-full " + dot} />
        {nombre}
      </span>
      <span className="text-muted-foreground">{flota}</span>
      <span className="text-right font-mono text-foreground">{km}</span>
      <span className="text-right font-mono font-semibold text-foreground">{val}</span>
    </div>
  );
}

function DestacadoCard({
  tab, mejor, mejorVal, peor, peorVal,
}: {
  tab: string;
  mejor: string;
  mejorVal: string;
  peor: string;
  peorVal: string;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="mb-1 text-[8px] font-medium uppercase tracking-wide text-muted-foreground">{tab}</p>
      <div className="flex items-center gap-1 text-[10px]">
        <Trophy size={10} className="shrink-0 text-emerald-500" />
        <span className="flex-1 truncate font-medium text-foreground">{mejor}</span>
        <span className="font-mono text-emerald-600">{mejorVal}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[10px]">
        <AlertTriangle size={10} className="shrink-0 text-red-400" />
        <span className="flex-1 truncate font-medium text-foreground">{peor}</span>
        <span className="font-mono text-red-500">{peorVal}</span>
      </div>
    </div>
  );
}

function ExportRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-foreground">
      <span
        className={
          "inline-flex size-3.5 items-center justify-center rounded border " +
          (on ? "border-primary bg-primary text-white" : "border-border bg-card")
        }
      >
        {on && <Check size={9} />}
      </span>
      {label}
    </div>
  );
}

const EVOL_GRID = "grid grid-cols-[40px_1fr_1fr_1fr] gap-2";

function FilaEvol({
  mes, fk, vac, ton, activo,
}: {
  mes: string;
  fk: string;
  vac: string;
  ton: string;
  activo?: boolean;
}) {
  return (
    <div className={EVOL_GRID + " px-2 py-1 text-[10px] " + (activo ? "bg-primary/5" : "")}>
      <span className={"font-medium " + (activo ? "text-primary" : "text-muted-foreground")}>{mes}</span>
      <span className="text-right font-mono text-foreground">{fk}</span>
      <span className="text-right font-mono text-foreground">{vac}</span>
      <span className="text-right font-mono text-foreground">{ton}</span>
    </div>
  );
}

function CmpFila({ n, a, b, d, up }: { n: string; a: string; b: string; d: string; up: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_40px_40px_36px] gap-2 px-2 py-1 text-[10px]">
      <span className="truncate font-medium text-foreground">{n}</span>
      <span className="text-right font-mono text-foreground">{a}</span>
      <span className="text-right font-mono text-violet-700">{b}</span>
      <span className={"text-right font-mono " + (up ? "text-emerald-600" : "text-red-500")}>{d}</span>
    </div>
  );
}

// ===========================================================================
// TAB 1 — El tablero
// ===========================================================================

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_CON_DATOS = new Set(["ene", "feb", "mar", "abr", "may"]);

function MockMesSelector() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1">
        <span className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
          <ChevronLeft size={13} />
        </span>
        <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-border bg-card px-2.5">
          <Calendar size={12} className="text-muted-foreground" />
          <span className="flex-1 text-[11px] font-medium text-foreground">Mayo 2026</span>
          <span className="size-1.5 rounded-full bg-primary" title="Con planillas cargadas" />
        </div>
        <span className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
          <ChevronRight size={13} />
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        <div className="mb-1.5 text-center text-[10px] font-bold text-foreground">2026</div>
        <div className="grid grid-cols-4 gap-1">
          {MESES.map((m) => {
            const on = MESES_CON_DATOS.has(m);
            const activo = m === "may";
            const esHoy = m === "jul";
            return (
              <div
                key={m}
                className={
                  "relative flex h-7 items-center justify-center rounded-md text-[10px] font-medium capitalize " +
                  (activo
                    ? "bg-primary text-white"
                    : on
                      ? "text-foreground"
                      : "text-muted-foreground/40") +
                  (esHoy && !activo ? " ring-1 ring-primary/40" : "")
                }
              >
                {m}
                {on && <span className={"absolute bottom-0.5 size-1 rounded-full " + (activo ? "bg-white" : "bg-primary")} />}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-[9px] font-semibold text-primary">
          <span>Hoy (en vivo)</span>
          <span>Último con planillas</span>
        </div>
      </div>
    </div>
  );
}

function MockKpisPanel() {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <KpiMini icon={<TrendingUp size={9} />} label="Facturación" value="$182 M" dir="up" good delta="+6,4%" active />
      <KpiMini icon={<Route size={9} />} label="KM totales" value="284.500" dir="up" good delta="+2,1%" />
      <KpiMini icon={<Gauge size={9} />} label="Fact. por km" value="$640" dir="up" good delta="+4,2%" />
      <KpiMini icon={<Truck size={9} />} label="% KM vacíos" value="12,4%" dir="down" good delta="−1,1 pp" />
    </div>
  );
}

function MockCoberturaBanner() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5">
        <AlertTriangle size={12} className="shrink-0 text-amber-600" />
        <span className="text-[10px] font-semibold text-amber-700">Faltan datos este mes: Toneladas · Interanual</span>
      </div>
      <div className="space-y-1 rounded-lg border border-border bg-card p-2.5">
        <CobItem ok label="Facturación por km" />
        <CobItem ok label="KM vacíos" />
        <CobItem ok={false} label="Toneladas" detalle="la planilla del mes no las trae" />
        <CobItem ok={false} label="Comparación interanual" detalle="falta cargar may 2025" />
      </div>
    </div>
  );
}

function MockLive() {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
        <span className="relative mt-0.5 flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <p className="text-[10px] leading-snug text-foreground">
          <span className="font-bold">EN VIVO</span> · Julio 2026 todavía no tiene planillas: estás viendo los{" "}
          <b>1.240 viajes</b> cargados en la hoja de ruta. Se actualiza sola cada minuto.
        </p>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-[9px] text-muted-foreground">
          <RefreshCw size={9} /> Actualizar
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50/60 px-2 py-0.5 text-[9px] font-medium text-amber-800">
          <Lock size={9} /> Sueldos: sin dato en vivo
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50/60 px-2 py-0.5 text-[9px] font-medium text-amber-800">
          <Lock size={9} /> KM al 100%: sin dato en vivo
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Las planillas
// ===========================================================================

const PESTANAS = ["Resumen", "Fact. por km", "KM vacíos", "KM al 100%", "Toneladas", "Sueldo s/fact", "Evolución"];

function MockPestanas() {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {PESTANAS.map((t, i) => (
        <span
          key={t}
          className={
            "rounded-md px-2 py-1 text-[10px] font-medium " +
            (i === 1 ? "bg-card text-primary shadow-sm" : "text-muted-foreground")
          }
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function MockFiltros() {
  return (
    <div className="space-y-2">
      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        <span className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm">Todas (42)</span>
        <span className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Escalables (28)</span>
        <span className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Tolvas (14)</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex h-7 w-32 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[10px] text-muted-foreground">
          <Search size={11} /> Buscar chofer…
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm">
            <Table2 size={10} /> Tabla
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground">
            <ChartBarBig size={10} /> Gráfico
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground">
            <ChartLine size={10} /> Evolución
          </span>
        </div>
      </div>
    </div>
  );
}

function MockTabla() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className={TABLA_GRID + " border-b border-border bg-muted/60 px-2 py-1.5 text-[8px] font-bold uppercase text-muted-foreground"}>
        <span>#</span>
        <span>Chofer</span>
        <span>Flota</span>
        <span className="text-right">KM</span>
        <span className="inline-flex items-center justify-end gap-0.5">
          $/km <ArrowDown size={8} />
        </span>
      </div>
      <div className="divide-y divide-border">
        <FilaTabla rank="1" nombre="Pittana M." flota="Escal." km="9.240" val="$712" dot="bg-emerald-500" />
        <FilaTabla rank="2" nombre="Cejas N." flota="Escal." km="8.980" val="$688" dot="bg-emerald-500" />
        <FilaTabla rank="3" nombre="Ramos B." flota="Tolvas" km="7.640" val="$641" dot="bg-muted-foreground/30" />
        <FilaTabla rank="4" nombre="Cardarelli" flota="Tolvas" km="6.120" val="$588" dot="bg-red-400" />
      </div>
      <div className={TABLA_GRID + " border-t-2 border-border bg-muted/50 px-2 py-1.5 text-[10px] font-bold text-foreground"}>
        <span />
        <span>TOTALES</span>
        <span />
        <span className="text-right font-mono">284.500</span>
        <span className="text-right font-mono">$640</span>
      </div>
    </div>
  );
}

function MockDrawer() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-foreground">Pittana, Miguel</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-medium text-foreground">Escal. 35</span>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[9px] text-foreground">
            <User size={9} /> Ver legajo
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[9px] text-foreground">
            <Route size={9} /> Ver viajes
          </span>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md border border-primary bg-primary/5 p-1.5">
            <p className="text-[8px] text-muted-foreground">Fact. por km</p>
            <p className="font-mono text-[13px] font-bold text-foreground">$712</p>
            <p className="text-[8px] font-medium text-emerald-600">+11,3% vs prom.</p>
          </div>
          <div className="rounded-md border border-border p-1.5">
            <p className="text-[8px] text-muted-foreground">% vacíos</p>
            <p className="font-mono text-[13px] font-bold text-foreground">9,8%</p>
            <p className="text-[8px] font-medium text-emerald-600">−2,6 pp vs prom.</p>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Desglose del sueldo</p>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="bg-primary" style={{ width: "62%" }} />
            <div className="bg-amber-500" style={{ width: "18%" }} />
            <div className="bg-violet-500" style={{ width: "12%" }} />
            <div className="bg-emerald-500" style={{ width: "8%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 3 — Resumen
// ===========================================================================

function MockDestacados() {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <DestacadoCard tab="Fact. por km" mejor="Pittana M." mejorVal="$712" peor="Cardarelli" peorVal="$588" />
      <DestacadoCard tab="KM vacíos" mejor="Cejas N." mejorVal="8,1%" peor="Sosa R." peorVal="19,4%" />
    </div>
  );
}

function MockCostoKm() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-foreground">Facturación vs costo por km (estudio)</p>
      <div className="rounded-md border border-border bg-card p-2">
        <svg viewBox="0 0 120 44" className="h-16 w-full" fill="none" preserveAspectRatio="none">
          <polyline points="0,30 20,26 40,28 60,20 80,16 100,12 120,10" stroke="#0088D1" strokeWidth="2" strokeLinejoin="round" />
          <polyline points="0,24 20,23 40,22 60,22 80,21 100,20 120,20" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <div className="mt-1 flex gap-3 text-[8px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-[#0088D1]" /> Facturación $/km</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-[#EF4444]" /> Costo estudio $/km</span>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground">
        Si la línea azul cae por debajo de la roja, el km se está facturando por debajo del costo.
      </p>
    </div>
  );
}

function MockParidad() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-foreground">¿Los aumentos van a la par?</p>
      <div className="space-y-1">
        {[
          { k: "A los clientes", v: "+94,2%", w: 96, c: "bg-sky-500" },
          { k: "A la gente", v: "+97,5%", w: 100, c: "bg-amber-500" },
          { k: "Inflación", v: "+89,1%", w: 91, c: "bg-muted-foreground/50" },
        ].map((f) => (
          <div key={f.k} className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-[8px] text-muted-foreground">{f.k}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-muted">
              <span className={`block h-full rounded-[2px] ${f.c}`} style={{ width: `${f.w}%` }} />
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[8px] font-bold text-foreground">{f.v}</span>
          </div>
        ))}
      </div>
      <div className="border-l-2 border-emerald-500 pl-1.5 text-[9px] leading-snug">
        <span className="font-medium text-foreground">Van a la par.</span>{" "}
        <span className="text-muted-foreground">+94,2% contra +97,5%: 3,3 puntos de diferencia.</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-medium text-foreground">
          YPF <span className="font-mono text-amber-600">+96%</span>
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-medium text-foreground">
          Loma <span className="font-mono text-amber-600">+92%</span>
        </span>
      </div>
    </div>
  );
}

function MockCargarAumento() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ArrowUpRight size={13} className="text-amber-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Cargar aumento de tarifa</span>
      </div>
      <div className="space-y-2.5 p-3">
        <MockField label="Cliente" value="YPF S.A." />
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Vigente desde *" value="01/06/2026" required icon={<Calendar size={10} />} />
          <MockField label="Aumento % *" value="8,5" required />
        </div>
        <MockField label="Observaciones" value="paritaria + combustible" />
        <div className="flex justify-end border-t border-border pt-1.5">
          <div className="inline-flex h-7 items-center gap-1 rounded-md bg-[#0088D1] px-3 text-[10px] font-bold text-white">
            <Plus size={11} /> Guardar
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 4 — Comparar y exportar
// ===========================================================================

function MockComparar() {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/60 bg-violet-500/5 px-2 py-1 text-[10px] font-medium text-violet-700">
          <GitCompareArrows size={11} /> vs Abril 2026 <X size={10} />
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_40px_40px_36px] gap-2 border-b border-border bg-muted/60 px-2 py-1 text-[8px] font-bold uppercase text-muted-foreground">
          <span>Chofer</span>
          <span className="text-right">$/km</span>
          <span className="text-right text-violet-700">Abr</span>
          <span className="text-right text-violet-700">Δ</span>
        </div>
        <div className="divide-y divide-border">
          <CmpFila n="Pittana M." a="$712" b="$668" d="+6,6%" up />
          <CmpFila n="Cejas N." a="$688" b="$701" d="−1,9%" up={false} />
        </div>
      </div>
    </div>
  );
}

function MockEvolucion() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className={EVOL_GRID + " border-b border-border bg-muted/60 px-2 py-1.5 text-[8px] font-bold uppercase text-muted-foreground"}>
        <span>Mes</span>
        <span className="text-right">$/km</span>
        <span className="text-right">% vac.</span>
        <span className="text-right">Ton.</span>
      </div>
      <div className="divide-y divide-border">
        <FilaEvol mes="mar 26" fk="$602" vac="13,1%" ton="28,4" />
        <FilaEvol mes="abr 26" fk="$668" vac="12,8%" ton="29,1" />
        <FilaEvol mes="may 26" fk="$640" vac="12,4%" ton="—" activo />
      </div>
    </div>
  );
}

function MockExport() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2 text-[11px] font-bold text-foreground">Exportar planillas del mes</div>
      <div className="space-y-1.5 p-3">
        <ExportRow label="Sueldo sobre facturación" on />
        <ExportRow label="Facturación por km" on />
        <ExportRow label="KM vacíos" on />
        <ExportRow label="Toneladas" on={false} />
        <div className="mt-1 flex w-fit gap-1 rounded-lg bg-muted p-1">
          <span className="rounded-md bg-card px-2 py-0.5 text-[9px] font-medium text-primary shadow-sm">Todas juntas</span>
          <span className="px-2 py-0.5 text-[9px] text-muted-foreground">Un archivo c/u</span>
        </div>
        <div className="flex justify-end gap-1.5 border-t border-border pt-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[9px] font-medium text-foreground">
            <Printer size={10} /> PDF / Imprimir
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-bold text-white">
            <FileSpreadsheet size={10} /> Excel
          </span>
        </div>
      </div>
    </div>
  );
}

function MockConfidencial() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <Lock size={14} />
        </span>
        <div>
          <p className="text-[11px] font-bold text-amber-900">Métricas históricas</p>
          <p className="text-[9px] text-amber-800">Sección confidencial — solo administradores</p>
        </div>
      </div>
      <div className="flex items-start gap-1.5 rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] px-2.5 py-2 text-[9px] text-[#075985]">
        <ShieldCheck size={12} className="mt-px shrink-0 text-primary" />
        <span>
          Facturación, sueldos y márgenes viven acá. Por defecto <b>solo el Administrador</b> entra, aunque su rol tenga Edición.
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "tablero",
    label: "El tablero",
    icon: <LayoutDashboard size={14} />,
    steps: [
      {
        title: "Elegí el mes",
        description:
          "Con las flechas ‹ › te movés mes a mes, o abrís el calendario para saltar a cualquiera. El puntito azul marca los meses que ya tienen las planillas cargadas, y los atajos “Hoy (en vivo)” y “Último con planillas” te llevan directo.",
        mockup: <MockMesSelector />,
        hint: "Un mes sin planillas igual se puede ver: el sistema lo arma solo desde los viajes (modo EN VIVO).",
      },
      {
        title: "Los KPIs con tendencia",
        description:
          "Arriba, los números grandes del mes: facturación, km, $/km, % vacíos, % al 100%, % sueldo y toneladas. Cada uno trae su mini-tendencia y la variación contra el mes anterior y el interanual. Hacé click en cualquiera y saltás a su planilla.",
        mockup: <MockKpisPanel />,
        hint: "Verde = mejoró, rojo = empeoró. Ojo: en “% vacíos” y “% sueldo”, bajar es lo bueno.",
      },
      {
        title: "Qué falta este mes",
        description:
          "La franja de cobertura te dice EXACTO qué falta: una planilla sin cargar, una comparación que no está o un hueco en la serie. Nada de huecos silenciosos: si un número no aparece, acá dice por qué y adónde ir a cargarlo.",
        mockup: <MockCoberturaBanner />,
      },
      {
        title: "Modo EN VIVO",
        description:
          "Si el mes todavía no tiene planillas del Drive, el tablero se arma con los viajes de la hoja de ruta y aparece la franja EN VIVO. En el mes en curso se refresca solo cada minuto. Sueldos y km al 100% no salen de los viajes: llegan con la planilla.",
        mockup: <MockLive />,
        hint: "Sirve para mirar el mes en curso sin esperar el cierre de las planillas.",
      },
    ],
  },
  {
    id: "planillas",
    label: "Las planillas",
    icon: <Table2 size={14} />,
    steps: [
      {
        title: "Las pestañas",
        description:
          "Un Resumen general, una pestaña por cada planilla (Facturación por km, KM vacíos, KM al 100%, Toneladas, Sueldo s/ facturación) y la Evolución anual. La pestaña queda guardada en la URL, así que la podés compartir o refrescar sin perderla.",
        mockup: <MockPestanas />,
      },
      {
        title: "Filtrá y elegí la vista",
        description:
          "Dentro de cada planilla filtrás por flota (Escalables / Tolvas), buscás un chofer por nombre y cambiás entre Tabla, Gráfico y Evolución con los botones de la derecha.",
        mockup: <MockFiltros />,
      },
      {
        title: "La tabla estilo Excel",
        description:
          "La misma forma que ya conocen: ranking, columnas ordenables (click en el encabezado), fila de TOTALES abajo y un puntito de color por cuartil. Click en cualquier fila abre el detalle del chofer.",
        mockup: <MockTabla />,
        hint: "El ◐ al lado de un nombre avisa que entró o salió a mitad de mes (mes parcial), así no lo comparás de más.",
      },
      {
        title: "El detalle del chofer",
        description:
          "El panel lateral muestra todas sus métricas del mes contra el promedio de su flota, el desglose del sueldo y su evolución de 13 meses, con accesos directos a su legajo y a sus viajes.",
        mockup: <MockDrawer />,
      },
    ],
  },
  {
    id: "resumen",
    label: "Resumen",
    icon: <Trophy size={14} />,
    steps: [
      {
        title: "Destacados del mes",
        description:
          "De un vistazo, el mejor y el peor chofer de cada métrica (solo meses completos). Click en un nombre abre su detalle. El ranking formal con score vive en “Ranking de choferes”.",
        mockup: <MockDestacados />,
      },
      {
        title: "Facturación vs costo por km",
        description:
          "El gráfico cruza lo que se factura por km (azul) contra el costo del estudio (rojo). Si la azul queda por debajo de la roja, ese mes el km se facturó por debajo de lo que cuesta.",
        mockup: <MockCostoKm />,
      },
      {
        title: "¿Los aumentos van a la par?",
        description:
          "Lo que entra contra lo que sale, interanual: los aumentos que dan los clientes contra los que se le dan a la gente (choferes y admin/taller juntos), con la inflación del INDEC de referencia. Abajo se escribe la cuenta: los dos porcentajes y cuántos puntos de diferencia hay.",
        mockup: <MockParidad />,
        hint: "Se marca en verde si van a la par (menos de 3 puntos de diferencia) y en rojo si los sueldos se despegaron por encima.",
      },
      {
        title: "Cargar un aumento",
        description:
          "Con “Cargar aumento” registrás una suba de tarifa: el cliente, desde cuándo rige, el % y una nota. Queda como contexto de la facturación y alimenta la comparación de paridad. El tacho de la tabla mes a mes elimina cualquiera.",
        mockup: <MockCargarAumento />,
      },
    ],
  },
  {
    id: "comparar",
    label: "Comparar y exportar",
    icon: <FileSpreadsheet size={14} />,
    steps: [
      {
        title: "Comparar contra otro mes",
        description:
          "Con “Comparar con…” elegís cualquier otro mes (cargado o en vivo). La comparación aparece en los KPIs y suma dos columnas violeta en las tablas: el valor de ese mes y el Δ contra el que estás viendo.",
        mockup: <MockComparar />,
      },
      {
        title: "La planilla anual (Evolución)",
        description:
          "La pestaña Evolución arma los últimos 13 meses como en el Excel anual: una fila por mes con todas las métricas juntas. Ideal para ver la tendencia larga de un solo tirón.",
        mockup: <MockEvolucion />,
      },
      {
        title: "Exportar a Excel o PDF",
        description:
          "El botón verde “Exportar” abre el checklist: marcás qué planillas querés y las bajás en Excel (todas juntas en un archivo o una por archivo) o las imprimís/guardás en PDF, con una planilla por página.",
        mockup: <MockExport />,
      },
      {
        title: "Confidencial: solo admins",
        description:
          "Métricas es una sección confidencial. Por defecto entra solo el Administrador: facturación, sueldos y márgenes no se muestran a los demás roles, aunque tengan Edición en otras áreas.",
        mockup: <MockConfidencial />,
        hint: "El candado se administra desde Usuarios → Secciones confidenciales.",
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Métricas históricas" tabs={TABS} />;
}
