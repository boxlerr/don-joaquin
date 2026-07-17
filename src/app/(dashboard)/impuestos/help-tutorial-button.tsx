"use client";

import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Check,
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  FileText,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Impuestos" tabs={TABS} />;
}

// ---------------------------------------------------------------------------
// Helpers de mockup (todo a nivel de módulo — nunca dentro de un componente)
// ---------------------------------------------------------------------------

type Tono = "brand" | "success" | "warning" | "error";

const TONO_TXT: Record<Tono, string> = {
  brand: "text-primary",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

function StatMini({
  tono,
  icon,
  label,
  value,
  sub,
}: {
  tono: Tono;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        <span className={TONO_TXT[tono]}>{icon}</span> {label}
      </div>
      <div className={`text-lg font-bold leading-tight ${TONO_TXT[tono]}`}>{value}</div>
      <div className="text-[8px] text-muted-foreground/70">{sub}</div>
    </div>
  );
}

type EstadoTono = "green" | "red" | "amber" | "slate";

const ESTADO_CLS: Record<EstadoTono, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  red: "bg-red-100 text-red-700 border-red-200/60",
  amber: "bg-amber-50 text-amber-700 border-amber-200/60",
  slate: "bg-slate-100 text-slate-600 border-slate-200/60",
};

function EstadoBadge({
  tono,
  icon,
  children,
}: {
  tono: EstadoTono;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${ESTADO_CLS[tono]}`}
    >
      {icon} {children}
    </span>
  );
}

function Fila({
  nombre,
  org,
  fecha,
  estado,
  done,
}: {
  nombre: string;
  org: string;
  fecha: string;
  estado: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 border-t border-border">
      <div className="min-w-0">
        <div className={`text-[11px] font-semibold text-foreground truncate ${done ? "line-through opacity-60" : ""}`}>
          {nombre}
        </div>
        <div className="text-[8px] text-muted-foreground">{org}</div>
      </div>
      <span className="w-12 text-[10px] tabular-nums text-foreground text-right">{fecha}</span>
      <span className="w-[76px] flex justify-center">{estado}</span>
    </div>
  );
}

function SemaforoRow({ badge, desc }: { badge: React.ReactNode; desc: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className="w-[92px] shrink-0 flex">{badge}</span>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </div>
  );
}

function CheckRow({
  done,
  nombre,
  detalle,
  estado,
}: {
  done: boolean;
  nombre: string;
  detalle: string;
  estado: React.ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 border-t border-border ${done ? "opacity-60" : ""}`}>
      <span
        className={`flex items-center justify-center w-5 h-5 rounded border ${
          done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border"
        }`}
      >
        {done ? <Check size={12} /> : null}
      </span>
      <div className="min-w-0">
        <div className={`text-[11px] font-semibold text-foreground truncate ${done ? "line-through" : ""}`}>{nombre}</div>
        <div className="text-[8px] text-muted-foreground truncate">{detalle}</div>
      </div>
      {estado}
    </div>
  );
}

function AuditRow({ accion, detalle, quien }: { accion: string; detalle: string; quien: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-[9px] font-bold text-primary w-12 shrink-0">{accion}</span>
      <span className="text-[10px] text-foreground flex-1 truncate">{detalle}</span>
      <span className="text-[8px] text-muted-foreground shrink-0">{quien}</span>
    </div>
  );
}

// ===========================================================================
// TAB 1 — El calendario
// ===========================================================================

function MockStats() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatMini tono="brand" icon={<Landmark size={10} />} label="Impuestos" value="12" sub="En el calendario" />
      <StatMini tono="success" icon={<CheckCircle2 size={10} />} label="Presentados" value="7" sub="Marcados como hechos" />
      <StatMini tono="warning" icon={<Clock size={10} />} label="Por vencer" value="3" sub="Pendientes en ≤ 7 días" />
      <StatMini tono="error" icon={<AlertTriangle size={10} />} label="Vencidos" value="1" sub="Pasados de fecha" />
    </div>
  );
}

function MockTabla() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
        <span>Impuesto</span>
        <span className="w-12 text-right">Vence</span>
        <span className="w-[76px] text-center">Estado</span>
      </div>
      <Fila nombre="IVA — DDJJ mensual" org="AFIP" fecha="18/07" estado={<EstadoBadge tono="red" icon={<CalendarClock size={10} />}>en 2 días</EstadoBadge>} />
      <Fila nombre="SICORE — 1er. Q" org="AFIP" fecha="22/07" estado={<EstadoBadge tono="amber" icon={<CalendarClock size={10} />}>en 6 días</EstadoBadge>} />
      <Fila nombre="Ingresos Brutos" org="ARBA" fecha="10/07" done estado={<EstadoBadge tono="green" icon={<Check size={10} />}>Presentado</EstadoBadge>} />
    </div>
  );
}

