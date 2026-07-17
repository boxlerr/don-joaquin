"use client";

import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";
import {
  Calculator,
  Users,
  Route,
  Settings,
  Search,
  Plus,
  Pencil,
  PauseCircle,
  History,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Info,
  Calendar,
  DollarSign,
  Lock,
  User,
  Weight,
  MapPin,
  Flag,
  Coins,
  Save,
} from "lucide-react";

// ===========================================================================
// Helpers de mockup (todos a nivel de módulo)
// ===========================================================================

function FilaTarifa({
  ruta,
  modalidad,
  valor,
  activa,
}: {
  ruta: string;
  modalidad: string;
  valor: string;
  activa: boolean;
}) {
  return (
    <div className="px-3 py-2 flex items-center gap-3 text-[11px] border-b border-border last:border-0">
      <span className="flex-1 text-foreground truncate">{ruta}</span>
      <span className="w-16">
        <span className="px-1.5 py-0.5 rounded bg-[#E1F5FE] text-[#004A99] font-medium text-[10px]">
          {modalidad}
        </span>
      </span>
      <span className="w-14 text-right font-mono font-semibold text-foreground">
        {valor}
      </span>
      <span className="w-14">
        {activa ? (
          <span className="inline-flex items-center gap-1 text-[#10B981] font-medium">
            <CheckCircle2 size={11} /> Activa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground/70">
            <XCircle size={11} /> Inactiva
          </span>
        )}
      </span>
      <div className="w-16 flex items-center justify-end gap-1 text-muted-foreground/70">
        <Pencil size={11} />
        <PauseCircle size={11} />
        <History size={11} />
      </div>
    </div>
  );
}

function FilaCircuito({
  codigo,
  origen,
  destino,
  carga,
  vacio,
}: {
  codigo: string;
  origen: string;
  destino: string;
  carga: string;
  vacio: string;
}) {
  return (
    <div className="px-3 py-2 flex items-center gap-2 text-[11px] border-b border-border last:border-0">
      <span className="w-10 font-mono text-muted-foreground">{codigo}</span>
      <span className="flex-1 inline-flex items-center gap-1 text-foreground truncate">
        {origen}
        <ArrowRight size={11} className="text-muted-foreground/70 shrink-0" />
        {destino}
      </span>
      <span className="w-12 text-right font-mono text-foreground">{carga}</span>
      <span className="w-12 text-right font-mono text-foreground">{vacio}</span>
      <div className="w-14 flex items-center justify-end gap-1 text-muted-foreground/70">
        <Pencil size={11} />
        <PauseCircle size={11} />
      </div>
    </div>
  );
}

function EventoHistorial({
  usuario,
  fecha,
  accion,
  accionColor,
  campo,
  antes,
  despues,
}: {
  usuario: string;
  fecha: string;
  accion: string;
  accionColor: string;
  campo: string;
  antes?: string;
  despues: string;
}) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="size-5 rounded-full bg-[#E1F5FE] inline-flex items-center justify-center shrink-0">
            <User size={10} className="text-primary" />
          </span>
          <span className="text-[11px] font-medium text-foreground truncate">
            {usuario}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span
            className={`text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${accionColor}`}
          >
            {accion}
          </span>
          <span className="text-[9px] text-muted-foreground">{fecha}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        <span className="text-muted-foreground font-medium">{campo}:</span>
        {antes !== undefined && (
          <>
            <span className="font-mono bg-[#FEF2F2] text-[#7F1D1D] px-1.5 py-0.5 rounded border border-[#FECACA]">
              {antes}
            </span>
            <ArrowRight size={11} className="text-muted-foreground/70" />
          </>
        )}
        <span className="font-mono bg-[#ECFDF5] text-[#064E3B] px-1.5 py-0.5 rounded border border-[#A7F3D0]">
          {despues}
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 1 — Calculadora
// ===========================================================================

function MockSeccionesTabs() {
  const tabs = [
    { label: "Calculadora", icon: <Calculator size={12} />, active: true },
    { label: "Tarifas por cliente", icon: <Users size={12} />, active: false },
    { label: "Circuitos", icon: <Route size={12} />, active: false },
    { label: "Ajustes globales", icon: <Settings size={12} />, active: false },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <div
            key={t.label}
            className={
              "relative flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-medium whitespace-nowrap " +
              (t.active ? "text-primary" : "text-muted-foreground")
            }
          >
            {t.icon}
            {t.label}
            {t.active && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#0088D1]" />
            )}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground/80 px-1">
        Cambiás de sección desde estas 4 pestañas.
      </div>
    </div>
  );
}

