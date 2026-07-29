// Cálculos derivados de vacaciones (antigüedad, hito, días por antigüedad,
// vencimientos, próximo hito y semáforo). Funciones PURAS, sin acceso a DB ni
// "server-only": las usan la página global, el tab del legajo y las alertas.

export type VacacionesSector = "Chofer" | "Oficina" | "Taller";

export const ROL_A_SECTOR: Record<string, VacacionesSector> = {
  administrativo: "Oficina",
  mantenimiento: "Taller",
  chofer: "Chofer",
};

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Escalones de antigüedad (años) que cambian los días de vacaciones (LCT art. 150). */
export const ESCALONES_HITO = [5, 10, 20] as const;

/** Años cumplidos entre `ingresoISO` y la fecha de referencia (por defecto 31/12). */
export function aniosCumplidos(ingresoISO: string, refY: number, refM = 12, refD = 31): number {
  const [y, m, d] = ingresoISO.split("-").map(Number);
  let a = refY - (y ?? refY);
  if (refM < (m ?? 1) || (refM === m && refD < (d ?? 1))) a -= 1;
  return Math.max(0, a);
}

/** Días que corresponden por antigüedad (LCT art. 150): 14/21/28/35. */
export function diasPorAntiguedad(anios: number): number {
  if (anios >= 20) return 35;
  if (anios >= 10) return 28;
  if (anios >= 5) return 21;
  return 14;
}

export function hitoLabel(anios: number): string {
  if (anios >= 20) return "★ ≥20 años";
  if (anios >= 10) return "★ ≥10 años";
  if (anios >= 5) return "★ ≥5 años";
  return "—";
}

/** Próximo escalón de antigüedad y meses hasta cumplirlo (medidos al fin del período). */
export function proximoHito(ingresoISO: string, anios: number, refY: number, refM = 12): string {
  const sig = ESCALONES_HITO.find((e) => e > anios);
  if (sig == null) return "Tramo máximo";
  const [y, m] = ingresoISO.split("-").map(Number);
  const meses = ((y ?? refY) + sig) * 12 + (m ?? 1) - (refY * 12 + refM);
  return `${Math.max(0, meses)} meses → ${sig} años`;
}

// ── Saldos por año ────────────────────────────────────────────────────────────
// Los días otorgados viven en `chofer_vacaciones_anios` (una fila por año) y los
// períodos descuentan del año al que están imputados (`chofer_ausencias.anio_cargo`).
// Un período con `anio_cargo` null es histórico: ya estaba reflejado en la carga
// inicial de saldos y no vuelve a descontar.

export type SaldoAnio = {
  anio: number;
  otorgados: number;
  usados: number;
  saldo: number;
  observaciones: string | null;
};

export function saldosPorAnio(
  otorgados: { anio: number; dias: number; observaciones?: string | null }[],
  usadosPorAnio: Map<number, number>,
): SaldoAnio[] {
  const anios = new Set<number>([...otorgados.map((o) => o.anio), ...usadosPorAnio.keys()]);
  return [...anios]
    .sort((a, b) => a - b)
    .map((anio) => {
      const o = otorgados.find((x) => x.anio === anio);
      const usados = usadosPorAnio.get(anio) ?? 0;
      return {
        anio,
        otorgados: o?.dias ?? 0,
        usados,
        saldo: (o?.dias ?? 0) - usados,
        observaciones: o?.observaciones ?? null,
      };
    });
}

/**
 * Resumen del saldo a partir del desglose por año. ÚNICA fuente de verdad de
 * estas cuatro magnitudes: la usan la vista global, el legajo y las alertas, así
 * el mismo empleado no puede mostrar números distintos en dos pantallas.
 *
 * Regla: el saldo del año X vence el 31/12 del año X+1. Entonces, parado en el
 * año Y, siguen vigentes Y (corresponden) e Y−1 (adeudados); lo anterior venció.
 *
 * OJO: "disponibles" NO es `corresponden + adeudados − tomados`. Los días
 * tomados ya están descontados dentro del saldo del año al que se imputaron
 * (`anio_cargo`); restarlos otra vez los cuenta dos veces.
 */
