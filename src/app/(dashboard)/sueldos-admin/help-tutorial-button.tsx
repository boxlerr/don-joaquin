"use client";

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import {
  Wallet,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  Pencil,
  Save,
  ArrowDown,
  Calendar,
  Lock,
  Plus,
  X,
  Trash2,
  Flame,
  Clock,
  Upload,
  CheckCircle2,
  ClipboardPaste,
} from "lucide-react";

// Tutorial de la sección "Sueldos admin y taller" (planilla del personal de
// administración y taller, aumentos e importación desde el Excel de Bárbara).
// Todos los componentes de mockup van a NIVEL DE MÓDULO (nunca anidados).

// ---------------------------------------------------------------------------
// Helpers de mockup
// ---------------------------------------------------------------------------

function SectorChip({ label, tone }: { label: string; tone: "admin" | "taller" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "admin" ? "bg-blue-500" : "bg-orange-500"}`} />
      {label}
    </span>
  );
}

function SectorRow({ nombre, base, total }: { nombre: string; base: string; total: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-1.5 border-t border-border/60 text-[10px]">
      <span className="font-medium text-foreground truncate">{nombre}</span>
      <span className="font-mono text-muted-foreground w-14 text-right">{base}</span>
      <span className="font-mono font-semibold text-foreground w-14 text-right">{total}</span>
    </div>
  );
}

function MatrizCell({ value, highlight }: { value: string; highlight?: boolean }) {
  return (
    <div
      className={`py-1.5 text-[9px] font-mono border-l border-border/40 text-center ${highlight ? "text-primary font-bold bg-primary/5" : "text-foreground"}`}
    >
      {value}
    </div>
  );
}

function AumentoItem({
  mes,
  monto,
  delta,
  vigente,
}: {
  mes: string;
  monto: string;
  delta?: string;
  vigente?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2 ${vigente ? "border-emerald-200/70 bg-emerald-50/40" : "border-border bg-card"}`}
    >
      <div className="flex flex-col items-center w-12 shrink-0 leading-tight">
        <span className="text-[7px] uppercase text-muted-foreground">desde</span>
        <span className="text-[9px] font-semibold capitalize text-foreground text-center">{mes}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-[11px] font-bold text-foreground">{monto}</span>
        {delta && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600">
            <TrendingUp size={10} /> {delta}
          </span>
        )}
        {vigente && (
          <span className="bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded text-[8px] font-semibold">
            vigente
          </span>
        )}
      </div>
      <Trash2 size={11} className="text-muted-foreground/60 shrink-0" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: "green" | "amber";
}) {
  const iconCls =
    tone === "green" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600";
  const subCls = tone === "green" ? "text-emerald-600" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
          {label}
        </span>
        <span className={`p-0.5 rounded ${iconCls}`}>{icon}</span>
      </div>
      <div className="text-[14px] font-black text-foreground mt-0.5">{value}</div>
      <div className={`text-[8px] font-semibold ${subCls}`}>{sub}</div>
    </div>
  );
}

