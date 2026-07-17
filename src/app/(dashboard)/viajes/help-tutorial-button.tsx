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
  CircleDot,
  Eye,
  MapPin,
  Truck,
  Coins,
  Receipt,
  FileText,
  X,
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

function MockFechaEstado() {
  return (
    <div className="grid grid-cols-2 gap-3 max-w-[420px] mx-auto">
      <MockField label="Fecha del viaje *" value="13/05/2026" required />
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Estado *</div>
        <div className="h-7 px-2 text-[11px] rounded border border-border bg-card text-foreground inline-flex items-center w-full">
          Pendiente ▾
        </div>
      </div>
    </div>
  );
}

function MockRelaciones() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <MockField label="Cliente *" value="Ejemplo S.A." required />
      <div className="grid grid-cols-2 gap-2">
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
      <div className="grid grid-cols-2 gap-2">
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
      <div className="grid grid-cols-3 gap-2">
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
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-4">
        <span className="w-24">Fecha</span>
        <span className="flex-1">Origen → Destino</span>
        <span className="w-16 text-right">KM</span>
        <span className="w-20">Estado</span>
        <span className="w-8"></span>
      </div>
      <div className="px-3 py-2.5 flex items-center gap-4 text-[11px] bg-[#F0FFF4]">
        <span className="w-24 text-muted-foreground">13/05/2026</span>
        <span className="flex-1 text-foreground font-medium">LOMASER → LOMA NEGRA</span>
        <span className="w-16 text-right font-mono text-foreground">405 km</span>
        <span className="w-20 text-[#F59E0B] font-medium flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[#F59E0B] inline-block" />
          Pendiente
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
    <div className="flex items-center gap-2">
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

function MockFiltroEstado() {
  const estados = ["Todos los estados", "Pendiente", "En curso", "Cerrado", "Cancelado"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-9 bg-card border border-border rounded-md px-3 text-xs text-muted-foreground/70 inline-flex items-center">
        Buscar por código...
      </div>
      <div className="bg-card border border-[#0088D1]/60 rounded-md text-[11px] overflow-hidden shadow-[0_0_0_3px_rgba(0,136,209,0.1)]">
        {estados.map((e, i) => (
          <div
            key={e}
            className={
              "px-3 py-1.5 border-b last:border-0 border-border " +
              (i === 1 ? "bg-[#E1F5FE] text-primary font-semibold" : "text-muted-foreground")
            }
          >
            {e}
          </div>
        ))}
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

function MockCicloEstados() {
  const flow = [
    { label: "Pendiente", color: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]" },
    { label: "En curso", color: "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]" },
    { label: "Cerrado", color: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]" },
  ];
  return (
    <div className="flex items-center gap-2 justify-center flex-wrap">
      {flow.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${s.color}`}
          >
            {s.label}
          </span>
          {i < flow.length - 1 && (
            <span className="text-muted-foreground/70 text-sm">→</span>
          )}
        </div>
      ))}
      <div className="w-full mt-2 flex justify-center">
        <span className="px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#FEE2E2] text-[#7F1D1D] border-[#FCA5A5]">
          Cancelado (terminal)
        </span>
      </div>
    </div>
  );
}

function MockEstadoBadge({ estado, desc }: { estado: string; desc: string }) {
  const styles: Record<string, string> = {
    pendiente: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
    en_curso: "bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]",
    cerrado: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]",
  };
  const label = estado === "en_curso" ? "En curso" : estado.charAt(0).toUpperCase() + estado.slice(1);
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${styles[estado]}`}>
        {label}
      </span>
      <p className="text-muted-foreground text-xs text-center">{desc}</p>
    </div>
  );
}

function MockFacturado() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-4">
        <span className="flex-1">Código</span>
        <span className="w-20">Estado</span>
        <span className="w-20 text-center">Facturado</span>
      </div>
      <div className="px-3 py-2 flex items-center gap-4 text-[11px] border-b border-border">
        <span className="flex-1 font-mono text-foreground">V-2026-00040</span>
        <span className="w-20 text-[#10B981] font-medium">Cerrado</span>
        <span className="w-20 text-center text-[#10B981] font-semibold">Sí</span>
      </div>
      <div className="px-3 py-2 flex items-center gap-4 text-[11px] border-b border-border bg-[#FFF7F7]">
        <span className="flex-1 font-mono text-foreground">V-2026-00041</span>
        <span className="w-20 text-[#10B981] font-medium">Cerrado</span>
        <span className="w-20 text-center text-muted-foreground/70 font-semibold">No</span>
      </div>
      <div className="px-3 py-2 flex items-center gap-4 text-[11px]">
        <span className="flex-1 font-mono text-foreground">V-2026-00042</span>
        <span className="w-20 text-[#3B82F6] font-medium">En curso</span>
        <span className="w-20 text-center text-muted-foreground/70 font-semibold">No</span>
      </div>
    </div>
  );
}

