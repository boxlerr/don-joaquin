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
import { Send, Truck, User } from "lucide-react";
import {
  uploadComplianceDocAction,
  crearUrlSubidaComplianceDocAction,
  setComplianceVencimientoAction,
  setComplianceEnviarAAction,
} from "../actions";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import ArchivosCargar, { type ArchivoElegido } from "./ArchivosCargar";
import type { ArchivoMeta } from "@/lib/adjuntos-server";
import type { ComplianceRequisito } from "../types";

/**
 * Cargar (o renovar) un documento del checklist.
 *
 * El formulario va en dos columnas y no en una sola tira: a la izquierda las
 * fechas —que es lo único obligatorio— y a la derecha el papel, con su vista
 * previa. Apilado, el diálogo medía dos pantallas de alto y el botón "Cargar"
 * quedaba abajo de todo, así que había que scrollear dentro del modal para algo
 * que en el 90% de los casos es "poné la fecha y subí el PDF".
 */

// Cuando se pasa `edit`, el diálogo edita el vencimiento/observaciones de un
// documento YA cargado (sin re-subir el archivo). Si no, carga uno nuevo (con el
// archivo opcional: se puede registrar solo el vencimiento).
export type EditVencimiento = {
  documento_id: string;
  fuente: "compliance_documentos" | "chofer_documentos" | "camion_documentos";
  fecha_vencimiento: string | null;
  observaciones: string | null;
};

