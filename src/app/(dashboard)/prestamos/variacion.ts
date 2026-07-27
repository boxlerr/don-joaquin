/**
 * Cuánto se movió la cuota de un préstamo a tasa variable.
 *
 * En estos préstamos la cuota cambia todos los meses, así que el importe de la
 * ficha es sólo el último que nos pasaron. Lo que sí se puede medir es el
 * cambio: cada cuota guarda su propio importe, y comparando la última contra la
 * anterior distinta se ve de cuánto fue el salto.
 */

export type CuotaImporte = { fecha_vencimiento: string; importe: number };

export type Variacion = {
  anterior: number;
  actual: number;
  /** Diferencia en pesos (positiva si subió). */
  diferencia: number;
  /** Diferencia en porcentaje (positiva si subió). */
  porcentaje: number;
};

/**
 * Compara el importe más reciente contra el último distinto que hubo antes.
 * Null si nunca cambió (o si hay una sola cuota): no hay nada que medir.
 */
export function variacionCuota(cuotas: readonly CuotaImporte[]): Variacion | null {
  const orden = [...cuotas]
    .filter((c) => c.importe > 0)
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  if (orden.length < 2) return null;

  const actual = orden.at(-1)!.importe;
  // Se camina hacia atrás hasta encontrar un importe distinto: los meses que
  // repiten el mismo valor no son un cambio.
  const anterior = [...orden]
    .reverse()
    .map((c) => c.importe)
    .find((v) => v !== actual);
  if (anterior == null || anterior === 0) return null;

  const diferencia = actual - anterior;
  return {
    anterior,
    actual,
    diferencia,
    porcentaje: (diferencia / anterior) * 100,
  };
}

/** "+9,5%" / "−3,2%". Con el signo menos tipográfico, que se lee mejor. */
export function formatoVariacion(porcentaje: number): string {
  const abs = Math.abs(porcentaje).toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${porcentaje >= 0 ? "+" : "−"}${abs}%`;
}
