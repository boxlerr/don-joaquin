"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Pencil, X } from "lucide-react";
import { updateClienteAction, type UpdateClienteState } from "./actions";
import { formatCuit } from "@/lib/utils/cuit";

const CONDICIONES_IVA: { value: string; label: string }[] = [
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "monotributo", label: "Monotributo" },
  { value: "exento", label: "Exento" },
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "no_categorizado", label: "No categorizado" },
];

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
  es_multinacional: boolean;
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
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
            <div>
              <Dialog.Title className="text-foreground text-base font-semibold flex items-center gap-2">
                <Pencil size={14} className="text-primary" />
                Editar cliente
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-xs mt-0.5">
                Actualizá los datos del cliente. Los cambios se reflejan al instante.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-7 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <form
            action={formAction}
            key={open ? cliente.id : "closed"}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            <input type="hidden" name="id" value={cliente.id} />
            <Field
              label="Razón social *"
              name="razon_social"
              defaultValue={cliente.razon_social}
              required
              error={state?.fieldErrors?.razon_social}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Nombre comercial"
                name="nombre_comercial"
                defaultValue={cliente.nombre_comercial ?? ""}
                error={state?.fieldErrors?.nombre_comercial}
              />
              <Field
                label="CUIT"
                name="cuit"
                defaultValue={formatCuit(cliente.cuit ?? "")}
                placeholder="30-12345678-9"
                error={state?.fieldErrors?.cuit}
                inputMode="numeric"
                maxLength={13}
                onInput={(e) => {
                  e.currentTarget.value = formatCuit(e.currentTarget.value);
                }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Condición IVA *
              </label>
              <Combobox
                name="condicion_iva"
                defaultValue={cliente.condicion_iva}
                options={CONDICIONES_IVA.map((c) => ({ id: c.value, label: c.label }))}
                searchable={false}
                triggerClassName="h-9 w-full"
              />
            </div>

            <Field
              label="Domicilio fiscal"
              name="domicilio_fiscal"
              defaultValue={cliente.domicilio_fiscal ?? ""}
              error={state?.fieldErrors?.domicilio_fiscal}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Localidad"
                name="localidad"
                defaultValue={cliente.localidad ?? ""}
                error={state?.fieldErrors?.localidad}
              />
              <Field
                label="Provincia"
                name="provincia"
                defaultValue={cliente.provincia ?? ""}
                error={state?.fieldErrors?.provincia}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={cliente.email ?? ""}
                error={state?.fieldErrors?.email}
              />
              <Field
                label="Teléfono"
                name="telefono"
                defaultValue={cliente.telefono ?? ""}
                error={state?.fieldErrors?.telefono}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="es_multinacional"
                defaultChecked={cliente.es_multinacional}
                className="size-4 rounded border-border accent-[#0088D1]"
              />
              Es multinacional
            </label>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Observaciones
              </label>
              <textarea
                name="observaciones"
                defaultValue={cliente.observaciones ?? ""}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] resize-none"
              />
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <SubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  error,
  inputMode,
  maxLength,
  onInput,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onInput?: React.FormEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
      <Input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        maxLength={maxLength}
        onInput={onInput}
        className="text-sm"
      />
      {error && <p className="text-xs text-[#B91C1C] mt-1">{error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="sm" disabled={pending}>
      {pending ? "Guardando..." : "Guardar cambios"}
    </Button>
  );
}
