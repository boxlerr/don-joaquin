"use client";

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import {
  Plus,
  Upload,
  Search,
  Eye,
  FileDown,
  Fuel,
  Wrench,
  Receipt,
  Truck,
  Container,
  Building2,
  Camera,
  Star,
  FileText,
  CheckCircle2,
  X,
  Activity,
  Route,
  Package,
  DollarSign,
  Briefcase,
  Users,
  CircleDot,
  Gauge,
} from "lucide-react";

// =============================================================================
// Helpers de mockup (todo a nivel de módulo, nunca dentro de un componente)
// =============================================================================

function MockField({
  label,
  value,
  required,
  icon,
}: {
  label: string;
  value: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[11px] rounded border bg-card text-foreground inline-flex items-center gap-1.5 w-full " +
          (required ? "border-[#0088D1]/60" : "border-border")
        }
      >
        {icon && <span className="text-primary">{icon}</span>}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function ResumenItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-[11px] font-semibold text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

function KpiChip({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-md px-2 py-1.5">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon size={11} className="text-muted-foreground/70" />
        <span className="text-[9px] text-muted-foreground/70 truncate">{label}</span>
      </div>
      <div className={"text-[13px] font-bold leading-none " + color}>{value}</div>
      {sub && <div className="text-[8px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

function FilaMov({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      {icon}
      <span className="text-foreground flex-1 truncate">{label}</span>
      {value}
    </div>
  );
}

function MockToolbar({ highlight }: { highlight: "new" | "import" }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-all " +
          (highlight === "import"
            ? "bg-card border-2 border-[#0088D1] text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.2)] scale-105"
            : "bg-card border border-border text-muted-foreground opacity-50")
        }
      >
        <Upload size={12} /> Importar
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <FileDown size={12} /> Exportar
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <Fuel size={12} /> Cargar gasoil
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <Wrench size={12} /> Registrar service
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <Receipt size={12} /> Registrar gasto
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-all " +
          (highlight === "new"
            ? "bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105"
            : "bg-[#0088D1] text-white opacity-50")
        }
      >
        <Plus size={12} /> Agregar camión
      </div>
    </div>
  );
}

function MockNewCamionForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Agregar nuevo camión</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Patente *" value="AB123CD" required />
          <MockField label="Estado *" value="Activo" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Marca *" value="Scania" required />
          <MockField label="Modelo *" value="R450" required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MockField label="Año *" value="2020" required />
          <MockField label="Cap. TN *" value="35.0" required />
          <MockField label="Tipo" value="Tractor" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Tercerización" value="Tercerizado" icon={<Building2 size={11} />} />
          <MockField label="Km actual" value="Opcional" icon={<Gauge size={11} />} />
        </div>
        <label className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#0088D1] bg-[#E1F5FE] text-[11px] font-semibold text-primary w-fit">
          <span className="size-3.5 rounded-[4px] bg-[#0088D1] text-white text-[9px] inline-flex items-center justify-center">✓</span>
          Es tolva
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <div className="h-8 px-3 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center hover:bg-muted/40">
            Cancelar
          </div>
          <div className="h-8 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-bold shadow-sm">
            Guardar camión
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCamionListItem() {
  return (
    <div className="bg-card border border-border rounded-[8px] p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center border border-[#B3E5FC]">
          <Truck size={16} />
        </span>
        <div>
          <div className="text-foreground font-mono font-semibold text-sm">AB123CD</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Scania R450 — 2020</div>
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-2 py-0.5">
        Activo
      </span>
    </div>
  );
}

function MockImportSelect() {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="px-3 py-2 border-b border-border text-foreground text-xs font-semibold">
        Importar camiones
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] text-muted-foreground">
          Subí un .xlsx o .csv. Única columna obligatoria: <b>Patente</b>. También lee Marca, Modelo, Año, Capacidad TN, Tipo, Estado, Tercerización, Tolva y Km Actual.
        </div>
        <div className="h-8 px-2 rounded border border-dashed border-[#94A3B8] text-[11px] text-muted-foreground bg-muted/40 inline-flex items-center gap-2 w-full">
          <Upload size={12} className="text-primary" /> mi-flota.xlsx
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-7 px-2 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center">
            Cancelar
          </div>
          <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold gap-1">
            <Upload size={11} /> Analizar archivo
          </div>
        </div>
      </div>
    </div>
  );
}

