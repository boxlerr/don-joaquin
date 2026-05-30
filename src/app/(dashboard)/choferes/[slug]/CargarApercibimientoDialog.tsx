"use client";

import { useState } from "react";
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
import { crearApercibimientoAction } from "./actions";
import type { CategoriaApercibimiento } from "./types";

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
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const reset = () => {
    setFecha(new Date().toISOString().split("T")[0]);
    setCategoriaId("");
    setMotivo("");
    setObservaciones("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return setError("El motivo es obligatorio");

    setLoading(true);
    setError(null);

    const res = await crearApercibimientoAction(chofer_id, {
      fecha,
      categoria_id: categoriaId || null,
      motivo,
      observaciones: observaciones || null,
    });

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
          <DialogTitle className="text-foreground text-xl">Nuevo apercibimiento</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Quedará registrado en el historial del chofer.
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
              Fecha <span className="text-red-400">*</span>
            </Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Categoría</Label>
            <Select
              value={categoriaId || "__none__"}
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
              className="flex w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describí brevemente el motivo del apercibimiento"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Observaciones</Label>
            <textarea
              className="flex w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales (opcional)"
            />
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
              {loading ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
