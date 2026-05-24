"use client";

import { useState } from "react";
import { Calculator, Settings, Users } from "lucide-react";
import AjustesTarifa from "./AjustesTarifa";
import CalculadoraTarifasAvanzada from "./CalculadoraTarifasAvanzada";
import HelpTutorialButton from "./help-tutorial-button";
import TabTarifasPorCliente from "./TabTarifasPorCliente";
import type {
  ClienteOption,
  RutaOption,
  TarifaConRelaciones,
  TarifaParams,
} from "./actions";

type TabId = "calculadora" | "tarifas" | "ajustes";

type Props = {
  params: TarifaParams;
  clientes: ClienteOption[];
  rutas: RutaOption[];
  tarifas: TarifaConRelaciones[];
  canWrite?: boolean;
};

const TABS: { id: TabId; label: string; icon: typeof Calculator }[] = [
  { id: "calculadora", label: "Calculadora", icon: Calculator },
  { id: "tarifas", label: "Tarifas por cliente", icon: Users },
  { id: "ajustes", label: "Ajustes globales", icon: Settings },
];

export default function TarifasTabs({ params, clientes, rutas, tarifas, canWrite = false }: Props) {
  const [tab, setTab] = useState<TabId>("calculadora");

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
        />
      )}

      {tab === "tarifas" && (
        <TabTarifasPorCliente
          tarifasIniciales={tarifas}
          clientes={clientes}
          rutas={rutas}
          canWrite={canWrite}
        />
      )}

      {tab === "ajustes" && (
        <div className="max-w-md">
          <AjustesTarifa params={params} canWrite={canWrite} />
        </div>
      )}
    </div>
  );
}