function MockCalcCampos() {
  return (
    <div className="space-y-2.5">
      <MockField label="Cliente" value="Don Joaquín SA" required />
      <MockField
        label="Ruta"
        value="Necochea → Bahía Blanca (280 km)"
        icon={<Route size={11} />}
      />
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-1.5">
        Sin cliente, la calculadora usa los <b>parámetros globales</b>.
      </div>
    </div>
  );
}

function MockCalcPesoKm() {
  return (
    <div className="space-y-2.5">
      <MockField label="Peso carga" value="28.000 kg" icon={<Weight size={11} />} />
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">
          Distancia
        </div>
        <div className="h-7 px-2 text-[11px] rounded border border-border bg-muted/40 text-muted-foreground/70 inline-flex items-center gap-1.5 w-full">
          <Route size={11} /> 280 (auto) km
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
          Con una ruta elegida se usan sus KM oficiales y el campo queda bloqueado.
        </div>
      </div>
    </div>
  );
}

function MockCalcResultado() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Total
        </span>
        <span className="text-xl font-bold font-mono text-foreground">
          ARS 70.000,00
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Por kilo — 2,50 × 28.000 kg
      </p>
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px] bg-[#ECFDF5] text-[#064E3B] border border-[#A7F3D0]">
        <Zap size={12} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Tarifa contractual aplicada</p>
          <p className="mt-0.5">Don Joaquín SA · Necochea → Bahía Blanca</p>
        </div>
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] bg-[#FFFBEB] text-[#78350F] border border-[#FCD34D]">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          Si el cliente no tiene tarifa activa, cae a los <b>parámetros globales</b>.
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Tarifas por cliente
// ===========================================================================

function MockTarifaTable() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Don Joaquín SA
        </span>
        <span className="text-[10px] text-muted-foreground/70">2 tarifas</span>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-3">
          <span className="flex-1">Ruta</span>
          <span className="w-16">Modalidad</span>
          <span className="w-14 text-right">Valor</span>
          <span className="w-14">Estado</span>
          <span className="w-16 text-right">Acciones</span>
        </div>
        <FilaTarifa
          ruta="Necochea → Bahía Blanca"
          modalidad="Por kilo"
          valor="$ 2,50"
          activa
        />
        <FilaTarifa
          ruta="Sin ruta específica"
          modalidad="Por tonelada"
          valor="$ 3.200"
          activa={false}
        />
      </div>
    </div>
  );
}

function MockToolbarTarifas() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[140px]">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
        />
        <div className="h-8 pl-7 pr-2 bg-card border-2 border-[#0088D1] rounded-md text-[11px] text-foreground inline-flex items-center w-full shadow-[0_0_0_3px_rgba(0,136,209,0.12)]">
          don joaquín
        </div>
      </div>
      <div className="h-8 px-2.5 bg-card border border-border rounded-md text-[11px] text-muted-foreground inline-flex items-center">
        Todas las modalidades ▾
      </div>
      <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="size-3.5 rounded border-2 border-[#0088D1] bg-[#0088D1] inline-flex items-center justify-center">
          <CheckCircle2 size={9} className="text-white" />
        </span>
        Solo activas
      </label>
      <div className="h-8 px-3 rounded-md bg-[#0088D1] text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white">
        <Plus size={12} /> Nueva tarifa
      </div>
    </div>
  );
}

function MockModalTarifaCampos() {
  const mods = ["Fija", "Por tonelada", "Por kilo", "Por km"];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Coins size={13} />
        </span>
        <span className="text-[11px] font-bold text-foreground">Nueva tarifa</span>
      </div>
      <div className="p-3 space-y-2.5">
        <MockField label="Cliente *" value="Don Joaquín SA" required />
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">
            Modalidad *
          </div>
          <div className="flex flex-wrap gap-1">
            {mods.map((m) => (
              <span
                key={m}
                className={
                  "px-2 py-0.5 rounded text-[10px] font-medium " +
                  (m === "Por kilo"
                    ? "bg-[#0088D1] text-white"
                    : "bg-muted text-muted-foreground")
                }
              >
                {m}
              </span>
            ))}
          </div>
        </div>
        <MockField
          label="Ruta"
          value="Necochea → Bahía Blanca"
          icon={<Route size={11} />}
        />
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800 px-2.5 py-1.5">
          La ruta es <b>obligatoria</b> para modalidad Fija y Por km.
        </div>
      </div>
    </div>
  );
}

