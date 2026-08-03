"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import { Landmark, User, type LucideIcon } from "lucide-react";
import { eliminarLibradorAction } from "../actions";
import type { ChequeOrigen } from "../transiciones";

/* Campos compartidos por el alta y la edición de cheques. */

export type LibradorOption = { id: string; nombre: string; cuit: string | null };
export type BancoOption = { id: string; nombre: string };

export const TIPO_OPTS = [
  { id: "electronico", label: "Echeq (electrónico)" },
  { id: "diferido", label: "Cheque físico" },
];

export function FieldBlock({
  label,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function FieldInput({
  icon: Icon, type = "text", placeholder, required, value, onChange, step, min,
}: {
  icon: LucideIcon;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  min?: string;
}) {
  return (
    <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
      <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
        <Icon size={15} />
      </div>
      <input
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
      />
    </div>
  );
}

/**
 * Librador: texto libre con sugerencias, igual que el banco. Se puede escribir
 * cualquiera (queda guardado para la próxima) y sacar de la lista con la X los
 * que sobren. Borrar de la lista no toca los cheques ya cargados.
 */
export function LibradorField({
  libradores,
  nombre,
  onNombreChange,
  onCuitChange,
  label = "Librador *",
  hint = "Si no está en la lista, escribilo: queda guardado para la próxima.",
}: {
  libradores: LibradorOption[];
  nombre: string;
  onNombreChange: (nombre: string) => void;
  onCuitChange: (cuit: string) => void;
  label?: string;
  hint?: string;
}) {
  const router = useRouter();
  // Se saca del desplegable en el acto, sin esperar al refresh del servidor.
  const [eliminados, setEliminados] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const opciones = libradores.filter((l) => !eliminados.includes(l.id));

  const eliminar = async (id: string) => {
    setEliminados((prev) => [...prev, id]);
    setError(null);
    const res = await eliminarLibradorAction(id);
    if (res.error) {
      setEliminados((prev) => prev.filter((x) => x !== id));
      setError(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <PlaceCombobox
      label={label}
      name="librador_nombre"
      icon={User}
      value={nombre}
      onValueChange={onNombreChange}
      onSelect={(v) => {
        // Elegir de la lista es autoritativo: si el librador nuevo no tiene
        // CUIT cargado, no dejamos el del anterior.
        const match = opciones.find((l) => l.nombre === v);
        if (match) onCuitChange(match.cuit ?? "");
      }}
      options={opciones.map((l) => ({ id: l.id, label: l.nombre }))}
      onRemoveOption={(opt) => eliminar(opt.id)}
      removeTitle="Sacar de la lista"
      placeholder="Escribí o elegí el librador"
      error={error ?? undefined}
      hint={hint}
    />
  );
}

/**
 * De qué lado está el cheque. Es lo primero que hay que decidir porque cambia
 * todo lo demás: uno que recibimos entra a la cartera (plata a cobrar), uno
 * nuestro queda emitido (plata que sale). Dos botones y no un desplegable
 * porque son dos caminos, no una lista de opciones.
 */
export function OrigenField({
  value,
  onValueChange,
  disabled = false,
  disabledHint,
}: {
  value: ChequeOrigen;
  onValueChange: (origen: ChequeOrigen) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const opciones: Array<{ key: ChequeOrigen; label: string; detalle: string }> = [
    { key: "recibido", label: "Lo recibimos", detalle: "De un cliente · a cobrar" },
    { key: "propio", label: "Es nuestro", detalle: "Lo emitimos · a pagar" },
  ];

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">¿De quién es el cheque? *</Label>
      <div className="grid grid-cols-2 gap-2">
        {opciones.map((o) => {
          const activo = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={disabled}
              onClick={() => onValueChange(o.key)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                activo
                  ? "border-[#0088D1] bg-[#0088D1]/[0.04]"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <span
                className={`block text-sm font-semibold ${activo ? "text-primary" : "text-foreground"}`}
              >
                {o.label}
              </span>
              <span className="block text-[11px] text-muted-foreground">{o.detalle}</span>
            </button>
          );
        })}
      </div>
      {disabled && disabledHint && (
        <p className="text-[11px] text-muted-foreground">{disabledHint}</p>
      )}
    </div>
  );
}

/**
 * Banco: texto libre con sugerencias. La lista nunca va a tener todos los
 * bancos del país, así que lo que se escriba se guarda y queda para la próxima.
 */
export function BancoField({
  bancos,
  value,
  onValueChange,
}: {
  bancos: BancoOption[];
  value: string;
  onValueChange: (nombre: string) => void;
}) {
  return (
    <PlaceCombobox
      label="Banco"
      name="banco_nombre"
      icon={Landmark}
      value={value}
      onValueChange={onValueChange}
      options={bancos.map((b) => ({ id: b.id, label: b.nombre }))}
      placeholder="Escribí o elegí el banco"
      hint="Si no está en la lista, escribilo: queda guardado para la próxima."
    />
  );
}
