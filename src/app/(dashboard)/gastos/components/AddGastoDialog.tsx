"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Lock,
  Receipt,
  Tag,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  Store,
  MessageSquare,
  Navigation,
  Truck,
  User,
  Check,
  type LucideIcon,
} from "lucide-react";
import { addGastoAction, type GastoMedioPago } from "../actions";
import { useBorrador } from "@/hooks/useBorrador";
import { objetoCon } from "@/lib/borrador-local";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";

/** El gasto en blanco, para completar contra él un borrador viejo. */
const GASTO_VACIO = {
  tipoGastoId: "",
  fecha: "",
  monto: "",
  medioPago: "efectivo_caja" as GastoMedioPago,
  descripcion: "",
  proveedor: "",
  numeroComprobante: "",
};

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent font-medium hover:bg-transparent focus-visible:ring-0";

const MEDIO_PAGO_OPTIONS: { value: GastoMedioPago; label: string; hint: string }[] = [
  { value: "efectivo_caja", label: "Efectivo (caja)", hint: "Sale de caja" },
  { value: "transferencia", label: "Transferencia", hint: "Sale de caja" },
  { value: "tarjeta_empresa", label: "Tarjeta empresa", hint: "Sale de caja" },
  { value: "cuenta_corriente", label: "Cuenta corriente", hint: "Pago diferido" },
];

export type TipoGastoOption = { id: string; nombre: string; categoria: string | null };
export type ViajeOption = { id: string; codigo: string; fecha_viaje?: string | null };
export type CamionOption = { id: string; patente: string };
export type ChoferOption = { id: string; nombre: string; apellido: string; disabled?: boolean; motivo?: string };

interface Props {
  children: React.ReactNode;
  tiposGasto: TipoGastoOption[];
  viajes: ViajeOption[];
  camiones: CamionOption[];
  choferes: ChoferOption[];
  contextViajeId?: string;
  contextCamionId?: string;
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

  // ── Borrador. Viaje, camión y chofer NO entran: cuando el diálogo se abre
  // desde un viaje o una unidad, esos tres los fija el contexto, y traerlos de
  // un borrador viejo sería colgarle el gasto a otra cosa.
  const valorBorrador = useMemo(
    () => ({ tipoGastoId, fecha, monto, medioPago, descripcion, proveedor, numeroComprobante }),
    [tipoGastoId, fecha, monto, medioPago, descripcion, proveedor, numeroComprobante],
  );

