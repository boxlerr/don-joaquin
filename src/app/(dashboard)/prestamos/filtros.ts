/**
 * Con qué lista de cuotas se entra a /prestamos, en un módulo sin `"use client"`.
 *
 * Igual que en impuestos: la page es un Server Component y no puede llamar a una
 * función exportada desde un archivo cliente.
 */

/** Qué cuotas muestra la lista. `proximos` es el estado sin filtro. */
export type FocoLista = "proximos" | "vencidas" | "manana" | "semana" | "mes";

/** El `?foco=` de la URL, si es uno de los nuestros. Lo manda el resumen del día. */
export function focoDeParam(valor: string | undefined | null): FocoLista | undefined {
  const validos: FocoLista[] = ["proximos", "vencidas", "manana", "semana", "mes"];
  return validos.includes(valor as FocoLista) ? (valor as FocoLista) : undefined;
}
