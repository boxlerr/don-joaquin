"use client";

// Edición de la ficha del préstamo. Existe sobre todo para completar los que
// entraron desde la planilla con datos a medias: al cargarles lo que faltaba, el
// aviso de "falta completar" se apaga solo.

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
import { AlertTriangle } from "lucide-react";
import { updatePrestamoAction, type PrestamoRow } from "./actions";

export default function EditPrestamoDialog({
  prestamo,
  open,
  onOpenChange,
}: {
  prestamo: PrestamoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [banco, setBanco] = useState(prestamo?.banco ?? "");
  const [detalle, setDetalle] = useState(prestamo?.detalle ?? "");
  const [tasa, setTasa] = useState(prestamo?.tasa != null ? String(prestamo.tasa) : "");
  const [importe, setImporte] = useState(
    prestamo && prestamo.importe_cuota > 0 ? String(prestamo.importe_cuota) : "",
  );
  const [moneda, setMoneda] = useState<"ARS" | "USD">(prestamo?.moneda === "USD" ? "USD" : "ARS");
  const [falta, setFalta] = useState(prestamo?.datos_faltantes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!prestamo) return null;

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await updatePrestamoAction(prestamo.id, {
      banco,
      detalle: detalle.trim() || null,
      tasa: tasa.trim() === "" ? null : Number(tasa),
      importe_cuota: importe.trim() === "" ? 0 : Number(importe),
      moneda,
      datos_faltantes: falta.trim() || null,
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">
            {prestamo.banco}
            {prestamo.detalle ? ` · ${prestamo.detalle}` : ""}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cuota {prestamo.pagadas + 1} de {prestamo.cuotas_total}. Cambiar el importe lo aplica a
            las cuotas que faltan pagar; las ya pagadas quedan como están.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          {prestamo.datos_faltantes && (
            <p className="flex items-start gap-1.5 rounded-[6px] border border-[#B45309]/40 px-3 py-2 text-[12px] leading-snug text-[#B45309]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Falta cargar: {prestamo.datos_faltantes}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Monto del préstamo
              </Label>
              <Input
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Ej: $50.000.000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Importe de la cuota
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="Ej: 4500000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Tasa % <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                placeholder="Ej: 45"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Moneda</Label>
            <div className="inline-flex overflow-hidden rounded-[6px] border border-border">
              {(["ARS", "USD"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  aria-pressed={moneda === m}
                  className={`h-8 px-3 text-xs font-medium transition-colors ${
                    moneda === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "ARS" ? "Pesos" : "Dólares"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Qué falta cargar{" "}
              <span className="font-normal text-muted-foreground/70">
                (vaciá el campo cuando esté completo)
              </span>
            </Label>
            <Input
              value={falta}
              onChange={(e) => setFalta(e.target.value)}
              placeholder="Ej: el importe de la cuota"
            />
          </div>
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
