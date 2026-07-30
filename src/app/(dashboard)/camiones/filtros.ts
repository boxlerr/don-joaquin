/**
 * Búsqueda y filtros de la flota.
 *
 * El buscador miraba sólo la patente y el nombre del chofer, así que escribir
 * "iveco" no devolvía nada aunque haya 19. Ahora mira todo lo que está a la
 * vista en la fila —patente, marca, modelo, año, tipo, capacidad, el chofer y
 * los acoplados vinculados— y acepta varias palabras: "iveco 2024" trae los
 * Iveco de 2024, no la unión de las dos cosas.
 */

import { normalizarTexto } from "@/lib/texto";

export type UnidadBuscable = {
  patente: string;
  marca?: string | null;
  modelo?: string | null;
  ano?: number | null;
  capacidad_tn?: number | null;
  tipo?: string | null;
  estado?: string | null;
  chofer_nombre?: string | null;
  acoplados_vinculados?: string[] | null;
};

/**
 * Sin acentos, sin mayúsculas y sin guiones: "Mercedés-Benz" y "mercedes benz"
 * son lo mismo. Los acentos y las mayúsculas los saca el helper compartido; acá
 * se suma lo propio de la flota: los separadores (guion, guion bajo, punto,
 * barra) pasan a espacio, así "AB-123-CD" o "chasis_rigido" se pueden buscar
 * por palabra suelta.
 */
