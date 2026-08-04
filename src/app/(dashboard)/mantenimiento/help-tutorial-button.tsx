"use client";

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import {
  Wrench,
  CircleDot,
  Package,
  BarChart3,
  BellRing,
  Truck,
  User,
  Calendar,
  DollarSign,
  Search,
  Pencil,
  Trash2,
  Plus,
  Clock,
  FileSpreadsheet,
  ArrowRight,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers de mockup (todo a nivel de módulo: nunca definir componentes adentro
// de otro componente ni dentro de un .map()).
// ---------------------------------------------------------------------------

/** Campo simulado de formulario. */
function Field({
  label,
  value,
  icon,
  required,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[10px] rounded border bg-card text-foreground inline-flex items-center gap-1.5 w-full " +
          (required ? "border-primary/60" : "border-border")
        }
      >
        {icon && <span className="text-primary">{icon}</span>}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

/** Barra horizontal simulada para los mini-gráficos. */
function BarRow({ label, pct, value, color }: { label: string; pct: number; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-16 shrink-0 text-foreground truncate">{label}</span>
      <div className="flex-1 h-3 rounded-sm bg-muted overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-14 text-right font-mono font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// ===========================================================================
// TAB 1 — Servicios
// ===========================================================================

function MockTabs() {
  const tabs = [
    { icon: <Wrench size={12} />, label: "Servicios", active: true },
    { icon: <CircleDot size={12} />, label: "Roturas", active: false },
    { icon: <Package size={12} />, label: "Insumos", active: false },
    { icon: <BellRing size={12} />, label: "Alertas", active: false },
    { icon: <BarChart3 size={12} />, label: "Reportes", active: false },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card px-2.5 py-2">
          <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Servicios</div>
          <div className="text-base font-black text-foreground leading-tight">128</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-2.5 py-2">
          <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Roturas</div>
          <div className="text-base font-black text-[#B45309] leading-tight">34</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-2.5 py-2">
          <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Alertas</div>
          <div className="text-base font-black text-[#EF4444] leading-tight">5</div>
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <span
            key={t.label}
            className={
              "inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium border-b-2 -mb-px whitespace-nowrap " +
              (t.active ? "border-[#0088D1] text-[#0088D1]" : "border-transparent text-muted-foreground")
            }
          >
            {t.icon}
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MockServicioForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Wrench size={13} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Cargar servicio</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Unidad" value="AB 123 CD" icon={<Truck size={10} />} required />
          <Field label="Tipo de servicio" value="Cambio de aceite" required />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Fecha" value="20/05" icon={<Calendar size={10} />} required />
          <Field label="KM" value="184.520" required />
          <Field label="Costo" value="$ 150k" icon={<DollarSign size={10} />} />
        </div>
        <div className="flex justify-end pt-1.5 border-t border-border">
          <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            Registrar servicio
          </div>
        </div>
      </div>
    </div>
  );
}

function MockProximoService() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Próximo service <span className="font-normal normal-case">(genera alerta)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha estimada" value="20/11/2026" icon={<Calendar size={10} />} />
          <Field label="KM estimado" value="204.520" />
        </div>
        <div className="text-[9px] text-primary/80">Calculado según el intervalo del servicio — editable.</div>
      </div>
      <div className="flex justify-center">
        <ArrowRight size={14} className="rotate-90 text-primary" />
      </div>
      <div className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/5 px-3 py-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F59E0B]/10 text-[#B45309] px-2 py-0.5 text-[10px] font-semibold">
          <AlertTriangle size={10} /> Por vencer
        </span>
        <span className="text-[10px] text-foreground">Aparece solo en la solapa Alertas.</span>
      </div>
    </div>
  );
}

const SERVICIO_ROWS = [
  { f: "20/05", s: "Cambio de aceite", u: "AB 123 CD", km: "184.520", c: "$ 150.000" },
  { f: "12/05", s: "Gomería", u: "CD 456 EF", km: "—", c: "$ 90.000" },
];

function MockServiciosTabla() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[36px_1fr_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
        <span>Fecha</span>
        <span>Servicio / Unidad</span>
        <span>Costo</span>
      </div>
      {SERVICIO_ROWS.map((r, i) => (
        <div
          key={r.u}
          className={`grid grid-cols-[36px_1fr_auto] gap-2 items-center px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <span className="text-[9px] text-muted-foreground">{r.f}</span>
          <span className="min-w-0">
            <span className="block text-[11px] text-foreground truncate">{r.s}</span>
            <span className="text-[9px] text-muted-foreground font-mono">
              {r.u} · {r.km} km
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-foreground">{r.c}</span>
            <Pencil size={11} className="text-muted-foreground" />
            <Trash2 size={11} className="text-destructive" />
          </span>
        </div>
      ))}
      <div className="px-3 py-1.5 border-t border-border bg-[#F0F9FF] text-[10px] text-[#075985] flex items-center gap-1.5">
        <Pencil size={11} className="text-primary" /> Tocá la fila para editar. Al borrar, se saca también su gasto en Caja.
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Roturas
// ===========================================================================

function MockRoturaForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#FEF3C7] text-[#B45309] inline-flex items-center justify-center">
          <CircleDot size={13} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Registrar rotura</span>
      </div>
      <div className="p-3 space-y-2.5">
        <Field label="Qué se rompió" value="Goma / cubierta" icon={<CircleDot size={10} />} required />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Marca" value="Michelin" />
          <Field label="Cantidad" value="2" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Chofer" value="Paterno, Luis" icon={<User size={10} />} />
          <Field label="Unidad" value="AB 123 CD" icon={<Truck size={10} />} />
        </div>
      </div>
    </div>
  );
}

function MockInsumoCosto() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/5 px-3 py-2.5">
        <div className="text-[9px] font-bold uppercase text-[#B45309]">Insumo del catálogo</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground">
          <CircleDot size={12} className="text-[#B45309]" /> Goma 295/80
        </div>
      </div>
      <ArrowRight size={16} className="text-primary shrink-0" />
      <div className="flex-1 rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-2.5">
        <div className="text-[9px] font-bold uppercase text-primary">Costo (se trae solo)</div>
        <div className="mt-1 text-sm font-mono font-bold text-primary">$ 850.000</div>
        <div className="text-[8px] text-muted-foreground">editable</div>
      </div>
    </div>
  );
}

function MockGravedad() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground">
          <User size={11} className="text-primary" /> Paterno, Luis
        </span>
        <span className="text-[9px] text-muted-foreground">suma a su productividad</span>
      </div>
      <div className="rounded-lg border border-border bg-card px-3 py-2 space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Gravedad</div>
        <div className="flex gap-2">
          <span className="flex-1 text-center rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
            Leve
          </span>
          <span className="flex-1 text-center rounded-md border-2 border-[#EF4444]/50 bg-[#FEF2F2] px-2 py-1 text-[10px] font-semibold text-[#991B1B]">
            Grave
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Una rotura grave penaliza más en el score del chofer. En gomas y llantas no se pregunta.
      </div>
    </div>
  );
}

const ROTURA_BARS = [
  { n: "Paterno", pct: 92, v: "5" },
  { n: "Albornoz", pct: 58, v: "3" },
  { n: "Heim", pct: 34, v: "2" },
];

function MockRoturasChart() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#B45309]">
        <CircleDot size={12} /> Roturas por chofer (últimos 6 meses)
      </div>
      <div className="space-y-2">
        {ROTURA_BARS.map((b) => (
          <BarRow key={b.n} label={b.n} pct={b.pct} value={b.v} color="#F59E0B" />
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 3 — Insumos
// ===========================================================================

const INSUMO_KPIS = [
  { l: "Insumos activos", v: "42", icon: <Package size={13} />, cls: "bg-primary/10 text-primary" },
  { l: "Precio promedio", v: "$ 120k", icon: <DollarSign size={13} />, cls: "bg-emerald-100 text-emerald-700" },
  { l: "Desactualizados", v: "3", icon: <Clock size={13} />, cls: "bg-amber-100 text-amber-700" },
  { l: "Sin precio", v: "1", icon: <DollarSign size={13} />, cls: "bg-rose-100 text-rose-700" },
];

function MockInsumosKpis() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {INSUMO_KPIS.map((k) => (
        <div key={k.l} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
          <span className={`size-7 rounded-lg inline-flex items-center justify-center shrink-0 ${k.cls}`}>{k.icon}</span>
          <div className="min-w-0">
            <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground truncate">{k.l}</div>
            <div className="text-sm font-black text-foreground leading-tight">{k.v}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockInsumoEdit() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
          <span>Insumo</span>
          <span className="w-16">Marca</span>
          <span className="w-16 text-right">Precio</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2">
          <span className="text-[11px] text-foreground truncate">Goma / cubierta</span>
          <span className="w-16 text-[10px] text-muted-foreground truncate">Michelin</span>
          <span className="w-16 flex justify-end">
            <span className="inline-flex items-center rounded border-2 border-primary/60 bg-card px-1.5 py-0.5 text-[10px] font-mono text-foreground ring-2 ring-primary/15">
              $ 850k
            </span>
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-2 border-t border-border">
          <span className="text-[11px] text-foreground truncate">Espejo</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-block h-4 w-7 rounded-full bg-emerald-500">
              <span className="absolute right-0.5 top-0.5 size-3 rounded-full bg-white" />
            </span>
            <span className="text-[9px] font-medium text-emerald-700">Activo</span>
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Tocá cualquier celda (nombre, marca o precio) y editás al toque. Enter guarda, Esc cancela. El switch activa o desactiva el insumo.
      </div>
    </div>
  );
}

function MockDesactualizado() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5">
        <Clock size={14} className="mt-0.5 text-[#B45309] shrink-0" />
        <p className="text-[10px] text-[#92400E]">
          Hay <b>3</b> insumos con el precio sin actualizar hace tiempo. Refrescalos y el costo por chofer queda confiable.
        </p>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 text-[10px]">
          <span className="text-foreground">Lámpara H7</span>
          <span className="text-muted-foreground font-mono">$ 12.000</span>
          <span className="inline-flex items-center rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide">
            Desactualizado
          </span>
        </div>
      </div>
    </div>
  );
}

function MockInsumosToolbar() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 rounded-md border border-border bg-card px-2 h-8">
          <Search size={12} className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Buscar por nombre o marca…</span>
        </div>
        <div className="h-8 px-2.5 rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 text-[10px] font-bold">
          <Plus size={11} /> Agregar insumo
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            Insumo <ChevronsUpDown size={9} className="text-muted-foreground/60" />
          </span>
          <span className="inline-flex items-center gap-1">
            Precio <ChevronDown size={9} className="text-primary" />
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-2">
          <span className="text-[10px] text-foreground">Espejo</span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-foreground">$ 45.000</span>
            <Trash2 size={11} className="text-destructive" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 4 — Alertas y Reportes
// ===========================================================================

const ALERTA_ROWS = [
  { estado: "vencido", u: "AB 123 CD", s: "Cambio de aceite", falta: "3 d atrás" },
  { estado: "por", u: "CD 456 EF", s: "VTV", falta: "12 d" },
];

function MockAlertas() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <div className="text-[11px] font-bold text-foreground">Próximos services</div>
        <div className="text-[9px] text-muted-foreground">Vencen en ≤30 días o ≤5.000 km</div>
      </div>
      {ALERTA_ROWS.map((a, i) => (
        <div
          key={a.u}
          className={`grid grid-cols-[auto_1fr_auto] gap-2 items-center px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold " +
              (a.estado === "vencido" ? "bg-[#EF4444]/10 text-[#EF4444]" : "bg-[#F59E0B]/10 text-[#F59E0B]")
            }
          >
            <AlertTriangle size={9} /> {a.estado === "vencido" ? "Vencido" : "Por vencer"}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] text-foreground truncate">{a.s}</span>
            <span className="text-[9px] font-mono text-muted-foreground">{a.u}</span>
          </span>
          <span className="text-[9px] text-muted-foreground">{a.falta}</span>
        </div>
      ))}
    </div>
  );
}

const COSTO_BARS = [
  { n: "Paterno", pct: 92, v: "1,1M" },
  { n: "Albornoz", pct: 58, v: "690k" },
  { n: "Heim", pct: 34, v: "410k" },
];

function MockCostoChofer() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
        <DollarSign size={12} /> Costo de repuestos por chofer
      </div>
      <div className="space-y-2">
        {COSTO_BARS.map((b) => (
          <BarRow key={b.n} label={b.n} pct={b.pct} value={`$ ${b.v}`} color="#10B981" />
        ))}
      </div>
    </div>
  );
}

