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
  ArrowUp,
  RotateCcw,
  Search,
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
  activo,
}: {
  tono: Tono;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  /** Marcada: es la tarjeta que está filtrando la lista. */
  activo?: boolean;
}) {
  return (
    <div className={`rounded-md border bg-card p-2 ${activo ? "border-primary/60 ring-2 ring-primary/40" : "border-border"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        <span className={TONO_TXT[tono]}>{icon}</span> {label}
      </div>
      <div className={`text-lg font-bold leading-tight ${TONO_TXT[tono]}`}>{value}</div>
      <div className="text-[8px] text-muted-foreground/70">{sub}</div>
    </div>
  );
}

type EstadoTono = "green" | "red" | "amber" | "slate";

// Los mismos tonos que la pastilla de estado de la pantalla (`StatusBadge`).
const ESTADO_CLS: Record<EstadoTono, string> = {
  green: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
  red: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
  amber: "bg-[#FFFBEB] text-[#92400E] border-[#FEF3C7]",
  slate: "bg-muted/40 text-muted-foreground border-border",
};

const ESTADO_DOT: Record<EstadoTono, string> = {
  green: "bg-[#22C55E]",
  red: "bg-[#EF4444]",
  amber: "bg-[#F59E0B]",
  slate: "bg-[#94A3B8]",
};

function EstadoBadge({ tono, children }: { tono: EstadoTono; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${ESTADO_CLS[tono]}`}
    >
      <span className={`size-1 rounded-full ${ESTADO_DOT[tono]}`} />
      {children}
    </span>
  );
}

function Fila({
  nombre,
  org,
  fecha,
  aviso,
  avisoTono = "slate",
  estado,
  done,
}: {
  nombre: string;
  org: string;
  fecha: string;
  /** El renglón chico de abajo de la fecha ("vence en 4 días"). */
  aviso: string;
  avisoTono?: EstadoTono;
  estado: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 border-t border-border">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/8 text-primary">
          <FileText size={10} />
        </span>
        <div className="min-w-0">
          <div className={`text-[11px] font-semibold text-foreground truncate ${done ? "line-through opacity-60" : ""}`}>
            {nombre}
          </div>
          <div className="text-[8px] text-muted-foreground">{org}</div>
        </div>
      </div>
      <span className="w-[78px] text-right">
        <span className="block text-[10px] tabular-nums text-foreground">{fecha}</span>
        <span
          className={`block text-[8px] ${
            avisoTono === "red" ? "text-red-600" : avisoTono === "amber" ? "text-amber-600" : "text-muted-foreground"
          }`}
        >
          {aviso}
        </span>
      </span>
      <span className="w-[86px] flex justify-center">{estado}</span>
    </div>
  );
}

function SemaforoRow({ badge, desc }: { badge: React.ReactNode; desc: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className="w-[108px] shrink-0 flex">{badge}</span>
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
      <StatMini tono="error" icon={<AlertTriangle size={10} />} label="Vencidos" value="1" sub="Pasados de fecha" activo />
    </div>
  );
}

/** El buscador y las solapas, que es como se acota la lista. */
function MockFiltros() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md border border-border px-2 text-[10px] text-muted-foreground">
          <Search size={10} /> Buscar impuesto, organismo o período…
          <span className="ml-auto rounded border border-border bg-muted px-1 text-[8px] font-bold">/</span>
        </div>
        <div className="flex h-7 w-24 items-center gap-1 rounded-md border border-border px-2 text-[10px] text-foreground">
          <Building2 size={10} className="text-muted-foreground" /> AFIP
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3">
        {[
          { l: "Todos", n: "12", activo: false },
          { l: "Por vencer", n: "3", activo: false },
          { l: "Vencidos", n: "1", activo: true },
          { l: "Presentados", n: "7", activo: false },
        ].map((t) => (
          <span
            key={t.l}
            className={`-mb-px inline-flex items-center gap-1 border-b-2 py-1.5 text-[9px] font-semibold ${
              t.activo ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.l}
            <span className={`rounded px-1 text-[8px] font-bold ${t.activo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {t.n}
            </span>
          </span>
        ))}
      </div>
      <div className="border-t border-border px-3 py-1.5 text-[8px] text-muted-foreground">
        Mostrando <b className="text-foreground">1–1</b> de 1 impuesto
      </div>
    </div>
  );
}

function MockTabla() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
        <span>Impuesto</span>
        <span className="inline-flex w-[78px] items-center justify-end gap-0.5">
          Vence <ArrowUp size={8} className="text-primary" />
        </span>
        <span className="w-[86px] text-center">Estado</span>
      </div>
      <Fila
        nombre="IVA — DDJJ mensual"
        org="AFIP"
        fecha="18/07"
        aviso="venció hace 3 días"
        avisoTono="red"
        estado={<EstadoBadge tono="red">Vencido</EstadoBadge>}
      />
      <Fila
        nombre="SICORE — 1er. Q"
        org="AFIP"
        fecha="26/07"
        aviso="vence en 5 días"
        avisoTono="amber"
        estado={<EstadoBadge tono="amber">Por vencer</EstadoBadge>}
      />
      <Fila
        nombre="Ingresos Brutos"
        org="ARBA"
        fecha="10/07"
        aviso="vencía el 10/07"
        done
        estado={<EstadoBadge tono="green">Presentado</EstadoBadge>}
      />
    </div>
  );
}

