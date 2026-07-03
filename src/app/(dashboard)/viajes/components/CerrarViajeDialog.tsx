"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, DollarSign, Check, Receipt, Scale } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { cerrarViajeAction } from "../actions";
import { computeCierre } from "../flujo-logic";
import type { ViajeBasico } from "../types";

interface Props {
  viaje: ViajeBasico;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (patch: Partial<ViajeBasico>) => void;
}

const inputWrap =
  "relative flex items-center h-9 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all";
const iconBox =
  "flex items-center justify-center w-9 h-full border-r border-border bg-muted/50 text-primary shrink-0";
const inputBase =
  "flex-1 h-full px-2.5 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground";

export default function CerrarViajeDialog({ viaje, open, onOpenChange, onSuccess }: Props) {
  const remitoInicial =
    viaje.nro_remito && viaje.nro_remito.toUpperCase() !== "VACIO" ? viaje.nro_remito : "";

  const [nroRemito, setNroRemito] = useState(remitoInicial);
  const [montoFlete, setMontoFlete] = useState(viaje.monto_flete != null ? String(viaje.monto_flete) : "");
  const [tonelaje, setTonelaje] = useState(viaje.toneladas ? String(viaje.toneladas) : "");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Misma regla de cierre/facturación que el server (flujo-logic.computeCierre):
  // entra el remito con su valor → el viaje queda facturado de una.
  const montoIngresado = montoFlete.trim() === "" ? null : Number(montoFlete) || 0;
  const { montoFinal: montoNum, facturado: facturable, cobrado: cobradoFinal } = computeCierre({
    montoActual: viaje.monto_flete,
    montoIngresado,
    esVacio: viaje.es_vacio,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await cerrarViajeAction(viaje.id, {
      observaciones: observaciones.trim() || null,
      nro_remito: nroRemito.trim() || null,
      monto_flete: montoFlete.trim() === "" ? null : Number(montoFlete) || 0,
      tonelaje_real: tonelaje.trim() === "" ? null : Number(tonelaje) || 0,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Error al cerrar el viaje");
      return;
    }
    onSuccess({
      estado: "cerrado",
      facturado: facturable,
      cobrado: cobradoFinal,
      nro_remito: nroRemito.trim() || viaje.nro_remito,
      monto_flete: montoNum,
      toneladas: tonelaje.trim() === "" ? viaje.toneladas : Number(tonelaje) || 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                {viaje.estado === "cerrado" ? "Completar facturación" : `Cerrar viaje ${viaje.codigo}`}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                {viaje.estado === "cerrado" && (
                  <span className="text-amber-600 font-semibold">Viaje ya cerrado · </span>
                )}
                {viaje.cliente} · Cargá remito y valor del viaje
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}

          {/* Datos de facturación: remito + monto + toneladas */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground">Datos de facturación</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Nº de remito</Label>
                <div className={inputWrap}>
                  <div className={iconBox}><Receipt size={13} /></div>
                  <input
                    type="text"
                    value={nroRemito}
                    onChange={(e) => setNroRemito(e.target.value)}
                    maxLength={60}
                    placeholder="Ej: 0813R00281660"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Monto de flete / factura ($)</Label>
                <div className={inputWrap}>
                  <div className={iconBox}><DollarSign size={13} /></div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoFlete}
                    onChange={(e) => setMontoFlete(e.target.value)}
                    placeholder="0"
                    className={inputBase}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Toneladas <span className="text-muted-foreground/70 font-normal">(opcional)</span>
              </Label>
              <div className={inputWrap}>
                <div className={iconBox}><Scale size={13} /></div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tonelaje}
                  onChange={(e) => setTonelaje(e.target.value)}
                  placeholder="0"
                  className={inputBase}
                />
              </div>
            </div>

            {!viaje.es_vacio && (
              <p className="text-[11px] text-muted-foreground">
                {facturable
                  ? "Al confirmar, el viaje queda facturado y listo (con el remito entra el valor)."
                  : "Sin monto de flete el viaje se cierra pero no queda facturado."}
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Observaciones <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </Label>
            <textarea
              placeholder="Ej: Remito entregado en planta, factura A-0001..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full min-h-[72px] px-3 py-2 text-sm rounded-lg border border-border bg-card outline-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all resize-none text-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0F172A] hover:bg-[#1E293B] text-white flex items-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm"
            >
              {loading ? "Cerrando..." : <><Check size={15} /> Confirmar cierre</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
