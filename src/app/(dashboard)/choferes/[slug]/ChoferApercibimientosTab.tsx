"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertOctagon, Plus, Trash2 } from "lucide-react";
import CargarApercibimientoDialog from "./CargarApercibimientoDialog";
import {
  eliminarApercibimientoAction,
  getApercibimientoArchivosAction,
  deleteApercibimientoArchivoAction,
} from "./actions";
import type { Apercibimiento, CategoriaApercibimiento } from "./types";
import { formatFecha } from "@/lib/utils";
import AdjuntosInline from "@/components/ui/AdjuntosInline";

// Badge por tipo — indica a qué concepto del score suma (Seguridad vs Conducta).
const TIPO_META: Record<string, { label: string; cls: string }> = {
  apercibimiento: { label: "Apercibimiento", cls: "bg-amber-50 text-amber-700 border-amber-200/70" },
  multa: { label: "Multa de tránsito", cls: "bg-red-50 text-red-700 border-red-200/70" },
  llamado_atencion: { label: "Llamado de atención", cls: "bg-sky-50 text-sky-700 border-sky-200/70" },
  adelanto: { label: "Adelanto de sueldo", cls: "bg-indigo-50 text-indigo-700 border-indigo-200/70" },
};

interface Props {
  chofer_id: string;
  apercibimientos: Apercibimiento[];
  categorias: CategoriaApercibimiento[];
  is_admin: boolean;
  onRefresh: () => void;
}

export default function ChoferApercibimientosTab({
  chofer_id,
  apercibimientos,
  categorias,
  is_admin,
  onRefresh,
}: Props) {
  const [cargarOpen, setCargarOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (a: Apercibimiento) => {
    if (!confirm(`¿Eliminar el apercibimiento del ${formatFecha(a.fecha)}?`))
      return;
    setDeleting(a.id);
    await eliminarApercibimientoAction(a.id, chofer_id);
    setDeleting(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Apercibimientos y sanciones
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {apercibimientos.length} registro{apercibimientos.length !== 1 ? "s" : ""}
          </span>
        </h3>
        {is_admin && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
            onClick={() => setCargarOpen(true)}
          >
            <Plus size={13} className="mr-1.5 text-primary" />
            Nuevo apercibimiento
          </Button>
        )}
      </div>

      {apercibimientos.length === 0 ? (
        <EmptyState icon={AlertOctagon} message="Sin apercibimientos registrados" />
      ) : (
        <div className="space-y-2">
          {apercibimientos.map((a) => (
            <div
              key={a.id}
              className="bg-card rounded-[8px] border border-border p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {formatFecha(a.fecha)}
                  </span>
                  <span
                    className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${
                      (TIPO_META[a.tipo] ?? TIPO_META.apercibimiento).cls
                    }`}
                  >
                    {(TIPO_META[a.tipo] ?? TIPO_META.apercibimiento).label}
                  </span>
                  {a.categoria_nombre && (
                    <span className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-full px-2 py-0.5">
                      {a.categoria_nombre}
                    </span>
                  )}
                </div>
                {is_admin && (
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deleting === a.id}
                    className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
                  >
                    <Trash2 size={11} />
                    {deleting === a.id ? "Eliminando..." : "Eliminar"}
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{a.motivo}</p>
              {a.observaciones && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-[#F1F5F9] pt-2">
                  {a.observaciones}
                </p>
              )}
              <AdjuntosInline
                entidadId={a.id}
                getArchivos={getApercibimientoArchivosAction}
                deleteArchivo={deleteApercibimientoArchivoAction}
                canDelete={is_admin}
              />
            </div>
          ))}
        </div>
      )}

      <CargarApercibimientoDialog
        chofer_id={chofer_id}
        categorias={categorias}
        open={cargarOpen}
        onOpenChange={setCargarOpen}
        onSuccess={() => {
          setCargarOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}
