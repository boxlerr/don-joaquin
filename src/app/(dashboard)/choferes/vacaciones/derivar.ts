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
