/**
 * PostgREST corta toda respuesta en 1000 filas. Sin paginar, una consulta que
 * pasa ese tope devuelve las primeras 1000 y no avisa nada: la pantalla se ve
 * normal, con datos de menos. Es el peor tipo de bug — no rompe, miente.
 *
 * `traerTodo` pagina hasta agotar la tabla y devuelve todo. Usalo en cualquier
 * lectura que alimente un total, un promedio, un ranking o un export: ahí no
 * existe "mostrar una parte".
 *
 *   const viajes = await traerTodo((desde, hasta) =>
 *     supabase
 *       .from("viajes")
 *       .select("id, km_con_carga")
 *       .gte("fecha_viaje", desde)
 *       .order("id")          // ← imprescindible, ver abajo
 *       .range(desde, hasta),
 *   );
 *
 * IMPORTANTE: la consulta tiene que traer un `.order()` por una columna única
 * (o terminar en una). Sin orden estable, Postgres puede devolver las filas en
 * distinto orden en cada página y el paginado por offset saltea y repite filas
 * — un error mucho más difícil de ver que el corte en 1000.
 *
 * No sirve para listados con paginado de pantalla (ahí el `.range()` es el
 * paginado real y el usuario navega entre páginas). Es para cuando el código
 * necesita el conjunto completo en memoria.
 */

const TAM_PAGINA = 1000; // el max_rows de PostgREST

/** Tope de seguridad: 1M de filas. Si se alcanza, algo anda mal (una consulta
 *  sin filtro, un orden inestable que nunca termina) y es mejor fallar fuerte. */
const MAX_PAGINAS = 1000;

type Respuesta<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function traerTodo<T>(
  consulta: (desde: number, hasta: number) => Respuesta<T>,
  opts?: { etiqueta?: string; tamPagina?: number },
): Promise<T[]> {
  const tam = opts?.tamPagina ?? TAM_PAGINA;
  const que = opts?.etiqueta ? ` (${opts.etiqueta})` : "";
  const filas: T[] = [];

  for (let pagina = 0; ; pagina++) {
    if (pagina >= MAX_PAGINAS) {
      throw new Error(
        `traerTodo${que}: se pasó de ${MAX_PAGINAS * tam} filas. Revisá que la consulta tenga filtros y un .order() por columna única.`,
      );
    }

    const desde = pagina * tam;
    const { data, error } = await consulta(desde, desde + tam - 1);

    // Cortar con lo que haya sería devolver datos incompletos como si fueran
    // completos: exactamente lo que este helper viene a evitar.
    if (error) {
      throw new Error(`No se pudieron leer todos los datos${que}: ${error.message}`);
    }

    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < tam) return filas;
  }
}

/** Cuántos valores entran en un `.in(...)` por vuelta. Van en la URL, así que
 *  una lista larga no sólo trunca la respuesta: rompe la request entera. */
const TAM_LOTE = 300;

/**
 * Igual que `traerTodo`, pero para consultas con `.in(columna, valores)` donde
 * la lista de valores la arma el llamador (típicamente un Excel importado).
 * Trocea los valores y pagina cada trozo.
 *
 * Importa sobre todo al deduplicar antes de importar: si la consulta que busca
 * "qué ya existe" devuelve de menos, lo que no vuelve se toma por nuevo y se
 * inserta de nuevo. El corte no se ve como pantalla incompleta sino como
 * registros duplicados.
 *
 *   const existentes = await traerEnLotes(remitos, (lote, desde, hasta) =>
 *     supabase.from("viajes").select("nro_remito")
 *       .in("nro_remito", lote).order("id").range(desde, hasta),
 *   );
 */
export async function traerEnLotes<T, V>(
  valores: readonly V[],
  consulta: (lote: V[], desde: number, hasta: number) => Respuesta<T>,
  opts?: { etiqueta?: string; tamLote?: number },
): Promise<T[]> {
  const tamLote = opts?.tamLote ?? TAM_LOTE;
  const filas: T[] = [];

  for (let i = 0; i < valores.length; i += tamLote) {
    const lote = valores.slice(i, i + tamLote);
    const parcial = await traerTodo<T>(
      (desde, hasta) => consulta(lote, desde, hasta),
      opts,
    );
    filas.push(...parcial);
  }

  return filas;
}
