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
import { addIngresoAction, type CajaId } from "../actions";

const CATEGORIA_LABEL: Record<string, string> = {
  cobro_cliente: "Cobro a Cliente",
  rendicion_vuelto: "Rendición / Vuelto",
  transferencia_interna: "Transferencia Interna",
  ajuste: "Ajuste Positivo",
  otro: "Otro Ingreso",
};

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

export default function AddIngresoDialog({
  children,
  caja = "diaria",
}: {
  children: React.ReactNode;
  /** A qué caja va el ingreso: diaria (default) o grande (privada de dirección). */
  caja?: CajaId;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<"efectivo" | "transferencia" | "cheque" | "otro">("efectivo");
  const [categoria, setCategoria] = useState<"cobro_cliente" | "rendicion_vuelto" | "transferencia_interna" | "ajuste" | "otro">("cobro_cliente");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || isNaN(Number(monto))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await addIngresoAction({
        concepto,
        monto: parseFloat(monto),
        medio,
        categoria,
        fecha,
        caja,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setConcepto("");
        setMonto("");
        window.dispatchEvent(new CustomEvent("caja:refresh"));
        router.refresh();
      }
    } catch {
      setError("Error al registrar el ingreso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {caja === "grande" ? "Registrar Ingreso — Caja Grande" : "Registrar Ingreso de Caja"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {caja === "grande"
              ? "Ingresá los detalles del dinero entrante a la caja grande."
              : "Ingresá los detalles del dinero entrante a la caja general."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ing-concepto" className="text-sm font-medium text-foreground">Concepto / Descripción</Label>
            <Input
              id="ing-concepto"
              placeholder="Ej: Rendición de vuelto, aporte, ajuste..."
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ing-monto" className="text-sm font-medium text-foreground">Monto ($)</Label>
              <Input 
                id="ing-monto" 
                type="number" 
                step="0.01"
                placeholder="0.00" 
                required 
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-fecha" className="text-sm font-medium text-foreground">Fecha</Label>
              <Input 
                id="ing-fecha" 
                type="date" 
                required 
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ing-categoria" className="text-sm font-medium text-foreground">Categoría</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as typeof categoria)}>
                <SelectTrigger id="ing-categoria" className="w-full">
                  <SelectValue placeholder="Categoría">
                    {(value: unknown) => CATEGORIA_LABEL[value as string] ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cobro_cliente">Cobro a Cliente</SelectItem>
                  <SelectItem value="rendicion_vuelto">Rendición / Vuelto</SelectItem>
                  <SelectItem value="transferencia_interna">Transferencia Interna</SelectItem>
                  <SelectItem value="ajuste">Ajuste Positivo</SelectItem>
                  <SelectItem value="otro">Otro Ingreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ing-medio" className="text-sm font-medium text-foreground">Medio de cobro</Label>
              <Select value={medio} onValueChange={(v) => setMedio(v as typeof medio)}>
                <SelectTrigger id="ing-medio" className="w-full">
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
              {loading ? "Registrando..." : "Confirmar Ingreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
