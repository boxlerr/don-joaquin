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
import { addEgresoAction } from "../actions";

const CATEGORIA_LABEL: Record<string, string> = {
  gasto_operativo: "Gasto Operativo",
  pago_proveedor: "Pago a Proveedor",
  pago_chofer: "Pago a Chofer",
  transferencia_interna: "Transferencia Interna",
  ajuste: "Ajuste Negativo",
  otro: "Otro Egreso",
};

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

export default function AddEgresoDialog({
  children,
  tiposGasto,
}: {
  children: React.ReactNode;
  tiposGasto?: { id: string; nombre: string; categoria: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<"efectivo" | "transferencia" | "cheque" | "otro">("efectivo");
  const [categoria, setCategoria] = useState<"gasto_operativo" | "pago_proveedor" | "pago_chofer" | "transferencia_interna" | "ajuste" | "otro">("gasto_operativo");
  const [tipoGastoId, setTipoGastoId] = useState<string>("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || isNaN(Number(monto))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await addEgresoAction({
        concepto,
        monto: parseFloat(monto),
        medio,
        categoria,
        tipo_gasto_id: tipoGastoId || null,
        fecha,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setConcepto("");
        setMonto("");
        setTipoGastoId("");
        window.dispatchEvent(new CustomEvent("caja:refresh"));
        router.refresh();
      }
    } catch {
      setError("Error al registrar el egreso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Registrar Egreso de Caja</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los detalles del dinero saliente de la caja general.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="egr-concepto" className="text-sm font-medium text-[#1E293B]">Concepto / Descripción</Label>
            <Input 
              id="egr-concepto" 
              placeholder="Ej: Compra de insumos de oficina..." 
              required 
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="egr-monto" className="text-sm font-medium text-[#1E293B]">Monto ($)</Label>
              <Input 
                id="egr-monto" 
                type="number" 
                step="0.01"
                placeholder="0.00" 
                required 
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="egr-fecha" className="text-sm font-medium text-[#1E293B]">Fecha</Label>
              <Input 
                id="egr-fecha" 
                type="date" 
                required 
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="egr-categoria" className="text-sm font-medium text-[#1E293B]">Categoría</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as any)}>
                <SelectTrigger id="egr-categoria" className="w-full">
                  <SelectValue placeholder="Categoría">
                    {(value: unknown) => CATEGORIA_LABEL[value as string] ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasto_operativo">Gasto Operativo</SelectItem>
                  <SelectItem value="pago_proveedor">Pago a Proveedor</SelectItem>
                  <SelectItem value="pago_chofer">Pago a Chofer</SelectItem>
                  <SelectItem value="transferencia_interna">Transferencia Interna</SelectItem>
                  <SelectItem value="ajuste">Ajuste Negativo</SelectItem>
                  <SelectItem value="otro">Otro Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="egr-medio" className="text-sm font-medium text-[#1E293B]">Medio de pago</Label>
              <Select value={medio} onValueChange={(v) => setMedio(v as any)}>
                <SelectTrigger id="egr-medio" className="w-full">
                  <SelectValue placeholder="Medio">
                    {(value: unknown) => MEDIO_LABEL[value as string] ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tiposGasto && tiposGasto.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="egr-tipogasto" className="text-sm font-medium text-[#1E293B]">Vincular a Tipo de Gasto (Opcional)</Label>
              <Select value={tipoGastoId} onValueChange={(v) => setTipoGastoId(v ?? "")}>
                <SelectTrigger id="egr-tipogasto" className="w-full">
                  <SelectValue placeholder="Ninguno / No asociar">
                    {(value: unknown) => {
                      if (!value) return null;
                      const t = tiposGasto?.find((t) => t.id === value);
                      if (!t) return null;
                      return `${t.categoria ? `${t.categoria.toUpperCase()} - ` : ""}${t.nombre}`;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguno / No asociar</SelectItem>
                  {tiposGasto.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.categoria ? `${t.categoria.toUpperCase()} - ` : ""}{t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              {loading ? "Registrando..." : "Confirmar Egreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
