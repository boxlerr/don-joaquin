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
import UnidadPicker, { type UnidadValue } from "./UnidadPicker";
import { addRoturaAction, updateRoturaAction, type RoturaRow } from "../actions";
import type { AcopladoOption, CamionOption, ChoferOption } from "../types";

export default function AddRoturaDialog({
  children,
  camiones,
  acoplados,
  choferes,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  camiones: CamionOption[];
  acoplados: AcopladoOption[];
  choferes: ChoferOption[];
  editing?: RoturaRow | null;
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

  const [choferId, setChoferId] = useState("");
  const [unidad, setUnidad] = useState<UnidadValue>("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("1");
  const [costo, setCosto] = useState("");
  const [posicion, setPosicion] = useState("");

  const choferSel = choferes.find((c) => c.id === choferId);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setChoferId(editing.chofer_id ?? "");
      setUnidad(editing.camion_id ? `c:${editing.camion_id}` : editing.acoplado_id ? `a:${editing.acoplado_id}` : "");
      setFecha(editing.fecha);
      setCantidad(String(editing.cantidad ?? 1));
      setCosto(editing.costo != null ? String(editing.costo) : "");
      setPosicion(editing.posicion ?? "");
    } else {
      setChoferId("");
      setUnidad("");
      setFecha(new Date().toISOString().split("T")[0]);
      setCantidad("1");
      setCosto("");
      setPosicion("");
    }
    setError(null);
    setSuccess(null);
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!choferId && !unidad) return setError("Elegí el chofer o la unidad (camión / acoplado).");
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let camion_id: string | null = null;
      let acoplado_id: string | null = null;
      if (unidad.startsWith("c:")) camion_id = unidad.slice(2);
      else if (unidad.startsWith("a:")) acoplado_id = unidad.slice(2);

      const payload = {
        chofer_id: choferId || null,
        camion_id,
        acoplado_id,
        fecha,
        cantidad: parseInt(cantidad) || 1,
        costo: costo ? parseFloat(costo) : null,
        posicion: posicion || null,
      };
      const result = editing
        ? await updateRoturaAction(editing.id, payload)
        : await addRoturaAction(payload);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(editing ? "Cambios guardados" : "Rotura registrada");
        router.refresh();
        setTimeout(() => setOpen(false), 800);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">{editing ? "Editar rotura de goma" : "Registrar rotura de goma"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            La unidad puede ser un camión (chasis) o un acoplado. Si cargás el chofer, suma a su productividad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="space-y-2">
            <Label htmlFor="chofer" className="text-sm font-medium text-foreground">
              Chofer <span className="text-muted-foreground font-normal">(suma a su productividad)</span>
            </Label>
            <Select value={choferId || "__none__"} onValueChange={(v) => setChoferId(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger id="chofer" className="w-full">
                <span className={choferSel ? "" : "text-muted-foreground"}>
                  {choferSel ? `${choferSel.apellido}, ${choferSel.nombre}` : "Sin asignar"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {choferes.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    disabled={c.disabled}
                    title={c.motivo}
                  >
                    {c.disabled ? "⚠ " : ""}{c.apellido}, {c.nombre}
                    {c.disabled ? " — legajo incompleto" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidad" className="text-sm font-medium text-foreground">
              Unidad <span className="text-muted-foreground font-normal">(camión o acoplado)</span>
            </Label>
            <UnidadPicker
              id="unidad"
              mode="ambos"
              value={unidad}
              onChange={setUnidad}
              camiones={camiones}
              acoplados={acoplados}
              placeholder="Buscar por patente, marca o modelo…"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-foreground">Fecha</Label>
              <Input id="fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidad" className="text-sm font-medium text-foreground">Cantidad</Label>
              <Input id="cantidad" type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo" className="text-sm font-medium text-foreground">Costo $</Label>
              <Input id="costo" type="number" placeholder="Opcional" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pos" className="text-sm font-medium text-foreground">
              Posición / notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="pos" placeholder="Ej: trasera izquierda" value={posicion} onChange={(e) => setPosicion(e.target.value)} />
          </div>

          <DialogFooter className="pt-4 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
              {loading ? "Guardando..." : editing ? "Guardar cambios" : "Registrar rotura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
