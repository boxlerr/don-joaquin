/**
 * Cruzar los egresos del legajo con las bajas de rotación.
 *
 * Los dos registros nacieron separados: `rotacion_bajas` se cargó una vez desde
 * el Excel y el egreso del legajo escribe `choferes.estado = 'baja'`. Desde el
 * 01/09/2026 egresar deja la fila (ver `lib/rotacion-baja.ts`), pero eso sólo
 * cubre el camino del botón "Egresar": el importador de choferes también puede
 * dejar a alguien en baja, y ahí no pasa nada.
 *
 * Por eso el cruce se calcula y se MUESTRA en la pantalla de rotación. Julián,
 * 01/09/2026: *"tiene que estar cruzado siempre"*. Si algún día vuelve a
 * desfasarse, la pantalla lo dice con nombre y apellido en vez de que haya que
 * darse cuenta sumando a mano — que es como lo encontró Bárbara.
 */

import { cuentaParaRotacion } from "./baja-desde-legajo";

export type EgresadoLegajo = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  rol: string | null;
  estado: string;
  fecha_egreso: string | null;
};

export type BajaCargada = {
  /** null en las 16 que vinieron del Excel: ahí sólo hay un nombre suelto. */
  chofer_id: string | null;
  nombre: string;
};

const norm = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

/**
 * ¿Este egresado ya figura en rotación?
 *
 * Lo fácil es por `chofer_id`, que es lo que deja el sistema. Lo difícil son las
 * del Excel: ahí el nombre viene suelto y abreviado —"PITTANA JORGE", "GOMEZ
 * RICARDO", "CARDARELLI"— y hay que reconocerlo igual.
 *
 * El apellido solo NO alcanza: hay dos Lagano y dos Pittana distintos, y darlos
 * por cargados sería perder una baja real. El primer nombre tampoco: "GOMEZ
 * RICARDO" es Matías **Ricardo** Alberto Gomez, y figura por el segundo. Así que
 * se comparan TODOS sus nombres de pila; y si la fila del Excel es sólo el
 * apellido, se acepta, porque no distingue a nadie.
 */
export function estaEnRotacion(chofer: EgresadoLegajo, bajas: BajaCargada[]): boolean {
  if (bajas.some((b) => b.chofer_id && b.chofer_id === chofer.id)) return true;

  const ap = norm(chofer.apellido);
  if (ap.length < 3) return false;
  const pilas = (chofer.nombre ?? "")
    .split(/\s+/)
    .map(norm)
    .filter((x) => x.length >= 3);

  return bajas.some((b) => {
    const n = norm(b.nombre);
    if (!n.includes(ap)) return false;
    if (pilas.some((x) => n.includes(x))) return true;
    return n === ap;
  });
}

/**
 * Los egresados del legajo que NO están en rotación. Los fleteros quedan afuera
 * por regla del cliente: son terceros, no nómina (ver `cuentaParaRotacion`).
 */
export function egresadosSinCruzar(
  choferes: EgresadoLegajo[],
  bajas: BajaCargada[],
): EgresadoLegajo[] {
  return choferes.filter(
    (c) =>
      c.estado === "baja" &&
      cuentaParaRotacion(c.rol) &&
      !estaEnRotacion(c, bajas),
  );
}
