"use client";

import { useState } from "react";
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
import { crearAusenciaAction } from "../[slug]/actions";

export type ChoferOpcion = { chofer_id: string; nombre: string; apellido: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  choferes: ChoferOpcion[];
  /** Si viene, el empleado queda fijo (no se puede elegir). */
  choferFijo?: ChoferOpcion | null;
  /** Fechas iniciales (ej. al clickear una semana del cronograma). */
  inicioPreset?: string;
  finPreset?: string;
}

export default function CargarVacacionesDialog({
  open,
  onOpenChange,
  onSuccess,
  choferes,
  choferFijo,
  inicioPreset,
  finPreset,
}: Props) {
  const hoy = () => new Date().toISOString().split("T")[0]!;
  const [choferId, setChoferId] = useState(choferFijo?.chofer_id ?? "");
  const [inicio, setInicio] = useState(inicioPreset ?? hoy());
  const [fin, setFin] = useState(finPreset ?? inicioPreset ?? hoy());
  const [detalle, setDetalle] = useState("Vacaciones");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choferId) return setError("Elegí un empleado.");
    if (fin < inicio) return setError("La fecha de fin no puede ser anterior al inicio.");
    setLoading(true);
    setError(null);
    const res = await crearAusenciaAction(choferId, {
      tipo: detalle.trim() || "Vacaciones",
      fecha_inicio: inicio,
      fecha_fin: fin,
      es_vacaciones: true,
    });
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      onSuccess();
      onOpenChange(false);
    }
  };

  const ordenados = [...choferes].sort((a, b) => a.apellido.localeCompare(b.apellido));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Cargar vacaciones</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {choferFijo
              ? `Para ${choferFijo.apellido}, ${choferFijo.nombre}.`
              : "Elegí el empleado y el rango de días."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          {!choferFijo && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Empleado <span className="text-red-400">*</span>
              </Label>
              <select
                value={choferId}
                onChange={(e) => setChoferId(e.target.value)}
                required
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">Seleccionar…</option>
                {ordenados.map((c) => (
                  <option key={c.chofer_id} value={c.chofer_id}>
                    {c.apellido}, {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Desde <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                  if (fin < e.target.value) setFin(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Hasta <span className="text-red-400">*</span>
              </Label>
              <Input type="date" value={fin} min={inicio} onChange={(e) => setFin(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Detalle</Label>
            <Input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Vacaciones" />
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-muted-foreground border-border"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Guardando…" : "Cargar vacaciones"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
