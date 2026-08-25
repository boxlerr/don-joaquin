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

import { limpiarTope } from "@/lib/topes";

// La cuenta en sí es la misma para cualquier tope del sistema y vive en
// lib/topes. Se re-exporta para que las pantallas de préstamos sigan
// importando de un solo lado.
export { excedeTope, carga, nivel } from "@/lib/topes";
export type { Exceso, Nivel } from "@/lib/topes";

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

/** Normaliza lo que venga de la base o del formulario a una config válida. */
export function mergeTopes(raw: unknown): TopesConfig {
  if (!raw || typeof raw !== "object") return { ...TOPES_DEFAULT };
  const o = raw as Record<string, unknown>;
  return { dia: limpiarTope(o.dia), semana: limpiarTope(o.semana), mes: limpiarTope(o.mes) };
}

export function hayAlgunTope(t: TopesConfig): boolean {
  return t.mes != null;
}
