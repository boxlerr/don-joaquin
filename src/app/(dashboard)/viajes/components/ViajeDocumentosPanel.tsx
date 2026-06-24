"use client";

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
import { Upload, Trash2, FileText, ImageIcon, Eye, Loader2, Receipt, FileCheck } from "lucide-react";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const TIPOS: { value: TipoArchivoViaje; label: string }[] = [
  { value: "remito", label: "Remito" },
  { value: "factura", label: "Factura" },
  { value: "otro", label: "Otro" },
];

const TIPO_LABEL: Record<TipoArchivoViaje, string> = { remito: "Remito", factura: "Factura", otro: "Otro" };

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function esImagen(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

export default function ViajeDocumentosPanel({
  viajeId,
  canWrite = true,
}: {
  viajeId: string;
  canWrite?: boolean;
}) {
  const [archivos, setArchivos] = useState<ArchivoViaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<TipoArchivoViaje>("remito");
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    getArchivosViajeAction(viajeId)
      .then((a) => { if (!cancelado) setArchivos(a); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [viajeId]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const arr = Array.from(files);
    const grande = arr.find((f) => f.size > MAX_BYTES);
    if (grande) {
      setError(`"${grande.name}" pesa ${fmtSize(grande.size)}. El máximo es ${MAX_MB} MB por archivo.`);
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
      const fresh = await getArchivosViajeAction(viajeId);
      setArchivos(fresh);
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
    <div className="space-y-3 bg-card p-4 rounded-lg border border-border/80 shadow-2xs">
      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 border-b border-border pb-2">
        <Receipt size={14} className="text-[#0088D1]" /> Documentos (remito / factura)
      </h4>

      {error && (
        <div className="text-[11px] text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-md px-2.5 py-1.5">
          {error}
        </div>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                disabled={!!subiendo}
                className={`text-[11px] px-2.5 py-1 rounded-md border font-semibold transition-all ${
                  tipo === t.value
                    ? "bg-[#0088D1] border-[#0088D1] text-white"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!subiendo}
            className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-card text-foreground hover:bg-muted/40 font-semibold flex items-center gap-1 disabled:opacity-60"
          >
            {subiendo ? (
              <><Loader2 size={12} className="animate-spin" /> Subiendo {subiendo.idx}/{subiendo.total} ({subiendo.pct}%)</>
            ) : (
              <><Upload size={12} /> Subir {TIPO_LABEL[tipo].toLowerCase()}</>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : archivos.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Sin documentos adjuntos.</p>
      ) : (
        <ul className="space-y-1.5">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-md px-2.5 py-1.5">
              <span className="shrink-0 text-muted-foreground">
                {esImagen(a.mime_type) ? <ImageIcon size={14} /> : a.tipo === "factura" ? <FileCheck size={14} /> : <FileText size={14} />}
              </span>
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                a.tipo === "remito" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                : a.tipo === "factura" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
              }`}>
                {TIPO_LABEL[a.tipo]}
              </span>
              <span className="flex-1 truncate text-foreground/90" title={a.nombre_original}>{a.nombre_original}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{fmtSize(a.tamano_bytes)}</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-primary hover:text-[#0277BD] p-1 rounded hover:bg-[#E1F5FE]"
                title="Ver / descargar"
              >
                <Eye size={13} />
              </a>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="shrink-0 text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  title="Eliminar"
                >
                  {deletingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
