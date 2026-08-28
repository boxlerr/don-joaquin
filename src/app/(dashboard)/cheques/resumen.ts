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
 *
 * **Las cifras no cambiaron; los rótulos sí** (audio de Bárbara, 28/08/2026):
 * *"yo en fecha de vencimiento lo que le pongo es la fecha que nosotros pusimos
 * de pago de ese cheque, pero no quiere decir que está vencido"*. Un cheque que
 * se pasó de esa fecha no dejó de servir: quien lo tiene lo puede presentar al
 * banco un buen rato después. Por eso las dos tarjetas se llaman "Próximos a
 * cobrar" y "Pasados de fecha", y ninguna dice "vencido". Adentro, en la base y
 * en este archivo, las claves siguen siendo `por_vencer` y `vencidos`: renombrarlas
 * tocaría los links guardados (`/cheques?vista=vencidos`), el histórico y la
 * columna `fecha_vencimiento` de miles de cheques ya cargados, sin cambiar una
 * sola cosa de lo que se ve.
 */

import { chequeReclama } from "@/lib/alertas-live";
import type { ChequeEstado, ChequeOrigen } from "./transiciones";

/**
 * Cuál de las cuatro cifras. `null` = sin recorte, se ve todo.
 *
 * `avisos` no es una cifra de la pantalla: es el recorte con el que se entra
 * desde el resumen del día ("Cheques 3 vencidos de 21" → /cheques?vista=avisos).
 * Son exactamente los cheques que el sistema puede llegar a avisar —los que
 * todavía piden algo— y no un estado ni una ventana de fechas. Sin esto, tocar
 * la tarjeta caía en la lista completa y había que rearmar a mano el filtro que
 * produjo el número, que es justo lo que las cifras abribles vinieron a evitar.
 */
export type VistaResumen = "cartera" | "por_vencer" | "vencidos" | "nuestros" | "avisos";

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
 * se cuenta aparte. «Por vencer» es un recorte de la cartera por fecha, no un
 * estado propio. «Vencidos», en cambio, es de los dos lados: lo que se pasó de
 * fecha y sigue sin resolverse, sea plata que entra o que sale.
 */
export function pertenece(
  c: ChequeParaResumen,
  vista: VistaResumen,
  hoyISO: string,
  en7diasISO: string,
  /**
   * Hasta cuándo mira el aviso (hoy + `dias_alerta_cheque`). Sólo lo usa la
   * vista `avisos`, y es lo que hace que la lista muestre EXACTAMENTE los que
   * contó la tarjeta del resumen: sin este corte decía "21" y abría 38, porque
   * traía también los que vencen dentro de tres meses.
   */
  hastaAvisoISO?: string,
): boolean {
  if (vista === "nuestros") {
    return c.origen === "propio" && (c.estado === "emitido" || c.estado === "entregado");
  }

  // Los que siguen reclamando algo, de los dos lados. Misma regla que usan los
  // avisos (`chequeReclama`), para que la lista muestre exactamente lo que la
  // tarjeta contó: uno recibido reclama mientras está en cartera; uno nuestro,
  // hasta que el banco lo debita.
  if (vista === "avisos") {
    if (!chequeReclama(c.origen, c.estado)) return false;
    // Vencido siempre entra; lo que todavía no venció, sólo si ya está dentro de
    // la ventana de aviso.
    if (c.fecha_vencimiento < hoyISO) return true;
    return hastaAvisoISO ? c.fecha_vencimiento <= hastaAvisoISO : true;
  }

  // VENCIDOS es de los DOS lados, y por eso se resuelve antes del recorte por
  // cartera. Miraba sólo los recibidos, así que el 27/08/2026 la pantalla
  // mostraba "Vencidos $0,00 · 0 sin gestionar" mientras había tres cheques
  // NUESTROS pasados de fecha y sin debitar —uno de $3.000.000 de hacía 43
  // días—. Un cheque nuestro que venció y no se debitó es exactamente lo que
  // hay que ir a mirar al banco.
  if (vista === "vencidos") {
    return chequeReclama(c.origen, c.estado) && c.fecha_vencimiento < hoyISO;
  }

  const enCartera = c.origen === "recibido" && c.estado === "cartera";
  if (!enCartera) return false;

  if (vista === "cartera") return true;
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
  hastaAvisoISO?: string,
): CifraResumen {
  let total = 0;
  let cantidad = 0;
  for (const c of cheques) {
    if (!pertenece(c, vista, hoyISO, en7diasISO, hastaAvisoISO)) continue;
    total += Number(c.importe) || 0;
    cantidad += 1;
  }
  return { total, cantidad };
}

/**
 * El lado del listado que corresponde a cada cifra, para posicionar la solapa.
 * `avisos` mezcla los dos lados a propósito, así que se queda en "todos".
 */
export function origenDeVista(vista: VistaResumen): ChequeOrigen | "todos" {
  // `avisos` y `vencidos` mezclan los dos lados a propósito.
  if (vista === "avisos" || vista === "vencidos") return "todos";
  return vista === "nuestros" ? "propio" : "recibido";
}

/** El `?vista=` de la URL, si es una de las nuestras. */
export function vistaDeParam(valor: string | undefined | null): VistaResumen | null {
  const vistas: VistaResumen[] = ["cartera", "por_vencer", "vencidos", "nuestros", "avisos"];
  return vistas.includes(valor as VistaResumen) ? (valor as VistaResumen) : null;
}
