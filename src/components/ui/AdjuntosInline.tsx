"use client";

import { useEffect, useState } from "react";
import { FileText, ImageIcon, Download, Eye, Loader2, Trash2, Paperclip } from "lucide-react";
import type { AdjuntoExistente } from "@/lib/adjuntos-server";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const esImagen = (mime: string | null | undefined) => !!mime && mime.startsWith("image/");

/**
 * Lista de solo-lectura de los adjuntos de una entidad (ver / descargar / borrar).
 * Reutilizable en cualquier panel: recibe la action `getArchivos` de la entidad y
 * (opcional) `deleteArchivo` si se puede borrar. Carga sola al montar y cuando
 * cambia `refreshKey`.
 */
export default function AdjuntosInline({
  entidadId,
  getArchivos,
  deleteArchivo,
  canDelete = false,
  refreshKey = 0,
  emptyHint,
  compact = false,
}: {
  entidadId: string;
  getArchivos: (id: string) => Promise<AdjuntoExistente[]>;
  deleteArchivo?: (adjuntoId: string) => Promise<{ ok?: boolean; error?: string; success?: boolean }>;
  canDelete?: boolean;
  refreshKey?: number;
  emptyHint?: string;
  compact?: boolean;
}) {
  const [archivos, setArchivos] = useState<AdjuntoExistente[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional: recargar al cambiar entidad/refreshKey
    setLoading(true);
    getArchivos(entidadId)
      .then((a) => { if (!cancel) setArchivos(a); })
      .catch(() => { if (!cancel) setError("No se pudieron cargar los adjuntos."); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [entidadId, getArchivos, refreshKey]);

  const handleDelete = async (id: string) => {
    if (!deleteArchivo) return;
    setDeleting(id);
    const res = await deleteArchivo(id);
    if (res && "error" in res && res.error) {
      setError(res.error);
    } else {
      setArchivos((prev) => prev.filter((a) => a.id !== id));
    }
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 size={12} className="animate-spin" /> Cargando adjuntos…
      </div>
    );
  }

  if (archivos.length === 0) {
    return emptyHint ? <p className="text-xs text-muted-foreground/70">{emptyHint}</p> : null;
  }

  return (
    <div className="space-y-1.5">
      {!compact && (
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip size={11} /> Adjuntos ({archivos.length})
        </p>
      )}
      <ul className="space-y-1">
        {archivos.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 px-2.5 py-1.5 border border-border rounded-[8px] bg-muted/30"
          >
            {esImagen(a.mime_type) ? (
              <ImageIcon size={14} className="text-[#0088D1] shrink-0" />
            ) : (
              <FileText size={14} className="text-[#0088D1] shrink-0" />
            )}
            <span className="text-xs text-foreground truncate flex-1 min-w-0">{a.nombre_original}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(a.tamano_bytes)}</span>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#0088D1]/10 transition-colors"
              title="Ver"
            >
              <Eye size={13} />
            </a>
            <a
              href={a.downloadUrl || a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#0088D1]/10 transition-colors"
              title={`Descargar ${a.nombre_original}`}
            >
              <Download size={13} />
            </a>
            {canDelete && deleteArchivo && (
              deleting === a.id ? (
                <Loader2 size={13} className="animate-spin text-red-400 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