interface Props {
  requisito: ComplianceRequisito;
  chofer_id?: string;
  camion_id?: string;
  /**
   * De quién es el documento (nombre del chofer o patente). El diálogo se abre
   * desde listas de 78 nombres: sin esto no hay forma de confirmar que se está
   * cargando en el legajo correcto.
   */
  entidadLabel?: string | null;
  edit?: EditVencimiento;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

/** Rótulo de una mitad del formulario. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

export default function CargarComplianceDocDialog({
  requisito,
  chofer_id,
  camion_id,
  entidadLabel,
  edit,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const esEdicion = !!edit;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(edit?.fecha_vencimiento ?? "");
  const [observaciones, setObservaciones] = useState(edit?.observaciones ?? "");
  const [numero, setNumero] = useState("");
  // A dónde se manda el doc (portal/mail). Vive en el REQUISITO, no en el
  // documento: se edita acá por comodidad y aplica a todas las presentaciones.
  const [enviarA, setEnviarA] = useState(requisito.enviar_a ?? "");
  const [aseguradora, setAseguradora] = useState("");
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);

  const reset = () => {
    setPeriodo("");
    setFechaEmision("");
    setFechaVencimiento(edit?.fecha_vencimiento ?? "");
    setObservaciones(edit?.observaciones ?? "");
    setNumero("");
    setEnviarA(requisito.enviar_a ?? "");
    setAseguradora("");
    setArchivos([]);
    setSubiendo(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaVencimiento) return setError("Falta la fecha de vencimiento.");

    setLoading(true);
    setError(null);

    try {
      // Subir cada archivo directo al Storage (URL firmada) y juntar sus metadatos.
      // Se hace en los DOS modos: renovar un vencimiento también deja archivar el
      // papel nuevo, que antes era el único camino sin adjuntos.
      const subirSeleccionados = async (): Promise<ArchivoMeta[]> => {
        const metas: ArchivoMeta[] = [];
        for (let i = 0; i < archivos.length; i++) {
          const f = archivos[i]!.file;
          setSubiendo({ idx: i + 1, total: archivos.length, pct: 0 });
          const url = await crearUrlSubidaComplianceDocAction({ filename: f.name });
          if ("error" in url) throw new Error(url.error);
          await subirArchivoConUrlFirmada({
            signedUrl: url.signedUrl,
            file: f,
            onProgress: (pct) => setSubiendo({ idx: i + 1, total: archivos.length, pct }),
          });
          metas.push({
            bucket: url.bucket,
            path: url.path,
            nombre_original: f.name,
            mime_type: f.type || "application/octet-stream",
            tamano_bytes: f.size,
          });
        }
        setSubiendo(null);
        return metas;
      };

      const res = esEdicion
        ? await (async () => {
            const subidos = await subirSeleccionados();
            return setComplianceVencimientoAction({
              documento_id: edit!.documento_id,
              fuente: edit!.fuente,
              fecha_vencimiento: fechaVencimiento,
              observaciones: observaciones || null,
              archivos: subidos,
            });
          })()
        : await (async () => {
            const subidos = await subirSeleccionados();
            return uploadComplianceDocAction({
              requisito_id: requisito.id,
              chofer_id: chofer_id ?? null,
              camion_id: camion_id ?? null,
              periodo: periodo || null,
              fecha_emision: fechaEmision || null,
              fecha_vencimiento: fechaVencimiento,
              observaciones: observaciones || null,
              numero: numero || null,
              aseguradora: aseguradora || null,
              archivos: subidos,
            });
          })();

      // El destino de envío es del requisito: se guarda aparte, solo si cambió.
      if (!("error" in res && res.error) && (enviarA.trim() || null) !== (requisito.enviar_a ?? null)) {
        await setComplianceEnviarAAction({ requisito_id: requisito.id, enviar_a: enviarA });
      }

      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        reset();
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendo(null);
      setLoading(false);
    }
  };

  const esMensual = requisito.periodicidad === "mensual";
  const vaAlLegajo = !!requisito.tipo_documento_id;
  const dondeQueda = vaAlLegajo
    ? chofer_id
      ? "Queda guardado en el legajo del chofer y aparece también acá."
      : "Queda guardado en la ficha del camión y aparece también acá."
    : "Queda guardado en Compliance.";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[46rem]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground sm:text-xl">
            {esEdicion ? "Renovar" : "Cargar"} — {requisito.nombre}
          </DialogTitle>
          {entidadLabel && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {chofer_id ? (
                <User size={14} className="shrink-0 text-muted-foreground" />
              ) : (
                <Truck size={14} className="shrink-0 text-muted-foreground" />
              )}
              {entidadLabel}
            </p>
          )}
          <DialogDescription className="text-muted-foreground">
            {esEdicion
              ? `Poné el vencimiento nuevo y, si lo tenés, adjuntá el papel renovado — se suma a los anteriores sin borrarlos. ${dondeQueda}`
              : `Lo único obligatorio es el vencimiento: con esa fecha el sistema avisa antes de que se venza. ${dondeQueda}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {/* Izquierda: los datos. */}
            <div className="space-y-3">
              <Rotulo>Fechas</Rotulo>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    Vence el <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    required
                  />
                </div>
                {!esEdicion && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground">Se emitió el</Label>
                    <Input
                      type="date"
                      value={fechaEmision}
                      onChange={(e) => setFechaEmision(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {!esEdicion && esMensual && !vaAlLegajo && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">Período (mes)</Label>
                  <Input
                    type="month"
                    value={periodo ? periodo.slice(0, 7) : ""}
                    onChange={(e) => setPeriodo(e.target.value ? `${e.target.value}-01` : "")}
                  />
                  <p className="text-[11px] text-muted-foreground">A qué mes corresponde.</p>
                </div>
              )}

              {!esEdicion && vaAlLegajo && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">Número</Label>
                  <Input
                    placeholder="Opcional"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
              )}

              {!esEdicion && requisito.codigo === "SEGURO_UNIDAD" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">Aseguradora</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Nación / Segurcoop"
                      value={aseguradora}
                      onChange={(e) => setAseguradora(e.target.value)}
                      className="w-full sm:w-auto sm:flex-1"
                    />
                    {["Nación", "Segurcoop"].map((a) => (
                      <button
                        type="button"
                        key={a}
                        onClick={() => setAseguradora(a)}
                        className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors max-md:h-9 max-md:px-3 ${
                          aseguradora === a
                            ? "border-[#0088D1]/40 bg-[#0088D1]/10 font-semibold text-[#0088D1]"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    La mayoría de la flota es Nación; solo algunas unidades van con Segurcoop.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Observaciones</Label>
                <Input
                  placeholder='Opcional (ej. "solo Loma Negra")'
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Send size={12} className="text-muted-foreground" />A dónde se manda
                </Label>
                <Input
                  placeholder='Portales / mails (ej. "SICOP, Secondi y portal de YPF")'
                  value={enviarA}
                  onChange={(e) => setEnviarA(e.target.value)}
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Vale para «{requisito.nombre}» en todas sus presentaciones, y se muestra en el
                  checklist y en el aviso de vencimiento.
                </p>
              </div>
            </div>

            {/* Derecha: el papel. */}
            <ArchivosCargar
              archivos={archivos}
              onChange={setArchivos}
              onError={setError}
              subiendo={subiendo}
              titulo={esEdicion ? "El papel renovado" : "El papel"}
              ayuda={
                esEdicion
                  ? "Se agrega a los que ya estaban; no reemplaza nada."
                  : "Es opcional: podés registrar solo el vencimiento y subir el papel después."
              }
            />
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={loading}
              className="border-border text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {subiendo
                ? "Subiendo…"
                : loading
                  ? "Guardando…"
                  : esEdicion
                    ? "Guardar vencimiento"
                    : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
