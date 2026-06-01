"use client";

import {
  Fuel,
  Trophy,
  Truck,
  User,
  Gauge,
  DollarSign,
  Calendar,
  MapPin,
} from "lucide-react";
import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton() {
  return <HelpTutorialDialog tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "cargar",
    label: "Cargar gasoil",
    icon: <Fuel size={14} />,
    steps: [
      {
        title: 'Abrí "Cargar gasoil"',
        description:
          'Arriba a la derecha, hacé clic en "Cargar gasoil". El mismo formulario está también en la sección Camiones.',
        mockup: <MockToolbar />,
      },
      {
        title: "Completá la carga",
        description:
          "Camión, fecha, KM del odómetro, litros e importe. El KM se autocompleta con el último registrado de esa unidad. Asigná el chofer que la manejaba: es clave para el ranking.",
        mockup: <MockGasoilForm />,
        hint: "Sin chofer asignado la carga cuenta para el camión, pero no suma al ranking de eficiencia.",
      },
    ],
  },
  {
    id: "ranking",
    label: "Ranking y premio",
    icon: <Trophy size={14} />,
    steps: [
      {
        title: "Eficiencia: L/100km",
        description:
          "Con dos cargas o más de un mismo camión con chofer, el sistema calcula los litros cada 100 km. Cuanto más bajo, más eficiente manejó el chofer.",
        mockup: <MockStats />,
      },
      {
        title: "Ranking del mes",
        description:
          "La tabla ordena a los choferes del más eficiente al menos eficiente del mes en curso, con km recorridos, litros, cargas e importe.",
        mockup: <MockRanking />,
      },
      {
        title: "Premio del mes",
        description:
          "El chofer más eficiente del mes queda destacado en la franja dorada del encabezado. Es el incentivo por consumo cuidado.",
        mockup: <MockPremio />,
        hint: "El cálculo es del mes en curso: cada mes el ranking arranca de cero.",
      },
    ],
  },
];

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="opacity-50">
        <div className="text-foreground text-sm font-bold">Combustible &amp; Gasoil</div>
        <div className="text-[10px] text-muted-foreground">Carga, eficiencia y ranking del mes</div>
      </div>
      <div className="h-9 px-4 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
        <Fuel size={14} /> Cargar gasoil
      </div>
    </div>
  );
}

function MockGasoilForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Fuel size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Cargar gasoil</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Camión *" value="AB 123 CD" icon={<Truck size={11} />} required />
          <MockField label="Fecha *" value="20/05/2026" icon={<Calendar size={11} />} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MockField label="KM odóm." value="184.520" icon={<Gauge size={11} />} />
          <MockField label="Litros *" value="300" required />
          <MockField label="Importe *" value="$ 360k" icon={<DollarSign size={11} />} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Chofer" value="Pérez, Juan" icon={<User size={11} />} />
          <MockField label="Estación" value="YPF Ruta 3" icon={<MapPin size={11} />} />
        </div>
      </div>
    </div>
  );
}

function MockStats() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border bg-card p-2">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Litros (mes)</div>
        <div className="text-sm font-bold text-foreground">8.400</div>
      </div>
      <div className="rounded-md border border-border bg-card p-2 ring-2 ring-[#A7F3D0]">
        <div className="text-[9px] text-[#065F46] uppercase tracking-wide">Eficiencia prom.</div>
        <div className="text-sm font-bold text-[#065F46]">38,2 L/100km</div>
      </div>
    </div>
  );
}

function MockRanking() {
  const rows = [
    { pos: 1, chofer: "Pérez, Juan", ef: "34,1", top: true },
    { pos: 2, chofer: "Gómez, Ana", ef: "36,8", top: false },
    { pos: 3, chofer: "Ruiz, Carlos", ef: "41,5", top: false },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-3">
        <span className="w-6">#</span>
        <span className="flex-1">Chofer</span>
        <span className="w-16 text-right">L/100km</span>
      </div>
      {rows.map((r) => (
        <div key={r.pos} className="px-3 py-2 flex items-center gap-3 text-[11px] border-b last:border-0 border-[#F1F5F9]">
          <span className="w-6">
            {r.top ? <Trophy size={12} className="text-[#F59E0B]" /> : r.pos}
          </span>
          <span className="flex-1 text-foreground font-medium">{r.chofer}</span>
          <span className={"w-16 text-right font-bold " + (r.top ? "text-[#065F46]" : "text-primary")}>{r.ef}</span>
        </div>
      ))}
    </div>
  );
}

function MockPremio() {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shrink-0">
        <Trophy size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-amber-700 text-[10px] font-extrabold uppercase tracking-wider">Premio del mes</div>
        <div className="text-amber-900 text-sm font-bold">Pérez, Juan — 34,1 L/100km</div>
      </div>
    </div>
  );
}
