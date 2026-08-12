"use client";

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import AdjuntosDocumentos, { useAdjuntos } from "@/components/ui/AdjuntosDocumentos";
import {
  crearApercibimientoAction,
  crearUrlSubidaApercibimientoAction,
  getApercibimientoArchivosAction,
  deleteApercibimientoArchivoAction,
} from "./actions";
import type { ApercibimientoTipo, CategoriaApercibimiento } from "./types";
import { AlertCircle } from "lucide-react";
import { useBorrador } from "@/hooks/useBorrador";
import { objetoCon } from "@/lib/borrador-local";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";

/** El apercibimiento en blanco, para completar contra él un borrador viejo. */
const APERCIBIMIENTO_VACIO = {
  fecha: "",
  tipo: "apercibimiento" as ApercibimientoTipo,
  categoriaId: "",
  motivo: "",
  observaciones: "",
};

// El tipo define a qué concepto del score suma el evento (planilla de Bárbara).
const TIPO_OPCIONES: { value: ApercibimientoTipo; label: string; concepto: string }[] = [
  { value: "apercibimiento", label: "Apercibimiento / Acta", concepto: "Seguridad" },
  { value: "multa", label: "Multa de tránsito", concepto: "Seguridad" },
  { value: "llamado_atencion", label: "Llamado de atención", concepto: "Conducta laboral" },
  { value: "adelanto", label: "Adelanto de sueldo", concepto: "Conducta laboral" },
];

interface Props {
  chofer_id: string;
  categorias: CategoriaApercibimiento[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CargarApercibimientoDialog({
  chofer_id,
  categorias,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedWarning, setSavedWarning] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [tipo, setTipo] = useState<ApercibimientoTipo>("apercibimiento");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // ── Borrador. Los adjuntos NO entran: son archivos y no caben en el
  // navegador. Si se recupera, hay que volver a elegirlos —y el aviso está,
  // así que se nota.
  //
  // La clave lleva el chofer: un motivo escrito para uno no puede aparecerle
  // en la ficha de otro.
  const valorBorrador = useMemo(
    () => ({ fecha, tipo, categoriaId, motivo, observaciones }),
    [fecha, tipo, categoriaId, motivo, observaciones],
  );

  const borrador = useBorrador({
    pantalla: `choferes-apercibimiento:${chofer_id}`,
    valor: valorBorrador,
    normalizar: objetoCon(APERCIBIMIENTO_VACIO),
    hayDatos: (v) => v.motivo.trim() !== "" || v.observaciones.trim() !== "",
    activo: open,
  });

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    if (b.fecha) setFecha(b.fecha);
    setTipo(b.tipo);
    setCategoriaId(b.categoriaId);
    setMotivo(b.motivo);
    setObservaciones(b.observaciones);
  };

  // Adjuntos (acta, video, foto, etc.) — pueden ser VARIOS. entidadId=null: el
  // apercibimiento todavía no existe, se vinculan al crearlo.
  const adj = useAdjuntos({
    open,
    entidadId: null,
    crearUrlSubida: crearUrlSubidaApercibimientoAction,
    getArchivos: getApercibimientoArchivosAction,
    deleteArchivo: deleteApercibimientoArchivoAction,
    onError: setError,
  });

  const reset = () => {
    setFecha(new Date().toISOString().split("T")[0]);
    setTipo("apercibimiento");
    setCategoriaId("");
    setMotivo("");
    setObservaciones("");
    setError(null);
    setSavedWarning(null);
  };

  const cerrarConExito = () => {
    reset();
    // El apercibimiento ya entró: recién ahora el borrador sobra.
    borrador.limpiar();
    onSuccess();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return setError("El motivo es obligatorio");

    setLoading(true);
    setError(null);
    try {
      // Subimos primero todos los archivos pendientes al Storage.
      const adjuntos = await adj.subirPendientes();

      const res = await crearApercibimientoAction(chofer_id, {
        fecha,
        tipo,
        categoria_id: categoriaId || null,
        motivo,
        observaciones: observaciones || null,
        adjuntos,
      });

      if ("error" in res && res.error) {
        setError(res.error);
      } else if ("adjuntosFallidos" in res && res.adjuntosFallidos) {
        // El apercibimiento se guardó, pero algún archivo no se pudo adjuntar.
        setSavedWarning(
          `El apercibimiento se guardó, pero ${res.adjuntosFallidos} archivo(s) no se pudieron adjuntar. Cerrá y volvé a cargarlos si hace falta.`,
        );
      } else {
        cerrarConExito();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el apercibimiento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (loading) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg sm:text-xl">Nuevo apercibimiento o sanción</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Apercibimiento/acta, multa, llamado de atención o adelanto. Suma al score y queda en el
            historial del chofer. Podés adjuntar varios archivos (ej: el acta y un video).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {borrador.pendiente && (
            <AvisoBorrador
              ts={borrador.pendiente.ts}
              onRecuperar={recuperarBorrador}
              onDescartar={borrador.descartar}
            />
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <span>{savedWarning}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Tipo</Label>
            <Select value={tipo} disabled={loading} onValueChange={(v) => v && setTipo(v as ApercibimientoTipo)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: unknown) => TIPO_OPCIONES.find((o) => o.value === value)?.label ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPCIONES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Suma al concepto{" "}
              <strong>{TIPO_OPCIONES.find((o) => o.value === tipo)?.concepto}</strong> del score.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Fecha <span className="text-red-400">*</span>
            </Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={loading} required />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Categoría</Label>
            <Select
              value={categoriaId || "__none__"}
              disabled={loading}
              onValueChange={(v) => setCategoriaId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Motivo <span className="text-red-400">*</span>
            </Label>
            <textarea
              className="flex w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describí brevemente el motivo del apercibimiento"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones</Label>
            <textarea
              className="flex w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              disabled={loading}
            />
          </div>

          {/* Adjuntos (varios): acta firmada, video, foto, etc. */}
          <AdjuntosDocumentos
            ctrl={adj}
            disabled={loading}
            label="Adjuntos"
            hint="acta firmada, video, foto… — opcional, podés subir varios"
          />

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            {savedWarning ? (
              <Button type="button" variant="brand" onClick={cerrarConExito}>
                Cerrar
              </Button>
            ) : (
              <>
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
                  {loading ? (adj.subiendo ? `Subiendo ${adj.subiendo.idx}/${adj.subiendo.total}…` : "Guardando…") : "Registrar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
