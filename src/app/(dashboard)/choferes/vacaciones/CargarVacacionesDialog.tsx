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
import { crearAusenciaAction, getViajesChoferEnRangoAction } from "../[slug]/actions";
import type { ViajeEnRango } from "../[slug]/types";
import { formatFecha } from "@/lib/utils";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";

export type ChoferOpcion = { chofer_id: string; nombre: string; apellido: string };
export type SugerenciaSemana = { inicio: string; fin: string; ocupados: number; umbral?: number };

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
  /** Semanas con menos gente ocupada, para sugerir (solo si no hay preset). */
  sugerencias?: SugerenciaSemana[];
}

function fmtRango(inicio: string, fin: string): string {
  return `${formatFecha(inicio)} → ${formatFecha(fin)}`;
}

export default function CargarVacacionesDialog({
  open,
  onOpenChange,
  onSuccess,
  choferes,
  choferFijo,
  inicioPreset,
  finPreset,
  sugerencias,
}: Props) {
  const hoy = () => new Date().toISOString().split("T")[0]!;
  const [choferId, setChoferId] = useState(choferFijo?.chofer_id ?? "");
  const [inicio, setInicio] = useState(inicioPreset ?? hoy());
  const [fin, setFin] = useState(finPreset ?? inicioPreset ?? hoy());
  const [detalle, setDetalle] = useState("Vacaciones");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Viajes que el chofer ya tiene en el rango (aviso de conflicto). Mismo patrón
  // que CargarAusenciaDialog del legajo (único uso aceptado de setState-en-effect).
  const [viajesRango, setViajesRango] = useState<ViajeEnRango[]>([]);
  const [loadingViajes, setLoadingViajes] = useState(false);
  // Se ocultan las sugerencias una vez que el usuario tocó manualmente las fechas.
  const [tocoFechas, setTocoFechas] = useState(!!inicioPreset);

  useEffect(() => {
    if (!open || !choferId || !inicio || !fin || fin < inicio) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mismo patrón aceptado que CargarAusenciaDialog del legajo (fetch de viajes en rango)
      setViajesRango([]);
      return;
    }
    let cancelado = false;
    setLoadingViajes(true);
    getViajesChoferEnRangoAction(choferId, inicio, fin).then((vs) => {
      if (!cancelado) {
        setViajesRango(vs);
        setLoadingViajes(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, choferId, inicio, fin]);

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
      observaciones: observaciones.trim() || null,
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
  const diasElegidos =
    inicio && fin && fin >= inicio
      ? Math.round(
          (new Date(fin + "T00:00:00").getTime() - new Date(inicio + "T00:00:00").getTime()) / 86_400_000,
        ) + 1
      : 0;
  const mostrarSugerencias = !tocoFechas && (sugerencias?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">
            {choferFijo ? `${choferFijo.apellido}, ${choferFijo.nombre}` : "Cargar vacaciones"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {choferFijo
              ? "Elegí el rango de días. Se descuenta del año más viejo con saldo."
              : "Elegí el empleado y el rango de días."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-[6px] border-l-2 border-[#B91C1C] bg-transparent py-1.5 pl-3 text-sm text-[#B91C1C]">{error}</div>
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
                  setTocoFechas(true);
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
              <Input
                type="date"
                value={fin}
                min={inicio}
                onChange={(e) => {
                  setTocoFechas(true);
                  setFin(e.target.value);
                }}
                required
              />
            </div>
          </div>

          {/* Cuántos días salen del rango elegido: antes había que contarlos. */}
          {diasElegidos > 0 && (
            <p className="rounded-[6px] border border-border bg-muted/30 px-3 py-2 text-[13px] text-foreground">
              <span className="font-semibold">{diasElegidos}</span> día{diasElegidos !== 1 ? "s" : ""} de
              vacaciones, del {formatFecha(inicio)} al {formatFecha(fin)}.
            </p>
          )}

          {/* Sugerencias de semanas con menos gente */}
          {mostrarSugerencias && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Semanas con menos gente</Label>
              <div className="flex flex-wrap gap-1.5">
                {sugerencias!.map((s) => (
                  <button
                    key={s.inicio}
                    type="button"
                    onClick={() => {
                      setInicio(s.inicio);
                      setFin(s.fin);
                      setTocoFechas(true);
                    }}
                    className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {fmtRango(s.inicio, s.fin)} · {s.ocupados} ausente{s.ocupados !== 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Detalle</Label>
            <Input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Vacaciones" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones (opcional)</Label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: autorizado por administración"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
            />
          </div>

          {/* Aviso de viajes en el rango */}
          {loadingViajes ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Buscando viajes en estas fechas…
            </div>
          ) : viajesRango.length > 0 ? (
            <div className="space-y-2 rounded-[6px] border border-[#B45309]/40 p-3">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#B45309]">
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
                    <span className="text-[10px] uppercase tracking-wide text-amber-700/70">
                      ({v.estado.replace(/_/g, " ")})
                    </span>
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
              {loading ? "Guardando…" : "Cargar vacaciones"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
