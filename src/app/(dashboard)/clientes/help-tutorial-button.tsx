"use client";

import HelpTutorialDialog, {
  type TutorialTab,
  MockField,
} from "@/components/help/HelpTutorialDialog";
import {
  UserPlus,
  Upload,
  Search,
  Pencil,
  ChevronDown,
  ChevronUp,
  Building2,
  Building,
  Tag,
  Fingerprint,
  Percent,
  MapPin,
  Home,
  Check,
  FileDown,
  FileText,
  Users,
  User,
  ClipboardList,
  Wallet,
  Map,
  Star,
  Mail,
  Phone,
  Plus,
  Clock,
  Calendar,
  ExternalLink,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

// ===========================================================================
// Helpers de mockup (todos a nivel de módulo)
// ===========================================================================

function MockToolbar({ highlight }: { highlight: "new" | "import" }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-8 bg-card border border-border rounded-md px-2 text-[11px] text-muted-foreground/70 inline-flex items-center opacity-60">
        Buscar cliente…
      </div>
      <div className="h-8 px-2 bg-card border border-border rounded-md text-[11px] text-muted-foreground inline-flex items-center gap-1 opacity-60">
        Activos <ChevronDown size={11} />
      </div>
      <div
        className={
          "h-8 px-2.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-all " +
          (highlight === "import"
            ? "bg-card border-2 border-[#0088D1] text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.2)] scale-105"
            : "bg-card border border-border text-muted-foreground opacity-60")
        }
      >
        <Upload size={12} /> Importar
      </div>
      <div
        className={
          "h-8 px-2.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-all " +
          (highlight === "new"
            ? "bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105"
            : "bg-[#0088D1] text-white opacity-60")
        }
      >
        <UserPlus size={12} /> Nuevo cliente
      </div>
    </div>
  );
}

function MockNewClienteForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <UserPlus size={13} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          Nuevo cliente
        </span>
      </div>
      <div className="p-3 space-y-2.5">
        <MockField
          label="Razón social *"
          value="Don Joaquín S.A."
          required
          icon={<Building2 size={10} />}
        />
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Nombre comercial" value="Don Joaquín" icon={<Tag size={10} />} />
          <MockField label="CUIT" value="30-12345678-9" icon={<Fingerprint size={10} />} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MockField
            label="Condición IVA *"
            value="Responsable inscripto"
            required
            icon={<Percent size={10} />}
          />
          <MockField label="Localidad" value="Arrecifes" icon={<MapPin size={10} />} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Domicilio fiscal" value="Av. Colón 123" icon={<Home size={10} />} />
          <MockField label="Email" value="contacto@empresa.com" icon={<Mail size={10} />} />
        </div>
        <div className="flex justify-end pt-1.5 border-t border-border">
          <span className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            <Check size={11} /> Guardar cliente
          </span>
        </div>
      </div>
    </div>
  );
}

function MockClienteCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-[#E1F5FE] text-primary font-bold text-sm flex items-center justify-center">
          D
        </span>
        <div>
          <div className="text-foreground font-semibold text-sm">Don Joaquín S.A.</div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
            <MapPin size={10} className="text-primary" /> Arrecifes
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[8px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
          Identificación
        </div>
        <div className="text-foreground text-xs font-mono">30-12345678-9</div>
      </div>
    </div>
  );
}

