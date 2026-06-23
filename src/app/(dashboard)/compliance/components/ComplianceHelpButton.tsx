"use client";

import {
  BookOpen,
  Wrench,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileX,
  Users,
  Truck,
  Building2,
  ExternalLink,
  History,
  Rows3,
  Table2,
  Search,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

/**
 * Botón de ayuda de Compliance. Explica cómo leer el checklist (doble métrica
 * cobertura/vigencia, estados y niveles) y cómo gestionar los documentos
 * (vista lista por entidad vs matriz, cargar/reemplazar, historial, exportar).
 * Reusa el diálogo de tutorial estándar; sirve para Loma Negra, YPF y organismos.
 */
export default function ComplianceHelpButton() {
  return <HelpTutorialDialog title="Guía de Compliance" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "leer",
    label: "Cómo leerlo",
    icon: <BookOpen size={14} />,
    steps: [
      {
        title: "Dos métricas distintas arriba",
        description:
          "El encabezado separa dos cosas que suelen confundirse: la Cobertura (cuánto de lo exigido ya se digitalizó en el sistema) y la Vigencia (de lo que está cargado, cuánto está al día).",
        mockup: <MockMetricas />,
        hint: "Podés tener 100% de vigencia y aún así estar incompleto: significa que lo poco cargado está al día, pero todavía falta subir documentos.",
      },
      {
        title: "Las cuatro tarjetas de estado",
        description:
          "Debajo, cada documento cae en uno de cuatro estados: Vencido, Por vencer, Falta (exigido pero sin digitalizar) y Vigente. Tocá una tarjeta para filtrar la lista por ese estado.",
        mockup: <MockEstados />,
        hint: 'Un "Falta" no es lo mismo que un "Vencido": el faltante todavía no se subió al sistema; el vencido se subió pero ya caducó.',
      },
      {
        title: "Tabs por nivel",
        description:
          "El checklist se organiza en tres niveles según a quién corresponde el documento: Chofer, Unidad y Empresa. El número rojo en cada tab cuenta los problemas pendientes de ese nivel.",
        mockup: <MockNiveles />,
      },
    ],
  },
  {
    id: "gestionar",
    label: "Gestionar documentos",
    icon: <Wrench size={14} />,
    steps: [
      {
        title: "Lista por entidad o matriz",
        description:
          "En Chofer y Unidad podés alternar entre dos vistas: Lista (cada chofer/patente se despliega con sus documentos) y Matriz (una grilla entidad × requisito para ver todo de un golpe).",
        mockup: <MockVistas />,
        hint: "La lista ordena primero a quienes tienen problemas más graves; la matriz es ideal para imprimir o auditar la flota completa.",
      },
      {
        title: "Buscá y filtrá",
        description:
          'Usá el buscador (chofer, patente o requisito), el filtro de Requisitos y el check "Solo problemas" para quedarte únicamente con lo que hay que resolver.',
        mockup: <MockFiltros />,
      },
      {
        title: "Cargá o reemplazá el PDF",
        description:
          "En cada documento tenés tres acciones: abrir el PDF vigente, ver el historial de versiones anteriores y cargar/reemplazar el archivo con su fecha de vencimiento.",
        mockup: <MockAcciones />,
        hint: "Al reemplazar, la versión anterior no se borra: queda guardada en el historial para auditoría.",
      },
      {
        title: "Exportá o imprimí",
        description:
          'Arriba a la derecha, "Exportar" baja el checklist filtrado a Excel e "Imprimir" genera una versión limpia en papel para presentar al cliente u organismo.',
        mockup: <MockExportar />,
      },
    ],
  },
];

// ============================ Mockups ============================

function MockMetricas() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          <Upload size={11} /> Cobertura
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-[#F59E0B]">72%</span>
          <span className="text-[10px] text-muted-foreground">18/25</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: "72%" }} />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          <ShieldCheck size={11} /> Vigencia
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-[#22C55E]">94%</span>
          <span className="text-[10px] text-muted-foreground">17/18</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-[#22C55E]" style={{ width: "94%" }} />
        </div>
      </div>
    </div>
  );
}

