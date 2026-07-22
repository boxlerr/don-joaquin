"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Combobox — desplegable estilizado, accesible y buscable.
 *
 * Reemplaza al <select> nativo (que el SO dibuja feo y no se puede
 * estilar ni buscar). API basada en strings para que sea un drop-in:
 *   - options: [{ id, label, disabled?, hint? }]
 *   - value / defaultValue / onValueChange  -> el id (string)
 *   - name -> participa en <form> con un hidden input (server actions)
 *
 * Búsqueda automática cuando la lista supera `searchThreshold` (7).
 * Responsive: el popup respeta el ancho del trigger, hace scroll y
 * funciona con teclado y touch.
 * ------------------------------------------------------------------ */

export type ComboboxOption = {
  id: string;
  label: string;
  disabled?: boolean;
  /** Texto auxiliar (ej. motivo por el que está deshabilitado). */
  hint?: string;
  /** Alias de `hint` (compatibilidad con la data del server). */
  motivo?: string;
  /** Puntito de estado a la izquierda: verde (free) / ámbar (busy). */
  tone?: "free" | "busy";
  /** Puntito de color arbitrario a la izquierda (hex; ej. color del área). */
  dot?: string;
  /** Nota corta a la derecha de la opción (ej. quién la ocupa). */
  note?: string;
};

type Item = {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
  tone?: "free" | "busy";
  dot?: string;
  note?: string;
};

export interface ComboboxProps {
  options: ComboboxOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  /** Permite limpiar la selección desde el popup. */
  clearable?: boolean;
  /** Forzar/anular el buscador. Por defecto: auto según cantidad. */
  searchable?: boolean;
  searchThreshold?: number;
  id?: string;
  /** Marca visual de error (borde rojo). */
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

export function Combobox({
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Seleccioná una opción...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados",
  required,
  disabled,
  clearable = false,
  searchable,
  searchThreshold = 7,
  id,
  invalid,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const items: Item[] = React.useMemo(
    () =>
      options.map((o) => ({
        value: o.id,
        label: o.label,
        disabled: o.disabled,
        hint: o.hint ?? o.motivo,
        tone: o.tone,
        dot: o.dot,
        note: o.note,
      })),
    [options],
  );

  const byId = React.useMemo(() => {
    const m = new Map<string, Item>();
    for (const it of items) m.set(it.value, it);
    return m;
  }, [items]);

  const showSearch = searchable ?? options.length > searchThreshold;

  // Conversión string <-> objeto que requiere Base UI.
  const controlled = value !== undefined;
  const selectedItem = controlled ? byId.get(value ?? "") ?? null : undefined;
  const defaultItem =
    defaultValue !== undefined ? byId.get(defaultValue) ?? null : undefined;

  return (
    <ComboboxPrimitive.Root
      items={items}
      name={name}
      required={required}
      disabled={disabled}
      // Sin buscador visible no debe filtrarse nunca: si no, la query interna
      // (que Base UI llena con la selección) oculta el resto de las opciones.
      filter={showSearch ? undefined : null}
      {...(controlled
        ? { value: selectedItem }
        : defaultItem !== undefined
          ? { defaultValue: defaultItem }
          : {})}
      onValueChange={(v: Item | null) => onValueChange?.(v?.value ?? "")}
    >
      <ComboboxPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        data-invalid={invalid ? "" : undefined}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors",
          "hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid]:border-red-400 data-[invalid]:focus-visible:ring-red-100",
          "",
          triggerClassName,
        )}
      >
        <ComboboxPrimitive.Value>
          {(val: Item | null) =>
            val ? (
              <span className="truncate text-left">{val.label}</span>
            ) : (
              <span className="truncate text-left text-muted-foreground">
                {placeholder}
              </span>
            )
          }
        </ComboboxPrimitive.Value>
        <ComboboxPrimitive.Icon
          render={
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70" />
          }
        />
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          sideOffset={6}
          align="start"
          className="z-50 outline-none"
        >
          <ComboboxPrimitive.Popup
            className={cn(
              // El popup crece hasta el contenido para no cortar opciones largas,
              // con un piso = ancho del trigger y un techo = ancho disponible.
              "max-h-[min(22rem,var(--available-height))] w-max min-w-[var(--anchor-width)] max-w-[min(38rem,var(--available-width))] origin-[var(--transform-origin)]",
              "flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
              "transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              className,
            )}
          >
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <ComboboxPrimitive.Input
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <ComboboxPrimitive.Clear
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground data-[empty]:invisible"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-3.5" />
                </ComboboxPrimitive.Clear>
              </div>
            )}

            <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground empty:hidden">
              {emptyMessage}
            </ComboboxPrimitive.Empty>

            <ComboboxPrimitive.List className="max-h-full overflow-y-auto overscroll-contain p-1">
              {(item: Item) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  disabled={item.disabled}
                  title={item.hint}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2 rounded-md py-2 pl-2.5 pr-8 text-sm outline-none select-none",
                    "data-[highlighted]:bg-primary/10 data-[highlighted]:text-foreground",
                    "data-[selected]:font-medium",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                  )}
                >
                  {item.tone && (
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        item.tone === "busy" ? "bg-amber-500" : "bg-emerald-500",
                      )}
                    />
                  )}
                  {item.dot && (
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: item.dot }}
                    />
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.note && (
                    <span className="shrink-0 max-w-[48%] truncate text-[10px] font-medium text-amber-600">
                      {item.note}
                    </span>
                  )}
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2.5 flex items-center">
                    <Check className="size-4 text-primary" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>

            {clearable && (
              <ComboboxPrimitive.Clear
                className="border-t border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40 data-[empty]:hidden"
                aria-label="Quitar selección"
              >
                Quitar selección
              </ComboboxPrimitive.Clear>
            )}
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ *
 * SelectField — Combobox con label, icono y mensaje de error.
 * Reemplazo directo del patrón <select> con icono usado en los forms.
 * ------------------------------------------------------------------ */

export interface SelectFieldProps extends ComboboxProps {
  label?: string;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  error?: string;
  hint?: string;
}

export function SelectField({
  label,
  icon: Icon,
  error,
  hint,
  className,
  id,
  ...comboboxProps
}: SelectFieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-xs font-semibold text-muted-foreground"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex h-10 w-full items-center overflow-hidden rounded-lg border bg-card transition-all focus-within:ring-2",
          error
            ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-100"
            : "border-border focus-within:border-ring focus-within:ring-ring/20",
        )}
      >
        {Icon && (
          <div className="flex h-full w-10 shrink-0 items-center justify-center border-r border-border bg-muted/50 text-primary">
            <Icon size={15} />
          </div>
        )}
        <Combobox
          id={fieldId}
          invalid={!!error}
          triggerClassName="h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0"
          {...comboboxProps}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
