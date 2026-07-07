"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import EntrevistasTable, { type Entrevista } from "./EntrevistasTable";
import EntrevistasBoard from "./EntrevistasBoard";

export default function EntrevistasView({
  entrevistas, canWrite, canDelete,
}: {
  entrevistas: Entrevista[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [vista, setVista] = useState<"tablero" | "tabla">("tablero");
  const opciones = [
    { id: "tablero" as const, label: "Tablero", icon: LayoutGrid },
    { id: "tabla" as const, label: "Tabla", icon: List },
  ];

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
        <EntrevistasBoard entrevistas={entrevistas} canWrite={canWrite} />
      ) : (
        <EntrevistasTable entrevistas={entrevistas} canWrite={canWrite} canDelete={canDelete} />
      )}
    </div>
  );
}
