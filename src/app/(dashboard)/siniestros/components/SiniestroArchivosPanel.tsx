"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Plus, Trash2, Download, FileText, Image, Loader2 } from "lucide-react";
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

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <Image size={14} className="text-violet-500 shrink-0" />;
  return <FileText size={14} className="text-[#0088D1] shrink-0" />;
}

export default function SiniestroArchivosPanel({ siniestro_id }: Props) {
  const [archivos, setArchivos] = useState<SiniestroArchivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getArchivosSiniestroAction(siniestro_id);
    setArchivos(data);
    setLoading(false);
  }, [siniestro_id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteArchivoSiniestroAction(id);
    setDeletingId(null);
    load();
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-3">
        <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip size={13} className="text-[#0088D1]" /> Archivos adjuntos
          {!loading && (
            <span className="ml-1 font-bold text-slate-400">({archivos.length})</span>
          )}
        </h4>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 px-2 text-[11px] text-[#0088D1] hover:bg-blue-50 font-bold gap-1"
          onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
        >
          <Plus size={12} /> Adjuntar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={13} className="animate-spin" /> Cargando...
        </div>
      ) : archivos.length === 0 ? (
        <p className="text-xs text-slate-400 font-medium py-1">Sin archivos adjuntos</p>
      ) : (
        <ul className="space-y-1.5">
          {archivos.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 text-xs group"
              onClick={(e) => e.stopPropagation()}
            >
              <FileIcon mime={a.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0F172A] truncate">{a.descripcion || a.nombre_original}</p>
                {a.descripcion && (
                  <p className="text-[10px] text-slate-400 truncate">{a.nombre_original}</p>
                )}
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(a.tamano_bytes)}</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-slate-400 hover:text-[#0088D1] hover:bg-blue-50 transition-colors"
                title="Descargar"
              >
                <Download size={12} />
              </a>
              {deletingId === a.id ? (
                <Loader2 size={12} className="animate-spin text-red-400 shrink-0" />
              ) : (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <CargarArchivoSiniestroDialog
        siniestro_id={siniestro_id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => { setDialogOpen(false); load(); }}
      />
    </div>
  );
}
