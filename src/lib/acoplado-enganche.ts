/**
 * Enganche camión ↔ acoplado (`camion_acoplados`), sin "use server".
 *
 * Vive acá y no en un actions.ts porque lo usan dos módulos: el detalle de la
 * flota (/camiones) y la planilla diaria, que es donde Nico pidió poder
 * cambiarlo — "cada tanto sale algún cambio; en general van siempre junto, pero
 * a veces cambian solo el acoplado" (01/09/26).
 *
 * El vínculo es histórico: la fila abierta (`hasta is null`) es el enganche de
 * hoy. Un acoplado va en UN camión por vez (la base lo exige con un índice único
 * parcial sobre `hasta is null`); un camión puede llevar más de uno.
 */

// Cliente Supabase admin. Sólo usamos la API .from/.select/.insert/.update.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EngancheDb = any;

export type CambioEnganche = {
  camion_id: string;
  /** null = ese camión queda sin acoplado. */
  acoplado_id: string | null;
};

/**
 * Suelta un acoplado del camión en el que esté hoy y devuelve de cuál salió.
 *
 * Si la fila abierta se creó HOY se borra en vez de cerrarse: es una corrección
 * del mismo día, no un periodo, y dejarla escrita inventaría un enganche de un
 * día que nunca existió.
 */
export async function soltarAcoplado(
  db: EngancheDb,
  acopladoId: string,
  hoy: string,
): Promise<string | null> {
  const { data: abierta } = await db
    .from("camion_acoplados")
    .select("id, camion_id, desde")
    .eq("acoplado_id", acopladoId)
    .is("hasta", null)
    .maybeSingle();

  if (!abierta) return null;

  if (abierta.desde === hoy) {
    await db.from("camion_acoplados").delete().eq("id", abierta.id);
  } else {
    await db.from("camion_acoplados").update({ hasta: hoy }).eq("id", abierta.id);
  }
  return abierta.camion_id as string;
}

/** Qué acoplado lleva cada camión hoy (uno solo: el primero que aparezca). */
export async function engancheVigentePorCamion(
  db: EngancheDb,
): Promise<Map<string, string>> {
  const { data } = await db
    .from("camion_acoplados")
    .select("camion_id, acoplado_id")
    .is("hasta", null);
  const out = new Map<string, string>();
  for (const v of (data ?? []) as { camion_id: string; acoplado_id: string }[]) {
    if (!out.has(v.camion_id)) out.set(v.camion_id, v.acoplado_id);
  }
  return out;
}

/**
 * Qué acoplado llevaba cada camión en una fecha dada. Para el historial: un
 * enganche rige desde `desde` hasta el día en que se cerró (`hasta`), así que
 * una fecha vieja muestra lo que había ese día y no lo de hoy.
 */
export async function engancheEnFechaPorCamion(
  db: EngancheDb,
  fecha: string,
): Promise<Map<string, string>> {
  const { data } = await db
    .from("camion_acoplados")
    .select("camion_id, acoplado_id, desde, hasta")
    .lte("desde", fecha)
    .or(`hasta.is.null,hasta.gt.${fecha}`);
  const out = new Map<string, string>();
  for (const v of (data ?? []) as { camion_id: string; acoplado_id: string }[]) {
    if (!out.has(v.camion_id)) out.set(v.camion_id, v.acoplado_id);
  }
  return out;
}

export type ResultadoEnganches = {
  /** Movimientos efectivos, para el mensaje y la auditoría. */
  cambios: { camion_id: string; de: string | null; a: string | null }[];
  error?: string;
};

/**
 * Deja a cada camión de la lista con el acoplado indicado.
 *
 * Primero suelta TODO lo que se mueve —lo que sale de un camión y lo que viene
 * de otro— y recién después engancha: si no, el índice único de "un acoplado, un
 * camión" rechaza el insert en cuanto hay un intercambio entre dos unidades.
 *
 * Los camiones que no están en la lista no se tocan.
 */
export async function aplicarEnganches(
  db: EngancheDb,
  cambios: CambioEnganche[],
  hoy: string,
  userId: string | null,
): Promise<ResultadoEnganches> {
  if (cambios.length === 0) return { cambios: [] };

  const camionIds = [...new Set(cambios.map((c) => c.camion_id))];
  const { data: abiertas } = await db
    .from("camion_acoplados")
    .select("camion_id, acoplado_id")
    .in("camion_id", camionIds)
    .is("hasta", null);

  const actualPorCamion = new Map<string, string>();
  for (const v of (abiertas ?? []) as { camion_id: string; acoplado_id: string }[]) {
    if (!actualPorCamion.has(v.camion_id)) actualPorCamion.set(v.camion_id, v.acoplado_id);
  }

  const reales = cambios.filter(
    (c) => (actualPorCamion.get(c.camion_id) ?? null) !== (c.acoplado_id ?? null),
  );
  if (reales.length === 0) return { cambios: [] };

  // Soltar: el acoplado que estaba en el camión y el que viene de otro lado.
  for (const c of reales) {
    const actual = actualPorCamion.get(c.camion_id);
    if (actual) await soltarAcoplado(db, actual, hoy);
  }
  for (const c of reales) {
    if (c.acoplado_id) await soltarAcoplado(db, c.acoplado_id, hoy);
  }

  const aInsertar = reales.filter((c) => c.acoplado_id);
  if (aInsertar.length > 0) {
    const { error } = await db.from("camion_acoplados").insert(
      aInsertar.map((c) => ({
        camion_id: c.camion_id,
        acoplado_id: c.acoplado_id as string,
        desde: hoy,
        created_by: userId,
      })),
    );
    if (error) {
      console.error("Error al enganchar acoplados:", error);
      return { cambios: [], error: "No se pudo guardar el cambio de acoplado." };
    }
  }

  return {
    cambios: reales.map((c) => ({
      camion_id: c.camion_id,
      de: actualPorCamion.get(c.camion_id) ?? null,
      a: c.acoplado_id,
    })),
  };
}
