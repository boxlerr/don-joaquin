import { coincideBusqueda, normalizarTexto } from "@/lib/texto";
import type { DestinoResumen } from "./actions";

/**
 * El filtrado por texto del resumen, en un solo lugar.
 *
 * Lo usan la pantalla y el export. Si cada uno tuviera su propia versión, el
 * Excel podría traer filas que en pantalla no están (o al revés) y no habría
 * forma de darse cuenta mirando: sería un Excel que dice otra cosa que la
 * pantalla de la que salió.
 */

/** Sin acentos ni mayúsculas, para que "escobar" encuentre "(ESCOBAR) MAPEI". */
export function normalizar(s: string): string {
  return normalizarTexto(s);
}

export type FiltrosResumen = { destino?: string; chofer?: string };

/**
 * Los destinos que quedan al aplicar las búsquedas.
 *
 * Buscando un chofer, un destino donde no fue no aporta nada: se cae entero,
 * aunque su nombre coincida con la búsqueda de destino.
 */
export function filtrarDestinos(
  destinos: readonly DestinoResumen[],
  filtros: FiltrosResumen = {},
): DestinoResumen[] {
  const qd = filtros.destino ?? "";
  const qc = filtros.chofer ?? "";
  const buscaChofer = !!normalizar(qc);

  return destinos
    .filter((d) => coincideBusqueda(d.destino, qd))
    .map((d) =>
      buscaChofer
        ? { ...d, choferes: d.choferes.filter((c) => coincideBusqueda(c.chofer, qc)) }
        : d,
    )
    .filter((d) => !buscaChofer || d.choferes.length > 0);
}

/** Si hay algo escrito en alguna de las dos búsquedas. */
export function hayFiltros(filtros: FiltrosResumen): boolean {
  return !!(filtros.destino?.trim() || filtros.chofer?.trim());
}

/** Cómo se describe el filtro en el Excel, para que el archivo diga qué trae. */
export function textoFiltros(filtros: FiltrosResumen): string | null {
  const partes: string[] = [];
  if (filtros.destino?.trim()) partes.push(`destino "${filtros.destino.trim()}"`);
  if (filtros.chofer?.trim()) partes.push(`chofer "${filtros.chofer.trim()}"`);
  return partes.length ? `Filtrado por ${partes.join(" y ")}` : null;
}
