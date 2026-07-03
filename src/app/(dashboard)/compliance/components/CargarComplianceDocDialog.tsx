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
import {
  uploadComplianceDocAction,
  setComplianceVencimientoAction,
  setComplianceEnviarAAction,
} from "../actions";
import type { ComplianceRequisito } from "../types";

// Cuando se pasa `edit`, el diálogo edita el vencimiento/observaciones de un
// documento YA cargado (sin re-subir el archivo). Si no, carga uno nuevo (con el
// archivo opcional: se puede registrar solo el vencimiento).
export type EditVencimiento = {
  documento_id: string;
  fuente: "compliance_documentos" | "chofer_documentos" | "camion_documentos";
  fecha_vencimiento: string | null;
  observaciones: string | null;
};

interface Props {
  requisito: ComplianceRequisito;
  chofer_id?: string;
  camion_id?: string;
  edit?: EditVencimiento;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CargarComplianceDocDialog({
  requisito,
  chofer_id,
  camion_id,
  edit,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const esEdicion = !!edit;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(edit?.fecha_vencimiento ?? "");
  const [observaciones, setObservaciones] = useState(edit?.observaciones ?? "");
  const [numero, setNumero] = useState("");
  // A dónde se manda el doc (portal/mail). Vive en el REQUISITO, no en el
  // documento: se edita acá por comodidad y aplica a todas las presentaciones.
  const [enviarA, setEnviarA] = useState(requisito.enviar_a ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPeriodo("");
    setFechaEmision("");
    setFechaVencimiento(edit?.fecha_vencimiento ?? "");
    setObservaciones(edit?.observaciones ?? "");
    setNumero("");
    setEnviarA(requisito.enviar_a ?? "");
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaVencimiento) return setError("Fecha de vencimiento requerida");

    setLoading(true);
    setError(null);

    const res = esEdicion
      ? await setComplianceVencimientoAction({
          documento_id: edit!.documento_id,
          fuente: edit!.fuente,
          fecha_vencimiento: fechaVencimiento,
          observaciones: observaciones || null,
        })
      : await (async () => {
          const formData = new FormData();
          formData.set("requisito_id", requisito.id);
          if (chofer_id) formData.set("chofer_id", chofer_id);
          if (camion_id) formData.set("camion_id", camion_id);
          if (periodo) formData.set("periodo", periodo);
          if (fechaEmision) formData.set("fecha_emision", fechaEmision);
          formData.set("fecha_vencimiento", fechaVencimiento);
          if (observaciones) formData.set("observaciones", observaciones);
          if (numero) formData.set("numero", numero);
          const f = fileRef.current?.files?.[0];
          if (f) formData.set("file", f);
          return uploadComplianceDocAction(formData);
        })();

    // El destino de envío es del requisito: se guarda aparte, solo si cambió.
    if (!("error" in res && res.error) && (enviarA.trim() || null) !== (requisito.enviar_a ?? null)) {
      await setComplianceEnviarAAction({ requisito_id: requisito.id, enviar_a: enviarA });
    }

    setLoading(false);

    if ("error" in res && res.error) {
      setError(res.error);
    } else {
      reset();
      onSuccess();
    }
  };

  const esMensual = requisito.periodicidad === "mensual";
  const vaAlLegajo = !!requisito.tipo_documento_id;

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
            {esEdicion ? "Editar vencimiento" : "Cargar"} — {requisito.nombre}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {esEdicion
              ? "Actualizá la fecha de vencimiento y observaciones sin volver a subir el archivo."
              : vaAlLegajo
                ? `Se va a guardar en ${chofer_id ? "el legajo del chofer" : "la ficha del camión"} y aparecer también acá. El archivo es opcional.`
                : "El archivo es opcional — podés registrar solo el vencimiento. Cualquier formato, máximo 10 MB."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {!esEdicion && esMensual && !vaAlLegajo && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Período (mes)</Label>
              <Input
                type="month"
                value={periodo ? periodo.slice(0, 7) : ""}
                onChange={(e) => setPeriodo(e.target.value ? `${e.target.value}-01` : "")}
              />
            </div>
          )}

          {!esEdicion && vaAlLegajo && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Número</Label>
              <Input
                placeholder="Opcional"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!esEdicion && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
                <Input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Vencimiento <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones</Label>
            <Input
              placeholder='Opcional (ej. "solo Loma Negra")'
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
              <Send size={12} className="text-muted-foreground" />
              A dónde se manda
            </Label>
            <Input
              placeholder='Portales / mails (ej. "SICOP, Secondi y portal de YPF")'
              value={enviarA}
              onChange={(e) => setEnviarA(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Queda asociado al documento «{requisito.nombre}» (todas sus presentaciones) y
              se muestra en el checklist y en las alertas de vencimiento.
            </p>
          </div>

          {!esEdicion && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Archivo (opcional)</Label>
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:border-[#0088D1] hover:bg-[#F0F9FF] transition-colors">
                <Upload size={16} className="text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">{fileName ?? "Elegir archivo..."}</span>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
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
              {loading ? "Guardando..." : esEdicion ? "Guardar vencimiento" : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
