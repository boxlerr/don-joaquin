"use client";

import { useEffect, useMemo, useState } from "react";
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
  addServiceAction,
  updateServiceAction,
  getUltimoKmCamionAction,
  type TipoServicio,
} from "../actions";
import type { Camion } from "../types";

export type ServiceEditing = {
  id: string;
  fecha: string;
  tipo_servicio_id: string | null;
  km_odometro: number;
  proximo_service_km?: number | null;
  taller?: string | null;
  costo?: number | null;
  descripcion: string;
  observaciones?: string | null;
};

type FieldErrors = {
  km?: string;
  proximoKm?: string;
  costo?: string;
};

export default function AddServiceDialog({
  children,
  camiones,
  tiposServicio,
  defaultCamionId,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSaved,
}: {
  children?: React.ReactNode;
  camiones: Camion[];
  tiposServicio: TipoServicio[];
  defaultCamionId?: string;
  editing?: ServiceEditing | null;
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
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [tipoServicioId, setTipoServicioId] = useState<string>("");
  const [km, setKm] = useState("");
  const [kmPlaceholder, setKmPlaceholder] = useState("Ej: 150000");
  const [proximoKm, setProximoKm] = useState("");
  const [taller, setTaller] = useState("");
  const [costo, setCosto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  // Filtrar opciones según tercerización del camión seleccionado.
  // Scania (tercerizado) → solo gomería/cubiertas/otro (los marcados aplica_a_tercerizado).
  // Interno / en transición → todos los tipos activos.
  const camionSeleccionado = useMemo(
    () => camiones.find((c) => c.id === camionId) ?? null,
    [camiones, camionId]
  );

  const tiposVisibles = useMemo(() => {
    if (camionSeleccionado?.tercerizacion_estado === "tercerizado") {
      return tiposServicio.filter((t) => t.aplica_a_tercerizado);
    }
    return tiposServicio;
  }, [tiposServicio, camionSeleccionado]);

  // Si el camión cambia y el tipo elegido ya no aparece en la lista visible, resetear.
  useEffect(() => {
    if (tipoServicioId && !tiposVisibles.some((t) => t.id === tipoServicioId)) {
      setTipoServicioId("");
    }
  }, [tiposVisibles, tipoServicioId]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCamionId(defaultCamionId ?? "");
      setFecha(editing.fecha);
      setTipoServicioId(editing.tipo_servicio_id ?? "");
      setKm(String(editing.km_odometro));
      setProximoKm(editing.proximo_service_km != null ? String(editing.proximo_service_km) : "");
      setTaller(editing.taller ?? "");
      setCosto(editing.costo != null ? String(editing.costo) : "");
      setDescripcion(editing.descripcion === "Sin descripción" ? "" : editing.descripcion);
    } else {
      setCamionId(defaultCamionId ?? "");
      setFecha(new Date().toISOString().split("T")[0]);
      setTipoServicioId("");
      setKm("");
      setProximoKm("");
      setTaller("");
      setCosto("");
      setDescripcion("");
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
    const kmN = parseInt(km);
    if (!Number.isFinite(kmN) || kmN <= 0) e.km = "KM debe ser mayor a 0";
    if (proximoKm) {
      const pN = parseInt(proximoKm);
      if (!Number.isFinite(pN) || pN <= 0) e.proximoKm = "KM inválido";
      else if (Number.isFinite(kmN) && pN <= kmN) e.proximoKm = "Debe ser mayor al actual";
    }
    if (costo) {
      const c = parseFloat(costo);
      if (!Number.isFinite(c) || c < 0) e.costo = "Costo inválido";
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!tipoServicioId) {
      setError("Elegí un tipo de servicio.");
      return;
    }
    if (!editing && !camionId) {
      setError("Elegí un camión.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        fecha,
        tipo_servicio_id: tipoServicioId,
        km_odometro: parseInt(km),
        proximo_service_km: proximoKm ? parseInt(proximoKm) : undefined,
        taller,
        costo: costo ? parseFloat(costo) : undefined,
        descripcion: descripcion || "Sin descripción",
      };

      const result = editing
        ? await updateServiceAction(editing.id, payload)
        : await addServiceAction({ camion_id: camionId, ...payload });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(editing ? "Cambios guardados" : "Service registrado");
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {editing ? "Editar service" : "Registrar service"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {editing ? "Actualizá los datos del mantenimiento." : "Ingresá los datos del mantenimiento realizado."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-2 gap-4">
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="camion" className="text-sm font-medium text-foreground">Camión</Label>
                <Select value={camionId} onValueChange={(v) => setCamionId(v ?? "")}>
                  <SelectTrigger id="camion" className="w-full">
                    <SelectValue placeholder="Seleccionar camión...">
                      {(value) => {
                        const c = camiones.find((cam) => cam.id === value);
                        return c ? `${c.patente} - ${c.marca} ${c.modelo}` : "Seleccionar camión...";
                      }}
                    </SelectValue>
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
              <Label htmlFor="fecha" className="text-sm font-medium text-foreground">Fecha del service</Label>
              <Input
                id="fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_service" className="text-sm font-medium text-foreground">
                Tipo de Service
                {camionSeleccionado?.tercerizacion_estado === "tercerizado" && (
                  <span className="ml-2 text-xs font-normal text-amber-600">
                    (Camión tercerizado: solo gomería/cubiertas)
                  </span>
                )}
                {camionSeleccionado?.tercerizacion_estado === "en_transicion" && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    En transición
                  </span>
                )}
              </Label>
              <Select
                value={tipoServicioId}
                onValueChange={(v) => setTipoServicioId(v ?? "")}
              >
                <SelectTrigger id="tipo_service" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo...">
                    {(value) => {
                      const t = tiposServicio.find((tipo) => tipo.id === value);
                      return t ? t.nombre : "Seleccionar tipo...";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tiposVisibles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="proximo_km" className="text-sm font-medium text-foreground">Próximo Service (KM)</Label>
              <Input
                id="proximo_km"
                type="number"
                placeholder="Ej: 160000"
                value={proximoKm}
                onChange={(e) => setProximoKm(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("proximoKm")}
              />
              {errors.proximoKm && <p className="text-xs text-red-600">{errors.proximoKm}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo" className="text-sm font-medium text-foreground">Costo Total ($)</Label>
              <Input
                id="costo"
                type="number"
                placeholder="Ej: 150000"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("costo")}
              />
              {errors.costo && <p className="text-xs text-red-600">{errors.costo}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taller" className="text-sm font-medium text-foreground">Taller / Mecánico</Label>
            <Input
              id="taller"
              placeholder="Nombre del taller"
              value={taller}
              onChange={(e) => setTaller(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-sm font-medium text-foreground">Detalles / Observaciones</Label>
            <textarea
              id="descripcion"
              className="flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088D1] disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describí brevemente el trabajo realizado..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
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
              {loading ? "Guardando..." : editing ? "Guardar cambios" : "Registrar service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
