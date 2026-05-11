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

export default function AddServiceDialog({ children, camiones }: { children: React.ReactNode, camiones: any[] }) {
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
          <DialogTitle className="text-[#0F172A] text-xl">Registrar Service</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos del mantenimiento realizado.
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
              <Label htmlFor="fecha" className="text-sm font-medium text-[#1E293B]">Fecha del service</Label>
              <Input id="fecha" type="date" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_service" className="text-sm font-medium text-[#1E293B]">Tipo de Service</Label>
            <Select defaultValue="mantenimiento">
              <SelectTrigger id="tipo_service" className="w-full">
                <SelectValue placeholder="Seleccionar tipo...">
                  {(value: string) => {
                    if (value === "mantenimiento") return "Mantenimiento Preventivo";
                    if (value === "reparacion") return "Reparación";
                    if (value === "cambio_aceite") return "Cambio de Aceite/Filtros";
                    if (value === "neumaticos") return "Neumáticos";
                    if (value === "otro") return "Otro";
                    return "Seleccionar tipo...";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mantenimiento">Mantenimiento Preventivo</SelectItem>
                <SelectItem value="reparacion">Reparación</SelectItem>
                <SelectItem value="cambio_aceite">Cambio de Aceite/Filtros</SelectItem>
                <SelectItem value="neumaticos">Neumáticos</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="odometro" className="text-sm font-medium text-[#1E293B]">Odómetro actual (Km)</Label>
              <Input id="odometro" type="number" placeholder="Ej: 150000" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proximo_service" className="text-sm font-medium text-[#1E293B]">Próximo service a los (Km)</Label>
              <Input id="proximo_service" type="number" placeholder="Ej: 160000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taller" className="text-sm font-medium text-[#1E293B]">Taller / Mecánico</Label>
              <Input id="taller" placeholder="Nombre del taller" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo" className="text-sm font-medium text-[#1E293B]">Costo Total ($)</Label>
              <Input id="costo" type="number" step="0.01" placeholder="Ej: 150000" required />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="detalles" className="text-sm font-medium text-[#1E293B]">Detalles / Observaciones</Label>
            <textarea 
              id="detalles" 
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none dark:bg-input/30"
              placeholder="Describí brevemente el trabajo realizado..."
            ></textarea>
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
              {loading ? "Guardando..." : "Registrar service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
