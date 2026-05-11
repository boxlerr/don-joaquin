"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, X, CheckCircle2 } from "lucide-react";
import {
  reactivateClienteAction,
  type ReactivateClienteState,
} from "./actions";

export default function ReactivateClienteButton({
  id,
  razonSocial,
}: {
  id: string;
  razonSocial: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ReactivateClienteState, FormData>(
    reactivateClienteAction,
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
        className="text-[#065F46] hover:bg-[#ECFDF5] border-[#A7F3D0]"
      >
        <RotateCcw size={14} />
        Reactivar
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-2rem))] flex flex-col bg-white rounded-[12px] shadow-2xl border border-[#E2E8F0] transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-start gap-3">
              <span className="size-9 rounded-full bg-[#ECFDF5] text-[#065F46] inline-flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <Dialog.Title className="text-[#0F172A] text-base font-semibold">
                  Reactivar cliente
                </Dialog.Title>
                <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                  El cliente vuelve a estar disponible para operar.
                </Dialog.Description>
              </div>
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

          <form action={formAction} className="px-5 py-4 space-y-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm text-[#0F172A]">
              ¿Confirmás reactivar a{" "}
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
    <Button type="submit" variant="brand" size="sm" disabled={pending}>
      {pending ? "Reactivando..." : "Reactivar"}
    </Button>
  );
}
