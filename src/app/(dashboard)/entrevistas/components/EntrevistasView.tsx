"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import EntrevistasTable, { type Entrevista } from "./EntrevistasTable";
import EntrevistasBoard from "./EntrevistasBoard";
import EntrevistaDrawer from "./EntrevistaDrawer";

export default function EntrevistasView({
  entrevistas, canWrite, canDelete,
}: {
  entrevistas: Entrevista[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [vista, setVista] = useState<"tablero" | "tabla">("tablero");
  // Ficha abierta: se guarda el id y se deriva de la lista, así el drawer se
  // actualiza solo cuando el server refresca los datos.
  const [fichaId, setFichaId] = useState<string | null>(null);
  const ficha = useMemo(
    () => (fichaId ? entrevistas.find((e) => e.id === fichaId) ?? null : null),
    [entrevistas, fichaId],
  );

  const opciones = [
    { id: "tablero" as const, label: "Tablero", icon: LayoutGrid },
    { id: "tabla" as const, label: "Tabla", icon: List },
  ];

  const abrirFicha = (e: Entrevista) => setFichaId(e.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        {opciones.map((o) => {
          const Icon = o.icon;
          return (
            <button key={o.id} type="button" onClick={() => setVista(o.id)}
              className={`px-3 h-8 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1.5 ${vista === o.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon size={13} /> {o.label}
            </button>
          );
        })}
      </div>

      {vista === "tablero" ? (
        <EntrevistasBoard entrevistas={entrevistas} canWrite={canWrite} canDelete={canDelete} onVerMas={abrirFicha} />
      ) : (
        <EntrevistasTable entrevistas={entrevistas} canWrite={canWrite} canDelete={canDelete} onVerMas={abrirFicha} />
      )}

      <EntrevistaDrawer entrevista={ficha} onClose={() => setFichaId(null)} canWrite={canWrite} />
    </div>
  );
}
