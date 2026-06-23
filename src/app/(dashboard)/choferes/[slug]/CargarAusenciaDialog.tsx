"use client";

import { useState, useEffect } from "react";
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
import { crearAusenciaAction, editarAusenciaAction, getViajesChoferEnRangoAction } from "./actions";
import type { Ausencia, ViajeEnRango } from "./types";
import { formatFecha } from "@/lib/utils";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";

interface Props {
  chofer_id: string;
  ausencia?: Ausencia | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  // Cuando se abre desde el tab de Vacaciones, arranca con la marca activada.
  defaultVacaciones?: boolean;
}

export default function CargarAusenciaDialog({
  chofer_id,
  ausencia,
  open,
  onOpenChange,
  onSuccess,
  defaultVacaciones,
}: Props) {
  const esEdicion = !!ausencia;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Campo único de texto libre: unifica el "tipo" y las observaciones en un solo
  // detalle (sin lista de sugerencias). Se persiste en la columna `tipo`.
  const [detalle, setDetalle] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split("T")[0]);
  // Viajes que el chofer ya tiene en el rango elegido (aviso de conflicto).
  const [viajesRango, setViajesRango] = useState<ViajeEnRango[]>([]);
  const [loadingViajes, setLoadingViajes] = useState(false);
  const [esVacaciones, setEsVacaciones] = useState(defaultVacaciones ?? false);
  const [justificada, setJustificada] = useState(true);

  // Al abrir en modo edición, precargar los valores de la ausencia.
  useEffect(() => {
    if (!open) return;
    if (ausencia) {
      setDetalle(ausencia.tipo);
      setFechaInicio(ausencia.fecha_inicio);
      setFechaFin(ausencia.fecha_fin);
      setEsVacaciones(ausencia.es_vacaciones);
      setJustificada(ausencia.justificada);
      setError(null);
    } else {
      setEsVacaciones(defaultVacaciones ?? false);
      setJustificada(true);
    }
  }, [open, ausencia, defaultVacaciones]);

  // Al elegir chofer + rango, buscar los viajes que tiene en esas fechas para
  // mostrar el conflicto antes de confirmar la ausencia.
  useEffect(() => {
    if (!open || !chofer_id || !fechaInicio || !fechaFin || fechaFin < fechaInicio) {
      setViajesRango([]);
      return;
    }
    let cancelado = false;
    setLoadingViajes(true);
    getViajesChoferEnRangoAction(chofer_id, fechaInicio, fechaFin).then((vs) => {
      if (!cancelado) {
        setViajesRango(vs);
        setLoadingViajes(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, chofer_id, fechaInicio, fechaFin]);

  const reset = () => {
    const hoy = new Date().toISOString().split("T")[0];
    setDetalle("");
    setFechaInicio(hoy);
    setFechaFin(hoy);
    setViajesRango([]);
    setEsVacaciones(defaultVacaciones ?? false);
    setJustificada(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalle.trim()) return setError("El detalle de la ausencia es obligatorio");
    if (fechaFin < fechaInicio) return setError("La fecha de fin no puede ser anterior al inicio");

    setLoading(true);
    setError(null);

    const payload = {
      tipo: detalle.trim(),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      es_vacaciones: esVacaciones,
      // Solo aplica a ausencias que NO son vacaciones. Las vacaciones siempre
      // quedan como justificadas.
      justificada: esVacaciones ? true : justificada,
    };

    const res = esEdicion
      ? await editarAusenciaAction(ausencia!.id, chofer_id, payload)
      : await crearAusenciaAction(chofer_id, payload);

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      reset();
      onSuccess();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {esEdicion ? "Editar ausencia" : "Nueva ausencia / permiso"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Queda registrado quién la autoriza para que cualquiera que tome la logística lo vea.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Detalle <span className="text-red-400">*</span>
            </Label>
            <Input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Ej: Vacaciones, turno médico, trámite del DNI…"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Desde <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  if (fechaFin < e.target.value) setFechaFin(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Hasta <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={esVacaciones}
              onChange={(e) => setEsVacaciones(e.target.checked)}
              className="size-4 rounded border-border accent-[#0088D1]"
            />
            Es período de <span className="font-medium">vacaciones</span> (descuenta del saldo)
          </label>

          {/* Justificada: solo para ausencias que NO son vacaciones. */}
          {!esVacaciones && (
            <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!justificada}
                onChange={(e) => setJustificada(!e.target.checked)}
                className="size-4 mt-0.5 rounded border-border accent-[#EF4444]"
              />
              <span>
                Fue <span className="font-medium text-[#EF4444]">injustificada</span>
                <span className="block text-xs text-muted-foreground">
                  Marcalo solo si el chofer faltó sin aviso ni motivo válido. Resta puntos en el ranking.
                </span>
              </span>
            </label>
          )}

          {/* Aviso de viajes que el chofer ya tiene en estas fechas */}
          {loadingViajes ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Buscando viajes en estas fechas…
            </div>
          ) : viajesRango.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800">
                <AlertTriangle size={14} />
                Tiene {viajesRango.length} viaje{viajesRango.length !== 1 ? "s" : ""} en estas
                fechas
              </div>
              <ul className="space-y-1">
                {viajesRango.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-2 text-xs text-amber-900/90 flex-wrap"
                  >
                    <span className="font-medium">{formatFecha(v.fecha_viaje)}</span>
                    <MapPin size={11} className="text-amber-700 shrink-0" />
                    <span>
                      {v.origen ? `${v.origen} → ` : ""}
                      {v.destino ?? "—"}
                    </span>
                    {v.cliente && <span className="text-amber-700/70">· {v.cliente}</span>}
                    <span className="text-[10px] uppercase tracking-wide text-amber-700/70">
                      ({v.estado.replace(/_/g, " ")})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin viajes asignados en estas fechas.</p>
          )}

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={loading}
              className="text-muted-foreground border-border"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Guardando..." : esEdicion ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
