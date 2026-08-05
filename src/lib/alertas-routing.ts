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
 * Los tipos con `entidad_tipo` propio (todo lo que se guarda como "otro") se
 * rutean más abajo, en ENTIDAD_A_COLUMNA.
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
  mantenimiento_proximo: "mantenimiento",
};

/**
 * Ruteo de las alertas guardadas con `tipo: "otro"`.
 *
 * El enum `alerta_tipo` quedó corto hace rato: cumpleaños, impuestos, services,
 * ausencias y cuotas de préstamo se guardan todas como "otro" y sólo se
 * distinguen por `entidad_tipo`. Sin esta tabla caían todas juntas en "Otros
 * avisos", así que tildar ese casillero era aceptar un cajón que nadie sabía
 * qué contenía — incluidos los montos de préstamos.
 *
 * Las claves que terminan en `:` matchean por prefijo (`impuesto:vencido`,
 * `prestamo_cuota:T1`, `compliance:T30`…).
 */
const ENTIDAD_A_COLUMNA: Record<string, string> = {
  // Préstamos (confidencial: traen montos). Mismo criterio que
  // lib/alertas-visibilidad.ts, que ya trataba al tope como de préstamos.
  "prestamo_cuota:": PRESTAMOS_COL,
  prestamos_tope_mensual: PRESTAMOS_COL,

  // Finanzas
  "impuesto:": "impuestos",

  // Mantenimiento
  mantenimiento_proximo_service: "mantenimiento",
  insumo_precio_desactualizado: "mantenimiento",

  // RRHH — efemérides de personal
  choferes_cumple: "rrhh_eventos",
  personal_cumple: "rrhh_eventos",
  choferes_aniversario: "rrhh_eventos",
  personal_aniversario: "rrhh_eventos",
  choferes_periodo_prueba: "rrhh_eventos",

  // RRHH — disponibilidad
  chofer_ausencia: "ausencias_vacaciones",
  choferes_vacaciones_saldo: "ausencias_vacaciones",
};

export const COLUMNAS_TODAS = [
  "vencimiento_docs", "cheques_vencidos", "viaticos_sin_rendir", "gastos_pendientes",
  "cambios_caja", "nuevo_viaje", "vencimiento_compliance", PRESTAMOS_COL,
  "impuestos", "mantenimiento", "rrhh_eventos", "ausencias_vacaciones", OTROS_AVISOS,
];

/**
 * Columnas que hasta ahora vivían dentro de "Otros avisos" y pasaron a tener
 * casillero propio. Quien tenía el cajón tildado las sigue recibiendo: ver
 * `normalizarColumnas`.
 */
export const COLUMNAS_ABIERTAS_DE_OTROS = [
  "impuestos", "mantenimiento", "rrhh_eventos", "ausencias_vacaciones",
];

/**
 * Las cuotas de préstamo se guardan con `tipo: "otro"` (no hay valor propio en
 * el enum `alerta_tipo`), pero su `entidad_tipo` es `prestamo_cuota:<umbral>`.
 * Eso alcanza para darles columna propia y poder mandárselas sólo a quien
 * corresponde, en vez de mezclarlas en "Otros avisos".
 */
export function esAlertaPrestamo(a: { entidad_tipo?: string | null }): boolean {
  const t = a.entidad_tipo ?? "";
  return t.startsWith("prestamo_cuota") || t === "prestamos_tope_mensual";
}

/** Columna de la matriz a la que pertenece una alerta. */
export function alertaColumnaDe(a: {
  tipo: AlertaTipo;
  entidad_tipo?: string | null;
}): string {
  const entidad = a.entidad_tipo ?? "";
  if (entidad) {
    const exacta = ENTIDAD_A_COLUMNA[entidad];
    if (exacta) return exacta;
    for (const [clave, columna] of Object.entries(ENTIDAD_A_COLUMNA)) {
      if (clave.endsWith(":") && entidad.startsWith(clave)) return columna;
    }
  }
  return TIPO_A_TOGGLE[a.tipo] ?? OTROS_AVISOS;
}

export const alertaClave = (key: string) => `alerta_${key}_activa`;

/**
 * ¿El toggle de configuración deja pasar esta alerta?
 *
 * Falla ABIERTO: si el parámetro no existe todavía (categoría nueva, fila que
 * nunca se creó) el aviso sale igual. Al revés — exigir `=== "true"` — una
 * categoría nueva nacía apagada y en silencio, que es la peor forma de romper
 * un sistema de alertas: no avisa que no avisa.
 */
export function tipoHabilitado(
  a: { tipo: AlertaTipo; entidad_tipo?: string | null },
  params: Map<string, string>,
): boolean {
  return params.get(alertaClave(alertaColumnaDe(a))) !== "false";
}

/**
 * Preferencias de un usuario, con la compatibilidad hacia atrás de la matriz.
 *
 * Impuestos, mantenimiento, efemérides y ausencias salieron de "Otros avisos" y
 * ahora tienen casillero propio. Quien tenía el cajón tildado y todavía no tocó
 * los nuevos los sigue recibiendo; apenas destilda uno, manda lo que eligió.
 */
export function normalizarColumnas(keys: Iterable<string>): string[] {
  const set = new Set(keys);
  if (set.has(OTROS_AVISOS) && !COLUMNAS_ABIERTAS_DE_OTROS.some((k) => set.has(k))) {
    for (const k of COLUMNAS_ABIERTAS_DE_OTROS) set.add(k);
  }
  return [...set];
}
