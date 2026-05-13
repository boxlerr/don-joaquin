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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createChequeAction, type ChequeTipo } from "../actions";

const TIPO_LABEL: Record<ChequeTipo, string> = {
  comun: "Común",
  diferido: "Diferido",
  electronico: "Electrónico (Echeq)",
};

type BancoOption = { id: string; nombre: string };
type ClienteOption = { id: string; razon_social: string };

export default function AddChequeDialog({
  children,
  bancos,
  clientes,
}: {
  children: React.ReactNode;
  bancos: BancoOption[];
  clientes: ClienteOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const [numero, setNumero] = useState("");
  const [bancoId, setBancoId] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [cuentaCorriente, setCuentaCorriente] = useState("");
  const [libradorNombre, setLibradorNombre] = useState("");
  const [libradorCuit, setLibradorCuit] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [recibidoDe, setRecibidoDe] = useState("");
  const [tipo, setTipo] = useState<ChequeTipo>("comun");
  const [importe, setImporte] = useState("");
  const [fechaEmision, setFechaEmision] = useState(today);
  const [fechaVencimiento, setFechaVencimiento] = useState(today);
  const [fechaRecepcion, setFechaRecepcion] = useState(today);
  const [concepto, setConcepto] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const resetForm = () => {
    setNumero("");
    setBancoId("");
    setSucursal("");
    setCuentaCorriente("");
    setLibradorNombre("");
    setLibradorCuit("");
    setClienteId("");
    setRecibidoDe("");
    setTipo("comun");
    setImporte("");
    setFechaEmision(today);
    setFechaVencimiento(today);
    setFechaRecepcion(today);
    setConcepto("");
    setObservaciones("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importe || isNaN(Number(importe))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createChequeAction({
        numero,
        banco_id: bancoId,
        sucursal_banco: sucursal || null,
        cuenta_corriente: cuentaCorriente || null,
        librador_nombre: libradorNombre,
        librador_cuit: libradorCuit || null,
        cliente_id: clienteId || null,
        recibido_de: recibidoDe || null,
        tipo,
        importe: parseFloat(importe),
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        fecha_recepcion: fechaRecepcion,
        concepto: concepto || null,
        observaciones: observaciones || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch {
      setError("Error al registrar el cheque.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Registrar Cheque</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Ingresá los datos del cheque recibido. Quedará registrado en cartera.
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
              <Label htmlFor="ch-numero" className="text-sm font-medium text-[#1E293B]">
                Número de cheque <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-numero"
                placeholder="Ej: 00012345"
                required
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-tipo" className="text-sm font-medium text-[#1E293B]">
                Tipo
              </Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ChequeTipo)}>
                <SelectTrigger id="ch-tipo" className="w-full">
                  <SelectValue placeholder="Tipo">
                    {(value: unknown) => TIPO_LABEL[value as ChequeTipo] ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comun">Común</SelectItem>
                  <SelectItem value="diferido">Diferido</SelectItem>
                  <SelectItem value="electronico">Electrónico (Echeq)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ch-banco" className="text-sm font-medium text-[#1E293B]">
                Banco <span className="text-red-500">*</span>
              </Label>
              <Select value={bancoId} onValueChange={(v) => setBancoId(v ?? "")}>
                <SelectTrigger id="ch-banco" className="w-full">
                  <SelectValue placeholder="Seleccionar banco">
                    {(value: unknown) =>
                      bancos.find((b) => b.id === value)?.nombre ?? null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-sucursal" className="text-sm font-medium text-[#1E293B]">
                Sucursal
              </Label>
              <Input
                id="ch-sucursal"
                placeholder="Ej: 045 - Centro"
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ch-cuenta" className="text-sm font-medium text-[#1E293B]">
                Cuenta corriente
              </Label>
              <Input
                id="ch-cuenta"
                placeholder="Nº de cuenta"
                value={cuentaCorriente}
                onChange={(e) => setCuentaCorriente(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-importe" className="text-sm font-medium text-[#1E293B]">
                Importe ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-importe"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ch-librador" className="text-sm font-medium text-[#1E293B]">
                Librador (nombre) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-librador"
                placeholder="Nombre / razón social del librador"
                required
                value={libradorNombre}
                onChange={(e) => setLibradorNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-cuit" className="text-sm font-medium text-[#1E293B]">
                CUIT del librador
              </Label>
              <Input
                id="ch-cuit"
                placeholder="20-12345678-9"
                value={libradorCuit}
                onChange={(e) => setLibradorCuit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ch-cliente" className="text-sm font-medium text-[#1E293B]">
                Cliente vinculado
              </Label>
              <Select value={clienteId} onValueChange={(v) => setClienteId(v ?? "")}>
                <SelectTrigger id="ch-cliente" className="w-full">
                  <SelectValue placeholder="Sin cliente">
                    {(value: unknown) => {
                      if (!value) return null;
                      return clientes.find((c) => c.id === value)?.razon_social ?? null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cliente</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razon_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-recibido" className="text-sm font-medium text-[#1E293B]">
                Recibido de
              </Label>
              <Input
                id="ch-recibido"
                placeholder="Persona o entidad (si no es cliente)"
                value={recibidoDe}
                onChange={(e) => setRecibidoDe(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ch-emision" className="text-sm font-medium text-[#1E293B]">
                Fecha emisión <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-emision"
                type="date"
                required
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-vencimiento" className="text-sm font-medium text-[#1E293B]">
                Fecha vencimiento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-vencimiento"
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-recepcion" className="text-sm font-medium text-[#1E293B]">
                Fecha recepción <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ch-recepcion"
                type="date"
                required
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-concepto" className="text-sm font-medium text-[#1E293B]">
              Concepto
            </Label>
            <Input
              id="ch-concepto"
              placeholder="Ej: Pago factura A-0001-00012345"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-observaciones" className="text-sm font-medium text-[#1E293B]">
              Observaciones
            </Label>
            <Input
              id="ch-observaciones"
              placeholder="Notas internas (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
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
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Registrando..." : "Confirmar cheque"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
