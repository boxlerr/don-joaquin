"use client";

import {
  Bell,
  RefreshCw,
  CheckCheck,
  AlertOctagon,
  Clock,
  ShieldCheck,
  Cake,
  FileWarning,
} from "lucide-react";
import HelpTutorialDialog, {
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton() {
  return <HelpTutorialDialog tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "como",
    label: "Cómo funciona",
    icon: <Bell size={14} />,
    steps: [
      {
        title: "Qué te avisa el sistema",
        description:
          "Esta sección reúne todas las alertas: documentos de camiones y choferes por vencer o vencidos, cheques próximos, cumpleaños de empleados y vencimientos de período de prueba.",
        mockup: <MockLista />,
      },
      {
        title: "Severidad por color",
        description:
          "Las críticas (rojo) son cosas vencidas o que vencen en muy pocos días. Las advertencias (amarillo) están dentro del plazo de aviso de cada tipo de documento.",
        mockup: <MockSeveridad />,
        hint: "Las alertas de documentos se resuelven solas: al renovar el documento, la alerta desaparece.",
      },
      {
        title: "Tipos monitoreados",
        description:
          "Abajo de todo, el panel “Tipos monitoreados” lista cada tipo de documento vigilado con cuántos hay vigentes, próximos y vencidos. Define qué se controla.",
        mockup: <MockTipos />,
      },
    ],
  },
  {
    id: "acciones",
    label: "Acciones",
    icon: <RefreshCw size={14} />,
    steps: [
      {
        title: "Actualizar alertas",
        description:
          'El botón "Actualizar alertas" recalcula todo contra el estado actual de los datos. Úsalo si acabás de cargar o renovar documentos y querés ver el efecto al instante.',
        mockup: <MockActualizar />,
      },
      {
        title: "Marcar todas como leídas",
        description:
          'Cuando hay alertas marcables (cheques, cumpleaños, prueba), aparece "Marcar todas como leídas" para limpiar la bandeja de las que ya revisaste.',
        mockup: <MockMarcar />,
        hint: "Las alertas de vencimiento de documentos no se marcan a mano: solo se van cuando se resuelve el vencimiento.",
      },
    ],
  },
];

function MockLista() {
  const rows = [
    { icon: <FileWarning size={12} className="text-[#DC2626]" />, txt: "VTV — AB 123 CD", sub: "venció hace 3 días", tone: "bad" },
    { icon: <Clock size={12} className="text-[#B45309]" />, txt: "ART — Pérez, Juan", sub: "vence en 12 días", tone: "warn" },
    { icon: <Cake size={12} className="text-primary" />, txt: "Cumpleaños — Gómez, Ana", sub: "hoy", tone: "ok" },
  ];
  return (
    <div className="bg-card border border-border rounded-md p-2 space-y-1.5 text-[11px]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded border border-border">
          {r.icon}
          <span className="flex-1 text-foreground">{r.txt}</span>
          <span className="text-muted-foreground">{r.sub}</span>
        </div>
      ))}
    </div>
  );
}

function MockSeveridad() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#FECACA] bg-[#FEF2F2]">
        <AlertOctagon size={14} className="text-[#DC2626]" />
        <span className="text-[11px] font-semibold text-[#DC2626]">Crítica</span>
        <span className="text-[10px] text-muted-foreground ml-auto">vencido o ≤ 7 días</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#FCD34D] bg-[#FEF3C7]/50">
        <Clock size={14} className="text-[#B45309]" />
        <span className="text-[11px] font-semibold text-[#B45309]">Advertencia</span>
        <span className="text-[10px] text-muted-foreground ml-auto">dentro del plazo de aviso</span>
      </div>
    </div>
  );
}

function MockTipos() {
  const rows = [
    { t: "VTV", vig: 22, prox: 3, venc: 1 },
    { t: "Licencia de conducir", vig: 14, prox: 1, venc: 0 },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-3">
        <span className="flex-1">Tipo</span>
        <span className="w-10 text-right">Vig.</span>
        <span className="w-10 text-right">Próx.</span>
        <span className="w-10 text-right">Venc.</span>
      </div>
      {rows.map((r) => (
        <div key={r.t} className="px-3 py-2 flex items-center gap-3 text-[11px] border-b last:border-0 border-[#F1F5F9]">
          <span className="flex-1 inline-flex items-center gap-1.5 text-foreground">
            <ShieldCheck size={11} className="text-primary" /> {r.t}
          </span>
          <span className="w-10 text-right text-[#065F46] font-semibold">{r.vig}</span>
          <span className="w-10 text-right text-[#B45309] font-semibold">{r.prox}</span>
          <span className="w-10 text-right text-[#DC2626] font-semibold">{r.venc}</span>
        </div>
      ))}
    </div>
  );
}

function MockActualizar() {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="h-9 px-4 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 bg-card border-2 border-[#0088D1] text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.2)]">
        <RefreshCw size={14} /> Actualizar alertas
      </div>
    </div>
  );
}

function MockMarcar() {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="h-9 px-4 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 bg-card border border-border text-muted-foreground">
        <CheckCheck size={14} className="text-primary" /> Marcar todas como leídas
      </div>
    </div>
  );
}
