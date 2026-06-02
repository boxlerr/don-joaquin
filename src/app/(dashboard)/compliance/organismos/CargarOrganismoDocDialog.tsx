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
import { Upload } from "lucide-react";
import { uploadOrganismoDocAction } from "./actions";
import type { ComplianceDestinatario, OrganismoChecklistRow } from "../types";

interface Props {
  destinatario: ComplianceDestinatario;
  row: OrganismoChecklistRow;
  onClose: () => void;
}

export default function CargarOrganismoDocDialog({ destinatario, row, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Seleccioná un archivo");

    const fd = new FormData();
    fd.append("requisito_id", row.requisito_id);
    fd.append("fecha_emision", fechaEmision);
    fd.append("fecha_vencimiento", fechaVencimiento); // puede estar vacío
    fd.append("observaciones", observaciones);
    fd.append("destinatario_slug", destinatario.codigo.toLowerCase());
    fd.append("file", file);

    setLoading(true);
    setError(null);
    const res = await uploadOrganismoDocAction(fd);
    setLoading(false);

    if (res && "error" in res) {
      setError(res.error ?? "Error desconocido");
    } else {
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar presentación — {destinatario.nombre}</DialogTitle>
          <DialogDescription>
            Cargá el comprobante de presentación para &ldquo;{row.requisito_nombre}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fecha de presentación */}
          <div className="space-y-1.5">
            <Label>Fecha de presentación</Label>
            <Input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
            />
          </div>

          {/* Próximo vencimiento (opcional) */}
          <div className="space-y-1.5">
            <Label>
              Próximo vencimiento{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Si el organismo fijó una fecha de vencimiento, completala para recibir alertas de preaviso.
            </p>
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: presentado en ventanilla 3, turno 14hs…"
            />
          </div>

          {/* Archivo */}
          <div className="space-y-1.5">
            <Label>Comprobante (PDF, imagen) *</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-[#0088D1] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {fileName ? (
                <p className="text-sm text-foreground font-medium">{fileName}</p>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload size={20} />
                  <p className="text-sm">Hacé clic para seleccionar un archivo</p>
                  <p className="text-xs">PDF, PNG, JPG — máximo 10MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => { const n = e.target.files?.[0]?.name; setFileName(n ?? null); }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              <Upload size={14} />
              {loading ? "Guardando…" : "Guardar presentación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
