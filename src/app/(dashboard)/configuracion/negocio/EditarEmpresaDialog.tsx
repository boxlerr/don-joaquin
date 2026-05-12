"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Check, AlertCircle } from "lucide-react";
import { updateEmpresaAction } from "./actions";

export type EmpresaData = {
  razon_social: string;
  cuit: string;
  domicilio: string;
  email: string;
  telefono: string;
};

interface Props {
  initial: EmpresaData;
}

function formatCuit(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export default function EditarEmpresaDialog({ initial }: Props) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EmpresaData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset(next: EmpresaData) {
    setValues(next);
    setError(null);
    setSaved(false);
  }

  function onOpenChange(next: boolean) {
    if (next) reset(initial);
    setOpen(next);
  }

  function update<K extends keyof EmpresaData>(key: K, value: EmpresaData[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateEmpresaAction(values);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 900);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="brand"
        size="sm"
        onClick={() => onOpenChange(true)}
      >
        <Pencil size={14} />
        Editar datos
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar datos de la empresa</DialogTitle>
          <DialogDescription>
            Estos datos se utilizan en documentos legales y comunicaciones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="razon_social">Razón social</Label>
            <Input
              id="razon_social"
              value={values.razon_social}
              onChange={(e) => update("razon_social", e.target.value)}
              placeholder="Ej: Transportes Don Joaquín S.A."
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cuit">CUIT</Label>
            <Input
              id="cuit"
              value={values.cuit}
              onChange={(e) => update("cuit", formatCuit(e.target.value))}
              placeholder="20-12345678-9"
              required
              disabled={isPending}
              inputMode="numeric"
            />
            <p className="text-[11px] text-[#94A3B8]">
              Formato: XX-XXXXXXXX-X
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domicilio">Domicilio</Label>
            <Input
              id="domicilio"
              value={values.domicilio}
              onChange={(e) => update("domicilio", e.target.value)}
              placeholder="Av. Principal 123, Localidad, Provincia"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email de contacto</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="contacto@empresa.com"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                type="tel"
                value={values.telefono}
                onChange={(e) => update("telefono", e.target.value)}
                placeholder="+54 11 2345-6789"
                disabled={isPending}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-xs text-[#7F1D1D]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-xs text-[#065F46]">
              <Check size={14} />
              Datos guardados correctamente
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