function MockEstados() {
  const cards = [
    { l: "Vencido", n: 2, Icon: AlertTriangle, bg: "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]" },
    { l: "Por vencer", n: 3, Icon: Clock, bg: "bg-[#FFFBEB] border-[#FEF3C7] text-[#92400E]" },
    { l: "Falta", n: 7, Icon: FileX, bg: "bg-muted/40 border-border text-muted-foreground" },
    { l: "Vigente", n: 17, Icon: CheckCircle2, bg: "bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(({ l, n, Icon, bg }) => (
        <div key={l} className={`rounded-lg border p-2.5 ${bg}`}>
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
            <Icon size={12} /> {l}
          </div>
          <div className="text-xl font-bold mt-0.5">{n}</div>
        </div>
      ))}
    </div>
  );
}

function MockNiveles() {
  const tabs = [
    { l: "Chofer", Icon: Users, prob: 4, active: true },
    { l: "Unidad", Icon: Truck, prob: 1, active: false },
    { l: "Empresa", Icon: Building2, prob: 0, active: false },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map(({ l, Icon, prob, active }) => (
        <div
          key={l}
          className={
            "px-3 py-2 text-[11px] font-semibold border-b-2 -mb-px inline-flex items-center gap-1.5 " +
            (active ? "text-primary border-primary" : "text-muted-foreground border-transparent")
          }
        >
          <Icon size={13} />
          {l}
          {prob > 0 && (
            <span
              className={
                "text-[9px] font-bold px-1.5 py-0.5 rounded-full " +
                (active ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-muted text-muted-foreground")
              }
            >
              {prob}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MockVistas() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center rounded-md border border-border overflow-hidden w-fit">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-primary text-white">
          <Rows3 size={13} /> Lista
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
          <Table2 size={13} /> Matriz
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="text-muted-foreground">▸</span>
          <span className="text-[11px] font-semibold text-foreground flex-1">Pérez, Juan</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
            1 vencido
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-muted-foreground">▸</span>
          <span className="text-[11px] font-semibold text-foreground flex-1">Gómez, Luis</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#166534]">
            <CheckCircle2 size={13} /> Al día
          </span>
        </div>
      </div>
    </div>
  );
}

function MockFiltros() {
  return (
    <div className="space-y-2">
      <div className="h-8 px-2 rounded-md border-2 border-[#0088D1] bg-card text-[11px] text-muted-foreground/70 inline-flex items-center gap-2 w-full shadow-[0_0_0_4px_rgba(0,136,209,0.18)]">
        <Search size={13} className="text-primary" />
        Buscar chofer, patente o requisito...
      </div>
      <div className="flex items-center gap-2">
        <span className="h-7 px-2.5 text-[11px] rounded-md border border-border bg-card text-muted-foreground inline-flex items-center">
          Requisitos (2)
        </span>
        <label className="text-[11px] text-foreground inline-flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-primary inline-flex items-center justify-center text-white text-[8px]">✓</span>
          Solo problemas
        </label>
      </div>
    </div>
  );
}

function MockAcciones() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="size-2 rounded-full bg-[#F59E0B] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-foreground">LINTI / Licencia</p>
          <p className="text-[10px] text-muted-foreground">Vence 30/07/2026 · Vence en 12d</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
          Por vencer
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="size-6 rounded-md inline-flex items-center justify-center text-muted-foreground bg-muted/50">
            <ExternalLink size={12} />
          </span>
          <span className="size-6 rounded-md inline-flex items-center justify-center text-muted-foreground bg-muted/50">
            <History size={12} />
          </span>
          <span className="size-6 rounded-md inline-flex items-center justify-center text-white bg-[#0088D1]">
            <Upload size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}

function MockExportar() {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 border border-border bg-card text-foreground">
        📊 Exportar
      </span>
      <span className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 border border-border bg-card text-foreground">
        🖨️ Imprimir
      </span>
    </div>
  );
}
