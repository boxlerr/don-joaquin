"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdjuntosEditable from "@/components/ui/AdjuntosEditable";
import { getCvsAction, crearUrlSubidaCvAction, vincularCvAction, deleteCvAction } from "../actions";

// Botón + diálogo para adjuntar / ver / descargar los CVs de un candidato.
export default function CvButton({
  entrevistaId, nombre, count, canWrite,
}: {
  entrevistaId: string;
  nombre: string;
  count: number;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver / adjuntar CV"
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
          count > 0
            ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-border text-muted-foreground hover:bg-muted"
        }`}
      >
        <Paperclip size={11} />
        {count > 0 ? `${count} CV${count > 1 ? "s" : ""}` : "CV"}
      </button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>CVs — {nombre}</DialogTitle>
            </DialogHeader>
            <AdjuntosEditable
              entidadId={entrevistaId}
              getArchivos={getCvsAction}
              crearUrlSubida={crearUrlSubidaCvAction}
              vincularArchivos={vincularCvAction}
              deleteArchivo={deleteCvAction}
              canEdit={canWrite}
              addLabel="Subir CV"
              emptyHint="Sin CV cargado todavía."
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
