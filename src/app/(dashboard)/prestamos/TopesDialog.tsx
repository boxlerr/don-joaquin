"use client";

// Dónde poner la raya. Un solo número, el del mes: es la unidad en que se toma
// la decisión de plata. Es lo que pidió el padre de Bárbara — "que superado ese
// número me aparezca advertencia, ojo que noviembre lo tenés complicadísimo".

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarTopesAction } from "./actions";
import { PERIODOS, PERIODO_LABEL, type TopesConfig } from "./topes";

const AYUDA: Record<string, string> = {
  mes: "Lo que hay que pagar en el mes completo. Ej: 300.000.000.",
};

function ars(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function TopesDialog({
  topes,
  open,
  onOpenChange,
}: {
  topes: TopesConfig;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>({
    mes: topes.mes != null ? String(topes.mes) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await guardarTopesAction({
      // Se conservan los valores viejos de día y semana por si alguna vez se
      // vuelven a usar; hoy la pantalla sólo edita el mensual.
      dia: topes.dia,
      semana: topes.semana,
      mes: valores.mes!.trim() === "" ? null : Number(valores.mes),
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
          <DialogTitle className="text-lg text-foreground">Tope mensual</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cuando lo que hay que pagar en un mes supere este número, el mes se marca en rojo en
            el gráfico y llega una notificación. Dejalo vacío para no controlar nada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          {PERIODOS.map((p) => {
            const n = valores[p]!.trim() === "" ? null : Number(valores[p]);
            return (
              <div key={p} className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Tope {PERIODO_LABEL[p]}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1000000"
                  value={valores[p]}
                  onChange={(e) => setValores((v) => ({ ...v, [p]: e.target.value }))}
                  placeholder="Sin tope"
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {n != null && Number.isFinite(n) && n > 0 ? (
                    <span className="text-foreground">{ars(n)}</span>
                  ) : (
                    AYUDA[p]
                  )}
                </p>
              </div>
            );
          })}
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
