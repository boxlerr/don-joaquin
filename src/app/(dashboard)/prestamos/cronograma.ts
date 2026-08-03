/**
 * Cómo se arma el calendario de cuotas de un préstamo.
 *
 * Un préstamo se carga con tres números —cuántas cuotas son, por cuál va y
 * cuándo vence esa— y de ahí sale el cronograma completo, una cuota por mes.
 * La cuenta vive acá y no adentro de las acciones porque es la que hay que
 * poder probar: un mes de más o de menos corre TODAS las fechas.
 */

/**
 * Suma meses manteniendo el día de la cuota (con clamp a fin de mes: una cuota
 * que vence el 31 cae al 30/28 en los meses cortos, como hacen los bancos).
 */
export function addMonths(fechaISO: string, meses: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const base = new Date(y!, m! - 1 + meses, 1);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d!, ultimoDia));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

export type CuotaPlan = {
  nro: number;
  fecha_vencimiento: string;
  /** Las anteriores a la próxima ya se pagaron. */
  pagada: boolean;
};

/**
 * El cronograma completo a partir de "son N cuotas, voy por la M y esa vence
 * el día D": las anteriores a M quedan pagadas y de ahí en adelante se agenda
 * una por mes. Es la misma cuenta del alta, y es la que permite corregir un
 * préstamo que entró de la planilla con menos cuotas de las que tiene: las que
 * faltan se reconstruyen hacia atrás, no hacia adelante.
 */
export function armarCronograma(input: {
  cuotasTotal: number;
  proximaNro: number;
  proximaFecha: string;
}): CuotaPlan[] {
  return Array.from({ length: input.cuotasTotal }, (_, i) => ({
    nro: i + 1,
    fecha_vencimiento: addMonths(input.proximaFecha, i + 1 - input.proximaNro),
    pagada: i + 1 < input.proximaNro,
  }));
}

/**
 * Los meses que hay que sumarle al final a un cronograma que ya existe — el
 * préstamo que se estiró, o el que se cargó con una sola cuota cuando en
 * realidad sigue.
 *
 * El número sigue del más alto que haya (la base no admite dos cuotas con el
 * mismo número) y la fecha sigue de la ÚLTIMA en el tiempo, que no siempre es
 * la misma cuota: en un préstamo con fechas corregidas a mano las dos series
 * se despegan.
 *
 * Sin cuotas cargadas devuelve vacío: no hay desde dónde seguir contando.
 */
export function mesesAlFinal(
  cuotas: readonly { nro: number; fecha_vencimiento: string }[],
  meses: number,
): { nro: number; fecha_vencimiento: string }[] {
  if (!Number.isInteger(meses) || meses < 1 || cuotas.length === 0) return [];
  const ultimoNro = cuotas.reduce((max, c) => Math.max(max, c.nro), 0);
  const ultimaFecha = cuotas.reduce(
    (f, c) => (c.fecha_vencimiento > f ? c.fecha_vencimiento : f),
    cuotas[0]!.fecha_vencimiento,
  );
  return Array.from({ length: meses }, (_, i) => ({
    nro: ultimoNro + i + 1,
    fecha_vencimiento: addMonths(ultimaFecha, i + 1),
  }));
}

/**
 * Los meses que faltan pero para ATRÁS: el préstamo de 12 cuotas que entró
 * como "1 de 1" con la última: las otras once no vienen en 2027, ya se
 * pagaron. Se cuentan hacia atrás desde la primera cuota cargada y quedan
 * numeradas 1..M — las que ya estaban se corren M lugares y pasan a ser las
 * últimas.
 */
export function mesesAlInicio(
  cuotas: readonly { nro: number; fecha_vencimiento: string }[],
  meses: number,
): { nro: number; fecha_vencimiento: string }[] {
  if (!Number.isInteger(meses) || meses < 1 || cuotas.length === 0) return [];
  const primeraFecha = cuotas.reduce(
    (f, c) => (c.fecha_vencimiento < f ? c.fecha_vencimiento : f),
    cuotas[0]!.fecha_vencimiento,
  );
  return Array.from({ length: meses }, (_, i) => ({
    nro: i + 1,
    fecha_vencimiento: addMonths(primeraFecha, i - meses),
  }));
}
