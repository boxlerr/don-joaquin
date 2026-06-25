"use client";

import { useEffect, useState } from "react";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  addGasoilAction,
  updateGasoilAction,
  getUltimoKmCamionAction,
  getChoferesParaCargaAction,
} from "../actions";
import type { Camion } from "../types";

export type GasoilEditing = {
  id: string;
  fecha: string;
  litros: number;
  km_odometro: number;
  importe_total: number;
  chofer_id?: string | null;
  estacion?: string | null;
  observaciones?: string | null;
};

type ChoferOption = { id: string; nombre: string; apellido: string; disabled?: boolean; motivo?: string };

type FieldErrors = {
  litros?: string;
  km?: string;
  importe?: string;
};

export default function AddGasoilDialog({
  children,
  camiones,
  defaultCamionId,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSaved,
}: {
  children?: React.ReactNode;
  camiones: Camion[];
  defaultCamionId?: string;
  editing?: GasoilEditing | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [camionId, setCamionId] = useState(defaultCamionId ?? "");
  const [choferId, setChoferId] = useState<string>("");
  const [choferes, setChoferes] = useState<ChoferOption[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [litros, setLitros] = useState("");
  const [km, setKm] = useState("");
  const [kmPlaceholder, setKmPlaceholder] = useState("Ej: 150000");
  const [importe, setImporte] = useState("");
  const [estacion, setEstacion] = useState("");
  const [tipo, setTipo] = useState("grado_2");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    getChoferesParaCargaAction().then(setChoferes);
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setCamionId(defaultCamionId ?? "");
      setChoferId(editing.chofer_id ?? "");
      setFecha(editing.fecha);
      setLitros(String(editing.litros));
      setKm(String(editing.km_odometro));
      setImporte(String(editing.importe_total));
      setEstacion(editing.estacion ?? "");
      setTipo(editing.observaciones?.includes("Grado 3") ? "grado_3" : "grado_2");
    } else {
      setCamionId(defaultCamionId ?? "");
      setChoferId("");
      setFecha(new Date().toISOString().split("T")[0]);
      setLitros("");
      setKm("");
      setImporte("");
      setEstacion("");
      setTipo("grado_2");
      if (defaultCamionId) {
        getUltimoKmCamionAction(defaultCamionId).then((ultimo) => {
          if (ultimo != null) setKmPlaceholder(`Último: ${ultimo.toLocaleString("es-AR")} KM`);
          else setKmPlaceholder("Ej: 150000");
        });
      } else {
        setKmPlaceholder("Ej: 150000");
      }
    }
    setError(null);
    setSuccess(null);
    setErrors({});
  }, [open, editing, defaultCamionId]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    const litN = parseFloat(litros);
    if (!Number.isFinite(litN) || litN <= 0) e.litros = "Litros mayor a 0";
    const kmN = parseInt(km);
    if (!Number.isFinite(kmN) || kmN <= 0) e.km = "KM mayor a 0";
    const impN = parseFloat(importe);
    if (!Number.isFinite(impN) || impN <= 0) e.importe = "Importe mayor a 0";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        fecha,
        litros: parseFloat(litros),
        km_odometro: parseInt(km),
        importe_total: parseFloat(importe),
        chofer_id: choferId || null,
        estacion,
        observaciones: `Tipo de combustible: ${tipo === "grado_2" ? "Grado 2" : "Grado 3"}`,
      };

      const result = editing
        ? await updateGasoilAction(editing.id, payload)
        : await addGasoilAction({ camion_id: camionId, ...payload });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(editing ? "Cambios guardados" : "Carga registrada");
        onSaved?.();
        setTimeout(() => setOpen(false), 900);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const errClass = (key: keyof FieldErrors) => (errors[key] ? "border-red-300 focus-visible:ring-red-300" : "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {editing ? "Editar carga" : "Cargar Gasoil"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {editing ? "Actualizá los datos de la carga." : "Registrá una nueva carga de combustible."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          {!editing && (
            <div className="space-y-2">
              <Label htmlFor="camion" className="text-sm font-medium text-foreground">Camión</Label>
              <Select value={camionId} onValueChange={(v) => setCamionId(v ?? "")}>
                <SelectTrigger id="camion" className="w-full">
                  <SelectValue placeholder="Seleccionar camión..." />
                </SelectTrigger>
                <SelectContent>
                  {camiones.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.patente} - {c.marca} {c.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="chofer" className="text-sm font-medium text-foreground">
              Chofer <span className="text-muted-foreground font-normal">(opcional — habilita ranking)</span>
            </Label>
            <Select value={choferId || "__none__"} onValueChange={(v) => setChoferId(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger id="chofer" className="w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {choferes.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={c.disabled} title={c.motivo}>
                    {c.disabled ? "⚠ " : ""}{c.apellido}, {c.nombre}
                    {c.disabled ? " — legajo incompleto" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-foreground">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="km" className="text-sm font-medium text-foreground">KM Odómetro</Label>
              <Input
                id="km"
                type="number"
                placeholder={kmPlaceholder}
                required
                value={km}
                onChange={(e) => setKm(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("km")}
              />
              {errors.km && <p className="text-xs text-red-600">{errors.km}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="litros" className="text-sm font-medium text-foreground">Litros</Label>
              <Input
                id="litros"
                type="number"
                step="0.01"
                placeholder="Ej: 300.5"
                required
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("litros")}
              />
              {errors.litros && <p className="text-xs text-red-600">{errors.litros}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="importe" className="text-sm font-medium text-foreground">Importe Total ($)</Label>
              <Input
                id="importe"
                type="number"
                placeholder="Ej: 120000"
                required
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("importe")}
              />
              {errors.importe && <p className="text-xs text-red-600">{errors.importe}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium text-foreground">Tipo de combustible</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "grado_2")}>
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grado_2">Gasoil Grado 2 (Común)</SelectItem>
                  <SelectItem value="grado_3">Gasoil Grado 3 (Premium)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estacion" className="text-sm font-medium text-foreground">Estación de Servicio</Label>
              <Input
                id="estacion"
                placeholder="Ej: YPF Arrecifes"
                value={estacion}
                onChange={(e) => setEstacion(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t-transparent sm:justify-end gap-2 bg-transparent -mx-0 -mb-0 rounded-none pb-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="text-muted-foreground border-border hover:bg-muted/40"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white"
            >
              {loading ? "Guardando..." : editing ? "Guardar cambios" : "Registrar carga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
