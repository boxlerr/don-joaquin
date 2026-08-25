/**
 * Tope de egresos de la caja: a partir de cuánta plata salida en el mes hay que
 * encender la alarma.
 *
 * Pedido de Julián (25/08/2026). Es el mismo mecanismo que el tope de préstamos
 * —la cuenta vive en `lib/topes`— pero mide otra cosa: allá es lo que hay que
 * PAGAR de cuotas, acá es lo que YA SALIÓ de la caja en el mes en curso.
 *
 * **Es por caja y a propósito.** La chica es la operativa (viáticos, gomerías,
 * la nafta de la ruta) y la general es la de dirección: mezclarlas en un solo
 * número daría un tope que no significa nada para ninguna de las dos.
 *
 * **Sin configurar no molesta.** Mientras el tope sea `null` la barra no
 * aparece: en su lugar queda un renglón para ponerlo. Un tope en cero es "sin
 * tope", no "avisar siempre" — ver `lib/topes`.
 */

import { limpiarTope } from "@/lib/topes";

export { excedeTope, carga, nivel } from "@/lib/topes";
export type { Exceso, Nivel } from "@/lib/topes";

export const TOPES_CAJA_CLAVE = "caja_topes";

/** Las dos cajas reales, tal como se guardan en `caja_movimientos.caja`. */
export type CajaTopeId = "diaria" | "grande";

export const CAJAS_CON_TOPE: CajaTopeId[] = ["diaria", "grande"];

/** Cuánto puede salir por mes de cada caja. `null` = sin tope. */
export type TopesCaja = Record<CajaTopeId, number | null>;

export const TOPES_CAJA_DEFAULT: TopesCaja = { diaria: null, grande: null };

/** Normaliza lo que venga de la base o del formulario a una config válida. */
export function mergeTopesCaja(raw: unknown): TopesCaja {
  if (!raw || typeof raw !== "object") return { ...TOPES_CAJA_DEFAULT };
  const o = raw as Record<string, unknown>;
  return { diaria: limpiarTope(o.diaria), grande: limpiarTope(o.grande) };
}

export function hayAlgunTopeCaja(t: TopesCaja): boolean {
  return CAJAS_CON_TOPE.some((c) => t[c] != null);
}

/**
 * El tope que corresponde a lo que se está mirando.
 *
 * La pantalla tiene un filtro con tres opciones y una de ellas es "Todas las
 * cajas", que no tiene tope propio: sumar los dos daría un número que nadie
 * configuró. En ese caso no se muestra barra.
 */
export function topeDe(topes: TopesCaja, caja: string): number | null {
  return caja === "diaria" || caja === "grande" ? topes[caja] : null;
}

/** Primer día del mes de una fecha ISO, en formato "YYYY-MM-01". */
export function inicioDeMes(hoyISO: string): string {
  return `${hoyISO.slice(0, 7)}-01`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "agosto de 2026", para los textos de la barra y de la alerta. */
export function nombreDeMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1]} de ${y}`;
}
