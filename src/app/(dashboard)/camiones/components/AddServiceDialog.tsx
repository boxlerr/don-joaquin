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
  addServiceAction,
  updateServiceAction,
  getUltimoKmCamionAction,
} from "../actions";
import type { Camion } from "../types";
import type { Database } from "@/types/database";

type MantenimientoTipo = Database["public"]["Enums"]["mantenimiento_tipo"];

export type ServiceEditing = {
  id: string;
  fecha: string;
  tipo: MantenimientoTipo;
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
  defaultCamionId,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSaved,
}: {
  children?: React.ReactNode;
  camiones: Camion[];
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
  const [tipo, setTipo] = useState<MantenimientoTipo>("service_preventivo");
  const [km, setKm] = useState("");
  const [kmPlaceholder, setKmPlaceholder] = useState("Ej: 150000");
  const [proximoKm, setProximoKm] = useState("");
  const [taller, setTaller] = useState("");
  const [costo, setCosto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCamionId(defaultCamionId ?? "");
      setFecha(editing.fecha);
      setTipo(editing.tipo);
      setKm(String(editing.km_odometro));
      setProximoKm(editing.proximo_service_km != null ? String(editing.proximo_service_km) : "");
      setTaller(editing.taller ?? "");
      setCosto(editing.costo != null ? String(editing.costo) : "");
      setDescripcion(editing.descripcion === "Sin descripción" ? "" : editing.descripcion);
    } else {
      setCamionId(defaultCamionId ?? "");
      setFecha(new Date().toISOString().split("T")[0]);
      setTipo("service_preventivo");
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
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        fecha,
        tipo,
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
          <DialogTitle className="text-[#0F172A] text-xl">
            {editing ? "Editar service" : "Registrar service"}
          </DialogTitle>
          <DialogDescription className="text-[#475569]">
            {editing ? "Actualizá los datos del mantenimiento." : "Ingresá los datos del mantenimiento realizado."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-2 gap-4">
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="camion" className="text-sm font-medium text-[#1E293B]">Camión</Label>
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
              <Label htmlFor="fecha" className="text-sm font-medium text-[#1E293B]">Fecha del service</Label>
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
              <Label htmlFor="tipo_service" className="text-sm font-medium text-[#1E293B]">Tipo de Service</Label>
              <Select value={tipo} onValueChange={(v) => setTipo((v ?? "service_preventivo") as MantenimientoTipo)}>
                <SelectTrigger id="tipo_service" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_preventivo">Mantenimiento Preventivo</SelectItem>
                  <SelectItem value="reparacion">Reparación</SelectItem>
                  <SelectItem value="cambio_aceite">Cambio de Aceite/Filtros</SelectItem>
                  <SelectItem value="cubiertas">Neumáticos</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="km" className="text-sm font-medium text-[#1E293B]">KM Odómetro</Label>
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
              <Label htmlFor="proximo_km" className="text-sm font-medium text-[#1E293B]">Próximo Service (KM)</Label>
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
              <Label htmlFor="costo" className="text-sm font-medium text-[#1E293B]">Costo Total ($)</Label>
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
            <Label htmlFor="taller" className="text-sm font-medium text-[#1E293B]">Taller / Mecánico</Label>
            <Input
              id="taller"
              placeholder="Nombre del taller"
              value={taller}
              onChange={(e) => setTaller(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-sm font-medium text-[#1E293B]">Detalles / Observaciones</Label>
            <textarea
              id="descripcion"
              className="flex min-h-[80px] w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088D1] disabled:cursor-not-allowed disabled:opacity-50"
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
              className="text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]"
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
