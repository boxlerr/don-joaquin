"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { TIPOS_ROTURA } from "./AddRoturaDialog";
import { addInsumoAction, updateInsumoAction, type InsumoRow } from "../actions";

export default function AddInsumoDialog({
  children,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  editing?: InsumoRow | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tipo, setTipo] = useState("goma");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [estado, setEstado] = useState<"activo" | "inactivo">("activo");
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al abrir/cambiar editing
      setTipo(editing.tipo ?? "goma");
      setNombre(editing.nombre ?? "");
      setMarca(editing.marca ?? "");
      setPrecio(editing.precio ? String(editing.precio) : "");
      setEstado(editing.estado === "inactivo" ? "inactivo" : "activo");
      setObservaciones(editing.observaciones ?? "");
    } else {
      setTipo("goma");
      setNombre("");
      setMarca("");
      setPrecio("");
      setEstado("activo");
      setObservaciones("");
    }
    setError(null);
    setSuccess(null);
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombre.trim()) return setError("Escribí el nombre del insumo.");
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        tipo,
        nombre: nombre.trim(),
        marca: marca.trim() || null,
        precio: precio ? parseFloat(precio) : 0,
        estado,
        observaciones: observaciones.trim() || null,
      };
      const result = editing
        ? await updateInsumoAction(editing.id, payload)
        : await addInsumoAction(payload);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(editing ? "Cambios guardados" : "Insumo agregado");
        router.refresh();
        setTimeout(() => setOpen(false), 700);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); }}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">{editing ? "Editar insumo" : "Agregar insumo"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Insumo del catálogo (goma, lámpara, óptica, etc.) con su precio aproximado. Al cargar una rotura se elige de acá y el costo se trae solo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="space-y-2">
            <Label htmlFor="ins-nombre" className="text-sm font-medium text-foreground">
              Nombre <span className="text-red-400">*</span>
            </Label>
            <Input
              id="ins-nombre"
              placeholder="Ej: Goma dirección 295/80"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ins-tipo" className="text-sm font-medium text-foreground">Categoría</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "goma")}>
                <SelectTrigger id="ins-tipo" className="w-full">
                  <span>{TIPOS_ROTURA.find((t) => t.value === tipo)?.label ?? "Goma / cubierta"}</span>
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ROTURA.filter((t) => t.value !== "otro").map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-marca" className="text-sm font-medium text-foreground">
                Marca <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input id="ins-marca" placeholder="Michelin, Bazán…" value={marca} onChange={(e) => setMarca(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ins-precio" className="text-sm font-medium text-foreground">Precio $</Label>
              <Input id="ins-precio" type="number" min="0" step="any" placeholder="0" value={precio} onChange={(e) => setPrecio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-estado" className="text-sm font-medium text-foreground">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v === "inactivo" ? "inactivo" : "activo")}>
                <SelectTrigger id="ins-estado" className="w-full">
                  <span>{estado === "inactivo" ? "Inactivo" : "Activo"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ins-obs" className="text-sm font-medium text-foreground">
              Notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="ins-obs" placeholder="Medida, proveedor de referencia, etc." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          <DialogFooter className="pt-4 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
              {loading ? "Guardando..." : editing ? "Guardar cambios" : "Agregar insumo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
