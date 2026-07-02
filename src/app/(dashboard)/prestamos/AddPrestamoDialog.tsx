"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPrestamoAction } from "./actions";

/**
 * Alta de un préstamo con los mismos campos de la planilla de la mamá:
 * banco, importe de cuota, tasa, cantidad de cuotas y por cuál va. El
 * cronograma completo se genera solo (una cuota por mes, mismo día).
 */
export default function AddPrestamoDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [banco, setBanco] = useState("");
  const [detalle, setDetalle] = useState("");
  const [tasa, setTasa] = useState("");
  const [importeCuota, setImporteCuota] = useState("");
  const [cuotasTotal, setCuotasTotal] = useState("");
  const [proximaNro, setProximaNro] = useState("1");
  const [proximaFecha, setProximaFecha] = useState("");

  const reset = () => {
    setBanco("");
    setDetalle("");
    setTasa("");
    setImporteCuota("");
    setCuotasTotal("");
    setProximaNro("1");
    setProximaFecha("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await addPrestamoAction({
        banco,
        detalle: detalle.trim() || null,
        tasa: tasa.trim() === "" ? null : Number(tasa) || 0,
        importe_cuota: Number(importeCuota) || 0,
        cuotas_total: parseInt(cuotasTotal) || 0,
        proxima_cuota_nro: parseInt(proximaNro) || 1,
        proxima_fecha: proximaFecha,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); if (!v) reset(); }}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus size={14} /> Cargar préstamo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Cargar préstamo</DialogTitle>
          <DialogDescription>
            Los mismos datos de la planilla. El cronograma de cuotas (una por mes) se genera solo
            y después se puede corregir cuota por cuota.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pr-banco" className="text-xs font-semibold text-muted-foreground">
                Banco
              </Label>
              <Input
                id="pr-banco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ej: Galicia"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-detalle" className="text-xs font-semibold text-muted-foreground">
                Detalle <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                id="pr-detalle"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Ej: préstamo camión 2025"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pr-cuota" className="text-xs font-semibold text-muted-foreground">
                Importe de la cuota $
              </Label>
              <Input
                id="pr-cuota"
                type="number"
                min="1"
                step="0.01"
                value={importeCuota}
                onChange={(e) => setImporteCuota(e.target.value)}
                placeholder="Ej: 4500000"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-tasa" className="text-xs font-semibold text-muted-foreground">
                Tasa % <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                id="pr-tasa"
                type="number"
                min="0"
                step="0.01"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                placeholder="Ej: 45"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pr-total" className="text-xs font-semibold text-muted-foreground">
                Cuotas totales
              </Label>
              <Input
                id="pr-total"
                type="number"
                min="1"
                value={cuotasTotal}
                onChange={(e) => setCuotasTotal(e.target.value)}
                placeholder="Ej: 48"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-prox" className="text-xs font-semibold text-muted-foreground">
                Próxima cuota Nº
              </Label>
              <Input
                id="pr-prox"
                type="number"
                min="1"
                value={proximaNro}
                onChange={(e) => setProximaNro(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-fecha" className="text-xs font-semibold text-muted-foreground">
                Vence el
              </Label>
              <Input
                id="pr-fecha"
                type="date"
                value={proximaFecha}
                onChange={(e) => setProximaFecha(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Para un préstamo ya en curso (ej: va por la cuota 44 de 48) poné la próxima cuota y su
            fecha: las anteriores quedan marcadas como pagadas.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Cargar préstamo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
