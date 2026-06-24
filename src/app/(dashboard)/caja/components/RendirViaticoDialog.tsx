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
import { rendirViaticoAction } from "../actions";
import { computeRendicion } from "../../viajes/flujo-logic";

export type ViaticoPendiente = {
  id: string;
  chofer: string;
  fecha_entrega: string;
  monto_entregado: number;
  observaciones: string | null;
};

const ars = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

export default function RendirViaticoDialog({
  viatico,
  children,
}: {
  viatico: ViaticoPendiente;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rendido, setRendido] = useState("");
  const [devuelto, setDevuelto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [observaciones, setObservaciones] = useState("");

  // Misma regla que el server (flujo-logic.computeRendicion).
  const { diferencia, rendido: rendidoNum, devuelto: devueltoNum } = computeRendicion(
    viatico.monto_entregado,
    Number(rendido),
    Number(devuelto),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await rendirViaticoAction({
        viatico_id: viatico.id,
        fecha_rendicion: fecha,
        monto_rendido: rendidoNum,
        monto_devuelto: devueltoNum,
        observaciones: observaciones.trim() || null,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo registrar la rendición.");
        return;
      }
      setOpen(false);
      setRendido("");
      setDevuelto("");
      setObservaciones("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Rendir viático</DialogTitle>
          <DialogDescription>
            {viatico.chofer} · Entregado {ars(viatico.monto_entregado)}
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
              <Label htmlFor="rendido" className="text-xs font-semibold text-muted-foreground">
                Gastado / justificado ($)
              </Label>
              <Input
                id="rendido"
                type="number"
                min="0"
                step="0.01"
                value={rendido}
                onChange={(e) => setRendido(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="devuelto" className="text-xs font-semibold text-muted-foreground">
                Devuelto en efectivo ($)
              </Label>
              <Input
                id="devuelto"
                type="number"
                min="0"
                step="0.01"
                value={devuelto}
                onChange={(e) => setDevuelto(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs bg-muted/40 rounded-md px-3 py-2">
            <span className="text-muted-foreground">Diferencia</span>
            <span className={`font-semibold ${diferencia === 0 ? "text-foreground" : diferencia > 0 ? "text-amber-600" : "text-red-600"}`}>
              {ars(diferencia)} {diferencia > 0 ? "(falta justificar)" : diferencia < 0 ? "(gastó de más)" : "(cuadra)"}
            </span>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fecha" className="text-xs font-semibold text-muted-foreground">Fecha de rendición</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="obs" className="text-xs font-semibold text-muted-foreground">
              Observaciones <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </Label>
            <Input id="obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: peaje + comida" />
          </div>

          {devueltoNum > 0 && (
            <p className="text-[11px] text-green-700 bg-green-50 dark:bg-green-950/20 rounded-md px-2.5 py-1.5">
              Se registrará un ingreso de {ars(devueltoNum)} en la caja (vuelto).
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Confirmar rendición"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
