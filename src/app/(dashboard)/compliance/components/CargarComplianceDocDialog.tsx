"use client";

import { useRef, useState } from "react";
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
import { Upload, Send, Loader2, X, FileText, User, Truck } from "lucide-react";
import {
  uploadComplianceDocAction,
  crearUrlSubidaComplianceDocAction,
  setComplianceVencimientoAction,
  setComplianceEnviarAAction,
} from "../actions";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import type { ArchivoMeta } from "@/lib/adjuntos-server";
import type { ComplianceRequisito } from "../types";

const MAX_MB = 100;

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
  const [files, setFiles] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPeriodo("");
    setFechaEmision("");
    setFechaVencimiento(edit?.fecha_vencimiento ?? "");
    setObservaciones(edit?.observaciones ?? "");
    setNumero("");
    setEnviarA(requisito.enviar_a ?? "");
    setAseguradora("");
    setFiles([]);
    setSubiendo(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const agregarFiles = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const nuevos = Array.from(lista);
    const grande = nuevos.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (grande) return setError(`"${grande.name}" supera los ${MAX_MB} MB permitidos.`);
    setError(null);
    // Evita duplicados por nombre+tamaño; permite ir sumando en varias tandas.
    setFiles((prev) => {
      const clave = (f: File) => `${f.name}:${f.size}`;
      const yaHay = new Set(prev.map(clave));
      return [...prev, ...nuevos.filter((f) => !yaHay.has(clave(f)))];
    });
    if (fileRef.current) fileRef.current.value = "";
  };
  const quitarFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaVencimiento) return setError("Fecha de vencimiento requerida");

    setLoading(true);
    setError(null);

    try {
      // Subir cada archivo directo al Storage (URL firmada) y juntar sus metadatos.
      // Se hace en los DOS modos: renovar un vencimiento también deja archivar el
      // papel nuevo, que antes era el único camino sin adjuntos.
      const subirSeleccionados = async (): Promise<ArchivoMeta[]> => {
        const archivos: ArchivoMeta[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setSubiendo({ idx: i + 1, total: files.length, pct: 0 });
          const url = await crearUrlSubidaComplianceDocAction({ filename: f.name });
          if ("error" in url) throw new Error(url.error);
          await subirArchivoConUrlFirmada({
            signedUrl: url.signedUrl,
            file: f,
            onProgress: (pct) => setSubiendo({ idx: i + 1, total: files.length, pct }),
          });
          archivos.push({
            bucket: url.bucket,
            path: url.path,
            nombre_original: f.name,
            mime_type: f.type || "application/octet-stream",
            tamano_bytes: f.size,
          });
        }
        setSubiendo(null);
        return archivos;
      };

      const res = esEdicion
        ? await (async () => {
            const archivos = await subirSeleccionados();
            return setComplianceVencimientoAction({
              documento_id: edit!.documento_id,
              fuente: edit!.fuente,
              fecha_vencimiento: fechaVencimiento,
              observaciones: observaciones || null,
              archivos,
            });
          })()
        : await (async () => {
            const archivos = await subirSeleccionados();
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
              archivos,
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
          <DialogTitle className="text-foreground text-lg sm:text-xl">
            {esEdicion ? "Editar vencimiento" : "Cargar"} — {requisito.nombre}
          </DialogTitle>
          {entidadLabel && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {chofer_id ? <User size={14} className="shrink-0 text-muted-foreground" /> : <Truck size={14} className="shrink-0 text-muted-foreground" />}
              {entidadLabel}
            </p>
          )}
          <DialogDescription className="text-muted-foreground">
            {esEdicion
              ? "Actualizá la fecha de vencimiento y, si lo tenés, adjuntá el documento nuevo. Se suma a los anteriores."
              : vaAlLegajo
                ? `Se va a guardar en ${chofer_id ? "el legajo del chofer" : "la ficha del camión"} y aparecer también acá. Podés adjuntar varios archivos (opcional).`
                : "Los archivos son opcionales — podés registrar solo el vencimiento. Podés subir varios, hasta 100 MB c/u."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {!esEdicion && esMensual && !vaAlLegajo && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Período (mes)</Label>
              <Input
                type="month"
                value={periodo ? periodo.slice(0, 7) : ""}
                onChange={(e) => setPeriodo(e.target.value ? `${e.target.value}-01` : "")}
              />
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
                <Input placeholder="Nación / Segurcoop" value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} className="w-full sm:w-auto sm:flex-1" />
                {["Nación", "Segurcoop"].map((a) => (
                  <button type="button" key={a} onClick={() => setAseguradora(a)}
                    className={`text-xs px-2.5 py-1.5 max-md:h-9 max-md:px-3 rounded-md border transition-colors ${aseguradora === a ? "bg-[#0088D1]/10 border-[#0088D1]/40 text-[#0088D1] font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}>{a}</button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">La mayoría de la flota es Nación; solo algunas unidades van con Segurcoop.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!esEdicion && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
                <Input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Vencimiento <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones</Label>
            <Input
              placeholder='Opcional (ej. "solo Loma Negra")'
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
              <Send size={12} className="text-muted-foreground" />
              A dónde se manda
            </Label>
            <Input
              placeholder='Portales / mails (ej. "SICOP, Secondi y portal de YPF")'
              value={enviarA}
              onChange={(e) => setEnviarA(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Queda asociado al documento «{requisito.nombre}» (todas sus presentaciones) y
              se muestra en el checklist y en las alertas de vencimiento.
            </p>
          </div>

          {/* También al editar: renovar un vencimiento tiene que dejar archivar el papel
              nuevo. Era el único camino del sistema que no aceptaba adjuntos, y es por
              donde se cargaron las 45 renovaciones del 08/08 — todas sin documento. */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              {esEdicion ? "Adjuntar el documento renovado (opcional)" : "Archivos (opcional)"}
            </Label>
              <label className="flex items-center gap-3 px-4 py-3 min-h-11 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors">
                <Upload size={16} className="shrink-0 text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">
                  {files.length ? "Agregar más archivos…" : "Elegir archivos…"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => agregarFiles(e.target.files)}
                />
              </label>

              {files.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}:${f.size}:${i}`} className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2 py-1.5">
                      <FileText size={13} className="text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 text-foreground">{f.name}</span>
                      <span className="text-muted-foreground font-mono shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button type="button" onClick={() => quitarFile(i)} disabled={loading} className="shrink-0 inline-flex items-center justify-center size-5 max-md:size-9 rounded-md text-muted-foreground/60 hover:text-destructive" aria-label="Quitar archivo"><X size={13} /></button>
                    </li>
                  ))}
                </ul>
              )}

              {subiendo && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Subiendo {subiendo.idx} de {subiendo.total}…</span>
                    <span className="font-mono">{subiendo.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-[#0088D1] rounded-full transition-all duration-200" style={{ width: `${subiendo.pct}%` }} />
                  </div>
                </div>
              )}
          </div>

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
              {subiendo ? "Subiendo…" : loading ? "Guardando..." : esEdicion ? "Guardar vencimiento" : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