function MockRegistrarCobro() {
  return (
    <div className="space-y-2">
      {/* fila cerrada expandida */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-4 text-[11px] bg-muted/40 border-b border-border">
          <span className="flex-1 font-mono text-foreground">V-2026-00041</span>
          <span className="text-[#10B981] font-semibold">● Cerrado</span>
          <span className="text-muted-foreground/70 font-semibold">No</span>
        </div>
        <div className="px-4 py-3 bg-muted/60 space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Cambiar Estado Operativo:
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-7 px-2.5 text-[11px] rounded border border-border bg-card text-muted-foreground inline-flex items-center">Pendiente</span>
            <span className="h-7 px-2.5 text-[11px] rounded border border-border bg-card text-muted-foreground inline-flex items-center">En Curso</span>
            <span className="h-7 px-2.5 text-[11px] rounded border bg-[#0F172A] text-white inline-flex items-center">Cerrado</span>
          </div>
          {/* botón destacado */}
          <div className="h-7 px-2.5 text-[11px] rounded border border-green-400 bg-green-50 text-green-700 font-bold inline-flex items-center gap-1.5 shadow-[0_0_0_3px_rgba(34,197,94,0.15)] w-full justify-center">
            <Coins size={12} /> Cargar remito / importe
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        El botón aparece solo en viajes <strong>cerrados sin facturar</strong>
      </p>
    </div>
  );
}

function MockCerrarConDatos() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
      <p className="font-semibold text-foreground">Cerrar viaje V-2026-01456</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border px-2 py-1">
          <span className="text-muted-foreground">Nº remito</span>
          <div className="font-mono text-foreground">0813R00281660</div>
        </div>
        <div className="rounded-md border border-border px-2 py-1">
          <span className="text-muted-foreground">Monto / factura</span>
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
        <span className="text-center rounded-md bg-[#0F172A] text-white py-1 px-3 font-semibold">
          Confirmar cierre
        </span>
      </div>
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
      <p className="font-semibold text-foreground flex items-center gap-1.5">
        <Receipt size={13} className="text-[#0088D1]" /> Documentos (remito / factura)
      </p>
      <div className="flex gap-1">
        <span className="rounded-md bg-[#0088D1] text-white px-2 py-0.5 font-semibold">Remito</span>
        <span className="rounded-md border border-border text-muted-foreground px-2 py-0.5">Factura</span>
        <span className="rounded-md border border-border text-muted-foreground px-2 py-0.5">Subir</span>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
        <FileText size={13} className="text-muted-foreground" />
        <span className="rounded bg-sky-100 text-sky-700 px-1 text-[10px] font-semibold">Remito</span>
        <span className="flex-1 truncate text-foreground/90">remito-0813.pdf</span>
        <Eye size={12} className="text-primary" />
      </div>
    </div>
  );
}

