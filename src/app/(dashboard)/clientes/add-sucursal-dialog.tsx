"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { addSucursalAction, type ContactoActionState } from "./sub-resources-actions";

export default function AddSucursalDialog({
  clienteId,
  onAdded,
  triggerLabel = "Agregar sucursal",
  triggerVariant = "brand",
  triggerSize = "sm",
  defaultPrincipal = false,
}: {
  clienteId: string;
  onAdded?: () => void;
  triggerLabel?: string;
  triggerVariant?: "brand" | "outline" | "ghost";
  triggerSize?: "sm" | "xs";
  defaultPrincipal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ContactoActionState, FormData>(
    addSucursalAction,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setOpen(false);
      onAdded?.();
    }
  }, [state, onAdded]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        <Plus size={triggerSize === "xs" ? 11 : 14} />
        {triggerLabel}
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
            <div>
              <Dialog.Title className="text-foreground text-base font-semibold">
                Nueva sucursal
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-xs mt-0.5">
                Ubicación operativa del cliente (depósito, planta, etc.).
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
            key={open ? "open" : "closed"}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            <input type="hidden" name="cliente_id" value={clienteId} />

            <Field label="Nombre *" name="nombre" required error={state?.fieldErrors?.nombre} />
            <Field label="Domicilio" name="domicilio" error={state?.fieldErrors?.domicilio} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Localidad" name="localidad" />
              <Field label="Provincia" name="provincia" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="País" name="pais" placeholder="Argentina" />
              <Field label="Teléfono" name="telefono" />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="es_principal"
                defaultChecked={defaultPrincipal}
                className="size-4 rounded border-border accent-[#0088D1]"
              />
              Marcar como sucursal principal
            </label>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Observaciones
              </label>
              <textarea
                name="observaciones"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] resize-none"
              />
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
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
      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
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
      {pending ? "Guardando..." : "Guardar sucursal"}
    </Button>
  );
}