function MockSemaforo() {
  return (
    <div className="space-y-1.5">
      <SemaforoRow badge={<EstadoBadge tono="green" icon={<Check size={10} />}>Presentado</EstadoBadge>} desc="Ya lo presentaste" />
      <SemaforoRow badge={<EstadoBadge tono="red" icon={<CalendarClock size={10} />}>vencido</EstadoBadge>} desc="Pasó la fecha y sigue pendiente" />
      <SemaforoRow badge={<EstadoBadge tono="red" icon={<CalendarClock size={10} />}>en 4 días</EstadoBadge>} desc="Urgente: vence en 5 días o menos" />
      <SemaforoRow badge={<EstadoBadge tono="amber" icon={<CalendarClock size={10} />}>en 12 días</EstadoBadge>} desc="Atención: entre 6 y 15 días" />
      <SemaforoRow badge={<EstadoBadge tono="slate" icon={<CalendarClock size={10} />}>en 24 días</EstadoBadge>} desc="Todavía hay margen" />
    </div>
  );
}

// ===========================================================================
// TAB 2 — Cargar y editar
// ===========================================================================

function MockHeaderBtn() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Landmark size={13} className="text-primary" />
          <span className="text-[11px] font-semibold text-foreground">Calendario de vencimientos</span>
        </div>
        <div className="h-7 px-2.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white">
          <Plus size={11} /> Agregar impuesto
        </div>
      </div>
      <div className="px-3 py-3 text-[9px] text-muted-foreground text-center">La tabla del calendario va acá debajo</div>
    </div>
  );
}

function MockForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Plus size={12} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Agregar impuesto</span>
      </div>
      <div className="p-3 space-y-2.5">
        <MockField label="Impuesto *" value="IVA — DDJJ mensual" required />
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Organismo" value="AFIP" icon={<Building2 size={10} />} />
          <MockField label="Vencimiento *" value="18/07/2026" icon={<CalendarClock size={10} />} required />
        </div>
        <MockField label="Período (opcional)" value="2026-07" icon={<FileText size={10} />} />
        <div className="flex justify-end pt-1.5 border-t border-border">
          <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            <Check size={11} /> Agregar
          </div>
        </div>
      </div>
    </div>
  );
}

function MockEditForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Pencil size={12} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Editar impuesto</span>
      </div>
      <div className="p-3 space-y-2.5">
        <MockField label="Impuesto *" value="SICORE — 1er. Q" required />
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Organismo" value="AFIP" icon={<Building2 size={10} />} />
          <MockField label="Vencimiento *" value="22/07/2026" icon={<CalendarClock size={10} />} required />
        </div>
        <MockField label="Observaciones (opcional)" value="Lo presenta el contador" icon={<FileText size={10} />} />
      </div>
    </div>
  );
}

function MockDelete() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-foreground truncate">Ingresos Brutos</div>
          <div className="text-[8px] text-muted-foreground">ARBA</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-primary" title="Editar">
            <Pencil size={11} />
          </span>
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-red-50 text-red-600" title="Eliminar">
            <Trash2 size={11} />
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border bg-red-50/50">
        <span className="text-[9px] text-muted-foreground mr-auto">Confirmá para borrarlo</span>
        <span className="h-6 px-2 rounded-md bg-card text-red-600 border border-red-200 text-[9px] font-bold inline-flex items-center">
          Eliminar
        </span>
        <span className="h-6 px-2 rounded-md text-muted-foreground text-[9px] font-semibold inline-flex items-center">
          Cancelar
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 3 — Presentar y controlar
// ===========================================================================

function MockToggle() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/50 text-[8px] font-bold uppercase text-muted-foreground">
        Un clic en el casillero de la izquierda
      </div>
      <CheckRow
        done
        nombre="Ingresos Brutos"
        detalle="ARBA · venció 10/07"
        estado={<EstadoBadge tono="green" icon={<Check size={10} />}>Presentado</EstadoBadge>}
      />
      <CheckRow
        done={false}
        nombre="IVA — DDJJ mensual"
        detalle="AFIP · vence 18/07"
        estado={<EstadoBadge tono="amber" icon={<CalendarClock size={10} />}>en 4 días</EstadoBadge>}
      />
    </div>
  );
}

function MockToggleBack() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <div className="text-[9px] font-bold text-emerald-700 uppercase">Presentado</div>
          <div className="text-[10px] text-emerald-900 mt-0.5 flex items-center gap-1">
            <Check size={11} /> casillero verde
          </div>
        </div>
        <ArrowRight size={16} className="text-primary shrink-0" />
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-[9px] font-bold text-muted-foreground uppercase">Pendiente</div>
          <div className="text-[10px] text-foreground mt-0.5 flex items-center gap-1">
            <RotateCcw size={11} className="text-primary" /> vuelve al semáforo
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Destildás y vuelve a <b>pendiente</b>. Útil si lo marcaste por error.
      </div>
    </div>
  );
}

