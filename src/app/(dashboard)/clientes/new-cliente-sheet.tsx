"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { createClienteAction, type CreateClienteState } from "./actions";

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
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Nuevo cliente
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-white rounded-[12px] shadow-2xl border border-[#E2E8F0] transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
        >
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <div>
              <Dialog.Title className="text-[#0F172A] text-base font-semibold">
                Nuevo cliente
              </Dialog.Title>
              <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                Datos básicos de la cartera. Podés completar el resto luego desde la ficha.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-7 rounded-full text-[#475569] hover:bg-[#F1F5F9] inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <form
            action={formAction}
            key={open ? "open" : "closed"}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            <Field
              label="Razón social *"
              name="razon_social"
              required
              error={state?.fieldErrors?.razon_social}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Nombre comercial"
                name="nombre_comercial"
                error={state?.fieldErrors?.nombre_comercial}
              />
              <Field
                label="CUIT"
                name="cuit"
                placeholder="30-12345678-9"
                error={state?.fieldErrors?.cuit}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#475569] mb-1 block">
                Condición IVA *
              </label>
              <select
                name="condicion_iva"
                defaultValue="no_categorizado"
                className="w-full h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
              >
                {CONDICIONES_IVA.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <Field
              label="Domicilio fiscal"
              name="domicilio_fiscal"
              error={state?.fieldErrors?.domicilio_fiscal}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Localidad"
                name="localidad"
                error={state?.fieldErrors?.localidad}
              />
              <Field
                label="Provincia"
                name="provincia"
                error={state?.fieldErrors?.provincia}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Email"
                name="email"
                type="email"
                error={state?.fieldErrors?.email}
              />
              <Field
                label="Teléfono"
                name="telefono"
                error={state?.fieldErrors?.telefono}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[#0F172A]">
              <input
                type="checkbox"
                name="es_multinacional"
                className="size-4 rounded border-[#E2E8F0] accent-[#0088D1]"
              />
              Es multinacional
            </label>

            <div>
              <label className="text-xs font-semibold text-[#475569] mb-1 block">
                Observaciones
              </label>
              <textarea
                name="observaciones"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] resize-none"
              />
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
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
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#475569] mb-1 block">
        {label}
      </label>
      <Input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
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
      {pending ? "Guardando..." : "Guardar cliente"}
    </Button>
  );
}
