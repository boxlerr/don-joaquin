"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { deleteClienteAction, type DeleteClienteState } from "./actions";

export default function DeleteClienteButton({
  id,
  razonSocial,
}: {
  id: string;
  razonSocial: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<DeleteClienteState, FormData>(
    deleteClienteAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-[#B91C1C] hover:bg-[#FEF2F2] border-[#FECACA]"
      >
        <Trash2 size={14} />
        Dar de baja
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-2rem))] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-start gap-3">
              <span className="size-9 rounded-full bg-[#FEF2F2] text-[#B91C1C] inline-flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </span>
              <div>
                <Dialog.Title className="text-foreground text-base font-semibold">
                  Dar de baja cliente
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-xs mt-0.5">
                  El cliente queda inactivo. Se conservan sus viajes y cuenta corriente.
                </Dialog.Description>
              </div>
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

          <form action={formAction} className="px-5 py-4 space-y-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm text-foreground">
              ¿Confirmás dar de baja a{" "}
              <span className="font-semibold">{razonSocial}</span>?
            </p>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <ConfirmButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      className="bg-[#B91C1C] text-white hover:bg-[#991B1B] disabled:opacity-60"
    >
      {pending ? "Dando de baja..." : "Dar de baja"}
    </Button>
  );
}
