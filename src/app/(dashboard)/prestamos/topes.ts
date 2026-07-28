/**
 * Tope de pago mensual para préstamos: a partir de cuánta plata en el mes hay
 * que encender la alarma.
 *
 * Pedido del padre de Bárbara: "che, fijate que la semana que viene los
 * préstamos superan los 300 millones", "ojo que el mes de noviembre lo tenés
 * complicadísimo". No es que el dato no estuviera: es que había que mirarlo y
 * darse cuenta. El tope lo pone el número por vos.
 *
 * Es MENSUAL y nada más: por día y por semana se probaron y no aportaban — la
 * decisión de plata se toma por mes. El tipo mantiene `dia` y `semana` porque ya
 * hay configuraciones guardadas con esas claves y no vale la pena migrarlas,
 * pero la pantalla sólo edita y usa el mensual.
 */

export const TOPES_CLAVE = "prestamos_topes";

export type Periodo = "dia" | "semana" | "mes";

export type TopesConfig = {
  dia: number | null;
  semana: number | null;
  mes: number | null;
};

export const TOPES_DEFAULT: TopesConfig = { dia: null, semana: null, mes: null };

export const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "por día",
  semana: "por semana",
  mes: "por mes",
};

/** Lo único que se edita y se controla hoy. */
export const PERIODOS: Periodo[] = ["mes"];

function limpiar(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  // Un tope en cero no significa "avisar siempre", significa "sin tope".
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Normaliza lo que venga de la base o del formulario a una config válida. */
export function mergeTopes(raw: unknown): TopesConfig {
  if (!raw || typeof raw !== "object") return { ...TOPES_DEFAULT };
  const o = raw as Record<string, unknown>;
  return { dia: limpiar(o.dia), semana: limpiar(o.semana), mes: limpiar(o.mes) };
}

export function hayAlgunTope(t: TopesConfig): boolean {
  return t.mes != null;
}

export type Exceso = {
  /** Cuánto se pasó, en plata. */
  exceso: number;
  /** Cuánto se pasó, en porcentaje sobre el tope. */
  porcentaje: number;
};

/** Null si no hay tope o si no se pasa. */
export function excedeTope(total: number, tope: number | null): Exceso | null {
  if (tope == null || tope <= 0 || total <= tope) return null;
  return { exceso: total - tope, porcentaje: ((total - tope) / tope) * 100 };
}

/**
 * Qué tan cargado está un período respecto de su tope, de 0 a 1+. Sirve para
 * pintar la barra: verde hasta 0.8, ámbar hasta 1, rojo pasado el tope.
 */
export function carga(total: number, tope: number | null): number | null {
  if (tope == null || tope <= 0) return null;
  return total / tope;
}

export type Nivel = "ok" | "cerca" | "excedido";

export function nivel(total: number, tope: number | null): Nivel {
  const c = carga(total, tope);
  if (c == null) return "ok";
  if (c > 1) return "excedido";
  if (c >= 0.85) return "cerca";
  return "ok";
}
