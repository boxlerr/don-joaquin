import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * URLs de archivos del Storage, siempre firmadas.
 *
 * Los buckets son privados: la URL cruda de un objeto no abre nada. Para
 * mostrar una foto o un adjunto hay que firmar el path con el service role, y
 * esa firma vence sola. Como el link caduca, tiene que armarse en el servidor
 * en el momento de renderizar: un componente cliente NO puede construirlo.
 *
 * Patrón: si vas a mostrar UNA imagen usá `urlFirmada`; si vas a mostrar una
 * lista (88 legajos, las fotos de una unidad, los adjuntos de un viaje) usá
 * `urlesFirmadas`, que firma todo en una llamada por bucket en vez de una por
 * archivo.
 */

/** Cuánto vive un link firmado. Una hora alcanza para trabajar sin recargar. */
export const VIGENCIA_URL_SEG = 3600;

export type ArchivoRef = { bucket: string; path: string };

/** Clave del mapa que devuelve `urlesFirmadas`. */
export function claveArchivo(a: ArchivoRef): string {
  return `${a.bucket}:${a.path}`;
}

/** Un solo archivo. `null` si no hay archivo o si el Storage rechaza el path. */
export async function urlFirmada(
  archivo: ArchivoRef | null | undefined,
  opts?: { expiraEn?: number; descargarComo?: string },
): Promise<string | null> {
  if (!archivo?.bucket || !archivo?.path) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(archivo.bucket)
    .createSignedUrl(archivo.path, opts?.expiraEn ?? VIGENCIA_URL_SEG, {
      download: opts?.descargarComo,
    });
  return data?.signedUrl ?? null;
}

/**
 * Varios archivos de una. Devuelve un mapa `bucket:path → url`; los que el
 * Storage no pudo firmar simplemente no están en el mapa (el llamador decide
 * si eso es una silueta vacía o un cartel de error).
 */
export async function urlesFirmadas(
  archivos: readonly (ArchivoRef | null | undefined)[],
  opts?: { expiraEn?: number },
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const urls = new Map<string, string>();

  // `createSignedUrls` trabaja sobre un bucket a la vez, así que se agrupa; y
  // se deduplica el path porque la misma foto puede repetirse entre filas.
  const porBucket = new Map<string, Set<string>>();
  for (const a of archivos) {
    if (!a?.bucket || !a?.path) continue;
    if (!porBucket.has(a.bucket)) porBucket.set(a.bucket, new Set());
    porBucket.get(a.bucket)!.add(a.path);
  }
  if (porBucket.size === 0) return urls;

  await Promise.all(
    [...porBucket].map(async ([bucket, paths]) => {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrls([...paths], opts?.expiraEn ?? VIGENCIA_URL_SEG);
      for (const s of data ?? []) {
        if (s.signedUrl && s.path) urls.set(`${bucket}:${s.path}`, s.signedUrl);
      }
    }),
  );

  return urls;
}
