"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import { Upload, Trash2, FileText, ImageIcon, Download, Eye, Loader2, Paperclip } from "lucide-react";

// Metadatos de un archivo ya subido al Storage, listos para vincular a la entidad.
export type AdjuntoMeta = {
  bucket: string;
  path: string;
  nombre_original: string;
  mime_type: string | null;
  tamano_bytes: number;
};

// Adjunto ya guardado (con URL pública para ver / descargar).
export type AdjuntoExistente = {
  id: string;
  nombre_original: string;
  url: string;
  tamano_bytes: number;
  mime_type: string | null;
  created_at: string;
};

type CrearUrlResult =
  | { signedUrl: string; token: string; path: string; bucket: string }
  | { error: string };

export const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function esImagen(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

export type AdjuntosController = {
  pendientes: File[];
  existentes: AdjuntoExistente[];
  loadingArchivos: boolean;
  deletingArchivoId: string | null;
  subiendo: { idx: number; total: number; pct: number } | null;
  agregarArchivos: (files: FileList | File[] | null) => void;
  quitarPendiente: (idx: number) => void;
  eliminarExistente: (id: string) => Promise<void>;
  /** Sube los archivos pendientes al Storage y devuelve sus metadatos. */
  subirPendientes: () => Promise<AdjuntoMeta[]>;
};

/**
 * Hook que maneja los adjuntos de una entidad (rotura, servicio, etc.) de forma
 * agnóstica: recibe las 3 server actions de la entidad y se encarga de la
 * carga/listado/borrado y de subir los pendientes al Storage. Usado junto al
 * componente `<AdjuntosDocumentos />` para no duplicar la UI ni la lógica.
 */
export function useAdjuntos(opts: {
  open: boolean;
  entidadId: string | null;
  crearUrlSubida: (input: { filename: string }) => Promise<CrearUrlResult>;
  getArchivos: (id: string) => Promise<AdjuntoExistente[]>;
  deleteArchivo: (id: string) => Promise<{ error?: string } | { success: true }>;
  onError?: (msg: string | null) => void;
}): AdjuntosController {
  const { open, entidadId, crearUrlSubida, getArchivos, deleteArchivo, onError } = opts;
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [existentes, setExistentes] = useState<AdjuntoExistente[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [deletingArchivoId, setDeletingArchivoId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);

  // Al abrir: limpiar pendientes y, si es edición, cargar los adjuntos guardados.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setPendientes([]);
    setSubiendo(null);
    setExistentes([]);
    if (entidadId) {
      setLoadingArchivos(true);
      getArchivos(entidadId)
        .then((a) => { if (!cancelado) setExistentes(a); })
        .finally(() => { if (!cancelado) setLoadingArchivos(false); });
    } else {
      setLoadingArchivos(false);
    }
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entidadId]);

  const agregarArchivos = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const grande = arr.find((f) => f.size > MAX_BYTES);
    if (grande) {
      onError?.(`"${grande.name}" pesa ${fmtSize(grande.size)}. El máximo permitido es ${MAX_MB} MB por archivo.`);
      return;
    }
    onError?.(null);
    setPendientes((prev) => [...prev, ...arr]);
  };

  const quitarPendiente = (idx: number) => {
    setPendientes((prev) => prev.filter((_, i) => i !== idx));
  };

  const eliminarExistente = async (id: string) => {
    setDeletingArchivoId(id);
    const res = await deleteArchivo(id);
    if (res && "error" in res && res.error) {
      onError?.(res.error);
    } else {
      setExistentes((prev) => prev.filter((a) => a.id !== id));
    }
    setDeletingArchivoId(null);
  };

  const subirPendientes = async (): Promise<AdjuntoMeta[]> => {
    const metas: AdjuntoMeta[] = [];
    for (let i = 0; i < pendientes.length; i++) {
      const f = pendientes[i];
      setSubiendo({ idx: i + 1, total: pendientes.length, pct: 0 });
      const urlRes = await crearUrlSubida({ filename: f.name });
      if ("error" in urlRes) throw new Error(urlRes.error);
      await subirArchivoConUrlFirmada({
        signedUrl: urlRes.signedUrl,
        file: f,
        onProgress: (pct) => setSubiendo({ idx: i + 1, total: pendientes.length, pct }),
      });
      metas.push({
        bucket: urlRes.bucket,
        path: urlRes.path,
        nombre_original: f.name,
        mime_type: f.type || "application/octet-stream",
        tamano_bytes: f.size,
      });
    }
    setSubiendo(null);
    return metas;
  };

  return {
    pendientes,
    existentes,
    loadingArchivos,
    deletingArchivoId,
    subiendo,
    agregarArchivos,
    quitarPendiente,
    eliminarExistente,
    subirPendientes,
  };
}