function MockModalTarifaValor() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <MockField
          label="Valor ($/kg) *"
          value="$ 2,50"
          icon={<DollarSign size={11} />}
          required
        />
        <MockField label="Moneda *" value="ARS" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MockField
          label="Vigencia desde *"
          value="16/07/2026"
          icon={<Calendar size={11} />}
          required
        />
        <MockField
          label="Vigencia hasta"
          value="Opcional"
          icon={<Calendar size={11} />}
        />
      </div>
      <div className="flex justify-end pt-1.5 border-t border-border">
        <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
          <CheckCircle2 size={11} /> Crear tarifa
        </div>
      </div>
    </div>
  );
}

function MockAccionesLegend() {
  const items = [
    {
      icon: <Pencil size={12} />,
      label: "Editar",
      desc: "Reabre el modal precargado.",
      tone: "primary" as const,
    },
    {
      icon: <PauseCircle size={12} />,
      label: "Activar / pausar",
      desc: "Cambia el estado sin borrar la tarifa.",
      tone: "amber" as const,
    },
    {
      icon: <History size={12} />,
      label: "Historial",
      desc: "Quién cambió qué y cuándo.",
      tone: "primary" as const,
    },
  ];
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
        >
          <span
            className={
              "size-7 rounded-md inline-flex items-center justify-center shrink-0 " +
              (it.tone === "amber"
                ? "bg-amber-50 text-amber-600"
                : "bg-[#E1F5FE] text-primary")
            }
          >
            {it.icon}
          </span>
          <div>
            <div className="text-[11px] font-semibold text-foreground">
              {it.label}
            </div>
            <div className="text-[10px] text-muted-foreground">{it.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// TAB 3 — Circuitos
// ===========================================================================

function MockCircuitoQueEs() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <MapPin size={12} className="text-primary" /> Necochea
          </span>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <ArrowRight size={16} className="text-primary" />
          <span className="text-[9px] text-muted-foreground">280 km carga</span>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Flag size={12} className="text-primary" /> Bahía Blanca
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <ArrowRight size={12} className="rotate-180" /> 60 km de retorno vacío
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Al cargar un viaje con este circuito, los{" "}
        <b>km cargados y vacíos se autocompletan</b>.
      </div>
    </div>
  );
}

function MockCircuitoForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Route size={13} />
        </span>
        <span className="text-[11px] font-bold text-foreground">Nuevo circuito</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Origen *" value="Necochea" icon={<MapPin size={11} />} required />
          <MockField label="Destino *" value="Bahía Blanca" icon={<Flag size={11} />} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Km con carga *" value="280" required />
          <MockField label="Km vacíos *" value="60" required />
        </div>
        <MockField label="Código interno" value="110 (opcional)" />
        <div className="flex justify-end pt-1.5 border-t border-border">
          <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            <CheckCircle2 size={11} /> Crear circuito
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCircuitoTable() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-2">
        <span className="w-10">Cód.</span>
        <span className="flex-1">Recorrido</span>
        <span className="w-12 text-right">Carga</span>
        <span className="w-12 text-right">Vacío</span>
        <span className="w-14 text-right">Acciones</span>
      </div>
      <FilaCircuito
        codigo="110"
        origen="Necochea"
        destino="Bahía Blanca"
        carga="280"
        vacio="60"
      />
      <FilaCircuito
        codigo="112"
        origen="Mar del Plata"
        destino="CABA"
        carga="400"
        vacio="120"
      />
    </div>
  );
}

function MockCircuitoListado() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
          />
          <div className="h-8 pl-7 pr-2 bg-card border border-border rounded-md text-[11px] text-muted-foreground/70 inline-flex items-center w-full">
            Buscar por código, origen, destino…
          </div>
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-3.5 rounded border border-border inline-flex" />
          Solo activos
        </label>
        <div className="h-8 px-3 rounded-md bg-[#0088D1] text-white text-[11px] font-bold inline-flex items-center gap-1">
          <Plus size={12} /> Nuevo circuito
        </div>
      </div>
      <MockCircuitoTable />
    </div>
  );
}

function MockCircuitoAcciones() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
        <span className="size-7 rounded-md bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
          <Pencil size={12} />
        </span>
        <div>
          <div className="text-[11px] font-semibold text-foreground">Editar</div>
          <div className="text-[10px] text-muted-foreground">
            Cambiás recorrido, km cargados/vacíos o el código.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
        <span className="size-7 rounded-md bg-amber-50 text-amber-600 inline-flex items-center justify-center shrink-0">
          <PauseCircle size={12} />
        </span>
        <div>
          <div className="text-[11px] font-semibold text-foreground">
            Activar / pausar
          </div>
          <div className="text-[10px] text-muted-foreground">
            Un circuito inactivo deja de ofrecerse al cargar viajes.
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 4 — Ajustes y auditoría
// ===========================================================================

