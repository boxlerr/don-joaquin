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
import { uploadComplianceDocAction } from "../actions";
import type { ComplianceRequisito } from "../types";

interface Props {
  requisito: ComplianceRequisito;
  chofer_id?: string;
  camion_id?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CargarComplianceDocDialog({
  requisito,
  chofer_id,
  camion_id,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [numero, setNumero] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPeriodo("");
    setFechaEmision("");
    setFechaVencimiento("");
    setObservaciones("");
    setNumero("");
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaVencimiento) return setError("Fecha de vencimiento requerida");
    if (!fileRef.current?.files?.[0]) return setError("Seleccioná un archivo");

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("requisito_id", requisito.id);
    if (chofer_id) formData.set("chofer_id", chofer_id);
    if (camion_id) formData.set("camion_id", camion_id);
    if (periodo) formData.set("periodo", periodo);
    if (fechaEmision) formData.set("fecha_emision", fechaEmision);
    formData.set("fecha_vencimiento", fechaVencimiento);
    if (observaciones) formData.set("observaciones", observaciones);
    if (numero) formData.set("numero", numero);
    formData.set("file", fileRef.current.files[0]);

    const res = await uploadComplianceDocAction(formData);
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
          <DialogTitle className="text-foreground text-xl">Cargar {requisito.nombre}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {vaAlLegajo
              ? `Se va a guardar en ${chofer_id ? "el legajo del chofer" : "la ficha del camión"} y aparecer también acá.`
              : "Cualquier formato — máximo 10 MB."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {esMensual && !vaAlLegajo && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Período (mes)</Label>
              <Input
                type="month"
                value={periodo ? periodo.slice(0, 7) : ""}
                onChange={(e) => setPeriodo(e.target.value ? `${e.target.value}-01` : "")}
              />
            </div>
          )}

          {vaAlLegajo && (
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
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
            </div>
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
              placeholder="Opcional"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Archivo <span className="text-red-400">*</span>
            </Label>
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
              {loading ? "Subiendo..." : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
