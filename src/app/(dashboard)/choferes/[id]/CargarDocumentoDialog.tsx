"use client";

import { useRef, useState, useEffect } from "react";
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
import { uploadDocumentoChoferAction, updateDocumentoChoferAction } from "./actions";
import type { TipoDocumento, DocumentoVigencia } from "./types";
import { Upload, Trash2 } from "lucide-react";

interface Props {
  chofer_id: string;
  tipos: TipoDocumento[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  documento?: DocumentoVigencia | null;
}

export default function CargarDocumentoDialog({
  chofer_id,
  tipos,
  open,
  onOpenChange,
  onSuccess,
  documento,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [tipoNombreCustom, setTipoNombreCustom] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [eliminarArchivo, setEliminarArchivo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOtro = tipoId === "__otro__";

  const reset = () => {
    setTipoId("");
    setTipoNombreCustom("");
    setFechaVencimiento("");
    setFechaEmision("");
    setFileName(null);
    setEliminarArchivo(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  useEffect(() => {
    if (open && documento) {
      setTipoId(documento.tipo_documento_id ?? "");
      setFechaEmision(documento.fecha_emision ?? "");
      setFechaVencimiento(documento.fecha_vencimiento ?? "");
      setFileName(documento.archivo_nombre ?? null);
      setEliminarArchivo(false);
    } else if (open) {
      reset();
    }
  }, [open, documento]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoId) return setError("Seleccioná un tipo de documento");
    if (isOtro && !tipoNombreCustom.trim())
      return setError("Escribí el nombre del tipo de documento");
    
    // File is only mandatory when creating a new document
    if (!documento && !fileRef.current?.files?.[0]) {
      return setError("Seleccioná un archivo");
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("chofer_id", chofer_id);
    
    if (documento) {
      formData.set("id", documento.id ?? "");
      formData.set("tipo_documento_id", tipoId);
      if (eliminarArchivo) {
        formData.set("eliminar_archivo", "true");
      }
    } else {
      if (isOtro) {
        formData.set("tipo_nombre_custom", tipoNombreCustom.trim());
      } else {
        formData.set("tipo_documento_id", tipoId);
      }
    }

    const hasNewFile = fileRef.current?.files?.[0];
    if (hasNewFile) {
      formData.set("file", hasNewFile);
    }

    if (fechaVencimiento) formData.set("fecha_vencimiento", fechaVencimiento);
    if (fechaEmision) formData.set("fecha_emision", fechaEmision);

    const res = documento
      ? await updateDocumentoChoferAction(formData)
      : await uploadDocumentoChoferAction(formData);
      
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
          <DialogTitle className="text-foreground text-xl">
            {documento ? "Editar documento" : "Cargar documento"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {documento
              ? "Modificá los datos del documento o cargá una nueva foto/archivo."
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
            <Label className="text-sm font-medium text-foreground">
              Tipo de documento <span className="text-red-400">*</span>
            </Label>
            {tipos.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">No hay tipos de documento disponibles</p>
            ) : (
              <>
                <Select
                  value={tipoId}
                  disabled={!!documento}
                  onValueChange={(v) => {
                    setTipoId(v ?? "");
                    if (v !== "__otro__") setTipoNombreCustom("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo...">
                      {tipoId
                        ? tipoId === "__otro__"
                          ? "Otro..."
                          : tipos.find((t) => t.id === tipoId)?.nombre
                        : undefined}
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
                    placeholder="Nombre del documento (ej: Seguro de vida)"
                    value={tipoNombreCustom}
                    onChange={(e) => setTipoNombreCustom(e.target.value)}
                    autoFocus
                  />
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
            <Input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
            />
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
              Archivo {!documento && <span className="text-red-400">*</span>}
            </Label>
            <input
              ref={fileRef}
              type="file"
              id="doc-file-input"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  setFileName(selected.name);
                }
              }}
            />
            {fileName ? (
              <div className="flex items-center justify-between px-4 py-3 border border-[#CBD5E1] rounded-[8px] bg-[#F8FAFC]">
                <div className="flex items-center gap-3 min-w-0">
                  <Upload size={16} className="text-muted-foreground/70 flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{fileName}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (fileRef.current) {
                      fileRef.current.value = "";
                    }
                    if (documento && documento.archivo_nombre && !eliminarArchivo && fileName !== documento.archivo_nombre) {
                      setFileName(documento.archivo_nombre);
                    } else {
                      setFileName(null);
                      if (documento) {
                        setEliminarArchivo(true);
                      }
                    }
                  }}
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="doc-file-input"
                className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors"
              >
                <Upload size={16} className="text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">Elegir archivo...</span>
              </label>
            )}
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
              {loading
                ? documento
                  ? "Guardando..."
                  : "Subiendo..."
                : documento
                ? "Guardar"
                : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