function MatchRow({
  nombre,
  legajo,
  estado,
}: {
  nombre: string;
  legajo: string;
  estado: "auto" | "chofer" | "sin";
}) {
  const badge =
    estado === "auto"
      ? { t: "auto", c: "bg-emerald-500/10 text-emerald-600" }
      : estado === "chofer"
        ? { t: "¿chofer?", c: "bg-amber-500/10 text-amber-600" }
        : { t: "sin match", c: "bg-red-500/10 text-red-600" };
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <span className="w-14 shrink-0 font-mono text-[9px] font-medium text-foreground truncate">
        {nombre}
      </span>
      <span className="flex-1 h-6 rounded border border-border bg-card px-1.5 inline-flex items-center text-[9px] text-muted-foreground truncate">
        {legajo}
      </span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium ${badge.c}`}>
        {badge.t}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 1 — Planilla del mes
// ---------------------------------------------------------------------------

function MockQueEs() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mes</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <Calendar size={12} className="text-primary" /> junio 2026
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SectorChip label="Administración" tone="admin" />
        <SectorChip label="Taller" tone="taller" />
        <span className="text-[10px] text-muted-foreground">personal de oficina y taller</span>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800 px-2.5 py-2 flex items-center gap-1.5">
        <Lock size={12} className="text-amber-600 shrink-0" /> Sección <b>confidencial</b>: la ven solo los administradores.
      </div>
    </div>
  );
}

function MockKpis() {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Total del mes</span>
        <span className="font-mono text-[13px] font-bold text-foreground">$ 41,2M</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Facturación</span>
        <span className="font-mono text-[12px] font-semibold text-foreground">$ 310M</span>
        <Pencil size={10} className="text-primary self-center" />
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Sobre facturación</span>
        <span className="font-mono text-[13px] font-bold text-primary">13,3%</span>
      </span>
    </div>
  );
}

/** Celda de grilla del mockup: como se ve al escribir en la planilla. */
function GridCell({ value, focus, muted }: { value: string; focus?: boolean; muted?: boolean }) {
  return (
    <div
      className={`h-6 rounded px-1.5 flex items-center justify-end font-mono text-[10px] tabular-nums ${
        focus
          ? "border border-[#0088D1] bg-card text-foreground ring-2 ring-[#0088D1]/15"
          : `border border-transparent ${muted ? "text-muted-foreground/40" : "text-foreground"}`
      }`}
    >
      {value}
    </div>
  );
}

function MockFilaEmpleado() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[minmax(46px,1fr)_repeat(4,minmax(0,52px))_16px] gap-1 px-2 py-1 bg-muted text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Empleado</span>
        <span className="text-right">Base</span>
        <span className="text-right">Comis.</span>
        <span className="text-right">Combus.</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      <div className="grid grid-cols-[minmax(46px,1fr)_repeat(4,minmax(0,52px))_16px] gap-1 px-2 py-0.5 items-center border-t border-border/60">
        <span className="text-[10px] font-medium text-foreground truncate">Gómez, Ana</span>
        <GridCell value="3.100.000" />
        <GridCell value="290.000" />
        <GridCell value="100.000" />
        <span className="text-right font-mono text-[10px] font-semibold text-foreground">3.490.000</span>
        <CheckCircle2 size={11} className="text-emerald-600" />
      </div>
      <div className="grid grid-cols-[minmax(46px,1fr)_repeat(4,minmax(0,52px))_16px] gap-1 px-2 py-0.5 items-center border-t border-border/60 bg-[#0088D1]/[0.04]">
        <span className="text-[10px] font-medium text-foreground truncate">Ruiz, Marco</span>
        <GridCell value="2.900.000" />
        <GridCell value="150.000" focus />
        <GridCell value="0" muted />
        <span className="text-right font-mono text-[10px] font-semibold text-foreground">3.050.000</span>
        <span />
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border bg-muted/40 py-1 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-card px-1 text-[8px] font-semibold text-foreground">Tab</kbd> al lado
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-card px-1 text-[8px] font-semibold text-foreground">Enter</kbd> abajo
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-card px-1 text-[8px] font-semibold text-foreground">Esc</kbd> deshace
        </span>
      </div>
    </div>
  );
}

function MockPegar() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-emerald-500/30 bg-card overflow-hidden">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-[9px] font-semibold text-emerald-700">
          <FileSpreadsheet size={11} /> copiado del Excel
        </div>
        <div className="grid grid-cols-3 text-[9px] font-mono text-foreground">
          {["3.100.000", "290.000", "100.000", "2.900.000", "150.000", "0", "2.600.000", "88.000", "40.000"].map((v, i) => (
            <div key={i} className="px-2 py-1 border-t border-border/60 text-right tabular-nums">{v}</div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-primary">
        <ClipboardPaste size={12} /> se pega sobre la primera celda y se guarda solo
      </div>
    </div>
  );
}

function MockBaseInline() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card px-2 py-1.5 flex items-center gap-2">
        <span className="text-[10px] font-medium text-foreground w-20 truncate">Gómez, Ana</span>
        <Clock size={11} className="text-muted-foreground/60" />
        <div className="flex-1">
          <GridCell value="3.100.000" focus />
        </div>
      </div>
      <div className="flex items-center justify-center">
        <ArrowDown size={12} className="text-muted-foreground" />
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-[10px] text-foreground">
        Queda registrado como <b>aumento vigente desde junio 2026</b>, igual que si lo cargaras
        en la pestaña Aumentos.
      </div>
    </div>
  );
}

function MockTablaSectores() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 bg-muted/50 text-[8px] font-bold uppercase text-muted-foreground">
        <span>Empleado</span>
        <span className="w-14 text-right inline-flex items-center justify-end gap-0.5">
          Base <ArrowDown size={9} className="text-foreground" />
        </span>
        <span className="w-14 text-right">Total</span>
      </div>
      <div className="px-3 py-1 bg-blue-50/60 text-[9px] font-bold uppercase tracking-wider text-blue-700">
        Administración · subtotal $ 22,4M
      </div>
      <SectorRow nombre="Gómez, Ana" base="$ 3,1M" total="$ 3,5M" />
      <SectorRow nombre="Ruiz, Marco" base="$ 2,9M" total="$ 3,1M" />
      <div className="px-3 py-1 bg-orange-50/60 text-[9px] font-bold uppercase tracking-wider text-orange-700 border-t border-border">
        Taller · subtotal $ 18,8M
      </div>
      <SectorRow nombre="Sosa, Julio" base="$ 2,6M" total="$ 2,9M" />
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-1.5 border-t border-border bg-muted/40">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
        <span className="w-14" />
        <span className="font-mono font-black text-foreground w-14 text-right text-[10px]">$ 41,2M</span>
      </div>
    </div>
  );
}

function MockFacturacion() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Facturación del mes</span>
          <Receipt size={13} className="text-emerald-600" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[15px] font-black text-foreground">$ 310M</span>
          <span className="bg-blue-50 text-blue-700 border border-blue-200/60 px-1.5 py-0.5 rounded text-[9px] font-semibold">
            del sistema
          </span>
          <span className="ml-auto inline-flex size-6 items-center justify-center rounded-md bg-muted text-primary">
            <Pencil size={11} />
          </span>
        </div>
        <div className="text-[9px] text-muted-foreground mt-1">suma de los viajes del mes</div>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Pencil size={11} className="text-amber-600" /> con el lápiz la pisás a mano →
        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 rounded text-[9px] font-semibold">
          manual
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 2 — Aumentos
// ---------------------------------------------------------------------------

function MockMatriz() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] text-center">
        <div className="bg-muted" />
        <div className="col-span-2 bg-muted py-1 text-[9px] font-bold text-muted-foreground border-l border-border">
          2025
        </div>
        <div className="col-span-2 bg-muted py-1 text-[9px] font-bold text-muted-foreground border-l border-border">
          2026
        </div>
      </div>
      <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] text-center bg-muted/60 border-t border-border">
        <div className="py-1 text-[8px] font-bold uppercase text-muted-foreground text-left pl-2">Empl.</div>
        {["nov", "dic", "ene", "feb"].map((m) => (
          <div
            key={m}
            className="py-1 text-[8px] font-semibold capitalize text-muted-foreground border-l border-border/60"
          >
            {m}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] border-t border-border/60">
        <div className="py-1.5 text-[9px] font-semibold text-foreground text-left pl-2 truncate">Gómez</div>
        <MatrizCell value="2,7M" />
        <MatrizCell value="2,8M" />
        <MatrizCell value="2,9M" />
        <MatrizCell value="3,1M" highlight />
      </div>
      <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] border-t border-border/60">
        <div className="py-1.5 text-[9px] font-semibold text-foreground text-left pl-2 truncate">Ruiz</div>
        <MatrizCell value="—" />
        <MatrizCell value="2,6M" />
        <MatrizCell value="2,6M" />
        <MatrizCell value="2,8M" />
      </div>
    </div>
  );
}

function MockRegistrarAumento() {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Registrar aumento</div>
      <div className="h-7 rounded border border-border bg-card px-2 flex items-center gap-1.5 text-[10px] text-foreground">
        <Calendar size={11} className="text-primary" /> febrero 2026
      </div>
      <div>
        <div className="h-7 rounded border border-border bg-card px-2 flex items-center justify-end text-[10px] font-mono text-foreground">
          $ 3.100.000
        </div>
        <div className="mt-1 text-[10px] font-semibold text-emerald-600 inline-flex items-center gap-1">
          <TrendingUp size={11} /> +8,3% vs anterior
        </div>
      </div>
      <div className="h-7 rounded border border-border bg-card px-2 flex items-center text-[10px] text-muted-foreground">
        Observaciones (opcional)
      </div>
      <div className="flex justify-end">
        <span className="h-7 px-3 rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 text-[10px] font-bold">
          <Save size={11} /> Registrar
        </span>
      </div>
    </div>
  );
}

function MockHistorial() {
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Historial de aumentos</div>
      <AumentoItem mes="feb 2026" monto="$ 3,1M" delta="+8,3%" vigente />
      <AumentoItem mes="dic 2025" monto="$ 2,8M" delta="+7,7%" />
      <AumentoItem mes="ago 2025" monto="$ 2,6M" delta="+10,0%" />
    </div>
  );
}

function MockAgregarMes() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-card border border-primary/40 rounded-md px-2 py-1">
          <Plus size={11} /> Agregar mes
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 text-center bg-muted/60 text-[9px] font-semibold text-muted-foreground">
          <div className="py-1.5 border-r border-border/60 capitalize">ene</div>
          <div className="py-1.5 inline-flex items-center justify-center gap-1">
            <span className="italic capitalize text-muted-foreground/80">feb</span>
            <X size={10} className="text-muted-foreground/60" />
          </div>
        </div>
        <div className="grid grid-cols-2 text-center border-t border-border/60 text-[9px] font-mono">
          <div className="py-1.5 border-r border-border/40 text-foreground">$ 3,1M</div>
          <div className="py-1.5 text-muted-foreground/40">—</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="italic">feb</span> = columna sin datos aún
        </span>
        <span className="inline-flex items-center gap-1">
          <Trash2 size={10} className="text-destructive" /> borra todo el mes
        </span>
      </div>
    </div>
  );
}

function MockMetricasAumentos() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Período</span>
        <span className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          {["Todo", "12m", "6m", "3m"].map((p, i) => (
            <span
              key={p}
              className={`px-1.5 h-4 inline-flex items-center rounded text-[8px] font-medium ${i === 0 ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
            >
              {p}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Inflación INDEC" value="2,1%" sub="acum. +142%" icon={<Flame size={12} />} tone="amber" />
        <MetricCard label="Aumentos" value="+165%" sub="real +9,5%" icon={<TrendingUp size={12} />} tone="green" />
        <MetricCard label="Atrasados" value="2" sub="3+ meses" icon={<Clock size={12} />} tone="amber" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 3 — Importar Excel
// ---------------------------------------------------------------------------

function MockImportBtn() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end">
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-[11px] font-semibold text-primary">
          <Upload size={13} /> Importar Excel
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2.5">
        <span className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center shrink-0">
          <FileSpreadsheet size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-foreground truncate">SUELDOS E INSUMOS.xlsx</div>
          <div className="text-[9px] text-muted-foreground">bloques por mes · sueldo, comisión, combustible, plus YPF, sábados</div>
        </div>
      </div>
    </div>
  );
}

