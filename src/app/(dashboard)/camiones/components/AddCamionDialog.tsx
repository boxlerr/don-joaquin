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

export default function AddCamionDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement the save logic with Supabase here
    setTimeout(() => {
      setLoading(false);
      setOpen(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Agregar nuevo camión</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos del vehículo para registrarlo en la flota.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patente" className="text-sm font-medium text-[#1E293B]">Patente</Label>
              <Input id="patente" placeholder="Ej: AB 123 CD" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-sm font-medium text-[#1E293B]">Estado</Label>
              <Select defaultValue="activo">
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue placeholder="Seleccionar estado">
                    {(value: string) => {
                      if (value === "activo") return "Activo";
                      if (value === "en_mantenimiento") return "En Mantenimiento";
                      if (value === "inactivo") return "Inactivo";
                      return "Seleccionar estado";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca" className="text-sm font-medium text-[#1E293B]">Marca</Label>
              <Input id="marca" placeholder="Ej: Mercedes Benz" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelo" className="text-sm font-medium text-[#1E293B]">Modelo</Label>
              <Input id="modelo" placeholder="Ej: Actros 2548" required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ano" className="text-sm font-medium text-[#1E293B]">Año</Label>
              <Input id="ano" type="number" placeholder="Ej: 2022" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacidad" className="text-sm font-medium text-[#1E293B]">Capacidad (TN)</Label>
              <Input id="capacidad" type="number" step="0.1" placeholder="Ej: 35.0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium text-[#1E293B]">Tipo</Label>
              <Input id="tipo" placeholder="Ej: Chasis" />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t-transparent sm:justify-end gap-2 bg-transparent -mx-0 -mb-0 rounded-none pb-0 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]"
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
