"use client";

import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";
import {
  Plus,
  Upload,
  Camera,
  User,
  Phone,
  MapPin,
  Calendar,
  Truck,
  Lock,
  CreditCard,
  FileText,
  Trophy,
  Wallet,
  RefreshCw,
  LogOut,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Stethoscope,
  Coins,
  Check,
  X,
  Search,
  ArrowDownUp,
  ChevronRight,
  FileSpreadsheet,
  Archive,
  CalendarOff,
  Plane,
  Users,
  Briefcase,
  ClipboardCheck,
  Fingerprint,
  Hash,
  Mail,
  UserPlus,
  LayoutDashboard,
  FolderOpen,
  Zap,
} from "lucide-react";

// =============================================================================
// TAB 1 — Alta de legajo
// =============================================================================

function MockToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="opacity-60">
        <div className="text-foreground text-sm font-bold">Personal</div>
        <div className="text-muted-foreground text-[10px] mt-0.5">
          Legajo digital de todo el personal
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 border border-border bg-card text-muted-foreground">
          <Upload size={13} /> Importar
        </div>
        <div className="h-8 px-3 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
          <Plus size={13} /> Nuevo legajo
        </div>
      </div>
    </div>
  );
}

function MockNuevoLegajoForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">
          Agregar nuevo legajo
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-3">
        <MockField label="Área / Rol *" value="Chofer" required icon={<Briefcase size={12} />} />
        {/* Los pares de campos se apilan mientras el recuadro es angosto. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          <MockField label="Nombre *" value="Juan" required />
          <MockField label="Apellido *" value="Pérez" required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          <MockField label="DNI *" value="30.123.456" required icon={<Fingerprint size={12} />} />
          <MockField label="CUIL *" value="20-30123456-9" required icon={<Hash size={12} />} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          <MockField label="Teléfono *" value="+54 9 2983…" required icon={<Phone size={12} />} />
          <MockField label="Localidad *" value="Tres Arroyos" required icon={<MapPin size={12} />} />
        </div>
        <MockField label="Email" value="juan@mail.com" icon={<Mail size={12} />} />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-foreground">
          <ClipboardCheck size={13} className="text-primary" />
          <span className="font-semibold">Período de prueba</span>
          <span className="ml-auto text-muted-foreground font-mono">01/06 → 6 meses</span>
        </div>
      </div>
    </div>
  );
}

function MockChoferCard() {
  return (
    <div className="bg-card border border-border rounded-[10px] shadow-sm overflow-hidden max-w-[280px] mx-auto">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0088D1] to-[#4FC3F7]" />
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center text-primary font-bold text-sm shrink-0">
            PJ
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-foreground font-semibold text-xs">Pérez, Juan</div>
            <div className="text-muted-foreground text-[10px] font-mono mt-0.5">
              DNI 30.123.456
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block text-[9px] font-semibold uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-1.5 py-0.5">
                Activo
              </span>
              <span className="inline-block text-[9px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-1.5 py-0.5">
                Chofer
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#F1F5F9] space-y-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Phone size={10} className="text-muted-foreground/70" /> +54 9 2983…
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={10} className="text-muted-foreground/70" /> Tres Arroyos
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="text-muted-foreground/70" /> Ingreso: 01/06/2024
          </div>
          <div className="flex items-center gap-1.5">
            <Truck size={10} className="text-muted-foreground/70" />{" "}
            <span className="font-mono text-foreground/80">AF930GJ</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2 — Panel, filtros e importación
// =============================================================================

function MockStats() {
  const roles = [
    { l: "Choferes", v: "38", c: "text-emerald-600" },
    { l: "Administr.", v: "6", c: "text-primary" },
    { l: "Manten.", v: "4", c: "text-amber-600" },
    { l: "Fleteros", v: "3", c: "text-primary" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#0088D1]/40 bg-[#E1F5FE]/40 p-2.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Total personal
          </div>
          <div className="text-foreground text-lg font-bold leading-none mt-1">51</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">44 activos · 7 inactivos</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {roles.map((r) => (
            <div key={r.l} className="rounded-md border border-border p-1.5">
              <div className="text-[8px] uppercase text-muted-foreground truncate">{r.l}</div>
              <div className={`text-sm font-bold ${r.c}`}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-border p-2">
          <div className="text-[8px] uppercase text-muted-foreground">Documentos</div>
          <div className="text-foreground text-sm font-bold">128</div>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50/60 p-2">
          <div className="text-[8px] uppercase text-red-700 flex items-center gap-1">
            <AlertTriangle size={9} /> Vencidos
          </div>
          <div className="text-red-700 text-sm font-bold">5</div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2">
          <div className="text-[8px] uppercase text-amber-700">Por vencer</div>
          <div className="text-amber-700 text-sm font-bold">9</div>
        </div>
      </div>
    </div>
  );
}

function MockVencimientos() {
  const rows = [
    {
      n: "Pérez, Juan",
      d: "Licencia de conducir",
      f: "12/07/2026",
      t: "VENCIDO",
      cls: "bg-[#FEF2F2] text-[#7F1D1D] border-[#FECACA]",
    },
    {
      n: "Gómez, Luis",
      d: "ART",
      f: "30/07/2026",
      t: "POR VENCER",
      cls: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
    },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div
          key={r.n}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
        >
          <FileText size={13} className="text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-foreground truncate">{r.n}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {r.d} · {r.f}
            </div>
          </div>
          <span className={`text-[9px] font-bold rounded-full border px-2 py-0.5 ${r.cls}`}>
            {r.t}
          </span>
          <ChevronRight size={13} className="text-muted-foreground/50 shrink-0" />
        </div>
      ))}
      <div className="text-[10px] text-muted-foreground/80 pt-0.5">
        Tocás la tarjeta y te lleva al legajo, pestaña Documentación.
      </div>
    </div>
  );
}

function MockFiltros() {
  const roles = ["Todos", "Choferes", "Administr.", "Manten.", "Fleteros"];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-foreground">
        <Users size={13} className="text-primary" />
        <span className="font-semibold">Choferes en plantilla</span>
        <span className="text-muted-foreground">38 de 38</span>
      </div>
      <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-lg">
        {roles.map((r, i) => (
          <span
            key={r}
            className={
              "px-2 py-1 rounded-md text-[10px] font-medium " +
              (i === 1 ? "bg-card text-primary shadow-sm" : "text-muted-foreground")
            }
          >
            {r}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-7 rounded-md border border-border bg-card px-2 text-[10px] text-muted-foreground inline-flex items-center justify-between">
          Activo <span className="text-muted-foreground/50">▾</span>
        </div>
        <div className="h-7 rounded-md border border-border bg-card px-2 text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <ArrowDownUp size={10} /> Apellido A–Z
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-7 flex-1 rounded-md border border-border bg-card px-2 text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Search size={10} /> Nombre, DNI, CUIL…
        </div>
        <div className="h-7 rounded-md border border-border bg-card px-2 text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <X size={10} /> Limpiar
        </div>
      </div>
    </div>
  );
}

function MockImport() {
  const rows = [
    { ok: true, n: "Pérez, Juan", d: "30.123.456" },
    { ok: true, n: "Gómez, Luis", d: "28.998.111" },
    { ok: false, n: "(sin apellido)", d: "—" },
  ];
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-md bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
          <FileSpreadsheet size={13} />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-foreground">
            Detectado: Planilla de Choferes
          </div>
          <div className="text-[9px]">
            <span className="text-emerald-600 font-semibold">2 válidas</span> ·{" "}
            <span className="text-red-600 font-semibold">1 con error</span>
          </div>
        </div>
      </div>
      <div className="p-2 space-y-1">
        {rows.map((r) => (
          <div
            key={r.n}
            className={
              "flex items-center gap-2 rounded px-2 py-1 text-[10px] " + (r.ok ? "" : "bg-[#FEF2F2]")
            }
          >
            {r.ok ? (
              <Check size={11} className="text-[#10B981]" />
            ) : (
              <X size={11} className="text-red-500" />
            )}
            <span className="text-foreground font-medium flex-1 truncate">{r.n}</span>
            <span className="text-muted-foreground font-mono">{r.d}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border flex justify-end">
        <div className="h-7 px-3 rounded-md bg-[#0088D1] text-white text-[10px] font-bold inline-flex items-center gap-1">
          <Upload size={11} /> Confirmar 2 registros
        </div>
      </div>
    </div>
  );
}

function MockReactivar() {
  return (
    <div className="space-y-2">
      <div className="w-full bg-card rounded-md border border-border px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Archive size={12} /> Historial de Choferes Egresados
        </span>
        <span>2 choferes ▾</span>
      </div>
      <div className="bg-card border border-amber-200 rounded-md px-3 py-2 flex items-center justify-between opacity-90">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            Egresado
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="size-7 rounded-md text-emerald-500 border border-emerald-200 inline-flex items-center justify-center"
            title="Reactivar"
          >
            <RotateCcw size={12} />
          </div>
          <div
            className="size-7 rounded-md text-red-500 border border-red-200 inline-flex items-center justify-center"
            title="Eliminar"
          >
            <Trash2 size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 3 — Legajo digital
// =============================================================================

function MockAvatarUpload() {
  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center text-primary font-bold text-lg shadow-inner ring-4 ring-[#0088D1]/15">
          PJ
        </div>
        <div className="absolute inset-0 rounded-full bg-black/55 flex flex-col items-center justify-center text-white">
          <Camera size={14} />
          <span className="text-[8px] font-medium tracking-wider uppercase mt-0.5">Subir</span>
        </div>
      </div>
      <div className="text-primary text-lg">→</div>
      <div className="w-16 h-16 rounded-full border-2 border-[#B3E5FC] overflow-hidden bg-[#E1F5FE] flex items-center justify-center text-primary">
        <User size={28} />
      </div>
    </div>
  );
}

function MockLegajoTabs() {
  const tabs = [
    "Información General",
    "Documentación",
    "Historial Viajes",
    "Cuenta Corriente",
    "Sueldos",
    "Productividad",
    "Apercibimientos",
    "Licencias Médicas",
    "Ausencias",
    "Vacaciones",
    "Préstamos",
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center gap-2 text-[11px] text-foreground">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center font-bold text-[10px]">
          PJ
        </span>
        <span className="font-semibold">Pérez, Juan</span>
      </div>
      <div className="p-2 flex flex-wrap gap-1">
        {tabs.map((t, i) => {
          const sueldos = t === "Sueldos";
          return (
            <span
              key={t}
              className={
                "px-2 py-1 rounded text-[10px] font-medium border inline-flex items-center gap-1 " +
                (i === 0
                  ? "bg-[#E1F5FE] text-primary border-[#0088D1]/40"
                  : sueldos
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-card text-muted-foreground border-border")
              }
            >
              {sueldos && <Lock size={9} />}
              {t}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MockDatosBancarios() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        <CreditCard size={11} className="text-primary" /> Datos bancarios
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="text-muted-foreground">Banco</span>
        <span className="text-foreground font-medium">Banco Nación</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-[#0088D1]/40 bg-[#E1F5FE]/40">
        <span className="text-muted-foreground">CVU/CBU</span>
        <span className="text-foreground font-mono">0000003100…</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="text-muted-foreground">Alias</span>
        <span className="text-foreground font-mono">perez.juan.dj</span>
      </div>
      <div className="text-[10px] text-muted-foreground/80 pt-0.5">
        Se usan para liquidaciones y transferencias.
      </div>
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> Licencia de conducir
        </span>
        <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-2 py-0.5">
          Vigente
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> ART
        </span>
        <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-full px-2 py-0.5">
          Vence en 20 días
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> Libreta sanitaria
        </span>
        <span className="text-[10px] text-[#7F1D1D] bg-[#FEF2F2] border border-[#FECACA] rounded-full px-2 py-0.5">
          Vencida
        </span>
      </div>
    </div>
  );
}

function MockProductividad() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <Trophy size={11} className="text-[#F59E0B]" /> Score del chofer
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
          87 · #2 ranking
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Viajes (mes)</div>
          <div className="text-foreground font-bold">24</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Km recorridos</div>
          <div className="text-foreground font-bold">12.480</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Toneladas</div>
          <div className="text-foreground font-bold">820</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Gasoil km/l</div>
          <div className="text-[#065F46] font-bold">3,1</div>
        </div>
      </div>
    </div>
  );
}

function MockViajesCuenta() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      <div className="bg-card border border-border rounded-md p-2 space-y-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <MapPin size={10} className="text-primary" /> Historial viajes
        </div>
        <div className="text-[11px] text-foreground">Tres Arroyos → CABA</div>
        <div className="text-[10px] text-muted-foreground">12/03/2026 · 580 km</div>
        <div className="text-[11px] text-foreground">Bahía Blanca → Mar del Plata</div>
        <div className="text-[10px] text-muted-foreground">08/03/2026 · 480 km</div>
      </div>
      <div className="bg-card border border-border rounded-md p-2 space-y-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Wallet size={10} className="text-primary" /> Cuenta corriente
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground">Viático ruta</span>
          <span className="text-[#065F46] font-semibold">+ $ 25.000</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground">Anticipo</span>
          <span className="text-[#7F1D1D] font-semibold">- $ 50.000</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 4 — Acciones y seguimiento
// =============================================================================

function MockCardFooter() {
  return (
    <div className="bg-muted/40 border border-border rounded-md px-3 py-2.5 flex items-center justify-between gap-1">
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
        <User size={12} /> Ver legajo
      </div>
      <div className="flex items-center gap-1">
        <div
          className="size-8 rounded-md text-primary border border-[#0088D1] inline-flex items-center justify-center"
          title="Ver viajes"
        >
          <MapPin size={13} />
        </div>
        <div className="size-8 rounded-md text-amber-500 border border-border inline-flex items-center justify-center">
          <RefreshCw size={13} />
        </div>
        <div className="size-8 rounded-md text-amber-500 border border-border inline-flex items-center justify-center">
          <LogOut size={13} />
        </div>
      </div>
    </div>
  );
}

function MockEstadoToggle() {
  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-md p-2 flex items-center justify-between">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-2 py-0.5">
            Activo
          </span>
        </div>
        <div className="size-7 rounded-md text-amber-500 hover:bg-card border border-border inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(245,158,11,0.15)] ring-2 ring-amber-300">
          <RefreshCw size={12} />
        </div>
      </div>
      <div className="text-center text-[10px] text-muted-foreground">↓ después del clic</div>
      <div className="bg-card border border-border rounded-md p-2 flex items-center justify-between opacity-80">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">
            Inactivo
          </span>
        </div>
        <div className="size-7 rounded-md text-emerald-500 border border-border inline-flex items-center justify-center">
          <RefreshCw size={12} />
        </div>
      </div>
    </div>
  );
}

function MockEgresar() {
  return (
    <div className="bg-card border border-amber-200 rounded-md overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>
        </div>
        <div className="size-7 rounded-md text-amber-500 border border-amber-200 bg-amber-50 inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(245,158,11,0.15)] ring-2 ring-amber-300">
          <LogOut size={12} />
        </div>
      </div>
      <div className="px-3 py-2 bg-amber-50/70 border-t border-amber-200 text-[10px] space-y-1">
        <div className="flex items-center gap-1.5 text-amber-700 font-semibold uppercase tracking-wide">
          <LogOut size={11} /> Chofer egresado
        </div>
        <div className="text-foreground/90">
          Motivo: <span className="font-medium">renuncia</span>
        </div>
        <div className="text-foreground/90">Fecha de egreso: 30/04/2026</div>
      </div>
    </div>
  );
}

function MockLegajoAdmin() {
  const rows = [
    {
      icon: <AlertTriangle size={12} className="text-[#F59E0B]" />,
      t: "Apercibimiento — Demora reiterada",
      tag: "Leve",
      tagCls: "text-[#92400E] bg-[#FEF3C7] border-[#FCD34D]",
    },
    {
      icon: <Stethoscope size={12} className="text-primary" />,
      t: "Licencia médica — 3 días",
      tag: "con parte",
      tagCls: "text-muted-foreground bg-muted border-border",
    },
    {
      icon: <CalendarOff size={12} className="text-muted-foreground" />,
      t: "Ausencia — falta sin aviso",
      tag: "1 día",
      tagCls: "text-muted-foreground bg-muted border-border",
    },
    {
      icon: <Plane size={12} className="text-emerald-600" />,
      t: "Vacaciones — saldo 14 días",
      tag: "cronograma",
      tagCls: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      icon: <Coins size={12} className="text-[#065F46]" />,
      t: "Préstamo — saldo pendiente",
      tag: "$ 80.000",
      tagCls: "text-[#7F1D1D] bg-[#FEF2F2] border-[#FECACA]",
    },
  ];
  return (
    <div className="space-y-1.5 text-[11px]">
      {rows.map((r) => (
        <div
          key={r.t}
          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
        >
          {r.icon}
          <span className="text-foreground flex-1 truncate">{r.t}</span>
          <span className={`text-[9px] rounded-full border px-2 py-0.5 shrink-0 ${r.tagCls}`}>
            {r.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Solapas
// =============================================================================

const TABS: TutorialTab[] = [
  {
    id: "alta",
    label: "Alta",
    icon: <UserPlus size={14} />,
    steps: [
      {
        title: 'Abrí "Nuevo legajo"',
        description:
          'Arriba a la derecha está el botón azul "Nuevo legajo" (y al lado "Importar", para cargar planillas). El de Personal no es solo para choferes: acá va todo el personal.',
        mockup: <MockToolbar />,
        hint: "Los choferes no entran al sistema. Esto es gestión administrativa: legajo, viajes y cuenta corriente.",
      },
      {
        title: "Elegí el área y cargá los datos",
        description:
          'Lo primero es el "Área / Rol": Chofer, Administración, Mantenimiento o Fletero (tercerizado). Después el resto: nombre, apellido, DNI, CUIL, teléfono, email y localidad. El período de prueba (6 meses) arranca solo desde la fecha de ingreso.',
        mockup: <MockNuevoLegajoForm />,
        hint: "El rol define de qué stat suma la persona y, en choferes, si se le puede asignar un camión.",
      },
      {
        title: "Guardá — aparece en el listado",
        description:
          "Al guardar, la persona aparece como una tarjeta ordenada por apellido. Podés guardar aunque falten datos: el legajo queda marcado como incompleto y no se puede asignar a viajes ni siniestros hasta completarlo.",
        mockup: <MockChoferCard />,
        hint: "Nombre, apellido, DNI, CUIL, teléfono, localidad y fecha de ingreso: con eso el legajo queda completo.",
      },
    ],
  },
  {
    id: "panel",
    label: "Panel",
    icon: <LayoutDashboard size={14} />,
    steps: [
      {
        title: "Leé el panel de arriba",
        description:
          "La primera fila desglosa el personal por rol (choferes, administración, mantenimiento, fleteros) más el total con activos e inactivos. La segunda muestra la documentación cargada y cuánta está vencida o por vencer.",
        mockup: <MockStats />,
      },
      {
        title: "Vencimientos que saltan",
        description:
          'Las tarjetas "Vencidos" y "Por vencer" son clickeables: se abre el detalle con el chofer, el tipo de documento y los días. Tocás cualquiera y vas directo a su legajo, pestaña Documentación.',
        mockup: <MockVencimientos />,
        hint: "Los avisos salen de las fechas de vencimiento que cargás en cada documento del legajo.",
      },
      {
        title: "Filtrá, ordená y buscá",
        description:
          "Las pestañas de rol filtran por área (con el conteo al lado). Sumás estado (activo, inactivo, en período de prueba o egresado), un orden (apellido o antigüedad) y el buscador por nombre, DNI, CUIL o teléfono. Limpiar deja todo como estaba.",
        mockup: <MockFiltros />,
      },
      {
        title: "Importá desde Excel",
        description:
          'Con "Importar" subís una planilla .xlsx o .csv. El sistema detecta solo si es de choferes, de vencimientos de licencias o de manuales, te muestra una vista previa con válidas y errores, y recién ahí confirmás.',
        mockup: <MockImport />,
        hint: "Importar choferes da de alta los nuevos y actualiza los que ya existen (empareja por DNI/CUIL). No pisa a lo loco.",
      },
      {
        title: "Historial de egresados",
        description:
          "Los que diste de baja no se borran: quedan en una sección colapsable al final del listado. Desde su tarjeta los reactivás (vuelven a plantilla) o, si de verdad hace falta, los eliminás definitivamente. También los filtrás con el estado \"Egresado\".",
        mockup: <MockReactivar />,
      },
    ],
  },
  {
    id: "legajo",
    label: "Legajo",
    icon: <FolderOpen size={14} />,
    steps: [
      {
        title: "Subí la foto de perfil",
        description:
          "En la tarjeta, hacé clic sobre el círculo del avatar para subir una imagen. Si ya tiene foto, el clic la reemplaza y el tachito rojo la borra.",
        mockup: <MockAvatarUpload />,
        hint: "Máximo 5 MB por imagen. Acepta JPG, PNG, WEBP, GIF y HEIC.",
      },
      {
        title: 'Abrí el "Legajo digital"',
        description:
          'Desde "Ver legajo" (o el nombre) entrás a su página. Todo se organiza en pestañas: Información General, Documentación, Historial Viajes, Cuenta Corriente, Productividad, Apercibimientos, Licencias Médicas, Ausencias, Vacaciones y Préstamos. Sueldos es aparte: confidencial, solo con permiso.',
        mockup: <MockLegajoTabs />,
      },
      {
        title: "Datos personales y bancarios",
        description:
          'En "Información General" completás los datos y el bloque bancario: banco, CVU/CBU y alias. Se usan para liquidaciones y transferencias al chofer. Ahí también cargás contactos de emergencia y el camión asignado.',
        mockup: <MockDatosBancarios />,
        hint: "CVU y CBU van en el mismo campo: cargá el que tengas.",
      },
      {
        title: "Documentación con vencimientos",
        description:
          'En "Documentación" subís licencia, ART, libreta sanitaria, etc. Si ponés fecha de vencimiento, el sistema avisa cuando se acerca y eso alimenta las tarjetas de vencidos/por vencer del panel.',
        mockup: <MockDocumentos />,
      },
      {
        title: "Productividad y score",
        description:
          '"Productividad" calcula solo los KPIs: viajes, km, toneladas, eficiencia de gasoil (km/l) y un score que lo ubica en el ranking. No cargás nada a mano, sale de las hojas de ruta y los viajes.',
        mockup: <MockProductividad />,
        hint: "El ranking general y el comparador entre choferes están en /choferes/ranking y /choferes/comparar.",
      },
      {
        title: "Viajes y cuenta corriente",
        description:
          'Los tabs "Historial Viajes" y "Cuenta Corriente" muestran lo que el chofer manejó y sus movimientos (viáticos, anticipos, etc.) sin que tengas que ir a otra sección.',
        mockup: <MockViajesCuenta />,
      },
    ],
  },
  {
    id: "acciones",
    label: "Acciones",
    icon: <Zap size={14} />,
    steps: [
      {
        title: "Ver legajo y viajes asociados",
        description:
          'En el pie de la tarjeta, "Ver legajo" abre la página del chofer y el ícono de pin abre Viajes ya filtrado por esa persona. Más rápido que ir a Viajes y filtrar a mano.',
        mockup: <MockCardFooter />,
      },
      {
        title: "Activo / inactivo",
        description:
          'El ícono de flechas circulares cambia entre "Activo" e "Inactivo". No borra nada: solo lo saca de las listas activas (por ejemplo, mientras está de licencia larga).',
        mockup: <MockEstadoToggle />,
      },
      {
        title: "Egresar (baja con motivo)",
        description:
          "El ícono ámbar de salida da de baja al chofer. Te pide motivo y fecha de egreso. No se borra: pasa al historial conservando viajes, documentación y movimientos.",
        mockup: <MockEgresar />,
        hint: "Un chofer con viajes o registros asociados no se puede eliminar del todo: el sistema lo impide y lo deja en el historial.",
      },
      {
        title: "Seguimiento de RR.HH.",
        description:
          "Dentro del legajo llevás el seguimiento del personal: apercibimientos por categoría, licencias médicas con parte, ausencias, vacaciones (saldo + cronograma) y préstamos con el saldo pendiente. Todo editable con permiso de logística.",
        mockup: <MockLegajoAdmin />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Personal y legajos — guía" tabs={TABS} />;
}
