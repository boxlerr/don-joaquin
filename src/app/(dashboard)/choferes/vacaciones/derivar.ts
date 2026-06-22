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
  tomados: number;
  finPeriodoY: number;
}) {
  const { rol, fecha_ingreso, corresponden, adeudados, tomados, finPeriodoY } = opts;
  const sector = ROL_A_SECTOR[rol ?? ""] ?? "Chofer";
  const anios = fecha_ingreso ? aniosCumplidos(fecha_ingreso, finPeriodoY) : 0;
  const total = corresponden + adeudados;
  const disponibles = total - tomados;
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