function MockImportPreview() {
  const rows = [
    { ok: true, patente: "AB123CD", marca: "Scania R450", tolva: true, err: "" },
    { ok: true, patente: "CD456EF", marca: "Mercedes Actros", tolva: false, err: "" },
    { ok: false, patente: "", marca: "Volvo FH16", tolva: false, err: "Falta patente" },
    { ok: false, patente: "XY", marca: "Iveco", tolva: false, err: "Capacidad inválida" },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <div className="px-3 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2 text-[11px] flex-wrap">
        <span className="text-[#059669] font-bold">2 válidas</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[#DC2626] font-bold">2 con error</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[#0369A1] font-bold">1 tolva</span>
      </div>
      <div className="text-[10px] font-mono">
        {rows.map((r, i) => (
          <div
            key={i}
            className={
              "flex items-center gap-2 px-3 py-1.5 border-b border-border last:border-b-0 " +
              (r.ok ? "" : "bg-[#FEF2F2]")
            }
          >
            {r.ok ? (
              <CheckCircle2 size={12} className="text-[#10B981]" />
            ) : (
              <X size={12} className="text-red-500" />
            )}
            <span className="text-muted-foreground w-5">{i + 2}</span>
            <span className="font-semibold text-foreground w-[68px] truncate">{r.patente || "—"}</span>
            <span className="text-muted-foreground flex-1 truncate">{r.marca}</span>
            {r.tolva && <span className="text-[9px] text-[#0369A1] font-sans font-semibold">tolva</span>}
            {r.err && <span className="text-red-600 text-[9px] font-sans">{r.err}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockImportConfirm() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2">
      <div className="flex justify-end gap-2">
        <div className="h-7 px-2 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center">
          Volver
        </div>
        <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold gap-1 shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-2 ring-[#0088D1]">
          <Upload size={11} /> Confirmar 2 registros
        </div>
      </div>
      <div className="rounded-md bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] text-[#075985] p-2">
        <b>2</b> importados, <b>2</b> omitidos.
      </div>
    </div>
  );
}

function MockVistaToggle() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="size-8 rounded-lg bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Truck size={16} />
        </span>
        <div>
          <div className="text-foreground text-[13px] font-bold leading-none">Chasis</div>
          <div className="text-[10px] text-muted-foreground mt-1">Mostrando 10 de 10 unidades</div>
        </div>
      </div>
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        <span className="px-3 h-7 text-[11px] font-semibold rounded-md bg-card text-primary shadow-sm inline-flex items-center gap-1.5">
          <Truck size={12} /> Chasis (10)
        </span>
        <span className="px-3 h-7 text-[11px] font-medium rounded-md text-muted-foreground inline-flex items-center gap-1.5">
          <Container size={12} /> Acoplados (6)
        </span>
      </div>
    </div>
  );
}

function MockFiltroTerc() {
  const opts = [
    { label: "Todas las tercerizaciones", n: 10, active: false },
    { label: "Internos", n: 6, active: true },
    { label: "En transición", n: 2, active: false },
    { label: "Tercerizados", n: 2, active: false },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm w-full max-w-[260px] mx-auto">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
        <Building2 size={13} className="text-primary" /> Filtrar por tercerización
      </div>
      <div className="p-1.5 space-y-0.5">
        {opts.map((o) => (
          <div
            key={o.label}
            className={
              "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] " +
              (o.active ? "bg-[#E1F5FE] text-primary font-semibold" : "text-foreground")
            }
          >
            <span>{o.label}</span>
            <span className={"text-[10px] tabular-nums " + (o.active ? "text-primary" : "text-muted-foreground")}>
              {o.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockBuscarYAbrir() {
  return (
    <div className="space-y-2.5">
      <div className="h-9 px-2.5 rounded-lg border border-[#0088D1] bg-card inline-flex items-center gap-2 w-full shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
        <Search size={13} className="text-primary" />
        <span className="text-[11px] text-foreground">AB123</span>
        <span className="w-px h-3.5 bg-[#0088D1]/40 animate-pulse" />
        <span className="text-[10px] text-muted-foreground ml-auto">patente o chofer</span>
      </div>
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-3 py-2 grid grid-cols-[1fr,1fr,56px] gap-2 items-center bg-[#E1F5FE] ring-2 ring-[#0088D1]">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-full bg-card text-primary inline-flex items-center justify-center border border-[#B3E5FC]">
              <Truck size={12} />
            </span>
            <span className="text-[11px] font-mono font-semibold text-foreground">AB123CD</span>
          </div>
          <span className="text-[11px] text-muted-foreground truncate">Scania R450</span>
          <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-1.5 py-0.5 text-center">
            Activo
          </span>
        </div>
        <div className="px-3 py-1.5 border-t border-border text-[10px] text-primary text-center font-semibold">
          ↓ Se abre el panel de la unidad
        </div>
      </div>
    </div>
  );
}

const PANEL_TABS = [
  { label: "Información", icon: <Truck size={11} /> },
  { label: "Métricas", icon: <Activity size={11} /> },
  { label: "Choferes", icon: <Users size={11} /> },
  { label: "Fotos", icon: <Camera size={11} /> },
  { label: "Services", icon: <Wrench size={11} /> },
  { label: "Roturas", icon: <CircleDot size={11} /> },
  { label: "Gasoil", icon: <Fuel size={11} /> },
  { label: "Gastos", icon: <Receipt size={11} /> },
  { label: "Documentos", icon: <FileText size={11} /> },
];

function MockTabsPanel() {
  return (
    <div className="bg-card border border-border rounded-md p-3">
      <div className="flex flex-wrap gap-1.5">
        {PANEL_TABS.map((t, i) => (
          <span
            key={t.label}
            className={
              "inline-flex items-center gap-1 px-2 h-6 rounded-md text-[10px] font-medium border " +
              (i === 0
                ? "bg-[#E1F5FE] text-primary border-[#B3E5FC] font-semibold"
                : "bg-card text-muted-foreground border-border")
            }
          >
            {t.icon}
            {t.label}
          </span>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-border text-[10px] text-muted-foreground text-center">
        9 solapas — de los datos a la documentación de la unidad
      </div>
    </div>
  );
}

function MockInfoResumen() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center border border-[#B3E5FC]">
            <Truck size={15} />
          </span>
          <div>
            <div className="text-foreground font-mono font-semibold text-[12px] leading-none">AB123CD</div>
            <div className="text-[9px] text-muted-foreground mt-1">Scania R450 · 2020</div>
          </div>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-2 py-0.5">
          Activo
        </span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        <ResumenItem icon={<Users size={11} />} label="Chofer" value="Asignado" />
        <ResumenItem icon={<Container size={11} />} label="Acoplado" value="CD456EF" />
        <ResumenItem icon={<Building2 size={11} />} label="Tercerización" value="Tercerizado" />
        <ResumenItem icon={<Gauge size={11} />} label="Km actual" value="182.400" />
      </div>
    </div>
  );
}

const METRICAS_KPIS: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}[] = [
  { icon: Briefcase, label: "Viajes", value: "24", color: "text-primary" },
  { icon: Route, label: "Km", value: "9.850", sub: "12% vacíos", color: "text-foreground" },
  { icon: Package, label: "Toneladas", value: "612", color: "text-foreground" },
  { icon: DollarSign, label: "Facturación", value: "$ 4,2 M", color: "text-[#10B981]" },
  { icon: Wrench, label: "Taller", value: "1", color: "text-[#F59E0B]" },
  { icon: Fuel, label: "Gasoil", value: "3.100 L", color: "text-foreground" },
];

function MockMetricas() {
  const barras = [40, 55, 48, 70, 62, 95];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {METRICAS_KPIS.map((k) => (
          <KpiChip key={k.label} icon={k.icon} label={k.label} value={k.value} sub={k.sub} color={k.color} />
        ))}
      </div>
      <div className="bg-card border border-border rounded-md p-3">
        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-foreground">
          <Activity size={12} className="text-muted-foreground" /> Km — últimos 6 meses
        </div>
        <div className="flex items-end gap-1.5 h-14">
          {barras.map((h, i) => (
            <div
              key={i}
              className={"flex-1 rounded-t-[2px] " + (i === barras.length - 1 ? "bg-primary" : "bg-muted-foreground/25")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MockOperacion() {
  return (
    <div className="bg-card border border-border rounded-md divide-y divide-border text-[11px]">
      <FilaMov
        icon={<Camera size={12} className="text-primary" />}
        label="3 fotos"
        value={
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded px-1.5 py-0.5">
            <Star size={8} className="fill-[#F59E0B] text-[#F59E0B]" /> Principal
          </span>
        }
      />
      <FilaMov
        icon={<Wrench size={12} className="text-primary" />}
        label="Mantenimiento preventivo"
        value={<span className="font-semibold text-foreground">$ 150.000</span>}
      />
      <FilaMov
        icon={<Fuel size={12} className="text-primary" />}
        label="300 L — gasoil"
        value={<span className="font-semibold text-foreground">$ 120.000</span>}
      />
      <FilaMov
        icon={<Receipt size={12} className="text-primary" />}
        label="Peaje"
        value={<span className="font-semibold text-foreground">$ 8.500</span>}
      />
      <FilaMov
        icon={<CircleDot size={12} className="text-[#F59E0B]" />}
        label="Roturas — 2 gomas"
        value={<span className="text-[9px] text-muted-foreground">desde Mantenimiento</span>}
      />
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> Seguro
        </span>
        <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-2 py-0.5">
          Vigente
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> VTV
        </span>
        <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-full px-2 py-0.5">
          Vence en 15 días
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> RTO
        </span>
        <span className="text-[10px] text-[#7F1D1D] bg-[#FEF2F2] border border-[#FECACA] rounded-full px-2 py-0.5">
          Vencido
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Solapas del tutorial
// =============================================================================

const TABS: TutorialTab[] = [
  {
    id: "manual",
    label: "Cargar manual",
    icon: <Plus size={14} />,
    steps: [
      {
        title: 'Abrí "Agregar camión"',
        description:
          'Arriba a la derecha, el botón azul "+ Agregar camión" (aparece solo si tenés permiso de edición en Flota). Se abre un formulario centrado.',
        mockup: <MockToolbar highlight="new" />,
      },
      {
        title: "Completá los datos del vehículo",
        description:
          "Patente, marca, modelo, año y capacidad (TN) son obligatorios. Elegís el tipo (tractor, chasis rígido, batea u otro), el estado (arranca en Activo) y la tercerización. El km actual es opcional.",
        mockup: <MockNewCamionForm />,
        hint: (
          <>
            Marcá <b>&quot;Es tolva&quot;</b> si la unidad descarga por tolva. La marca autocompleta la tercerización
            (Scania → tercerizado, Iveco → en transición, el resto → interno), pero la podés cambiar. La patente se
            guarda siempre en mayúsculas.
          </>
        ),
      },
      {
        title: "Guardá y listo",
        description:
          'Apretá "Guardar camión". Ves un mensaje verde de confirmación, el formulario se cierra solo y la unidad aparece en la lista ordenada por patente, con su estado.',
        mockup: <MockCamionListItem />,
      },
    ],
  },
  {
    id: "import",
    label: "Importar Excel",
    icon: <Upload size={14} />,
    steps: [
      {
        title: 'Abrí "Importar"',
        description:
          'En la barra superior, en el grupo junto a "Exportar", está el botón "Importar" (necesitás edición en Flota). Sirve para cargar muchas unidades de un saque.',
        mockup: <MockToolbar highlight="import" />,
      },
      {
        title: "Subí el archivo",
        description:
          "Elegí un .xlsx o .csv. La única columna obligatoria es Patente; además reconoce Marca, Modelo, Año, Capacidad TN, Tipo, Estado, Tercerización, Tolva y Km Actual.",
        mockup: <MockImportSelect />,
        hint: (
          <>
            Para <b>tipo</b> usá:{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">tractor</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">chasis_rigido</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">batea</code> u{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">otro</code>. Para{" "}
            <b>estado</b>:{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">activo</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">inactivo</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">en_mantenimiento</code> o{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">baja</code>.
          </>
        ),
      },
      {
        title: "Revisá la vista previa",
        description:
          "Antes de guardar nada ves una tabla: verde = fila válida, rojo = fila con el motivo del error. Arriba te dice cuántas válidas, cuántas con error y cuántas tolvas detectó.",
        mockup: <MockImportPreview />,
        hint: "Si dejás la Tercerización vacía, se infiere por la marca. Las patentes que en el Excel están resaltadas con color se marcan como tolva automáticamente.",
      },
      {
        title: "Confirmá la importación",
        description:
          'Apretá "Confirmar X registros". Solo entran las filas válidas; las patentes que ya existen se omiten para no duplicar.',
        mockup: <MockImportConfirm />,
        hint: "Si te quedaron filas en rojo, corregilas en el Excel y volvé a importar el archivo entero: las válidas vuelven a entrar y las repetidas se saltean.",
      },
    ],
  },
  {
    id: "lista",
    label: "Buscar y filtrar",
    icon: <Search size={14} />,
    steps: [
      {
        title: "Chasis y acoplados",
        description:
          'La lista tiene dos vistas: "Chasis" y "Acoplados", cada una con su conteo. El encabezado te dice "Mostrando X de Y unidades" según los filtros activos.',
        mockup: <MockVistaToggle />,
      },
      {
        title: "Filtrá por tercerización",
        description:
          "En la vista de chasis, el desplegable filtra por Internos, En transición o Tercerizados, con el conteo de cada grupo al lado.",
        mockup: <MockFiltroTerc />,
      },
      {
        title: "Buscá y abrí el detalle",
        description:
          "El buscador filtra por patente o por nombre del chofer asignado. Cada fila es clickeable: al tocarla se abre el panel completo de la unidad.",
        mockup: <MockBuscarYAbrir />,
      },
    ],
  },
  {
    id: "detalle",
    label: "Detalle del camión",
    icon: <Eye size={14} />,
    steps: [
      {
        title: "El panel y sus 9 solapas",
        description:
          "Al abrir una unidad ves 9 solapas: Información, Métricas, Choferes, Fotos, Services, Roturas, Gasoil, Gastos y Documentos.",
        mockup: <MockTabsPanel />,
      },
      {
        title: "Información: datos, chofer y acoplado",
        description:
          'En "Información" editás todos los datos y ves el chofer asignado, el acoplado vinculado, la tercerización y el km actual. La solapa "Choferes" guarda el historial de quién manejó la unidad, con fechas y motivo.',
        mockup: <MockInfoResumen />,
        hint: "El historial de choferes se registra solo cuando hay rotación (enfermos, roturas): sirve para saber quién usó la unidad en cada periodo.",
      },
      {
        title: "Métricas de la unidad",
        description:
          '"Métricas" resume el mes: viajes, km (con % de vacíos), toneladas, facturación generada, visitas a taller y gasoil. Abajo, la evolución de km de los últimos 6 meses. Con las flechas cambiás de mes.',
        mockup: <MockMetricas />,
      },
      {
        title: "Fotos, services, gasoil, gastos y roturas",
        description:
          "Subís fotos y marcás la principal (queda como avatar en la lista). Cargás services y gasoil, registrás gastos imputados a la unidad, y en Roturas ves las gomas cargadas desde Mantenimiento.",
        mockup: <MockOperacion />,
        hint: "El km se autocompleta con el último registrado. También cargás gasoil, service o un gasto desde los botones de la barra superior, sin abrir el detalle.",
      },
      {
        title: "Documentos con vencimiento",
        description:
          'En "Documentos" cargás VTV, seguro, RTO, etc. Si ponés fecha de vencimiento, el semáforo te avisa cuando se acerca o ya venció, y la unidad aparece en el card de vencimientos de arriba.',
        mockup: <MockDocumentos />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Camiones" tabs={TABS} />;
}