function MockAjustesGlobales() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-[300px] mx-auto">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Settings size={13} className="text-primary" />
        <div className="text-[11px] font-bold text-foreground">Ajustes de tarifa</div>
      </div>
      <div className="p-3 space-y-2">
        <MockField label="Tarifa base ($)" value="500,00" />
        <MockField label="Precio por kg ($)" value="2,00" />
        <MockField label="Precio por km ($)" value="180,00" />
        <div className="h-7 rounded-md bg-[#0088D1] text-white text-[10px] font-bold inline-flex items-center justify-center gap-1 w-full">
          <Save size={11} /> Guardar ajustes
        </div>
      </div>
    </div>
  );
}

function MockHistorialDrawer() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-[360px] mx-auto">
      <div className="bg-gradient-to-r from-[#0088D1] to-[#0077B6] text-white px-3 py-2 flex items-center gap-1.5">
        <History size={13} />
        <span className="text-[11px] font-bold">Historial de tarifa</span>
      </div>
      <div className="p-2.5 space-y-2">
        <EventoHistorial
          usuario="Lucas G."
          fecha="16/07 · 10:24"
          accion="Edición"
          accionColor="bg-[#EFF6FF] text-[#1E3A8A]"
          campo="Valor"
          antes="2,00"
          despues="2,50"
        />
        <EventoHistorial
          usuario="María R."
          fecha="01/03 · 09:10"
          accion="Estado"
          accionColor="bg-[#FFFBEB] text-[#78350F]"
          campo="Activa"
          antes="No"
          despues="Sí"
        />
        <EventoHistorial
          usuario="Lucas G."
          fecha="10/01 · 16:40"
          accion="Creación"
          accionColor="bg-[#ECFDF5] text-[#064E3B]"
          campo="Valor"
          despues="1,80"
        />
      </div>
    </div>
  );
}

