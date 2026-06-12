"use client";

import {
  CalendarDays,
  Truck,
  CopyCheck,
  RotateCcw,
  Zap,
  ListChecks,
} from "lucide-react";
import HelpTutorialDialog, {
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía · Planilla diaria" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "como",
    label: "Cómo funciona",
    icon: <ListChecks size={14} />,
    steps: [
      {
        title: "Una foto del día: quién maneja qué camión",
        description:
          "La planilla muestra todos los choferes activos con su camión habitual ya cargado. Cambiá la fecha arriba para ver o armar la planilla de otro día.",
        mockup: <MockGrid />,
        hint: 'El texto "habitual" indica que ese chofer está en su camión de siempre. Si lo cambiás, el cartelito desaparece.',
      },
      {
        title: "Asigná o liberá una unidad",
        description:
          "Elegí el camión del día en cada fila. Si un chofer no maneja hoy (faltó, franco), dejá su camión en “Sin asignar”. Un mismo camión no puede ir a dos choferes el mismo día: te lo marca en rojo.",
        mockup: <MockReemplazo />,
        hint: "Usá Observaciones para anotar el motivo, ej: “reemplaza a Pérez”.",
      },
    ],
  },
  {
    id: "atajos",
    label: "Atajos y carga",
    icon: <Zap size={14} />,
    steps: [
      {
        title: "Cargá rápido con los atajos",
        description:
          "“Copiar día anterior” trae la asignación de ayer para ajustar solo lo que cambió. “Restaurar habituales” vuelve cada chofer a su camión de siempre.",
        mockup: <MockAtajos />,
      },
      {
        title: "Se engancha con la carga de viajes",
        description:
          "Al cargar viajes del día, el camión se autocompleta con la unidad de esta planilla (en vez del habitual). Siempre podés cambiarlo a mano en el viaje puntual.",
        mockup: <MockEnganche />,
        hint: "Guardá la planilla antes de empezar a cargar viajes para que tome las unidades del día.",
      },
    ],
  },
];

function Row({
  chofer,
  patente,
  habitual,
  tone,
}: {
  chofer: string;
  patente: string;
  habitual?: boolean;
  tone?: "ok" | "bad";
}) {
  const border =
    tone === "bad"
      ? "border-[#FECACA] bg-[#FEF2F2]"
      : "border-border bg-card";
  return (
    <div className="px-3 py-1.5 flex items-center gap-3 text-[11px] border-b last:border-0 border-[#F1F5F9]">
      <span className="font-semibold text-foreground w-28 truncate">{chofer}</span>
      <span className={"h-7 px-2 rounded border inline-flex items-center gap-1 " + border}>
        <Truck size={11} className={tone === "bad" ? "text-red-500" : "text-muted-foreground"} />
        <span className={tone === "bad" ? "text-[#DC2626] font-semibold" : "text-foreground"}>
          {patente}
        </span>
      </span>
      {habitual && (
        <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
          habitual
        </span>
      )}
    </div>
  );
}

function MockGrid() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-border bg-muted/40 text-[10px] flex items-center gap-2 text-muted-foreground">
        <CalendarDays size={11} /> 11/06/2026 · 3 de 3 choferes con camión
      </div>
      <Row chofer="Acosta, J." patente="AB 123 CD" habitual />
      <Row chofer="Benítez, R." patente="AC 456 EF" habitual />
      <Row chofer="Cejas, L." patente="AD 789 GH" habitual />
    </div>
  );
}

function MockReemplazo() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-border bg-muted/40 text-[10px] text-muted-foreground">
        Cejas faltó → Díaz toma su unidad
      </div>
      <Row chofer="Cejas, L." patente="Sin asignar" />
      <Row chofer="Díaz, M." patente="AD 789 GH" />
      <Row chofer="Benítez, R." patente="AC 456 EF" tone="bad" />
      <div className="px-3 py-1.5 text-[10px] text-[#DC2626]">
        AC 456 EF está en dos choferes: corregí antes de guardar.
      </div>
    </div>
  );
}

function MockAtajos() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-9 px-3 rounded-md border-2 border-[#0088D1] bg-[#E1F5FE] text-primary text-xs font-semibold inline-flex items-center gap-1.5 shadow-[0_0_0_4px_rgba(0,136,209,0.15)]">
        <CopyCheck size={13} /> Copiar día anterior
      </div>
      <div className="h-9 px-3 rounded-md border border-border bg-card text-muted-foreground text-xs inline-flex items-center gap-1.5">
        <RotateCcw size={13} /> Restaurar habituales
      </div>
    </div>
  );
}

function MockEnganche() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-border bg-muted/40 text-[10px] flex items-center gap-1.5 text-muted-foreground">
        <Zap size={11} /> Carga rápida de viajes
      </div>
      <div className="px-3 py-2 flex items-center gap-3 text-[11px]">
        <span className="font-semibold text-foreground w-24">Díaz, M.</span>
        <span className="h-7 px-2 rounded border border-[#0088D1] bg-[#E1F5FE] text-primary font-semibold inline-flex items-center gap-1">
          <Truck size={11} /> AD 789 GH
        </span>
        <span className="text-[10px] text-muted-foreground">← autocompletado del día</span>
      </div>
    </div>
  );
}
