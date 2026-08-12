"use client";

import { useMemo, useState } from "react";
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
import { useBorrador } from "@/hooks/useBorrador";
import { objetoCon } from "@/lib/borrador-local";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";

/** El ingreso en blanco, para completar contra él un borrador viejo. */
const vacioIngreso = (privado: boolean) => ({
  concepto: "",
  monto: "",
  medio: "efectivo" as "efectivo" | "transferencia" | "cheque" | "otro",
  categoria: "cobro_cliente" as
    | "cobro_cliente"
    | "rendicion_vuelto"
    | "transferencia_interna"
    | "ajuste"
    | "otro",
  fecha: "",
  privado,
});

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
  puedeMarcarPrivado = false,
  defaultPrivado = false,
}: {
  children: React.ReactNode;
  /** A qué caja va el ingreso: diaria (default) o grande (privada de dirección). */
  caja?: CajaId;
  /** Dirección (caja_saldo) decide si el movimiento se ve en la caja chica. */
  puedeMarcarPrivado?: boolean;
  /** Estado inicial del check: en la caja general arranca privado (solo general). */
  defaultPrivado?: boolean;
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
  // Visibilidad en la caja chica. El default depende de dónde se carga: en la
  // chica arranca visible; en la general, privado (solo dirección).
  const [privado, setPrivado] = useState(defaultPrivado);

  const valorBorrador = useMemo(
    () => ({ concepto, monto, medio, categoria, fecha, privado }),
    [concepto, monto, medio, categoria, fecha, privado],
  );

  // Mismo criterio que en el egreso: la caja general es confidencial y no deja
  // rastro en el navegador.
  const borrador = useBorrador({
    pantalla: "caja-ingreso",
    valor: valorBorrador,
    normalizar: objetoCon(vacioIngreso(defaultPrivado)),
    hayDatos: (v) => v.concepto.trim() !== "" || v.monto.trim() !== "",
    activo: open && caja !== "grande",
  });

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    setConcepto(b.concepto);
    setMonto(b.monto);
    setMedio(b.medio);
    setCategoria(b.categoria);
    setFecha(b.fecha);
    setPrivado(b.privado);
  };

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
        privado,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setConcepto("");
        setMonto("");
        setPrivado(defaultPrivado);
        // El ingreso ya entró: recién ahora el borrador sobra.
        borrador.limpiar();
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
          {borrador.pendiente && (
            <AvisoBorrador
              ts={borrador.pendiente.ts}
              onRecuperar={recuperarBorrador}
              onDescartar={borrador.descartar}
            />
          )}

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* Solo dirección decide si el movimiento se ve en la caja chica. */}
          {puedeMarcarPrivado && (
            <label
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                privado ? "border-[#0088D1] bg-[#E1F5FE]" : "border-border hover:border-[#CBD5E1]"
              }`}
            >
              <input
                type="checkbox"
                checked={privado}
                onChange={(e) => setPrivado(e.target.checked)}
                className="size-4 accent-[#0088D1] mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Movimiento privado
                </span>
                <span className="block text-xs text-muted-foreground">
                  {privado
                    ? "Solo se ve en la caja general."
                    : "Se ve en la caja chica y en la general."}
                </span>
              </span>
            </label>
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
              {loading ? "Registrando..." : "Confirmar Ingreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
