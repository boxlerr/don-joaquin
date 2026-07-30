import type { CellValue } from "@/lib/excel/professional-sheet";
import type { ChoferEnDestino, DestinoResumen, ViajeDelResumen } from "./actions";

/**
 * Las filas del Excel del resumen.
 *
 * Está aparte de la acción para poder probarlo: acá vive la regla de cuándo una
 * celda va vacía y cuándo va con número, que es donde se cuela el error caro.
 *
 * La regla es **decir lo mismo que la pantalla**:
 *
 * - `tonelaje_real` y `monto_flete` aceptan null, así que un 0 casi siempre
 *   significa "todavía no lo cargaron". La pantalla muestra "—" y "sin
 *   importe"; el Excel va vacío. Escribir 0 sería peor que no escribir nada:
 *   alguien lo suma y el total queda mintiendo con cara de dato.
 * - `km_con_carga` es NOT NULL: el 0 es un valor real. Va como 0, igual que en
 *   pantalla.
 */

/** Vacío cuando no hay dato cargado (null o 0). */
export function siHay(n: number | null | undefined): number | null {
  return n ? n : null;
}

export function fmtFechaExport(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Una fila de la hoja "Por destino": el resumen de ese chofer a ese destino. */
export function filaChofer(c: ChoferEnDestino): CellValue[] {
  return [
    c.chofer,
    c.camion ?? "—",
    c.viajes,
    siHay(c.toneladas),
    siHay(c.km),
    fmtFechaExport(c.ultimo),
  ];
}

/** Una fila de la hoja "Viaje por viaje". */
export function filaViaje(
  destino: string,
  chofer: string,
  camion: string | null,
  v: ViajeDelResumen,
): CellValue[] {
  return [
    destino,
    chofer,
    camion ?? "—",
    fmtFechaExport(v.fecha),
    v.origen ?? "—",
    v.remito ?? "—",
    v.material ?? "—",
    v.cliente ?? "—",
    // km es NOT NULL: el 0 es un dato, no un hueco.
    v.km,
    siHay(v.toneladas),
    siHay(v.monto),
  ];
}

export const SIN_CHOFER = "SIN CHOFER ASIGNADO";

/** Todas las filas del detalle, incluidos los viajes que aún no tienen chofer. */
export function filasDetalle(destinos: readonly DestinoResumen[]): CellValue[][] {
  const out: CellValue[][] = [];
  for (const d of destinos) {
    for (const c of d.choferes) {
      for (const v of c.detalle) out.push(filaViaje(d.destino, c.chofer, c.camion, v));
    }
    // Los sin asignar no se omiten: son trabajo que todavía falta dar.
    for (const v of d.sinChoferDetalle) out.push(filaViaje(d.destino, SIN_CHOFER, null, v));
  }
  return out;
}
