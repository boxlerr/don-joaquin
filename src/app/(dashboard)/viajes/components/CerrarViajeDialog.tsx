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
import { CheckCircle2, DollarSign, Calendar, CreditCard, Check } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { cerrarViajeAction } from "../actions";
import type { ViajeBasico } from "../types";

const MEDIO_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
] as const;

type Medio = (typeof MEDIO_OPTIONS)[number]["value"];

interface Props {
  viaje: ViajeBasico;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (cobrado: boolean) => void;
}

export default function CerrarViajeDialog({ viaje, open, onOpenChange, onSuccess }: Props) {
  const [cobrado, setCobrado] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [medio, setMedio] = useState<Medio>("transferencia");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await cerrarViajeAction(viaje.id, {
      cobrado,
      fecha,
      medio,
      observaciones: observaciones.trim() || null,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Error al cerrar el viaje");
      return;
    }
    onSuccess(cobrado);
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
                {viaje.estado === "cerrado" ? "Registrar cobro" : `Cerrar viaje ${viaje.codigo}`}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                {viaje.estado === "cerrado" && (
                  <span className="text-amber-600 font-semibold">Viaje ya cerrado sin cobro registrado · </span>
                )}
                {viaje.cliente} ·{" "}
                {viaje.monto_flete
                  ? `$ ${viaje.monto_flete.toLocaleString("es-AR")}`
                  : "Sin monto de flete"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}

          {/* Toggle cobrado */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">¿Se cobró el flete?</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCobrado(true)}
                className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  cobrado
                    ? "bg-green-50 border-green-400 text-green-700"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Sí, ya cobré
              </button>
              <button
                type="button"
                onClick={() => setCobrado(false)}
                className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  !cobrado
                    ? "bg-amber-50 border-amber-400 text-amber-700"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                No, pendiente
              </button>
            </div>
          </div>

          {/* Campos de cobro — solo si cobrado */}
          {cobrado && (
            <div className="space-y-3 p-3 bg-green-50/50 rounded-lg border border-green-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Fecha de cobro</Label>
                  <div className="relative flex items-center h-9 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                    <div className="flex items-center justify-center w-9 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                      <Calendar size={13} />
                    </div>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="flex-1 h-full px-2.5 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground"
                      required={cobrado}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Medio de cobro</Label>
                  <div className="relative flex items-center h-9 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                    <div className="flex items-center justify-center w-9 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                      <CreditCard size={13} />
                    </div>
                    <select
                      value={medio}
                      onChange={(e) => setMedio(e.target.value as Medio)}
                      className="flex-1 h-full px-2.5 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground appearance-none cursor-pointer"
                    >
                      {MEDIO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {viaje.monto_flete && (
                <div className="flex items-center gap-2 text-xs text-green-700 font-semibold bg-green-100 rounded-md px-3 py-1.5">
                  <DollarSign size={13} />
                  Se registrará un ingreso de $ {viaje.monto_flete.toLocaleString("es-AR")} en caja
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Observaciones <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </Label>
            <textarea
              placeholder={cobrado ? "Ej: Pago recibido completo, cheque al día..." : "Ej: Pendiente de pago, acordado para el 30/05..."}
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