function MockAudit() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck size={11} className="text-primary" /> Todo queda registrado
        </div>
        <div className="divide-y divide-border">
          <AuditRow accion="Presentó" detalle="IVA — DDJJ mensual" quien="hoy 09:14" />
          <AuditRow accion="Editó" detalle="SICORE — 1er. Q" quien="ayer 17:02" />
          <AuditRow accion="Cargó" detalle="Ingresos Brutos" quien="12/07" />
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 text-[10px] text-amber-900 px-2.5 py-2 flex items-start gap-1.5">
        <ShieldCheck size={13} className="text-amber-600 shrink-0 mt-px" />
        <span>
          Cargar, editar, borrar y presentar solo lo hace quien tiene <b>edición en Finanzas</b>. Es una sección sensible.
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
    id: "calendario",
    label: "El calendario",
    icon: <Landmark size={14} />,
    steps: [
      {
        title: "Las 4 tarjetas de arriba",
        description:
          "El resumen del mes de un vistazo: cuántos impuestos hay en el calendario, cuántos ya presentaste, cuántos vencen en 7 días o menos y cuántos están vencidos.",
        mockup: <MockStats />,
      },
      {
        title: "La tabla, ordenada por vencimiento",
        description:
          "Cada fila es un impuesto con su organismo, su fecha y su estado. Se ordena sola por fecha de vencimiento: el más próximo queda siempre arriba.",
        mockup: <MockTabla />,
        hint: "Los impuestos ya presentados se ven en gris y tachados, para que no te distraigan de lo que falta.",
      },
      {
        title: "El semáforo de estados",
        description:
          "El color de cada estado te dice qué tan urgente es: rojo si vence en 5 días o menos (o ya venció), ámbar entre 6 y 15 días, gris cuando hay margen y verde cuando ya está presentado.",
        mockup: <MockSemaforo />,
      },
    ],
  },
  {
    id: "cargar",
    label: "Cargar y editar",
    icon: <Plus size={14} />,
    steps: [
      {
        title: "Agregá un impuesto",
        description:
          'Arriba a la derecha del calendario, el botón "Agregar impuesto" abre el formulario. Solo aparece si tenés permiso de edición.',
        mockup: <MockHeaderBtn />,
      },
      {
        title: "Completá los datos",
        description:
          "Impuesto y Vencimiento son obligatorios. El Organismo (AFIP, ARBA…) y el Período son opcionales pero ayudan a ordenar. Guardás y ya aparece en la tabla, en su lugar por fecha.",
        mockup: <MockForm />,
        hint: "El Período es un texto libre (ej. 2026-07): sirve para distinguir el mismo impuesto de meses distintos.",
      },
      {
        title: "Editá lo que haga falta",
        description:
          "El lápiz de cada fila abre el mismo formulario para corregir el nombre, el organismo o la fecha. Al editar además podés dejar una Observación (quién lo presenta, un recordatorio, etc.).",
        mockup: <MockEditForm />,
      },
      {
        title: "Eliminá con confirmación",
        description:
          "El tacho pide confirmar antes de borrar: aparecen “Eliminar” y “Cancelar” en la misma fila. Recién cuando confirmás, el impuesto sale del calendario.",
        mockup: <MockDelete />,
        hint: "Borrar es definitivo. Si un impuesto se repite todos los meses, mejor editarle la fecha que borrarlo y cargarlo de nuevo.",
      },
    ],
  },
  {
    id: "presentar",
    label: "Presentar",
    icon: <CheckCircle2 size={14} />,
    steps: [
      {
        title: "Marcá como presentado",
        description:
          "El casillero a la izquierda de cada fila es el checklist. Un clic lo tilda en verde, el impuesto pasa a “Presentado” y se guarda automáticamente quién lo hizo y cuándo.",
        mockup: <MockToggle />,
      },
      {
        title: "Volver a pendiente",
        description:
          "Si te equivocaste, volvés a hacer clic en el casillero verde y el impuesto regresa a pendiente, con su color de urgencia de nuevo. No pierde nada de su información.",
        mockup: <MockToggleBack />,
      },
      {
        title: "Quién puede y qué queda registrado",
        description:
          "Cada carga, edición, borrado y presentación queda en la auditoría con usuario y fecha. Estas acciones solo las hace quien tiene edición sobre Finanzas: es una sección sensible.",
        mockup: <MockAudit />,
      },
    ],
  },
];
