"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * PlaceCombobox — autocompletado de TEXTO LIBRE estilizado.
 *
 * Pensado para campos de lugar (origen / destino) donde el usuario puede
 * escribir cualquier ciudad pero también elegir de una lista de puntos
 * conocidos. Reemplaza al <datalist> nativo (que en macOS se ve feo y no
 * se puede estilar) por un desplegable propio con los colores de la web.
 *
 *   - value / onValueChange  -> el texto (string), controlado.
 *   - onSelect               -> dispara SOLO al elegir una opción de la
 *                               lista (no al tipear). Útil para autocompletar
 *                               km al instante cuando se elige el destino.
 *   - onRemoveOption         -> si se pasa, cada sugerencia lleva una X para
 *                               sacarla de la lista (no toca lo ya cargado).
 *   - name                   -> participa en <form> con un hidden input.
 *
 * El popup respeta el ancho del campo, hace scroll y funciona con teclado
 * y touch. Si lo que se escribe no coincide con ningún punto, igual se
 * conserva como texto libre.
 * ------------------------------------------------------------------ */

export interface PlaceComboboxProps {
  label?: string;
  name: string;
  value: string;
  onValueChange: (text: string) => void;
  /** Se dispara solo cuando se elige una opción del desplegable. */
  onSelect?: (text: string) => void;
  /**
   * Si se pasa, cada sugerencia lleva una X para sacarla de la lista. Sirve
   * para catálogos que se llenan solos (bancos, libradores) y terminan con
   * nombres mal escritos.
   */
  onRemoveOption?: (option: { id: string; label: string }) => void;
  /** Texto del tooltip de la X. */
  removeTitle?: string;
  /**
   * Las sugerencias. `removable: false` deja una opción sin la X: sirve para
   * mezclar en una misma lista las fijas del sistema con las que se fueron
   * escribiendo (sólo estas últimas se pueden sacar).
   */
  options: { id: string; label: string; removable?: boolean }[];
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  error?: string;
  hint?: string;
  placeholder?: string;
  /** Para que una etiqueta de afuera pueda apuntar al campo con `htmlFor`. */
  inputId?: string;
}

export function PlaceCombobox({
  label,
  name,
  value,
  onValueChange,
  onSelect,
  onRemoveOption,
  removeTitle = "Sacar de la lista",
  options,
  icon: Icon,
  error,
  hint,
  placeholder = "Escribí o elegí un lugar...",
  inputId,
}: PlaceComboboxProps) {
  const items = React.useMemo(() => options.map((o) => o.label), [options]);
  const autoId = React.useId();
  const fieldId = inputId ?? autoId;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={fieldId}
          className="text-xs font-semibold text-muted-foreground"
        >
          {label}
        </label>
      )}

      <ComboboxPrimitive.Root
        items={items}
        // Texto libre: atamos `value` (selección) e `inputValue` (texto) al
        // mismo string. Así Base UI no borra lo tipeado al cerrar el popup
        // (en modo single, al cerrar sincroniza el input con la selección;
        // como ambos coinciden, no toca nada) y conservamos lo escrito aunque
        // no esté en la lista.
        value={value}
        inputValue={value}
        onValueChange={(v: string | null) => onValueChange(v ?? "")}
        onInputValueChange={(text: string, details) => {
          onValueChange(text);
          // `item-press` = el usuario eligió una opción del desplegable.
          if (details.reason === "item-press") onSelect?.(text);
        }}
        openOnInputClick
      >
        {/* Valor para el submit del <form> (server action). */}
        <input type="hidden" name={name} value={value} />

        <div
          className={cn(
            "flex h-10 w-full items-center overflow-hidden rounded-lg border bg-card transition-all focus-within:ring-2",
            error
              ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-100"
              : "border-border focus-within:border-[#0088D1] focus-within:ring-[#0088D1]/20",
          )}
        >
          {Icon && (
            <div className="flex h-full w-10 shrink-0 items-center justify-center border-r border-border bg-muted/50 text-primary">
              <Icon size={15} />
            </div>
          )}
          <ComboboxPrimitive.Input
            id={fieldId}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner
            sideOffset={6}
            align="start"
            className="z-[60] outline-none"
          >
            <ComboboxPrimitive.Popup
              className={cn(
                // Arranca del ancho del campo pero puede crecer: en un campo
                // angosto un nombre largo se cortaba a la mitad.
                "max-h-[min(18rem,var(--available-height))] w-max min-w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)]",
                "flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
                "transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              )}
            >
              <ComboboxPrimitive.Empty className="px-3 py-3 text-center text-xs text-muted-foreground empty:hidden">
                Sin coincidencias — se usará lo que escribiste.
              </ComboboxPrimitive.Empty>

              <ComboboxPrimitive.List className="max-h-full overflow-y-auto overscroll-contain p-1">
                {(item: string) => {
                  const opcion = options.find((o) => o.label === item);
                  const borrable = !!onRemoveOption && opcion?.removable !== false;
                  return (
                  <ComboboxPrimitive.Item
                    key={item}
                    value={item}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-2 rounded-md py-2 pl-2.5 text-sm outline-none select-none",
                      borrable ? "pr-2" : "pr-8",
                      "data-[highlighted]:bg-[#0088D1]/10 data-[highlighted]:text-foreground",
                    )}
                  >
                    <span className="flex-1 break-words">{item}</span>
                    {borrable ? (
                      <>
                        {/* Ancho fijo: sin esto la X se corre de fila en fila. */}
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          <ComboboxPrimitive.ItemIndicator>
                            <Check className="size-4 text-primary" />
                          </ComboboxPrimitive.ItemIndicator>
                        </span>
                        <button
                          type="button"
                          title={removeTitle}
                          aria-label={`${removeTitle}: ${item}`}
                          // El clic no tiene que elegir la opción, solo borrarla.
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (opcion) onRemoveOption?.(opcion);
                          }}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <ComboboxPrimitive.ItemIndicator className="absolute right-2.5 flex items-center">
                        <Check className="size-4 text-primary" />
                      </ComboboxPrimitive.ItemIndicator>
                    )}
                  </ComboboxPrimitive.Item>
                  );
                }}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>

      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
