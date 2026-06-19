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
import { Receipt, Check, AlertTriangle } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { facturarViajesEnBloqueAction, type FacturarBloqueItem } from "../actions";
import type { ViajeBasico } from "../types";

interface Props {
  viajes: ViajeBasico[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Devuelve el patch aplicado por viaje facturado para refrescar la tabla. */
  onSuccess: (patches: Map<string, Partial<ViajeBasico>>) => void;
}

type FilaForm = {
  nro_remito: string;
  toneladas: string;
  monto: string;
};

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function FacturarBloqueDialog({ viajes, open, onOpenChange, onSuccess }: Props) {
  const [forms, setForms] = useState<Record<string, FilaForm>>(() =>
    Object.fromEntries(
      viajes.map((v) => [
        v.id,
        {
          nro_remito: v.nro_remito && v.nro_remito.toUpperCase() !== "VACIO" ? v.nro_remito : "",
          toneladas: v.toneladas != null && v.toneladas > 0 ? String(v.toneladas) : "",
          monto: v.monto_flete != null && v.monto_flete > 0 ? String(v.monto_flete) : "",
        },
      ]),
    ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (id: string, field: keyof FilaForm, value: string) => {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  // Validación: cada viaje necesita un monto > 0 para emitir factura.
  const sinMonto = viajes.filter((v) => {
    const m = parseNum(forms[v.id]?.monto ?? "");
    return m == null || m <= 0;
  });
  const puedeFacturar = sinMonto.length === 0 && viajes.length > 0;

  const handleSubmit = async () => {
    if (!puedeFacturar) return;
    setLoading(true);
    setError(null);

    const items: FacturarBloqueItem[] = viajes.map((v) => {
      const f = forms[v.id];
      return {
        id: v.id,
        nro_remito: f.nro_remito.trim() || null,
        tonelaje_real: parseNum(f.toneladas),
        monto_flete: parseNum(f.monto),
      };
    });

    const res = await facturarViajesEnBloqueAction(items);
    setLoading(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo facturar.");
      return;
    }

    const patches = new Map<string, Partial<ViajeBasico>>();
    for (const it of items) {
      patches.set(it.id, {
        facturado: true,
        nro_remito: it.nro_remito ?? null,
        toneladas: it.tonelaje_real ?? null,
        monto_flete: it.monto_flete ?? null,
      });
    }
    onSuccess(patches);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#10B981]/10 text-[#10B981] shrink-0">
              <Receipt size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Facturar {viajes.length} viaje{viajes.length !== 1 ? "s" : ""} en bloque
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Cargá remito, tonelaje real y monto. Se marcan como facturados. No impacta caja — el cobro se registra aparte.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="pt-4 space-y-3">
          {error && (
            <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />
          )}

          <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Viaje</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Remito Nº</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-24">Toneladas</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Monto $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {viajes.map((v) => {
                  const f = forms[v.id];
                  const montoFalta = (parseNum(f?.monto ?? "") ?? 0) <= 0;
                  return (
                    <tr key={v.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium text-foreground leading-tight">{v.cliente ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(v.fecha_viaje).toLocaleDateString("es-AR")} · {v.chofer ?? "sin chofer"}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={f?.nro_remito ?? ""}
                          onChange={(e) => setField(v.id, "nro_remito", e.target.value)}
                          placeholder="—"
                          className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={f?.toneladas ?? ""}
                          onChange={(e) => setField(v.id, "toneladas", e.target.value)}
                          placeholder="0"
                          className="w-full text-sm text-right border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={f?.monto ?? ""}
                          onChange={(e) => setField(v.id, "monto", e.target.value)}
                          placeholder="0"
                          className={`w-full text-sm text-right border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 ${
                            montoFalta
                              ? "border-amber-400 focus:ring-amber-300"
                              : "border-border focus:ring-primary/30"
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sinMonto.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-md px-3 py-2">
              <AlertTriangle size={14} className="shrink-0" />
              {sinMonto.length} viaje{sinMonto.length !== 1 ? "s" : ""} sin monto: cargá el importe para poder facturar.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border -mx-6 px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-10 px-6"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !puedeFacturar}
            className="h-10 px-6 bg-[#10B981] hover:bg-[#059669] text-white font-bold flex items-center gap-1.5"
          >
            {loading ? "Facturando..." : (<><Check size={15} /> Facturar {viajes.length}</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
