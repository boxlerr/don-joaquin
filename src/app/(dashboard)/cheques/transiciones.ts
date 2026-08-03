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