export function normalizar(s: string): string {
  return normalizarTexto(s)
    .replace(/[-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Todo el texto de una unidad, para buscar sobre eso. */
function textoDe(u: UnidadBuscable): string {
  const partes = [
    u.patente,
    u.marca,
    u.modelo,
    u.ano != null ? String(u.ano) : "",
    u.capacidad_tn != null ? `${u.capacidad_tn} tn` : "",
    // El tipo se guarda como "chasis_rigido": el guion bajo lo saca normalizar.
    u.tipo,
    u.chofer_nombre,
    ...(u.acoplados_vinculados ?? []),
  ];
  return normalizar(partes.filter(Boolean).join(" "));
}

/**
 * ¿La unidad matchea lo buscado? Cada palabra tiene que aparecer en algún lado,
 * así se puede ir angostando: "scania" → 23, "scania 2024" → los de ese año.
 */
export function coincide(u: UnidadBuscable, busqueda: string): boolean {
  const terminos = normalizar(busqueda).split(" ").filter(Boolean);
  if (terminos.length === 0) return true;
  const texto = textoDe(u);
  return terminos.every((t) => texto.includes(t));
}

/* ------------------------------------------------------------------ *
 * Filtros por campo
 * ------------------------------------------------------------------ */

export type FiltrosFlota = {
  marcas: string[];
  tipos: string[];
  capacidades: number[];
  estados: string[];
  anioDesde: number | null;
  anioHasta: number | null;
};

export const FILTROS_VACIOS: FiltrosFlota = {
  marcas: [],
  tipos: [],
  capacidades: [],
  estados: [],
  anioDesde: null,
  anioHasta: null,
};

export function contarFiltros(f: FiltrosFlota): number {
  return (
    f.marcas.length +
    f.tipos.length +
    f.capacidades.length +
    f.estados.length +
    (f.anioDesde != null || f.anioHasta != null ? 1 : 0)
  );
}

export function pasaFiltros(u: UnidadBuscable, f: FiltrosFlota): boolean {
  // Una lista vacía significa "no filtrar por esto", no "no mostrar nada".
  if (f.marcas.length > 0 && !f.marcas.includes(u.marca ?? "")) return false;
  if (f.tipos.length > 0 && !f.tipos.includes(u.tipo ?? "")) return false;
  if (f.capacidades.length > 0 && !f.capacidades.includes(Number(u.capacidad_tn))) return false;
  if (f.estados.length > 0 && !f.estados.includes(u.estado ?? "")) return false;
  // Sin año cargado no se puede afirmar que esté en el rango: queda afuera.
  if (f.anioDesde != null && (u.ano == null || u.ano < f.anioDesde)) return false;
  if (f.anioHasta != null && (u.ano == null || u.ano > f.anioHasta)) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Opciones que se ofrecen, sacadas de los datos
 * ------------------------------------------------------------------ */

export type Opcion<T> = { valor: T; label: string; n: number };

/** Valores distintos de un campo, con cuántas unidades tiene cada uno. */
export function opcionesDe<T extends string | number>(
  unidades: readonly UnidadBuscable[],
  campo: (u: UnidadBuscable) => T | null | undefined,
  etiqueta: (v: T) => string = (v) => String(v),
): Opcion<T>[] {
  const conteo = new Map<T, number>();
  for (const u of unidades) {
    const v = campo(u);
    if (v == null || v === "") continue;
    conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([valor, n]) => ({ valor, label: etiqueta(valor), n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "es"));
}

/** "chasis_rigido" → "Chasis rígido". */
export function etiquetaTipo(tipo: string): string {
  const conocidos: Record<string, string> = {
    tractor: "Tractor",
    chasis_rigido: "Chasis rígido",
    semirremolque: "Semirremolque",
    batea: "Batea",
    tolva: "Tolva",
  };
  if (conocidos[tipo]) return conocidos[tipo];
  const limpio = tipo.replace(/_/g, " ");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function etiquetaEstado(estado: string): string {
  const conocidos: Record<string, string> = {
    activo: "Activo",
    operativo: "Operativo",
    mantenimiento: "En mantenimiento",
    reparacion: "En reparación",
    baja: "De baja",
    inactivo: "Inactivo",
  };
  if (conocidos[estado]) return conocidos[estado];
  return estado.charAt(0).toUpperCase() + estado.slice(1).replace(/_/g, " ");
}

/** Rango de años presente en la flota, para acotar los inputs. */
export function rangoAnios(unidades: readonly UnidadBuscable[]): { min: number; max: number } | null {
  const anios = unidades.map((u) => u.ano).filter((a): a is number => a != null && a > 1900);
  if (anios.length === 0) return null;
  return { min: Math.min(...anios), max: Math.max(...anios) };
}

/* ------------------------------------------------------------------ *
 * Orden
 * ------------------------------------------------------------------ */

export type OrdenFlota =
  | "patente"
  | "marca"
  | "anio_nuevo"
  | "anio_viejo"
  | "km"
  | "capacidad"
  | "chofer";

export const ORDEN_LABEL: Record<OrdenFlota, string> = {
  marca: "Marca y modelo",
  patente: "Patente (A-Z)",
  anio_nuevo: "Año (más nuevo)",
  anio_viejo: "Año (más viejo)",
  km: "Kilómetros (mayor)",
  capacidad: "Capacidad (mayor)",
  chofer: "Chofer (A-Z)",
};

/** Orden de los selectores, del más usado al menos. */
export const ORDENES: OrdenFlota[] = [
  "marca",
  "patente",
  "anio_nuevo",
  "anio_viejo",
  "km",
  "capacidad",
  "chofer",
];

export type UnidadOrdenable = UnidadBuscable & { km_actual?: number | null };

const txt = (v: string | null | undefined) => (v ?? "").toString();

/**
 * Ordena la flota. La patente siempre desempata, así el orden es estable y la
 * lista no se reacomoda sola entre renders.
 *
 * "Marca y modelo" agrupa: todos los Scania juntos, después los Iveco, y dentro
 * de cada marca por modelo. Es lo que se pide cuando se mira la flota — antes
 * quedaban mezclados porque el orden venía del alta.
 */
export function ordenarFlota<T extends UnidadOrdenable>(
  unidades: readonly T[],
  orden: OrdenFlota,
): T[] {
  const porPatente = (a: T, b: T) => a.patente.localeCompare(b.patente, "es");
  // Sin dato va al final en todos los criterios: no es "cero", es "no sé".
  const num = (v: number | null | undefined, desc: boolean) =>
    v == null ? (desc ? -Infinity : Infinity) : v;

  const copia = [...unidades];
  switch (orden) {
    case "marca":
      return copia.sort(
        (a, b) =>
          txt(a.marca).localeCompare(txt(b.marca), "es") ||
          txt(a.modelo).localeCompare(txt(b.modelo), "es") ||
          porPatente(a, b),
      );
    case "anio_nuevo":
      return copia.sort((a, b) => num(b.ano, true) - num(a.ano, true) || porPatente(a, b));
    case "anio_viejo":
      return copia.sort((a, b) => num(a.ano, false) - num(b.ano, false) || porPatente(a, b));
    case "km":
      return copia.sort((a, b) => num(b.km_actual, true) - num(a.km_actual, true) || porPatente(a, b));
    case "capacidad":
      return copia.sort(
        (a, b) => num(b.capacidad_tn, true) - num(a.capacidad_tn, true) || porPatente(a, b),
      );
    case "chofer":
      return copia.sort((a, b) => {
        // Los que no tienen chofer, al final.
        const ca = txt(a.chofer_nombre);
        const cb = txt(b.chofer_nombre);
        if (!ca && !cb) return porPatente(a, b);
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, "es") || porPatente(a, b);
      });
    default:
      return copia.sort(porPatente);
  }
}
