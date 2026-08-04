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
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { transferirEntreCajasAction } from "../actions";

type Direccion = "diaria_a_grande" | "grande_a_diaria";

/**
 * Transferencia entre la caja diaria y la caja grande (privada de dirección).
 * Genera el par egreso/ingreso con categoría transferencia_interna; el detalle
 * queda visible en cada caja según los permisos de quien mira.
 */
export default function TransferirCajaDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [direccion, setDireccion] = useState<Direccion>("diaria_a_grande");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [concepto, setConcepto] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto mayor a cero.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await transferirEntreCajasAction({
        direccion,
        monto: montoNum,
        fecha,
        concepto: concepto || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setMonto("");
        setConcepto("");
        window.dispatchEvent(new CustomEvent("caja:refresh"));
        router.refresh();
      }
    } catch {
      setError("Error al registrar la transferencia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Transferir entre cajas</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Mueve plata de una caja a la otra: queda un egreso en la de origen y un ingreso en la
            de destino, vinculados entre sí.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Toggle segmentado de dirección (sin selects nativos) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Dirección</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setDireccion("diaria_a_grande")}
                className={`flex-1 min-h-10 py-2 px-2 rounded-lg border text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
                  direccion === "diaria_a_grande"
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <ArrowUpRight size={14} />
                Diaria → Grande
              </button>
              <button
                type="button"
                onClick={() => setDireccion("grande_a_diaria")}
                className={`flex-1 min-h-10 py-2 px-2 rounded-lg border text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
                  direccion === "grande_a_diaria"
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <ArrowDownLeft size={14} />
                Grande → Diaria
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trf-monto" className="text-sm font-medium text-foreground">
                Monto ($)
              </Label>
              <Input
                id="trf-monto"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trf-fecha" className="text-sm font-medium text-foreground">
                Fecha
              </Label>
              <Input
                id="trf-fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trf-concepto" className="text-sm font-medium text-foreground">
              Concepto <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="trf-concepto"
              placeholder={
                direccion === "diaria_a_grande"
                  ? "Transferencia caja diaria → caja grande"
                  : "Transferencia caja grande → caja diaria"
              }
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-4 border-t-transparent sm:justify-end gap-2 bg-transparent -mx-0 -mb-0 rounded-none pb-0 mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Transfiriendo..." : "Confirmar transferencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
