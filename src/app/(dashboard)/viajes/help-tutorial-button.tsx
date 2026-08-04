"use client";

import HelpTutorialDialog, {
  type TutorialTab,
  type TutorialStep,
} from "@/components/help/HelpTutorialDialog";
import {
  HelpCircle,
  Plus,
  SlidersHorizontal,
  Workflow,
  Eye,
  MapPin,
  Truck,
  Receipt,
  FileText,
  X,
  Upload,
  Paperclip,
} from "lucide-react";

// =============================================================================
// Helpers de mockup (todos a nivel de módulo)
// =============================================================================

function MockField({
  label,
  value,
  required,
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[11px] rounded border bg-card text-foreground inline-flex items-center w-full " +
          (required ? "border-[#0088D1]/60" : "border-border")
        }
      >
        {value}
      </div>
    </div>
  );
}

function MockToolbar({ highlight }: { highlight: "new" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-9 bg-card border border-border rounded-md px-3 text-xs text-muted-foreground/70 inline-flex items-center">
        Viajes — Núcleo operativo
      </div>
      <div className="size-9 rounded-md border border-border bg-card text-primary inline-flex items-center justify-center">
        <HelpCircle size={14} />
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1">
        Importar
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 " +
          (highlight === "new"
            ? "bg-[#0088D1] text-white shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-2 ring-[#0088D1]"
            : "bg-[#0088D1] text-white")
        }
      >
        <Plus size={12} /> Nuevo viaje
      </div>
    </div>
  );
}

function MockFecha() {
  return (
    <div className="max-w-[420px] mx-auto">
      <MockField label="Fecha del viaje *" value="13/05/2026" required />
    </div>
  );
}

function MockRelaciones() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <MockField label="Cliente *" value="Ejemplo S.A." required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <MockField label="Chofer *" value="Grodz, Lucas" required />
        <MockField label="Camión *" value="AB 123 CD" required />
      </div>
    </div>
  );
}

function MockRuta() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <MockField label="Tipo de carga *" value="Cemento a granel" required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Origen</div>
          <div className="h-7 px-2 text-[11px] rounded border border-border bg-card text-muted-foreground/70 inline-flex items-center gap-1 w-full">
            <MapPin size={10} className="text-primary" /> LOMASER
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Destino</div>
          <div className="h-7 px-2 text-[11px] rounded border border-border bg-card text-muted-foreground/70 inline-flex items-center gap-1 w-full">
            <MapPin size={10} className="text-[#EF4444]" /> LOMA NEGRA
          </div>
        </div>
      </div>
    </div>
  );
}

function MockMetricas() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <MockField label="Km con carga" value="320" />
        <MockField label="Km vacíos" value="85" />
        <MockField label="Tonelaje (tn)" value="35.00" />
      </div>
      <div className="bg-[#E1F5FE] text-[#004A99] text-[11px] px-3 py-1.5 rounded-md flex items-center gap-2">
        <Truck size={12} />
        Total: 405 km recorridos · 35 tn
      </div>
    </div>
  );
}

function MockViajeGuardado() {
  return (
    <div className="bg-card border border-border rounded-md overflow-x-auto">
      <div className="min-w-[420px] px-3 py-1.5 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-4">
        <span className="w-24">Fecha</span>
        <span className="flex-1">Origen → Destino</span>
        <span className="w-16 text-right">KM</span>
        <span className="w-24">Remito</span>
        <span className="w-8"></span>
      </div>
      <div className="min-w-[420px] px-3 py-2.5 flex items-center gap-4 text-[11px] bg-[#F0FFF4]">
        <span className="w-24 text-muted-foreground">13/05/2026</span>
        <span className="flex-1 text-foreground font-medium">LOMASER → LOMA NEGRA</span>
        <span className="w-16 text-right font-mono text-foreground">405 km</span>
        <span className="w-24">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
            Sin remito
          </span>
        </span>
        <button className="size-6 rounded inline-flex items-center justify-center text-primary">
          <Eye size={12} />
        </button>
      </div>
    </div>
  );
}

function MockFiltroFechas() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="h-9 px-3 bg-card border-2 border-[#0088D1] rounded-md text-xs text-foreground inline-flex items-center shadow-[0_0_0_3px_rgba(0,136,209,0.15)] font-mono">
        01/05/2026
      </div>
      <span className="text-muted-foreground text-xs">hasta</span>
      <div className="h-9 px-3 bg-card border-2 border-[#0088D1] rounded-md text-xs text-foreground inline-flex items-center shadow-[0_0_0_3px_rgba(0,136,209,0.15)] font-mono">
        13/05/2026
      </div>
      <div className="flex-1 h-9 bg-card border border-border rounded-md px-3 text-xs text-muted-foreground/70 inline-flex items-center">
        Buscar por código...
      </div>
    </div>
  );
}

