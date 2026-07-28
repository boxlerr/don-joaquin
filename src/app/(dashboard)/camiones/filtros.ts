/**
 * Búsqueda y filtros de la flota.
 *
 * El buscador miraba sólo la patente y el nombre del chofer, así que escribir
 * "iveco" no devolvía nada aunque haya 19. Ahora mira todo lo que está a la
 * vista en la fila —patente, marca, modelo, año, tipo, capacidad, el chofer y
 * los acoplados vinculados— y acepta varias palabras: "iveco 2024" trae los
 * Iveco de 2024, no la unión de las dos cosas.
 */

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

/** Sin acentos, sin mayúsculas y sin guiones: "Mercedés-Benz" y "mercedes benz" son lo mismo. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
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
