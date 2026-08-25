/**
 * Las cuatro cifras de arriba de /cheques, y qué cheques hay detrás de cada una.
 *
 * Pedido de Julián (25/08/2026): *"dice 1 vencido pero no sé cuál es, quiero
 * hacerle click y que me lo muestre"*. Una cifra que no se puede abrir obliga a
 * reconstruir a mano el filtro que la produjo — y a veces ni se sabe cuál era.
 *
 * **Por eso `pertenece` es una sola función y la usan las dos puntas.** La
 * tarjeta cuenta con ella y la lista filtra con ella. Si el conteo viviera de un
 * lado y el filtro del otro, tarde o temprano dirían cosas distintas: es
 * exactamente el bug que tenía la tarjeta "Cheques nuestros", que contaba todos
 * los cheques bajo un título que hablaba de los propios.
 */

import type { ChequeEstado, ChequeOrigen } from "./transiciones";

/** Cuál de las cuatro cifras. `null` = sin recorte, se ve todo. */
export type VistaResumen = "cartera" | "por_vencer" | "vencidos" | "nuestros";

export type ChequeParaResumen = {
  origen: ChequeOrigen;
  estado: ChequeEstado;
  importe: number;
  fecha_vencimiento: string;
};

/**
 * Si un cheque entra en una de las cifras.
 *
 * «En cartera» es sólo lo que nos deben: un cheque nuestro es plata que sale y
 * se cuenta aparte. «Por vencer» y «Vencidos» son recortes de la cartera por
 * fecha, no estados propios.
 */
export function pertenece(
  c: ChequeParaResumen,
  vista: VistaResumen,
  hoyISO: string,
  en7diasISO: string,
): boolean {
  if (vista === "nuestros") {
    return c.origen === "propio" && (c.estado === "emitido" || c.estado === "entregado");
  }

  const enCartera = c.origen === "recibido" && c.estado === "cartera";
  if (!enCartera) return false;

  if (vista === "cartera") return true;
  if (vista === "vencidos") return c.fecha_vencimiento < hoyISO;
  // Por vencer: de hoy en adelante y dentro de la ventana. Un cheque que ya
  // venció NO está "por vencer" — ya es del cuadro de al lado.
  return c.fecha_vencimiento >= hoyISO && c.fecha_vencimiento <= en7diasISO;
}

export type CifraResumen = { total: number; cantidad: number };

export function cifra(
  cheques: ChequeParaResumen[],
  vista: VistaResumen,
  hoyISO: string,
  en7diasISO: string,
): CifraResumen {
  let total = 0;
  let cantidad = 0;
  for (const c of cheques) {
    if (!pertenece(c, vista, hoyISO, en7diasISO)) continue;
    total += Number(c.importe) || 0;
    cantidad += 1;
  }
  return { total, cantidad };
}

/** El lado del listado que corresponde a cada cifra, para posicionar la solapa. */
export function origenDeVista(vista: VistaResumen): ChequeOrigen {
  return vista === "nuestros" ? "propio" : "recibido";
}
