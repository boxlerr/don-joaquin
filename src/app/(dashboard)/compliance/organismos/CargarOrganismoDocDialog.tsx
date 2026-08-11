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
import { Upload, Send, X, FileText } from "lucide-react";
import { uploadOrganismoDocAction, crearUrlSubidaOrganismoDocAction } from "./actions";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import type { ArchivoMeta } from "@/lib/adjuntos-server";
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
  const [files, setFiles] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const agregarFiles = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setError(null);
    // Evita duplicados por nombre+tamaño; permite ir sumando en varias tandas.
    setFiles((prev) => {
      const clave = (f: File) => `${f.name}:${f.size}`;
      const yaHay = new Set(prev.map(clave));
      return [...prev, ...Array.from(lista).filter((f) => !yaHay.has(clave(f)))];
    });
    if (fileRef.current) fileRef.current.value = "";
  };
  const quitarFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

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
      try {
        // Cada archivo va directo al Storage con su URL firmada; acá sólo viajan
        // los metadatos. Así no lo limita el tope del Server Action.
        const archivos: ArchivoMeta[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          setSubiendo({ idx: i + 1, total: files.length, pct: 0 });
          const url = await crearUrlSubidaOrganismoDocAction({ filename: f.name });
          if ("error" in url) throw new Error(url.error);
          await subirArchivoConUrlFirmada({
            signedUrl: url.signedUrl,
            file: f,
            onProgress: (pct) => setSubiendo({ idx: i + 1, total: files.length, pct }),
          });
          archivos.push({
            bucket: url.bucket,
            path: url.path,
            nombre_original: f.name,
            mime_type: f.type || "application/octet-stream",
            tamano_bytes: f.size,
          });
        }
        setSubiendo(null);
        res = await uploadOrganismoDocAction({
          requisito_id: row.requisito_id,
          fecha_emision: fechaEmision || null,
          fecha_vencimiento: fechaVencimiento || null,
          observaciones: observaciones || null,
          destinatario_slug: destinatario.codigo.toLowerCase(),
          archivos,
        });
      } catch (err) {
        setSubiendo(null);
        setLoading(false);
        return setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
      }
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

          {/* Comprobantes (solo al registrar, opcionales).
              Sin `accept`: un organismo puede pedir un Word, un Excel o un mail
              guardado, y filtrar por extensión sólo servía para que el archivo
              no se pudiera elegir. Suben directo al Storage, así que el tope del
              Server Action (6 MB) ya no los limita. */}
          {!edit && (
            <div className="space-y-1.5">
              <Label>Comprobantes — opcional</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 min-h-11 flex items-center justify-center text-center cursor-pointer hover:border-[#0088D1] transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload size={20} />
                  <p className="text-sm">
                    {files.length ? "Agregar más archivos…" : "Hacé clic para elegir archivos"}
                  </p>
                  <p className="text-xs">Cualquier tipo de documento · podés subir varios</p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => agregarFiles(e.target.files)}
              />

              {files.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${f.size}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                    >
                      <FileText size={13} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                        {f.name}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarFile(i)}
                        aria-label={`Quitar ${f.name}`}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-[#DC2626]"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {subiendo && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Subiendo {subiendo.idx} de {subiendo.total}…
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#0088D1] transition-all duration-200"
                      style={{ width: `${subiendo.pct}%` }}
                    />
                  </div>
                </div>
              )}
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
