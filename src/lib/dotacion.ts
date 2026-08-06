// Dotación mes a mes — la línea de tendencia de las tarjetas de Legajos.
//
// El número grande ("78") dice cómo está la plantilla hoy, pero no si viene
// creciendo o achicándose. Esta serie lo responde con dato real: sale de la
// fecha de ingreso y de egreso de cada legajo, no de una curva de adorno.
//
// Un límite conocido, a propósito: hay egresados que no tienen cargada la fecha
// de egreso. A esos no se los puede ubicar en el tiempo, así que NO se los
// cuenta en ningún mes en vez de inventarles una salida. La consecuencia es que
// los meses viejos pueden quedar apenas por debajo de la dotación real; el
// último punto, en cambio, siempre coincide exactamente con el número grande.

export type PersonaDotacion = {
  fecha_ingreso?: string | null;
  fecha_egreso?: string | null;
  /** `"baja"` = egresado. Cualquier otro estado cuenta como plantilla vigente. */
  estado: string;
};

/** Las fechas de la base vienen como `YYYY-MM-DD`; se comparan como texto. */
const soloFecha = (s: string) => s.slice(0, 10);

function iso(d: Date): string {
  // A mano y no con `toISOString()`: ese pasa por UTC y en Argentina (UTC−3)
  // devuelve el día anterior para cualquier fecha armada en hora local.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Los 12 cortes de la serie: el último día de cada uno de los 11 meses
 * anteriores y, para el mes en curso, hoy (todavía no terminó).
 */
export function cortesUltimos12Meses(hoy: Date): string[] {
  const cortes: string[] = [];
  for (let i = 11; i >= 1; i--) {
    // Día 0 del mes siguiente = último día del mes que se busca.
    cortes.push(iso(new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0)));
  }
  cortes.push(iso(hoy));
  return cortes;
}

/** ¿Esta persona estaba en plantilla en esa fecha? */
function estabaEn(p: PersonaDotacion, corte: string): boolean {
  const egresado = p.estado === "baja";
  const egreso = egresado && p.fecha_egreso ? soloFecha(p.fecha_egreso) : null;

  if (egresado && !egreso) return false; // egresado sin fecha: no se lo ubica
  if (egreso && egreso <= corte) return false; // ya se había ido
  // Sin fecha de ingreso pero en plantilla hoy: se cuenta siempre. Es lo que
  // hace que el último punto dé exactamente el total que muestra la tarjeta.
  if (p.fecha_ingreso && soloFecha(p.fecha_ingreso) > corte) return false;
  return true;
}

/** Cuánta gente había en plantilla en cada corte. */
export function serieDotacion(personas: PersonaDotacion[], cortes: string[]): number[] {
  return cortes.map((corte) => personas.reduce((n, p) => (estabaEn(p, corte) ? n + 1 : n), 0));
}
