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
import { addChoferAction } from "../actions";

export default function AddChoferDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [estado, setEstado] = useState<"activo" | "inactivo">("activo");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await addChoferAction({
        nombre,
        apellido,
        dni,
        estado,
        telefono,
        localidad,
        fecha_ingreso: fechaIngreso,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        // Reset form
        setNombre("");
        setApellido("");
        setDni("");
        setEstado("activo");
        setTelefono("");
        setLocalidad("");
      }
    } catch {
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
          <DialogTitle className="text-[#0F172A] text-xl">Agregar nuevo chofer</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos personales y de contacto del chofer.
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
              <Label htmlFor="nombre" className="text-sm font-medium text-[#1E293B]">Nombre</Label>
              <Input 
                id="nombre" 
                placeholder="Ej: Juan" 
                required 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido" className="text-sm font-medium text-[#1E293B]">Apellido</Label>
              <Input 
                id="apellido" 
                placeholder="Ej: Pérez" 
                required 
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dni" className="text-sm font-medium text-[#1E293B]">DNI</Label>
              <Input 
                id="dni" 
                placeholder="Ej: 12345678" 
                required 
                value={dni}
                onChange={(e) => setDni(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-sm font-medium text-[#1E293B]">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado((v ?? "activo") as any)}>
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono" className="text-sm font-medium text-[#1E293B]">Teléfono</Label>
              <Input 
                id="telefono" 
                placeholder="Ej: +54 9 11 ..." 
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localidad" className="text-sm font-medium text-[#1E293B]">Localidad</Label>
              <Input 
                id="localidad" 
                placeholder="Ej: Arrecifes" 
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha_ingreso" className="text-sm font-medium text-[#1E293B]">Fecha de ingreso</Label>
            <Input 
              id="fecha_ingreso" 
              type="date" 
              required 
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
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
              {loading ? "Guardando..." : "Guardar chofer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
