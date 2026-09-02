/**
 * Qué le pasa a cada renglón del PDF cuando ya hay cosas cargadas.
 *
 * Es la única parte del importador que decide algo, y está separada de la server
 * action a propósito: el riesgo real de este flujo no es leer mal el PDF —eso se
 * ve en la vista previa— sino agendar dos veces el mismo vencimiento y que
 * salgan dos avisos del mismo impuesto. Acá se puede probar contra las filas de
 * verdad sin subir un archivo.
 *
 * Tres casos y no dos:
 *
 *  · el impuesto no está → se agenda;
 *  · está con la MISMA fecha → no se toca (reimportar el PDF no duplica nada);
 *  · está ese mismo mes con OTRA fecha → el estudio lo reprogramó, así que es la
 *    misma fila movida y no una nueva. Sin este caso, el calendario corregido de
 *    un mes deja los dos vencimientos vivos y el viejo sigue reclamando.
 */

import type { EstadoFila } from "@/app/(dashboard)/impuestos/import-calendario/tipos";

export type CargadoPrevio = {
  id: string;
  nombre: string;
  fecha_vencimiento: string;
  organismo?: string | null;
  presentado?: boolean;
};

export type Clasificada = {
  nombre: string;
  fechaVencimiento: string;
  estado: EstadoFila;
  /** El organismo del mismo impuesto cargado antes; el PDF no lo trae. */
  organismo: string;
  existente: CargadoPrevio | null;
};

const mes = (iso: string) => iso.slice(0, 7);

export function clasificarFilas(
  filas: { nombre: string; fechaVencimiento: string }[],
  yaCargados: CargadoPrevio[],
): Clasificada[] {
  return filas.map((f) => {
    const mismos = yaCargados.filter((c) => c.nombre === f.nombre);
    const exacto = mismos.find((c) => c.fecha_vencimiento === f.fechaVencimiento);
    const mismoMes = mismos.find((c) => mes(c.fecha_vencimiento) === mes(f.fechaVencimiento));
    const existente = exacto ?? mismoMes ?? null;
    const estado: EstadoFila = exacto ? "ya_cargado" : mismoMes ? "mueve_fecha" : "nuevo";
    return {
      nombre: f.nombre,
      fechaVencimiento: f.fechaVencimiento,
      estado,
      organismo: mismos.find((c) => c.organismo)?.organismo ?? "",
      existente,
    };
  });
}