function MockMesesDetectados() {
  return (
    <div className="space-y-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Meses detectados (6)</div>
      <div className="flex flex-wrap gap-1.5">
        {["ene 2026", "feb 2026", "mar 2026", "abr 2026", "may 2026", "jun 2026"].map((m) => (
          <span key={m} className="rounded-md bg-muted px-2 py-1 text-[10px] text-foreground">
            {m}
          </span>
        ))}
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Cada bloque trae su <b>facturación</b> y cuántos empleados carga.
      </div>
    </div>
  );
}

function MockMatchNombres() {
  return (
    <div className="space-y-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Empleados del Excel → legajo</div>
      <div className="rounded-lg border border-border divide-y divide-border">
        <MatchRow nombre="ANA G." legajo="Gómez, Ana · Administración" estado="auto" />
        <MatchRow nombre="SOSA" legajo="Sosa, Julio · Taller" estado="chofer" />
        <MatchRow nombre="R. NN" legajo="No cargar" estado="sin" />
      </div>
    </div>
  );
}

function MockResultado() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 flex items-start gap-2">
        <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <div className="text-[11px] font-semibold text-emerald-700">Importación completada</div>
          <div className="text-[9px] text-emerald-700/90 mt-0.5">6 meses · 34 sueldos base · 34 filas de variables</div>
        </div>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800 px-2.5 py-2">
        Re-importar el mismo mes <b>pisa</b> los valores viejos con los del archivo.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS: TutorialTab[] = [
  {
    id: "planilla",
    label: "Planilla del mes",
    icon: <Wallet size={14} />,
    steps: [
      {
        title: "Qué es y para quién",
        description:
          "La planilla de sueldos del personal de administración y taller. Los choferes no van acá: se liquidan aparte, por viajes. Es una sección confidencial (solo administradores) y arriba elegís el mes que estás viendo.",
        mockup: <MockQueEs />,
        hint: "El mes se cambia con el selector de arriba a la derecha. Cada mes guarda sus propios valores.",
      },
      {
        title: "La línea de arriba",
        description:
          "En un solo renglón: el total de sueldos del mes, la facturación del mes y el porcentaje que los sueldos se llevan de lo facturado. Va arriba de todo para que la planilla entre entera en la pantalla.",
        mockup: <MockKpis />,
      },
      {
        title: "Se escribe en la celda, como en el Excel",
        description:
          "Por empleado: sueldo base, comisión logística, combustible, plus YPF y sábados (las mismas columnas del Excel). Escribís directo en la celda y se guarda solo — no hay que apretar ningún botón. El total se calcula al instante.",
        mockup: <MockFilaEmpleado />,
        hint: "Tab pasa a la celda de al lado, Enter baja una fila y Esc deshace lo que escribiste en esa celda. A la derecha de cada fila una tilde te avisa que quedó guardada.",
      },
      {
        title: "Pegá un bloque entero del Excel",
        description:
          "Si ya tenés los números en la planilla, copiá el bloque (varias filas y columnas juntas) y pegalo sobre la primera celda: se reparte solo y se guarda fila por fila. Si copiaste también el encabezado o la columna de nombres, los descarta.",
        mockup: <MockPegar />,
        hint: "Antes de pegar, ordená la tabla por Empleado (es el orden por defecto) para que las filas coincidan con las del Excel.",
      },
      {
        title: "El sueldo base también se edita ahí",
        description:
          "Escribir un sueldo base nuevo queda registrado como un aumento vigente desde el mes que estás viendo — es lo mismo que cargarlo en la pestaña Aumentos, pero sin salir de la planilla. El ⟳ al costado de la celda abre el historial de esa persona.",
        mockup: <MockBaseInline />,
        hint: "Para dejar un sueldo base en cero hay que borrar el aumento desde el historial: vaciar la celda no lo hace, justamente para que un Supr de más no le ponga el sueldo en cero a nadie.",
      },
      {
        title: "Ordenada por sector, con subtotales",
        description:
          "Las filas se agrupan en Administración y Taller, cada grupo con su subtotal, y abajo el total general. Tocá cualquier encabezado de columna para ordenar por ese valor (de mayor a menor y al revés).",
        mockup: <MockTablaSectores />,
      },
      {
        title: "La facturación del mes",
        description:
          "Sale sola de los viajes del mes (badge «del sistema»). Si el número real es otro, con el lápiz la pisás a mano (badge «manual») y el porcentaje se recalcula contra ese valor. Siempre podés volver a la del sistema.",
        mockup: <MockFacturacion />,
      },
    ],
  },
  {
    id: "aumentos",
    label: "Aumentos",
    icon: <TrendingUp size={14} />,
    steps: [
      {
        title: "La matriz mes a mes",
        description:
          "Como la hoja de aumentos del Excel: cada empleado en una fila y cada mes en una columna, con el sueldo base vigente en ese momento. El año va arriba (2025, 2026…) y el mes abajo. Un «—» es un mes sin dato.",
        mockup: <MockMatriz />,
      },
      {
        title: "Cargá o editá un aumento",
        description:
          "Tocá una celda (o el nombre del empleado) y se abre su ficha: elegís el mes desde el que rige, el nuevo sueldo base y una observación opcional. Antes de guardar te muestra el «% vs el anterior».",
        mockup: <MockRegistrarAumento />,
        hint: "Sirve también para aumentos retroactivos: elegí un mes pasado y el % se compara con la base que había justo antes de ese mes.",
      },
      {
        title: "El historial de cada empleado",
        description:
          "En la misma ficha ves todos sus aumentos, del más nuevo al más viejo, con el salto porcentual de cada uno y el badge «vigente» en el actual. El tacho borra un aumento puntual si te equivocaste.",
        mockup: <MockHistorial />,
      },
      {
        title: "Agregar y eliminar meses",
        description:
          "Con «Agregar mes» sumás una columna nueva a medida que pasa el tiempo (queda en itálica hasta que tenga datos). Pasá el mouse por un mes con datos para borrar todos sus aumentos, o usá la X para quitar una columna vacía.",
        mockup: <MockAgregarMes />,
      },
      {
        title: "Aumentos vs inflación",
        description:
          "Arriba del todo, tarjetas que cruzan tus aumentos con la inflación del INDEC (traída sola): cuánto aumentaste en promedio, si le ganaste a la inflación en términos reales y quiénes están atrasados (3+ meses sin aumento). El período se elige con Todo / 12m / 6m / 3m.",
        mockup: <MockMetricasAumentos />,
        hint: "«Atrasados» no depende del período: siempre mira cuántos meses pasaron desde el último aumento de cada persona.",
      },
    ],
  },
  {
    id: "importar",
    label: "Importar Excel",
    icon: <FileSpreadsheet size={14} />,
    steps: [
      {
        title: "Para qué sirve",
        description:
          "En vez de cargar mes por mes a mano, subís el Excel de sueldos (el de bloques por mes: sueldo, comisión, combustible, plus YPF, sábados y facturación) y el sistema lo carga todo. Botón «Importar Excel» arriba a la derecha.",
        mockup: <MockImportBtn />,
      },
      {
        title: "Analizá el archivo",
        description:
          "Elegís el .xlsx y tocás «Analizar». El sistema detecta los meses del archivo, con su facturación y cuántos empleados trae cada bloque. Todavía no se guarda nada: es solo una vista previa.",
        mockup: <MockMesesDetectados />,
      },
      {
        title: "Revisá el matcheo de nombres",
        description:
          "Cada nombre del Excel se enlaza con un legajo. Verde «auto» = match claro; ámbar «¿chofer?» = una sugerencia para confirmar; rojo «sin match» = elegilo a mano o dejalo en «No cargar». Todo es editable antes de importar.",
        mockup: <MockMatchNombres />,
        hint: "Lo que dejes en «No cargar» simplemente no se guarda; podés re-importar ese mes después, corregido.",
      },
      {
        title: "Confirmá e importá",
        description:
          "Apretás «Importar» y listo: te dice cuántos meses, sueldos base y filas de variables cargó, y qué nombres quedaron sin cargar. Re-importar el mismo mes pisa los valores viejos con los del archivo (es idempotente).",
        mockup: <MockResultado />,
      },
    ],
  },
];

export default function HelpTutorialButton({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <HelpTutorialDialog title="Guía de Sueldos admin y taller" tabs={TABS} triggerClassName={triggerClassName} />
  );
}
