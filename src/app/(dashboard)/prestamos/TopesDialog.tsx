"use client";

// Dónde poner la raya. Los tres topes son opcionales y se editan cuando cambia
// el mes: es lo que pidió el padre de Bárbara — "que superado ese número me
// aparezca advertencia, ojo que noviembre lo tenés complicadísimo".

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
  dia: "Un solo día con demasiados vencimientos juntos.",
  semana: "La semana que se viene. Ej: 300.000.000.",
  mes: "El mes completo, para ver con tiempo los que vienen pesados.",
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
    dia: topes.dia != null ? String(topes.dia) : "",
    semana: topes.semana != null ? String(topes.semana) : "",
    mes: topes.mes != null ? String(topes.mes) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await guardarTopesAction({
      dia: valores.dia!.trim() === "" ? null : Number(valores.dia),
      semana: valores.semana!.trim() === "" ? null : Number(valores.semana),
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
          <DialogTitle className="text-lg text-foreground">Avisarme cuando se pase de</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cuando lo que hay que pagar en un período supere el número, la pantalla lo marca en
            rojo. Los tres son opcionales: dejá vacío el que no quieras controlar.
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
                  Total {PERIODO_LABEL[p]}
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
