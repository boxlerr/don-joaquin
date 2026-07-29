/**
 * La caja chica es una ventana móvil, no un archivo: el operativo trabaja el
 * último mes y el historial largo vive en la caja general, que es de dirección
 * (pedido 29/07).
 *
 * Vive fuera de actions.ts porque ese módulo es "use server" y solo puede
 * exportar funciones async.
 */
export const VENTANA_CAJA_CHICA_DIAS = 30;

/** Primer día visible de la caja chica para el operativo ("YYYY-MM-DD"). */
export function desdeVentanaCajaChica(): string {
  const limite = new Date();
  limite.setDate(limite.getDate() - VENTANA_CAJA_CHICA_DIAS);
  return limite.toISOString().slice(0, 10);
}
