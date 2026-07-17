"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import {
  X,
  Pencil,
  Building2,
  Tag,
  Fingerprint,
  Percent,
  MapPin,
  Home,
  Mail,
  Phone,
  MessageSquare,
  Check,
} from "lucide-react";
import { updateClienteAction, type UpdateClienteState } from "./actions";
import { formatCuit } from "@/lib/utils/cuit";
import {
  CONDICIONES_IVA,
  InputFieldWithIcon,
  SelectFieldWithIcon,
  TextareaFieldWithIcon,
} from "./cliente-form-fields";

export type ClienteEditable = {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  cuit: string | null;
  condicion_iva: string;
  domicilio_fiscal: string | null;
  localidad: string | null;
  provincia: string | null;
  email?: string | null;
  telefono?: string | null;
  observaciones: string | null;
};

export default function EditClienteSheet({
  cliente,
  open,
  onOpenChange,
}: {
  cliente: ClienteEditable;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, formAction] = useActionState<UpdateClienteState, FormData>(
    updateClienteAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(760px,calc(100vw-2rem))] max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
                <Pencil size={20} />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-lg font-bold">
                  Editar cliente
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-xs font-medium mt-0.5">
                  {cliente.razon_social} · los cambios se reflejan al instante.
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
            key={open ? cliente.id : "closed"}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            <input type="hidden" name="id" value={cliente.id} />

            {/* Fila 1: Razón social + Nombre comercial + CUIT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputFieldWithIcon
                label="Razón social *"
                name="razon_social"
                defaultValue={cliente.razon_social}
                required
                icon={Building2}
                error={state?.fieldErrors?.razon_social}
              />
              <InputFieldWithIcon
                label="Nombre comercial"
                name="nombre_comercial"
                defaultValue={cliente.nombre_comercial ?? ""}
                icon={Tag}
                error={state?.fieldErrors?.nombre_comercial}
              />
              <InputFieldWithIcon
                label="CUIT"
                name="cuit"
                defaultValue={formatCuit(cliente.cuit ?? "")}
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
              <SelectFieldWithIcon
                label="Condición IVA *"
                name="condicion_iva"
                defaultValue={cliente.condicion_iva}
                options={CONDICIONES_IVA}
                required
                icon={Percent}
              />
              <div className="sm:col-span-2">
                <InputFieldWithIcon
                  label="Domicilio fiscal"
                  name="domicilio_fiscal"
                  defaultValue={cliente.domicilio_fiscal ?? ""}
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
                defaultValue={cliente.localidad ?? ""}
                placeholder="Ej: Arrecifes"
                icon={MapPin}
                error={state?.fieldErrors?.localidad}
              />
              <InputFieldWithIcon
                label="Provincia"
                name="provincia"
                defaultValue={cliente.provincia ?? ""}
                placeholder="Ej: Buenos Aires"
                icon={MapPin}
                error={state?.fieldErrors?.provincia}
              />
              <InputFieldWithIcon
                label="Teléfono"
                name="telefono"
                defaultValue={cliente.telefono ?? ""}
                placeholder="Ej: +54 9 11 ..."
                icon={Phone}
                error={state?.fieldErrors?.telefono}
              />
            </div>

            {/* Fila 4: Email + Observaciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <InputFieldWithIcon
                label="Email"
                name="email"
                type="email"
                defaultValue={cliente.email ?? ""}
                placeholder="Ej: contacto@empresa.com"
                icon={Mail}
                error={state?.fieldErrors?.email}
              />
              <TextareaFieldWithIcon
                label="Observaciones"
                name="observaciones"
                defaultValue={cliente.observaciones ?? ""}
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
            <div className="flex justify-end gap-3 pt-3.5 border-t border-border mt-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
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
          <Check size={16} strokeWidth={2.5} /> Guardar cambios
        </>
      )}
    </button>
  );
}
