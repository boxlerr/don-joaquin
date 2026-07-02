"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { addCostoRepRepAction } from "./actions";

const ars = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

export default function AddCostoDialog({
  children,
  mesInicial,
  onSaved,
}: {
  children: React.ReactNode;
  mesInicial?: string; // YYYY-MM
  /** Avisa el mes (YYYY-MM) recién guardado, para que la vista salte a ese mes. */
  onSaved?: (mes: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoyMes = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(mesInicial ?? hoyMes);
  const [proveedor, setProveedor] = useState("");
  const [netoGrav, setNetoGrav] = useState("");
  const [factGrav, setFactGrav] = useState("");
  const [netoNg, setNetoNg] = useState("");
  const [factNg, setFactNg] = useState("");
  const [obs, setObs] = useState("");

  const num = (s: string) => Math.max(0, Number(s) || 0);
  const netoTotal = num(netoGrav) + num(netoNg);
  const facturadoTotal = num(factGrav) + num(factNg);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await addCostoRepRepAction({
        mes,
        proveedor,
        neto_gravado: num(netoGrav),
        facturado_gravado: num(factGrav),
        neto_ng: num(netoNg),
        facturado_ng: num(factNg),
        observaciones: obs.trim() || null,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar el costo.");
        return;
      }
      setOpen(false);
      setProveedor("");
      setNetoGrav("");
      setFactGrav("");
      setNetoNg("");
      setFactNg("");
      setObs("");
      router.refresh();
      onSaved?.(mes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Cargar costo de repuestos / reparaciones</DialogTitle>
          <DialogDescription>
            Resumen mensual por proveedor. Si ya existe ese proveedor en el mes, se actualiza.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-md px-2.5 py-1.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mes" className="text-xs font-semibold text-muted-foreground">Mes</Label>
              <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prov" className="text-xs font-semibold text-muted-foreground">Proveedor</Label>
              <Input id="prov" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej: SCANIA ARGENTINA S.A." required />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Gravado (21%)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ng" className="text-xs text-muted-foreground">Importe neto</Label>
                <Input id="ng" type="number" min="0" step="0.01" value={netoGrav} onChange={(e) => setNetoGrav(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fg" className="text-xs text-muted-foreground">Importe facturado</Label>
                <Input id="fg" type="number" min="0" step="0.01" value={factGrav} onChange={(e) => setFactGrav(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">No gravado (NG)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nng" className="text-xs text-muted-foreground">Importe neto</Label>
                <Input id="nng" type="number" min="0" step="0.01" value={netoNg} onChange={(e) => setNetoNg(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fng" className="text-xs text-muted-foreground">Importe facturado</Label>
                <Input id="fng" type="number" min="0" step="0.01" value={factNg} onChange={(e) => setFactNg(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs bg-muted/40 rounded-md px-3 py-2">
            <span className="text-muted-foreground">Totales</span>
            <span className="font-semibold text-foreground">
              Neto {ars(netoTotal)} · Facturado {ars(facturadoTotal)}
            </span>
          </div>

          <div className="space-y-1">
            <Label htmlFor="obs" className="text-xs font-semibold text-muted-foreground">
              Observaciones <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </Label>
            <Input id="obs" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Guardar costo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
