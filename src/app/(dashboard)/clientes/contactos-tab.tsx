"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  Star,
  Mail,
  Phone,
  X,
  User as UserIcon,
} from "lucide-react";
import {
  getContactosAction,
  addContactoAction,
  deleteContactoAction,
  type Contacto,
  type ContactoActionState,
} from "./sub-resources-actions";

const CARGOS: { value: string; label: string }[] = [
  { value: "comercial", label: "Comercial" },
  { value: "administrativo", label: "Administrativo" },
  { value: "logistica", label: "Logística" },
  { value: "otro", label: "Otro" },
];

const CARGO_LABEL: Record<string, string> = Object.fromEntries(
  CARGOS.map((c) => [c.value, c.label])
);

export default function ContactosTab({ clienteId }: { clienteId: string }) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getContactosAction(clienteId).then((d) => {
      if (!cancel) {
        setContactos(d);
        setLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [clienteId, tick]);

  const refresh = () => setTick((t) => t + 1);

  const handleDelete = (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el contacto "${nombre}"?`)) return;
    startTransition(async () => {
      await deleteContactoAction(id);
      refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#94A3B8] uppercase">
          {contactos.length} contacto{contactos.length === 1 ? "" : "s"}
        </p>
        <AddContactoDialog clienteId={clienteId} onAdded={refresh} />
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center text-[#475569]">
          <Loader2 size={18} className="animate-spin text-[#0088D1]" />
        </div>
      ) : contactos.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#475569] bg-white border border-dashed border-[#E2E8F0] rounded-[8px]">
          Aún no hay contactos cargados.
        </div>
      ) : (
        <ul className="space-y-2">
          {contactos.map((c) => (
            <li
              key={c.id}
              className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 flex items-start gap-3 group"
            >
              <span className="size-9 rounded-full bg-[#E1F5FE] text-[#0088D1] flex items-center justify-center shrink-0">
                <UserIcon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#0F172A] font-semibold text-sm">{c.nombre}</span>
                  {c.es_principal && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-[#FFF8E1] text-[#92400E] border border-[#FDE68A] rounded-full px-2 py-0.5">
                      <Star size={9} fill="#F59E0B" stroke="#F59E0B" />
                      Principal
                    </span>
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#F1F5F9] text-[#475569] rounded-full px-2 py-0.5">
                    {CARGO_LABEL[c.cargo] ?? c.cargo}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-[#475569] flex-wrap">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="inline-flex items-center gap-1 hover:text-[#0088D1] transition-colors"
                    >
                      <Mail size={11} />
                      {c.email}
                    </a>
                  )}
                  {c.telefono && (
                    <a
                      href={`tel:${c.telefono}`}
                      className="inline-flex items-center gap-1 hover:text-[#0088D1] transition-colors"
                    >
                      <Phone size={11} />
                      {c.telefono}
                    </a>
                  )}
                </div>
                {c.observaciones && (
                  <p className="text-xs text-[#64748B] italic mt-1">{c.observaciones}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(c.id, c.nombre)}
                disabled={pending}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-600 disabled:opacity-30"
                title="Eliminar contacto"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddContactoDialog({
  clienteId,
  onAdded,
}: {
  clienteId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ContactoActionState, FormData>(
    addContactoAction,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      onAdded();
    }
  }, [state, onAdded]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Agregar contacto
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(480px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-white rounded-[12px] shadow-2xl border border-[#E2E8F0] transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <div>
              <Dialog.Title className="text-[#0F172A] text-base font-semibold">
                Nuevo contacto
              </Dialog.Title>
              <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                Persona de referencia del cliente.
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
            <input type="hidden" name="cliente_id" value={clienteId} />

            <Field label="Nombre *" name="nombre" required error={state?.fieldErrors?.nombre} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#475569] mb-1 block">Cargo</label>
                <select
                  name="cargo"
                  defaultValue="comercial"
                  className="w-full h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                >
                  {CARGOS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Teléfono"
                name="telefono"
                placeholder="+54 11 ..."
                error={state?.fieldErrors?.telefono}
              />
            </div>

            <Field label="Email" name="email" type="email" error={state?.fieldErrors?.email} />

            <label className="flex items-center gap-2 text-sm text-[#0F172A]">
              <input
                type="checkbox"
                name="es_principal"
                className="size-4 rounded border-[#E2E8F0] accent-[#0088D1]"
              />
              Marcar como contacto principal
            </label>

            <div>
              <label className="text-xs font-semibold text-[#475569] mb-1 block">
                Observaciones
              </label>
              <textarea
                name="observaciones"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] resize-none"
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
      <label className="text-xs font-semibold text-[#475569] mb-1 block">{label}</label>
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
      {pending ? "Guardando..." : "Guardar contacto"}
    </Button>
  );
}
