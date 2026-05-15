"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Star, Trash2, Upload, Loader2 } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import type { FotoCamion } from "../types";
import {
  uploadFotoCamionAction,
  deleteFotoCamionAction,
  setFotoPrincipalAction,
} from "../actions";

export default function CamionFotosTab({
  camion_id,
  fotos,
  onRefresh,
}: {
  camion_id: string;
  fotos: FotoCamion[];
  onRefresh: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [lightbox, setLightbox] = useState<FotoCamion | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.set("camion_id", camion_id);
      fd.set("file", file);
      const res = await uploadFotoCamionAction(fd);
      if (res.error) {
        setFeedback({ type: "error", msg: res.error });
      } else {
        setFeedback({ type: "success", msg: "Foto subida" });
        onRefresh();
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSetPrincipal = async (foto_id: string) => {
    const res = await setFotoPrincipalAction(foto_id, camion_id);
    if (res.error) {
      setFeedback({ type: "error", msg: res.error });
    } else {
      onRefresh();
    }
  };

  const handleDelete = async (foto_id: string) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    const res = await deleteFotoCamionAction(foto_id);
    if (res.error) {
      setFeedback({ type: "error", msg: res.error });
    } else {
      setFeedback({ type: "success", msg: "Foto eliminada" });
      onRefresh();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#64748B]">
          {fotos.length === 0 ? "Sin fotos cargadas" : `${fotos.length} foto${fotos.length === 1 ? "" : "s"}`}
        </p>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            className="hidden"
          />
          <Button
            variant="brand"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Subiendo..." : "Subir foto"}
          </Button>
        </div>
      </div>

      {feedback && (
        <InlineFeedback
          variant={feedback.type}
          message={feedback.msg}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {fotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#64748B] border border-dashed border-[#E2E8F0] rounded-lg">
          <Camera size={40} className="mb-3 opacity-20" />
          <p className="text-sm">No hay fotos cargadas para este camión.</p>
          <p className="text-xs mt-1">Frente, lateral, interior, chapa, etc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {fotos.map((f) => (
            <div
              key={f.id}
              className="relative group rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] aspect-[4/3]"
            >
              <button
                type="button"
                onClick={() => setLightbox(f)}
                className="block w-full h-full"
                aria-label="Ver foto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={f.descripcion ?? f.nombre_original}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>

              {f.es_principal && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] rounded-md border border-[#FCD34D]">
                  <Star size={10} className="fill-[#F59E0B] text-[#F59E0B]" />
                  Principal
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                {!f.es_principal && (
                  <button
                    type="button"
                    onClick={() => handleSetPrincipal(f.id)}
                    className="p-1.5 bg-white/90 hover:bg-white rounded-md text-[#92400E] shadow-sm"
                    title="Marcar como principal"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  className="p-1.5 bg-white/90 hover:bg-white rounded-md text-red-600 shadow-sm"
                  title="Eliminar foto"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.descripcion ?? lightbox.nombre_original}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
