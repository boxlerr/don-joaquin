"use client";

// Vista de Entrevistas: dos vistas con toggle, la Tabla primero (el formato
// Excel de siempre, con sus modales). El Tablero quedó DIVIDIDO (14/07):
// arriba "En proceso" (entrevista / preocupacional, con botones de acción
// explícitos) y abajo los cerrados (Ingresaron / No ingresaron) compactos y
// paginados, así la columna de descartados no crece infinita con los años.

import { useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import EntrevistasTable, { type Entrevista } from "./EntrevistasTable";
import PipelineActivo from "./PipelineActivo";
import CerradosBoard from "./CerradosBoard";
import EntrevistaDrawer from "./EntrevistaDrawer";

const etapaDe = (e: Entrevista): string => e.etapa ?? "entrevista";

export default function EntrevistasView({
  entrevistas, canWrite, canDelete,
}: {
  entrevistas: Entrevista[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  // Tabla primero: es el formato al que están acostumbrados del Excel.
  const [vista, setVista] = useState<"tablero" | "tabla">("tabla");
  // Ficha abierta: se guarda el id y se deriva de la lista, así el modal se
  // actualiza solo cuando el server refresca los datos.
  const [fichaId, setFichaId] = useState<string | null>(null);
  const ficha = useMemo(
    () => (fichaId ? entrevistas.find((e) => e.id === fichaId) ?? null : null),
    [entrevistas, fichaId],
  );
  const abrirFicha = (e: Entrevista) => setFichaId(e.id);

  const enProceso = useMemo(
    () => entrevistas.filter((e) => ["entrevista", "preocupacional"].includes(etapaDe(e))),
    [entrevistas],
  );

  const opciones = [
    { id: "tabla" as const, label: "Tabla", icon: List },
    { id: "tablero" as const, label: "Tablero", icon: LayoutGrid },
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

      {vista === "tabla" ? (
        <EntrevistasTable entrevistas={entrevistas} canWrite={canWrite} canDelete={canDelete} onVerMas={abrirFicha} />
      ) : (
        <div className="space-y-5">
          {/* Arriba: lo que se trabaja en el día a día */}
          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">En proceso ({enProceso.length})</h3>
              <p className="text-xs text-muted-foreground">
                Entrevista → preocupacional → ingresa o se descarta (con motivo).
              </p>
            </div>
            {enProceso.length ? (
              <PipelineActivo entrevistas={enProceso} canWrite={canWrite} canDelete={canDelete} onVerMas={abrirFicha} />
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                No hay candidatos en proceso. Al cargar una entrevista nueva, aparece acá.
              </p>
            )}
          </section>

          {/* Abajo: los cerrados, compactos y paginados */}
          <CerradosBoard entrevistas={entrevistas} onVerMas={abrirFicha} />
        </div>
      )}

      <EntrevistaDrawer entrevista={ficha} onClose={() => setFichaId(null)} canWrite={canWrite} />
    </div>
  );
}
