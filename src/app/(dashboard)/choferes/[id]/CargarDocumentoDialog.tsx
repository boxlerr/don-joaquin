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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { uploadDocumentoChoferAction } from "./actions";
import type { TipoDocumento } from "./types";
import { Upload } from "lucide-react";

interface Props {
  chofer_id: string;
  tipos: TipoDocumento[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CargarDocumentoDialog({
  chofer_id,
  tipos,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTipoId("");
    setNumero("");
    setFechaVencimiento("");
    setFechaEmision("");
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoId) return setError("Seleccioná un tipo de documento");
    if (!fileRef.current?.files?.[0]) return setError("Seleccioná un archivo");

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("chofer_id", chofer_id);
    formData.set("tipo_documento_id", tipoId);
    formData.set("file", fileRef.current.files[0]);
    if (numero) formData.set("numero", numero);
    if (fechaVencimiento) formData.set("fecha_vencimiento", fechaVencimiento);
    if (fechaEmision) formData.set("fecha_emision", fechaEmision);

    const res = await uploadDocumentoChoferAction(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      reset();
      onSuccess();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Cargar documento</DialogTitle>
          <DialogDescription className="text-[#475569]">
            PDF o imagen — máximo 5 MB.
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
              Tipo de documento <span className="text-red-400">*</span>
            </Label>
            {tipos.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No hay tipos de documento disponibles</p>
            ) : (
              <Select value={tipoId} onValueChange={(v) => setTipoId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#1E293B]">Número</Label>
              <Input
                placeholder="Opcional"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#1E293B]">Fecha emisión</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1E293B]">Fecha vencimiento</Label>
            <Input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1E293B]">
              Archivo <span className="text-red-400">*</span>
            </Label>
            <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors">
              <Upload size={16} className="text-[#94A3B8]" />
              <span className="text-sm text-[#64748B]">
                {fileName ?? "Elegir PDF o imagen..."}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={loading}
              className="text-[#475569] border-[#E2E8F0]"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Subiendo..." : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