  const borrador = useBorrador({
    pantalla: "gastos-nuevo",
    valor: valorBorrador,
    normalizar: objetoCon(GASTO_VACIO),
    hayDatos: (v) => v.monto.trim() !== "" || v.descripcion.trim() !== "" || v.proveedor.trim() !== "",
    activo: open,
  });

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    setTipoGastoId(b.tipoGastoId);
    if (b.fecha) setFecha(b.fecha);
    setMonto(b.monto);
    setMedioPago(b.medioPago);
    setDescripcion(b.descripcion);
    setProveedor(b.proveedor);
    setNumeroComprobante(b.numeroComprobante);
  };

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
        // El gasto ya entró: recién ahora el borrador sobra.
        borrador.limpiar();
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
      {/* p-4 en celular (el p-6 crudo se comía 48px de los 375): los márgenes
          negativos del header y del pie tienen que seguir a ese padding. */}
      <DialogContent className="sm:max-w-[760px] p-4 sm:p-6 gap-0">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Receipt size={22} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-lg font-bold">
                Registrar Gasto
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Asocialo a un viaje, camión o chofer para mantener trazabilidad en la logística.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Lock indicator */}
        {contextLabel && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 sm:px-4 py-2 mt-4 rounded-lg bg-[#E1F5FE]/60 border border-[#B3E5FC] text-[#004A99] text-xs font-semibold">
            <Lock size={12} strokeWidth={2.5} className="shrink-0" />
            Vinculado por contexto a: <span className="underline">{contextLabel}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {borrador.pendiente && (
            <AvisoBorrador
              ts={borrador.pendiente.ts}
              onRecuperar={recuperarBorrador}
              onDescartar={borrador.descartar}
            />
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Fila 1: Tipo de gasto + Monto + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tipo Gasto */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Tipo de gasto *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                  <Tag size={15} />
                </div>
                <Combobox
                  value={tipoGastoId}
                  onValueChange={setTipoGastoId}
                  options={tiposGasto.map((t) => ({
                    id: t.id,
                    label: t.categoria ? `${t.nombre} · ${t.categoria}` : t.nombre,
                  }))}
                  placeholder="Seleccioná un tipo"
                  searchPlaceholder="Buscar tipo..."
                  required
                  triggerClassName={FIELD_COMBO_TRIGGER}
                />
              </div>
            </div>

            {/* Monto */}
            <InputFieldWithIcon
              label="Monto ($) *"
              name="monto"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              icon={DollarSign}
            />

            {/* Fecha */}
            <InputFieldWithIcon
              label="Fecha *"
              name="fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              icon={Calendar}
            />
          </div>

          {/* Fila 2: Medio de pago + N° Comprobante + Proveedor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Medio de pago */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Medio de pago *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                  <CreditCard size={15} />
                </div>
                <Combobox
                  value={medioPago}
                  onValueChange={(v) => setMedioPago(v as GastoMedioPago)}
                  options={MEDIO_PAGO_OPTIONS.map((o) => ({
                    id: o.value,
                    label: `${o.label} (${o.hint})`,
                  }))}
                  searchable={false}
                  required
                  triggerClassName={FIELD_COMBO_TRIGGER}
                />
              </div>
            </div>

            {/* N° comprobante */}
            <InputFieldWithIcon
              label="N° comprobante"
              name="numeroComprobante"
              placeholder="Ej: 0001-00000123"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              icon={FileText}
            />

            {/* Proveedor */}
            <InputFieldWithIcon
              label="Proveedor"
              name="proveedor"
              placeholder="Nombre del proveedor"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              icon={Store}
            />
          </div>

          {/* Fila 3: Descripción */}
          <InputFieldWithIcon
            label="Descripción del gasto"
            name="descripcion"
            placeholder="Ej: Carga de gasoil ruta 3, compra de repuestos..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            icon={MessageSquare}
          />

          {/* Fila 4: Asignación */}
          <div className="border-t border-border pt-4 space-y-2 mt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Asignación / Trazabilidad
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Viaje */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Viaje</Label>
                <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all disabled:opacity-50">
                  <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                    <Navigation size={15} />
                  </div>
                  <Combobox
                    value={viajeId}
                    onValueChange={setViajeId}
                    disabled={viajeLocked}
                    options={[
                      { id: "", label: "Sin asignar" },
                      ...viajes.map((v) => ({ id: v.id, label: v.codigo })),
                    ]}
                    searchPlaceholder="Buscar viaje..."
                    triggerClassName={FIELD_COMBO_TRIGGER}
                  />
                </div>
              </div>

              {/* Camión */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Camión</Label>
                <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all disabled:opacity-50">
                  <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                    <Truck size={15} />
                  </div>
                  <Combobox
                    value={camionId}
                    onValueChange={setCamionId}
                    disabled={camionLocked}
                    options={[
                      { id: "", label: "Sin asignar" },
                      ...camiones.map((c) => ({ id: c.id, label: c.patente })),
                    ]}
                    searchPlaceholder="Buscar patente..."
                    triggerClassName={FIELD_COMBO_TRIGGER}
                  />
                </div>
              </div>

              {/* Chofer */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Chofer</Label>
                <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all disabled:opacity-50">
                  <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                    <User size={15} />
                  </div>
                  <Combobox
                    value={choferId}
                    onValueChange={setChoferId}
                    disabled={choferLocked}
                    options={[
                      { id: "", label: "Sin asignar" },
                      ...choferes.map((c) => ({
                        id: c.id,
                        label: `${c.disabled ? "⚠ " : ""}${c.apellido}, ${c.nombre}${c.disabled ? " — legajo incompleto" : ""}`,
                        disabled: c.disabled,
                        motivo: c.motivo,
                      })),
                    ]}
                    searchPlaceholder="Buscar chofer..."
                    triggerClassName={FIELD_COMBO_TRIGGER}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer: en celular los botones se apilan y van a ancho completo. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-4 mt-6 border-t border-border -mx-4 px-4 sm:-mx-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-11 sm:h-10 w-full sm:w-auto px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-11 sm:h-10 w-full sm:w-auto px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? (
                "Registrando..."
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} /> Registrar gasto
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  type = "text",
  placeholder,
  required,
  value,
  onChange,
  disabled,
  icon: Icon,
  step,
  min,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  icon: LucideIcon;
  step?: string;
  min?: string;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          disabled={disabled}
          step={step}
          min={min}
          className={`flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground ${className}`}
        />
      </div>
    </div>
  );
}
