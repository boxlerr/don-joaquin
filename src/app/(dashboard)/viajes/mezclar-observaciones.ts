/**
 * Junta las observaciones de un viaje al editarlo: se reemplaza únicamente el
 * segmento "Carga (Otros): …" y se conserva todo el resto (nota del operador,
 * observación del cierre, marca de tramo, segmentos legados de importación).
 *
 * Vive en su propio archivo y no en actions.ts porque un módulo "use server"
 * sólo puede exportar funciones async: exportarla desde ahí rompe el build.
 */
export function mezclarObservaciones(
  previas: string | null,
  nuevasDelEditar: string[],
): string | null {
  const conservadas = (previas ?? "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
    // El segmento de "Otros" es el único que esta edición reescribe.
    .filter((p) => !/^Carga \(Otros\):/i.test(p));

  return [...conservadas, ...nuevasDelEditar].join(" | ") || null;
}
