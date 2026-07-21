"use client";

// Carga de un aumento de tarifa desde /tarifas. Escribe en la misma tabla que
// la sección de aumentos de /metricas (clientes_aumentos), así el dashboard se
// actualiza solo. Combobox estilado (nada de <select> nativo).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { ArrowUpRight, Loader2 } from "lucide-react";
import type { ClienteOption } from "./actions";
import { crearAumentoClienteTarifasAction } from "./actions-aumentos";

const OTRO = "__otro";

export default function CargarAumentoDialog({
  open,
  onClose,
  onSaved,
  clientes,
  defaultClienteId,
  defaultClienteNombre,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clientes: ClienteOption[];
  /** Preselección al abrir desde el detalle de un cliente. */
  defaultClienteId?: string;
  defaultClienteNombre?: string;
}) {
  const [clienteId, setClienteId] = useState(() =>
    defaultClienteId && clientes.some((c) => c.id === defaultClienteId)
      ? defaultClienteId
      : defaultClienteNombre
        ? OTRO
        : "",
  );
  const [clienteLibre, setClienteLibre] = useState(defaultClienteNombre ?? "");
  // Los aumentos rigen por mes → arranca en el día 1 del mes actual (editable).
  const [fecha, setFecha] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`);
  const [porcentaje, setPorcentaje] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = [
    { id: OTRO, label: "Otro (escribir el nombre)" },
    ...clientes.map((c) => ({ id: c.id, label: c.nombre })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const esLibre = !clienteId || clienteId === OTRO;
    const nombre = esLibre
      ? clienteLibre.trim()
      : clientes.find((c) => c.id === clienteId)?.nombre ?? "";
    const p = Number(porcentaje.replace(",", "."));
    if (!nombre) {
      setError("Falta el cliente.");
      return;
    }
    if (!Number.isFinite(p)) {
      setError("El porcentaje no es válido.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await crearAumentoClienteTarifasAction({
      clienteId: esLibre ? null : clienteId,
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
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight size={16} className="text-amber-500" /> Cargar aumento de tarifa
          </DialogTitle>
          <DialogDescription>
            El % que informa el cliente. Suma al historial de acá y a la comparación
            contra sueldos de Métricas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cliente</label>
            <div className="mt-1">
              <Combobox
                options={opciones}
                value={clienteId}
                onValueChange={setClienteId}
                placeholder="Seleccioná el cliente…"
                aria-label="Cliente"
              />
            </div>
            {(!clienteId || clienteId === OTRO) && (
              <input
                value={clienteLibre}
                onChange={(e) => setClienteLibre(e.target.value)}
                placeholder="Nombre del cliente"
                required
                className="mt-2 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vigente desde</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Aumento %</label>
              <input
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="Ej: 3 o 2,16"
                required
                inputMode="decimal"
                className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observaciones (opcional)</label>
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ej: aumento mensual de tarifa"
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-muted-foreground/80">
              Si es un % interanual (un solo número por el año, como YPF), empezá la
              observación con «Interanual» y no se mezcla con el detalle mes a mes.
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 size={14} className="mr-1.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
