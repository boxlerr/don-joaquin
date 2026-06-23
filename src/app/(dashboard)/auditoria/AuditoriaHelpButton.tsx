"use client";

import {
  ShieldAlert,
  Filter,
  User,
  Clock,
  Search,
  Eye,
  MapPin,
  Banknote,
  Truck,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

/** Botón de ayuda de Auditoría. Explica qué queda registrado y cómo filtrar
 * y ver el detalle de cada operación. */
export default function AuditoriaHelpButton() {
  return <HelpTutorialDialog title="Guía de Auditoría" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "registra",
    label: "Qué registra",
    icon: <ShieldAlert size={14} />,
    steps: [
      {
        title: "Cada operación crítica queda guardada",
        description:
          "Toda alta, baja o modificación importante deja un rastro: quién la hizo, cuándo, sobre qué entidad y qué acción ejecutó. También se registran los accesos al sistema.",
        mockup: <MockLog />,
        hint: "El registro es automático y no se puede borrar: es la fuente de verdad para saber quién tocó qué.",
      },
    ],
  },
  {
    id: "filtrar",
    label: "Filtrar y ver",
    icon: <Filter size={14} />,
    steps: [
      {
        title: "Tabs por entidad",
        description:
          "Arriba elegís sobre qué querés mirar: Viajes, Cheques, Caja, Choferes, Camiones, Usuarios y permisos, Accesos, Configuración… o Todas a la vez.",
        mockup: <MockTabs />,
      },
      {
        title: "Afiná con los filtros",
        description:
          "Acotá por rango de fechas, por usuario, por tipo de acción (creó, editó, eliminó…) y usá el buscador para encontrar un registro puntual.",
        mockup: <MockFiltros />,
      },
      {
        title: "Clic en una fila para el detalle",
        description:
          "Cada entrada es clickeable: se abre el detalle con los valores anteriores y nuevos, así ves exactamente qué cambió en esa operación.",
        mockup: <MockDetalle />,
        hint: "Los resultados están paginados: usá las flechas para recorrer el histórico completo.",
      },
    ],
  },
];

// ============================ Mockups ============================

function MockLog() {
  const rows = [
    { Icon: MapPin, e: "Viaje", a: "Editó", ac: "bg-[#E1F5FE] text-primary", u: "L. Rodríguez", t: "hace 5 min" },
    { Icon: Banknote, e: "Cheque", a: "Creó", ac: "bg-[#DCFCE7] text-[#166534]", u: "M. Gómez", t: "hace 1 h" },
    { Icon: Truck, e: "Camión", a: "Eliminó", ac: "bg-[#FEE2E2] text-[#991B1B]", u: "Admin", t: "ayer" },
  ];
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2">
          <span className="size-7 rounded-md bg-muted/60 inline-flex items-center justify-center text-muted-foreground">
            <r.Icon size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.ac}`}>{r.a}</span>
              <span className="text-[11px] font-semibold text-foreground">{r.e}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
              <span className="inline-flex items-center gap-0.5"><User size={9} /> {r.u}</span>
              <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {r.t}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockTabs() {
  const tabs = ["Todas", "Viajes", "Cheques", "Caja", "Usuarios"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map((t, i) => (
        <span
          key={t}
          className={
            "px-2.5 py-1 rounded-md text-[11px] font-semibold border " +
            (i === 1 ? "bg-[#0088D1] text-white border-[#0088D1]" : "bg-card text-muted-foreground border-border")
          }
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function MockFiltros() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 px-2 rounded-md border border-border bg-card text-[10px] text-muted-foreground inline-flex items-center">Desde 01/06/2026</div>
        <div className="h-8 px-2 rounded-md border border-border bg-card text-[10px] text-muted-foreground inline-flex items-center">Hasta 23/06/2026</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 px-2 rounded-md border border-border bg-card text-[10px] text-muted-foreground inline-flex items-center gap-1"><User size={11} /> Usuario</div>
        <div className="h-8 px-2 rounded-md border border-border bg-card text-[10px] text-muted-foreground inline-flex items-center">Acción: Editó</div>
      </div>
      <div className="h-8 px-2 rounded-md border-2 border-[#0088D1] bg-card text-[10px] text-muted-foreground/70 inline-flex items-center gap-2 w-full shadow-[0_0_0_4px_rgba(0,136,209,0.18)]">
        <Search size={12} className="text-primary" /> Buscar en el detalle...
      </div>
    </div>
  );
}

function MockDetalle() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-[11px] font-bold text-foreground">
        <Eye size={13} className="text-primary" /> Detalle de la operación
      </div>
      <div className="p-3 space-y-2 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Monto flete</span>
          <span className="flex items-center gap-1.5">
            <span className="line-through text-muted-foreground/70">$ 180.000</span>
            <span className="text-[#166534] font-semibold">$ 210.000</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Estado</span>
          <span className="flex items-center gap-1.5">
            <span className="line-through text-muted-foreground/70">Pendiente</span>
            <span className="text-[#166534] font-semibold">Facturado</span>
          </span>
        </div>
      </div>
    </div>
  );
}