/** La columna "Pagado" y la tira de totales de arriba. */
function MockPagado() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border px-3 py-2">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[9px] font-semibold text-foreground">Pagado por mes</span>
          <span className="text-[8px] text-muted-foreground">
            Total <span className="font-semibold text-foreground">$ 1.847.300,00</span>
            <span className="text-amber-700"> · 3 sin cargar</span>
          </span>
        </div>
        <div className="flex gap-1.5">
          {[
            { mes: "Junio 2026", monto: "$ 912.400", n: "5 de 5" },
            { mes: "Julio 2026", monto: "$ 934.900", n: "4 de 7", falta: "3 sin cargar" },
          ].map((m) => (
            <div key={m.mes} className="flex-1 rounded-md border border-border px-2 py-1">
              <div className="text-[7px] font-bold uppercase text-muted-foreground">{m.mes}</div>
              <div className="text-[10px] font-semibold text-foreground">{m.monto}</div>
              <div className="text-[7px] text-muted-foreground">
                {m.n}
                {m.falta && <span className="text-amber-700"> · {m.falta}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
          <span>Impuesto</span>
          <span className="w-[104px]">Pagado</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-border px-3 py-2">
          <span className="text-[9px] font-medium text-foreground">IVA — DDJJ mensual</span>
          <span className="w-[104px]">
            <span className="block text-[10px] font-semibold tabular-nums text-foreground">$ 486.200,00</span>
            <span className="block text-[8px] text-muted-foreground">21/07/2026</span>
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-border px-3 py-2">
          <span className="text-[9px] font-medium text-foreground">SICORE — 1er. Q</span>
          <span className="w-[104px]">
            <span className="inline-block rounded border border-dashed border-[#CBD5E1] px-1.5 py-0.5 text-[8px] text-muted-foreground">
              + Cargar importe
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function MockSemaforo() {
  return (
    <div className="space-y-1.5">
      <SemaforoRow badge={<EstadoBadge tono="green">Presentado</EstadoBadge>} desc="Ya lo presentaste, en fecha" />
      <SemaforoRow badge={<EstadoBadge tono="amber">Presentado tarde</EstadoBadge>} desc="Se presentó, pero después del vencimiento" />
      <SemaforoRow badge={<EstadoBadge tono="red">Vencido</EstadoBadge>} desc="Pasó la fecha y sigue pendiente" />
      <SemaforoRow badge={<EstadoBadge tono="amber">Por vencer</EstadoBadge>} desc="Vence dentro de los próximos 7 días" />
      <SemaforoRow badge={<EstadoBadge tono="slate">Pendiente</EstadoBadge>} desc="Falta presentarlo, pero todavía hay margen" />
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

function MockContribuyentes() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Building2 size={12} />
        </span>
        <span className="text-[11px] font-semibold text-foreground">Contribuyentes</span>
      </div>
      <div className="divide-y divide-border">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-foreground">Joaquín Hnos</div>
            <div className="text-[9px] text-muted-foreground tabular-nums">30-70908728-9 · 26 vencimientos</div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Pencil size={11} />
            <Trash2 size={11} className="opacity-30" />
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-foreground flex items-center gap-1">
              Joaquín Nicolás
              <span className="text-[9px] font-medium text-muted-foreground">· Reservado</span>
            </div>
            <div className="text-[9px] text-muted-foreground tabular-nums">20-26402739-0 · 3 vencimientos</div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Pencil size={11} />
            <Trash2 size={11} className="opacity-30" />
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border">
        <span className="h-6 px-2 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 border border-border text-foreground">
          <Plus size={10} /> Agregar contribuyente
        </span>
      </div>
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
        <MockField label="Período (opcional)" value="2026-07" icon={<FileText size={10} />} />
        <MockField label="Observaciones (opcional)" value="Lo presenta el contador" icon={<FileText size={10} />} />
      </div>
    </div>
  );
}

function MockDelete() {
  return (
    <div className="space-y-2">
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
      </div>
      {/* La confirmación es una ventanita al medio de la pantalla, no dos
          botones metidos en la fila. */}
      <div className="rounded-lg border border-border bg-card p-3 shadow-md">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
          <AlertTriangle size={12} className="text-red-500" /> Eliminar impuesto
        </div>
        <p className="mt-1 text-[9px] text-muted-foreground">
          Se va a borrar <b className="text-foreground">Ingresos Brutos</b> y sus comprobantes. No se puede deshacer.
        </p>
        <div className="mt-2 flex justify-end gap-1.5">
          <span className="inline-flex h-6 items-center rounded-md border border-border px-2 text-[9px] font-semibold text-muted-foreground">
            Cancelar
          </span>
          <span className="inline-flex h-6 items-center rounded-md bg-red-50 px-2 text-[9px] font-bold text-red-600">
            Eliminar
          </span>
        </div>
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
        detalle="ARBA · vencía el 10/07"
        estado={<EstadoBadge tono="green">Presentado</EstadoBadge>}
      />
      <CheckRow
        done={false}
        nombre="IVA — DDJJ mensual"
        detalle="AFIP · vence en 4 días"
        estado={<EstadoBadge tono="amber">Por vencer</EstadoBadge>}
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
          "El resumen del mes de un vistazo: cuántos impuestos hay en el calendario, cuántos ya presentaste, cuántos vencen en 7 días o menos y cuántos están vencidos. Además filtran: tocás “Vencidos” y abajo quedan sólo esos; la tarjeta se marca para que sepas qué estás mirando y volvés a tocarla para ver todo de nuevo.",
        mockup: <MockStats />,
      },
      {
        title: "Buscá y acotá con las solapas",
        description:
          "El buscador encuentra por nombre, organismo o período (podés escribir sin acentos), y al lado acotás por organismo. Las solapas dejan sólo lo que te interesa y el número de cada una cuenta lo que hay con esa búsqueda puesta.",
        mockup: <MockFiltros />,
        hint: "Apretando la tecla “/” saltás al buscador sin usar el mouse. Abajo de la lista siempre dice cuántos estás viendo, y de a 25 por página cuando son muchos.",
      },
      {
        title: "La tabla, ordenada por vencimiento",
        description:
          "Cada fila es un impuesto con su organismo, su fecha y su estado. Arranca ordenada por vencimiento —el más próximo arriba— y podés cambiarla tocando el título de la columna: una vez ordena de menor a mayor y otra al revés.",
        mockup: <MockTabla />,
        hint: "Abajo de la fecha dice cuánto falta (o hace cuánto se pasó). Los presentados se ven en gris y tachados, para que no te distraigan de lo que falta.",
      },
      {
        title: "Cuánto se pagó, y cuándo",
        description:
          "En la columna “Pagado” cargás el importe y la fecha en que se pagó. Tocás el campo, escribís el número y listo — no hace falta abrir nada. La fecha de pago va aparte de la de presentación a propósito: primero se presenta y después se paga, y no siempre el mismo día.",
        mockup: <MockPagado />,
        hint: "Arriba de la lista, “Pagado por mes” suma lo cargado de cada período. Si algún impuesto todavía no tiene importe, lo dice al lado: el total es de lo que está cargado, no del mes entero.",
      },
      {
        title: "El semáforo de estados",
        description:
          "La pastilla de la derecha dice en qué anda cada impuesto: rojo cuando ya venció, ámbar cuando vence dentro de los próximos 7 días, gris cuando todavía hay margen y verde cuando está presentado. Si se presentó después de la fecha, queda en ámbar como “Presentado tarde”.",
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
        title: "Subí el calendario del estudio",
        description:
          'El camino corto: el botón "Subir calendario" toma el PDF que manda el estudio contable y agenda todos los vencimientos de una. Antes de guardar nada muestra lo que entendió —el contribuyente, el CUIT y cada impuesto con su fecha— y ahí se puede corregir. Subir dos veces el mismo archivo no duplica nada; si el estudio corrigió una fecha, la cambia.',
        mockup: <MockHeaderBtn />,
        hint: "El CUIT del PDF dice de quién es el calendario, y de eso depende a quién le llegan los avisos.",
      },
      {
        title: "Elegí de quién es, o dalo de alta",
        description:
          'En el desplegable "Contribuyente" está de quién va a ser el vencimiento. Abajo de la lista, "Administrar contribuyentes" abre el catálogo: ahí se agrega uno nuevo, se le corrige el nombre o el CUIT, y se elige si sus avisos los ve todo el equipo o quedan reservados. Un contribuyente con vencimientos cargados no se puede borrar —se irían con él los importes, las fechas de pago y los comprobantes—; primero se borran los vencimientos.',
        mockup: <MockContribuyentes />,
        hint: "El CUIT es con el que se reconoce el PDF del estudio: si está mal tipeado, el calendario que manden el mes que viene no se va a agendar solo.",
      },
      {
        title: "Agregá un impuesto a mano",
        description:
          'Para uno suelto que no vino en el PDF, el botón "Agregar impuesto" abre el formulario. Los dos botones solo aparecen si tenés permiso de edición.',
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
          "El lápiz de cada fila abre el mismo formulario para corregir el nombre, el organismo, el período o la fecha. Al editar además podés dejar una Observación (quién lo presenta, un recordatorio, etc.).",
        mockup: <MockEditForm />,
      },
      {
        title: "Eliminá con confirmación",
        description:
          "El tacho abre una ventanita que te dice qué impuesto estás por borrar y espera que confirmes. Recién ahí sale del calendario, junto con sus comprobantes.",
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
