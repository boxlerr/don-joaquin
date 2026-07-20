/**
 * Ruteo de alertas → columna de la matriz de notificaciones.
 *
 * Vive aparte (y sin `server-only`) porque lo usan tanto el envío real
 * (`src/lib/notificaciones.ts`) como los scripts de previsualización. Si esto
 * se duplicara, un cambio de ruteo se aplicaría al mail real pero no a lo que
 * se prueba — justo el bug que el ruteo propio de préstamos vino a evitar.
 */
import type { Database } from "@/types/database";

type AlertaTipo = Database["public"]["Enums"]["alerta_tipo"];

export const OTROS_AVISOS = "otros_avisos";
export const PRESTAMOS_COL = "prestamos_vencimiento";

/**
 * Mapea cada tipo de alerta de la base al toggle correspondiente de la UI.
 * Los tipos sin toggle propio (mantenimiento, auditoría, "otro": cumpleaños,
 * período de prueba, ausencias) no se suprimen: se incluyen siempre que el
 * canal Email esté activo.
 */
export const TIPO_A_TOGGLE: Partial<Record<AlertaTipo, string>> = {
  vencimiento_doc_camion: "vencimiento_docs",
  vencimiento_doc_chofer: "vencimiento_docs",
  vencimiento_cheque: "cheques_vencidos",
  cheque_rechazado_recordatorio: "cheques_vencidos",
  viatico_pendiente_rendicion: "viaticos_sin_rendir",
  gasto_sin_comprobante: "gastos_pendientes",
  viaje_sin_cerrar: "nuevo_viaje",
  vencimiento_compliance: "vencimiento_compliance",
};

export const COLUMNAS_TODAS = [
  "vencimiento_docs", "cheques_vencidos", "viaticos_sin_rendir", "gastos_pendientes",
  "cambios_caja", "nuevo_viaje", "vencimiento_compliance", PRESTAMOS_COL, OTROS_AVISOS,
];

/**
 * Las cuotas de préstamo se guardan con `tipo: "otro"` (no hay valor propio en
 * el enum `alerta_tipo`), pero su `entidad_tipo` es `prestamo_cuota:<umbral>`.
 * Eso alcanza para darles columna propia y poder mandárselas sólo a quien
 * corresponde, en vez de mezclarlas en "Otros avisos".
 */
export function esAlertaPrestamo(a: { entidad_tipo?: string | null }): boolean {
  return (a.entidad_tipo ?? "").startsWith("prestamo_cuota");
}

/** Columna de la matriz a la que pertenece una alerta. */
export function alertaColumnaDe(a: {
  tipo: AlertaTipo;
  entidad_tipo?: string | null;
}): string {
  if (esAlertaPrestamo(a)) return PRESTAMOS_COL;
  return TIPO_A_TOGGLE[a.tipo] ?? OTROS_AVISOS;
}

export const alertaClave = (key: string) => `alerta_${key}_activa`;

/** ¿El toggle de configuración deja pasar esta alerta? */
export function tipoHabilitado(
  a: { tipo: AlertaTipo; entidad_tipo?: string | null },
  params: Map<string, string>,
): boolean {
  // Préstamos: toggle propio, pero si el parámetro todavía no existe no se
  // suprime (evita apagar avisos ya existentes por una fila faltante).
  if (esAlertaPrestamo(a)) {
    return params.get(alertaClave(PRESTAMOS_COL)) !== "false";
  }
  const key = TIPO_A_TOGGLE[a.tipo];
  if (!key) return true; // sin toggle propio → no se suprime
  return params.get(alertaClave(key)) === "true";
}
