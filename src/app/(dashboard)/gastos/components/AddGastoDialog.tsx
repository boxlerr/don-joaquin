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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Lock } from "lucide-react";
import { addGastoAction, type GastoMedioPago } from "../actions";

const MEDIO_PAGO_OPTIONS: { value: GastoMedioPago; label: string; hint: string }[] = [
  { value: "efectivo_caja", label: "Efectivo (caja)", hint: "Sale de caja" },
  { value: "transferencia", label: "Transferencia", hint: "Sale de caja" },
  { value: "tarjeta_empresa", label: "Tarjeta empresa", hint: "Sale de caja" },
  { value: "cuenta_corriente", label: "Cuenta corriente", hint: "Pago diferido" },
];

export type TipoGastoOption = { id: string; nombre: string; categoria: string | null };
export type ViajeOption = { id: string; codigo: string; fecha_viaje?: string | null };
export type CamionOption = { id: string; patente: string };
export type ChoferOption = { id: string; nombre: string; apellido: string };

interface Props {
  children: React.ReactNode;
  tiposGasto: TipoGastoOption[];
  viajes: ViajeOption[];
  camiones: CamionOption[];
  choferes: ChoferOption[];
  /** Pre-rellena y bloquea el viaje (carga contextual desde /viajes). */
  contextViajeId?: string;
  /** Pre-rellena y bloquea el camión (carga contextual desde /camiones). */
  contextCamionId?: string;
  /** Pre-rellena y bloquea el chofer (carga contextual desde /choferes). */
  contextChoferId?: string;
  onSuccess?: () => void;
}

