"use client";

import { useState } from "react";
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
import AdjuntosDocumentos, { useAdjuntos } from "@/components/ui/AdjuntosDocumentos";
import {
  crearUrlSubidaSiniestroAction,
  vincularArchivosSiniestroAction,
  getArchivosSiniestroAction,
  deleteArchivoSiniestroAction,
} from "../actions";

interface Props {
  siniestro_id: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CargarArchivoSiniestroDialog({ siniestro_id, open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");

  // Adjuntos (fotos, parte, informe, video…) — pueden ser VARIOS. entidadId=null:
  // el diálogo solo junta pendientes; se vinculan al siniestro al confirmar.
  const adj = useAdjuntos({
    open,
    entidadId: null,
    crearUrlSubida: (input) => crearUrlSubidaSiniestroAction({ siniestro_id, filename: input.filename }),
    getArchivos: getArchivosSiniestroAction,
    deleteArchivo: deleteArchivoSiniestroAction,
    onError: setError,
  });

  const reset = () => {
    setDescripcion("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adj.pendientes.length === 0) return setError("Elegí al menos un archivo");

    setLoading(true);
    setError(null);
    try {
      const archivos = await adj.subirPendientes();
      const res = await vincularArchivosSiniestroAction(siniestro_id, descripcion.trim() || null, archivos);
      if (!res.ok) {
        setError(res.error ?? "No se pudieron guardar los archivos.");
      } else if (res.fallidos && res.fallidos > 0) {
        // Algunos se adjuntaron y otros no: dejamos el diálogo abierto con el aviso.
        setError(
          `Se adjuntaron ${res.vinculados ?? 0}. ${res.fallidos} archivo(s) no se pudieron subir — cerrá y reintentá con esos.`,
        );
      } else {
        reset();
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron subir los archivos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (loading) return; if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg font-bold">Adjuntar archivos</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Fotos del siniestro, parte policial, informe de seguro, video, etc. Podés subir varios a la vez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <AdjuntosDocumentos
            ctrl={adj}
            disabled={loading}
            label="Archivos"
            hint="fotos, parte, informe, video… — podés subir varios"
          />

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Descripción (opcional)</Label>
            <Input
              placeholder="Ej: Fotos del frente, parte policial…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={loading}
              className="text-muted-foreground border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold"
            >
              {loading ? (adj.subiendo ? `Subiendo ${adj.subiendo.idx}/${adj.subiendo.total}…` : "Guardando…") : "Adjuntar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
