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
import { editarAusenciaAction, getViajesChoferEnRangoAction } from "../[slug]/actions";
import type { ViajeEnRango } from "../[slug]/types";
import { formatFecha } from "@/lib/utils";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import type { VacacionesPeriodo } from "./lib";

interface Props {
  periodo: VacacionesPeriodo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function EditarPeriodoDialog({ periodo, open, onOpenChange, onSuccess }: Props) {
  const [inicio, setInicio] = useState(periodo?.fecha_inicio ?? "");
  const [fin, setFin] = useState(periodo?.fecha_fin ?? "");
  const [observaciones, setObservaciones] = useState(periodo?.observaciones ?? "");
  // De qué año descuenta. "hist" = histórico (no descuenta del saldo).
  const [anioCargo, setAnioCargo] = useState<string>(
    periodo?.anio_cargo != null ? String(periodo.anio_cargo) : "hist",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viajesRango, setViajesRango] = useState<ViajeEnRango[]>([]);
  const [loadingViajes, setLoadingViajes] = useState(false);

  // Años ofrecibles: el del período por fecha, el anterior, y el que ya tiene.
  // Se incluye SIEMPRE el año seleccionado: al mover el período a otro año la
  // lista se recalcula, y si el elegido se caía de la lista el select quedaba en
  // blanco y guardaba un año que el usuario no veía.
  const anioFecha = Number((inicio || periodo?.fecha_inicio || "").slice(0, 4)) || new Date().getFullYear();
  const anioSel = anioCargo === "hist" ? null : Number(anioCargo);
  const aniosOpciones = [
    ...new Set(
      [anioFecha, anioFecha - 1, periodo?.anio_cargo, anioSel].filter(
        (a): a is number => typeof a === "number" && Number.isFinite(a),
      ),
    ),
  ].sort((a, b) => b - a);

  // Viajes en el rango (mismo patrón aceptado que el diálogo de carga).
  useEffect(() => {
    if (!open || !periodo || !inicio || !fin || fin < inicio) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mismo patrón aceptado que CargarAusenciaDialog del legajo (fetch de viajes en rango)
      setViajesRango([]);
      return;
    }
    let cancelado = false;
    setLoadingViajes(true);
    getViajesChoferEnRangoAction(periodo.chofer_id, inicio, fin).then((vs) => {
      if (!cancelado) {
        setViajesRango(vs);
        setLoadingViajes(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, periodo, inicio, fin]);

  if (!periodo) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fin < inicio) return setError("La fecha de fin no puede ser anterior al inicio.");
    setLoading(true);
    setError(null);
    const res = await editarAusenciaAction(periodo.id, periodo.chofer_id, {
      tipo: "Vacaciones",
      fecha_inicio: inicio,
      fecha_fin: fin,
      observaciones: observaciones.trim() || null,
      es_vacaciones: true,
      anio_cargo: anioCargo === "hist" ? null : Number(anioCargo),
    });
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Editar período</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {periodo.apellido}, {periodo.nombre}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
            <Label className="text-sm font-medium text-foreground">Descuenta del saldo</Label>
            <select
              value={anioCargo}
              onChange={(e) => setAnioCargo(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              {aniosOpciones.map((y) => (
                <option key={y} value={y}>
                  Año {y}
                </option>
              ))}
              <option value="hist">Histórico — no descuenta del saldo</option>
            </select>
            <p className="text-xs text-muted-foreground">
              De qué año salen estos días. Si quedó imputado al año equivocado, se corrige acá y los
              saldos se recalculan solos.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones (opcional)</Label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: movido a julio por pedido del chofer"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
            />
          </div>

          {loadingViajes ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Buscando viajes en estas fechas…
            </div>
          ) : viajesRango.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800">
                <AlertTriangle size={14} />
                Tiene {viajesRango.length} viaje{viajesRango.length !== 1 ? "s" : ""} en estas fechas
              </div>
              <ul className="space-y-1">
                {viajesRango.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-xs text-amber-900/90 flex-wrap">
                    <span className="font-medium">{formatFecha(v.fecha_viaje)}</span>
                    <MapPin size={11} className="text-amber-700 shrink-0" />
                    <span>
                      {v.origen ? `${v.origen} → ` : ""}
                      {v.destino ?? "—"}
                    </span>
                    {v.cliente && <span className="text-amber-700/70">· {v.cliente}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
              {loading ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