export default function AddGastoDialog({
  children,
  tiposGasto,
  viajes,
  camiones,
  choferes,
  contextViajeId,
  contextCamionId,
  contextChoferId,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipoGastoId, setTipoGastoId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState<GastoMedioPago>("efectivo_caja");
  const [descripcion, setDescripcion] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [viajeId, setViajeId] = useState(contextViajeId ?? "");
  const [camionId, setCamionId] = useState(contextCamionId ?? "");
  const [choferId, setChoferId] = useState(contextChoferId ?? "");

  const reset = () => {
    setTipoGastoId("");
    setMonto("");
    setDescripcion("");
    setProveedor("");
    setNumeroComprobante("");
    setMedioPago("efectivo_caja");
    setFecha(new Date().toISOString().split("T")[0]);
    setViajeId(contextViajeId ?? "");
    setCamionId(contextCamionId ?? "");
    setChoferId(contextChoferId ?? "");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!monto || !Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    if (!tipoGastoId) {
      setError("Seleccioná un tipo de gasto.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await addGastoAction({
        tipo_gasto_id: tipoGastoId,
        fecha,
        monto: montoNum,
        medio_pago: medioPago,
        descripcion: descripcion || undefined,
        proveedor: proveedor || undefined,
        numero_comprobante: numeroComprobante || undefined,
        viaje_id: viajeId || null,
        camion_id: camionId || null,
        chofer_id: choferId || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        reset();
        window.dispatchEvent(new CustomEvent("gastos:refresh"));
        onSuccess?.();
        router.refresh();
      }
    } catch {
      setError("Error al registrar el gasto.");
    } finally {
      setLoading(false);
    }
  };

  const tiposPorCategoria = tiposGasto.reduce<Record<string, TipoGastoOption[]>>((acc, t) => {
    const key = t.categoria ?? "otros";
    (acc[key] = acc[key] ?? []).push(t);
    return acc;
  }, {});

  const viajeLocked = Boolean(contextViajeId);
  const camionLocked = Boolean(contextCamionId);
  const choferLocked = Boolean(contextChoferId);

  const contextLabel =
    viajeLocked && viajes.find((v) => v.id === contextViajeId)?.codigo
      ? `Viaje ${viajes.find((v) => v.id === contextViajeId)?.codigo}`
      : camionLocked && camiones.find((c) => c.id === contextCamionId)?.patente
      ? `Camión ${camiones.find((c) => c.id === contextCamionId)?.patente}`
      : choferLocked && choferes.find((c) => c.id === contextChoferId)
      ? (() => {
          const c = choferes.find((c) => c.id === contextChoferId)!;
          return `Chofer ${c.apellido}, ${c.nombre}`;
        })()
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">Registrar Gasto</DialogTitle>
          <DialogDescription className="text-[#475569]">
            Asocialo a un viaje, camión o chofer para mantener trazabilidad.
          </DialogDescription>
        </DialogHeader>

        {contextLabel && (
          <div className="flex items-center gap-2 px-3 py-2 -mt-1 rounded-md bg-[#E1F5FE]/50 border border-[#B3E5FC] text-[#004A99] text-xs font-medium">
            <Lock size={12} />
            Vinculado a: <span className="font-semibold">{contextLabel}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="g-tipo" className="text-sm font-medium text-[#1E293B]">
              Tipo de gasto <span className="text-red-500">*</span>
            </Label>
            <Select value={tipoGastoId} onValueChange={(v) => setTipoGastoId(v ?? "")}>
              <SelectTrigger id="g-tipo" className="w-full">
                <SelectValue placeholder="Seleccioná un tipo">
                  {(value: unknown) => {
                    const t = tiposGasto.find((t) => t.id === value);
                    return t?.nombre ?? null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tiposPorCategoria).map(([cat, items]) => (
                  <SelectGroup key={cat}>
                    <SelectLabel>{cat.toUpperCase()}</SelectLabel>
                    {items.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="g-monto" className="text-sm font-medium text-[#1E293B]">
                Monto ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="g-monto"
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
              <Label htmlFor="g-fecha" className="text-sm font-medium text-[#1E293B]">
                Fecha <span className="text-red-500">*</span>
              </Label>
              <Input
                id="g-fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-medio" className="text-sm font-medium text-[#1E293B]">
              Medio de pago
            </Label>
            <Select value={medioPago} onValueChange={(v) => setMedioPago(v as GastoMedioPago)}>
              <SelectTrigger id="g-medio" className="w-full">
                <SelectValue>
                  {(value: unknown) =>
                    MEDIO_PAGO_OPTIONS.find((o) => o.value === value)?.label ?? null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MEDIO_PAGO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span>{o.label}</span>
                      <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide">
                        {o.hint}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="g-desc" className="text-sm font-medium text-[#1E293B]">
                Descripción
              </Label>
              <Input
                id="g-desc"
                placeholder="Ej: Carga de gasoil ruta 3..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-comp" className="text-sm font-medium text-[#1E293B]">
                N° comprobante
              </Label>
              <Input
                id="g-comp"
                placeholder="0001-00000123"
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-prov" className="text-sm font-medium text-[#1E293B]">
              Proveedor
            </Label>
            <Input
              id="g-prov"
              placeholder="Nombre del proveedor"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>

          <div className="border-t border-[#E2E8F0] pt-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Asignación
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="g-viaje" className="text-xs font-medium text-[#475569]">
                  Viaje
                </Label>
                <Select
                  value={viajeId || "__none__"}
                  onValueChange={(v) => setViajeId(v === "__none__" ? "" : v ?? "")}
                  disabled={viajeLocked}
                >
                  <SelectTrigger id="g-viaje" className="w-full">
                    <SelectValue placeholder="Sin asignar">
                      {(value: unknown) => {
                        if (!value || value === "__none__") return "Sin asignar";
                        const v = viajes.find((v) => v.id === value);
                        return v ? `${v.codigo}` : null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {viajes.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="g-camion" className="text-xs font-medium text-[#475569]">
                  Camión
                </Label>
                <Select
                  value={camionId || "__none__"}
                  onValueChange={(v) => setCamionId(v === "__none__" ? "" : v ?? "")}
                  disabled={camionLocked}
                >
                  <SelectTrigger id="g-camion" className="w-full">
                    <SelectValue placeholder="Sin asignar">
                      {(value: unknown) => {
                        if (!value || value === "__none__") return "Sin asignar";
                        const c = camiones.find((c) => c.id === value);
                        return c?.patente ?? null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {camiones.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.patente}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="g-chofer" className="text-xs font-medium text-[#475569]">
                  Chofer
                </Label>
                <Select
                  value={choferId || "__none__"}
                  onValueChange={(v) => setChoferId(v === "__none__" ? "" : v ?? "")}
                  disabled={choferLocked}
                >
                  <SelectTrigger id="g-chofer" className="w-full">
                    <SelectValue placeholder="Sin asignar">
                      {(value: unknown) => {
                        if (!value || value === "__none__") return "Sin asignar";
                        const c = choferes.find((c) => c.id === value);
                        return c ? `${c.apellido}, ${c.nombre}` : null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {choferes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.apellido}, {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Registrando..." : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
