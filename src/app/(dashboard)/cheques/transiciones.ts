/**
 * Reglas de estado de un cheque, separadas de los server actions para poder
 * testearlas (y porque un archivo "use server" sólo puede exportar funciones
 * async).
 */

export type ChequeTipo = "comun" | "diferido" | "electronico";

export type ChequeMotivoRechazo =
  | "sin_fondos"
  | "firma_no_corresponde"
  | "cuenta_cerrada"
  | "formal"
  | "otro";

/**
 * De qué lado está el cheque: `recibido` nos lo dio un tercero y es plata a
 * cobrar; `propio` lo emitimos nosotros y es plata que sale. Cada uno tiene su
 * propio circuito de estados.
 */
export type ChequeOrigen = "recibido" | "propio";

export type ChequeEstado =
  // recibidos
  | "cartera"
  | "depositado"
  | "acreditado"
  // propios
  | "emitido"
  | "debitado"
  // comunes a los dos
  | "entregado"
  | "rechazado"
  | "anulado";

/**
 * Un cheque recibido se cobra: entra en cartera y de ahí se endosa, se
 * deposita y se acredita. Uno propio se paga: se emite, se entrega y termina
 * debitado de la cuenta. Por eso las transiciones dependen del origen.
 */
export const TRANSICIONES_VALIDAS: Record<
  ChequeOrigen,
  Record<ChequeEstado, ChequeEstado[]>
> = {
  recibido: {
    cartera: ["entregado", "depositado", "rechazado", "anulado"],
    entregado: [],
    depositado: ["acreditado", "rechazado"],
    acreditado: [],
    rechazado: [],
    anulado: [],
    emitido: [],
    debitado: [],
  },
  propio: {
    emitido: ["entregado", "debitado", "rechazado", "anulado"],
    // Entregado no es el final de un cheque nuestro: falta que lo cobren.
    entregado: ["debitado", "rechazado", "anulado"],
    debitado: [],
    rechazado: [],
    anulado: [],
    cartera: [],
    depositado: [],
    acreditado: [],
  },
};

export function validateTransicion(
  actual: ChequeEstado,
  destino: ChequeEstado,
  origen: ChequeOrigen,
): string | null {
  const permitidas = TRANSICIONES_VALIDAS[origen][actual];
  if (!permitidas.includes(destino)) {
    return `No se puede pasar de "${actual}" a "${destino}".`;
  }
  return null;
}

/**
 * Dónde arranca un cheque recién cargado. Uno que recibimos entra en cartera;
 * uno nuestro queda emitido, salvo que ya se sepa a quién se le dio.
 */
export function estadoInicial(origen: ChequeOrigen, entregadoA: string | null): ChequeEstado {
  if (origen !== "propio") return "cartera";
  return entregadoA ? "entregado" : "emitido";
}

/** Estados desde los que todavía se puede corregir de qué lado es el cheque. */
export const ESTADOS_ORIGEN_EDITABLE: ChequeEstado[] = ["cartera", "emitido", "anulado"];

export function puedeCambiarOrigen(estado: ChequeEstado): boolean {
  return ESTADOS_ORIGEN_EDITABLE.includes(estado);
}

/**
 * Al corregir de qué lado es un cheque, el punto de partida cambia de nombre:
 * "en cartera" y "emitido" son el mismo momento visto desde cada lado.
 * Devuelve null si el estado no necesita traducción (ej: anulado).
 */
export function estadoAlCambiarOrigen(
  estado: ChequeEstado,
  origenNuevo: ChequeOrigen,
): ChequeEstado | null {
  if (origenNuevo === "propio" && estado === "cartera") return "emitido";
  if (origenNuevo === "recibido" && estado === "emitido") return "cartera";
  return null;
}

/** Los estados que puede tener un cheque de cada lado. */
export const ESTADOS_POR_ORIGEN: Record<ChequeOrigen, ChequeEstado[]> = {
  recibido: ["cartera", "entregado", "depositado", "acreditado", "rechazado", "anulado"],
  propio: ["emitido", "entregado", "debitado", "rechazado", "anulado"],
};

/**
 * Si el cheque tiene que dejar un egreso en la caja.
 *
 * Sólo el cheque nuestro YA DEBITADO: recién ahí la plata salió de la cuenta.
 * Uno emitido o entregado todavía no se cobró, y anotarlo como egreso mostraría
 * plata que sigue estando.
 *
 * Es una función y no una constante porque se consulta en los dos sentidos: si
 * un cheque debitado se corrige a otro estado, el egreso se borra. Eso evita el
 * egreso fantasma de un cheque que al final no se pagó.
 */
export function dejaEgresoEnCaja(origen: ChequeOrigen, estado: ChequeEstado): boolean {
  return origen === "propio" && estado === "debitado";
}

/**
 * Corregir el estado a mano, sin pasar por las transiciones.
 *
 * Hace falta porque equivocarse es normal: anular un cheque por error dejaba la
 * fila muerta para siempre, sin forma de volver. Esto no reemplaza al circuito
 * normal (que es el que registra a quién se le endosó, en qué banco se
 * depositó, etc.) — es la marcha atrás, y queda asentada en el historial.
 */
export function puedeCorregirseA(estado: ChequeEstado, origen: ChequeOrigen): boolean {
  return ESTADOS_POR_ORIGEN[origen].includes(estado);
}
