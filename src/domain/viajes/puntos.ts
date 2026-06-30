// Normalización de nombres de puntos de ruta (orígenes/destinos).
//
// Se usa para matchear un punto sin importar acentos, mayúsculas, signos ni
// espacios de más, y así NO crear duplicados en `puntos_ruta` cuando una fuente
// (el DM de YPF, la liquidación de Loma, el alta manual) escribe el mismo lugar
// de forma distinta ("Añelo" / "AÑELO" / "Anelo" / "añelo ").
//
// Es la clave para "matchear", no el nombre que se guarda: el nombre canónico
// (con acentos y mayúsculas) se preserva tal cual vino la primera vez.

export function normPuntoNombre(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resuelve el id de un punto a partir de un mapa precargado de
 * `normPuntoNombre(nombre) -> id`. Devuelve el id si ya existe (match
 * normalizado), o null si hay que crearlo. Puro: no toca la base.
 */
export function buscarPuntoEnMapa(
  mapa: Map<string, string>,
  nombre: string | null | undefined,
): string | null {
  const key = normPuntoNombre(nombre);
  if (!key) return null;
  return mapa.get(key) ?? null;
}
