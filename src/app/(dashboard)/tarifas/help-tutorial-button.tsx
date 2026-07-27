"use client";

import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";
import {
  TrendingUp,
  Route,
  Search,
  Plus,
  Pencil,
  PauseCircle,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Flag,
} from "lucide-react";


function FilaCircuito({
  codigo,
  origen,
  destino,
  carga,
  vacio,
}: {
  codigo: string;
  origen: string;
  destino: string;
  carga: string;
  vacio: string;
}) {
  return (
    <div className="px-3 py-2 flex items-center gap-2 text-[11px] border-b border-border last:border-0">
      <span className="w-10 font-mono text-muted-foreground">{codigo}</span>
      <span className="flex-1 inline-flex items-center gap-1 text-foreground truncate">
        {origen}
        <ArrowRight size={11} className="text-muted-foreground/70 shrink-0" />
        {destino}
      </span>
      <span className="w-12 text-right font-mono text-foreground">{carga}</span>
      <span className="w-12 text-right font-mono text-foreground">{vacio}</span>
      <div className="w-14 flex items-center justify-end gap-1 text-muted-foreground/70">
        <Pencil size={11} />
        <PauseCircle size={11} />
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 1 — Calculadora
// ===========================================================================

function MockSeccionesTabs() {
  const tabs = [
    { label: "Aumentos por cliente", icon: <TrendingUp size={12} />, active: true },
    { label: "Circuitos", icon: <Route size={12} />, active: false },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <div
            key={t.label}
            className={
              "relative flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-medium whitespace-nowrap " +
              (t.active ? "text-primary" : "text-muted-foreground")
            }
          >
            {t.icon}
            {t.label}
            {t.active && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#0088D1]" />
            )}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground/80 px-1">
        Cambiás de sección desde estas pestañas.
      </div>
    </div>
  );
}


// ===========================================================================
// TAB 3 — Circuitos
// ===========================================================================

function MockCircuitoQueEs() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <MapPin size={12} className="text-primary" /> Necochea
          </span>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <ArrowRight size={16} className="text-primary" />
          <span className="text-[9px] text-muted-foreground">280 km carga</span>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
            <Flag size={12} className="text-primary" /> Bahía Blanca
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <ArrowRight size={12} className="rotate-180" /> 60 km de retorno vacío
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Al cargar un viaje con este circuito, los{" "}
        <b>km cargados y vacíos se autocompletan</b>.
      </div>
    </div>
  );
}

function MockCircuitoForm() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Route size={13} />
        </span>
        <span className="text-[11px] font-bold text-foreground">Nuevo circuito</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Origen *" value="Necochea" icon={<MapPin size={11} />} required />
          <MockField label="Destino *" value="Bahía Blanca" icon={<Flag size={11} />} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Km con carga *" value="280" required />
          <MockField label="Km vacíos *" value="60" required />
        </div>
        <MockField label="Código interno" value="110 (opcional)" />
        <div className="flex justify-end pt-1.5 border-t border-border">
          <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            <CheckCircle2 size={11} /> Crear circuito
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCircuitoTable() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex gap-2">
        <span className="w-10">Cód.</span>
        <span className="flex-1">Recorrido</span>
        <span className="w-12 text-right">Carga</span>
        <span className="w-12 text-right">Vacío</span>
        <span className="w-14 text-right">Acciones</span>
      </div>
      <FilaCircuito
        codigo="110"
        origen="Necochea"
        destino="Bahía Blanca"
        carga="280"
        vacio="60"
      />
      <FilaCircuito
        codigo="112"
        origen="Mar del Plata"
        destino="CABA"
        carga="400"
        vacio="120"
      />
    </div>
  );
}

function MockCircuitoListado() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
          />
          <div className="h-8 pl-7 pr-2 bg-card border border-border rounded-md text-[11px] text-muted-foreground/70 inline-flex items-center w-full">
            Buscar por código, origen, destino…
          </div>
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-3.5 rounded border border-border inline-flex" />
          Solo activos
        </label>
        <div className="h-8 px-3 rounded-md bg-[#0088D1] text-white text-[11px] font-bold inline-flex items-center gap-1">
          <Plus size={12} /> Nuevo circuito
        </div>
      </div>
      <MockCircuitoTable />
    </div>
  );
}

function MockCircuitoAcciones() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
        <span className="size-7 rounded-md bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
          <Pencil size={12} />
        </span>
        <div>
          <div className="text-[11px] font-semibold text-foreground">Editar</div>
          <div className="text-[10px] text-muted-foreground">
            Cambiás recorrido, km cargados/vacíos o el código.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
        <span className="size-7 rounded-md bg-amber-50 text-amber-600 inline-flex items-center justify-center shrink-0">
          <PauseCircle size={12} />
        </span>
        <div>
          <div className="text-[11px] font-semibold text-foreground">
            Activar / pausar
          </div>
          <div className="text-[10px] text-muted-foreground">
            Un circuito inactivo deja de ofrecerse al cargar viajes.
          </div>
        </div>
      </div>
    </div>
  );
}


// ===========================================================================
// Tabs
// ===========================================================================


