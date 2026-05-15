"use client";

import { useState } from "react";
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
import type { Database } from "@/types/database";
import { addCamionAction } from "../actions";

type CamionTipo = Database["public"]["Enums"]["camion_tipo"];
type CamionEstado = Database["public"]["Enums"]["camion_estado"];

const PATENTE_REGEX = /^[A-Z0-9\s-]{6,10}$/;
const CURRENT_YEAR = new Date().getFullYear();

type FieldErrors = {
  patente?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  capacidad?: string;
};

export default function AddCamionDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [patente, setPatente] = useState("");
  const [estado, setEstado] = useState<CamionEstado>("activo");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [tipo, setTipo] = useState<CamionTipo>("otro");
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!patente.trim()) e.patente = "Patente requerida";
    else if (!PATENTE_REGEX.test(patente.trim())) e.patente = "Formato inválido (ej: AB123CD)";
    if (!marca.trim()) e.marca = "Marca requerida";
    if (!modelo.trim()) e.modelo = "Modelo requerido";
    const anoN = parseInt(ano);
    if (!Number.isFinite(anoN)) e.ano = "Año requerido";
    else if (anoN < 1900 || anoN > CURRENT_YEAR + 1) e.ano = `Año entre 1900 y ${CURRENT_YEAR + 1}`;
    const capN = parseFloat(capacidad);
    if (!Number.isFinite(capN) || capN <= 0) e.capacidad = "Capacidad mayor a 0";
    return e;
  };

  const reset = () => {
    setPatente("");
    setEstado("activo");
    setMarca("");
    setModelo("");
    setAno("");
    setCapacidad("");
    setTipo("otro");
    setErrors({});
    setError(null);
    setSuccess(null);
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
      const result = await addCamionAction({
        patente: patente.trim().toUpperCase(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: parseInt(ano),
        capacidad_tn: parseFloat(capacidad),
        tipo_camion: tipo,
        estado,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Camión registrado");
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 900);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const errClass = (key: keyof FieldErrors) => (errors[key] ? "border-red-300 focus-visible:ring-red-300" : "");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Agregar nuevo camión</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos del vehículo para registrarlo en la flota.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patente" className="text-sm font-medium text-[#1E293B]">Patente</Label>
              <Input
                id="patente"
                placeholder="Ej: AB123CD"
                required
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
                onBlur={() => setErrors(validate())}
                className={errClass("patente")}
              />
              {errors.patente && <p className="text-xs text-red-600">{errors.patente}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-sm font-medium text-[#1E293B]">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado((v ?? "activo") as CamionEstado)}>
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca" className="text-sm font-medium text-[#1E293B]">Marca</Label>
              <Input
                id="marca"
                placeholder="Ej: Mercedes Benz"
                required
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("marca")}
              />
              {errors.marca && <p className="text-xs text-red-600">{errors.marca}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelo" className="text-sm font-medium text-[#1E293B]">Modelo</Label>
              <Input
                id="modelo"
                placeholder="Ej: Actros 2548"
                required
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("modelo")}
              />
              {errors.modelo && <p className="text-xs text-red-600">{errors.modelo}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ano" className="text-sm font-medium text-[#1E293B]">Año</Label>
              <Input
                id="ano"
                type="number"
                placeholder="Ej: 2022"
                required
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("ano")}
              />
              {errors.ano && <p className="text-xs text-red-600">{errors.ano}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacidad" className="text-sm font-medium text-[#1E293B]">Capacidad (TN)</Label>
              <Input
                id="capacidad"
                type="number"
                step="0.1"
                placeholder="Ej: 35.0"
                required
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                onBlur={() => setErrors(validate())}
                className={errClass("capacidad")}
              />
              {errors.capacidad && <p className="text-xs text-red-600">{errors.capacidad}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium text-[#1E293B]">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo((v ?? "otro") as CamionTipo)}>
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tractor">Tractor</SelectItem>
                  <SelectItem value="chasis_rigido">Chasis Rígido</SelectItem>
                  <SelectItem value="batea">Batea</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {loading ? "Guardando..." : "Guardar camión"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
