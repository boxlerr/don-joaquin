"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarOff, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import CargarAusenciaDialog from "./CargarAusenciaDialog";
import AusenciasHelpButton from "./AusenciasHelpButton";
import { cancelarAusenciaAction } from "./actions";
import type { Ausencia } from "./types";
import { formatFecha } from "@/lib/utils";

interface Props {
  chofer_id: string;
  ausencias: Ausencia[];
  can_write: boolean;
  onRefresh: () => void;
}

export default function ChoferAusenciasTab({
  chofer_id,
  ausencias,
  can_write,
  onRefresh,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Ausencia | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const abrirNueva = () => {
    setEditando(null);
    setDialogOpen(true);
  };

  const abrirEdicion = (a: Ausencia) => {
    setEditando(a);
    setDialogOpen(true);
  };

  const handleCancelar = async (a: Ausencia) => {
    if (!confirm(`¿Cancelar la ausencia "${a.tipo}" del ${formatFecha(a.fecha_inicio)}?`)) return;
    setBusyId(a.id);
    const res = await cancelarAusenciaAction(a.id, chofer_id);
    setBusyId(null);
    if (res.error) {
      alert(res.error);
    } else {
      onRefresh();
    }
  };

  const hoyStr = new Date().toISOString().split("T")[0]!;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Ausencias y permisos
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {ausencias.length} registro{ausencias.length !== 1 ? "s" : ""}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <AusenciasHelpButton />
          {can_write && (
            <Button
              variant="outline"
              size="sm"
              className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
              onClick={abrirNueva}
            >
              <Plus size={13} className="mr-1.5 text-primary" />
              Nueva ausencia
            </Button>
          )}
        </div>
      </div>

      {ausencias.length === 0 ? (
        <EmptyState icon={CalendarOff} message="Sin ausencias ni permisos registrados" />
      ) : (
        <div className="space-y-2">
          {ausencias.map((a) => {
            const futura = a.fecha_inicio > hoyStr;
            const finalizada = a.fecha_fin < hoyStr;
            return (
              <div
                key={a.id}
                className="bg-card rounded-[8px] border border-border p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{a.tipo}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatFecha(a.fecha_inicio)}
                      <span className="text-muted-foreground mx-1.5">→</span>
                      {formatFecha(a.fecha_fin)}
                    </span>
                    {a.en_curso ? (
                      <StatusBadge label="En curso" tone="warning" />
                    ) : futura ? (
                      <StatusBadge label="Programada" tone="info" />
                    ) : finalizada ? (
                      <StatusBadge label="Finalizada" tone="neutral" />
                    ) : null}
                    <StatusBadge
                      label={`${a.dias} día${a.dias !== 1 ? "s" : ""}`}
                      tone="info"
                    />
                  </div>
                  {can_write && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => abrirEdicion(a)}
                        disabled={busyId === a.id}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Pencil size={11} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleCancelar(a)}
                        disabled={busyId === a.id}
                        className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                        {busyId === a.id ? "..." : "Cancelar"}
                      </button>
                    </div>
                  )}
                </div>
                {a.autorizado_por_nombre && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Autorizó: <span className="text-foreground/80">{a.autorizado_por_nombre}</span>
                  </p>
                )}
                {a.observaciones && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-[#F1F5F9] pt-2">
                    {a.observaciones}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CargarAusenciaDialog
        chofer_id={chofer_id}
        ausencia={editando}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          setEditando(null);
          onRefresh();
        }}
      />
    </div>
  );
}
