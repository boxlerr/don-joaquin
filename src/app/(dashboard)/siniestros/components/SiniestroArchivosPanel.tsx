"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Paperclip, Plus, Trash2, Download, FileText,
  Loader2, X, ChevronLeft, ChevronRight, ZoomIn,
} from "lucide-react";
import { getArchivosSiniestroAction, deleteArchivoSiniestroAction, type SiniestroArchivo } from "../actions";
import CargarArchivoSiniestroDialog from "./CargarArchivoSiniestroDialog";

interface Props {
  siniestro_id: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: SiniestroArchivo[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const current = images[idx];

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-3 sm:mx-4 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute -top-11 right-0 size-10 inline-flex items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Imagen */}
        <div className="relative w-full flex items-center justify-center">
          {images.length > 1 && (
            <button
              onClick={prev}
              aria-label="Anterior"
              className="absolute left-1 sm:left-2 z-10 size-10 inline-flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.descripcion || current.nombre_original}
            className="max-h-[65dvh] sm:max-h-[75vh] max-w-full rounded-xl shadow-2xl object-contain"
          />

          {images.length > 1 && (
            <button
              onClick={next}
              aria-label="Siguiente"
              className="absolute right-1 sm:right-2 z-10 size-10 inline-flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Info pie */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-center text-white/80 text-xs">
          <span className="font-semibold">{current.descripcion || current.nombre_original}</span>
          <span className="text-white/40">·</span>
          <span>{formatBytes(current.tamano_bytes)}</span>
          {images.length > 1 && (
            <>
              <span className="text-white/40">·</span>
              <span>{idx + 1} / {images.length}</span>
            </>
          )}
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white/60 hover:text-white transition-colors ml-1"
          >
            <Download size={13} /> Descargar
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────
export default function SiniestroArchivosPanel({ siniestro_id }: Props) {
  const [archivos, setArchivos] = useState<SiniestroArchivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getArchivosSiniestroAction(siniestro_id);
    setArchivos(data);
    setLoading(false);
  }, [siniestro_id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteArchivoSiniestroAction(id);
    setDeletingId(null);
    load();
  };

  const fotos = archivos.filter((a) => isImage(a.mime_type));
  const docs = archivos.filter((a) => !isImage(a.mime_type));

  return (
    <div className="bg-card p-3 sm:p-4 rounded-xl border border-border shadow-sm" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 mb-3">
        <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip size={13} className="text-primary" /> Archivos adjuntos
          {!loading && (
            <span className="ml-1 font-bold text-muted-foreground/70">({archivos.length})</span>
          )}
        </h4>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 px-2 text-[11px] text-primary hover:bg-blue-50 font-bold gap-1"
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={12} /> Adjuntar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 py-2">
          <Loader2 size={13} className="animate-spin" /> Cargando...
        </div>
      ) : archivos.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 font-medium py-1">Sin archivos adjuntos</p>
      ) : (
        <div className="space-y-4">
          {/* Grid de fotos */}
          {fotos.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">
                Fotos ({fotos.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {fotos.map((foto, i) => (
                  <div key={foto.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.url}
                      alt={foto.descripcion || foto.nombre_original}
                      className="w-full h-full object-cover transition-transform duration-200 md:group-hover:scale-105"
                    />

                    {/* Overlay con acciones. En celular no hay hover: las acciones
                        se ven siempre, si no la foto no se puede ni abrir. */}
                    <div className="absolute inset-0 bg-black/25 opacity-100 md:bg-black/0 md:opacity-0 md:group-hover:bg-black/40 md:group-hover:opacity-100 transition-colors flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setLightboxIdx(i)}
                        className="size-9 md:size-auto md:p-1.5 inline-flex items-center justify-center rounded-full bg-card/90 text-foreground/90 hover:bg-card transition-colors"
                        title="Ver"
                        aria-label="Ver"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <a
                        href={foto.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="size-9 md:size-auto md:p-1.5 inline-flex items-center justify-center rounded-full bg-card/90 text-foreground/90 hover:bg-card transition-colors"
                        title="Descargar"
                        aria-label="Descargar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={13} />
                      </a>
                      {deletingId === foto.id ? (
                        <span className="size-9 md:size-auto md:p-1.5 inline-flex items-center justify-center">
                          <Loader2 size={13} className="animate-spin text-red-400" />
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDelete(foto.id)}
                          className="size-9 md:size-auto md:p-1.5 inline-flex items-center justify-center rounded-full bg-card/90 text-red-500 hover:bg-card transition-colors"
                          title="Eliminar"
                          aria-label="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Descripción debajo del thumbnail */}
                    {foto.descripcion && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1.5 text-sm font-semibold text-white truncate leading-tight">
                        {foto.descripcion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de documentos */}
          {docs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">
                Documentos ({docs.length})
              </p>
              <ul className="space-y-1.5">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 text-xs">
                    <FileText size={14} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{doc.descripcion || doc.nombre_original}</p>
                      {doc.descripcion && (
                        <p className="text-[10px] text-muted-foreground/70 truncate">{doc.nombre_original}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">{formatBytes(doc.tamano_bytes)}</span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 size-9 md:size-auto md:p-1 inline-flex items-center justify-center rounded text-muted-foreground/70 hover:text-primary hover:bg-blue-50 transition-colors"
                      title="Descargar"
                      aria-label="Descargar"
                    >
                      <Download size={12} />
                    </a>
                    {deletingId === doc.id ? (
                      <Loader2 size={12} className="animate-spin text-red-400 shrink-0" />
                    ) : (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="shrink-0 size-9 md:size-auto md:p-1 inline-flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <CargarArchivoSiniestroDialog
        siniestro_id={siniestro_id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => { setDialogOpen(false); load(); }}
      />

      {lightboxIdx !== null && (
        <Lightbox
          images={fotos}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