const TALLER_BARS = [
  { n: "AB 123 CD", pct: 88, v: "7" },
  { n: "CD 456 EF", pct: 50, v: "4" },
  { n: "EF 789 GH", pct: 25, v: "2" },
];

function MockTallerUnidad() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
        <BarChart3 size={12} /> Visitas a taller por unidad
      </div>
      <div className="space-y-2">
        {TALLER_BARS.map((b) => (
          <BarRow key={b.n} label={b.n} pct={b.pct} value={b.v} color="#0088D1" />
        ))}
      </div>
      <div className="text-[9px] text-muted-foreground">Misma métrica que penaliza el ranking de choferes.</div>
    </div>
  );
}

const EXPORT_VISTAS = [
  { l: "Insumos", icon: <Package size={11} /> },
  { l: "Servicios", icon: <Wrench size={11} /> },
  { l: "Roturas", icon: <CircleDot size={11} /> },
  { l: "Reportes por unidad", icon: <BarChart3 size={11} /> },
  { l: "Costo por chofer", icon: <DollarSign size={11} /> },
];

function MockExport() {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="h-8 px-2.5 rounded-md border border-border bg-card inline-flex items-center gap-1.5 text-[10px] font-medium text-foreground">
          <FileSpreadsheet size={12} className="text-[#10B981]" /> Exportar <ChevronDown size={11} className="text-muted-foreground" />
        </div>
      </div>
      <div className="ml-auto w-full max-w-[210px] rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold text-foreground">
          <Layers size={12} className="text-primary" /> Todo junto (Excel completo)
        </div>
        <div className="px-3 py-1 text-[8px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-y border-border">
          Una sola vista
        </div>
        {EXPORT_VISTAS.map((v) => (
          <div
            key={v.l}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/60 first:border-t-0"
          >
            <span className="text-muted-foreground/70">{v.icon}</span> {v.l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "servicios",
    label: "Servicios",
    icon: <Wrench size={14} />,
    steps: [
      {
        title: "Todo el mantenimiento, en cinco solapas",
        description:
          "Servicios, Roturas, Insumos, Alertas y Reportes. Arriba tenés las tarjetas con el total de services, roturas y alertas, y los botones para cargar y exportar.",
        mockup: <MockTabs />,
      },
      {
        title: "Cargá un service o reparación",
        description:
          "Con «Cargar servicio» registrás el service o reparación de un camión o acoplado: unidad, tipo, fecha, KM y costo. El costo queda registrado en Caja.",
        mockup: <MockServicioForm />,
        hint: "Si el camión está tercerizado (Scania), el form solo deja cargar gomería y cubiertas: el resto lo controla la concesionaria. El acoplado no lleva KM.",
      },
      {
        title: "El próximo service se avisa solo",
        description:
          "Si cargás el próximo KM o la próxima fecha, se genera solo el aviso en Alertas. Según el tipo de servicio se calcula por defecto, y lo podés editar.",
        mockup: <MockProximoService />,
      },
      {
        title: "El listado: editar y borrar",
        description:
          "Cada servicio se ve con su fecha, unidad, taller, KM y costo. Tocá la fila (o el lápiz) para editarlo y el tacho para borrarlo. Si tenía un gasto en Caja, también se elimina.",
        mockup: <MockServiciosTabla />,
        hint: "También podés adjuntar la factura, el remito o una foto al cargar o editar el servicio.",
      },
    ],
  },
  {
    id: "roturas",
    label: "Roturas",
    icon: <CircleDot size={14} />,
    steps: [
      {
        title: "Anotá una rotura imprevista",
        description:
          "Con «Registrar rotura» cargás lo que se rompió fuera de programa: goma, espejo, óptica, guardabarros, etc. Elegís qué rompió, la marca, la cantidad y (opcional) el chofer y la unidad.",
        mockup: <MockRoturaForm />,
      },
      {
        title: "Elegí el insumo y el costo se trae solo",
        description:
          "Al elegir un insumo del catálogo, el costo se completa solo con su precio de referencia y queda editable por si esta vez salió distinto.",
        mockup: <MockInsumoCosto />,
        hint: "Si no está en el catálogo, elegí «Otro…» y escribís qué se rompió a mano.",
      },
      {
        title: "Chofer y gravedad",
        description:
          "Si cargás el chofer, la rotura suma a su productividad. En roturas que no son gomas ni llantas marcás si fue leve o grave: la grave penaliza más en el score del chofer.",
        mockup: <MockGravedad />,
      },
      {
        title: "Quién rompe más",
        description:
          "Arriba de la tabla, un gráfico ordena las roturas por chofer de los últimos 6 meses (top 10). Cada rotura se puede editar o borrar desde la fila.",
        mockup: <MockRoturasChart />,
      },
    ],
  },
  {
    id: "insumos",
    label: "Insumos",
    icon: <Package size={14} />,
    steps: [
      {
        title: "El catálogo de precios",
        description:
          "El listado de insumos comunes (gomas, lámparas, espejos…) con su marca y precio de referencia. Arriba, cuatro indicadores: activos, precio promedio, desactualizados y sin precio.",
        mockup: <MockInsumosKpis />,
      },
      {
        title: "Editá cualquier celda al toque",
        description:
          "Tocá el nombre, la marca o el precio y lo editás en la misma tabla, sin ventanas. Enter guarda, Esc cancela. El switch de Estado activa o desactiva el insumo.",
        mockup: <MockInsumoEdit />,
      },
      {
        title: "Precios que quedaron viejos",
        description:
          "Cuando un precio lleva mucho sin tocarse, aparece el aviso «Desactualizado». Refrescalo tocando la celda: así el costo por chofer de los reportes queda confiable.",
        mockup: <MockDesactualizado />,
      },
      {
        title: "Buscar, ordenar y agregar",
        description:
          "Buscás por nombre o marca, ordenás tocando cualquier columna y agregás uno nuevo con «Agregar insumo». El tacho lo borra; si el insumo está en uso, te ofrece desactivarlo para no perder el historial.",
        mockup: <MockInsumosToolbar />,
      },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: <BarChart3 size={14} />,
    steps: [
      {
        title: "Alertas: próximos services",
        description:
          "La solapa Alertas junta las unidades con un próximo service cargado que vence pronto (≤30 días o ≤5.000 km), marcadas como «Por vencer» o «Vencido».",
        mockup: <MockAlertas />,
      },
      {
        title: "Costo de repuestos por chofer",
        description:
          "En Reportes, el sistema arma solo cuánto costó en repuestos cada chofer en los últimos 6 meses (top 10), con su gráfico y su tabla. Sale de las roturas con costo cargado.",
        mockup: <MockCostoChofer />,
      },
      {
        title: "Visitas a taller por unidad",
        description:
          "El segundo reporte cuenta las reparaciones y gomería por unidad en los últimos 6 meses. Es la misma métrica que penaliza el ranking de choferes.",
        mockup: <MockTallerUnidad />,
      },
      {
        title: "Exportá a Excel",
        description:
          "Desde «Exportar» bajás una sola vista (Insumos, Servicios, Roturas, Reportes por unidad o Costo por chofer) o todo junto en un Excel con una hoja por vista, con el diseño de siempre.",
        mockup: <MockExport />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Mantenimiento — guía" tabs={TABS} />;
}