/**
 * UI de adjuntos: lista de archivos ya guardados (ver / descargar / eliminar),
 * lista de pendientes por subir, zona de drag&drop y barra de progreso.
 * Maneja el estado a través del controlador devuelto por `useAdjuntos`.
 */
export default function AdjuntosDocumentos({
  ctrl,
  disabled,
  label = "Documentos",
  hint = "factura, foto del daño, etc. — opcional",
}: {
  ctrl: AdjuntosController;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pendientes, existentes, loadingArchivos, deletingArchivoId, subiendo } = ctrl;
  const tieneAdjuntos = existentes.length > 0 || pendientes.length > 0;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Paperclip size={14} className="text-muted-foreground" />
        {label} <span className="text-muted-foreground font-normal">({hint})</span>
      </Label>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          ctrl.agregarArchivos(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Adjuntos ya guardados (solo en edición) */}
      {loadingArchivos ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 size={13} className="animate-spin" /> Cargando adjuntos…
        </div>
      ) : (
        existentes.length > 0 && (
          <ul className="space-y-1.5">
            {existentes.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2 border border-border rounded-[8px] bg-muted/30">
                {esImagen(a.mime_type) ? (
                  <ImageIcon size={15} className="text-[#0088D1] shrink-0" />
                ) : (
                  <FileText size={15} className="text-[#0088D1] shrink-0" />
                )}
                <span className="text-sm text-foreground truncate flex-1 min-w-0">{a.nombre_original}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{fmtSize(a.tamano_bytes)}</span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#0088D1]/10 transition-colors"
                  title="Ver"
                >
                  <Eye size={14} />
                </a>
                <a
                  href={a.url}
                  download={a.nombre_original}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#0088D1]/10 transition-colors"
                  title="Descargar"
                >
                  <Download size={14} />
                </a>
                {deletingArchivoId === a.id ? (
                  <Loader2 size={14} className="animate-spin text-red-400 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => ctrl.eliminarExistente(a.id)}
                    disabled={disabled}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {/* Archivos nuevos pendientes de subir */}
      {pendientes.length > 0 && (
        <ul className="space-y-1.5">
          {pendientes.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#0088D1]/40 rounded-[8px] bg-[#F0F9FF] dark:bg-[#0088D1]/10">
              {esImagen(f.type) ? (
                <ImageIcon size={15} className="text-[#0088D1] shrink-0" />
              ) : (
                <FileText size={15} className="text-[#0088D1] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-sm text-foreground truncate block">{f.name}</span>
                <span className="text-[11px] text-muted-foreground">{fmtSize(f.size)} · nuevo</span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => ctrl.quitarPendiente(i)}
                  className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  title="Quitar"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Zona para agregar archivos */}
      {!disabled && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            ctrl.agregarArchivos(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-4 border border-dashed rounded-[8px] cursor-pointer transition-colors ${
            dragOver
              ? "border-[#0088D1] bg-[#F0F9FF]"
              : "border-[#CBD5E1] hover:border-[#0088D1] hover:bg-[#F0F9FF] dark:hover:bg-[#0088D1]/5"
          }`}
        >
          <Upload size={17} className="text-muted-foreground/70" />
          <span className="text-sm text-muted-foreground">
            Arrastrá archivos o <span className="text-[#0088D1] font-medium">elegilos</span>
            {tieneAdjuntos ? " (podés sumar más)" : ""}
          </span>
          <span className="text-[11px] text-muted-foreground/60">Cualquier formato — hasta {MAX_MB} MB c/u</span>
        </div>
      )}

      {/* Progreso de subida */}
      {subiendo && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Subiendo {subiendo.idx} de {subiendo.total}…
            </span>
            <span className="font-mono">{subiendo.pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-[#0088D1] transition-all duration-200 rounded-full"
              style={{ width: `${subiendo.pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground/70">No cierres esta ventana hasta que termine.</p>
        </div>
      )}
    </div>
  );
}
