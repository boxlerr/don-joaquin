"use client";

import { useRef, useState } from "react";
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
import { Upload, FileText } from "lucide-react";
import { uploadArchivoSiniestroAction } from "../actions";

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
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDescripcion("");
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileRef.current?.files?.[0]) return setError("Seleccioná un archivo");

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("siniestro_id", siniestro_id);
    formData.set("file", fileRef.current.files[0]);
    if (descripcion.trim()) formData.set("descripcion", descripcion.trim());

    const res = await uploadArchivoSiniestroAction(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      reset();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-lg font-bold">Adjuntar archivo</DialogTitle>
          <DialogDescription className="text-[#475569] text-xs">
            Fotos del siniestro, parte policial, informe de seguro, etc. Máximo 20 MB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1E293B]">
              Archivo <span className="text-red-400">*</span>
            </Label>
            <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors">
              {fileName ? (
                <FileText size={16} className="text-[#0088D1] shrink-0" />
              ) : (
                <Upload size={16} className="text-[#94A3B8] shrink-0" />
              )}
              <span className="text-sm text-[#64748B] truncate">
                {fileName ?? "Elegir archivo..."}
              </span>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1E293B]">Descripción (opcional)</Label>
            <Input
              placeholder="Ej: Foto del frente del camión, Parte policial..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={loading}
              className="text-[#475569] border-[#E2E8F0]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold"
            >
              {loading ? "Subiendo..." : "Adjuntar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
