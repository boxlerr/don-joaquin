/**
 * Utilidades de texto para búsquedas y filtros.
 *
 * Todo filtro de texto del sistema (buscadores, autocompletados, filtros de
 * tablas) tiene que pasar por acá: así "agustin" encuentra "Agustín",
 * "benitez" encuentra "Benítez" y "munoz" encuentra "Muñoz".
 *
 * IMPORTANTE: Caja y Gastos buscan contra la base, no acá, porque paginan en el
 * servidor sobre tablas grandes. Del lado de Postgres el equivalente es la
 * función public.sin_acentos() (migración 20260730_busqueda_sin_acentos, que es
 * opcional: sin ella sólo esas dos pantallas quedan con acentos). Las dos tienen
 * que dar EXACTAMENTE el mismo resultado: si no, el usuario escribe algo que
 * existe y la pantalla le dice que no hay nada. Por eso la tabla de caracteres
 * de abajo es una sola y la migración usa una copia literal de estas dos
 * cadenas; el test de este archivo imprime las que hay que pegar allá.
 */

/**
 * Reemplazos de a un caracter: acento → letra pelada, comillas y guiones
 * tipográficos → los de la máquina de escribir, espacios raros → espacio común.
 *
 * Se hace por tabla explícita y no con NFD + borrar diacríticos, justamente
 * para poder repetir lo mismo en SQL con translate(). Lo que no está en la
 * tabla queda igual en los dos lados, que es lo único que importa.
 */
const REEMPLAZOS: readonly (readonly [string, string])[] = [
  // Latín-1: lo que aparece en castellano y en apellidos de la zona.
  ["ÀÁÂÃÄÅ", "AAAAAA"],
  ["àáâãäå", "aaaaaa"],
  ["Ç", "C"],
  ["ç", "c"],
  ["ÈÉÊË", "EEEE"],
  ["èéêë", "eeee"],
  ["ÌÍÎÏ", "IIII"],
  ["ìíîï", "iiii"],
  ["Ñ", "N"],
  ["ñ", "n"],
  ["ÒÓÔÕÖØ", "OOOOOO"],
  ["òóôõöø", "oooooo"],
  ["ÙÚÛÜ", "UUUU"],
  ["ùúûü", "uuuu"],
  ["Ýý", "Yy"],
  ["ÿ", "y"],
  // Latín extendido: apellidos de origen centroeuropeo e italiano.
  ["ĀāĒēĪīŌōŪū", "AaEeIiOoUu"],
  ["ĆćČčĎďĐđ", "CcCcDdDd"],
  ["ĚěŁłŃń", "EeLlNn"],
  ["ŘřŚśŠš", "RrSsSs"],
  ["ŤťŮůŹźŻżŽž", "TtUuZzZzZz"],
  // Signos que llegan pegados desde Excel o Word.
  ["‐‑‒–—―­", "-------"],
  ["‘’‚", "'''"],
  ["“”„", '"""'],
  ["¿¡", "?!"],
  // Espacios que no son el espacio común (el \s de JavaScript los toma, el de
  // Postgres no, así que hay que pasarlos a espacio antes de colapsar).
  ["               　﻿", " ".repeat(17)],
];

/** Los caracteres a buscar, en una sola cadena. Se copia tal cual al SQL. */
export const CARACTERES_ORIGEN = REEMPLAZOS.map(([de]) => de).join("");
/** Sus reemplazos, alineados uno a uno. Se copia tal cual al SQL. */
export const CARACTERES_DESTINO = REEMPLAZOS.map(([, a]) => a).join("");

const TABLA = new Map<string, string>();
for (let i = 0; i < CARACTERES_ORIGEN.length; i++) {
  TABLA.set(CARACTERES_ORIGEN[i]!, CARACTERES_DESTINO[i]!);
}
const RE_TABLA = new RegExp(`[${CARACTERES_ORIGEN.replace(/[\\\]^-]/g, "\\$&")}]`, "g");

/**
 * Pasa un valor a su forma comparable: sin acentos, en minúsculas y con los
 * espacios colapsados. La ñ queda como n, así que "munoz" encuentra "Muñoz".
 */
export function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(RE_TABLA, (c) => TABLA.get(c)!)
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
