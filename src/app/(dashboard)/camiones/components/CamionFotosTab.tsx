"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Star, Trash2, Upload, Loader2, StickyNote, X as XIcon } from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { FotoCamion } from "../types";
import {
  uploadFotoCamionAction,
  deleteFotoCamionAction,
  setFotoPrincipalAction,
  updateFotoDescripcionAction,
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
  const [progreso, setProgreso] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [lightbox, setLightbox] = useState<FotoCamion | null>(null);
  const [editing, setEditing] = useState<FotoCamion | null>(null);
  const [draftNota, setDraftNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState<FotoCamion | null>(null);
  const [borrando, setBorrando] = useState(false);

  // Subida multi-archivo: se pueden elegir varias fotos de una (frente, lateral,
  // interior…) y se suben en secuencia, informando el progreso.
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setFeedback(null);
    let subidas = 0;
    const errores: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgreso(files.length > 1 ? `${i + 1}/${files.length}` : null);
        const fd = new FormData();
        fd.set("camion_id", camion_id);
        fd.set("file", files[i]);
        const res = await uploadFotoCamionAction(fd);
        if (res.error) errores.push(`${files[i].name}: ${res.error}`);
        else subidas++;
      }
      if (errores.length > 0) {
        setFeedback({
          type: "error",
          msg: `${subidas} de ${files.length} subida${files.length === 1 ? "" : "s"} — falló: ${errores.join(" · ")}`,
        });
      } else {
        setFeedback({ type: "success", msg: subidas === 1 ? "Foto subida" : `${subidas} fotos subidas` });
      }
      if (subidas > 0) onRefresh();
    } finally {
      setUploading(false);
      setProgreso(null);
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

  const handleDelete = async () => {
    if (!confirmarBorrado) return;
    setBorrando(true);
    try {
      const res = await deleteFotoCamionAction(confirmarBorrado.id);
      if (res.error) {
        setFeedback({ type: "error", msg: res.error });
      } else {
        setFeedback({ type: "success", msg: "Foto eliminada" });
        onRefresh();
      }
    } finally {
      setBorrando(false);
      setConfirmarBorrado(null);
    }
  };

  const openNotaEditor = (f: FotoCamion) => {
    setEditing(f);
    setDraftNota(f.descripcion ?? "");
  };

  const handleSaveNota = async () => {
    if (!editing) return;
    setSavingNota(true);
    try {
      const res = await updateFotoDescripcionAction(editing.id, draftNota);
      if (res.error) {
        setFeedback({ type: "error", msg: res.error });
      } else {
        setFeedback({ type: "success", msg: "Nota guardada" });
        onRefresh();
        setEditing(null);
      }
    } finally {
      setSavingNota(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {fotos.length === 0 ? "Sin fotos cargadas" : `${fotos.length} foto${fotos.length === 1 ? "" : "s"}`}
        </p>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <Button
            variant="brand"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? `Subiendo${progreso ? ` ${progreso}` : "..."}` : "Subir fotos"}
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
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          <Camera size={40} className="mb-3 opacity-20" />
          <p className="text-sm">No hay fotos cargadas para este camión.</p>
          <p className="text-xs mt-1">Frente, lateral, interior, chapa, etc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {fotos.map((f) => (
            <div
              key={f.id}
              className="rounded-lg overflow-hidden border border-border bg-card flex flex-col"
            >
              <div className="relative group bg-muted/40 aspect-[4/3]">
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
                  <button
                    type="button"
                    onClick={() => openNotaEditor(f)}
                    className="p-1.5 bg-card/90 hover:bg-card rounded-md text-primary shadow-sm"
                    title="Editar nota"
                  >
                    <StickyNote size={13} />
                  </button>
                  {!f.es_principal && (
                    <button
                      type="button"
                      onClick={() => handleSetPrincipal(f.id)}
                      className="p-1.5 bg-card/90 hover:bg-card rounded-md text-[#92400E] shadow-sm"
                      title="Marcar como principal"
                    >
                      <Star size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmarBorrado(f)}
                    className="p-1.5 bg-card/90 hover:bg-card rounded-md text-red-600 shadow-sm"
                    title="Eliminar foto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openNotaEditor(f)}
                className="text-left px-2.5 py-2 text-xs leading-snug border-t border-[#F1F5F9] hover:bg-muted/40 transition-colors min-h-[44px] flex items-start gap-1.5"
                title={f.descripcion ? "Editar nota" : "Agregar nota"}
              >
                <StickyNote
                  size={11}
                  className={`mt-0.5 shrink-0 ${f.descripcion ? "text-primary" : "text-muted-foreground/70"}`}
                />
                <span
                  className={`flex-1 line-clamp-2 ${
                    f.descripcion ? "text-foreground" : "italic text-muted-foreground/70"
                  }`}
                >
                  {f.descripcion ?? "Agregar nota"}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmarBorrado}
        onOpenChange={(o) => {
          if (!o) setConfirmarBorrado(null);
        }}
        title="¿Eliminar esta foto?"
        description="La foto se borra del legajo del camión. Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        loading={borrando}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.descripcion ?? lightbox.nombre_original}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            decoding="async"
          />
          {lightbox.descripcion && (
            <div
              className="mt-4 max-w-xl text-center text-sm text-white bg-black/40 border border-white/10 rounded-md px-4 py-2"
              onClick={(e) => e.stopPropagation()}
            >
              {lightbox.descripcion}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl flex items-center gap-2">
              <StickyNote size={18} className="text-primary" />
              Nota de la foto
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Anotá lo que necesites recordar: choque en el lateral derecho, golpe en parabrisas, problema mecánico, etc.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <textarea
              autoFocus
              value={draftNota}
              onChange={(e) => setDraftNota(e.target.value)}
              placeholder="Ej: Foto del choque trasero del 12/03/2026..."
              className="w-full min-h-[120px] rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088D1]"
              maxLength={500}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{draftNota.length} / 500</span>
              {editing?.descripcion && (
                <button
                  type="button"
                  onClick={() => setDraftNota("")}
                  className="inline-flex items-center gap-1 hover:text-red-600"
                >
                  <XIcon size={11} /> Borrar nota
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={savingNota}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={handleSaveNota}
              disabled={savingNota}
            >
              {savingNota ? <Loader2 size={14} className="animate-spin" /> : null}
              {savingNota ? "Guardando..." : "Guardar nota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
