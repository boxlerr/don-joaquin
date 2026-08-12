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

/** Los dos períodos con los que puede abrir la pantalla. Ver `periodoInicial`. */
export type PeriodoInicial = { tipo: "ventana" } | { tipo: "mes"; mes: string };

/**
 * Con qué período abre la caja.
 *
 * La caja chica ES los últimos 30 días (así lo dice su encabezado y así lo acota
 * el server en `acotarDesde`), así que abre con eso: hoy siempre a la vista y,
 * de yapa, nunca vacía.
 *
 * Antes abría en "el último mes CON movimientos", y por eso un 11 de agosto sin
 * nada cargado todavía te dejaba parado en julio: los números de arriba decían
 * julio, la franja de abajo decía "hoy 11/08" y lo cargado el 1 y el 5 de agosto
 * no aparecía en ninguna parte. La caja general no tiene ventana, así que abre
 * en el mes corriente — vacío es una respuesta válida; mandar al mes pasado sin
 * avisar, no (para eso está el botón "Sin movimientos · ver julio").
 *
 * Vive acá y no en el componente para poder probarse: el módulo del dashboard
 * arrastra las server actions de la caja.
 */
export function periodoInicial(ventanaDesde: string | undefined, mes: string): PeriodoInicial {
  return ventanaDesde ? { tipo: "ventana" } : { tipo: "mes", mes };
}
