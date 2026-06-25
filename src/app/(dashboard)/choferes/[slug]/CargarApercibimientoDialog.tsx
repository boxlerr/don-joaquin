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
import { crearApercibimientoAction, crearUrlSubidaDocumentoAction } from "./actions";
import type { CategoriaApercibimiento } from "./types";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import { Upload, Trash2, AlertCircle, Paperclip } from "lucide-react";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

interface Props {
  chofer_id: string;
  categorias: CategoriaApercibimiento[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CargarApercibimientoDialog({
  chofer_id,
  categorias,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFecha(new Date().toISOString().split("T")[0]);
    setCategoriaId("");
    setMotivo("");
    setObservaciones("");
    setFile(null);
    setError(null);
    setProgreso(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const elegirArchivo = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`El archivo pesa ${fmtSize(f.size)}. El máximo permitido es ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return setError("El motivo es obligatorio");

    setLoading(true);
    setError(null);

    try {
      // Archivo opcional: el apercibimiento escaneado/firmado, comprobante, etc.
      let archivoMeta:
        | { bucket: string; path: string; nombre_original: string; mime_type: string; tamano_bytes: number }
        | null = null;

      if (file) {
        setProgreso(0);
        const urlRes = await crearUrlSubidaDocumentoAction({ chofer_id, filename: file.name });
        if ("error" in urlRes) throw new Error(urlRes.error);
        await subirArchivoConUrlFirmada({ signedUrl: urlRes.signedUrl, file, onProgress: setProgreso });
        archivoMeta = {
          bucket: urlRes.bucket,
          path: urlRes.path,
          nombre_original: file.name,
          mime_type: file.type || "application/octet-stream",
          tamano_bytes: file.size,
        };
      }

      const res = await crearApercibimientoAction(chofer_id, {
        fecha,
        categoria_id: categoriaId || null,
        motivo,
        observaciones: observaciones || null,
        archivo: archivoMeta,
      });

      if (res.error) {
        setError(res.error);
      } else {
        reset();
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el apercibimiento.");
    } finally {
      setLoading(false);
      setProgreso(null);
    }
  };

  const subiendo = loading && progreso !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (loading) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Nuevo apercibimiento</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Quedará registrado en el historial del chofer. Podés adjuntar el archivo firmado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Fecha <span className="text-red-400">*</span>
            </Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={loading} required />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Categoría</Label>
            <Select
              value={categoriaId || "__none__"}
              disabled={loading}
              onValueChange={(v) => setCategoriaId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Motivo <span className="text-red-400">*</span>
            </Label>
            <textarea
              className="flex w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describí brevemente el motivo del apercibimiento"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones</Label>
            <textarea
              className="flex w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              disabled={loading}
            />
          </div>

          {/* Adjuntar archivo (opcional) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Archivo <span className="text-muted-foreground font-normal">(opcional — ej: apercibimiento firmado)</span>
            </Label>
            <input
              ref={fileRef}
              type="file"
              id="aperc-file-input"
              className="hidden"
              disabled={loading}
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-between px-4 py-2.5 border border-[#CBD5E1] rounded-[8px] bg-[#F8FAFC]">
                <div className="flex items-center gap-3 min-w-0">
                  <Paperclip size={15} className="text-muted-foreground/70 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm text-foreground truncate block">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtSize(file.size)}</span>
                  </div>
                </div>
                {!loading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            ) : (
              <label
                htmlFor="aperc-file-input"
                className="flex items-center gap-3 px-4 py-2.5 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors"
              >
                <Upload size={15} className="text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">Adjuntar archivo (hasta {MAX_MB} MB)</span>
              </label>
            )}
          </div>

          {subiendo && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progreso! < 100 ? "Subiendo archivo…" : "Finalizando…"}</span>
                <span className="font-mono">{progreso}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[#0088D1] transition-all duration-200 rounded-full"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

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
              {loading ? (subiendo ? `Subiendo… ${progreso}%` : "Guardando…") : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