export function resumenSaldos(saldos: SaldoAnio[], finPeriodoY: number) {
  const corresponden = saldos.find((s) => s.anio === finPeriodoY)?.otorgados ?? 0;
  const adeudados = saldos.filter((s) => s.anio === finPeriodoY - 1).reduce((a, s) => a + s.saldo, 0);
  // Sólo Y e Y−1. Un año futuro cargado por adelantado NO es día disponible
  // todavía (se ve en el desglose por año, pero no suma acá).
  const disponibles = saldos
    .filter((s) => s.anio >= finPeriodoY - 1 && s.anio <= finPeriodoY)
    .reduce((a, s) => a + s.saldo, 0);
  const diasVencidos = saldos
    .filter((s) => s.anio < finPeriodoY - 1)
    .reduce((a, s) => a + Math.max(0, s.saldo), 0);
  return { corresponden, adeudados, disponibles, diasVencidos, total: corresponden + adeudados };
}

/**
 * Año al que se imputa un período nuevo: el más viejo con saldo disponible
 * (sin pasarse del año calendario del período). Si no queda saldo en ningún
 * año, se imputa al año de la fecha de inicio.
 *
 * Sólo considera años todavía vigentes a la fecha del período (el año de la
 * fecha y el anterior). Antes tomaba cualquier año con saldo, así que un período
 * de hoy podía consumir días de un año ya vencido: días que las pantallas daban
 * por perdidos desaparecían sin que se moviera ningún número visible.
 */
export function anioParaImputar(saldos: SaldoAnio[], fechaInicioISO: string): number {
  const anioFecha = Number(fechaInicioISO.slice(0, 4));
  const conSaldo = saldos.filter((s) => s.saldo > 0 && s.anio <= anioFecha && s.anio >= anioFecha - 1);
  return conSaldo.length > 0 ? conSaldo[0]!.anio : anioFecha;
}

export type Semaforo = "🔴" | "🟠" | "🟡" | "🟢";

export function semaforo(adeudados: number, disponibles: number): Semaforo {
  if (adeudados > 0) return "🔴"; // saldo viejo que vence a fin de año
  if (disponibles >= 28) return "🟠"; // mucho acumulado
  if (disponibles >= 21) return "🟡";
  return "🟢";
}

export function venceSaldoLabel(adeudados: number, finPeriodoY: number): string | null {
  return adeudados > 0 ? `31/12/${finPeriodoY}` : null;
}

export function vencePeriodoLabel(finPeriodoY: number): string {
  return `${MES_CORTO[9]} ${finPeriodoY + 1}`; // Oct del año siguiente
}

// ── Textos y fechas para la UI ────────────────────────────────────────────────
// Todo lo de acá abajo existe para que las pantallas no tengan que armar frases
// a mano (que es cómo terminaron diciendo lo mismo de siete formas distintas).
// `hitoLabel`, `proximoHito` y `vencePeriodoLabel` siguen vivos porque los
// consumen los dos exports a Excel (el "formato de siempre" que archiva Bárbara),
// pero la UI usa estas funciones nuevas.

/**
 * Próximo escalón de antigüedad, dicho en AÑO y en DÍAS: "desde 2029 le van a
 * corresponder 35 días por año".
 *
 * NO devuelve mes a propósito. `aniosCumplidos` mide la antigüedad al 31/12 del
 * año del período (refM=12, refD=31 ⇒ anios = refY − year(ingreso) siempre), así
 * que el escalón vale para TODO el período `year(ingreso) + escalón`: decir "en
 * marzo de 2029 pasa a 35 días" sería falso, los 35 valen para el 2029 completo.
 *
 * Reemplaza a `proximoHito` en la UI ("37 meses → 20 años": nadie planifica en
 * meses sueltos).
 */
export function subeADiasEn(
  ingresoISO: string | null,
  anios: number,
): { anio: number; dias: number } | null {
  const sig = ESCALONES_HITO.find((e) => e > anios);
  if (sig == null || !ingresoISO) return null;
  const y = Number(ingresoISO.slice(0, 4));
  if (!Number.isFinite(y)) return null;
  return { anio: y + sig, dias: diasPorAntiguedad(sig) };
}

/** Ventana legal para gozar el período de un año (LCT art. 154): 1/10 → 30/4. */
export function ventanaGoce(anio: number): { desde: string; hasta: string } {
  return { desde: `${anio}-10-01`, hasta: `${anio + 1}-04-30` };
}

/** ¿Ya se abrió la ventana del art. 154 para el período de ese año? */
export function yaSePuedeTomar(anio: number, hoyISO: string): boolean {
  return hoyISO >= ventanaGoce(anio).desde;
}

/**
 * ¿Ese texto de `observaciones` lo escribió un proceso y no una persona?
 *
 * No hay columna de origen en `chofer_ausencias` ni en `chofer_vacaciones_anios`,
 * así que lo único que queda es heurística sobre el texto libre. Se usa para
 * ESCONDER el ruido de importación ("Import cronograma (VACACIONES 2, …)" abajo
 * del nombre de una persona, como si fuera una nota humana), nunca para afirmar
 * cómo se cargó algo que en realidad no sabemos.
 */
