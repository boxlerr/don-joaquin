"use client";

import { useState } from "react";
import { Calculator, Route, Users } from "lucide-react";
import CalculadoraTarifasAvanzada from "./CalculadoraTarifasAvanzada";
import HelpTutorialButton from "./help-tutorial-button";
import TabClientes from "./TabClientes";
import TabCircuitos from "./TabCircuitos";
import type {
  CircuitoConRelaciones,
  ClienteOption,
  PuntoRutaOption,
  RutaOption,
  TarifaConRelaciones,
  TarifaParams,
} from "./actions";
import type { AumentoClienteHist } from "./actions-aumentos";

// "aumentos" y "ajustes" ya no son pestañas propias: los aumentos viven dentro
// de la ficha del cliente y los valores base pasaron a la Calculadora, que es
// donde se usan. Se aceptan igual como entrada porque /metricas linkea con
// ?tab=aumentos&cliente=X (ver ALIAS_TAB).
export type TabId = "calculadora" | "tarifas" | "circuitos";
export type TabIdEntrada = TabId | "aumentos" | "ajustes";

const ALIAS_TAB: Record<TabIdEntrada, TabId> = {
  calculadora: "calculadora",
  tarifas: "tarifas",
  circuitos: "circuitos",
  aumentos: "tarifas",
  ajustes: "calculadora",
};

type Props = {
  params: TarifaParams;
  clientes: ClienteOption[];
  rutas: RutaOption[];
  tarifas: TarifaConRelaciones[];
  circuitos: CircuitoConRelaciones[];
  puntos: PuntoRutaOption[];
  aumentos: AumentoClienteHist[];
  canWrite?: boolean;
  /** Puede ver /metricas → el pie de los aumentos linkea al dashboard. */
  canMetricas?: boolean;
  initialTab?: TabIdEntrada;
  /** Cliente preseleccionado (link desde /metricas). */
  initialCliente?: string;
};

const TABS: { id: TabId; label: string; icon: typeof Calculator }[] = [
  { id: "calculadora", label: "Calculadora", icon: Calculator },
  { id: "tarifas", label: "Clientes", icon: Users },
  { id: "circuitos", label: "Circuitos", icon: Route },
];

export default function TarifasTabs({
  params,
  clientes,
  rutas,
  tarifas,
  circuitos,
  puntos,
  aumentos,
  canWrite = false,
  canMetricas = false,
  initialTab,
  initialCliente,
}: Props) {
  const [tab, setTabState] = useState<TabId>(initialTab ? ALIAS_TAB[initialTab] : "calculadora");

  // Tab en la URL: linkeable desde /metricas y sobrevive un refresh.
  const setTab = (t: TabId) => {
    setTabState(t);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", t);
    sp.delete("cliente");
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Secciones de tarifas"
        className="flex items-center gap-1 border-b border-border"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {active && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#0088D1]" />
              )}
            </button>
          );
        })}
        <div className="ml-auto pb-1">
          <HelpTutorialButton />
        </div>
      </div>

      {tab === "calculadora" && (
        <CalculadoraTarifasAvanzada
          params={params}
          clientes={clientes}
          rutas={rutas}
          canWrite={canWrite}
        />
      )}

      {tab === "tarifas" && (
        <TabClientes
          tarifasIniciales={tarifas}
          aumentosIniciales={aumentos}
          clientes={clientes}
          rutas={rutas}
          initialCliente={initialCliente}
          canWrite={canWrite}
          canMetricas={canMetricas}
        />
      )}

      {tab === "circuitos" && (
        <TabCircuitos
          circuitosIniciales={circuitos}
          puntos={puntos}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
