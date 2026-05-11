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
import { addCamionAction } from "../actions";

export default function AddCamionDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [patente, setPatente] = useState("");
  const [estado, setEstado] = useState("activo");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [tipo, setTipo] = useState("otro");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await addCamionAction({
        patente,
        marca,
        modelo,
        ano: parseInt(ano),
        capacidad_tn: parseFloat(capacidad),
        tipo_camion: tipo as any,
        estado: estado as any,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        // Reset form
        setPatente("");
        setEstado("activo");
        setMarca("");
        setModelo("");
        setAno("");
        setCapacidad("");
        setTipo("otro");
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Agregar nuevo camión</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos del vehículo para registrarlo en la flota.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patente" className="text-sm font-medium text-[#1E293B]">Patente</Label>
              <Input 
                id="patente" 
                placeholder="Ej: AB 123 CD" 
                required 
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-sm font-medium text-[#1E293B]">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v ?? "activo")}>
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue placeholder="Seleccionar estado">
                    {(value: string) => {
                      if (value === "activo") return "Activo";
                      if (value === "en_mantenimiento") return "En Mantenimiento";
                      if (value === "inactivo") return "Inactivo";
                      if (value === "baja") return "Baja";
                      return "Seleccionar estado";
                    }}
                  </SelectValue>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelo" className="text-sm font-medium text-[#1E293B]">Modelo</Label>
              <Input 
                id="modelo" 
                placeholder="Ej: Actros 2548" 
                required 
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
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
              />
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium text-[#1E293B]">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "otro")}>
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo">
                    {(value: string) => {
                      if (value === "tractor") return "Tractor";
                      if (value === "chasis_rigido") return "Chasis Rígido";
                      if (value === "batea") return "Batea";
                      if (value === "otro") return "Otro";
                      return "Seleccionar tipo";
                    }}
                  </SelectValue>
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