export function esNotaDeProceso(obs: string | null): boolean {
  if (!obs) return false;
  return /^\s*\[?import/i.test(obs) || /^\s*alta autom/i.test(obs);
}

/** La observación sólo si la escribió una persona; si no, null. */
export function notaVisible(obs: string | null): string | null {
  if (!obs || esNotaDeProceso(obs)) return null;
  return obs.trim() || null;
}

/**
 * Sólo la importación de planilla habilita la frase "al importar la planilla".
 * `esNotaDeProceso` es más amplia (incluye el "Alta automática…" que escribe
 * lib.ts) y sirve nada más que para filtrar.
 */
export function vinoDeImportacion(obs: string | null): boolean {
  return /^\s*\[?import/i.test(obs ?? "");
}

const DIA_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MES_LARGO = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function partesISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y ?? 0, m: m ?? 1, d: d ?? 1 };
}

/**
 * Un día en prosa: "lunes 21 de julio". El año se agrega sólo si no es el de hoy
 * ("lunes 4 de enero de 2027"), que es el caso frecuente por la ventana de goce.
 * Un solo formato para "vuelve el…", "se va el…" y "volvió el…" en las tres
 * pantallas: antes cada bloque escribía la fecha a su manera.
 */
/**
 * El día siguiente a una fecha ISO. Es el día en que la persona vuelve a
 * trabajar: la pregunta que se hace quien arma la semana no es "cuándo termina
 * la licencia" sino "cuándo lo tengo de nuevo".
 */
export function diaSiguiente(iso: string): string {
  const { y, m, d } = partesISO(iso);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

export function fmtDiaLargo(iso: string, hoyISO: string): string {
  const { y, m, d } = partesISO(iso);
  const dow = DIA_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
  const base = `${dow} ${d} de ${MES_LARGO[m - 1]}`;
  return y !== partesISO(hoyISO).y ? `${base} de ${y}` : base;
}

/**
 * Rango en prosa: "del 7 al 20 de julio", "del 28 de julio al 4 de agosto",
 * "del 28 de diciembre de 2026 al 10 de enero de 2027". Reemplaza al
 * "07 jul → 20 jul" de la vista global, que es formato de planilla.
 */
export function fmtRangoFechas(inicioISO: string, finISO: string, hoyISO: string): string {
  const a = partesISO(inicioISO);
  const b = partesISO(finISO);
  const anioHoy = partesISO(hoyISO).y;
  const cruzaAnio = a.y !== b.y || a.y !== anioHoy || b.y !== anioHoy;
  if (cruzaAnio) {
    return `del ${a.d} de ${MES_LARGO[a.m - 1]} de ${a.y} al ${b.d} de ${MES_LARGO[b.m - 1]} de ${b.y}`;
  }
  if (a.m === b.m) return `del ${a.d} al ${b.d} de ${MES_LARGO[a.m - 1]}`;
  return `del ${a.d} de ${MES_LARGO[a.m - 1]} al ${b.d} de ${MES_LARGO[b.m - 1]}`;
}

/** Conjunto completo de campos derivados para un empleado. */
export function derivarVacaciones(opts: {
  rol: string | null;
  fecha_ingreso: string | null;
  corresponden: number;
  adeudados: number;
  disponibles: number;
  finPeriodoY: number;
}) {
  const { rol, fecha_ingreso, corresponden, adeudados, disponibles, finPeriodoY } = opts;
  const sector = ROL_A_SECTOR[rol ?? ""] ?? "Chofer";
  const anios = fecha_ingreso ? aniosCumplidos(fecha_ingreso, finPeriodoY) : 0;
  const total = corresponden + adeudados;
  // Días que deberían corresponder por antigüedad actual (para detectar desfasaje
  // con el valor cargado cuando alguien cruza un hito).
  const diasSegunAntiguedad = fecha_ingreso ? diasPorAntiguedad(anios) : corresponden;
  return {
    sector,
    anios,
    hito: hitoLabel(anios),
    total,
    disponibles,
    diasSegunAntiguedad,
    desfasaje: corresponden > 0 && diasSegunAntiguedad !== corresponden,
    vence_saldo: venceSaldoLabel(adeudados, finPeriodoY),
    vence_periodo: vencePeriodoLabel(finPeriodoY),
    proximo_hito: fecha_ingreso ? proximoHito(fecha_ingreso, anios, finPeriodoY) : "—",
    semaforo: semaforo(adeudados, disponibles),
  };
}
