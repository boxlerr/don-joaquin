/**
 * Catálogo de bancos de la sección Préstamos.
 *
 * No hay tabla de bancos: la lista sale de los préstamos ya cargados más un
 * puñado de entidades conocidas, así que escribir un banco nuevo lo deja
 * disponible para la próxima carga sin que nadie tenga que mantener nada.
 *
 * Lo que sí hace falta es que "galicia", "Galicia" y "Banco Galicia" terminen
 * siendo EL MISMO banco: si no, la tabla se llena de duplicados y el filtro por
 * banco deja de servir. De eso se encarga `canonizarBanco`.
 */

/** Entidades que aparecen en la planilla aunque todavía no tengan préstamo. */
export const BANCOS_CONOCIDOS = [
  "Nación",
  "Santander",
  "Galicia",
  "Provincia",
  "Credicoop",
  "Francés",
  "Macro",
  "Ciudad",
  "Patagonia",
  "Supervielle",
  "ICBC",
  "HSBC",
  "Comafi",
  "Scania Credit",
  "Tarjeta Corpo",
  "AFIP",
] as const;

/**
 * Clave de comparación: sin acentos, sin mayúsculas, sin el "banco " de
 * adelante y sin espacios de más. "Banco  GALICIA" y "galicia" dan lo mismo.
 */
export function normalizarBanco(banco: string): string {
  return banco
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Los espacios se limpian ANTES de sacar el "banco " de adelante: al revés,
    // un nombre que empieza con espacio no matchea el ^ y quedaba "banco x".
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^banco\s+/, "");
}

/**
 * Devuelve la grafía que ya se usa para ese banco, si existe. Si es uno nuevo,
 * devuelve lo escrito (recortado). Nunca devuelve cadena vacía si la entrada
 * tenía algo.
 */
export function canonizarBanco(entrada: string, existentes: readonly string[]): string {
  const limpio = entrada.replace(/\s+/g, " ").trim();
  if (!limpio) return "";
  const clave = normalizarBanco(limpio);
  const ya = existentes.find((b) => normalizarBanco(b) === clave);
  return ya ?? limpio;
}

/**
 * Lista para el desplegable: primero los que ya se usan (son los que va a
 * elegir el 99% de las veces), después el resto de los conocidos. Sin
 * duplicados por grafía.
 */
export function listaBancos(enUso: readonly string[]): string[] {
  const salida: string[] = [];
  const vistos = new Set<string>();
  for (const b of [...enUso].sort((a, b) => a.localeCompare(b, "es"))) {
    const k = normalizarBanco(b);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    salida.push(b);
  }
  for (const b of BANCOS_CONOCIDOS) {
    const k = normalizarBanco(b);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(b);
  }
  return salida;
}

/**
 * Identidad visual por entidad: el archivo del logo (en /public/bancos) y el
 * color de la marca, que es el que se usa cuando no hay logo.
 */
export type MarcaBanco = { logo?: string; color: string };

const MARCAS: Record<string, MarcaBanco> = {
  // Los SVG están en /public/bancos: son los logos oficiales vigentes, bajados
  // de Wikimedia Commons o del sitio de cada entidad. El color es el de la
  // marca, medido sobre el propio archivo.
  "nacion": { logo: "/bancos/nacion.svg", color: "#0E7391" },
  "de la nacion argentina": { logo: "/bancos/nacion.svg", color: "#0E7391" },
  "bna": { logo: "/bancos/nacion.svg", color: "#0E7391" },
  "santander": { logo: "/bancos/santander.svg", color: "#EC0000" },
  "santander rio": { logo: "/bancos/santander.svg", color: "#EC0000" },
  "galicia": { logo: "/bancos/galicia.svg", color: "#FF7100" },
  "provincia": { logo: "/bancos/provincia.svg", color: "#279D2E" },
  "de la provincia de buenos aires": { logo: "/bancos/provincia.svg", color: "#279D2E" },
  "bapro": { logo: "/bancos/provincia.svg", color: "#279D2E" },
  "credicoop": { logo: "/bancos/credicoop.svg", color: "#6A6E66" },
  // Francés hoy es BBVA: mismo logo, y el nombre viejo sigue siendo el que usa
  // la planilla.
  "frances": { logo: "/bancos/bbva.svg", color: "#004481" },
  "bbva": { logo: "/bancos/bbva.svg", color: "#004481" },
  "bbva frances": { logo: "/bancos/bbva.svg", color: "#004481" },
  "scania credit": { logo: "/bancos/scania.svg", color: "#00275D" },
  "scania": { logo: "/bancos/scania.svg", color: "#00275D" },
  // AFIP pasó a llamarse ARCA; la planilla todavía dice AFIP.
  "afip": { logo: "/bancos/arca.svg", color: "#242C4F" },
  "arca": { logo: "/bancos/arca.svg", color: "#242C4F" },
  // Sin logo: no son marcas con identidad propia.
  "macro": { color: "#00A9E0" },
  "ciudad": { color: "#E4002B" },
  "patagonia": { color: "#00843D" },
  "supervielle": { color: "#E4002B" },
  "icbc": { color: "#C8102E" },
  "hsbc": { color: "#DB0011" },
  "comafi": { color: "#005CB9" },
  "tarjeta corpo": { color: "#5B6B7B" },
};

/**
 * La palabra que identifica a cada entidad, para cuando el nombre completo no
 * coincide letra por letra con ninguna clave del mapa.
 *
 * Hace falta porque las claves de arriba salieron de la planilla de Préstamos y
 * la tabla `bancos` de Cheques escribe otra cosa: ahí "Banco Provincia de
 * Buenos Aires" normaliza a "provincia de buenos aires", que no es ninguna de
 * las dos formas listadas, y el banco más usado se quedaba sin logo.
 *
 * El orden importa: la primera que aparezca en el nombre gana, así que las más
 * específicas van antes.
 */
const POR_CONTENIDO: string[] = [
  "bbva frances", "santander rio", "scania credit", "tarjeta corpo",
  "de la nacion argentina", "de la provincia de buenos aires",
  "nacion", "provincia", "galicia", "credicoop", "santander", "bbva", "frances",
  "macro", "ciudad", "patagonia", "supervielle", "icbc", "hsbc", "comafi",
  "scania", "arca", "afip", "bapro", "bna",
];

/** Color y logo de un banco. Los que no están en la lista usan el azul del sistema. */
export function marcaBanco(banco: string): MarcaBanco {
  const norm = normalizarBanco(banco);
  const exacto = MARCAS[norm];
  if (exacto) return exacto;

  const clave = POR_CONTENIDO.find((c) => norm.includes(c));
  return (clave ? MARCAS[clave] : undefined) ?? { color: "#0088D1" };
}

/** Iniciales para el badge cuando no hay logo (Nación → NA, Banco Galicia → GA). */
export function inicialesBanco(banco: string): string {
  const palabras = normalizarBanco(banco)
    .split(" ")
    .filter(Boolean);
  if (palabras.length >= 2) return (palabras[0]![0]! + palabras[1]![0]!).toUpperCase();
  return (palabras[0] ?? banco).slice(0, 2).toUpperCase();
}
