"use client";

import { useState } from "react";
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
  Landmark,
  Hash,
  Sliders,
  Home,
  FileText,
  DollarSign,
  User,
  Fingerprint,
  Building2,
  Calendar,
  MessageSquare,
  Check,
} from "lucide-react";
import { createChequeAction, type ChequeTipo } from "../actions";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent font-medium hover:bg-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent";

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
      <DialogContent className="sm:max-w-[840px] p-6 gap-0">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">Registrar Cheque</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Ingresá los datos del cheque recibido. Quedará registrado en cartera.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Fila 1: Número de cheque + Tipo + Banco */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Numero de cheque */}
            <InputFieldWithIcon
              label="Número de cheque *"
              name="numero"
              placeholder="Ej: 00012345"
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              icon={Hash}
            />

            {/* Tipo */}
            <SelectFieldWithIcon
              label="Tipo *"
              name="tipo"
              value={tipo}
              onValueChange={(v) => setTipo(v as ChequeTipo)}
              options={Object.entries(TIPO_LABEL).map(([val, lbl]) => ({ value: val, label: lbl }))}
              required
              icon={Sliders}
            />

            {/* Banco */}
            <SelectFieldWithIcon
              label="Banco *"
              name="banco"
              value={bancoId}
              onValueChange={setBancoId}
              options={bancos.map((b) => ({ value: b.id, label: b.nombre }))}
              required
              placeholder="Seleccionar banco..."
              icon={Landmark}
            />
          </div>

          {/* Fila 2: Sucursal + Cuenta corriente + Importe */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Sucursal */}
            <InputFieldWithIcon
              label="Sucursal"
              name="sucursal"
              placeholder="Ej: 045 - Centro"
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              icon={Home}
            />

            {/* Cuenta corriente */}
            <InputFieldWithIcon
              label="Cuenta corriente"
              name="cuentaCorriente"
              placeholder="Nº de cuenta"
              value={cuentaCorriente}
              onChange={(e) => setCuentaCorriente(e.target.value)}
              icon={FileText}
            />

            {/* Importe */}
            <InputFieldWithIcon
              label="Importe ($) *"
              name="importe"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              icon={DollarSign}
            />
          </div>

          {/* Fila 3: Librador (nombre) + CUIT del librador + Cliente vinculado */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              {/* Librador (nombre) */}
              <InputFieldWithIcon
                label="Librador (nombre) *"
                name="libradorNombre"
                placeholder="Nombre / razón social del librador"
                required
                value={libradorNombre}
                onChange={(e) => setLibradorNombre(e.target.value)}
                icon={User}
              />
            </div>

            {/* CUIT del librador */}
            <InputFieldWithIcon
              label="CUIT del librador"
              name="libradorCuit"
              placeholder="20-12345678-9"
              value={libradorCuit}
              onChange={(e) => setLibradorCuit(e.target.value)}
              icon={Fingerprint}
            />

            {/* Cliente vinculado */}
            <SelectFieldWithIcon
              label="Cliente vinculado"
              name="cliente"
              value={clienteId}
              onValueChange={setClienteId}
              options={clientes.map((c) => ({ value: c.id, label: c.razon_social }))}
              placeholder="Sin cliente"
              icon={Building2}
            />
          </div>

          {/* Fila 4: Recibido de + Fecha emisión + Fecha vencimiento + Fecha recepción */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Recibido de */}
            <InputFieldWithIcon
              label="Recibido de"
              name="recibidoDe"
              placeholder="Persona o entidad (si no es cliente)"
              value={recibidoDe}
              onChange={(e) => setRecibidoDe(e.target.value)}
              icon={User}
            />

            {/* Fecha emision */}
            <InputFieldWithIcon
              label="Fecha emisión *"
              name="fechaEmision"
              type="date"
              required
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              icon={Calendar}
            />

            {/* Fecha vencimiento */}
            <InputFieldWithIcon
              label="Fecha vencimiento *"
              name="fechaVencimiento"
              type="date"
              required
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              icon={Calendar}
            />

            {/* Fecha recepcion */}
            <InputFieldWithIcon
              label="Fecha recepción *"
              name="fechaRecepcion"
              type="date"
              required
              value={fechaRecepcion}
              onChange={(e) => setFechaRecepcion(e.target.value)}
              icon={Calendar}
            />
          </div>

          {/* Fila 5: Concepto + Observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Concepto */}
            <InputFieldWithIcon
              label="Concepto"
              name="concepto"
              placeholder="Ej: Pago factura A-0001-00012345"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              icon={MessageSquare}
            />

            {/* Observaciones */}
            <InputFieldWithIcon
              label="Observaciones"
              name="observaciones"
              placeholder="Notas internas (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              icon={MessageSquare}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? (
                "Registrando..."
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} /> Confirmar cheque
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
  icon: React.ComponentType<any>;
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

// Subcomponente Select con Icono y Chevron
function SelectFieldWithIcon({
  label,
  name,
  value,
  onValueChange,
  options,
  required,
  disabled,
  icon: Icon,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  icon: React.ComponentType<any>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <Combobox
          name={name}
          required={required}
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          options={options.map((o) => ({ id: o.value, label: o.label }))}
          placeholder={placeholder}
          triggerClassName={FIELD_COMBO_TRIGGER}
        />
      </div>
    </div>
  );
}
