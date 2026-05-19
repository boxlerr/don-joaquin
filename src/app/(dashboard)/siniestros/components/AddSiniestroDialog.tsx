"use client";

import { useEffect, useState } from "react";
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
import {
  AlertTriangle,
  Truck,
  User,
  Calendar,
  DollarSign,
  Shield,
  FileText,
  Users,
  MessageSquare,
  ChevronDown,
  Check,
} from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";

export type SiniestroEditing = {
  id: string;
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  descripcion: string;
  monto_danos?: number | null;
  compania_seguro?: string | null;
  numero_siniestro_seguro?: string | null;
  terceros_involucrados?: string | null;
};

type FieldErrors = {
  camionId?: string;
  fecha?: string;
  descripcion?: string;
  montoDanos?: string;
};

export default function AddSiniestroDialog({
  children,
  camiones,
  choferes,
  defaultCamionId,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSavedLocal,
}: {
  children?: React.ReactNode;
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null }[];
  defaultCamionId?: string;
  editing?: SiniestroEditing | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSavedLocal?: (data: {
    camion_id: string;
    chofer_id: string | null;
    fecha: string;
    descripcion: string;
    monto_danos: number | null;
    compania_seguro: string;
    numero_siniestro_seguro: string;
    terceros_involucrados: string;
  }) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [camionId, setCamionId] = useState(defaultCamionId ?? "");
  const [choferId, setChoferId] = useState<string>("none");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [descripcion, setDescripcion] = useState("");
  const [montoDanos, setMontoDanos] = useState("");
  const [companiaSeguro, setCompaniaSeguro] = useState("");
  const [numeroSiniestroSeguro, setNumeroSiniestroSeguro] = useState("");
  const [tercerosInvolucrados, setTercerosInvolucrados] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCamionId(editing.camion_id);
      setChoferId(editing.chofer_id ?? "none");
      setFecha(editing.fecha);
      setDescripcion(editing.descripcion);
      setMontoDanos(editing.monto_danos != null ? String(editing.monto_danos) : "");
      setCompaniaSeguro(editing.compania_seguro ?? "");
      setNumeroSiniestroSeguro(editing.numero_siniestro_seguro ?? "");
      setTercerosInvolucrados(editing.terceros_involucrados ?? "");
    } else {
      setCamionId(defaultCamionId ?? "");
      setChoferId("none");
      setFecha(new Date().toISOString().split("T")[0]);
      setDescripcion("");
      setMontoDanos("");
      setCompaniaSeguro("");
      setNumeroSiniestroSeguro("");
      setTercerosInvolucrados("");
    }
    setError(null);
    setSuccess(null);
    setErrors({});
  }, [open, editing, defaultCamionId]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!camionId) e.camionId = "Seleccioná un camión";
    if (!fecha) e.fecha = "Fecha requerida";
    if (!descripcion.trim()) e.descripcion = "Descripción requerida";
    if (montoDanos) {
      const m = parseFloat(montoDanos);
      if (!Number.isFinite(m) || m < 0) e.montoDanos = "Monto inválido (debe ser ≥ 0)";
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        camion_id: camionId,
        chofer_id: choferId === "none" ? null : choferId,
        fecha,
        descripcion: descripcion.trim(),
        monto_danos: montoDanos ? parseFloat(montoDanos) : null,
        compania_seguro: companiaSeguro.trim(),
        numero_siniestro_seguro: numeroSiniestroSeguro.trim(),
        terceros_involucrados: tercerosInvolucrados.trim(),
      };

      if (onSavedLocal) {
        onSavedLocal(payload);
        setSuccess(editing ? "Siniestro actualizado" : "Siniestro registrado");
        setTimeout(() => setOpen(false), 800);
      } else {
        setError("Error de configuración del formulario.");
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[600px] p-6 gap-0">
        {/* Header */}
        <DialogHeader className="border-b border-[#E2E8F0] pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#FEE2E2] text-[#EF4444] shrink-0 animate-pulse">
              <AlertTriangle size={22} />
            </div>
            <div>
              <DialogTitle className="text-[#0F172A] text-lg font-bold">
                {editing ? "Editar siniestro" : "Registrar siniestro"}
              </DialogTitle>
              <DialogDescription className="text-[#64748B] text-xs font-medium mt-0.5">
                {editing
                  ? "Actualizá los datos del siniestro registrado."
                  : "Ingresá los datos del siniestro para registrarlo en el sistema."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-2 gap-4">
            {/* Camion */}
            <SelectFieldWithIcon
              label="Camión *"
              name="camion"
              value={camionId}
              onValueChange={setCamionId}
              options={camiones.map((c) => ({
                value: c.id,
                label: `${c.patente} - ${c.marca} ${c.modelo}`,
              }))}
              required
              icon={Truck}
              error={errors.camionId}
            />

            {/* Chofer */}
            <SelectFieldWithIcon
              label="Chofer Involucrado"
              name="chofer"
              value={choferId}
              onValueChange={setChoferId}
              options={[
                { value: "none", label: "Sin chofer / Otro" },
                ...choferes.map((ch) => ({
                  value: ch.id,
                  label: `${ch.nombre} ${ch.apellido || ""}`,
                })),
              ]}
              icon={User}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Fecha */}
            <InputFieldWithIcon
              label="Fecha del Siniestro *"
              name="fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              icon={Calendar}
              error={errors.fecha}
            />

            {/* Monto */}
            <InputFieldWithIcon
              label="Monto Estimado Daños ($)"
              name="monto"
              type="number"
              placeholder="Ej: 150000"
              value={montoDanos}
              onChange={(e) => setMontoDanos(e.target.value)}
              icon={DollarSign}
              error={errors.montoDanos}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Compania */}
            <InputFieldWithIcon
              label="Compañía de Seguro"
              name="compania"
              placeholder="Ej: La Caja, San Cristóbal"
              value={companiaSeguro}
              onChange={(e) => setCompaniaSeguro(e.target.value)}
              icon={Shield}
            />

            {/* Nro Siniestro */}
            <InputFieldWithIcon
              label="Nro Siniestro/Reclamación"
              name="nroSiniestro"
              placeholder="Ej: SIN-12345/26"
              value={numeroSiniestroSeguro}
              onChange={(e) => setNumeroSiniestroSeguro(e.target.value)}
              icon={FileText}
            />
          </div>

          {/* Terceros */}
          <InputFieldWithIcon
            label="Terceros Involucrados (Datos)"
            name="terceros"
            placeholder="Ej: Juan Pérez (Patente XYZ-789) / Compañía Rivadavia"
            value={tercerosInvolucrados}
            onChange={(e) => setTercerosInvolucrados(e.target.value)}
            icon={Users}
          />

          {/* Detalles */}
          <TextareaFieldWithIcon
            label="Detalles / Descripción del Accidente *"
            name="descripcion"
            placeholder="Describí detalladamente lo sucedido (ej: Colisión en ruta 3 km 120, despiste por calzada húmeda, etc.)..."
            required
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            icon={MessageSquare}
            error={errors.descripcion}
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-100 -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] transition-colors"
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
                "Guardando..."
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />{" "}
                  {editing ? "Guardar cambios" : "Registrar siniestro"}
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
  id,
  type = "text",
  placeholder,
  required,
  value,
  onChange,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-[#475569]">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-white overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-[#E2E8F0] focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-[#E2E8F0] bg-slate-50/50 text-[#0088D1] shrink-0">
          <Icon size={15} />
        </div>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[#0F172A]"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Subcomponente Select con Icono y Chevron
function SelectFieldWithIcon({
  label,
  name,
  id,
  value,
  onValueChange,
  options,
  required,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-[#475569]">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-white overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-[#E2E8F0] focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-[#E2E8F0] bg-slate-50/50 text-[#0088D1] shrink-0">
          <Icon size={15} />
        </div>
        <div className="relative flex-1 h-full">
          <select
            id={id}
            name={name}
            value={value}
            required={required}
            className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[#0F172A] appearance-none cursor-pointer"
            onChange={(e) => onValueChange(e.target.value)}
          >
            <option value="" disabled={required}>
              Seleccionar...
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Subcomponente Textarea con Icono
function TextareaFieldWithIcon({
  label,
  name,
  id,
  placeholder,
  required,
  value,
  onChange,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-[#475569]">{label}</Label>
      <div className={`relative flex items-start w-full rounded-lg border bg-white overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-[#E2E8F0] focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-10 border-r border-[#E2E8F0] bg-slate-50/50 text-[#0088D1] shrink-0">
          <Icon size={15} />
        </div>
        <textarea
          id={id}
          name={name}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          className="flex-1 min-h-[90px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[#0F172A] resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