function MockImportTemplate() {
  const cols = [
    "CLIENTES",
    "RAZON SOCIAL",
    "CUIT",
    "CONDICION DE IVA",
    "DIRECCION",
    "CONTRATO PRINCIPAL",
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-2.5 py-2">
        <span className="text-[10px] text-muted-foreground">
          ¿No tenés template? Descargá el formato.
        </span>
        <span className="h-7 px-2 rounded-md border-2 border-[#0088D1] text-primary text-[10px] font-semibold inline-flex items-center gap-1 shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
          <FileDown size={11} /> Template
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Columnas esperadas
        </div>
        <div className="flex flex-wrap gap-1">
          {cols.map((c) => (
            <span
              key={c}
              className="font-mono text-[9px] bg-muted text-foreground border border-border rounded px-1.5 py-0.5"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "info" | "error";
}) {
  const cls = {
    neutral: "bg-muted/40 text-foreground border-border",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    error: "bg-red-50 text-red-700 border-red-200",
  }[tone];
  return (
    <div className={`rounded-md border px-2 py-1.5 ${cls}`}>
      <div className="text-[8px] uppercase tracking-wide font-semibold opacity-70">{label}</div>
      <div className="text-sm font-bold leading-tight">{value}</div>
    </div>
  );
}

function PreviewFila({
  estado,
  razon,
}: {
  estado: "ok" | "duplicate" | "error";
  razon: string;
}) {
  const meta = {
    ok: { t: "OK", c: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    duplicate: { t: "Duplicado", c: "bg-blue-50 text-blue-700 border-blue-200" },
    error: { t: "Error", c: "bg-red-50 text-red-700 border-red-200" },
  }[estado];
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2 px-2.5 py-1.5 border-t border-border first:border-t-0">
      <span
        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-semibold ${meta.c}`}
      >
        {meta.t}
      </span>
      <span className="text-[10px] text-foreground truncate">{razon}</span>
    </div>
  );
}

function MockImportPreview() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        <PreviewStat label="Total" value="42" tone="neutral" />
        <PreviewStat label="A importar" value="38" tone="success" />
        <PreviewStat label="Duplic." value="3" tone="info" />
        <PreviewStat label="Error" value="1" tone="error" />
      </div>
      <div className="flex flex-wrap gap-1">
        {["Todas (42)", "OK (38)", "Duplicados (3)", "Errores (1)"].map((f, i) => (
          <span
            key={f}
            className={
              "text-[9px] px-2 py-0.5 rounded-full border " +
              (i === 0
                ? "bg-[#0088D1] text-white border-[#0088D1]"
                : "bg-card border-border text-muted-foreground")
            }
          >
            {f}
          </span>
        ))}
      </div>
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <PreviewFila estado="ok" razon="YPF S.A." />
        <PreviewFila estado="ok" razon="Bunge Argentina S.A." />
        <PreviewFila estado="duplicate" razon="Cargill S.A.C.I." />
        <PreviewFila estado="error" razon="(falta razón social)" />
      </div>
    </div>
  );
}

function MockImportResult() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-emerald-700 font-semibold">Importados: 38</span>
        <span className="text-amber-700 font-semibold">Omitidos: 4</span>
      </div>
      <div className="border-t border-border pt-2 text-[10px] space-y-1 text-[#7F1D1D] font-mono">
        <div>
          <span className="font-semibold">Fila 12:</span> Falta razón social.
        </div>
        <div>
          <span className="font-semibold">Fila 27:</span> CUIT inválido.
        </div>
      </div>
    </div>
  );
}

function MockBuscar() {
  const letters = ["#", "A", "B", "C", "D", "E", "F"];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {letters.map((l) => (
          <span
            key={l}
            className={
              "size-6 rounded-full text-[10px] font-semibold inline-flex items-center justify-center border " +
              (l === "D"
                ? "bg-[#0F172A] text-white border-[#0F172A]"
                : "bg-card text-muted-foreground border-border")
            }
          >
            {l}
          </span>
        ))}
        <span className="text-[9px] text-muted-foreground ml-1">…</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-8 bg-card border border-border rounded-md px-2 text-[11px] text-muted-foreground/70 inline-flex items-center gap-1.5">
          <Search size={12} /> Buscar cliente por nombre…
        </div>
        <div className="h-8 px-2.5 bg-card border-2 border-[#0088D1] rounded-md text-[11px] text-primary font-semibold inline-flex items-center gap-1">
          Activos <ChevronDown size={12} />
        </div>
      </div>
    </div>
  );
}

function MockFichaTabs() {
  const pills = [
    { label: "Información", icon: <FileText size={11} />, active: true },
    { label: "Contactos", icon: <Users size={11} /> },
    { label: "Requisitos", icon: <ClipboardList size={11} /> },
    { label: "Cuenta", icon: <Wallet size={11} /> },
    { label: "Viajes", icon: <Map size={11} /> },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="size-9 rounded-full bg-[#E1F5FE] text-primary font-bold text-sm flex items-center justify-center">
            D
          </span>
          <div>
            <div className="text-foreground font-semibold text-sm">Don Joaquín S.A.</div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
              <MapPin size={9} className="text-primary" /> Arrecifes
            </div>
          </div>
        </div>
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary flex items-center justify-center">
          <ChevronUp size={13} />
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((p) => (
          <span
            key={p.label}
            className={
              "inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[10px] font-semibold uppercase tracking-wide " +
              (p.active
                ? "bg-[#0088D1] text-white"
                : "bg-card text-muted-foreground border border-border")
            }
          >
            {p.icon}
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MockContactos() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card p-2.5 flex items-start gap-2.5">
        <span className="size-8 rounded-full bg-[#E1F5FE] text-primary flex items-center justify-center shrink-0">
          <User size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-foreground font-semibold text-xs">Carolina Barrera</span>
            <span className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
              <Star size={8} fill="currentColor" /> Principal
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
              Comercial
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail size={10} /> caro@ypf.com
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone size={10} /> 11 5555-1234
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-2.5 flex items-start gap-2.5">
        <span className="size-8 rounded-md bg-[#E1F5FE] text-primary flex items-center justify-center shrink-0">
          <Building size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-foreground font-semibold text-xs">Planta Arrecifes</span>
            <span className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
              <Star size={8} fill="currentColor" /> Principal
            </span>
          </div>
          <div className="flex items-start gap-1 mt-1 text-[10px] text-muted-foreground">
            <MapPin size={10} className="text-primary mt-px shrink-0" /> Ruta 8 km 180, Arrecifes
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#0088D1]/40 bg-[#0088D1]/5 px-2 py-1 font-semibold text-primary">
          <Plus size={11} /> Agregar contacto
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#0088D1]/40 bg-[#0088D1]/5 px-2 py-1 font-semibold text-primary">
          <Plus size={11} /> Agregar sucursal
        </span>
      </div>
    </div>
  );
}

function MockRequisitos() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          3 requisitos
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
          2 pendientes
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5">
          1 vencido
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="flex items-start gap-2">
          <span className="size-8 rounded-md bg-[#E1F5FE] text-primary flex items-center justify-center shrink-0">
            <ClipboardList size={15} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-foreground font-semibold text-xs">Habilitación como proveedor</span>
              <span className="text-[8px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                Habilitación proveedor
              </span>
              <span className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                <Clock size={8} /> Pendiente
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span>Anual</span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={10} /> 15/08/2026
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 pl-10">
          <span className="text-[9px] px-2 h-5 inline-flex items-center rounded uppercase tracking-wide font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pendiente
          </span>
          <span className="text-[9px] px-2 h-5 inline-flex items-center rounded uppercase tracking-wide font-semibold text-muted-foreground/70">
            Cumplido
          </span>
          <span className="text-[9px] px-2 h-5 inline-flex items-center rounded uppercase tracking-wide font-semibold text-muted-foreground/70">
            Vencido
          </span>
        </div>
      </div>
    </div>
  );
}

function CuentaCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "debe" | "haber" | "saldo";
}) {
  const color =
    tone === "debe"
      ? "text-[#B91C1C]"
      : tone === "haber"
        ? "text-emerald-700"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="text-[8px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
        {label}
      </div>
      <div className={`text-[11px] font-bold mt-0.5 font-mono ${color}`}>{value}</div>
    </div>
  );
}

function MockCuenta() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <CuentaCard label="Total debe" value="$1.240.000" tone="debe" />
        <CuentaCard label="Total haber" value="$900.000" tone="haber" />
        <CuentaCard label="Saldo" value="$340.000" tone="saldo" />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden text-[10px]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-2.5 py-1.5 border-b border-border">
          <span className="text-foreground">Factura A-0012</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase bg-red-50 text-[#B91C1C]">
              Debe
            </span>
            <span className="font-mono text-[#B91C1C]">$1.240.000</span>
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-2.5 py-1.5">
          <span className="text-foreground">Pago recibido</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase bg-emerald-50 text-emerald-700">
              Haber
            </span>
            <span className="font-mono text-emerald-700">$900.000</span>
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-blue-50 border border-blue-200 text-[10px] text-blue-800 px-2.5 py-2 flex items-center gap-1.5">
        <Map size={12} className="shrink-0" /> La solapa <b>Viajes recientes</b> lista los últimos
        viajes, con link directo <ExternalLink size={10} className="inline" />.
      </div>
    </div>
  );
}

function MockEditar() {
  const fields = [
    { l: "Firma comercial", v: "Don Joaquín" },
    { l: "CUIT / CUIL", v: "30-12345678-9" },
    { l: "Domicilio", v: "Av. Colón 123" },
    { l: "Ubicación", v: "Arrecifes, Bs. As." },
  ];
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <div key={f.l} className="rounded-lg border border-border bg-card p-2">
            <div className="text-[8px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
              {f.l}
            </div>
            <div className="text-foreground text-[11px] font-semibold mt-0.5">{f.v}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[11px] font-semibold text-primary border-2 border-[#0088D1] bg-[#0088D1]/5 shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
          <Pencil size={12} /> Editar datos
        </span>
        <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-[11px] font-semibold text-[#B91C1C] border border-[#FECACA]">
          <Trash2 size={12} /> Dar de baja
        </span>
      </div>
    </div>
  );
}

function MockBaja() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-start gap-2.5 px-3 py-2.5 border-b border-border">
        <span className="size-8 rounded-full bg-red-50 text-[#B91C1C] inline-flex items-center justify-center shrink-0">
          <AlertTriangle size={16} />
        </span>
        <div>
          <div className="text-foreground text-xs font-semibold">Dar de baja cliente</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Queda inactivo. Se conservan sus viajes y cuenta corriente.
          </div>
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        <div className="text-[11px] text-foreground">
          ¿Confirmás dar de baja a <b>Don Joaquín S.A.</b>?
        </div>
        <div className="flex justify-end gap-2">
          <span className="h-7 px-2.5 text-[10px] rounded-md border border-border text-muted-foreground inline-flex items-center">
            Cancelar
          </span>
          <span className="h-7 px-2.5 text-[10px] rounded-md bg-[#B91C1C] text-white inline-flex items-center gap-1 font-semibold">
            <Trash2 size={11} /> Dar de baja
          </span>
        </div>
      </div>
    </div>
  );
}

function MockReactivar() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card p-2.5 flex items-center justify-between opacity-90">
        <div className="text-xs text-foreground">
          <b>Don Joaquín S.A.</b>
          <span className="ml-2 text-[9px] uppercase tracking-wide bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">
            Inactivo
          </span>
        </div>
        <span className="h-7 px-2.5 text-[10px] rounded-md border border-emerald-200 text-emerald-700 inline-flex items-center gap-1 font-semibold">
          <RotateCcw size={11} /> Reactivar
        </span>
      </div>
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 px-2.5 py-2">
        Para encontrarlo, cambiá el filtro de estado a <b>Inactivos</b> o <b>Todos</b>.
      </div>
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "alta",
    label: "Alta manual",
    icon: <UserPlus size={14} />,
    steps: [
      {
        title: 'Abrí "Nuevo cliente"',
        description:
          'Arriba a la derecha del listado está el botón "Nuevo cliente" (lo ves si tenés permiso de edición). Se abre un formulario centrado.',
        mockup: <MockToolbar highlight="new" />,
      },
      {
        title: "Completá los datos",
        description:
          "Razón social y Condición IVA son obligatorios. El resto —CUIT, domicilio, localidad, teléfono, email— lo cargás ahora o después desde la ficha.",
        mockup: <MockNewClienteForm />,
        hint: "El CUIT se autoformatea (30-12345678-9). Conviene cargarlo: es lo que después evita duplicados cuando importás por Excel.",
      },
      {
        title: "Guardar y listo",
        description:
          'Apretá "Guardar cliente". El formulario se cierra solo y el cliente aparece en la cartera, ordenado alfabéticamente por razón social.',
        mockup: <MockClienteCard />,
      },
    ],
  },
  {
    id: "importar",
    label: "Importar Excel",
    icon: <Upload size={14} />,
    steps: [
      {
        title: 'Abrí "Importar"',
        description:
          'Al lado de "Nuevo cliente" está el botón "Importar". Sirve para cargar muchos clientes de una sola vez desde una planilla.',
        mockup: <MockToolbar highlight="import" />,
      },
      {
        title: "Bajá el template",
        description:
          'Dentro del modal, "Template" te baja un .xlsx con las columnas exactas y una fila de ejemplo. Completá una fila por cliente, sin tocar el encabezado.',
        mockup: <MockImportTemplate />,
        hint: 'Condición IVA acepta las siglas RI, MT, EX, CF o el nombre completo. La columna "Contrato principal" se carga como contacto principal del cliente.',
      },
      {
        title: "Revisá el preview",
        description:
          "Antes de confirmar, el sistema analiza el archivo y te muestra cada fila clasificada: OK, duplicado o con error. Podés filtrar por estado para revisar.",
        mockup: <MockImportPreview />,
        hint: "Los duplicados (por CUIT o razón social) no se vuelven a cargar. Corregí los errores en el Excel y reintentá solo esas filas.",
      },
      {
        title: "Confirmá y revisá el resultado",
        description:
          'Apretá "Confirmar importación" y vas a ver cuántos clientes se importaron y cuántos se omitieron, con el detalle de errores por número de fila.',
        mockup: <MockImportResult />,
      },
    ],
  },
  {
    id: "ficha",
    label: "Buscar y ficha",
    icon: <Search size={14} />,
    steps: [
      {
        title: "Buscá y filtrá",
        description:
          "El abecedario filtra por la inicial de la razón social (# = todos). El buscador matchea razón social, nombre comercial, CUIT y localidad. El selector muestra Activos, Inactivos o Todos.",
        mockup: <MockBuscar />,
        hint: 'Arriba a la derecha, "Exportar clientes" te baja un Excel con la ficha de toda la cartera (datos, contactos, direcciones y requisitos) más lo facturado y lo pendiente de cada cliente.',
      },
      {
        title: "Abrí la ficha del cliente",
        description:
          "Hacé clic en cualquier cliente para expandirlo. Adentro tenés solapas: Información general, Contactos, Requisitos, Estado de cuenta y Viajes recientes. (Sucursales aparece cuando hay 2 o más.)",
        mockup: <MockFichaTabs />,
      },
      {
        title: "Contactos y sucursales",
        description:
          "Cargá las personas de referencia (con cargo, teléfono y email) y las sucursales operativas con su dirección. La estrella marca la principal de cada lista.",
        mockup: <MockContactos />,
      },
      {
        title: "Requisitos",
        description:
          "Documentación y reportes que el cliente exige para operar: habilitaciones, docs de choferes/camiones, auditorías. Cada uno tiene tipo, frecuencia, próxima fecha y un semáforo Pendiente / Cumplido / Vencido.",
        mockup: <MockRequisitos />,
        hint: "Los que tienen fecha pasada se marcan vencidos, y arriba del listado ves el conteo de pendientes y vencidos.",
      },
      {
        title: "Cuenta corriente y viajes",
        description:
          "Estado de cuenta muestra total debe, total haber y saldo con el detalle de movimientos. Viajes recientes lista los últimos viajes del cliente, con link directo a cada uno.",
        mockup: <MockCuenta />,
      },
    ],
  },
  {
    id: "editar",
    label: "Editar y baja",
    icon: <Pencil size={14} />,
    steps: [
      {
        title: "Editá los datos",
        description:
          'En la solapa "Información general", el botón "Editar datos" abre el mismo formulario para corregir razón social, CUIT, domicilio, contacto y demás.',
        mockup: <MockEditar />,
      },
      {
        title: "Dar de baja sin perder historial",
        description:
          'El botón "Dar de baja" NO borra al cliente: lo deja inactivo. Se conservan todos sus viajes y su cuenta corriente. Te pide confirmación antes.',
        mockup: <MockBaja />,
        hint: "Usalo cuando dejás de operar con un cliente: no se pierde nada y lo podés reactivar cuando quieras.",
      },
      {
        title: "Reactivar cuando quieras",
        description:
          'Un cliente inactivo se vuelve a activar con "Reactivar". Para encontrarlo, cambiá el filtro de estado a Inactivos o Todos.',
        mockup: <MockReactivar />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de clientes" tabs={TABS} />;
}
