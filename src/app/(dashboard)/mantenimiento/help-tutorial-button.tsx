"use client";

import {
  Wrench,
  CircleDot,
  BellRing,
  Truck,
  Calendar,
  Gauge,
  User,
  DollarSign,
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
    id: "carga",
    label: "Servicios y roturas",
    icon: <Wrench size={14} />,
    steps: [
      {
        title: "Qué gestiona esta sección",
        description:
          "Acá llevás los services preventivos/reparaciones que hacés vos y la gomería: roturas de gomas no programadas. Se divide en 3 pestañas: Servicios, Roturas de Gomas y Alertas Pendientes.",
        mockup: <MockTabs active="servicios" />,
      },
      {
        title: 'Cargá un servicio',
        description:
          'El botón azul "Cargar servicio" registra un service o reparación: camión (o acoplado), tipo de servicio, fecha, KM y costo. Si cargás el próximo KM/fecha, genera el aviso automático.',
        mockup: <MockServicioForm />,
      },
      {
        title: 'Registrá una rotura de goma',
        description:
          'El botón ámbar "Registrar rotura" anota una pinchadura o reventón: camión, chofer, cantidad de gomas y fecha. Sirve para ver qué choferes rompen más.',
        mockup: <MockRoturaForm />,
        hint: "Service = programado/preventivo. Rotura = imprevisto de gomería.",
      },
    ],
  },
  {
    id: "alertas",
    label: "Alertas",
    icon: <BellRing size={14} />,
    steps: [
      {
        title: "Próximos services",
        description:
          'La pestaña "Alertas Pendientes" muestra los services que se acercan por KM o por fecha. Las vencidas aparecen destacadas en rojo en la tarjeta del encabezado.',
        mockup: <MockAlertas />,
      },
      {
        title: "Roturas por chofer",
        description:
          "Dentro de Roturas hay un resumen por chofer: cuántas gomas rompió cada uno. Útil para detectar manejo o rutas problemáticas.",
        mockup: <MockRoturasPorChofer />,
        hint: "Scania e Iveco van a concesionaria; esta sección se enfoca en gomería y roturas + avisos de service.",
      },
    ],
  },
];

function MockTabs({ active }: { active: string }) {
  const tabs = [
    { id: "servicios", label: "Servicios", icon: <Wrench size={12} /> },
    { id: "roturas", label: "Roturas de Gomas", icon: <CircleDot size={12} /> },
    { id: "alertas", label: "Alertas Pendientes", icon: <BellRing size={12} /> },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={
            "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 -mb-px " +
            (t.id === active
              ? "text-primary border-[#0088D1]"
              : "text-muted-foreground border-transparent")
          }
        >
          {t.icon}
          {t.label}
        </div>
      ))}
    </div>
  );
}

function MockServicioForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Wrench size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Cargar servicio</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Unidad *" value="AB 123 CD" icon={<Truck size={11} />} required />
          <MockField label="Tipo *" value="Cambio de aceite" required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MockField label="Fecha *" value="20/05/2026" icon={<Calendar size={11} />} required />
          <MockField label="KM" value="184.520" icon={<Gauge size={11} />} />
          <MockField label="Costo" value="$ 150k" icon={<DollarSign size={11} />} />
        </div>
        <div className="bg-[#E1F5FE] text-[#004A99] text-[11px] px-3 py-1.5 rounded-md">
          Cargá próximo KM/fecha → genera el aviso de service.
        </div>
      </div>
    </div>
  );
}

function MockRoturaForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#FEF3C7] text-[#B45309] inline-flex items-center justify-center">
          <CircleDot size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Registrar rotura</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Camión *" value="AB 123 CD" icon={<Truck size={11} />} required />
          <MockField label="Chofer" value="Pérez, Juan" icon={<User size={11} />} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Cantidad gomas *" value="2" required />
          <MockField label="Fecha *" value="20/05/2026" required />
        </div>
      </div>
    </div>
  );
}

function MockAlertas() {
  const rows = [
    { unidad: "AB 123 CD", det: "Service por KM (faltan 800 km)", tone: "warn" },
    { unidad: "CD 456 EF", det: "VTV vencida hace 5 días", tone: "bad" },
  ];
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      {rows.map((r, i) => (
        <div
          key={i}
          className={
            "flex items-center justify-between px-2 py-1.5 rounded border " +
            (r.tone === "bad" ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#FCD34D] bg-[#FEF3C7]/50")
          }
        >
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <BellRing size={11} className={r.tone === "bad" ? "text-[#DC2626]" : "text-[#B45309]"} />
            {r.unidad}
          </span>
          <span className={r.tone === "bad" ? "text-[#DC2626]" : "text-[#B45309]"}>{r.det}</span>
        </div>
      ))}
    </div>
  );
}

function MockRoturasPorChofer() {
  const rows = [
    { chofer: "Pérez, Juan", gomas: 5 },
    { chofer: "Gómez, Ana", gomas: 2 },
    { chofer: "Ruiz, Carlos", gomas: 1 },
  ];
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Roturas por chofer</div>
      {rows.map((r) => (
        <div key={r.chofer} className="flex items-center gap-2 text-[11px]">
          <span className="w-24 text-foreground truncate">{r.chofer}</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#F59E0B]" style={{ width: `${r.gomas * 18}%` }} />
          </div>
          <span className="w-6 text-right font-semibold text-foreground">{r.gomas}</span>
        </div>
      ))}
    </div>
  );
}
