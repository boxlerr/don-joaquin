"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus,
  X,
  UserPlus,
  Building2,
  Tag,
  Fingerprint,
  Percent,
  MapPin,
  Home,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  Check,
} from "lucide-react";
import { createClienteAction, type CreateClienteState } from "./actions";
import { formatCuit } from "@/lib/utils/cuit";

const CONDICIONES_IVA: { value: string; label: string }[] = [
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "monotributo", label: "Monotributo" },
  { value: "exento", label: "Exento" },
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "no_categorizado", label: "No categorizado" },
];

export default function NewClienteSheet() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<CreateClienteState, FormData>(
    createClienteAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
        <Plus size={14} />
        Nuevo cliente
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(760px,calc(100vw-2rem))] max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
                <UserPlus size={22} />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-lg font-bold">
                  Nuevo cliente
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-xs font-medium mt-0.5">
                  Datos básicos de la cartera. Podés completar el resto luego desde la ficha.
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
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            {/* Fila 1: Razón social + Nombre comercial + CUIT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputFieldWithIcon
                label="Razón social *"
                name="razon_social"
                placeholder="Ej: Don Joaquín S.A."
                required
                icon={Building2}
                error={state?.fieldErrors?.razon_social}
              />
              <InputFieldWithIcon
                label="Nombre comercial"
                name="nombre_comercial"
                placeholder="Ej: Don Joaquín"
                icon={Tag}
                error={state?.fieldErrors?.nombre_comercial}
              />
              <InputFieldWithIcon
                label="CUIT"
                name="cuit"
                placeholder="30-12345678-9"
                icon={Fingerprint}
                error={state?.fieldErrors?.cuit}
                inputMode="numeric"
                maxLength={13}
                onInput={(e) => {
                  e.currentTarget.value = formatCuit(e.currentTarget.value);
                }}
              />
            </div>

            {/* Fila 2: Condición IVA + Domicilio fiscal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <SelectFieldWithIcon
                  label="Condición IVA *"
                  name="condicion_iva"
                  defaultValue="no_categorizado"
                  options={CONDICIONES_IVA}
                  required
                  icon={Percent}
                />
              </div>
              <div className="sm:col-span-2">
                <InputFieldWithIcon
                  label="Domicilio fiscal"
                  name="domicilio_fiscal"
                  placeholder="Ej: Av. Colón 123"
                  icon={Home}
                  error={state?.fieldErrors?.domicilio_fiscal}
                />
              </div>
            </div>

            {/* Fila 3: Localidad + Provincia + Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputFieldWithIcon
                label="Localidad"
                name="localidad"
                placeholder="Ej: Arrecifes"
                icon={MapPin}
                error={state?.fieldErrors?.localidad}
              />
              <InputFieldWithIcon
                label="Provincia"
                name="provincia"
                placeholder="Ej: Buenos Aires"
                icon={MapPin}
                error={state?.fieldErrors?.provincia}
              />
              <InputFieldWithIcon
                label="Teléfono"
                name="telefono"
                placeholder="Ej: +54 9 11 ..."
                icon={Phone}
                error={state?.fieldErrors?.telefono}
              />
            </div>

            {/* Fila 4: Distribución de Email & Checkbox (Izquierda) + Observaciones (Derecha) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-4">
                <InputFieldWithIcon
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="Ej: contacto@empresa.com"
                  icon={Mail}
                  error={state?.fieldErrors?.email}
                />
                <div className="flex items-center pt-1.5">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground/90 cursor-pointer selection:bg-transparent">
                    <input
                      type="checkbox"
                      name="es_multinacional"
                      className="size-4.5 rounded border-border accent-[#0088D1] cursor-pointer"
                    />
                    Es multinacional
                  </label>
                </div>
              </div>
              
              <TextareaFieldWithIcon
                label="Observaciones"
                name="observaciones"
                placeholder="Detalles u observaciones adicionales sobre el cliente..."
                icon={MessageSquare}
              />
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-xs rounded-lg px-3 py-2 font-medium">
                {state.error}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-3.5 border-t border-slate-100 mt-4">
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
  error,
  icon: Icon,
  inputMode,
  maxLength,
  onInput,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  icon: React.ComponentType<any>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onInput?: React.FormEventHandler<HTMLInputElement>;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          onInput={onInput}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
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
  defaultValue = "",
  options,
  required,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <div className="relative flex-1 h-full">
          <select
            name={name}
            required={required}
            defaultValue={defaultValue}
            className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
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
  placeholder,
  required,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="space-y-1 h-full flex flex-col justify-between">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-start flex-1 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-10 border-r border-border bg-muted/40/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <textarea
          name={name}
          placeholder={placeholder}
          required={required}
          className="flex-1 w-full h-[85px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground resize-none"
        />
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
          <Check size={16} strokeWidth={2.5} /> Guardar cliente
        </>
      )}
    </button>
  );
}
