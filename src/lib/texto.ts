/**
 * Utilidades de texto para búsquedas y filtros.
 *
 * Todo filtro de texto del sistema (buscadores, autocompletados, filtros de
 * tablas) tiene que pasar por acá: así "agustin" encuentra "Agustín",
 * "benitez" encuentra "Benítez" y "munoz" encuentra "Muñoz".
 */

/**
 * Pasa un valor a su forma comparable: minúsculas, sin acentos ni diacríticos
 * (la ñ queda como n), y con los espacios colapsados.
 */
export function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿El texto contiene lo buscado, ignorando acentos y mayúsculas?
 * Una búsqueda vacía coincide con todo (no filtra).
 */
export function coincideBusqueda(texto: unknown, consulta: string): boolean {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  return normalizarTexto(texto).includes(q);
}

/**
 * Igual que {@link coincideBusqueda} pero contra varios campos: alcanza con que
 * uno coincida. Útil para filas donde se busca por nombre, patente, legajo, etc.
 */
export function coincideEnAlguno(
  campos: readonly unknown[],
  consulta: string,
): boolean {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  return campos.some((campo) => normalizarTexto(campo).includes(q));
}

/**
 * Coincidencia por palabras sueltas: cada término de la consulta tiene que
 * aparecer en alguno de los campos, sin importar el orden.
 * Así "agustin surra" encuentra a "Surra, Agustín Lauriano".
 */
export function coincideTerminos(
  campos: readonly unknown[],
  consulta: string,
): boolean {
  const terminos = normalizarTexto(consulta).split(" ").filter(Boolean);
  if (terminos.length === 0) return true;
  const heno = campos.map(normalizarTexto).join(" ");
  return terminos.every((t) => heno.includes(t));
}

/**
 * Comparador alfabético estable e insensible a acentos, para ordenar listas.
 */
export function compararTexto(a: unknown, b: unknown): number {
  return normalizarTexto(a).localeCompare(normalizarTexto(b), "es");
}
