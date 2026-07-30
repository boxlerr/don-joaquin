"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeartPulse, Plus, Trash2, CheckCircle2 } from "lucide-react";
import CargarLicenciaDialog from "./CargarLicenciaDialog";
import { cerrarLicenciaAction, eliminarLicenciaAction } from "./actions";
import type { LicenciaMedica } from "./types";
import { formatFecha } from "@/lib/utils";

interface Props {
  chofer_id: string;
  licencias: LicenciaMedica[];
  can_write: boolean;
  /** Egresado: se conserva todo el historial, pero no se cargan novedades nuevas. */
  egresado?: boolean;
  onRefresh: () => void;
}

export default function ChoferLicenciasTab({
  chofer_id,
  licencias,
  can_write,
  egresado = false,
  onRefresh,
}: Props) {
  const [cargarOpen, setCargarOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDelete = async (l: LicenciaMedica) => {
    if (!confirm(`¿Eliminar la licencia desde ${formatFecha(l.fecha_desde)}?`))
      return;
    setBusyId(l.id);
    await eliminarLicenciaAction(l.id, chofer_id);
    setBusyId(null);
    onRefresh();
  };

  const handleCerrar = async (l: LicenciaMedica) => {
    const hoy = new Date().toISOString().split("T")[0];
    const fechaHasta = prompt("Fecha de cierre (AAAA-MM-DD):", hoy);
    if (!fechaHasta) return;
    setBusyId(l.id);
    const res = await cerrarLicenciaAction(l.id, chofer_id, fechaHasta);
    setBusyId(null);
    if (res.error) {
      alert(res.error);
    } else {
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Licencias médicas
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {licencias.length} registro{licencias.length !== 1 ? "s" : ""}
          </span>
        </h3>
        {can_write && !egresado && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
            onClick={() => setCargarOpen(true)}
          >
            <Plus size={13} className="mr-1.5 text-primary" />
            Nueva licencia
          </Button>
        )}
      </div>

      {licencias.length === 0 ? (
        <EmptyState icon={HeartPulse} message="Sin licencias médicas registradas" />
      ) : (
        <div className="space-y-2">
          {licencias.map((l) => (
            <div
              key={l.id}
              className="bg-card rounded-[8px] border border-border p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {formatFecha(l.fecha_desde)}
                    {l.fecha_hasta && (
                      <>
                        <span className="text-muted-foreground mx-1.5">→</span>
                        {formatFecha(l.fecha_hasta)}
                      </>
                    )}
                  </span>
                  {l.en_curso ? (
                    <StatusBadge label="En curso" tone="warning" />
                  ) : (
                    <StatusBadge label={`${l.dias ?? 0} día${(l.dias ?? 0) !== 1 ? "s" : ""}`} tone="info" />
                  )}
                </div>
                {can_write && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {l.en_curso && (
                      <button
                        onClick={() => handleCerrar(l)}
                        disabled={busyId === l.id}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 size={11} />
                        Cerrar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(l)}
                      disabled={busyId === l.id}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 size={11} />
                      {busyId === l.id ? "..." : "Eliminar"}
                    </button>
                  </div>
                )}
              </div>
              {l.motivo && (
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground/70 text-xs uppercase tracking-wide mr-1.5">
                    Motivo:
                  </span>
                  {l.motivo}
                </p>
              )}
              {l.observaciones && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-[#F1F5F9] pt-2">
                  {l.observaciones}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <CargarLicenciaDialog
        chofer_id={chofer_id}
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
