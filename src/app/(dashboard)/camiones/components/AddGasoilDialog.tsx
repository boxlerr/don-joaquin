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
import { addGasoilAction } from "../actions";

export default function AddGasoilDialog({ 
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
  const [litros, setLitros] = useState("");
  const [km, setKm] = useState("");
  const [importe, setImporte] = useState("");
  const [estacion, setEstacion] = useState("");
  const [tipo, setTipo] = useState("grado_2");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await addGasoilAction({
        camion_id: camionId,
        fecha,
        litros: parseFloat(litros),
        km_odometro: parseInt(km),
        importe_total: parseFloat(importe),
        estacion,
        observaciones: `Tipo de combustible: ${tipo === "grado_2" ? "Grado 2" : "Grado 3"}`,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        // Reset form
        setCamionId("");
        setLitros("");
        setKm("");
        setImporte("");
        setEstacion("");
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
          <DialogTitle className="text-[#0F172A] text-xl">Cargar Gasoil</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Registrá una nueva carga de combustible.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="camion" className="text-sm font-medium text-[#1E293B]">Camión</Label>
            <Select value={camionId} onValueChange={(v) => setCamionId(v ?? "")}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-[#1E293B]">Fecha</Label>
              <Input 
                id="fecha" 
                type="date" 
                required 
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
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
              <Label htmlFor="litros" className="text-sm font-medium text-[#1E293B]">Litros</Label>
              <Input 
                id="litros" 
                type="number" 
                step="0.01" 
                placeholder="Ej: 300.5" 
                required 
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importe" className="text-sm font-medium text-[#1E293B]">Importe Total ($)</Label>
              <Input 
                id="importe" 
                type="number" 
                placeholder="Ej: 120000" 
                required 
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-sm font-medium text-[#1E293B]">Tipo de combustible</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "grado_2")}>
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
            <div className="space-y-2">
              <Label htmlFor="estacion" className="text-sm font-medium text-[#1E293B]">Estación de Servicio</Label>
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
              {loading ? "Cargando..." : "Registrar carga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
