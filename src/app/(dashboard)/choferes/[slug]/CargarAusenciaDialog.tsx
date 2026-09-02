"use client";

import AusenciaDialog from "@/components/ausencias/AusenciaDialog";
import type { Ausencia } from "./types";

interface Props {
  chofer_id: string;
  ausencia?: Ausencia | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  // Cuando se abre desde el tab de Vacaciones, arranca con la marca activada.
  defaultVacaciones?: boolean;
}

/**
 * El alta de ausencias del legajo. El formulario es el mismo que el del tablero
 * (`AusenciaDialog`): acá la persona ya está definida por el legajo que se está
 * mirando, y además se puede marcar el período como vacaciones.
 */
export default function CargarAusenciaDialog({
  chofer_id,
  ausencia,
  open,
  onOpenChange,
  onSuccess,
  defaultVacaciones,
}: Props) {
  return (
    <AusenciaDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      choferFijoId={chofer_id}
      ausencia={ausencia}
      defaultVacaciones={defaultVacaciones}
      variante="completo"
    />
  );
}
