"use client";

// Dónde poner la raya de cada caja. Un número por caja y nada más: la chica y
// la general se gastan distinto, así que un tope único no le serviría a
// ninguna de las dos.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Label } from "@/components/ui/label";
import { CAJA_LABEL } from "@/lib/caja-tipos";
import { guardarTopesCajaAction } from "../actions";
import { CAJAS_CON_TOPE, type CajaTopeId, type TopesCaja } from "../topes";

const AYUDA: Record<CajaTopeId, string> = {
  diaria: "Lo que puede salir de la caja chica en un mes: viáticos, gomerías, gastos de ruta.",
  grande: "Lo que puede salir de la caja general en un mes.",
};

const ars = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export default function TopeCajaDialog({
  topes,
  open,
  onOpenChange,
  puedeEditarGeneral,
}: {
  topes: TopesCaja;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puedeEditarGeneral: boolean;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<TopesCaja>({ ...topes });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin permiso sobre la caja general, ese tope ni se muestra ni se manda: se
  // reenvía el valor guardado tal cual, así abrir el diálogo no lo puede pisar.
  const editables = CAJAS_CON_TOPE.filter((c) => c !== "grande" || puedeEditarGeneral);

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await guardarTopesCajaAction({
      diaria: valores.diaria ?? null,
      grande: puedeEditarGeneral ? valores.grande ?? null : topes.grande,
    });
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Tope de gastos por mes</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cuando lo que sale de una caja en el mes supere este número, la barra se pone en rojo
            y llega un aviso. Dejalo vacío para no controlar esa caja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          {editables.map((c) => {
            const n = valores[c] ?? null;
            return (
              <div key={c} className="space-y-1">
                <Label htmlFor={`tope-caja-${c}`} className="text-xs font-semibold text-muted-foreground">
                  {CAJA_LABEL[c]}
                </Label>
                <MoneyInput
                  id={`tope-caja-${c}`}
                  value={n}
                  onValueChange={(v) => setValores((prev) => ({ ...prev, [c]: v }))}
                  placeholder="Sin tope"
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {n != null && Number.isFinite(n) && n > 0 ? (
                    <span className="text-foreground">{ars(n)}</span>
                  ) : (
                    AYUDA[c]
                  )}
                </p>
              </div>
            );
          })}

          <p className="text-[11px] leading-snug text-muted-foreground">
            Las transferencias entre cajas no cuentan: mover plata de una a otra no es un gasto.
          </p>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-muted-foreground"
          >
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={guardar} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
