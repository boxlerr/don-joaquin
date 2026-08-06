// Umbral de ausentes por semana del cronograma de vacaciones: cuánta gente
// puede estar de vacaciones a la vez antes de marcar la semana en rojo.
//
// Antes era un número derivado y fijo (10% de la flota, mínimo 4). Bárbara pidió
// que dependa de la época del año: en diciembre/enero se toman muchos juntos y
// no es una anomalía, mientras que en plena temporada 6 ausentes sí lo es. Por
// eso el umbral tiene una base (automática por % de la flota, o un valor fijo) y
// overrides opcionales por mes.
//
// Funciones PURAS, sin acceso a DB: las usan la página, el plan sugerido y los
// tests. La config se persiste como una sola fila JSON de `parametros_sistema`
// (mismo patrón que `ranking_score_config`).

export const UMBRAL_CLAVE = "vacaciones_umbral_config";

export type UmbralConfig = {
  /** `auto` = % de la flota activa (con piso); `fijo` = siempre el mismo número. */
  modo: "auto" | "fijo";
  /** Porcentaje de la flota activa, en modo `auto`. */
  porcentaje: number;
  /** Piso del modo `auto`: nunca marca en rojo por debajo de esto. */
  minimo: number;
  /** Valor del modo `fijo`. */
  fijo: number;
  /** Overrides por mes (1 = enero … 12 = diciembre). Lo que no está, usa la base. */
  porMes: Record<number, number>;
};

export const UMBRAL_DEFAULT: UmbralConfig = {
  modo: "auto",
  porcentaje: 10,
  minimo: 4,
  fijo: 6,
  porMes: {},
};

export const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

function entero(v: unknown, def: number, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/**
 * Normaliza cualquier cosa que venga de la DB (o del formulario) a una config
 * válida, cayendo a los defaults campo por campo. Nunca tira: un JSON corrupto
 * degrada al comportamiento de siempre (10% con piso 4).
 */
export function mergeUmbral(raw: unknown): UmbralConfig {
  const o = (raw ?? {}) as Partial<UmbralConfig> & { porMes?: unknown; por_mes?: unknown };
  const porMesRaw = (o.porMes ?? o.por_mes ?? {}) as Record<string, unknown>;
  const porMes: Record<number, number> = {};
  for (const [k, v] of Object.entries(porMesRaw)) {
    const mes = Math.trunc(Number(k));
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) continue;
    if (v === null || v === "" || v === undefined) continue; // "sin override"
    porMes[mes] = entero(v, UMBRAL_DEFAULT.minimo, 0, 999);
  }
  return {
    modo: o.modo === "fijo" ? "fijo" : "auto",
    porcentaje: entero(o.porcentaje, UMBRAL_DEFAULT.porcentaje, 1, 100),
    minimo: entero(o.minimo, UMBRAL_DEFAULT.minimo, 0, 999),
    fijo: entero(o.fijo, UMBRAL_DEFAULT.fijo, 0, 999),
    porMes,
  };
}

/** Umbral base, sin mirar el mes. En modo `auto` depende de la flota activa. */
export function umbralBase(cfg: UmbralConfig, activos: number): number {
  if (cfg.modo === "fijo") return cfg.fijo;
  return Math.max(cfg.minimo, Math.round(Math.max(0, activos) * (cfg.porcentaje / 100)));
}

/** Umbral de un mes concreto (1–12): el override si existe, si no la base. */
export function umbralDeMes(cfg: UmbralConfig, mes: number, activos: number): number {
  const o = cfg.porMes[mes];
  return o != null ? o : umbralBase(cfg, activos);
}

/**
 * Mes al que "pertenece" una semana que arranca un lunes: el del jueves, o sea
 * el mes que se lleva la mayoría de los días (misma regla que la norma ISO para
 * numerar semanas). Evita que la última semana de un mes cuente contra el mes
 * siguiente sólo porque el lunes cayó ahí.
 */
export function mesDeSemana(startISO: string): number {
  const d = new Date(startISO + "T00:00:00");
  d.setDate(d.getDate() + 3);
  return d.getMonth() + 1;
}

/** Umbral que le corresponde a la semana que arranca en `startISO`. */
export function umbralDeSemana(cfg: UmbralConfig, startISO: string, activos: number): number {
  return umbralDeMes(cfg, mesDeSemana(startISO), activos);
}

/**
 * De dónde sale el tope, para mostrarlo al lado del número. Sin repetir el
 * número: al lado ya está escrito "3 de 8", y decir 8 dos veces no agrega nada.
 */
export function umbralOrigen(cfg: UmbralConfig, activos: number): string {
  const base =
    cfg.modo === "fijo"
      ? `Tope fijo de ${cfg.fijo} por semana`
      : `${cfg.porcentaje}% de los ${activos} activos, nunca menos de ${cfg.minimo}`;
  const meses = Object.keys(cfg.porMes).length;
  if (meses === 0) return `${base}.`;
  return `${base}, y ${meses === 1 ? "un mes tiene" : `${meses} meses tienen`} el suyo propio.`;
}
