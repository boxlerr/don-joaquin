"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DollarSign, Check, Receipt, Scale, Upload, X, FileText, ImageIcon } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { cerrarViajeAction } from "../actions";
import { computeCierre } from "../flujo-logic";
import type { ViajeBasico } from "../types";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import { crearUrlSubidaViajeAction, vincularArchivosViajeAction } from "../archivos-actions";
import { ADJUNTOS_REFRESH_EVENT } from "./ViajeAdjuntosStrip";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

interface Props {
  viaje: ViajeBasico;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (patch: Partial<ViajeBasico>) => void;
}

const inputWrap =
  "relative flex items-center h-9 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all";
const iconBox =
  "flex items-center justify-center w-9 h-full border-r border-border bg-muted/50 text-primary shrink-0";
const inputBase =
  "flex-1 h-full px-2.5 text-sm bg-transparent border-0 outline-none focus:ring-0 text-foreground";

export default function CerrarViajeDialog({ viaje, open, onOpenChange, onSuccess }: Props) {
  const remitoInicial =
    viaje.nro_remito && viaje.nro_remito.toUpperCase() !== "VACIO" ? viaje.nro_remito : "";

  const [nroRemito, setNroRemito] = useState(remitoInicial);
  const [montoFlete, setMontoFlete] = useState(viaje.monto_flete != null ? String(viaje.monto_flete) : "");
  const [tonelaje, setTonelaje] = useState(viaje.toneladas ? String(viaje.toneladas) : "");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Comprobantes (PDF / foto del remito) que se suben junto con el cierre.
  const [files, setFiles] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function agregarFiles(list: FileList | File[] | null) {
    if (!list) return;
    const nuevos = Array.from(list).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    );
    const grande = nuevos.find((f) => f.size > MAX_BYTES);
    if (grande) {
      setError(`"${grande.name}" pesa ${fmtSize(grande.size)}. El máximo es ${MAX_MB} MB por archivo.`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...nuevos]);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Misma regla de cierre/facturación que el server (flujo-logic.computeCierre):
  // entra el remito con su valor → el viaje queda facturado de una.
  const montoIngresado = montoFlete.trim() === "" ? null : Number(montoFlete) || 0;
  const { montoFinal: montoNum, facturado: facturable, cobrado: cobradoFinal } = computeCierre({
    montoActual: viaje.monto_flete,
    montoIngresado,
    esVacio: viaje.es_vacio,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1) Subir los comprobantes (si hay). Van antes del cierre: si la subida
    //    falla no se guarda nada y se puede reintentar; si el cierre fallara
    //    después, los archivos ya quedan adjuntos al viaje (no molestan).
    if (files.length > 0) {
      try {
        const metas = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setSubiendo({ idx: i + 1, total: files.length, pct: 0 });
          const url = await crearUrlSubidaViajeAction({ filename: f.name });
          if ("error" in url) throw new Error(url.error);
          await subirArchivoConUrlFirmada({
            signedUrl: url.signedUrl,
            file: f,
            onProgress: (pct) => setSubiendo({ idx: i + 1, total: files.length, pct }),
          });
          metas.push({
            bucket: url.bucket,
            path: url.path,
            nombre_original: f.name,
            mime_type: f.type || "application/octet-stream",
            tamano_bytes: f.size,
          });
        }
        const vin = await vincularArchivosViajeAction(viaje.id, "remito", metas);
        if (!vin.ok) throw new Error(vin.error ?? "No se pudo guardar el comprobante");
        setFiles([]);
        window.dispatchEvent(new CustomEvent(ADJUNTOS_REFRESH_EVENT, { detail: viaje.id }));
      } catch (err) {
        setSubiendo(null);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Error al subir el comprobante");
        return;
      }
      setSubiendo(null);
    }

    // 2) Cerrar el viaje (remito + importe + toneladas).
    const result = await cerrarViajeAction(viaje.id, {
      observaciones: observaciones.trim() || null,
      nro_remito: nroRemito.trim() || null,
      monto_flete: montoFlete.trim() === "" ? null : Number(montoFlete) || 0,
      tonelaje_real: tonelaje.trim() === "" ? null : Number(tonelaje) || 0,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Error al cerrar el viaje");
      return;
    }
    onSuccess({
      estado: "cerrado",
      facturado: facturable,
      cobrado: cobradoFinal,
      nro_remito: nroRemito.trim() || viaje.nro_remito,
      monto_flete: montoNum,
      toneladas: tonelaje.trim() === "" ? viaje.toneladas : Number(tonelaje) || 0,
      // Las observaciones ahora se guardan en el viaje: se reflejan al toque.
      ...(result.observaciones !== undefined && { observaciones: result.observaciones }),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-4 sm:p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#10B981]/10 text-[#10B981] shrink-0">
              <Receipt size={22} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-base sm:text-lg font-bold">
                Agregar remito · {viaje.codigo}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                {viaje.cliente} · Cargá el remito y el importe del viaje
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}

          {/* Datos de facturación: remito + monto + toneladas */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground">Datos de facturación</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Nº de remito</Label>
                <div className={inputWrap}>
                  <div className={iconBox}><Receipt size={13} /></div>
                  <input
                    type="text"
                    value={nroRemito}
                    onChange={(e) => setNroRemito(e.target.value)}
                    maxLength={60}
                    placeholder="Ej: 0813R00281660"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Monto de flete / factura ($)</Label>
                <div className={inputWrap}>
                  <div className={iconBox}><DollarSign size={13} /></div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoFlete}
                    onChange={(e) => setMontoFlete(e.target.value)}
                    placeholder="0"
                    className={inputBase}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Toneladas <span className="text-muted-foreground/70 font-normal">(opcional)</span>
              </Label>
              <div className={inputWrap}>
                <div className={iconBox}><Scale size={13} /></div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tonelaje}
                  onChange={(e) => setTonelaje(e.target.value)}
                  placeholder="0"
                  className={inputBase}
                />
              </div>
            </div>

            {!viaje.es_vacio && (
              <p className="text-[11px] text-muted-foreground">
                {facturable
                  ? "Con el importe cargado, el viaje queda facturado y listo."
                  : "Sin importe se guarda el remito, pero el viaje queda sin facturar."}
              </p>
            )}
          </div>

          {/* Comprobante: el PDF o la foto del remito, en el mismo paso */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Comprobante <span className="text-muted-foreground/70 font-normal">(PDF o foto · opcional)</span>
            </Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); agregarFiles(e.dataTransfer.files); }}
              className={`w-full rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors ${
                dragOver
                  ? "border-[#0088D1] bg-[#0088D1]/5"
                  : "border-border hover:border-[#0088D1]/50 hover:bg-muted/30"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Upload size={13} className="text-[#0088D1]" />
                Arrastrá el remito acá o hacé clic para elegirlo
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => agregarFiles(e.target.files)}
            />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-800/50 dark:bg-sky-950/40 pl-2 pr-1 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-300"
                  >
                    {f.type.startsWith("image/") ? <ImageIcon size={11} /> : <FileText size={11} />}
                    <span className="max-w-[130px] sm:max-w-[170px] truncate" title={f.name}>{f.name}</span>
                    <span className="text-sky-600/70 dark:text-sky-400/70">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded p-0.5 opacity-50 hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50"
                      aria-label={`Quitar ${f.name}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Observaciones <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </Label>
            <textarea
              placeholder="Ej: Remito entregado en planta, factura A-0001..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full min-h-[72px] px-3 py-2 text-sm rounded-lg border border-border bg-card outline-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all resize-none text-foreground"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border -mx-4 px-4 sm:-mx-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 w-full sm:w-auto px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0F172A] hover:bg-[#1E293B] text-white flex items-center justify-center gap-1.5 h-10 w-full sm:w-auto px-6 rounded-lg font-bold shadow-sm"
            >
              {subiendo
                ? `Subiendo ${subiendo.idx}/${subiendo.total} (${subiendo.pct}%)`
                : loading
                  ? "Guardando..."
                  : <><Check size={15} /> Guardar remito</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
