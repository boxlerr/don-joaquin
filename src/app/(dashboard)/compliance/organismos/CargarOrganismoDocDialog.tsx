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
import { Upload, Send } from "lucide-react";
import { uploadOrganismoDocAction } from "./actions";
import { setComplianceVencimientoAction, setComplianceEnviarAAction } from "../actions";
import type { ComplianceDestinatario, OrganismoChecklistRow } from "../types";

interface Props {
  destinatario: ComplianceDestinatario;
  row: OrganismoChecklistRow;
  // Modo edición: actualiza el vencimiento/observaciones del doc vigente sin re-subir.
  edit?: boolean;
  onClose: () => void;
}

export default function CargarOrganismoDocDialog({ destinatario, row, edit = false, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(
    edit ? row.fecha_vencimiento ?? "" : "",
  );
  const [observaciones, setObservaciones] = useState(edit ? row.observaciones ?? "" : "");
  // A dónde se manda el doc (portal/mail). Vive en el requisito; se edita acá
  // por comodidad y aplica a todas las presentaciones.
  const [enviarA, setEnviarA] = useState(row.enviar_a ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let res: { error?: string; success?: boolean } | null;
    if (edit) {
      if (!row.documento_id) {
        setLoading(false);
        return setError("No hay presentación para editar");
      }
      if (!fechaVencimiento) {
        setLoading(false);
        return setError("Fecha de vencimiento requerida");
      }
      res = await setComplianceVencimientoAction({
        documento_id: row.documento_id,
        fuente: "compliance_documentos",
        fecha_vencimiento: fechaVencimiento,
        observaciones: observaciones || null,
      });
    } else {
      const fd = new FormData();
      fd.append("requisito_id", row.requisito_id);
      fd.append("fecha_emision", fechaEmision);
      fd.append("fecha_vencimiento", fechaVencimiento); // puede estar vacío
      fd.append("observaciones", observaciones);
      fd.append("destinatario_slug", destinatario.codigo.toLowerCase());
      const file = fileRef.current?.files?.[0];
      if (file) fd.append("file", file); // archivo opcional
      res = await uploadOrganismoDocAction(fd);
    }

    // El destino de envío es del requisito: se guarda aparte, solo si cambió.
    if (!(res && "error" in res && res.error) && (enviarA.trim() || null) !== (row.enviar_a ?? null)) {
      await setComplianceEnviarAAction({ requisito_id: row.requisito_id, enviar_a: enviarA });
    }

    setLoading(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {edit ? "Editar vencimiento" : "Registrar presentación"} — {destinatario.nombre}
          </DialogTitle>
          <DialogDescription>
            {edit
              ? `Actualizá el vencimiento y las observaciones de "${row.requisito_nombre}" sin volver a subir el comprobante.`
              : `Cargá el comprobante de presentación para "${row.requisito_nombre}". El archivo es opcional.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fecha de presentación (solo al registrar) */}
          {!edit && (
            <div className="space-y-1.5">
              <Label>Fecha de presentación</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
            </div>
          )}

          {/* Próximo vencimiento */}
          <div className="space-y-1.5">
            <Label>
              Próximo vencimiento{" "}
              {edit ? (
                <span className="text-red-400">*</span>
              ) : (
                <span className="text-muted-foreground font-normal">(opcional)</span>
              )}
            </Label>
            <Input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              required={edit}
            />
            {!edit && (
              <p className="text-[11px] text-muted-foreground">
                Si el organismo fijó una fecha de vencimiento, completala para recibir alertas de preaviso.
              </p>
            )}
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

          {/* A dónde se manda (vive en el requisito) */}
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1.5">
              <Send size={12} className="text-muted-foreground" />
              A dónde se manda
            </Label>
            <Input
              value={enviarA}
              onChange={(e) => setEnviarA(e.target.value)}
              placeholder='Portales / mails (ej. "portal SICOP + mail del estudio")'
            />
            <p className="text-[11px] text-muted-foreground">
              Queda asociado a «{row.requisito_nombre}» y se muestra en el checklist y en las alertas.
            </p>
          </div>

          {/* Archivo (solo al registrar, opcional) */}
          {!edit && (
            <div className="space-y-1.5">
              <Label>Comprobante (PDF, imagen) — opcional</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 min-h-11 flex items-center justify-center text-center cursor-pointer hover:border-[#0088D1] transition-colors"
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
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              <Upload size={14} />
              {loading ? "Guardando…" : edit ? "Guardar vencimiento" : "Guardar presentación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