function MockListaClientes() {
  const filas = [
    { n: "LOMA NEGRA", p: "+27,1%", d: "10 aumentos · último jul 26", on: false },
    { n: "YPF", p: "+40,2%", d: "1 aumento · último abr 26", on: true },
  ];
  return (
    <div className="w-48 overflow-hidden rounded-md border border-border">
      <div className="border-b border-border p-1.5">
        <div className="flex items-center gap-1 rounded border border-border px-1.5 py-1 text-[8px] text-muted-foreground">
          <Search size={8} /> Buscar cliente…
        </div>
      </div>
      {filas.map((f) => (
        <div
          key={f.n}
          className={`border-b border-border px-2 py-1.5 ${f.on ? "border-l-2 border-l-[#0088D1] bg-primary/5" : "border-l-2 border-l-transparent"}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-medium text-foreground">{f.n}</span>
            <span className="font-mono text-[8px] font-semibold text-amber-600">{f.p}</span>
          </div>
          <p className="text-[7px] text-muted-foreground">{f.d}</p>
        </div>
      ))}
    </div>
  );
}

function MockEvolucionAumentos() {
  const barras = [3, 0, 3, 3, 1, 2.5, 0, 3.1, 3, 0, 2.2, 2.4, 1];
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1">
        {["12m", "24m", "Todo"].map((k, i) => (
          <span
            key={k}
            className={`rounded border px-1.5 py-0.5 text-[7px] ${i === 2 ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {k}
          </span>
        ))}
        <span className="ml-1 text-[7px] text-muted-foreground">Desde · Hasta</span>
      </div>
      <div className="flex h-14 items-end gap-1">
        {barras.map((b, i) => (
          <span key={i} className="flex-1 rounded-t-[2px] bg-amber-500" style={{ height: `${Math.max(4, (b / 3.2) * 100)}%` }} />
        ))}
      </div>
      <p className="text-[7px] text-muted-foreground">Barras: % de cada mes · Línea: acumulado del rango</p>
    </div>
  );
}

const TABS: TutorialTab[] = [
  {
    id: "aumentos",
    label: "Aumentos",
    icon: <TrendingUp size={14} />,
    steps: [
      {
        title: "Las 2 secciones de Tarifas",
        description:
          "Arriba tenés Aumentos por cliente y Circuitos. La pantalla abre en Aumentos, y el botón Tutorial está a la derecha de las pestañas.",
        mockup: <MockSeccionesTabs />,
      },
      {
        title: "Un cliente a la vez",
        description:
          "A la izquierda están los clientes con aumentos cargados, cada uno con su interanual (los últimos 12 meses, compuesto) y cuándo fue el último. Clic en uno y a la derecha se arma toda su ficha.",
        mockup: <MockListaClientes />,
      },
      {
        title: "Cargar un aumento",
        description:
          "Con “Cargar aumento” registrás una suba de tarifa: el cliente, desde cuándo rige, el % y una nota. Loma Negra los informa mes a mes; YPF pasa un solo interanual por año — los dos entran igual.",
        mockup: <MockListaClientes />,
        hint: "Si la observación arranca con la palabra “Interanual”, se toma como el % de todo el año y se dibuja en una barra más oscura.",
      },
      {
        title: "La evolución",
        description:
          "Las barras son el % de cada mes y la línea el acumulado compuesto. Con 12m / 24m / Todo, o eligiendo desde y hasta, acotás el período: el acumulado se recalcula sobre lo que estés mirando.",
        mockup: <MockEvolucionAumentos />,
      },
      {
        title: "Para qué sirven",
        description:
          "Alimentan “¿Los aumentos van a la par?” en Métricas, que cruza lo que aumentaron los clientes contra lo que se le aumentó a la gente y contra la inflación. Cargar o borrar uno acá cambia esa comparación.",
        mockup: <MockEvolucionAumentos />,
      },
    ],
  },
  {
    id: "circuitos",
    label: "Circuitos",
    icon: <Route size={14} />,
    steps: [
      {
        title: "Qué es un circuito",
        description:
          "Un circuito es un tramo origen → destino con sus km cargados y sus km vacíos típicos. Sirve para no recalcular a mano cada viaje.",
        mockup: <MockCircuitoQueEs />,
        hint: "Al cargar un viaje con este circuito, los km cargados y vacíos se autocompletan.",
      },
      {
        title: "Cargá un circuito nuevo",
        description:
          "Con “Nuevo circuito” elegís origen y destino (con autocompletado de lugares ya usados), los km con carga y los km vacíos. El código interno y la descripción son opcionales.",
        mockup: <MockCircuitoForm />,
        hint: "Origen y destino tienen que ser distintos, y los km no pueden ser negativos.",
      },
      {
        title: "El listado de circuitos",
        description:
          "La tabla muestra código, recorrido, km con carga, km vacíos y estado. Arriba tenés el buscador (código, origen o destino) y el check “Solo activos”.",
        mockup: <MockCircuitoListado />,
      },
      {
        title: "Editar o pausar un circuito",
        description:
          "Igual que las tarifas: el lápiz edita el circuito y el botón de pausa/check lo activa o desactiva. Nada se borra, solo cambia de estado.",
        mockup: <MockCircuitoAcciones />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Tarifas" tabs={TABS} />;
}
