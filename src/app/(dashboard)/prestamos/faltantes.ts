/**
 * Qué le falta cargar a un préstamo.
 *
 * Antes esto era una frase suelta ("el importe de la cuota y la tasa") que
 * había que borrar a mano después de completar el dato. Ahora los datos que el
 * sistema PUEDE mirar son marcas (`faltantes`) que se apagan solas en cuanto el
 * campo se llena; la frase libre (`datos_faltantes`) queda sólo para lo que el
 * sistema no tiene forma de verificar, como "si es un pago único o parte de un
 * plan en cuotas".
 */

/** Datos que el sistema puede verificar por su cuenta. */
export const FALTANTES = ["monto", "importe", "tasa"] as const;
export type Faltante = (typeof FALTANTES)[number];

const LABEL: Record<Faltante, string> = {
  monto: "el monto del préstamo",
  importe: "el importe de la cuota",
  tasa: "la tasa",
};

/** Lo mínimo que hace falta para saber si una marca sigue vigente. */
export type PrestamoParaFaltantes = {
  detalle: string | null;
  importe_cuota: number;
  tasa: number | null;
  faltantes: string[];
  datos_faltantes: string | null;
};

function esFaltante(v: string): v is Faltante {
  return (FALTANTES as readonly string[]).includes(v);
}

/** ¿Ese dato sigue sin estar cargado? */
export function siguePendiente(f: Faltante, p: PrestamoParaFaltantes): boolean {
  switch (f) {
    case "monto":
      return !p.detalle?.trim();
    case "importe":
      return !(p.importe_cuota > 0);
    case "tasa":
      return p.tasa == null;
  }
}

/**
 * Las marcas que todavía tienen sentido. Una marca de un dato que ya se cargó
 * desaparece sola: no hay que acordarse de sacarla.
 */
export function faltantesVigentes(p: PrestamoParaFaltantes): Faltante[] {
  return p.faltantes.filter(esFaltante).filter((f) => siguePendiente(f, p));
}

/** ¿Hay que mostrarle el triangulito? */
export function tieneFaltantes(p: PrestamoParaFaltantes): boolean {
  return faltantesVigentes(p).length > 0 || !!p.datos_faltantes?.trim();
}

/** "el importe de la cuota, la tasa y si es un pago único" — para el aviso. */
export function textoFaltantes(p: PrestamoParaFaltantes): string | null {
  const partes = faltantesVigentes(p).map((f) => LABEL[f]);
  const nota = p.datos_faltantes?.trim();
  if (nota) partes.push(nota);
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0]!;
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** Etiqueta corta de una marca, para las listas del diálogo. */
export function etiquetaFaltante(f: Faltante): string {
  return LABEL[f];
}
