"use client";

import {
  LayoutDashboard,
  MousePointerClick,
  Briefcase,
  Receipt,
  FileText,
  AlertTriangle,
  Trophy,
  Truck,
  Users,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

/** Botón de ayuda del Dashboard. Explica cómo leer el resumen del día y que
 * todas las tarjetas son accesos directos a su sección. */
export default function DashboardHelpButton() {
  return <HelpTutorialDialog title="Guía del Dashboard" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "leer",
    label: "Qué muestra",
    icon: <LayoutDashboard size={14} />,
    steps: [
      {
        title: "Los números del día",
        description:
          "Arriba tenés los contadores clave: viajes activos, movimientos de caja, viáticos y cheques en cartera. Son el pulso operativo y financiero del momento.",
        mockup: <MockKpis />,
      },
      {
        title: "Últimos viajes y alertas",
        description:
          "A la izquierda, los últimos viajes cargados. A la derecha, las alertas activas agrupadas por categoría (documentación, cheques, viajes, personal…) para saber qué atender sin entrar legajo por legajo.",
        mockup: <MockViajesAlertas />,
        hint: "Si no hay nada pendiente, la tarjeta de alertas se pone verde: flota al día.",
      },
      {
        title: "Choferes y premio del mes",
        description:
          "Más abajo aparece el ranking destacado (mejores y peores del período) y el Premio del mes a la mejor eficiencia de combustible.",
        mockup: <MockChoferes />,
      },
    ],
  },
  {
    id: "navegar",
    label: "Cómo usarlo",
    icon: <MousePointerClick size={14} />,
    steps: [
      {
        title: "Todo es un acceso directo",
        description:
          "Cada tarjeta es clickeable y te lleva directo a su sección con el filtro ya aplicado: Documentación crítica abre las notificaciones críticas, Viajes sin facturar abre ese filtro en Viajes, etc.",
        mockup: <MockAccesos />,
        hint: "Usá el Dashboard como tablero de arranque: detectás el problema acá y resolvés en la sección con un clic.",
      },
    ],
  },
];

// ============================ Mockups ============================

function MockKpis() {
  const cards = [
    { l: "Viajes activos", v: "8", Icon: Briefcase, c: "#0088D1" },
    { l: "Mov. de caja", v: "142", Icon: Receipt, c: "#10B981" },
    { l: "Viáticos", v: "5", Icon: FileText, c: "#F59E0B" },
    { l: "Cheques", v: "23", Icon: FileText, c: "#EF4444" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(({ l, v, Icon, c }) => (
        <div key={l} className="rounded-lg border border-border bg-card p-2.5">
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase tracking-wide">
            <Icon size={11} style={{ color: c }} /> {l}
          </div>
          <div className="text-xl font-bold text-foreground mt-0.5">{v}</div>
        </div>
      ))}
    </div>
  );
}

function MockViajesAlertas() {
  return (
    <div className="grid grid-cols-[1.4fr,1fr] gap-2">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-border text-[10px] font-bold text-foreground">Últimos viajes</div>
        <div className="divide-y divide-border">
          {["AB123CD · Loma Negra", "EF456GH · YPF"].map((t) => (
            <div key={t} className="px-2.5 py-1.5 text-[10px] text-muted-foreground">{t}</div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
        <div className="flex items-center gap-1.5 text-[#92400E]">
          <AlertTriangle size={12} />
          <span className="text-[9px] font-extrabold uppercase tracking-wider">Alertas</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 rounded-full bg-[#FEF3C7] border border-[#FCD34D] text-[9px] font-semibold text-[#92400E]">📋 Docs 4</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#FEF3C7] border border-[#FCD34D] text-[9px] font-semibold text-[#92400E]">💰 Cheques 2</span>
        </div>
      </div>
    </div>
  );
}

function MockChoferes() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="text-[10px] font-bold text-foreground mb-1.5">Choferes del período</div>
        <div className="flex items-center justify-between">
          {[
            { n: "Arias", s: "92", c: "#22C55E" },
            { n: "Pérez", s: "78", c: "#F59E0B" },
            { n: "Gómez", s: "54", c: "#EF4444" },
          ].map((x) => (
            <div key={x.n} className="text-center">
              <div className="text-sm font-bold" style={{ color: x.c }}>{x.s}</div>
              <div className="text-[9px] text-muted-foreground">{x.n}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 flex items-center gap-2">
        <Trophy size={13} className="text-amber-500" />
        <span className="text-[10px] font-bold text-amber-800">Premio del mes</span>
        <span className="text-[10px] text-amber-700 ml-auto">28.4 L/100km</span>
      </div>
    </div>
  );
}

function MockAccesos() {
  const cards = [
    { l: "Documentación crítica", v: "3", Icon: ShieldAlert, c: "#E11D48" },
    { l: "Flota de camiones", v: "18", Icon: Truck, c: "#0088D1" },
    { l: "Personal", v: "32", Icon: Users, c: "#7C3AED" },
  ];
  return (
    <div className="space-y-1.5">
      {cards.map(({ l, v, Icon, c }) => (
        <div key={l} className="rounded-lg border border-border bg-card p-2.5 flex items-center gap-2.5">
          <span className="size-7 rounded-md inline-flex items-center justify-center" style={{ backgroundColor: `${c}1A` }}>
            <Icon size={14} style={{ color: c }} />
          </span>
          <span className="text-[11px] font-semibold text-foreground flex-1">{l}</span>
          <span className="text-sm font-black text-foreground">{v}</span>
          <ChevronRight size={13} className="text-muted-foreground/60" />
        </div>
      ))}
    </div>
  );
}
