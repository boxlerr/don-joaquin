"use client";

import {
  ArrowUpRight,
  Download,
  ListChecks,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  return (
    <HelpTutorialDialog title="Guía · A dónde fueron" tabs={TABS} triggerClassName={triggerClassName} />
  );
}

const TABS: TutorialTab[] = [
  {
    id: "como",
    label: "Cómo funciona",
    icon: <ListChecks size={14} />,
    steps: [
      {
        title: "Es la hoja de ruta dada vuelta",
        description:
          "En la hoja de ruta entrás por chofer y ves sus destinos. Acá entrás por destino y ves sus choferes: “a Lomaser mandé a estos cuatro”. Sirve para no tener que abrir chofer por chofer para acordarte a dónde fue el último viaje que le diste.",
        mockup: <MockDestinos />,
        hint: "Los destinos van ordenados por movimiento: primero está a dónde hay que mirar.",
      },
      {
        title: "Se abre en tres niveles",
        description:
          "Clic en el destino y aparecen los choferes que fueron, con su camión, cuántos viajes hicieron y cuándo fue el último. Clic en un chofer y aparecen sus viajes a ESE destino, uno por uno: fecha, desde dónde salió, remito, material, km, toneladas e importe.",
        mockup: <MockNiveles />,
      },
      {
        title: "Cualquier mes, no sólo hoy",
        description:
          "Hoy / ayer / 7 días / este mes, y el desplegable “Otro mes…” lista todos los meses que tienen viajes cargados. El histórico no hay que guardarlo: son los viajes de siempre, lo que faltaba era poder pedirlos.",
        mockup: <MockPeriodo />,
        hint: "Las búsquedas de destino y chofer no llevan acentos ni mayúsculas: “escobar” encuentra “(ESCOBAR) MAPEI”.",
      },
    ],
  },
  {
    id: "editar",
    label: "Corregir y asignar",
    icon: <Pencil size={14} />,
    steps: [
      {
        title: "Se corrige acá, sin ir al listado",
        description:
          "El lápiz de cada viaje abre la fila: desde, remito, material, km, toneladas e importe. Se guarda sólo lo que tocaste — si corregís el remito, el importe queda como estaba. Cada cambio queda en la auditoría con el valor anterior.",
        mockup: <MockEditar />,
        hint: "Vaciar los KM significa cero, no “sin dato”: la base no acepta km nulos.",
      },
      {
        title: "Ponerle el chofer a un viaje que entró sin asignar",
        description:
          "Los viajes que llegan del Excel de programación de Loma entran sin chofer. Aparecen en su propio bloque ámbar dentro del destino, con un buscador para elegir quién va. El camión no lo elegís: sale de la planilla diaria de esa fecha y, si ese día no hay, del camión habitual.",
        mockup: <MockAsignar />,
        hint: "La tarjeta “Sin chofer” de arriba te lleva directo a todos los que faltan asignar.",
      },
    ],
  },
  {
    id: "salir",
    label: "Ir al listado y exportar",
    icon: <ArrowUpRight size={14} />,
    steps: [
      {
        title: "Clic en un viaje y se abre en el listado",
        description:
          "Clic en cualquier fila de viaje y el listado se abre en ese viaje, desplegado y con scroll hasta él. El botón “Ver estos N viajes en el listado” lleva lo mismo que estás viendo: el destino, el chofer y las fechas ya filtrados.",
        mockup: <MockAlListado />,
        hint: "En el listado se ve un chip con el filtro puesto, y se puede quitar de un clic.",
      },
      {
        title: "Exportar a Excel",
        description:
          "“Exportar” baja lo que estás viendo, con las mismas fechas y las mismas búsquedas. Vienen dos hojas: “Por destino”, una fila por chofer con el subtotal de cada destino; y “Viaje por viaje”, el detalle completo para cruzar contra los remitos.",
        mockup: <MockExport />,
        hint: "Los datos se vuelven a leer al exportar, así que el archivo nunca sale con números viejos.",
      },
    ],
  },
];

/* ---------------------------------------------------------------- mockups */

