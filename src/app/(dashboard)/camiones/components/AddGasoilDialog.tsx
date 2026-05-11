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

export default function AddGasoilDialog({ children, camiones }: { children: React.ReactNode, camiones: any[] }) {
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
          <DialogTitle className="text-[#0F172A] text-xl">Cargar Gasoil</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Registrá la carga de combustible de una unidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="camion" className="text-sm font-medium text-[#1E293B]">Camión</Label>
              <Select>
                <SelectTrigger id="camion" className="w-full">
                  <SelectValue placeholder="Seleccionar camión...">
                    {(value: string) => {
                      if (!value) return "Seleccionar camión...";
                      const c = camiones.find((c: any) => c.id === value);
                      return c ? `${c.patente} - ${c.marca} ${c.modelo}` : "Seleccionar camión...";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {camiones.length === 0 ? (
                    <SelectItem value="none" disabled>No hay camiones</SelectItem>
                  ) : (
                    camiones.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.patente} - {c.marca} {c.modelo}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-[#1E293B]">Fecha de carga</Label>
              <Input id="fecha" type="date" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="litros" className="text-sm font-medium text-[#1E293B]">Litros cargados</Label>
              <Input id="litros" type="number" step="0.1" placeholder="Ej: 300" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importe" className="text-sm font-medium text-[#1E293B]">Importe Total ($)</Label>
              <Input id="importe" type="number" step="0.01" placeholder="Ej: 300000" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="odometro" className="text-sm font-medium text-[#1E293B]">Odómetro actual (Km)</Label>
              <Input id="odometro" type="number" placeholder="Ej: 150000" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium text-[#1E293B]">Tipo de combustible</Label>
              <Select defaultValue="grado_2">
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue placeholder="Seleccionar...">
                    {(value: string) => {
                      if (value === "grado_2") return "Gasoil Grado 2 (Común)";
                      if (value === "grado_3") return "Gasoil Grado 3 (Premium)";
                      return "Seleccionar...";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grado_2">Gasoil Grado 2 (Común)</SelectItem>
                  <SelectItem value="grado_3">Gasoil Grado 3 (Premium)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estacion" className="text-sm font-medium text-[#1E293B]">Estación de Servicio / Proveedor</Label>
            <Input id="estacion" placeholder="Ej: YPF R12" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="comprobante" className="text-sm font-medium text-[#1E293B]">N° de Comprobante / Ticket</Label>
            <Input id="comprobante" placeholder="Opcional" />
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
              {loading ? "Guardando..." : "Registrar carga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
