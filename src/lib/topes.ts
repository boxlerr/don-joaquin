/**
 * Un tope es un número que avisa por vos.
 *
 * Nació en Préstamos (pedido del padre de Bárbara: *"che, fijate que la semana
 * que viene los préstamos superan los 300 millones"*) y la Caja necesita
 * exactamente la misma cuenta sobre otra plata, así que las funciones puras
 * viven acá y cada sección pone su modelo encima.
 *
 * Lo único que hay que respetar en los dos lados: **un tope en cero no
 * significa "avisar siempre", significa "sin tope"**. Es la diferencia entre
 * una pantalla que grita desde el primer día y una que se queda callada hasta
 * que la configuran.
 */

/** Normaliza lo que venga de la base o de un formulario a un tope válido. */
export function limpiarTope(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type Exceso = {
  /** Cuánto se pasó, en plata. */
  exceso: number;
  /** Cuánto se pasó, en porcentaje sobre el tope. */
  porcentaje: number;
};

/** Null si no hay tope o si no se pasa. */
export function excedeTope(total: number, tope: number | null): Exceso | null {
  if (tope == null || tope <= 0 || total <= tope) return null;
  return { exceso: total - tope, porcentaje: ((total - tope) / tope) * 100 };
}

/**
 * Qué tan cargado está un período respecto de su tope, de 0 a 1+. Sirve para
 * pintar la barra: verde hasta 0.85, ámbar hasta 1, rojo pasado el tope.
 */
export function carga(total: number, tope: number | null): number | null {
  if (tope == null || tope <= 0) return null;
  return total / tope;
}

export type Nivel = "ok" | "cerca" | "excedido";

export function nivel(total: number, tope: number | null): Nivel {
  const c = carga(total, tope);
  if (c == null) return "ok";
  if (c > 1) return "excedido";
  if (c >= 0.85) return "cerca";
  return "ok";
}
