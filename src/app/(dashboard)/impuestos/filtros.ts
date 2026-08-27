/**
 * Las solapas del listado de impuestos, en un módulo sin `"use client"`.
 *
 * Viven acá y no adentro de `ImpuestosClient` porque también las usa la page,
 * que es un Server Component: una función exportada desde un archivo cliente no
 * se puede llamar desde el server (Next la reemplaza por una referencia y tira
 * "Attempted to call estadoDeParam() from the server").
 */

/** El estado en que está un impuesto, calculado desde su vencimiento. */
export type EstadoImpuesto = "presentado" | "vencido" | "por_vencer" | "pendiente";

/** La solapa elegida. "todos" es no filtrar. */
export type FiltroEstado = "todos" | EstadoImpuesto;

/** El `?estado=` de la URL, si es uno de los nuestros. Lo manda el resumen del día. */
export function estadoDeParam(valor: string | undefined | null): FiltroEstado | undefined {
  const validos: FiltroEstado[] = ["todos", "presentado", "vencido", "por_vencer", "pendiente"];
  return validos.includes(valor as FiltroEstado) ? (valor as FiltroEstado) : undefined;
}
