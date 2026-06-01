"use client";

import {
  Plus,
  Receipt,
  ListFilter,
  Truck,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Tag,
  AlertCircle,
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
    id: "registrar",
    label: "Registrar gasto",
    icon: <Plus size={14} />,
    steps: [
      {
        title: 'Abrí "Registrar gasto"',
        description:
          'Arriba a la derecha de la página, hacé clic en el botón azul "+ Registrar gasto". Se abre un modal centrado.',
        mockup: <MockToolbar />,
      },
      {
        title: "Completá tipo, monto y fecha",
        description:
          "El tipo de gasto (combustible, peaje, repuestos, etc.), el monto y la fecha son obligatorios. El tipo viene del catálogo de tipos de gasto.",
        mockup: <MockGastoForm />,
      },
      {
        title: "Vinculá a un viaje, camión o chofer",
        description:
          "Lo importante de Gastos es la trazabilidad: asociá el gasto a un viaje, un camión y/o un chofer. Así después sabés exactamente a qué unidad u operación corresponde cada peso.",
        mockup: <MockVinculos />,
        hint: "Un gasto sin ningún vínculo cuenta como “Sin asignar” en las stats — ideal dejarlo en cero.",
      },
    ],
  },
  {
    id: "trazabilidad",
    label: "Trazabilidad",
    icon: <ListFilter size={14} />,
    steps: [
      {
        title: "Leé las tarjetas del encabezado",
        description:
          "Total del mes, total histórico, top camión del mes y, en rojo, los gastos “Sin asignar” que todavía no vinculaste a nada.",
        mockup: <MockStats />,
      },
      {
        title: "Filtrá la tabla",
        description:
          "La tabla de gastos se filtra por tipo, por viaje y por camión. Sirve para responder “¿cuánto gasté en este camión?” o “¿qué gastos tiene este viaje?”.",
        mockup: <MockTabla />,
        hint: "El mismo gasto se puede cargar también desde la sección Camiones con el botón “Registrar gasto”.",
      },
    ],
  },
];

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="opacity-50">
        <div className="text-foreground text-sm font-bold">Gastos</div>
        <div className="text-[10px] text-muted-foreground">Trazabilidad por viaje, camión y chofer</div>
      </div>
      <div className="h-9 px-4 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
        <Plus size={14} /> Registrar gasto
      </div>
    </div>
  );
}

function MockGastoForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Receipt size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Registrar gasto</div>
      </div>
      <div className="p-4 space-y-3">
        <MockField label="Tipo de gasto *" value="Peaje" icon={<Tag size={11} />} required />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Monto *" value="$ 12.500" icon={<DollarSign size={11} />} required />
          <MockField label="Fecha *" value="20/05/2026" icon={<Calendar size={11} />} required />
        </div>
        <MockField label="Descripción" value="Ruta 3 — ida" />
      </div>
    </div>
  );
}

function MockVinculos() {
  return (
    <div className="space-y-2 max-w-[420px] mx-auto">
      <MockField label="Viaje" value="V-2026-00042" icon={<MapPin size={11} />} />
      <div className="grid grid-cols-2 gap-2">
        <MockField label="Camión" value="AB 123 CD" icon={<Truck size={11} />} />
        <MockField label="Chofer" value="Pérez, Juan" icon={<User size={11} />} />
      </div>
      <div className="bg-[#E1F5FE] text-[#004A99] text-[11px] px-3 py-1.5 rounded-md">
        Trazabilidad: este gasto queda imputado al viaje, al camión y al chofer.
      </div>
    </div>
  );
}

function MockStats() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border bg-card p-2">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Total del mes</div>
        <div className="text-sm font-bold text-foreground">$ 1.240.000</div>
      </div>
      <div className="rounded-md border border-border bg-card p-2">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Truck size={9} /> Top camión (mes)
        </div>
        <div className="text-sm font-bold text-foreground">AB 123 CD</div>
      </div>
      <div className="rounded-md border border-border bg-card p-2 col-span-2 ring-2 ring-[#FECACA]">
        <div className="text-[9px] text-[#DC2626] uppercase tracking-wide flex items-center gap-1">
          <AlertCircle size={9} /> Sin asignar
        </div>
        <div className="text-sm font-bold text-[#DC2626]">3 gastos pendientes de vincular</div>
      </div>
    </div>
  );
}

function MockTabla() {
  const rows = [
    { tipo: "Peaje", ref: "V-2026-00042", monto: "$ 12.500" },
    { tipo: "Repuestos", ref: "AB 123 CD", monto: "$ 85.000" },
    { tipo: "Combustible", ref: "AB 123 CD", monto: "$ 120.000" },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="h-7 px-2 rounded border-2 border-[#0088D1] bg-[#E1F5FE] text-primary font-semibold inline-flex items-center">
          Camión: AB 123 CD ▾
        </span>
        <span className="text-muted-foreground/70">filtrá por tipo / viaje / camión</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="px-3 py-2 flex items-center gap-3 text-[11px] border-b last:border-0 border-[#F1F5F9]">
          <span className="px-1.5 py-0.5 rounded bg-[#E1F5FE] text-[#004A99] font-medium">{r.tipo}</span>
          <span className="flex-1 font-mono text-muted-foreground">{r.ref}</span>
          <span className="font-semibold text-foreground">{r.monto}</span>
        </div>
      ))}
    </div>
  );
}
