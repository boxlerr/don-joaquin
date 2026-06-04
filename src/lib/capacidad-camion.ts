// Categoriza la capacidad real de un camión en los 3 "tipos" que maneja la
// flota: 29 / 35 / 37,5 tn (según reunión con Nicolás). Sirve para mostrar el
// bucket en el listado de /camiones y para promediar utilización por categoría.
//
// Tolerancia: agrupa valores cercanos (p.ej. 30 → 29, 36 → 35) porque las
// capacidades reales varían un poco según modelo. Si el valor cae fuera de
// rango (p.ej. un utilitario chico o un dato faltante) devuelve null para no
// forzar una categoría incorrecta.

export type CategoriaCapacidad = "29" | "35" | "37.5";

export const CATEGORIAS_CAPACIDAD = [
  { id: "29" as const, label: "29 tn", valor: 29 },
  { id: "35" as const, label: "35 tn", valor: 35 },
  { id: "37.5" as const, label: "37,5 tn", valor: 37.5 },
];

export function categoriaCapacidad(
  capacidadTn: number | null | undefined,
): CategoriaCapacidad | null {
  if (capacidadTn == null) return null;
  const cap = Number(capacidadTn);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  // Cortes elegidos para cubrir variaciones leves del nominal (p.ej. modelos
  // de 30 tn cuentan como "29", 36 tn como "35"). Anything por debajo de 24 se
  // considera otra cosa (utilitario, dato roto).
  if (cap >= 36.5) return "37.5";
  if (cap >= 32.5) return "35";
  if (cap >= 24) return "29";
  return null;
}

export function labelCategoriaCapacidad(
  cat: CategoriaCapacidad | null,
): string | null {
  return CATEGORIAS_CAPACIDAD.find((c) => c.id === cat)?.label ?? null;
}
