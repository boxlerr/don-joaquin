"use client";

import {
  UserPlus,
  ListChecks,
  User,
  Calendar,
  MapPin,
  ClipboardCheck,
  UserCheck,
  Search,
  Edit,
  LayoutGrid,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Mail,
  CreditCard,
  Eye,
} from "lucide-react";
import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

/** Botón de ayuda de Entrevistas: registrar candidatos, adjuntar el CV, y seguir
 *  su avance por el pipeline (tablero por etapas). */
export default function EntrevistasHelpButton() {
  return <HelpTutorialDialog title="Guía de Entrevistas" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "registrar",
    label: "Registrar candidato",
    icon: <UserPlus size={14} />,
    steps: [
      {
        title: 'Abrí "Nueva entrevista"',
        description:
          'Arriba a la derecha, "+ Nueva entrevista". Se abre un formulario para cargar a la persona que entrevistaste o que se postuló.',
        mockup: <MockToolbar />,
      },
      {
        title: "Cargá sus datos",
        description:
          "Lo único obligatorio es el nombre. Podés sumar fecha, edad, de dónde es, teléfono, DNI, email, el puesto al que aplica y su experiencia.",
        mockup: <MockDatos />,
        hint: "Cargá el teléfono/email aunque no ingrese ahora: te sirve para recontactarla si después necesitás cubrir un puesto.",
      },
      {
        title: "Impresión y estado",
        description:
          "En Observaciones va tu nota libre (cómo la viste, si la recomendarías). Definís el preocupacional y si entra al transporte — los desplegables muestran opciones claras.",
        mockup: <MockObsEstados />,
      },
      {
        title: "Adjuntá el CV",
        description:
          "Al editar un candidato podés subir su CV (o varios documentos). Quedan guardados y se pueden previsualizar y descargar cuando quieras.",
        mockup: <MockCv />,
        hint: "Se sube directo, hasta 100 MB por archivo. También hay un botón de CV en cada tarjeta del pipeline y en el historial.",
      },
    ],
  },
  {
    id: "pipeline",
    label: "El proceso",
    icon: <LayoutGrid size={14} />,
    steps: [
      {
        title: "En proceso, arriba",
        description:
          "El Tablero está dividido: arriba SOLO los candidatos activos (En entrevista y En preocupacional) y abajo los cerrados (Ingresaron / No ingresaron), compactos. Con el toggle cambiás entre Tabla y Tablero.",
        mockup: <MockTablero />,
      },
      {
        title: "El flujo",
        description:
          "Entrevista → se descarta (con motivo) o pasa al preocupacional → si da bien, Ingresó. Al mandarlo al preocupacional, el examen queda marcado «a realizar» solo.",
        mockup: <MockEtapas />,
        hint: "Al mover a «Ingresó» o «Descartado», el resultado se actualiza solo. Si lo movés hacia atrás, vuelve a pendiente.",
      },
      {
        title: "Botones de acción",
        description:
          "Cada tarjeta tiene botones que dicen lo que hacen: «Preocupacional →», «Ingresó» y «Descartar». Nada de flechitas: apretás lo que pasó y listo.",
        mockup: <MockCard />,
      },
    ],
  },
  {
    id: "seguir",
    label: "Seguir y buscar",
    icon: <ListChecks size={14} />,
    steps: [
      {
        title: "Las tarjetas de arriba",
        description:
          "El encabezado resume el total de candidatos, cuántos siguen pendientes, cuántos ingresaron y cuántos tienen el preocupacional por hacer.",
        mockup: <MockStats />,
      },
      {
        title: "Buscá en el histórico",
        description:
          "La vista Tabla tiene un buscador por nombre, localidad u observaciones y el filtro por resultado — sirve para saber si alguien ya fue entrevistado antes. Con el lápiz editás sus datos y su CV.",
        mockup: <MockBuscarEditar />,
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
        <div className="text-[10px] text-muted-foreground">Candidatos y su seguimiento</div>
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
          <MockField label="DNI" value="30.123.456" icon={<CreditCard size={11} />} />
          <MockField label="Email" value="carlos@..." icon={<Mail size={11} />} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="De dónde es" value="Olavarría" icon={<MapPin size={11} />} />
          <MockField label="Puesto" value="Chofer" icon={<Briefcase size={11} />} />
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

function MockCv() {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground">CV / documentos</div>
      <div className="rounded-md border border-border bg-card p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-foreground">
          <span className="size-7 rounded bg-red-50 text-red-600 inline-flex items-center justify-center text-[9px] font-bold">PDF</span>
          CV - Carlos Pérez.pdf
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Eye size={13} className="text-primary" />
          <span className="text-[10px]">Previsualizar</span>
        </div>
      </div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0088D1]">
        <Paperclip size={12} /> Subir CV / documento
      </div>
    </div>
  );
}

function MockTablero() {
  const cols = [
    { l: "Nuevo", n: 3, c: "bg-slate-100 text-slate-700" },
    { l: "Entrevista", n: 2, c: "bg-blue-50 text-blue-700" },
    { l: "Ingresó", n: 5, c: "bg-emerald-50 text-emerald-700" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map((col, i) => (
        <div key={col.l} className="bg-muted/40 rounded-lg border border-border p-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${col.c}`}>{col.l}</span>
            <span className="text-[9px] text-muted-foreground">{col.n}</span>
          </div>
          <div className="bg-card border border-border rounded p-1.5">
            <div className="text-[10px] font-semibold text-foreground">C. Pérez</div>
            <div className="text-[8px] text-primary">{i === 0 ? "Chofer" : i === 1 ? "Adm." : "Chofer"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockEtapas() {
  const etapas = [
    { l: "Nuevo", c: "bg-slate-100 text-slate-700" },
    { l: "Entrevista", c: "bg-blue-50 text-blue-700" },
    { l: "Preocupacional", c: "bg-amber-50 text-amber-700" },
    { l: "Ingresó", c: "bg-emerald-50 text-emerald-700" },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {etapas.map((e, i) => (
        <span key={e.l} className="inline-flex items-center gap-1">
          <span className={`text-[10px] font-bold px-2 py-1 rounded ${e.c}`}>{e.l}</span>
          {i < etapas.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
        </span>
      ))}
    </div>
  );
}

function MockCard() {
  return (
    <div className="max-w-[200px] mx-auto bg-card border border-border rounded-lg p-2.5 shadow-md">
      <div className="text-sm font-semibold text-foreground">Carlos Pérez</div>
      <div className="text-[11px] text-primary font-medium">Chofer larga distancia</div>
      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><MapPin size={10} /> Olavarría · 38 años</div>
      <div className="flex items-center justify-between mt-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-primary border border-primary/30 bg-primary/5 rounded px-1.5 py-0.5"><Paperclip size={10} /> 1 CV</span>
        <div className="flex items-center gap-0.5">
          <span className="p-1 rounded bg-muted text-muted-foreground"><ChevronLeft size={13} /></span>
          <span className="p-1 rounded bg-[#0088D1]/10 text-primary ring-2 ring-[#0088D1]/30"><ChevronRight size={13} /></span>
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
          <div className="text-[11px] font-semibold text-foreground inline-flex items-center gap-1.5">
            Carlos Pérez
            <span className="inline-flex items-center gap-0.5 text-[9px] text-primary border border-primary/30 bg-primary/5 rounded px-1 py-0.5"><Paperclip size={8} /> 1 CV</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] inline-flex items-center gap-1">
              <UserCheck size={9} /> Ingresa
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
