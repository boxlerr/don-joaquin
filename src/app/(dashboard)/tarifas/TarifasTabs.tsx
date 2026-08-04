"use client";

import { useState } from "react";
import { Route, TrendingUp } from "lucide-react";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import HelpTutorialButton from "./help-tutorial-button";
import TabClientes from "./TabClientes";
import TabCircuitos from "./TabCircuitos";
import type { CircuitoConRelaciones, ClienteOption, PuntoRutaOption } from "./actions";
import type { AumentoClienteHist } from "./actions-aumentos";

// Quedaron dos secciones. Se sacaron la calculadora de fletes y las "tarifas por
// cliente": la tabla `tarifas` nunca tuvo una fila y ningún viaje quedó atado a
// una, porque el precio no se pacta acá — llega como importe ya liquidado por el
// cliente (el Excel de Loma, la columna $ de la hoja de ruta). Lo que sí se
// sigue es el % de aumento que informa cada cliente.
export type TabId = "tarifas" | "circuitos";
/** Se aceptan los ids viejos porque /metricas linkea con ?tab=aumentos. */
export type TabIdEntrada = TabId | "aumentos" | "calculadora" | "ajustes";

const ALIAS_TAB: Record<TabIdEntrada, TabId> = {
  tarifas: "tarifas",
  circuitos: "circuitos",
  aumentos: "tarifas",
  calculadora: "tarifas",
  ajustes: "tarifas",
};

type Props = {
  clientes: ClienteOption[];
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

const TABS: { id: TabId; label: string; icon: typeof Route }[] = [
  { id: "tarifas", label: "Aumentos por cliente", icon: TrendingUp },
  { id: "circuitos", label: "Circuitos", icon: Route },
];

export default function TarifasTabs({
  clientes,
  circuitos,
  puntos,
  aumentos,
  canWrite = false,
  canMetricas = false,
  initialTab,
  initialCliente,
}: Props) {
  const [tab, setTabState] = useState<TabId>(initialTab ? ALIAS_TAB[initialTab] : "tarifas");

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
      {/* La tira de tabs no entra en 375px: scrollea sola y el subrayado va
          adentro del botón para que el overflow no lo recorte. */}
      <div className="flex items-center gap-2 border-b border-border">
        <HorizontalScrollHint className="min-w-0 flex-1" fadeBg="from-background">
          <div role="tablist" aria-label="Secciones de tarifas" className="flex items-center gap-1">
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
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0088D1]" />}
                </button>
              );
            })}
          </div>
        </HorizontalScrollHint>
        <div className="shrink-0 pb-1">
          <HelpTutorialButton />
        </div>
      </div>

      {tab === "tarifas" && (
        <TabClientes
          aumentosIniciales={aumentos}
          clientes={clientes}
          initialCliente={initialCliente}
          canWrite={canWrite}
          canMetricas={canMetricas}
        />
      )}

      {tab === "circuitos" && (
        <TabCircuitos circuitosIniciales={circuitos} puntos={puntos} canWrite={canWrite} />
      )}
    </div>
  );
}
