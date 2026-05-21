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
import { DollarSign, Calendar, CreditCard, Check, Banknote } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { registrarPagoSiniestroAction } from "../actions";
import type { SiniestroConRelaciones } from "./SiniestrosTable";

const MEDIO_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
] as const;

type Medio = (typeof MEDIO_OPTIONS)[number]["value"];

interface Props {
  siniestro: SiniestroConRelaciones;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function RegistrarPagoSiniestroDialog({ siniestro, open, onOpenChange, onSuccess }: Props) {
  const [monto, setMonto] = useState(siniestro.monto_danos != null ? String(siniestro.monto_danos) : "");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [medio, setMedio] = useState<Medio>("transferencia");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoLabel = siniestro.tipo_siniestro === "otro" && siniestro.tipo_siniestro_detalle
    ? siniestro.tipo_siniestro_detalle
    : siniestro.tipo_siniestro.charAt(0).toUpperCase() + siniestro.tipo_siniestro.slice(1);

  const camionLabel = siniestro.camion
    ? `${siniestro.camion.patente} (${siniestro.camion.marca} ${siniestro.camion.modelo})`
    : "Sin camión";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!monto || !Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await registrarPagoSiniestroAction({
      siniestro_id: siniestro.id,
      monto: montoNum,
      fecha,
      medio,
      observaciones: observaciones.trim() || null,
      concepto: `Siniestro ${tipoLabel} - ${camionLabel}`,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-green-50 text-green-600 shrink-0">
              <Banknote size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Registrar pago de siniestro
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                {tipoLabel} · {camionLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Monto *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 text-primary shrink-0">
                  <DollarSign size={15} />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Fecha *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 text-primary shrink-0">
                  <Calendar size={15} />
                </div>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Medio de pago *</Label>
            <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
              <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 text-primary shrink-0">
                <CreditCard size={15} />
              </div>
              <select
                value={medio}
                onChange={(e) => setMedio(e.target.value as Medio)}
                className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground appearance-none cursor-pointer"
              >
                {MEDIO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Observaciones</Label>
            <textarea
              placeholder="Ej: Pago parcial, cubierto por aseguradora..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full min-h-[72px] px-3 py-2 text-sm rounded-lg border border-border bg-card outline-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all resize-none text-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 -mx-6 px-6">
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
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm"
            >
              {loading ? "Registrando..." : <><Check size={15} /> Registrar egreso</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
