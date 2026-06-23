"use client";

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Coins, Check, AlertTriangle } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { cobrarViajesEnBloqueAction, type CobrarBloqueItem } from "../actions";
import type { ViajeBasico } from "../types";

type Medio = "efectivo" | "transferencia" | "cheque" | "otro";

const MEDIO_LABEL: Record<Medio, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

interface Props {
  viajes: ViajeBasico[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Patch aplicado por viaje cobrado para refrescar la tabla. */
  onSuccess: (patches: Map<string, Partial<ViajeBasico>>) => void;
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function CobrarBloqueDialog({ viajes, open, onOpenChange, onSuccess }: Props) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [medio, setMedio] = useState<Medio>("transferencia");
  const [montos, setMontos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      viajes.map((v) => [v.id, v.monto_flete != null && v.monto_flete > 0 ? String(v.monto_flete) : ""]),
    ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMonto = (id: string, value: string) =>
    setMontos((prev) => ({ ...prev, [id]: value }));

  const sinMonto = viajes.filter((v) => {
    const m = parseNum(montos[v.id] ?? "");
    return m == null || m <= 0;
  });
  const puedeCobrar = sinMonto.length === 0 && viajes.length > 0 && !!fecha;

  const total = useMemo(
    () => viajes.reduce((acc, v) => acc + (parseNum(montos[v.id] ?? "") ?? 0), 0),
    [viajes, montos],
  );

  const handleSubmit = async () => {
    if (!puedeCobrar) return;
    setLoading(true);
    setError(null);

    const items: CobrarBloqueItem[] = viajes.map((v) => ({
      id: v.id,
      monto: parseNum(montos[v.id] ?? ""),
    }));

    const res = await cobrarViajesEnBloqueAction(items, { fecha_cobro: fecha, medio });
    setLoading(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo registrar el cobro.");
      return;
    }

    const patches = new Map<string, Partial<ViajeBasico>>();
    for (const v of viajes) {
      patches.set(v.id, { cobrado: true, fecha_cobro: fecha });
    }
    onSuccess(patches);
    // Refrescar la caja si está montada (mismo evento que usan los diálogos de caja).
    window.dispatchEvent(new CustomEvent("caja:refresh"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#10B981]/10 text-[#10B981] shrink-0">
              <Coins size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Cobrar {viajes.length} viaje{viajes.length !== 1 ? "s" : ""}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Genera un ingreso en la Caja por cada flete y marca el viaje como cobrado.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="pt-4 space-y-3">
          {error && (
            <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cobro-fecha" className="text-sm font-medium text-foreground">
                Fecha del cobro
              </Label>
              <Input
                id="cobro-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cobro-medio" className="text-sm font-medium text-foreground">
                Medio de cobro
              </Label>
              <Select value={medio} onValueChange={(v) => setMedio(v as Medio)}>
                <SelectTrigger id="cobro-medio" className="w-full">
                  <SelectValue placeholder="Medio">
                    {(value: unknown) => MEDIO_LABEL[value as Medio] ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Viaje</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-36">Monto a cobrar $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {viajes.map((v) => {
                  const montoFalta = (parseNum(montos[v.id] ?? "") ?? 0) <= 0;
                  return (
                    <tr key={v.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium text-foreground leading-tight">
                          {v.codigo} · {v.cliente ?? "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(v.fecha_viaje).toLocaleDateString("es-AR")} · {v.chofer ?? "sin chofer"}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={montos[v.id] ?? ""}
                          onChange={(e) => setMonto(v.id, e.target.value)}
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

          <div className="flex items-center justify-between text-xs">
            {sinMonto.length > 0 ? (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-md px-3 py-2">
                <AlertTriangle size={14} className="shrink-0" />
                {sinMonto.length} viaje{sinMonto.length !== 1 ? "s" : ""} sin monto.
              </div>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Total a cobrar:{" "}
              <span className="font-mono font-semibold text-[#10B981]">
                $ {total.toLocaleString("es-AR")}
              </span>
            </span>
          </div>
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
            disabled={loading || !puedeCobrar}
            className="h-10 px-6 bg-[#10B981] hover:bg-[#059669] text-white font-bold flex items-center gap-1.5"
          >
            {loading ? "Cobrando..." : (<><Check size={15} /> Cobrar {viajes.length}</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
