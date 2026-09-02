/**
 * A quién le llega el aviso de un vencimiento impositivo.
 *
 * Las alertas de impuestos se guardan como `tipo: "otro"` y sólo se distinguen
 * por `entidad_tipo` (ver lib/alertas-routing.ts). El prefijo de ese campo es lo
 * único que separa "esto lo espera todo el equipo administrativo" de "esto lo
 * ven tres personas", así que se calcula en un solo lugar y con un test al lado:
 * un contribuyente que caiga en el prefijo equivocado manda los datos fiscales
 * de una persona a la casilla de nueve.
 */

/** Columna de la matriz reservada al calendario de una persona física. */
export const COLUMNA_IMPUESTOS_PERSONALES = "impuestos_personales";

/**
 * Prefijo de `entidad_tipo` para el contribuyente. El umbral se le pega detrás
 * (`impuesto:T5`, `impuesto_personal:vencido`) y `alertaColumnaDe` lo resuelve
 * por prefijo.
 *
 * Falla del lado CERRADO: cualquier columna que no sea la pública `impuestos`
 * —una entidad nueva, un valor viejo, un null— se trata como personal. Un aviso
 * de menos se nota y se arregla; uno de más ya salió.
 */
export function prefijoAlertaImpuesto(columnaAlerta: string | null | undefined): string {
  return columnaAlerta === "impuestos" ? "impuesto:" : "impuesto_personal:";
}

/**
 * Cómo se nombra al contribuyente dentro del texto del aviso.
 *
 * Devuelve vacío para la empresa: "el impuesto IVA de Joaquín Hnos" en un
 * sistema que es de Joaquín Hnos no agrega nada, y esos avisos ya vienen
 * saliendo así desde junio. Para el resto sí, porque la gracia del aviso es
 * justamente saber de quién es la fila.
 */
export function sufijoEntidadEnAviso(
  entidad: { codigo: string; nombre: string } | null | undefined,
): string {
  if (!entidad || entidad.codigo === "joaquin_hnos") return "";
  return ` de ${entidad.nombre}`;
}
