"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus,
  X,
  Calendar,
  User,
  LifeBuoy,
  Truck,
  Package,
  MapPin,
  Flag,
  Navigation,
  Scale,
  DollarSign,
  ChevronDown,
  Check,
  FileText,
  Hash,
} from "lucide-react";
import {
  createViajeAction,
  type CreateViajeState,
  type ViajeFormData,
} from "../actions";

export default function NewViajeSheet({ data }: { data: ViajeFormData }) {
  const [open, setOpen] = useState(false);
  const [tipoCarga, setTipoCarga] = useState("");
  // Auto-camión: al elegir chofer, se pre-selecciona su camión asignado
  const [selectedCamionId, setSelectedCamionId] = useState("");
  const router = useRouter();

  const [state, formAction] = useActionState<CreateViajeState, FormData>(
    createViajeAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setTipoCarga("");
      window.dispatchEvent(new Event("viaje-created"));
      router.refresh();
    }
  }, [state, router]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTipoCarga("");
      setSelectedCamionId("");
    }
  };

  const handleChoferChange = (choferId: string) => {
    // Autocompletar el camión asignado a este chofer
    const chofer = data.choferes.find((c) => c.id === choferId);
    if (chofer?.camionId) {
      setSelectedCamionId(chofer.camionId);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
        <Plus size={14} />
        Nuevo viaje
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-2rem))] max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
                <Truck size={22} />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-lg font-bold">
                  Nuevo viaje
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-xs font-medium mt-0.5">
                  Asociá chofer, camión, cliente y ruta. El código se genera automáticamente.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-8 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center transition-colors"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form
            action={formAction}
            key={open ? "open" : "closed"}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
          >
            <input type="hidden" name="estado" value="pendiente" />

            <InputFieldWithIcon
              label="Fecha del viaje *"
              name="fecha_viaje"
              type="date"
              defaultValue={today}
              required
              icon={Calendar}
              error={state?.fieldErrors?.fecha_viaje}
            />

            {/* Cliente */}
            <SelectFieldWithIcon
              label="Cliente *"
              name="cliente_id"
              options={data.clientes}
              required
              icon={User}
              error={state?.fieldErrors?.cliente_id}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chofer */}
              <SelectFieldWithIcon
                label="Chofer *"
                name="chofer_id"
                options={data.choferes}
                required
                icon={LifeBuoy}
                error={state?.fieldErrors?.chofer_id}
                onChange={(e) => handleChoferChange(e.target.value)}
              />
              {/* Camion — controlado para recibir auto-completado */}
              <SelectFieldWithIcon
                label="Camión *"
                name="camion_id"
                options={data.camiones}
                required
                icon={Truck}
                error={state?.fieldErrors?.camion_id}
                value={selectedCamionId}
                onChange={(e) => setSelectedCamionId(e.target.value)}
              />
            </div>

            {/* Tipo de Carga */}
            <SelectFieldWithIcon
              label="Tipo de carga *"
              name="tipo_carga_id"
              options={data.tipos_carga}
              required
              icon={Package}
              error={state?.fieldErrors?.tipo_carga_id}
              onChange={(e) => setTipoCarga(e.target.value)}
            />

            {/* Descripcion si es otros */}
            {tipoCarga === "otros" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <InputFieldWithIcon
                  label="Descripción de la carga *"
                  name="descripcion_otros"
                  placeholder="Especificá el tipo de carga..."
                  required
                  icon={FileText}
                />
              </div>
            )}

            <datalist id="puntos-ruta-list">
              {data.puntos_ruta.map((p) => (
                <option key={p.id} value={p.label} />
              ))}
            </datalist>

            {/* Ruta Origen / Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputFieldWithIcon
                label="Origen"
                name="origen_nombre"
                placeholder="Escribí ciudad o lugar..."
                icon={MapPin}
                list="puntos-ruta-list"
                error={state?.fieldErrors?.origen_nombre}
              />
              <InputFieldWithIcon
                label="Destino"
                name="destino_nombre"
                placeholder="Escribí ciudad o lugar..."
                icon={Flag}
                list="puntos-ruta-list"
                error={state?.fieldErrors?.destino_nombre}
              />
            </div>

            {/* Kms / Tonelaje */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputFieldWithIcon
                label="Km con carga"
                name="km_con_carga"
                type="number"
                defaultValue="0"
                icon={Navigation}
                error={state?.fieldErrors?.km_con_carga}
              />
              <InputFieldWithIcon
                label="Km vacíos"
                name="km_vacios"
                type="number"
                defaultValue="0"
                icon={Navigation}
                error={state?.fieldErrors?.km_vacios}
              />
              <InputFieldWithIcon
                label="Tonelaje (tn)"
                name="tonelaje_real"
                type="number"
                defaultValue="0"
                icon={Scale}
                error={state?.fieldErrors?.tonelaje_real}
              />
            </div>

            {/* Monto de Flete */}
            <InputFieldWithIcon
              label="Monto de flete (ARS)"
              name="monto_flete"
              type="number"
              defaultValue="0"
              icon={DollarSign}
              error={state?.fieldErrors?.monto_flete}
            />

            {/* Nº Viaje YPF (opcional) */}
            <InputFieldWithIcon
              label="Nº viaje YPF"
              name="nro_viaje_ypf"
              placeholder="Ej: 123456 (opcional)"
              icon={Hash}
              error={state?.fieldErrors?.nro_viaje_ypf}
            />

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-xs rounded-lg px-3 py-2 font-medium">
                {state.error}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                Cancelar
              </button>
              <SubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  error,
  icon: Icon,
  list,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  icon: React.ComponentType<any>;
  list?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          list={list}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Subcomponente Select con Icono y Chevron.
// Soporta modo controlado (value + onChange) o no-controlado (solo onChange).
function SelectFieldWithIcon({
  label,
  name,
  options,
  required,
  error,
  onChange,
  value,
  icon: Icon,
}: {
  label: string;
  name: string;
  options: { id: string; label: string }[];
  required?: boolean;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Pasar para modo controlado (e.g. auto-completado de camión). */
  value?: string;
  icon: React.ComponentType<any>;
}) {
  const isControlled = value !== undefined;
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <div className="relative flex-1 h-full">
          <select
            name={name}
            required={required}
            {...(isControlled ? { value } : { defaultValue: "" })}
            className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer"
            onChange={onChange}
          >
            <option value="" disabled={required}>
              Seleccioná una opción...
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Boton de submit estilizado
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg text-sm font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
    >
      {pending ? (
        "Guardando..."
      ) : (
        <>
          <Check size={16} strokeWidth={2.5} /> Guardar viaje
        </>
      )}
    </button>
  );
}
