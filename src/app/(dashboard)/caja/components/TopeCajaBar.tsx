"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import TopeCajaDialog from "./TopeCajaDialog";
import { carga, nivel, nombreDeMes, topeDe, type TopesCaja } from "../topes";

/**
 * La franja del tope de egresos del mes, debajo del saldo.
 *
 * Tres estados y tres pesos visuales distintos, a propósito:
 *
 *  · **Sin tope** — un renglón fino, gris, con el botón para ponerlo. Tiene que
 *    estar a la vista para que se configure, pero no puede ocupar el lugar de un
 *    dato: todavía no dice nada.
 *  · **En orden** — la barra y los números, sin color. Es información de fondo.
 *  · **Cerca o pasado** — recién ahí se tiñe. Si la franja gritara siempre,
 *    para el mes que se pasa de verdad no quedaría ningún registro más alto.
 *
 * El color va en la barra y en el número, nunca en el fondo entero de la
 * tarjeta: un bloque de color se lee como un error del sistema y no como un
 * dato de la operación.
 */

type Props = {
  /** Qué caja se está mirando: "diaria", "grande" o "todas". */
  caja: string;
  topes: TopesCaja;
  /** Egresos del mes en curso por caja, ya calculados en el servidor. */
  egresos: Record<string, number>;
  /** Primer día del mes en curso ("YYYY-MM-01"), para rotularlo. */
  mes: string;
  puedeEditar: boolean;
  /** La caja general la edita sólo quien puede escribir en ella. */
  puedeEditarGeneral: boolean;
};

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

export default function TopeCajaBar({
  caja,
  topes,
  egresos,
  mes,
  puedeEditar,
  puedeEditarGeneral,
}: Props) {
  const [open, setOpen] = useState(false);

  const tope = topeDe(topes, caja);
  const total = egresos[caja] ?? 0;

  // "Todas las cajas" no tiene tope propio: sumar los dos daría un número que
  // nadie configuró. Ahí la franja no va.
  if (caja !== "diaria" && caja !== "grande") return null;

  const dialogo = (
    <TopeCajaDialog
      open={open}
      onOpenChange={setOpen}
      topes={topes}
      puedeEditarGeneral={puedeEditarGeneral}
    />
  );

  if (tope == null) {
    if (!puedeEditar) return null;
    return (
      <>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-dashed border-border px-3.5 py-2 sm:mt-3">
          <p className="text-xs text-muted-foreground">
            Esta caja no tiene un tope de gastos. Con uno puesto, el sistema avisa cuando el mes
            se pasa.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted max-md:h-9"
          >
            <Plus size={13} />
            Poner un tope
          </button>
        </div>
        {dialogo}
      </>
    );
  }

  const n = nivel(total, tope);
  const pct = Math.min((carga(total, tope) ?? 0) * 100, 100);
  const restante = tope - total;

  const barra =
    n === "excedido" ? "bg-rose-600" : n === "cerca" ? "bg-amber-500" : "bg-primary";
  const cifra =
    n === "excedido" ? "text-rose-700" : n === "cerca" ? "text-amber-700" : "text-foreground";
  const borde = n === "excedido" ? "border-rose-200" : "border-border";

  return (
    <>
      <div className={`mt-2 rounded-[10px] border ${borde} bg-card px-3.5 py-2.5 sm:mt-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs text-muted-foreground">
            Salió en {nombreDeMes(mes)}{" "}
            <span className={`whitespace-nowrap font-semibold tabular-nums ${cifra}`}>
              {ars(total)}
            </span>
            <span className="whitespace-nowrap text-muted-foreground"> de {ars(tope)}</span>
          </p>
          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
            <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              {n === "excedido" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                  <AlertTriangle size={12} />
                  {ars(-restante)} por encima
                </span>
              ) : (
                <>Quedan {ars(restante)}</>
              )}
            </p>
            {puedeEditar && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                title="Cambiar el tope"
                aria-label="Cambiar el tope"
                className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-md:size-9"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        </div>

        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Consumido del tope de ${nombreDeMes(mes)}`}
        >
          <div className={`h-full rounded-full transition-all ${barra}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {dialogo}
    </>
  );
}
