/**
 * Qué movimientos se muestran.
 *
 * La caja chica es la vista operativa y es igual para todos: dirección la mira
 * para saber qué está viendo el personal (pedido 29/07). Por eso el filtro no
 * depende de quién consulta — un movimiento oculto desaparece de la caja chica
 * para cualquier rol. Y desde el 24/08 tampoco reaparece en la caja general:
 * ahí lo ve sólo el ADMINISTRADOR, que es el único que puede taparlo.
 *
 * Dos capas:
 *  1. La marca `privado` que el administrador pone al cargar o desde el ojito:
 *     true = oculto, false = a la vista.
 *  2. Si nadie la decidió (null: movimientos viejos, importaciones, viáticos,
 *     transferencias, o cargas de alguien que no es admin), vale la regla por
 *     autor — lo que carga quien ve el saldo no se muestra en la caja chica.
 */

type Movimiento = { created_by: string | null; privado?: boolean | null };

/**
 * ¿Esta persona ve los movimientos ocultos?
 *
 * Sólo el administrador, y sólo en la caja general. La caja chica no los muestra
 * nunca —es la vista que dirección usa para comprobar qué ve el personal— y
 * tener `caja_grande` abre el historial completo, no lo tapado: si cambiar de
 * solapa alcanzara para destapar, "ocultar" no querría decir nada.
 */
export function veLosOcultos(vista: "chica" | "general", esAdmin: boolean): boolean {
  return vista === "general" && esAdmin;
}

/** Filtro en memoria, para listas ya traídas. */
export function filtrarMovimientosVisibles<T extends Movimiento>(
  movimientos: T[],
  direccion: Set<string>,
): T[] {
  return movimientos.filter((m) => {
    if (m.privado === true) return false;
    if (m.privado === false) return true;
    return !m.created_by || !direccion.has(m.created_by);
  });
}

/**
 * El mismo criterio como cláusula `or` de PostgREST, para filtrar en la base y
 * no romper la paginación ni los totales.
 */
export function clausulaVisibilidad(direccion: Set<string>): string {
  const ocultos = [...direccion];
  const ramas = ["privado.is.false"];

  if (ocultos.length === 0) {
    // Nadie a quien ocultarle por autor: alcanza con respetar la marca.
    ramas.push("privado.is.null");
  } else {
    // Sin decidir: se muestra solo si no lo cargó dirección. `not.in` no matchea
    // filas con created_by nulo, por eso van en una rama aparte.
    ramas.push(`and(privado.is.null,created_by.not.in.(${ocultos.join(",")}))`);
    ramas.push("and(privado.is.null,created_by.is.null)");
  }

  return ramas.join(",");
}
