"use client";

import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  Truck,
  User,
  Calendar,
  DollarSign,
  Shield,
  FileText,
  Users,
  MessageSquare,
  Check,
  Tag,
  Activity,
} from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0";
import type { TipoSiniestro, EstadoSiniestro } from "./SiniestrosTable";
import { useBorrador } from "@/hooks/useBorrador";
import { objetoCon } from "@/lib/borrador-local";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";

export type SiniestroFormPayload = {
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  tipo_siniestro: TipoSiniestro;
  tipo_siniestro_detalle: string | null;
  estado: EstadoSiniestro;
  descripcion: string;
  monto_danos: number | null;
  compania_seguro: string;
  numero_siniestro_seguro: string;
  terceros_involucrados: string;
};

export type SiniestroEditing = {
  id: string;
} & SiniestroFormPayload;

/** El siniestro en blanco, para completar contra él un borrador viejo. */
const SINIESTRO_VACIO = {
  choferId: "none",
  tipoSiniestro: "choque" as TipoSiniestro,
  tipoSiniestroDetalle: "",
  estado: "abierto" as EstadoSiniestro,
  descripcion: "",
  montoDanos: "",
  companiaSeguro: "",
  numeroSiniestroSeguro: "",
  tercerosInvolucrados: "",
};

type FieldErrors = {
  camionId?: string;
  fecha?: string;
  descripcion?: string;
  montoDanos?: string;
  tipoDetalle?: string;
};

const TIPO_OPTIONS: { value: TipoSiniestro; label: string }[] = [
  { value: "choque", label: "Choque" },
  { value: "robo", label: "Robo" },
  { value: "incendio", label: "Incendio" },
  { value: "vandalismo", label: "Vandalismo" },
  { value: "vuelco", label: "Vuelco" },
  { value: "otro", label: "Otro" },
];

const ESTADO_OPTIONS: { value: EstadoSiniestro; label: string }[] = [
  { value: "abierto", label: "Abierto" },
  { value: "en_gestion", label: "En gestión" },
  { value: "cerrado", label: "Cerrado" },
];