function MockFacturarBloque() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden text-[11px]">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-muted/40">
        <Receipt size={13} className="text-[#0088D1]" />
        <span className="font-semibold text-foreground">Facturar 3 viajes seleccionados</span>
      </div>
      <div className="divide-y divide-border">
        {[
          { c: "V-2026-00040", r: "0813R00281660", m: "$ 794.527" },
          { c: "V-2026-00041", r: "0813R00281744", m: "$ 512.300" },
          { c: "V-2026-00042", r: "0813R00281802", m: "$ 638.900" },
        ].map((row) => (
          <div key={row.c} className="px-3 py-2 flex items-center gap-2">
            <span className="font-mono text-foreground w-24">{row.c}</span>
            <span className="flex-1 rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground truncate">
              {row.r}
            </span>
            <span className="w-20 text-right font-semibold text-foreground">{row.m}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border flex justify-end">
        <span className="h-7 px-3 rounded-md bg-[#10B981] text-white inline-flex items-center gap-1 font-bold">
          <Receipt size={11} /> Facturar todo
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
      "De principio a fin: cargás el viaje, lo seguís hasta cerrarlo con su remito y su valor, y adjuntás los documentos. Con el valor cargado el viaje queda facturado y listo — no hay un paso de cobro aparte.",
    mockup: <MockCicloEstados />,
  },
  {
    title: "1. Cargar el viaje",
    description:
      'Usá "Nuevo viaje" (o Carga rápida para varios a la vez). Al elegir el chofer, el camión se autocompleta con la unidad del día de la Planilla diaria — y siempre lo podés cambiar a mano.',
    mockup: <MockToolbar highlight="new" />,
    hint: "También pueden entrar por los importadores (Hoja de ruta / YPF / Loma).",
  },
  {
    title: "2. El viaje arranca",
    description:
      "Cuando el chofer sale, pasá el viaje a En curso. Cuando entrega y tenés el remito firmado, lo cerrás.",
    mockup: <MockEstadoBadge estado="en_curso" desc="Camión en ruta. En tránsito activo." />,
  },
  {
    title: "3. Cerrar con remito y valor",
    description:
      "Al cerrar cargás el Nº de remito, el monto del flete y las toneladas. Con el valor cargado el viaje queda facturado de una.",
    mockup: <MockCerrarConDatos />,
    hint: "Entra el remito con su valor → facturado y listo. La liquidación de Loma o el DM de YPF también completan estos datos solos.",
  },
  {
    title: "4. Adjuntar documentos",
    description:
      "Expandí la fila del viaje: en la sección Documentos podés subir el PDF o la foto del remito y de la factura (hasta 100 MB) y verlos o descargarlos cuando quieras.",
    mockup: <MockDocumentos />,
  },
  {
    title: "5. Facturar en bloque",
    description:
      "Desde el listado, seleccioná varios viajes y usá Facturar: cargás remito y monto de cada uno y quedan facturados de una.",
    mockup: <MockFacturarBloque />,
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
    title: "Elegí la fecha y el estado",
    description:
      "La fecha por defecto es hoy. El estado inicial suele ser Pendiente: el viaje fue asignado pero el camión aún no salió.",
    mockup: <MockFechaEstado />,
    hint: "Podés crear el viaje en estado En curso si ya está en camino al momento de registrarlo.",
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
      'Apretá "Guardar viaje". El código correlativo (ej. V-2026-00001) se genera automáticamente. El viaje aparece en la tabla.',
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
      "Las 5 tarjetas del encabezado (Total, En curso, Pendientes, Sin facturar, Viajes vacíos) son botones: hacé clic en una y el listado queda filtrado por ese estado. Volvé a clickearla para limpiar.",
    mockup: <MockFacturado />,
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
    title: "Buscá por código",
    description:
      'El campo de texto filtra por código correlativo (ej. "V-2026-00042"). Útil cuando te pasan un número de viaje puntual.',
    mockup: <MockFiltroCodigo />,
  },
  {
    title: "Filtrá por estado",
    description:
      'El dropdown de estado permite ver solo Pendientes, En curso, Cerrados o Cancelados. Por defecto se esconden los Cancelados.',
    mockup: <MockFiltroEstado />,
    hint: "Combiná estado + fecha para encontrar, por ejemplo, todos los viajes pendientes de la semana pasada.",
  },
  {
    title: "Limpiar filtros",
    description:
      'Cuando hay algún filtro activo, aparece el botón "Limpiar filtros" que resetea todo de una vez.',
    mockup: <MockLimpiarFiltros />,
  },
];

// =============================================================================
// Solapa: Estados
// =============================================================================

const ESTADOS_STEPS: TutorialStep[] = [
  {
    title: "Ciclo de vida de un viaje",
    description:
      "Un viaje pasa por cuatro estados posibles. El flujo normal es Pendiente → En curso → Cerrado. Cancelado es un estado terminal.",
    mockup: <MockCicloEstados />,
  },
  {
    title: "Pendiente",
    description:
      "El viaje fue registrado y asignado pero el camión todavía no salió. Aparece en el stat card amarillo del encabezado.",
    mockup: <MockEstadoBadge estado="pendiente" desc="Viaje asignado. Sin salida confirmada." />,
    hint: "Podés cambiar a En curso una vez que el chofer avisa que arrancó.",
  },
  {
    title: "En curso",
    description:
      "El camión salió. El viaje está activo. Aparece en el stat card verde del encabezado.",
    mockup: <MockEstadoBadge estado="en_curso" desc="Camión en ruta. En tránsito activo." />,
    hint: "Pasá a Cerrado cuando el chofer entregó la carga y tenés el remito firmado.",
  },
  {
    title: "Cerrado",
    description:
      "La entrega se completó. El viaje puede ser incluido en hojas de ruta y facturas.",
    mockup: <MockEstadoBadge estado="cerrado" desc="Entrega confirmada. Listo para facturar." />,
    hint: "Solo los viajes cerrados se incluyen en hojas de ruta al liquidar al chofer.",
  },
  {
    title: "Facturado",
    description:
      'La columna "Facturado" se prende sola cuando el viaje tiene su valor cargado (con el remito entra el monto). Un viaje cerrado sin valor aparece Sin facturar (rojo en las stats) hasta completarlo.',
    mockup: <MockFacturado />,
    hint: 'El stat card "Sin facturar" del encabezado muestra los viajes cerrados/en curso que todavía no tienen factura emitida.',
  },
  {
    title: "Completar remito y valor después",
    description:
      'Si cerraste un viaje sin remito o sin valor, podés completarlo después. Expandí la fila del viaje cerrado y usá el botón verde "Cargar remito / importe": con el valor cargado el viaje queda facturado y listo.',
    mockup: <MockRegistrarCobro />,
    hint: "También lo podés completar desde la Hoja de Ruta (lápiz en la fila) o dejar que la liquidación de Loma / el DM de YPF lo completen solos.",
  },
];

// =============================================================================
// Tabs
// =============================================================================

const TABS: TutorialTab[] = [
  { id: "ciclo", label: "Ciclo completo", icon: <Workflow size={14} />, steps: CICLO_STEPS },
  { id: "nuevo", label: "Nuevo viaje", icon: <Plus size={14} />, steps: NUEVO_STEPS },
  { id: "filtros", label: "Filtros", icon: <SlidersHorizontal size={14} />, steps: FILTROS_STEPS },
  { id: "estados", label: "Estados", icon: <CircleDot size={14} />, steps: ESTADOS_STEPS },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de viajes" tabs={TABS} />;
}
