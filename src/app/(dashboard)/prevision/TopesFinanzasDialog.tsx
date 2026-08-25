"use client";

// Dónde poner la raya. El número lo ponen ellos: nosotros no definimos qué es
// un mes complicado (decisión de Julián, 14/08). Dejarlo vacío = sin aviso.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { guardarTopesFinanzasAction } from "./actions";
import type { TopesFinanzas } from "@/domain/finanzas/proyeccion";

export default function TopesFinanzasDialog({
  open, onOpenChange, topes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topes: TopesFinanzas;
}) {
  const router = useRouter();
  const [egresosMes, setEgresosMes] = useState<number | null>(topes.egresosMes);
  const [pct, setPct] = useState<string>(topes.pctFacturacion != null ? String(topes.pctFacturacion) : "");
  const [meses, setMeses] = useState<string>(String(topes.mesesPromedio));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await guardarTopesFinanzasAction({
      egresosMes: egresosMes ?? null,
      pctFacturacion: pct.trim() === "" ? null : Number(pct),
      mesesPromedio: Number(meses) || 3,
    });
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Cuándo avisar</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Un mes se marca en rojo cuando pasa cualquiera de los dos límites. Dejá vacío el que no
            quieras usar; si están los dos vacíos, no se avisa nada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {error && <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="tope-egresos" className="text-xs font-semibold text-muted-foreground">
              Si en el mes hay que pagar más de
            </Label>
            <MoneyInput id="tope-egresos" value={egresosMes} onValueChange={setEgresosMes} placeholder="Sin límite" />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Suma cuotas de préstamos, cheques nuestros y sueldos.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tope-pct" className="text-xs font-semibold text-muted-foreground">
              O si se come más de este % de lo que se factura
            </Label>
            <Input
              id="tope-pct" type="number" min="1" max="100" inputMode="numeric"
              value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Sin límite"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Es el que atrapa los meses flojos: mismos pagos de siempre, pero se facturó poco.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tope-meses" className="text-xs font-semibold text-muted-foreground">
              La facturación se estima promediando los últimos
            </Label>
            <Input
              id="tope-meses" type="number" min="1" max="12" inputMode="numeric"
              value={meses} onChange={(e) => setMeses(e.target.value)}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Meses ya cerrados. Más meses = más estable; menos = sigue más de cerca la temporada.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
            className="border-border text-muted-foreground">
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
