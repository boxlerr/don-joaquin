"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { egresarChoferAction, type ChoferMotivoEgreso } from "../actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chofer: { id: string; nombre: string; apellido: string };
  onSuccess?: () => void;
  /** Modo "editar": el chofer ya está egresado y sólo se completan/corrigen
   *  la fecha y el motivo (típico de bajas cargadas en masa sin esos datos). */
  mode?: "egresar" | "editar";
  /** Valores iniciales para precargar (fecha de egreso YYYY-MM-DD y motivo). */
  initial?: { motivo?: ChoferMotivoEgreso; fecha_egreso?: string };
}

const MOTIVOS: { value: ChoferMotivoEgreso; label: string }[] = [
  { value: "renuncia", label: "Renuncia" },
  { value: "despido", label: "Despido" },
  { value: "jubilacion", label: "Jubilación" },
  { value: "otro", label: "Otro" },
];

export default function EgresarChoferDialog({ open, onOpenChange, chofer, onSuccess, mode = "egresar", initial }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const esEditar = mode === "editar";
  const [motivo, setMotivo] = useState<ChoferMotivoEgreso>(initial?.motivo ?? "renuncia");
  const [fechaEgreso, setFechaEgreso] = useState(initial?.fecha_egreso ?? today);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    if (isPending) return;
    setError(null);
    setMotivo(initial?.motivo ?? "renuncia");
    setFechaEgreso(initial?.fecha_egreso ?? today);
    setObservacion("");
    onOpenChange(false);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await egresarChoferAction(chofer.id, {
        motivo,
        fecha_egreso: fechaEgreso,
        observacion: observacion.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess?.();
        handleClose();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      {/* `grid-rows-[auto_1fr_auto]`: el cuerpo scrollea solo y el pie queda
          siempre a la vista. Con el celular acostado (alto útil ~343px) el
          botón de confirmar quedaba recortado abajo y no se llegaba a tocar. */}
      {/* `gap-0`: el Popup trae `gap-4` y con `p-0` eso mete dos franjas
          blancas de 16px (una arriba del pie, que dejaba el `border-t`
          flotando) y se come 32px de alto útil, justo lo que falta acostado. */}
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 grid-rows-[auto_1fr_auto] overflow-hidden">
        {/* `pr-10`: el botón de cerrar mide 36px en touch (28 en desktop), así
            que con `pr-6` el texto se le metía abajo. */}
        <DialogHeader className="p-4 pb-3 sm:p-6 sm:pb-3 bg-card border-b border-border">
          <div className="flex items-start gap-3 pr-10">
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <LogOut size={18} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-base font-semibold">
                {esEditar ? "Datos de egreso de" : "Egresar a"} {chofer.apellido}, {chofer.nombre}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs mt-1">
                {esEditar
                  ? "Cargá o corregí la fecha de egreso y el motivo. El chofer sigue egresado; sólo se completan estos datos."
                  : "El chofer se marca como egresado y pasa al historial. Los viajes, gastos y documentos quedan archivados intactos. Se puede reactivar en cualquier momento."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Motivo del egreso</Label>
            <div className="grid grid-cols-2 gap-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMotivo(m.value)}
                  className={`px-3 h-10 sm:h-auto sm:py-2 text-sm rounded-md border transition-colors ${
                    motivo === m.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor="fecha-egreso">
              Fecha de egreso
            </Label>
            <Input
              id="fecha-egreso"
              type="date"
              value={fechaEgreso}
              onChange={(e) => setFechaEgreso(e.target.value)}
              max={today}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor="obs-egreso">
              Observaciones (opcional)
            </Label>
            <textarea
              id="obs-egreso"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Detalle del motivo, contexto, etc."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-md">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* En celular los botones van apilados y a ancho completo (el de
            confirmar arriba, que es el que se busca con el pulgar). */}
        <div className="p-4 bg-muted/30 border-t border-border flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending || !fechaEgreso}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isPending ? "Guardando..." : esEditar ? "Guardar datos" : "Confirmar egreso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
