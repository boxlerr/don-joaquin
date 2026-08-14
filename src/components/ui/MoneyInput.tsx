"use client";

/**
 * Campo de plata.
 *
 * Reemplaza al `<input type="number">` que se usaba para los importes, que tenía
 * tres problemas y los tres se notaban en la pantalla de Préstamos:
 *
 *   1. Mostraba el número pelado. La cuota de AFIP se leía `116181206.2`: para
 *      saber si son ciento dieciséis millones u once mil millones había que
 *      contar las cifras con el dedo, y ese punto no era de miles sino la coma
 *      de los centavos escrita al revés.
 *   2. Las flechitas del costado. Ocupan lugar, se tocan sin querer y en un
 *      importe de nueve cifras no sirven para nada.
 *   3. La rueda del mouse cambiaba el valor. Scrollear la página con el cursor
 *      encima del campo le sumaba millones sin que nadie se enterara.
 *
 * Acá el campo es de texto (`inputMode="decimal"` para que el celular abra el
 * teclado de números igual) y lo que se ve son puntos de miles a medida que se
 * escribe. Lo que sale por `onValueChange` sigue siendo el número, así que las
 * acciones del servidor no cambian.
 *
 * Sirve también para porcentajes y para cualquier número largo: con `sufijo="%"`
 * y sin `prefijo` es el campo de tasa.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatMientrasEscribe, formatMonto, parseMonto } from "@/lib/monto";
import { cn } from "@/lib/utils";

type Props = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** El número guardado. `null` es "el campo está vacío", que no es lo mismo que 0. */
  value: number | null;
  onValueChange: (valor: number | null) => void;
  /** Lo que va pegado a la izquierda adentro del campo. `null` para ninguno. */
  prefijo?: string | null;
  /** Lo que va pegado a la derecha adentro del campo (ej. `%`). */
  sufijo?: string | null;
};

export function MoneyInput({
  value,
  onValueChange,
  prefijo = "$",
  sufijo = null,
  className,
  ...props
}: Props) {
  // Lo tipeado se guarda tal cual se ve, con los puntos: reformatear desde el
  // número en cada tecla borraría la coma recién puesta y el `0` a medio
  // escribir de los centavos.
  const [texto, setTexto] = React.useState(() => (value == null ? "" : formatMonto(value)));

  // Si el valor cambia desde afuera (se abre el diálogo con otro préstamo, se
  // resetea el formulario), el campo se pone al día. Se compara por número y no
  // por texto para no pisar lo que se está escribiendo en ese momento.
  const ultimoEmitido = React.useRef(value);
  React.useEffect(() => {
    if (value === ultimoEmitido.current) return;
    ultimoEmitido.current = value;
    setTexto(value == null ? "" : formatMonto(value));
  }, [value]);

  const alEscribir = (crudo: string) => {
    const visible = formatMientrasEscribe(crudo);
    setTexto(visible);
    const n = parseMonto(visible);
    ultimoEmitido.current = n;
    onValueChange(n);
  };

  return (
    <div className="relative">
      {prefijo && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground max-md:left-3"
        >
          {prefijo}
        </span>
      )}
      <Input
        {...props}
        // `text` y no `number`: es lo que permite mostrar los puntos de miles, y
        // de paso se van las flechitas y el cambio de valor al scrollear.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        className={cn(
          "tabular-nums",
          prefijo ? "pl-6 max-md:pl-7" : "",
          sufijo ? "pr-7" : "",
          className,
        )}
      />
      {sufijo && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {sufijo}
        </span>
      )}
    </div>
  );
}

export default MoneyInput;
