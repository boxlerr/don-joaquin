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
import { Combobox } from "@/components/ui/combobox";
import { addEgresoAction, type CajaId } from "../actions";
import CategoriaCajaField, { type CategoriaLibre } from "./CategoriaCajaField";
import { CATEGORIAS_POR_FLUJO, CATEGORIA_GASTO_LABEL, MEDIO_LABEL, textoCategoria } from "@/lib/caja-tipos";
import { useBorrador } from "@/hooks/useBorrador";
import { objetoCon } from "@/lib/borrador-local";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";

const CATEGORIA_INICIAL = CATEGORIAS_POR_FLUJO.egreso[0]!.label;

/** El egreso en blanco, para completar contra él un borrador viejo. */
const vacioEgreso = (privado: boolean) => ({
  concepto: "",
  monto: "",
  medio: "efectivo" as "efectivo" | "transferencia" | "cheque" | "otro",
  // Texto, no un código: la categoría se puede escribir.
  categoria: CATEGORIA_INICIAL,
  tipoGastoId: "",
  fecha: "",
  privado,
});

export default function AddEgresoDialog({
  children,
  tiposGasto,
  categoriasLibres = [],
  caja = "diaria",
  puedeMarcarPrivado = false,
  defaultPrivado = false,
}: {
  children: React.ReactNode;
  tiposGasto?: { id: string; nombre: string; categoria: string }[];
  /** Las categorías escritas a mano que ya se usaron, para ofrecerlas. */
  categoriasLibres?: CategoriaLibre[];
  /** De qué caja sale la plata: diaria (default) o grande (privada de dirección). */
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
  const [categoria, setCategoria] = useState(CATEGORIA_INICIAL);
  const [tipoGastoId, setTipoGastoId] = useState<string>("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  // Visibilidad en la caja chica. El default depende de dónde se carga: en la
  // chica arranca visible; en la general, privado (solo dirección).
  const [privado, setPrivado] = useState(defaultPrivado);

  const valorBorrador = useMemo(
    () => ({ concepto, monto, medio, categoria, tipoGastoId, fecha, privado }),
    [concepto, monto, medio, categoria, tipoGastoId, fecha, privado],
  );

  // La caja general NO deja borrador. Es una subsección confidencial de
  // dirección y esto se guarda en el navegador, sin cifrar: en una máquina
  // compartida, un importe de la caja grande no puede quedar ahí. La caja chica
  // sí, que es donde se carga a diario y donde duele perder lo tipeado.
  const borrador = useBorrador({
    pantalla: "caja-egreso",
    valor: valorBorrador,
    normalizar: objetoCon(vacioEgreso(defaultPrivado)),
    hayDatos: (v) => v.concepto.trim() !== "" || v.monto.trim() !== "",
    activo: open && caja !== "grande",
  });

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    setConcepto(b.concepto);
    setMonto(b.monto);
    setMedio(b.medio);
    // Un borrador viejo guardaba el código de la categoría ("cobro_cliente");
    // ahora el campo es texto. `textoCategoria` traduce lo viejo y deja pasar
    // lo nuevo tal cual.
    setCategoria(textoCategoria(b.categoria, null, "egreso"));
    setTipoGastoId(b.tipoGastoId);
    setFecha(b.fecha);
    setPrivado(b.privado);
  };

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
        caja,
        privado,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setConcepto("");
        setMonto("");
        setCategoria(CATEGORIA_INICIAL);
        setTipoGastoId("");
        setPrivado(defaultPrivado);
        // El egreso ya entró: recién ahora el borrador sobra.
        borrador.limpiar();
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
          <DialogTitle className="text-foreground text-xl">
            {caja === "grande" ? "Registrar Egreso — Caja Grande" : "Registrar Egreso de Caja"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {caja === "grande"
              ? "Ingresá los detalles del dinero saliente de la caja grande."
              : "Ingresá los detalles del dinero saliente de la caja general."}
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
            <Label htmlFor="egr-concepto" className="text-sm font-medium text-foreground">Concepto / Descripción</Label>
            <Input 
              id="egr-concepto" 
              placeholder="Ej: Compra de insumos de oficina..." 
              required 
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="egr-monto" className="text-sm font-medium text-foreground">Monto ($)</Label>
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
              <Label htmlFor="egr-fecha" className="text-sm font-medium text-foreground">Fecha</Label>
              <Input 
                id="egr-fecha" 
                type="date" 
                required 
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CategoriaCajaField
              id="egr-categoria"
              flujo="egreso"
              value={categoria}
              onValueChange={setCategoria}
              sugerencias={categoriasLibres}
            />
            <div className="space-y-2">
              <Label htmlFor="egr-medio" className="text-sm font-medium text-foreground">Medio de pago</Label>
              <Select value={medio} onValueChange={(v) => setMedio(v as typeof medio)}>
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
              <Label htmlFor="egr-tipogasto" className="text-sm font-medium text-foreground">
                Tipo de gasto (opcional)
              </Label>
              {/* Buscable y con el rubro a la derecha en vez de pegado adelante
                  en mayúsculas ("OPERATIVO_VIAJE - Alimentación"): con doce
                  opciones, escribir "cub" tiene que alcanzar. Elegir uno además
                  registra el gasto, que es lo que hace que el movimiento después
                  lleve a Mantenimiento o a Combustible. */}
              <Combobox
                id="egr-tipogasto"
                value={tipoGastoId}
                onValueChange={(v) => setTipoGastoId(v ?? "")}
                options={tiposGasto.map((t) => ({
                  id: t.id,
                  label: t.nombre,
                  note: CATEGORIA_GASTO_LABEL[t.categoria] ?? t.categoria,
                }))}
                placeholder="Sin asociar a ningún gasto"
                searchPlaceholder="Buscar tipo de gasto..."
                clearable
              />
            </div>
          )}

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
              {loading ? "Registrando..." : "Confirmar Egreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
