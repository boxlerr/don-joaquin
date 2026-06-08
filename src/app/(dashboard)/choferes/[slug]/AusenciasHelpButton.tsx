"use client";

import {
  Plus,
  CalendarOff,
  CalendarDays,
  ShieldCheck,
  AlertTriangle,
  Bell,
  MapPin,
} from "lucide-react";
import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function AusenciasHelpButton() {
  return <HelpTutorialDialog title="Ausencias y permisos" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "cargar",
    label: "Cargar ausencia",
    icon: <Plus size={14} />,
    steps: [
      {
        title: 'Abrí "Nueva ausencia"',
        description:
          "Desde el legajo del chofer, en la pestaña Ausencias y permisos, hacé clic en “Nueva ausencia”. Sirve para cualquier permiso autorizado: vacaciones, turno médico, trámite del DNI, acto escolar, etc.",
        mockup: <MockToolbar />,
      },
      {
        title: "Completá el detalle y las fechas",
        description:
          "Escribí en un solo campo de qué se trata (ej: “Turno médico”) y elegí desde / hasta. Si es un solo día, poné la misma fecha en ambos. No deja guardar si la fecha de fin es anterior al inicio.",
        mockup: <MockForm />,
      },
      {
        title: "Mirá los avisos antes de confirmar",
        description:
          "El sistema te avisa si el chofer ya tiene viajes asignados en esas fechas, y NO te deja cargar dos ausencias que se pisen para el mismo chofer. Así evitás el “teléfono descompuesto”.",
        mockup: <MockConflicto />,
        hint: "Quien autoriza queda registrado automáticamente. Si mañana la logística la toma otra persona, ve quién dio el permiso y cuándo.",
      },
    ],
  },
  {
    id: "planificar",
    label: "Planificar y alertas",
    icon: <Bell size={14} />,
    steps: [
      {
        title: "Vista de disponibilidad en Viajes",
        description:
          "En la página de Viajes aparece “Disponibilidad — próximos 14 días” con todos los choferes que no van a estar, el motivo y quién autorizó. Arriba a la derecha ves cuántos choferes menos tenés para planificar.",
        mockup: <MockDisponibilidad />,
      },
      {
        title: "Alertas automáticas",
        description:
          "Cada ausencia próxima genera una alerta dentro de la web (igual que cumpleaños y vencimientos). No se manda por mail: queda en el sistema para que la vea cualquiera que agarre la logística.",
        mockup: <MockAlerta />,
        hint: "El preaviso es configurable: por defecto avisa 7 días antes de que arranque la ausencia.",
      },
    ],
  },
];

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="opacity-50">
        <div className="text-foreground text-sm font-bold">Ausencias y permisos</div>
        <div className="text-[10px] text-muted-foreground">3 registros</div>
      </div>
      <div className="h-9 px-4 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
        <Plus size={14} /> Nueva ausencia
      </div>
    </div>
  );
}

function MockForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <CalendarOff size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">
          Nueva ausencia / permiso
        </div>
      </div>
      <div className="p-4 space-y-3">
        <MockField label="Detalle *" value="Turno médico" required />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Desde *" value="10/06/2026" icon={<CalendarDays size={11} />} required />
          <MockField label="Hasta *" value="10/06/2026" icon={<CalendarDays size={11} />} required />
        </div>
      </div>
    </div>
  );
}

function MockConflicto() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-800">
          <AlertTriangle size={13} /> Tiene 1 viaje en estas fechas
        </div>
        <div className="flex items-center gap-2 text-[11px] text-amber-900/90">
          <span className="font-medium">10/06/2026</span>
          <MapPin size={10} className="text-amber-700" />
          <span>Olavarría → Bahía Blanca</span>
        </div>
      </div>
      <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-[11px] text-[#991B1B]">
        Ya hay una ausencia que se solapa con estas fechas: “Vacaciones” (08/06 → 12/06).
      </div>
    </div>
  );
}

function MockDisponibilidad() {
  const rows = [
    { n: "Pérez, Juan", t: "Vacaciones", f: "08/06 → 12/06" },
    { n: "Gómez, Luis", t: "Turno médico", f: "10/06" },
    { n: "Díaz, Ana", t: "Trámite DNI", f: "11/06" },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarOff size={11} className="text-primary" /> Disponibilidad — próximos 14 días
        </span>
        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
          3 choferes menos
        </span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="px-3 py-2 flex items-center gap-3 text-[11px] border-b last:border-0 border-[#F1F5F9]"
        >
          <span className="font-medium text-foreground">{r.n}</span>
          <span className="flex-1 text-muted-foreground">{r.t}</span>
          <span className="text-muted-foreground/80">{r.f}</span>
        </div>
      ))}
    </div>
  );
}

function MockAlerta() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2.5">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
          <Bell size={13} />
        </span>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-foreground">
            Ausencia programada — Pérez, Juan
          </div>
          <div className="text-[11px] text-muted-foreground">
            Juan Pérez no estará disponible del 8 al 12 de junio (Vacaciones). Empieza en 7 días.
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-600">
            <ShieldCheck size={10} /> Autorizó: Virginia
          </div>
        </div>
      </div>
    </div>
  );
}
