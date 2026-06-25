"use client";

import { useRef, useState, useEffect } from "react";
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
import {
  crearUrlSubidaDocumentoAction,
  registrarDocumentoChoferAction,
  updateDocumentoChoferAction,
} from "./actions";
import type { TipoDocumento, DocumentoVigencia } from "./types";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import { Upload, Trash2, AlertCircle } from "lucide-react";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

interface Props {
  chofer_id: string;
  tipos: TipoDocumento[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  documento?: DocumentoVigencia | null;
}

export default function CargarDocumentoDialog({
  chofer_id,
  tipos,
  open,
  onOpenChange,
  onSuccess,
  documento,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [tipoNombreCustom, setTipoNombreCustom] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileNameExistente, setFileNameExistente] = useState<string | null>(null);
  const [eliminarArchivo, setEliminarArchivo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOtro = tipoId === "__otro__";

  const reset = () => {
    setTipoId("");
    setTipoNombreCustom("");
    setFechaVencimiento("");
    setFechaEmision("");
    setFile(null);
    setFileNameExistente(null);
    setEliminarArchivo(false);
    setError(null);
    setProgreso(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  useEffect(() => {
    if (open && documento) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setTipoId(documento.tipo_documento_id ?? "");
      setFechaEmision(documento.fecha_emision ?? "");
      setFechaVencimiento(documento.fecha_vencimiento ?? "");
      setFileNameExistente(documento.archivo_nombre ?? null);
      setFile(null);
      setEliminarArchivo(false);
      setError(null);
      setProgreso(null);
    } else if (open) {
      reset();
    }
  }, [open, documento]);

  const elegirArchivo = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`El archivo pesa ${fmtSize(f.size)}. El máximo permitido es ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
    setEliminarArchivo(false);
  };

  const quitarArchivo = () => {
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
    // En edición, si había un archivo previo, marcarlo para eliminar.
    if (documento && fileNameExistente) setEliminarArchivo(true);
    setFileNameExistente(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoId) return setError("Seleccioná un tipo de documento");
    if (isOtro && !tipoNombreCustom.trim())
      return setError("Escribí el nombre del tipo de documento");
    if (!documento && !file) return setError("Seleccioná un archivo");

    setLoading(true);
    setError(null);

    try {
      // 1) Si hay archivo nuevo, subirlo directo al Storage con URL firmada.
      let archivoMeta:
        | { bucket: string; path: string; nombre_original: string; mime_type: string; tamano_bytes: number }
        | null = null;

      if (file) {
        setProgreso(0);
        const urlRes = await crearUrlSubidaDocumentoAction({ chofer_id, filename: file.name });
        if ("error" in urlRes) throw new Error(urlRes.error);

        await subirArchivoConUrlFirmada({
          signedUrl: urlRes.signedUrl,
          file,
          onProgress: setProgreso,
        });

        archivoMeta = {
          bucket: urlRes.bucket,
          path: urlRes.path,
          nombre_original: file.name,
          mime_type: file.type || "application/octet-stream",
          tamano_bytes: file.size,
        };
      }

      // 2) Registrar / actualizar los metadatos (payload chico, sin el binario).
      const res = documento
        ? await updateDocumentoChoferAction({
            id: documento.id ?? "",
            chofer_id,
            tipo_documento_id: tipoId,
            fecha_emision: fechaEmision || null,
            fecha_vencimiento: fechaVencimiento || null,
            eliminar_archivo: eliminarArchivo,
            archivo: archivoMeta,
          })
        : await registrarDocumentoChoferAction({
            chofer_id,
            tipo_documento_id: isOtro ? null : tipoId,
            tipo_nombre_custom: isOtro ? tipoNombreCustom.trim() : null,
            fecha_emision: fechaEmision || null,
            fecha_vencimiento: fechaVencimiento || null,
            archivo: archivoMeta!,
          });

      if (res.error) {
        setError(res.error);
      } else {
        reset();
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo subir el documento. Probá de nuevo.";
      setError(msg);
    } finally {
      setLoading(false);
      setProgreso(null);
    }
  };

  const nombreMostrado = file?.name ?? fileNameExistente;
  const subiendo = loading && progreso !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (loading) return; // no cerrar mientras sube
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {documento ? "Editar documento" : "Cargar documento"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {documento
              ? "Modificá los datos del documento o cargá un nuevo archivo."
              : `Cualquier formato (PDF, foto, etc.) — hasta ${MAX_MB} MB.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Tipo de documento <span className="text-red-400">*</span>
            </Label>
            {tipos.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">No hay tipos de documento disponibles</p>
            ) : (
              <>
                <Select
                  value={tipoId}
                  disabled={!!documento || loading}
                  onValueChange={(v) => {
                    setTipoId(v ?? "");
                    if (v !== "__otro__") setTipoNombreCustom("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo...">
                      {tipoId
                        ? tipoId === "__otro__"
                          ? "Otro..."
                          : tipos.find((t) => t.id === tipoId)?.nombre
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                    <SelectItem value="__otro__">Otro...</SelectItem>
                  </SelectContent>
                </Select>

                {isOtro && (
                  <Input
                    className="mt-2"
                    placeholder="Nombre del documento (ej: Seguro de vida)"
                    value={tipoNombreCustom}
                    onChange={(e) => setTipoNombreCustom(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Fecha vencimiento</Label>
              <Input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Archivo {!documento && <span className="text-red-400">*</span>}
            </Label>
            <input
              ref={fileRef}
              type="file"
              id="doc-file-input"
              className="hidden"
              disabled={loading}
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
            {nombreMostrado ? (
              <div className="flex items-center justify-between px-4 py-3 border border-[#CBD5E1] rounded-[8px] bg-[#F8FAFC]">
                <div className="flex items-center gap-3 min-w-0">
                  <Upload size={16} className="text-muted-foreground/70 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm text-foreground truncate block">{nombreMostrado}</span>
                    {file && (
                      <span className="text-[11px] text-muted-foreground">{fmtSize(file.size)}</span>
                    )}
                  </div>
                </div>
                {!loading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={quitarArchivo}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            ) : (
              <label
                htmlFor="doc-file-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!loading) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!loading) elegirArchivo(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 px-4 py-6 border border-dashed rounded-[8px] cursor-pointer transition-colors ${
                  dragOver
                    ? "border-[#0088D1] bg-[#F0F9FF]"
                    : "border-[#CBD5E1] hover:border-[#0088D1] hover:bg-[#F0F9FF]"
                }`}
              >
                <Upload size={18} className="text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">
                  Arrastrá un archivo o <span className="text-[#0088D1] font-medium">elegilo</span>
                </span>
                <span className="text-[11px] text-muted-foreground/60">Hasta {MAX_MB} MB</span>
              </label>
            )}
          </div>

          {subiendo && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progreso! < 100 ? "Subiendo archivo…" : "Finalizando…"}</span>
                <span className="font-mono">{progreso}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[#0088D1] transition-all duration-200 rounded-full"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/70">No cierres esta ventana hasta que termine.</p>
            </div>
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
            <Button type="submit" variant="brand" disabled={loading || tipos.length === 0}>
              {loading
                ? subiendo
                  ? `Subiendo… ${progreso}%`
                  : "Guardando…"
                : documento
                ? "Guardar"
                : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