function MockSoloLectura() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 flex items-start gap-2">
        <Lock size={13} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-900">
          <p className="font-semibold">Solo lectura</p>
          <p className="mt-0.5 text-amber-800">
            Sin permiso de <b>edición sobre Comercial</b> ves los valores, pero no
            aparece el botón de guardar.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card px-3 py-2 opacity-60">
        <MockField label="Tarifa base ($)" value="500,00" />
      </div>
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "calculadora",
    label: "Calculadora",
    icon: <Calculator size={14} />,
    steps: [
      {
        title: "Las 4 pestañas de Tarifas",
        description:
          "La pantalla abre en la Calculadora y arriba tenés 4 secciones: Calculadora, Tarifas por cliente, Circuitos y Ajustes globales. El botón Tutorial está a la derecha de estas pestañas.",
        mockup: <MockSeccionesTabs />,
      },
      {
        title: "Elegí cliente y ruta",
        description:
          "Buscás el cliente y, si querés, una ruta. Si el cliente tiene una tarifa propia para esa combinación, se usa esa; si no elegís cliente, la calculadora cae directo a los parámetros globales.",
        mockup: <MockCalcCampos />,
        hint: "Cliente y ruta son comboboxes con buscador: escribí las primeras letras y filtra al toque.",
      },
      {
        title: "Cargá el peso y la distancia",
        description:
          "Poné el peso de la carga en kg. La distancia la escribís a mano solo si no elegiste ruta: en cuanto seleccionás una ruta, el sistema usa sus KM oficiales y bloquea el campo.",
        mockup: <MockCalcPesoKm />,
        hint: "Para los KM siempre prevalecen los oficiales de la ruta por sobre lo que cargues a mano.",
      },
      {
        title: "Leé el resultado",
        description:
          "Apretás Calcular tarifa y te muestra el total, el desglose de cómo se llegó a ese número y de dónde salió: tarifa contractual del cliente (verde) o parámetros globales (ámbar).",
        mockup: <MockCalcResultado />,
        hint: "El cartel ámbar te avisa cuando el cliente no tenía tarifa activa y se usó el respaldo global.",
      },
    ],
  },
  {
    id: "tarifas",
    label: "Tarifas",
    icon: <Users size={14} />,
    steps: [
      {
        title: "El listado por cliente",
        description:
          "Las tarifas se agrupan por cliente. En cada fila ves la ruta, la modalidad, el valor, la vigencia, el estado (activa/inactiva) y los botones de acción.",
        mockup: <MockTarifaTable />,
      },
      {
        title: "Buscá y filtrá",
        description:
          "El buscador cruza cliente, ruta y observaciones. Sumá el filtro por modalidad y el check “Solo activas” para llegar rápido a lo que necesitás entre muchas tarifas.",
        mockup: <MockToolbarTarifas />,
        hint: "El botón “Nueva tarifa” solo aparece si tenés permiso de edición sobre Comercial.",
      },
      {
        title: "Nueva tarifa: cliente, modalidad y ruta",
        description:
          "Con “Nueva tarifa” se abre un modal centrado. Elegís el cliente, la modalidad (Fija, Por tonelada, Por kilo o Por km) y la ruta. Para Fija y Por km la ruta es obligatoria.",
        mockup: <MockModalTarifaCampos />,
        hint: "La modalidad define cómo se cobra: fija = monto único; por tonelada/kilo/km = valor × la cantidad.",
      },
      {
        title: "Valor, moneda y vigencia",
        description:
          "Cargás el valor (la unidad se ajusta sola a la modalidad: $/kg, $/t, $/km), la moneda, y desde cuándo rige. La “Vigencia hasta” es opcional; si la dejás vacía, queda vigente indefinidamente.",
        mockup: <MockModalTarifaValor />,
        hint: "Si ponés fecha hasta, tiene que ser posterior a la fecha desde, o el sistema no te deja guardar.",
      },
      {
        title: "Editar, pausar y ver historial",
        description:
          "Cada fila tiene tres botones: el lápiz reabre el modal para editar, el de pausa/check activa o desactiva la tarifa sin borrarla, y el reloj abre el historial de cambios.",
        mockup: <MockAccionesLegend />,
        hint: "Una tarifa inactiva no se usa en cálculos, pero queda guardada para auditoría.",
      },
    ],
  },
  {
    id: "circuitos",
    label: "Circuitos",
    icon: <Route size={14} />,
    steps: [
      {
        title: "Qué es un circuito",
        description:
          "Un circuito es un tramo origen → destino con sus km cargados y sus km vacíos típicos. Sirve para no recalcular a mano cada viaje.",
        mockup: <MockCircuitoQueEs />,
        hint: "Al cargar un viaje con este circuito, los km cargados y vacíos se autocompletan.",
      },
      {
        title: "Cargá un circuito nuevo",
        description:
          "Con “Nuevo circuito” elegís origen y destino (con autocompletado de lugares ya usados), los km con carga y los km vacíos. El código interno y la descripción son opcionales.",
        mockup: <MockCircuitoForm />,
        hint: "Origen y destino tienen que ser distintos, y los km no pueden ser negativos.",
      },
      {
        title: "El listado de circuitos",
        description:
          "La tabla muestra código, recorrido, km con carga, km vacíos y estado. Arriba tenés el buscador (código, origen o destino) y el check “Solo activos”.",
        mockup: <MockCircuitoListado />,
      },
      {
        title: "Editar o pausar un circuito",
        description:
          "Igual que las tarifas: el lápiz edita el circuito y el botón de pausa/check lo activa o desactiva. Nada se borra, solo cambia de estado.",
        mockup: <MockCircuitoAcciones />,
      },
    ],
  },
  {
    id: "ajustes",
    label: "Ajustes",
    icon: <Settings size={14} />,
    steps: [
      {
        title: "Ajustes globales de respaldo",
        description:
          "Son los valores base: tarifa base, precio por kg y precio por km. La calculadora los usa cuando el cliente no tiene una tarifa propia cargada para esa combinación.",
        mockup: <MockAjustesGlobales />,
      },
      {
        title: "Historial de cada tarifa",
        description:
          "Desde el reloj de una tarifa se abre un panel lateral con todos los cambios: quién lo hizo, cuándo, el tipo de acción (Creación, Edición, Estado, Baja) y el valor de antes → después.",
        mockup: <MockHistorialDrawer />,
        hint: "Es un registro de auditoría: se ve todo lo que pasó, no se edita ni se borra.",
      },
      {
        title: "Cuando es solo lectura",
        description:
          "Si tu usuario no tiene edición sobre Comercial, vas a ver los ajustes y las tarifas, pero sin los botones para guardar ni crear. Pedile el permiso a un administrador.",
        mockup: <MockSoloLectura />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Tarifas" tabs={TABS} />;
}
