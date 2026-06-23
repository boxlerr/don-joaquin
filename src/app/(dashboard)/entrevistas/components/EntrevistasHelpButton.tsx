"use client";

import {
  UserPlus,
  ListChecks,
  User,
  Calendar,
  MapPin,
  Phone,
  ClipboardCheck,
  UserCheck,
  Clock,
  Search,
  Edit,
} from "lucide-react";
import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

/** Botón de ayuda de Entrevistas. Explica cómo registrar a una persona
 * entrevistada y cómo seguir su estado (preocupacional e ingreso). */
export default function EntrevistasHelpButton() {
  return <HelpTutorialDialog title="Guía de Entrevistas" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "registrar",
    label: "Registrar entrevista",
    icon: <UserPlus size={14} />,
    steps: [
      {
        title: 'Abrí "Nueva entrevista"',
        description:
          'Arriba a la derecha, hacé clic en "+ Nueva entrevista". Se abre un formulario centrado para cargar a la persona que entrevistaste.',
        mockup: <MockToolbar />,
      },
      {
        title: "Cargá quién es",
        description:
          "Lo único obligatorio es el nombre y apellido. Después podés sumar la fecha de entrevista, edad, de dónde es y un teléfono para recontactar.",
        mockup: <MockDatos />,
        hint: "Cargá el teléfono aunque la persona no ingrese ahora: te sirve para llamarla más adelante si necesitás cubrir un puesto.",
      },
      {
        title: "Anotá tu impresión y definí el estado",
        description:
          "En Observaciones escribí tu nota libre (cómo la viste, si la recomendarías). Después definís el Preocupacional y si Entra al transporte.",
        mockup: <MockObsEstados />,
        hint: "El resultado arranca en Pendiente: lo vas actualizando a medida que decidís si ingresa o no.",
      },
    ],
  },
  {
    id: "seguir",
    label: "Seguir y gestionar",
    icon: <ListChecks size={14} />,
    steps: [
      {
        title: "Las tarjetas de arriba",
        description:
          "El encabezado resume el total de entrevistados, cuántos siguen pendientes, cuántos ingresaron y cuántos tienen el preocupacional por hacer.",
        mockup: <MockStats />,
      },
      {
        title: "Buscá y editá",
        description:
          "Usá el buscador para encontrar a una persona por nombre o localidad. Con el botón de editar actualizás su estado —por ejemplo cuando el preocupacional da apto o cuando finalmente ingresa.",
        mockup: <MockBuscarEditar />,
        hint: "Las etiquetas de color te muestran de un vistazo el resultado y el estado del examen preocupacional de cada persona.",
      },
    ],
  },
];

// ============================ Mockups ============================

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="opacity-50">
        <div className="text-foreground text-sm font-bold">Entrevistas</div>
        <div className="text-[10px] text-muted-foreground">Personas entrevistadas y su seguimiento</div>
      </div>
      <div className="h-9 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
        <UserPlus size={14} /> Nueva entrevista
      </div>
    </div>
  );
}

function MockDatos() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] text-foreground text-xs font-bold uppercase tracking-wider">
        Registrar entrevista
      </div>
      <div className="p-4 space-y-3">
        <MockField label="Nombre y apellido *" value="Carlos Pérez" icon={<User size={11} />} required />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Fecha" value="23/06/2026" icon={<Calendar size={11} />} />
          <MockField label="Edad" value="38" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="De dónde es" value="Olavarría" icon={<MapPin size={11} />} />
          <MockField label="Teléfono" value="2284-55..." icon={<Phone size={11} />} />
        </div>
      </div>
    </div>
  );
}

function MockObsEstados() {
  return (
    <div className="space-y-2.5">
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Observaciones</div>
        <div className="rounded border border-border bg-card p-2 text-[11px] text-muted-foreground leading-snug">
          Tranquilo, con experiencia en larga distancia. Lo recomendaría.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Preocupacional</div>
          <div className="h-7 px-2 text-[11px] rounded border border-border bg-card text-foreground inline-flex items-center gap-1.5 w-full">
            <ClipboardCheck size={11} className="text-primary" /> Se le va a hacer
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">¿Entra?</div>
          <div className="h-7 px-2 text-[11px] rounded border border-[#0088D1]/60 bg-card text-foreground inline-flex items-center gap-1.5 w-full">
            <UserCheck size={11} className="text-primary" /> Pendiente
          </div>
        </div>
      </div>
    </div>
  );
}

function MockStats() {
  const cards = [
    { l: "Total", v: "24", c: "text-primary" },
    { l: "Pendientes", v: "6", c: "text-[#B45309]" },
    { l: "Ingresaron", v: "9", c: "text-[#166534]" },
    { l: "Preocup. pend.", v: "3", c: "text-[#DC2626]" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((x) => (
        <div key={x.l} className="rounded-md border border-border bg-card p-2.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{x.l}</div>
          <div className={`text-lg font-bold ${x.c}`}>{x.v}</div>
        </div>
      ))}
    </div>
  );
}

function MockBuscarEditar() {
  return (
    <div className="space-y-2.5">
      <div className="h-9 px-2 rounded-md border-2 border-[#0088D1] bg-card text-[11px] text-muted-foreground/70 inline-flex items-center gap-2 w-full shadow-[0_0_0_4px_rgba(0,136,209,0.18)]">
        <Search size={13} className="text-primary" /> Buscar por nombre o localidad...
      </div>
      <div className="rounded-md border border-border bg-card p-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-foreground">Carlos Pérez</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] inline-flex items-center gap-1">
              <UserCheck size={9} /> Ingresa
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] inline-flex items-center gap-1">
              <Clock size={9} /> Preocup. pend.
            </span>
          </div>
        </div>
        <span className="size-7 rounded-md inline-flex items-center justify-center text-primary bg-[#E1F5FE]">
          <Edit size={13} />
        </span>
      </div>
    </div>
  );
}
