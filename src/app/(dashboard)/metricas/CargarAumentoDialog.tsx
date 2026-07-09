"use client";

// Carga de un aumento de tarifa de cliente (audio Bárbara 08/07 15:01):
// "así como cargo un chofer, cargar un aumento del cliente".

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ArrowUpRight } from "lucide-react";
import {
  crearAumentoClienteAction,
  getClientesParaAumentoAction,
} from "./actions";

export default function CargarAumentoDialog({
  open, onOpenChange, onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [clienteLibre, setClienteLibre] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [porcentaje, setPorcentaje] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getClientesParaAumentoAction().then(setClientes).catch(() => setClientes([]));
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = clienteId ? (clientes.find((c) => c.id === clienteId)?.nombre ?? "") : clienteLibre;
    const p = Number(porcentaje.replace(",", "."));
    setLoading(true);
    setError(null);
    const res = await crearAumentoClienteAction({
      clienteId: clienteId || null,
      clienteNombre: nombre,
      vigenteDesde: fecha,
      porcentaje: p,
      observaciones: obs,
    });
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setClienteId(""); setClienteLibre(""); setPorcentaje(""); setObs("");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight size={16} className="text-amber-500" /> Cargar aumento de tarifa
          </DialogTitle>
          <DialogDescription>
            Queda como contexto en las comparaciones de facturación: si un mes facturó más,
            saber cuánto fue tarifa y cuánto producción.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none">
              <option value="">Otro (escribir abajo)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {!clienteId && (
              <input value={clienteLibre} onChange={(e) => setClienteLibre(e.target.value)}
                placeholder="Nombre del cliente" required
                className="mt-2 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vigente desde</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Aumento %</label>
              <input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="Ej: 8,5" required inputMode="decimal"
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observaciones (opcional)</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Ej: aumento por paritaria / combustible"
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 size={14} className="mr-1.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
