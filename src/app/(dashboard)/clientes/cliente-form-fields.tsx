"use client";

import { Combobox } from "@/components/ui/combobox";
import type { LucideIcon } from "lucide-react";

// Campos compartidos por los modales de alta y edición de cliente, para que
// ambos se vean igual (input con ícono a la izquierda, mismo foco y errores).

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0";

export const CONDICIONES_IVA: { value: string; label: string }[] = [
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "monotributo", label: "Monotributo" },
  { value: "exento", label: "Exento" },
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "no_categorizado", label: "No categorizado" },
];

function shellClass(error?: string): string {
  return `relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
    error
      ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500"
      : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
  }`;
}

function IconBox({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-center w-10 h-10 border-r border-border bg-muted/50 text-primary shrink-0 self-start">
      <Icon size={15} />
    </div>
  );
}

export function InputFieldWithIcon({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  error,
  icon,
  inputMode,
  maxLength,
  onInput,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  icon: LucideIcon;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onInput?: React.FormEventHandler<HTMLInputElement>;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={shellClass(error)}>
        <IconBox icon={icon} />
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
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

export function SelectFieldWithIcon({
  label,
  name,
  defaultValue = "",
  options,
  required,
  error,
  icon,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={shellClass(error)}>
        <IconBox icon={icon} />
        <Combobox
          name={name}
          required={required}
          defaultValue={defaultValue}
          options={options.map((o) => ({ id: o.value, label: o.label }))}
          placeholder="Seleccionar..."
          searchable={false}
          triggerClassName={FIELD_COMBO_TRIGGER}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function TextareaFieldWithIcon({
  label,
  name,
  placeholder,
  defaultValue,
  required,
  error,
  icon,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-1 h-full flex flex-col">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div
        className={`relative flex items-start flex-1 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
          error
            ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500"
            : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
        }`}
      >
        <IconBox icon={icon} />
        <textarea
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          className="flex-1 w-full h-[85px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
