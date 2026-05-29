"use client";

import { useEffect, useRef, useState } from "react";
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
import { uploadDocumentoCamionAction, updateDocumentoCamionAction } from "../actions";
import type { TipoDocumentoCamion } from "../types";
import { Upload } from "lucide-react";

export type DocumentoEditing = {
  id: string;
  tipo_documento: string | null;
  numero: string | null;
  fecha_vencimiento: string | null;
};

interface Props {
  camion_id: string;
  tipos: TipoDocumentoCamion[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  editing?: DocumentoEditing | null;
}

export default function CargarDocumentoCamionDialog({
  camion_id,
  tipos,
  open,
  onOpenChange,
  onSuccess,
  editing,
}: Props) {
  const isEdit = !!editing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [tipoNombreCustom, setTipoNombreCustom] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOtro = tipoId === "__otro__";

  // Prefill al abrir en modo edición
  useEffect(() => {
    if (open && editing) {
      setNumero(editing.numero ?? "");
      setFechaVencimiento(editing.fecha_vencimiento ?? "");
      setFechaEmision("");
      setFileName(null);
      setError(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, editing]);

  const reset = () => {
    setTipoId("");
    setTipoNombreCustom("");
    setNumero("");
    setFechaVencimiento("");
    setFechaEmision("");
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    if (isEdit && editing) {
      const formData = new FormData();
      formData.set("doc_id", editing.id);
      formData.set("numero", numero);
      formData.set("fecha_vencimiento", fechaVencimiento);
      if (fechaEmision) formData.set("fecha_emision", fechaEmision);
      const nuevoArchivo = fileRef.current?.files?.[0];
      if (nuevoArchivo) formData.set("file", nuevoArchivo);

      const res = await updateDocumentoCamionAction(formData);
      setLoading(false);
      if (res.error) setError(res.error);
      else {
        reset();
        onSuccess();
      }
      return;
    }

    if (!tipoId) {
      setLoading(false);
      return setError("Seleccioná un tipo de documento");
    }
    if (isOtro && !tipoNombreCustom.trim()) {
      setLoading(false);
      return setError("Escribí el nombre del tipo de documento");
    }
    if (!fileRef.current?.files?.[0]) {
      setLoading(false);
      return setError("Seleccioná un archivo");
    }

    const formData = new FormData();
    formData.set("camion_id", camion_id);
    if (isOtro) {
      formData.set("tipo_nombre_custom", tipoNombreCustom.trim());
    } else {
      formData.set("tipo_documento_id", tipoId);
    }
    formData.set("file", fileRef.current.files[0]);
    if (numero) formData.set("numero", numero);
    if (fechaVencimiento) formData.set("fecha_vencimiento", fechaVencimiento);
    if (fechaEmision) formData.set("fecha_emision", fechaEmision);

    const res = await uploadDocumentoCamionAction(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      reset();
      onSuccess();
    }
  };

  const selectedLabel = tipoId === "__otro__"
    ? "Otro..."
    : tipos.find((t) => t.id === tipoId)?.nombre;

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
          <DialogTitle className="text-foreground text-xl">
            {isEdit ? "Actualizar documento" : "Cargar documento"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? "Actualizá la fecha de vencimiento y, si renovaste, reemplazá el archivo."
              : "Cualquier formato — máximo 10 MB."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Tipo de documento</Label>
            {isEdit ? (
              <div className="h-10 px-3 flex items-center rounded-lg border border-border bg-muted/40 text-sm text-foreground">
                {editing?.tipo_documento ?? "Documento"}
              </div>
            ) : tipos.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">No hay tipos de documento disponibles</p>
            ) : (
              <>
                <Select
                  value={tipoId}
                  onValueChange={(v) => {
                    setTipoId(v ?? "");
                    if (v !== "__otro__") setTipoNombreCustom("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo...">
                      {tipoId ? selectedLabel : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                    <SelectItem value="__otro__">Otro...</SelectItem>
                  </SelectContent>
                </Select>

                {isOtro && (
                  <Input
                    className="mt-2"
                    placeholder="Nombre del documento (ej: Seguro)"
                    value={tipoNombreCustom}
                    onChange={(e) => setTipoNombreCustom(e.target.value)}
                    autoFocus
                  />
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Número</Label>
              <Input
                placeholder="Opcional"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Fecha vencimiento</Label>
            <Input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Archivo {!isEdit && <span className="text-red-400">*</span>}
              {isEdit && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (opcional — solo si renovaste)
                </span>
              )}
            </Label>
            <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors">
              <Upload size={16} className="text-muted-foreground/70" />
              <span className="text-sm text-muted-foreground">
                {fileName ?? (isEdit ? "Mantener archivo actual" : "Elegir archivo...")}
              </span>
              <input
                ref={fileRef}
                type="file"
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
              className="text-muted-foreground border-border"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Actualizar" : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
