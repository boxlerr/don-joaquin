"use client";

// Adjuntos del viaje (remito / factura / otro) como chips compactos dentro del
// encabezado del panel expandido. Reemplaza a la vieja tarjeta "Documentos":
// la subida principal quedó integrada al diálogo "Agregar remito", y acá se
// ven, se suman más (factura u otros) y se borran.

import { useEffect, useRef, useState } from "react";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import {
  crearUrlSubidaViajeAction,
  vincularArchivosViajeAction,
  getArchivosViajeAction,
  deleteArchivoViajeAction,
  type ArchivoViaje,
  type TipoArchivoViaje,
} from "../archivos-actions";
import { Paperclip, Plus, X, Loader2, FileText, ImageIcon, FileCheck } from "lucide-react";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Evento global para refrescar los chips cuando otro componente sube archivos
 *  (p. ej. el diálogo "Agregar remito"). detail = viajeId. */
export const ADJUNTOS_REFRESH_EVENT = "viaje-archivos:refresh";

const TIPOS: { value: TipoArchivoViaje; label: string }[] = [
  { value: "remito", label: "Remito" },
  { value: "factura", label: "Factura" },
  { value: "otro", label: "Otro" },
];

const TIPO_CHIP: Record<TipoArchivoViaje, string> = {
  remito:
    "bg-sky-50 border-sky-200 text-sky-800 hover:border-sky-400 dark:bg-sky-950/40 dark:border-sky-800/50 dark:text-sky-300",
  factura:
    "bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300",
  otro:
    "bg-muted/60 border-border text-foreground/80 hover:border-foreground/30",
};

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function esImagen(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

export default function ViajeAdjuntosStrip({
  viajeId,
  canWrite = true,
}: {
  viajeId: string;
  canWrite?: boolean;
}) {
  const [archivos, setArchivos] = useState<ArchivoViaje[]>([]);
  const [loading, setLoading] = useState(true);
  // Menú inline de tipo ("¿qué estás adjuntando?") al tocar "+ Adjuntar".
  const [eligiendoTipo, setEligiendoTipo] = useState(false);
  const [tipo, setTipo] = useState<TipoArchivoViaje>("remito");
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marcar "cargando" al cambiar de viaje
    setLoading(true);
    getArchivosViajeAction(viajeId)
      .then((a) => { if (!cancelado) setArchivos(a); })
      .finally(() => { if (!cancelado) setLoading(false); });

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail !== viajeId) return;
      getArchivosViajeAction(viajeId).then((a) => { if (!cancelado) setArchivos(a); });
    };
    window.addEventListener(ADJUNTOS_REFRESH_EVENT, handler);
    return () => {
      cancelado = true;
      window.removeEventListener(ADJUNTOS_REFRESH_EVENT, handler);
    };
  }, [viajeId]);

  function pedirArchivo(t: TipoArchivoViaje) {
    setTipo(t);
    setEligiendoTipo(false);
    // El input es el mismo; el tipo elegido queda en el estado para vincular.
    fileRef.current?.click();
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const arr = Array.from(files);
    const grande = arr.find((f) => f.size > MAX_BYTES);
    if (grande) {
      setError(`"${grande.name}" pesa ${fmtSize(grande.size)}. El máximo es ${MAX_MB} MB.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    try {
      const metas = [];
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        setSubiendo({ idx: i + 1, total: arr.length, pct: 0 });
        const url = await crearUrlSubidaViajeAction({ filename: f.name });
        if ("error" in url) throw new Error(url.error);
        await subirArchivoConUrlFirmada({
          signedUrl: url.signedUrl,
          file: f,
          onProgress: (pct) => setSubiendo({ idx: i + 1, total: arr.length, pct }),
        });
        metas.push({
          bucket: url.bucket,
          path: url.path,
          nombre_original: f.name,
          mime_type: f.type || "application/octet-stream",
          tamano_bytes: f.size,
        });
      }
      const res = await vincularArchivosViajeAction(viajeId, tipo, metas);
      if (!res.ok) throw new Error(res.error ?? "No se pudo guardar el archivo");
      setArchivos(await getArchivosViajeAction(viajeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el archivo");
    } finally {
      setSubiendo(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    const res = await deleteArchivoViajeAction(id);
    if (res.ok) setArchivos((prev) => prev.filter((a) => a.id !== id));
    else setError(res.error ?? "No se pudo eliminar el archivo");
    setDeletingId(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground mr-0.5">
          <Paperclip size={11} /> Adjuntos
        </span>

        {loading ? (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Cargando…
          </span>
        ) : (
          <>
            {archivos.length === 0 && !subiendo && (
              <span className="text-[11px] italic text-muted-foreground/70">
                Sin comprobantes todavía
              </span>
            )}

            {archivos.map((a) => (
              <span
                key={a.id}
                className={`group/chip inline-flex items-center gap-1 rounded-md border pl-2 pr-1 py-0.5 text-[11px] font-medium transition-colors ${TIPO_CHIP[a.tipo]}`}
              >
                {esImagen(a.mime_type) ? (
                  <ImageIcon size={11} className="shrink-0 opacity-70" />
                ) : a.tipo === "factura" ? (
                  <FileCheck size={11} className="shrink-0 opacity-70" />
                ) : (
                  <FileText size={11} className="shrink-0 opacity-70" />
                )}
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-[120px] sm:max-w-[160px] truncate hover:underline underline-offset-2"
                  title={`${a.nombre_original} · ${fmtSize(a.tamano_bytes)} — ver / descargar`}
                >
                  {a.nombre_original}
                </a>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={deletingId === a.id}
                    className="shrink-0 rounded p-0.5 opacity-40 hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 transition-all disabled:opacity-60"
                    title="Eliminar adjunto"
                    aria-label={`Eliminar ${a.nombre_original}`}
                  >
                    {deletingId === a.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <X size={10} />
                    )}
                  </button>
                )}
              </span>
            ))}

            {subiendo && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Loader2 size={11} className="animate-spin" />
                Subiendo {subiendo.idx}/{subiendo.total} ({subiendo.pct}%)
              </span>
            )}

            {canWrite && !subiendo && (
              eligiendoTipo ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 pl-2 pr-1 py-0.5">
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => pedirArchivo(t.value)}
                      className="text-[10.5px] font-semibold text-primary hover:bg-primary/10 rounded px-1.5 py-px transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEligiendoTipo(false)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                    aria-label="Cancelar"
                  >
                    <X size={10} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEligiendoTipo(true)}
                  className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Plus size={11} /> Adjuntar
                </button>
              )
            )}
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="text-[11px] text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-md px-2.5 py-1.5 inline-flex items-center gap-2">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar" className="opacity-60 hover:opacity-100">
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
