"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { addViaticoAction } from "../actions";

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
};

export default function AddViaticoDialog({
  children,
  choferes,
}: {
  children: React.ReactNode;
  choferes?: { id: string; nombre: string; apellido: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [choferId, setChoferId] = useState<string>("");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [medioEntrega, setMedioEntrega] = useState<"efectivo" | "transferencia" | "otro">("efectivo");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choferId) {
      setError("Debes seleccionar un chofer.");
      return;
    }
    if (!monto || isNaN(Number(monto))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await addViaticoAction({
        chofer_id: choferId,
        concepto: concepto || "Adelanto para gastos de viaje",
        monto: parseFloat(monto),
        medio_entrega: medioEntrega,
        fecha,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setConcepto("");
        setMonto("");
        setChoferId("");
        window.dispatchEvent(new CustomEvent("caja:refresh"));
        router.refresh();
      }
    } catch {
      setError("Error al registrar el viático.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Registrar Entrega de Viático</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Entregá dinero a un chofer para cubrir gastos operativos de sus viajes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="viat-chofer" className="text-sm font-medium text-[#1E293B]">Chofer receptor</Label>
            <Select value={choferId} onValueChange={(v) => setChoferId(v ?? "")}>
              <SelectTrigger id="viat-chofer" className="w-full">
                <SelectValue placeholder="Seleccionar chofer...">
                  {(value: unknown) => {
                    const c = choferes?.find((c) => c.id === value);
                    return c ? `${c.apellido}, ${c.nombre}` : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {choferes && choferes.length > 0 ? (
                  choferes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.apellido}, {c.nombre}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>Sin choferes activos</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="viat-concepto" className="text-sm font-medium text-[#1E293B]">Motivo / Destino (Opcional)</Label>
            <Input 
              id="viat-concepto" 
              placeholder="Ej: Viaje a Rosario, peajes y comida..." 
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="viat-monto" className="text-sm font-medium text-[#1E293B]">Monto ($)</Label>
              <Input 
                id="viat-monto" 
                type="number" 
                step="0.01"
                placeholder="0.00" 
                required 
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viat-fecha" className="text-sm font-medium text-[#1E293B]">Fecha de entrega</Label>
              <Input 
                id="viat-fecha" 
                type="date" 
                required 
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="viat-medio" className="text-sm font-medium text-[#1E293B]">Medio de entrega</Label>
            <Select value={medioEntrega} onValueChange={(v) => setMedioEntrega(v as any)}>
              <SelectTrigger id="viat-medio" className="w-full">
                <SelectValue placeholder="Medio">
                  {(value: unknown) => MEDIO_LABEL[value as string] ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4 border-t-transparent sm:justify-end gap-2 bg-transparent -mx-0 -mb-0 rounded-none pb-0 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="brand" 
              disabled={loading}
            >
              {loading ? "Registrando..." : "Confirmar Viático"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
