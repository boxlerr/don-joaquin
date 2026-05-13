"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import {
  createViajeAction,
  type CreateViajeState,
  type ViajeFormData,
} from "../actions";

const ESTADOS: { value: string; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "cerrado", label: "Cerrado" },
];

const inputClass =
  "w-full h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]";

const labelClass = "text-xs font-semibold text-[#475569] mb-1 block";

export default function NewViajeSheet({ data }: { data: ViajeFormData }) {
  const [open, setOpen] = useState(false);
  const [tipoCarga, setTipoCarga] = useState("");
  const [state, formAction] = useActionState<CreateViajeState, FormData>(
    createViajeAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setTipoCarga("");
    }
  }, [state]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setTipoCarga("");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Nuevo viaje
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-white rounded-[12px] shadow-2xl border border-[#E2E8F0] transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
        >
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <div>
              <Dialog.Title className="text-[#0F172A] text-base font-semibold">
                Nuevo viaje
              </Dialog.Title>
              <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                Asociá chofer, camión, cliente y ruta. El código se genera
                automáticamente.
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fecha del viaje *</label>
                <Input
                  name="fecha_viaje"
                  type="date"
                  defaultValue={today}
                  required
                  className="text-sm"
                />
                {state?.fieldErrors?.fecha_viaje && (
                  <p className="text-xs text-[#B91C1C] mt-1">
                    {state.fieldErrors.fecha_viaje}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Estado *</label>
                <select
                  name="estado"
                  defaultValue="pendiente"
                  className={inputClass}
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <SelectField
              label="Cliente *"
              name="cliente_id"
              options={data.clientes}
              required
              error={state?.fieldErrors?.cliente_id}
            />

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Chofer *"
                name="chofer_id"
                options={data.choferes}
                required
                error={state?.fieldErrors?.chofer_id}
              />
              <SelectField
                label="Camión *"
                name="camion_id"
                options={data.camiones}
                required
                error={state?.fieldErrors?.camion_id}
              />
            </div>

            <SelectField
              label="Tipo de carga *"
              name="tipo_carga_id"
              options={data.tipos_carga}
              required
              error={state?.fieldErrors?.tipo_carga_id}
              onChange={(e) => setTipoCarga(e.target.value)}
            />

            {tipoCarga === "otros" && (
              <div className="animate-fade-in">
                <label className={labelClass}>Descripción de la carga *</label>
                <Input
                  name="descripcion_otros"
                  type="text"
                  placeholder="Especificá el tipo de carga..."
                  required
                  className="text-sm"
                />
              </div>
            )}

            <datalist id="puntos-ruta-list">
              {data.puntos_ruta.map((p) => (
                <option key={p.id} value={p.label} />
              ))}
            </datalist>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Origen</label>
                <Input
                  name="origen_nombre"
                  type="text"
                  list="puntos-ruta-list"
                  placeholder="Escribí ciudad o lugar..."
                  className="text-sm"
                />
                {state?.fieldErrors?.origen_nombre && (
                  <p className="text-xs text-[#B91C1C] mt-1">
                    {state.fieldErrors.origen_nombre}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Destino</label>
                <Input
                  name="destino_nombre"
                  type="text"
                  list="puntos-ruta-list"
                  placeholder="Escribí ciudad o lugar..."
                  className="text-sm"
                />
                {state?.fieldErrors?.destino_nombre && (
                  <p className="text-xs text-[#B91C1C] mt-1">
                    {state.fieldErrors.destino_nombre}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label="Km con carga"
                name="km_con_carga"
                step="1"
                min={0}
                error={state?.fieldErrors?.km_con_carga}
              />
              <NumberField
                label="Km vacíos"
                name="km_vacios"
                step="1"
                min={0}
                error={state?.fieldErrors?.km_vacios}
              />
              <NumberField
                label="Tonelaje (tn)"
                name="tonelaje_real"
                step="0.01"
                min={0}
                error={state?.fieldErrors?.tonelaje_real}
              />
            </div>

            <NumberField
              label="Monto de flete (ARS)"
              name="monto_flete"
              step="0.01"
              min={0}
              error={state?.fieldErrors?.monto_flete}
            />

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

function SelectField({
  label,
  name,
  options,
  required,
  error,
  onChange,
}: {
  label: string;
  name: string;
  options: { id: string; label: string }[];
  required?: boolean;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        name={name}
        required={required}
        defaultValue=""
        className={inputClass}
        onChange={onChange}
      >
        <option value="" disabled={required}>
          {required ? "Seleccioná una opción..." : "—"}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#B91C1C] mt-1">{error}</p>}
    </div>
  );
}

function NumberField({
  label,
  name,
  step,
  min,
  error,
}: {
  label: string;
  name: string;
  step?: string;
  min?: number;
  error?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <Input
        name={name}
        type="number"
        step={step}
        min={min}
        defaultValue="0"
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
      {pending ? "Guardando..." : "Guardar viaje"}
    </Button>
  );
}