function MockFiltroCodigo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground/70 inline-flex items-center w-28">
        Fecha desde
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground/70 inline-flex items-center w-28">
        Fecha hasta
      </div>
      <div className="h-9 px-3 bg-card border-2 border-[#0088D1] rounded-md text-xs text-foreground inline-flex items-center font-mono shadow-[0_0_0_3px_rgba(0,136,209,0.15)] flex-1">
        V-2026-00042
      </div>
    </div>
  );
}

function MockLimpiarFiltros() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground/70 inline-flex items-center font-mono">
        01/05/2026
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground/70 inline-flex items-center font-mono">
        13/05/2026
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground/70 inline-flex items-center font-mono">
        V-2026-00042
      </div>
      <div className="h-9 px-3 bg-card border-2 border-[#EF4444]/50 rounded-md text-xs text-[#EF4444] inline-flex items-center gap-1 font-semibold shadow-[0_0_0_3px_rgba(239,68,68,0.1)]">
        <X size={12} /> Limpiar filtros
      </div>
    </div>
  );
}

// Tres tarjetas del encabezado (Total · Sin remito · Vueltas en vacío).
function MockTarjetas() {
  const cards = [
    { k: "Viajes registrados", v: "1.430", c: "#0088D1", active: true },
    { k: "Sin remito", v: "793", c: "#EF4444", active: false },
    { k: "Vueltas en vacío", v: "516", c: "#64748B", active: false },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((c) => (
        <div
          key={c.k}
          className="relative overflow-hidden rounded-xl border border-border bg-card px-3 pt-2.5 pb-4"
          style={c.active ? { boxShadow: `0 0 0 2px ${c.c}`, borderColor: "transparent" } : undefined}
        >
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground truncate">{c.k}</div>
          <div className="text-xl font-black leading-tight" style={{ color: c.c }}>{c.v}</div>
          <span
            className="absolute inset-x-0 bottom-0 h-1.5"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, ${c.c} 0 6px, transparent 6px 11px)`,
              opacity: 0.5,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Flujo simple: cargás el viaje, le agregás el remito, queda facturado.
function MockFlujo() {
  const steps = [
    { label: "Cargar viaje", c: "#0088D1" },
    { label: "Agregar remito", c: "#10B981" },
    { label: "Facturado ✓", c: "#10B981" },
  ];
  return (
    <div className="flex items-center gap-2 justify-center flex-wrap">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold border"
            style={{ color: s.c, borderColor: `${s.c}66`, background: `${s.c}14` }}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground/70 text-sm">→</span>}
        </div>
      ))}
    </div>
  );
}

// El botón "Agregar remito" en la fila expandida de un viaje sin facturar.
function MockBotonRemito() {
  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-4 text-[11px] bg-muted/40 border-b border-border">
          <span className="flex-1 font-mono text-foreground">V-2026-00041</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
            Sin remito
          </span>
        </div>
        <div className="px-4 py-3 bg-muted/60">
          <div className="h-8 px-2.5 text-[12px] rounded border border-green-400 bg-green-50 text-green-700 font-bold inline-flex items-center gap-1.5 shadow-[0_0_0_3px_rgba(34,197,94,0.15)] w-full justify-center">
            <Receipt size={13} /> Agregar remito
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Aparece en cualquier viaje <strong>sin remito</strong> (no vacío)
      </p>
    </div>
  );
}

function MockAgregarRemito() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
      <p className="font-semibold text-foreground flex items-center gap-1.5">
        <Receipt size={13} className="text-[#10B981]" /> Agregar remito · V-2026-01456
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-md border border-border px-2 py-1">
          <span className="text-muted-foreground">Nº remito</span>
          <div className="font-mono text-foreground">0813R00281660</div>
        </div>
        <div className="rounded-md border border-border px-2 py-1">
          <span className="text-muted-foreground">Importe / factura</span>
          <div className="font-semibold text-foreground">$ 794.527</div>
        </div>
      </div>
      <div className="rounded-md border border-border px-2 py-1">
        <span className="text-muted-foreground">Toneladas</span>
        <div className="text-foreground">34,6 tn</div>
      </div>
      <div className="flex gap-2 pt-1 justify-end">
        <span className="text-center rounded-md border border-border text-muted-foreground py-1 px-3">
          Cancelar
        </span>
        <span className="text-center rounded-md bg-[#10B981] text-white py-1 px-3 font-semibold">
          Guardar remito
        </span>
      </div>
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 text-xs">
      <div className="rounded-md border-2 border-dashed border-border px-3 py-2.5 text-center text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Upload size={13} className="text-[#0088D1]" /> Arrastrá el remito acá o hacé clic para elegirlo
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
          <Paperclip size={11} /> Adjuntos
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
          <FileText size={11} /> remito-0813.pdf
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
          <FileText size={11} /> factura-A0001.pdf
        </span>
        <span className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <Plus size={11} /> Adjuntar
        </span>
      </div>
    </div>
  );
}

function MockRemitoBloque() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden text-[11px]">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-muted/40">
        <Receipt size={13} className="text-[#10B981]" />
        <span className="font-semibold text-foreground">Agregar remito a 3 viajes</span>
      </div>
      <div className="divide-y divide-border">
        {[
          { c: "V-2026-00040", r: "0813R00281660", m: "$ 794.527" },
          { c: "V-2026-00041", r: "0813R00281744", m: "$ 512.300" },
          { c: "V-2026-00042", r: "0813R00281802", m: "$ 638.900" },
        ].map((row) => (
          <div key={row.c} className="px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-foreground w-24">{row.c}</span>
            <span className="min-w-[8rem] flex-1 rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground truncate">
              {row.r}
            </span>
            <span className="w-20 text-right font-semibold text-foreground">{row.m}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border flex justify-end">
        <span className="h-7 px-3 rounded-md bg-[#10B981] text-white inline-flex items-center gap-1 font-bold">
          <Receipt size={11} /> Agregar remito (3)
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Solapa: Ciclo completo
// =============================================================================

const CICLO_STEPS: TutorialStep[] = [
  {
    title: "El ciclo completo del viaje",
    description:
      "De principio a fin: cargás el viaje y, cuando tenés el remito firmado, se lo agregás con su importe y su PDF o foto — todo en el mismo paso. Con el importe cargado el viaje queda facturado y listo — no hay un paso de cobro aparte.",
    mockup: <MockFlujo />,
  },
  {
    title: "1. Cargar el viaje",
    description:
      'Usá "Nuevo viaje" (o Carga rápida para varios a la vez). Al elegir el chofer, el camión se autocompleta con la unidad del día de la Planilla diaria — y siempre lo podés cambiar a mano.',
    mockup: <MockToolbar highlight="new" />,
    hint: "También pueden entrar por los importadores (Hoja de ruta / YPF / Loma).",
  },
  {
    title: "2. Agregar el remito y el valor",
    description:
      'Cuando el chofer entrega y tenés el remito firmado, expandí la fila del viaje y tocá "Agregar remito": cargás el Nº de remito, el importe del flete y las toneladas. Con el importe cargado queda facturado de una.',
    mockup: <MockAgregarRemito />,
    hint: "La liquidación de Loma o el DM de YPF también completan estos datos solos.",
  },
  {
    title: "3. Adjuntar documentos",
    description:
      "El PDF o la foto del remito se adjunta en el mismo diálogo de \"Agregar remito\" (hasta 100 MB). Los adjuntos quedan como chips arriba del detalle del viaje: desde ahí los abrís, sumás más (una factura u otro comprobante) o los borrás.",
    mockup: <MockDocumentos />,
  },
  {
    title: "4. Agregar remito en bloque",
    description:
      'Desde el listado, seleccioná varios viajes con el casillero y usá "Agregar remito": cargás el remito y el importe de cada uno y quedan facturados de una.',
    mockup: <MockRemitoBloque />,
    hint: "Ideal cuando llegan varios remitos juntos.",
  },
];

// =============================================================================
// Solapa: Nuevo viaje
// =============================================================================

const NUEVO_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Nuevo viaje"',
    description:
      'Arriba a la derecha del encabezado, hacé clic en el botón "Nuevo viaje". Se abre un panel lateral con todos los campos.',
    mockup: <MockToolbar highlight="new" />,
  },
  {
    title: "Elegí la fecha",
    description:
      "La fecha por defecto es hoy. No hace falta marcar ningún estado: el viaje queda registrado y esperando su remito.",
    mockup: <MockFecha />,
    hint: "El código correlativo (ej. V-2026-00001) se genera solo al guardar.",
  },
  {
    title: "Asociá cliente, chofer y camión",
    description:
      "Los tres son obligatorios. Los selects cargan solo entidades activas. Al elegir el chofer, el camión se autocompleta con su unidad del día (Planilla diaria) y lo podés cambiar a mano.",
    mockup: <MockRelaciones />,
    hint: "Si no aparece el chofer o camión que buscás, verificá que esté activo en su sección.",
  },
  {
    title: "Elegí tipo de carga y ruta",
    description:
      "El tipo de carga (granos, cemento, etc.) es obligatorio. Origen y destino son opcionales: si la ruta no está en catálogo, podés dejarlo vacío y completarlo después.",
    mockup: <MockRuta />,
  },
  {
    title: "Cargá los kilómetros, tonelaje y flete",
    description:
      "Km con carga + km vacíos = total recorrido del viaje. El tonelaje real es el peso efectivamente transportado. Más abajo podés cargar el monto de flete (ARS) del viaje.",
    mockup: <MockMetricas />,
    hint: "El sistema suma km con carga + km vacíos para el total. Si hay desvíos no computables (ej. regreso a domicilio del chofer), se cargan desde la ficha del viaje.",
  },
  {
    title: "Guardar y seguir",
    description:
      'Apretá "Guardar viaje". El código correlativo (ej. V-2026-00001) se genera automáticamente. El viaje aparece en la tabla marcado "Sin remito" hasta que le cargues el remito y el importe.',
    mockup: <MockViajeGuardado />,
    hint: 'Desde la ficha del viaje podés agregar remitos, facturas, cartas de porte y viáticos. El botón "Ver" (ojo) en la tabla te lleva directo.',
  },
];

// =============================================================================
// Solapa: Filtros
// =============================================================================

const FILTROS_STEPS: TutorialStep[] = [
  {
    title: "Filtrá con las tarjetas de arriba",
    description:
      "Las 3 tarjetas del encabezado (Viajes registrados, Sin remito y Vueltas en vacío) son botones: hacé clic en una y el listado queda filtrado. Volvé a clickearla para limpiar.",
    mockup: <MockTarjetas />,
    hint: 'La tarjeta activa muestra un chip "Filtrado por…" arriba del listado, con una X para sacarlo.',
  },
  {
    title: "Filtrá por rango de fechas",
    description:
      'Los campos "Fecha desde" y "Fecha hasta" acotan la búsqueda al período que necesitás. Podés usar uno solo o los dos.',
    mockup: <MockFiltroFechas />,
    hint: "Ideal para buscar todos los viajes de una semana o un mes específico.",
  },
  {
    title: "Buscá por código, chofer o camión",
    description:
      'El campo de texto filtra por código correlativo (ej. "V-2026-00042"), nombre de chofer o patente. Útil cuando te pasan un dato puntual.',
    mockup: <MockFiltroCodigo />,
  },
  {
    title: "Limpiar filtros",
    description:
      'Cuando hay algún filtro activo, aparece el botón "Limpiar filtros" que resetea todo de una vez.',
    mockup: <MockLimpiarFiltros />,
  },
];

// =============================================================================
// Solapa: Remito
// =============================================================================

const REMITO_STEPS: TutorialStep[] = [
  {
    title: 'El botón "Agregar remito"',
    description:
      'Expandí la fila de un viaje sin remito y tocá el botón verde "Agregar remito". Se abre el diálogo para cargar el Nº de remito, el importe y las toneladas.',
    mockup: <MockBotonRemito />,
  },
  {
    title: "Cargar el remito y el valor",
    description:
      "Con el importe cargado, el viaje pasa de “Sin remito” (rojo) a “Con remito” y queda facturado y listo. Sin importe se guarda el remito, pero el viaje sigue sin facturar.",
    mockup: <MockAgregarRemito />,
    hint: "La liquidación de Loma o el DM de YPF también completan estos datos solos.",
  },
  {
    title: "Varios remitos de una",
    description:
      'Cuando llegan varios remitos juntos, seleccioná los viajes con el casillero de la izquierda y usá "Agregar remito" en la barra de arriba: cargás todos en una sola pasada.',
    mockup: <MockRemitoBloque />,
  },
  {
    title: "Adjuntar el comprobante",
    description:
      "En el mismo diálogo podés arrastrar el PDF o la foto del remito. Después quedan como chips arriba del detalle del viaje, donde también podés sumar la factura u otros comprobantes, abrirlos o borrarlos.",
    mockup: <MockDocumentos />,
  },
];

// =============================================================================
// Tabs
// =============================================================================

const TABS: TutorialTab[] = [
  { id: "ciclo", label: "Ciclo completo", icon: <Workflow size={14} />, steps: CICLO_STEPS },
  { id: "nuevo", label: "Nuevo viaje", icon: <Plus size={14} />, steps: NUEVO_STEPS },
  { id: "filtros", label: "Filtros", icon: <SlidersHorizontal size={14} />, steps: FILTROS_STEPS },
  { id: "remito", label: "Remito", icon: <Receipt size={14} />, steps: REMITO_STEPS },
];

export default function HelpTutorialButton({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  return (
    <HelpTutorialDialog title="Guía de viajes" tabs={TABS} triggerClassName={triggerClassName} />
  );
}