function FilaDestino({
  nombre,
  choferes,
  viajes,
  abierto,
}: {
  nombre: string;
  choferes: number;
  viajes: number;
  abierto?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-border px-3 py-2 last:border-0 ${
        abierto ? "bg-muted" : ""
      }`}
    >
      <MapPin size={11} className="shrink-0 text-primary" />
      <span className="text-[11px] font-bold text-foreground">{nombre}</span>
      <span className="rounded-[3px] border border-border bg-muted px-1 text-[9px] font-semibold text-muted-foreground">
        {choferes} choferes
      </span>
      <span className="ml-auto text-[13px] font-bold text-primary">{viajes}</span>
      <span className="text-[9px] text-muted-foreground">viajes</span>
    </div>
  );
}

function MockDestinos() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <FilaDestino nombre="LOMASER" choferes={4} viajes={4} />
      <FilaDestino nombre="(ESCOBAR) MAPEI" choferes={2} viajes={2} />
      <FilaDestino nombre="RAMALLO" choferes={2} viajes={2} />
    </div>
  );
}

function MockNiveles() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <FilaDestino nombre="LOMASER" choferes={4} viajes={4} abierto />
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-1.5">
        <span className="size-4 shrink-0 rounded-full bg-[#0D9488]/20" />
        <span className="text-[10.5px] font-semibold text-foreground">Paz, Leonardo</span>
        <span className="font-mono text-[9px] font-semibold text-muted-foreground">AF541MH</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          <b className="text-foreground">300</b> km · <b className="text-foreground">1</b> viaje
        </span>
      </div>
      <div className="bg-muted/30 px-3 py-2">
        <div className="overflow-hidden rounded-[4px] border border-border bg-card">
          <div className="flex gap-3 border-b border-border bg-muted px-2 py-1 text-[8.5px] font-bold uppercase text-muted-foreground">
            <span className="w-16">Fecha</span>
            <span className="flex-1">Desde</span>
            <span className="w-10 text-right">KM</span>
          </div>
          <div className="flex gap-3 px-2 py-1 text-[9.5px]">
            <span className="w-16 font-mono font-semibold">29/07/2026</span>
            <span className="flex-1 font-medium">RAMALLO</span>
            <span className="w-10 text-right font-semibold">300</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPeriodo() {
  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex items-center gap-0.5 self-start rounded-lg border border-border bg-muted/40 p-0.5">
        {["Hoy", "Ayer", "7 días", "Este mes"].map((t, i) => (
          <span
            key={t}
            className={`rounded-[5px] px-2 py-1 text-[10px] font-semibold ${
              i === 0 ? "border border-border bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="inline-flex h-8 w-40 items-center justify-between self-start rounded-[6px] border-2 border-[#0088D1] bg-[#E1F5FE] px-2 text-[10.5px] font-semibold text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.15)]">
        Junio 2026 <span className="text-[8px]">▲▼</span>
      </div>
      <p className="text-[9.5px] text-muted-foreground">
        Lista los meses que tienen viajes cargados.
      </p>
    </div>
  );
}

function MockEditar() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex gap-2 border-b border-border bg-muted px-2 py-1 text-[8.5px] font-bold uppercase text-muted-foreground">
        <span className="w-14">Fecha</span>
        <span className="flex-1">Remito</span>
        <span className="w-10 text-right">Tn</span>
      </div>
      <div className="flex items-center gap-2 bg-[#0088D1]/[0.04] px-2 py-1.5">
        <span className="w-14 font-mono text-[9px] text-muted-foreground">29/07/2026</span>
        <span className="h-6 flex-1 rounded-[3px] border border-border bg-card px-1 text-[9.5px] leading-6 text-muted-foreground/60">
          remito
        </span>
        <span className="h-6 w-10 rounded-[3px] border border-border bg-card px-1 text-right text-[9.5px] leading-6">
          38
        </span>
        <span className="inline-flex size-5 items-center justify-center rounded-[3px] border border-primary/50 text-primary">
          ✓
        </span>
      </div>
      <p className="px-2 py-1.5 text-[9px] text-muted-foreground">
        Se guarda sólo lo que tocaste.
      </p>
    </div>
  );
}

function MockAsignar() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b-2 border-[#B45309]/40 bg-[#B45309]/[0.07] px-2 py-1.5 text-[10px] font-bold text-[#B45309]">
        <UserRound size={11} /> 2 viajes sin chofer asignado
      </div>
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="text-[9.5px] text-muted-foreground">Va con:</span>
        <span className="inline-flex h-6 flex-1 items-center justify-between rounded-[4px] border-2 border-[#0088D1] bg-[#E1F5FE] px-1.5 text-[9.5px] font-semibold text-primary">
          Paz, Leonardo <span className="font-mono text-[8px]">AF541MH</span>
        </span>
      </div>
      <p className="px-2 pb-1.5 text-[9px] text-muted-foreground">
        El camión sale de la planilla diaria de ese día.
      </p>
    </div>
  );
}

function MockAlListado() {
  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex items-center gap-1.5 self-start rounded-[6px] border border-border bg-card px-2 py-1.5 text-[10px] font-semibold shadow-sm">
        Ver estos 4 viajes en el listado <ArrowUpRight size={10} className="text-primary" />
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2 shadow-sm">
        <span className="inline-flex items-center gap-1 rounded-[4px] border border-primary/40 bg-primary/5 px-1.5 py-1 text-[9.5px] font-semibold text-primary">
          <MapPin size={9} /> Destino: LOMASER
          <span className="font-normal opacity-80">· sin vueltas vacías</span>
          <span>✕</span>
        </span>
        <span className="text-[9px] text-muted-foreground">el filtro se ve y se puede quitar</span>
      </div>
    </div>
  );
}

function MockExport() {
  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex items-center gap-1.5 self-start rounded-[6px] border-2 border-[#0088D1] bg-[#E1F5FE] px-2.5 py-1.5 text-[10px] font-semibold text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.15)]">
        <Download size={11} /> Exportar
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <div className="flex gap-1 border-b border-border bg-muted px-2 py-1 text-[9px] font-semibold">
          <span className="rounded-t-[3px] border border-b-0 border-border bg-card px-1.5 py-0.5">
            Por destino
          </span>
          <span className="px-1.5 py-0.5 text-muted-foreground">Viaje por viaje</span>
        </div>
        <div className="px-2 py-1.5 text-[9px]">
          <p className="font-bold text-foreground">LOMASER — 4 viajes</p>
          <p className="text-muted-foreground">Paz, Leonardo · AF541MH · 1 · 300 km</p>
          <p className="font-semibold text-foreground">TOTAL · 4 · 900 km</p>
        </div>
      </div>
    </div>
  );
}
