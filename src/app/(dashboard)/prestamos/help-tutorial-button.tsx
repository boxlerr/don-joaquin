"use client";

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import {
  Plus,
  Landmark,
  Percent,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  PiggyBank,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Pencil,
  ListChecks,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers de mockup (todos a nivel de módulo — nunca dentro de un componente)
// ---------------------------------------------------------------------------

function MiniField({
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
          (required ? "border-[#0088D1]/60" : "border-border")
        }
      >
        {icon && <span className="text-primary">{icon}</span>}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function CuotaChip({
  nro,
  fecha,
  estado,
}: {
  nro: number;
  fecha: string;
  estado: "pagada" | "vencida" | "pend";
}) {
  const cls =
    estado === "pagada"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
      : estado === "vencida"
        ? "border-red-200 bg-red-50/70 text-red-700"
        : "border-border bg-card text-foreground";
  return (
    <div className={`rounded-md border px-1.5 py-1 text-[9px] flex items-center gap-1 ${cls}`}>
      <span
        className={
          "size-2.5 rounded-[3px] border inline-flex items-center justify-center shrink-0 " +
          (estado === "pagada"
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-muted-foreground/40")
        }
      >
        {estado === "pagada" && <Check size={7} />}
      </span>
      <span className="truncate">
        <b className="tabular-nums">{nro}</b> · {fecha}
      </span>
    </div>
  );
}

// ===========================================================================
// TAB 1 — Cargar un préstamo
// ===========================================================================

function MockAgregarBtn() {
  const filas: [string, string][] = [
    ["Galicia", "44/48"],
    ["Nación", "12/36"],
    ["Santander", "3/24"],
  ];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[11px] font-bold text-foreground">
          Préstamos <span className="font-normal text-muted-foreground">(3)</span>
        </span>
        <div className="h-7 px-2.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.25)] ring-2 ring-white">
          <Plus size={11} /> Cargar préstamo
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {filas.map(([banco, prog]) => (
          <div key={banco} className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-foreground">
              <Landmark size={11} className="text-primary" /> {banco}
            </span>
            <span className="text-[9px] text-muted-foreground tabular-nums">cuota {prog}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockFormDatos() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <PiggyBank size={13} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          Cargar préstamo
        </span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <MiniField label="Banco *" value="Galicia" icon={<Landmark size={10} />} required />
          <MiniField label="Monto del préstamo" value="$ 150.000.000" />
        </div>
        <MiniField label="Referencia" value="SUECA" />
        <div className="grid grid-cols-2 gap-2">
          <MiniField label="Importe de la cuota *" value="$ 4.500.000" required />
          <MiniField label="Tasa %" value="45" icon={<Percent size={10} />} />
        </div>
      </div>
    </div>
  );
}

function MockFormCuotas() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniField label="Cuotas totales *" value="48" required />
          <MiniField label="Próxima cuota Nº" value="44" required />
          <MiniField label="Vence el *" value="10/08" icon={<CalendarDays size={10} />} required />
        </div>
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Préstamo ya en curso (va por la <b>44 de 48</b>): poné la próxima cuota y su fecha. Las
        anteriores quedan marcadas como <b>pagadas</b> solas.
      </div>
    </div>
  );
}

function MockCronogramaGenerado() {
  const chips: { nro: number; fecha: string; estado: "pagada" | "vencida" | "pend" }[] = [
    { nro: 42, fecha: "10/06", estado: "pagada" },
    { nro: 43, fecha: "10/07", estado: "pagada" },
    { nro: 44, fecha: "10/08", estado: "pend" },
    { nro: 45, fecha: "10/09", estado: "pend" },
    { nro: 46, fecha: "10/10", estado: "pend" },
    { nro: 47, fecha: "10/11", estado: "pend" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 size={12} /> Cronograma generado: 48 cuotas, una por mes
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {chips.map((c) => (
          <CuotaChip key={c.nro} {...c} />
        ))}
      </div>
      <div className="text-[9px] text-muted-foreground">
        Mismo día de cada mes. Después lo corregís cuota por cuota si hace falta.
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Seguimiento (panel y vencimientos)
// ===========================================================================

function MockKpis() {
  const kpis = [
    {
      icon: <CalendarClock size={12} />,
      label: "A pagar esta semana",
      value: "$ 4.500.000",
      tone: "text-foreground",
    },
    {
      icon: <PiggyBank size={12} />,
      label: "A pagar en agosto",
      value: "$ 9.000.000",
      tone: "text-[#0088D1]",
    },
    {
      icon: <AlertTriangle size={12} />,
      label: "Cuotas vencidas",
      value: "0",
      tone: "text-emerald-600",
    },
  ];
  return (
    <div className="space-y-2">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-lg border border-border bg-card px-3 py-2 flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {k.icon} {k.label}
          </span>
          <span className={`text-[15px] font-bold tabular-nums ${k.tone}`}>{k.value}</span>
        </div>
      ))}
    </div>
  );
}

function MockSemanas() {
  const rows = [
    { l: "Esta semana", pct: 55, v: "$ 4.500.000" },
    { l: "11–17 ago", pct: 0, v: "—" },
    { l: "18–24 ago", pct: 100, v: "$ 8.200.000" },
    { l: "25–31 ago", pct: 30, v: "$ 2.400.000" },
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-semibold text-foreground mb-2.5">
        Cuánto hay que pagar por semana
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.l} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[9px] text-muted-foreground">{r.l}</span>
            <div className="flex-1 h-3.5 bg-muted/50 rounded overflow-hidden">
              <div className="h-full bg-[#0088D1]/80 rounded" style={{ width: `${r.pct}%` }} />
            </div>
            <span className="w-20 text-right text-[10px] font-semibold text-foreground tabular-nums">
              {r.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockVencimientos() {
  const rows = [
    { b: "Galicia", c: "44/48", f: "Vence el 10/08", v: "$ 4.500.000", venc: false },
    { b: "Nación", c: "12/36", f: "Venció el 05/07", v: "$ 1.800.000", venc: true },
  ];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-foreground">
        Próximos vencimientos
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((r) => (
          <div key={r.b} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-foreground truncate">
                {r.b} <span className="text-muted-foreground font-normal">— cuota {r.c}</span>
              </div>
              <div className={`text-[9px] ${r.venc ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                {r.f}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-foreground tabular-nums shrink-0">
              {r.v}
            </span>
            <span className="h-6 px-2 rounded border border-border text-[9px] font-semibold text-foreground inline-flex items-center shrink-0">
              Pagada
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockNotificaciones() {
  const avisos = [
    {
      t: "Una semana antes",
      d: "Galicia — la cuota 44 vence el 10/08",
      tone: "border-border bg-card text-foreground",
    },
    {
      t: "El día previo",
      d: "Recordatorio: mañana vence la de Nación",
      tone: "border-[#BAE6FD] bg-[#F0F9FF] text-[#075985]",
    },
    {
      t: "Quedó vencida",
      d: "Santander — cuota 3 sin marcar como pagada",
      tone: "border-red-200 bg-red-50 text-red-700",
    },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
        <Bell size={12} className="text-primary" /> La campana avisa sola
      </div>
      {avisos.map((a) => (
        <div key={a.t} className={`rounded-lg border px-2.5 py-1.5 ${a.tone}`}>
          <div className="text-[9px] font-bold uppercase tracking-wider">{a.t}</div>
          <div className="text-[10px] opacity-90">{a.d}</div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// TAB 3 — Cuotas (cronograma y correcciones)
// ===========================================================================

function MockTablaExpand() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
        <span className="flex-1">Banco</span>
        <span className="w-14 text-center">Progreso</span>
        <span className="w-20 text-right">Falta pagar</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0088D1]/5 border-l-2 border-[#0088D1]">
        <span className="flex-1 flex items-center gap-1 text-[11px] font-medium text-foreground">
          <ChevronDown size={12} className="text-primary" /> Galicia · $150.000.000
        </span>
        <span className="w-14 flex items-center">
          <span className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <span className="block h-full bg-emerald-500 rounded-full" style={{ width: "90%" }} />
          </span>
        </span>
        <span className="w-20 text-right text-[10px] font-semibold tabular-nums text-foreground">
          $ 22.500.000
        </span>
      </div>
      <div className="px-3 py-1.5 text-[9px] text-muted-foreground bg-muted/20 border-t border-border">
        Clic en la fila y se abre el cronograma completo debajo.
      </div>
    </div>
  );
}

function MockCronogramaCheck() {
  const chips: { nro: number; fecha: string; estado: "pagada" | "vencida" | "pend" }[] = [
    { nro: 1, fecha: "10/01", estado: "pagada" },
    { nro: 2, fecha: "10/02", estado: "pagada" },
    { nro: 3, fecha: "10/03", estado: "vencida" },
    { nro: 4, fecha: "10/04", estado: "pend" },
    { nro: 5, fecha: "10/05", estado: "pend" },
    { nro: 6, fecha: "10/06", estado: "pend" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {chips.map((c) => (
          <CuotaChip key={c.nro} {...c} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-[3px] bg-emerald-500" /> Pagada
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-[3px] bg-red-400" /> Vencida
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-[3px] border border-muted-foreground/40" /> Pendiente
        </span>
      </div>
    </div>
  );
}

function MockEditarCuota() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Pencil size={12} />
        </span>
        <span className="text-[11px] font-bold text-foreground">Cuota 44 — Galicia</span>
      </div>
      <div className="p-3 space-y-2.5">
        <MiniField label="Fecha de vencimiento" value="10/08/2026" icon={<CalendarDays size={10} />} />
        <MiniField label="Importe $" value="4.500.000" />
        <div className="flex justify-end gap-1.5 pt-1.5 border-t border-border">
          <span className="h-7 px-2.5 text-[10px] rounded-md border border-border text-muted-foreground inline-flex items-center">
            Cancelar
          </span>
          <span className="h-7 px-2.5 text-[10px] rounded-md bg-[#0088D1] text-white font-bold inline-flex items-center gap-1">
            <Check size={11} /> Guardar
          </span>
        </div>
      </div>
    </div>
  );
}

function MockProgreso() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="font-semibold text-foreground">Galicia</span>
          <span className="text-muted-foreground tabular-nums">43 / 48 cuotas</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: "90%" }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px]">
          <span className="text-muted-foreground">Falta pagar</span>
          <span className="font-bold text-foreground tabular-nums">$ 22.500.000</span>
        </div>
      </div>
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 px-2.5 py-1.5 flex items-center gap-1.5">
        <CheckCircle2 size={12} /> Cuando pagás la última, la próxima cuota muestra{" "}
        <b>Cancelado&nbsp;✅</b>.
      </div>
    </div>
  );
}


function MockCorregirCronograma() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <ListChecks size={12} />
        </span>
        <span className="text-[11px] font-bold text-foreground">Cuotas</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="text-[10px] text-foreground">
          <b>1</b> cuota cargada · <b>1</b> pagada
        </div>
        <div className="border-l-2 border-[#B45309] pl-2 text-[9px] leading-snug text-[#B45309]">
          Figura como <b>Cancelado</b> porque no le queda ninguna cuota por pagar.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold text-muted-foreground inline-flex items-center gap-1">
            <CalendarPlus size={10} className="text-primary" /> Agregar meses
          </span>
          <span className="h-6 w-10 rounded border border-border bg-card text-[10px] text-foreground inline-flex items-center px-2">
            11
          </span>
          <span className="text-[9px] text-muted-foreground">→ serían 12 en total</span>
        </div>
        <div className="inline-flex rounded border border-border overflow-hidden">
          <span className="h-5 px-2 text-[9px] bg-[#0088D1] text-white font-medium inline-flex items-center">
            Ya se pagaron
          </span>
          <span className="h-5 px-2 text-[9px] text-muted-foreground inline-flex items-center">
            Vienen después
          </span>
        </div>
        <div className="text-[9px] text-muted-foreground">
          Se agregan 11 cuotas ya pagadas, de 29/09/2025 a 29/07/2026.
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "cargar",
    label: "Cargar",
    icon: <PiggyBank size={14} />,
    steps: [
      {
        title: "Cargá un préstamo nuevo",
        description:
          "En la tarjeta “Préstamos”, botón “Cargar préstamo”. Es la planilla de siempre pasada al sistema: cada préstamo bancario con su cuota, tasa y cronograma.",
        mockup: <MockAgregarBtn />,
      },
      {
        title: "Los datos del préstamo",
        description:
          "El banco se elige de la lista —ya están todos los que usamos— o se escribe uno nuevo y queda guardado para la próxima. Después el monto del préstamo, el importe de la cuota (obligatorio) y la tasa % si la tenés.",
        mockup: <MockFormDatos />,
        hint: "“Referencia” es para cuando la planilla lo llama por un nombre en vez de un monto (SUECA, FORTE CAR): va ahí, no en el monto.",
      },
      {
        title: "Cuotas totales y por cuál va",
        description:
          "Cuántas cuotas son en total, cuál es la próxima a pagar y qué día vence. Con eso el sistema arma todo el cronograma, una cuota por mes en el mismo día.",
        mockup: <MockFormCuotas />,
        hint: "Para un préstamo ya arrancado (va por la 44 de 48), poné 44 en “Próxima cuota Nº”: las 43 anteriores quedan como pagadas.",
      },
      {
        title: "Qué genera al guardar",
        description:
          "El cronograma completo, automático: cada cuota con su número y su fecha. Las anteriores a la próxima nacen pagadas (en verde) y el resto queda pendiente.",
        mockup: <MockCronogramaGenerado />,
      },
    ],
  },
  {
    id: "seguimiento",
    label: "Seguimiento",
    icon: <CalendarClock size={14} />,
    steps: [
      {
        title: "Los tres números de arriba",
        description:
          "De un vistazo: cuánto hay que pagar esta semana, cuánto en el mes en curso y cuántas cuotas quedaron vencidas sin marcar. El de vencidas se pone rojo si hay alguna.",
        mockup: <MockKpis />,
      },
      {
        title: "Cuánto pagar por semana",
        description:
          "Un gráfico con esta semana y las próximas siete. Sirve para planificar: ver qué semanas vienen cargadas y decidir cuándo conviene pagar o financiar.",
        mockup: <MockSemanas />,
        hint: "Ejemplo: “la tercera semana de agosto la tengo complicada; dejo los pagos para la primera y la cuarta”.",
      },
      {
        title: "Próximos vencimientos",
        description:
          "La lista de las cuotas impagas más cercanas, ordenadas por fecha. Las vencidas aparecen en rojo. Con el botón “Pagada” la marcás sin abrir el préstamo.",
        mockup: <MockVencimientos />,
      },
      {
        title: "La campana te avisa sola",
        description:
          "No hace falta estar mirando: el sistema notifica una semana antes, el día previo, y si una cuota quedó vencida sin marcarse como pagada.",
        mockup: <MockNotificaciones />,
      },
    ],
  },
  {
    id: "cuotas",
    label: "Cuotas",
    icon: <ListChecks size={14} />,
    steps: [
      {
        title: "Abrí el cronograma",
        description:
          "En la tabla “Préstamos”, clic en la fila del banco. Se despliega abajo el cronograma completo con todas las cuotas y su estado.",
        mockup: <MockTablaExpand />,
      },
      {
        title: "Marcá cuotas pagadas",
        description:
          "Cada cuota es un casillero: la tildás para marcarla como pagada (queda verde) y la destildás si te equivocaste. Las vencidas sin pagar se ven en rojo.",
        mockup: <MockCronogramaCheck />,
        hint: "Es lo mismo que el botón “Pagada” de la lista de vencimientos, pero acá ves todo el préstamo junto.",
      },
      {
        title: "Corregí una cuota puntual",
        description:
          "Con el lápiz de una cuota cambiás su fecha de vencimiento y/o su importe. Útil cuando el banco te movió una cuota o cambió el monto. La planilla manda.",
        mockup: <MockEditarCuota />,
      },
      {
        title: "Progreso y lo que falta",
        description:
          "En la tabla cada préstamo muestra la barra de avance (43/48), la próxima cuota y cuánto falta pagar en total. Al saldar la última, la próxima dice “Cancelado”.",
        mockup: <MockProgreso />,
      },
      {
        title: "Si eran más cuotas de las que dice",
        description:
          "Con el lápiz del préstamo, en “Cuotas”: ponés cuántos meses faltan y decís si ya se pagaron o si vienen después. “Ya se pagaron” los mete antes de la primera (el que entró como 1 de 1 y en verdad es la 12 de 12); “Vienen después” los agenda a partir de la última.",
        mockup: <MockCorregirCronograma />,
        hint: "Ahí también se arregla el que dice “Cancelado” sin estarlo: destildás la última y vuelve a los vencimientos.",
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Préstamos" tabs={TABS} />;
}