export default function AddSiniestroDialog({
  children,
  camiones,
  choferes,
  defaultCamionId,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSaved,
}: {
  children?: React.ReactNode;
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null; disabled?: boolean; motivo?: string }[];
  defaultCamionId?: string;
  editing?: SiniestroEditing | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSaved?: (data: SiniestroFormPayload) => void;
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
  const [tipoSiniestro, setTipoSiniestro] = useState<TipoSiniestro>("choque");
  const [tipoSiniestroDetalle, setTipoSiniestroDetalle] = useState("");
  const [estado, setEstado] = useState<EstadoSiniestro>("abierto");
  const [descripcion, setDescripcion] = useState("");
  const [montoDanos, setMontoDanos] = useState("");
  const [companiaSeguro, setCompaniaSeguro] = useState("");
  const [numeroSiniestroSeguro, setNumeroSiniestroSeguro] = useState("");
  const [tercerosInvolucrados, setTercerosInvolucrados] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  // ── Borrador. Sólo en el alta: al editar, los datos ya están en el sistema y
  // lo que se pierde es una corrección, no una carga entera. La fecha y el
  // camión tampoco entran cuando el diálogo se abre desde una unidad.
  const valorBorrador = useMemo(
    () => ({
      choferId,
      tipoSiniestro,
      tipoSiniestroDetalle,
      estado,
      descripcion,
      montoDanos,
      companiaSeguro,
      numeroSiniestroSeguro,
      tercerosInvolucrados,
    }),
    [choferId, tipoSiniestro, tipoSiniestroDetalle, estado, descripcion, montoDanos,
     companiaSeguro, numeroSiniestroSeguro, tercerosInvolucrados],
  );

  const borrador = useBorrador({
    pantalla: "siniestros-nuevo",
    valor: valorBorrador,
    normalizar: objetoCon(SINIESTRO_VACIO),
    hayDatos: (v) =>
      v.descripcion.trim() !== "" ||
      v.montoDanos.trim() !== "" ||
      v.companiaSeguro.trim() !== "" ||
      v.tercerosInvolucrados.trim() !== "",
    activo: open && !editing,
  });

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    setChoferId(b.choferId);
    setTipoSiniestro(b.tipoSiniestro);
    setTipoSiniestroDetalle(b.tipoSiniestroDetalle);
    setEstado(b.estado);
    setDescripcion(b.descripcion);
    setMontoDanos(b.montoDanos);
    setCompaniaSeguro(b.companiaSeguro);
    setNumeroSiniestroSeguro(b.numeroSiniestroSeguro);
    setTercerosInvolucrados(b.tercerosInvolucrados);
  };

  useEffect(() => {
    if (!open) return;
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setCamionId(editing.camion_id);
      setChoferId(editing.chofer_id ?? "none");
      setFecha(editing.fecha);
      setTipoSiniestro(editing.tipo_siniestro);
      setTipoSiniestroDetalle(editing.tipo_siniestro_detalle ?? "");
      setEstado(editing.estado);
      setDescripcion(editing.descripcion);
      setMontoDanos(editing.monto_danos != null ? String(editing.monto_danos) : "");
      setCompaniaSeguro(editing.compania_seguro ?? "");
      setNumeroSiniestroSeguro(editing.numero_siniestro_seguro ?? "");
      setTercerosInvolucrados(editing.terceros_involucrados ?? "");
    } else {
      setCamionId(defaultCamionId ?? "");
      setChoferId("none");
      setFecha(new Date().toISOString().split("T")[0]);
      setTipoSiniestro("choque");
      setTipoSiniestroDetalle("");
      setEstado("abierto");
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
    if (tipoSiniestro === "otro" && !tipoSiniestroDetalle.trim()) {
      e.tipoDetalle = "Especificá el tipo de siniestro";
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
      const payload: SiniestroFormPayload = {
        camion_id: camionId,
        chofer_id: choferId === "none" ? null : choferId,
        fecha,
        tipo_siniestro: tipoSiniestro,
        tipo_siniestro_detalle: tipoSiniestro === "otro" ? tipoSiniestroDetalle.trim() : null,
        estado,
        descripcion: descripcion.trim(),
        monto_danos: montoDanos ? parseFloat(montoDanos) : null,
        compania_seguro: companiaSeguro.trim(),
        numero_siniestro_seguro: numeroSiniestroSeguro.trim(),
        terceros_involucrados: tercerosInvolucrados.trim(),
      };

      if (onSaved) {
        onSaved(payload);
        setSuccess(editing ? "Siniestro actualizado" : "Siniestro registrado");
        // El siniestro ya entró: recién ahora el borrador sobra.
        borrador.limpiar();
        setTimeout(() => setOpen(false), 800);
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
      <DialogContent className="sm:max-w-[620px] p-4 sm:p-6 gap-0 max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#FEE2E2] text-[#EF4444] shrink-0 animate-pulse">
              <AlertTriangle size={22} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-lg font-bold">
                {editing ? "Editar siniestro" : "Registrar siniestro"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                {editing
                  ? "Actualizá los datos del siniestro registrado."
                  : "Ingresá los datos del siniestro para registrarlo en el sistema."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {borrador.pendiente && (
            <AvisoBorrador
              ts={borrador.pendiente.ts}
              onRecuperar={recuperarBorrador}
              onDescartar={borrador.descartar}
            />
          )}

          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <SelectFieldWithIcon
              label="Camión *"
              name="camion"
              value={camionId}
              onValueChange={setCamionId}
              options={camiones.map((c) => ({ value: c.id, label: `${c.patente} - ${c.marca} ${c.modelo}` }))}
              required
              icon={Truck}
              error={errors.camionId}
            />
            <SelectFieldWithIcon
              label="Chofer Involucrado"
              name="chofer"
              value={choferId}
              onValueChange={setChoferId}
              options={[
                { value: "none", label: "Sin chofer / Otro" },
                ...choferes.map((ch) => ({
                  value: ch.id,
                  // El motivo lo decide quien arma la lista (legajo incompleto,
                  // egresado): antes estaba escrito acá y decía siempre lo mismo.
                  label: ch.disabled
                    ? `${ch.nombre} ${ch.apellido || ""} — ${(ch.motivo ?? "no disponible").toLowerCase()}`
                    : `${ch.nombre} ${ch.apellido || ""}`,
                  disabled: ch.disabled,
                  title: ch.motivo,
                })),
              ]}
              icon={User}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <SelectFieldWithIcon
              label="Tipo de Siniestro *"
              name="tipo"
              value={tipoSiniestro}
              onValueChange={(v) => { setTipoSiniestro(v as TipoSiniestro); setTipoSiniestroDetalle(""); }}
              options={TIPO_OPTIONS}
              required
              icon={Tag}
            />
            <SelectFieldWithIcon
              label="Estado *"
              name="estado"
              value={estado}
              onValueChange={(v) => setEstado(v as EstadoSiniestro)}
              options={ESTADO_OPTIONS}
              required
              icon={Activity}
            />
          </div>

          {tipoSiniestro === "otro" && (
            <InputFieldWithIcon
              label="Especificá el tipo de siniestro *"
              name="tipoDetalle"
              placeholder="Ej: Granizo, inundación, animal en ruta..."
              value={tipoSiniestroDetalle}
              onChange={(e) => setTipoSiniestroDetalle(e.target.value)}
              icon={Tag}
              error={errors.tipoDetalle}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <InputFieldWithIcon
              label="Compañía de Seguro"
              name="compania"
              placeholder="Ej: La Caja, San Cristóbal"
              value={companiaSeguro}
              onChange={(e) => setCompaniaSeguro(e.target.value)}
              icon={Shield}
            />
            <InputFieldWithIcon
              label="Nro Siniestro/Reclamación"
              name="nroSiniestro"
              placeholder="Ej: SIN-12345/26"
              value={numeroSiniestroSeguro}
              onChange={(e) => setNumeroSiniestroSeguro(e.target.value)}
              icon={FileText}
            />
          </div>

          <InputFieldWithIcon
            label="Terceros Involucrados (Datos)"
            name="terceros"
            placeholder="Ej: Juan Pérez (Patente XYZ-789) / Compañía Rivadavia"
            value={tercerosInvolucrados}
            onChange={(e) => setTercerosInvolucrados(e.target.value)}
            icon={Users}
          />

          <TextareaFieldWithIcon
            label="Detalles / Descripción del Accidente *"
            name="descripcion"
            placeholder="Describí detalladamente lo sucedido..."
            required
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            icon={MessageSquare}
            error={errors.descripcion}
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 mt-6 border-t border-border -mx-4 px-4 sm:-mx-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? "Guardando..." : (
                <><Check size={16} strokeWidth={2.5} /> {editing ? "Guardar cambios" : "Registrar siniestro"}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InputFieldWithIcon({
  label, name, id, type = "text", placeholder, required, value, onChange, error, icon: Icon,
}: {
  label: string; name: string; id?: string; type?: string; placeholder?: string;
  required?: boolean; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          id={id} name={name} type={type} placeholder={placeholder} required={required}
          value={value} onChange={onChange}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function SelectFieldWithIcon({
  label, name, id, value, onValueChange, options, required, error, icon: Icon,
}: {
  label: string; name: string; id?: string; value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean; title?: string }[]; required?: boolean; error?: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <Combobox
          id={id}
          name={name}
          value={value}
          required={required}
          onValueChange={onValueChange}
          options={options.map((o) => ({ id: o.value, label: o.label, disabled: o.disabled, hint: o.title }))}
          placeholder="Seleccionar..."
          triggerClassName={FIELD_COMBO_TRIGGER}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function TextareaFieldWithIcon({
  label, name, id, placeholder, required, value, onChange, error, icon: Icon,
}: {
  label: string; name: string; id?: string; placeholder?: string; required?: boolean;
  value?: string; onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string; icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-start w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-10 border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <textarea
          id={id} name={name} placeholder={placeholder} required={required} value={value} onChange={onChange}
          className="flex-1 min-h-[90px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
