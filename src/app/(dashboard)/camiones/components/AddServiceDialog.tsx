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
import { Textarea } from "@/components/ui/textarea"; // Assuming Textarea exists or I'll use textarea
import { addServiceAction } from "../actions";

export default function AddServiceDialog({ 
  children, 
  camiones 
}: { 
  children: React.ReactNode;
  camiones: any[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [camionId, setCamionId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [tipo, setTipo] = useState("service_preventivo");
  const [km, setKm] = useState("");
  const [proximoKm, setProximoKm] = useState("");
  const [taller, setTaller] = useState("");
  const [costo, setCosto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await addServiceAction({
        camion_id: camionId,
        fecha,
        tipo,
        km_odometro: parseInt(km),
        proximo_service_km: proximoKm ? parseInt(proximoKm) : undefined,
        taller,
        costo: costo ? parseFloat(costo) : undefined,
        descripcion: descripcion || "Sin descripción",
      });

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        // Reset form
        setCamionId("");
        setKm("");
        setProximoKm("");
        setTaller("");
        setCosto("");
        setDescripcion("");
      }
    } catch (err) {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Registrar Service</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos del mantenimiento realizado.
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
              <Label htmlFor="camion" className="text-sm font-medium text-[#1E293B]">Camión</Label>
              <Select value={camionId} onValueChange={setCamionId}>
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
                  {camiones.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.patente} - {c.marca} {c.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="tipo_service" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo...">
                    {(value: string) => {
                      if (value === "service_preventivo") return "Mantenimiento Preventivo";
                      if (value === "reparacion") return "Reparación";
                      if (value === "cambio_aceite") return "Cambio de Aceite/Filtros";
                      if (value === "cubiertas") return "Neumáticos";
                      if (value === "otro") return "Otro";
                      return "Seleccionar tipo...";
                    }}
                  </SelectValue>
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
                placeholder="Ej: 150000" 
                required 
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo" className="text-sm font-medium text-[#1E293B]">Costo Total ($)</Label>
              <Input 
                id="costo" 
                type="number" 
                placeholder="Ej: 150000" 
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
              />
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
              {loading ? "Registrando..." : "Registrar service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
