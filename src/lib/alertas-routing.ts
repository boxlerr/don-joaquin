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
 * Efemérides: los eventos de calendario del personal. Se guardan con
 * `tipo: "otro"` y sólo se distinguen por `entidad_tipo`.
 *
 * Lista ÚNICA a propósito: de acá salen el ruteo a `rrhh_eventos`, la limpieza
 * de las que ya pasaron (`generarAlertas`) y el recorte de hitos del mail. Tres
 * copias de la misma lista eran tres lugares donde un aviso nuevo iba a quedar
 * fuera de la regla sin que nadie se entere.
 */
export const ENTIDAD_TIPOS_EFEMERIDE = [
  "choferes_cumple",
  "personal_cumple",
  "choferes_aniversario",
  "personal_aniversario",
  "choferes_periodo_prueba",
] as const;

/**
 * Avisos que CADUCAN: los que dejan de tener sentido apenas pasa su fecha.
 *
 * Son las efemérides más las ausencias programadas. La ausencia es el caso que
 * se nos pasó al principio: el aviso sirve para saber que alguien NO VA A ESTAR,
 * así que una vez que arrancó ya no avisa nada — y sin embargo una de julio
 * seguía llegando en agosto, en rojo, con el texto congelado "Empieza hoy" al
 * lado de un chip que decía "Venció hace 23 días".
 *
 * Es a propósito una lista distinta de ENTIDAD_TIPOS_EFEMERIDE: la ausencia
 * caduca igual, pero rutea a su propia columna (`ausencias_vacaciones`) y no
 * comparte los hitos de preaviso. Ojo con `choferes_vacaciones_saldo`, que NO va
 * acá: ese saldo se puede tomar hasta el 31/12 y después se pierde, así que
 * mientras la fecha no llegue sigue habiendo algo que hacer.
 */
export const ENTIDAD_TIPOS_CADUCAN = [
  ...ENTIDAD_TIPOS_EFEMERIDE,
  "chofer_ausencia",
] as const;

/**
 * ¿Este aviso deja de tener sentido cuando pasa su fecha?
 *
 * La distinción que ordena todo el sistema: un DOCUMENTO vencido sigue siendo un
 * problema y hay que seguir reclamándolo; un cumpleaños que fue, o una ausencia
 * que ya arrancó, no se resuelven trabajando — se terminaron.
 */
export function caducaAlPasar(a: { tipo: string; entidad_tipo?: string | null }): boolean {
  if (a.tipo !== "otro") return false;
  return (ENTIDAD_TIPOS_CADUCAN as readonly string[]).includes(a.entidad_tipo ?? "");
}

/**
 * Hitos de preaviso del MAIL para cumpleaños y aniversarios: dos semanas antes,
 * una semana antes y el día del evento. En la pantalla y la campana se siguen
 * viendo todos los días — la diferencia es a propósito: al correo no le sirve
 * repetir treinta mañanas seguidas que Bruno cumple años el 30 de julio.
 */
export const HITOS_EFEMERIDE = [14, 7, 0];

/**
 * Ídem para el fin de período de prueba, que se avisa con más anticipación
 * porque hay una decisión que tomar.
 *
 * Esta lista manda en los DOS lados: `lib/alertas.ts` genera la alerta estos
 * días y el mail filtra por estos días. Cuando eran dos listas separadas
 * (30/15/5 al generar, 14/7/0 al filtrar) no coincidían en ningún número y el
 * período de prueba no salía por correo NUNCA. El 0 es el que más importa: es
 * el último día en que la decisión sigue siendo del empleador.
 */
export const HITOS_PERIODO_PRUEBA = [30, 15, 5, 0];

/**
 * Ventana del resumen del lunes: las efemérides de la semana que arranca.
 * Ver `efemerideEnMail`.
 */
const DIAS_SEMANA_EFEMERIDE = 7;

/**
 * Cuánto recorta cada correo:
 * - `hitos`: sólo los días de preaviso → resumen de todos los días.
 * - `semana`: los hitos + lo que cae dentro de los próximos 7 días → lunes.
 * - `todo`: cualquier efeméride que todavía no haya pasado → envío de prueba.
 */
export type ModoEfemerides = "hitos" | "semana" | "todo";

/**
 * ¿Entra esta efeméride en el correo?
 *
 * Si ya ocurrió, no —en ningún modo—: se terminó, no hay ninguna acción posible
 * (un documento vencido sí sigue siendo un problema, y por eso no pasa por acá).
 *
 * Si todavía falta, manda el modo. El resumen del lunes traía TODO lo pendiente,
 * o sea también el cumpleaños de dentro de 29 días — justo el recordatorio
 * inútil que el recorte por hitos vino a sacar. Ahora el lunes suma la SEMANA
 * que arranca, que es la información que sirve para organizarla, y nada más:
 * el que cae a 20 días vuelve solo en su hito de 14.
 *
 * `dias` lo calcula el llamador (`diasRestantes`) para que esta regla quede
 * pura y testeable.
 */
export function efemerideEnMail(
  a: { entidad_tipo?: string | null },
  dias: number | null,
  modo: ModoEfemerides,
): boolean {
  if (dias === null) return true; // sin fecha no hay nada que medir
  if (dias < 0) return false;
  if (modo === "todo") return true;
  const hitos =
    a.entidad_tipo === "choferes_periodo_prueba" ? HITOS_PERIODO_PRUEBA : HITOS_EFEMERIDE;
  if (hitos.includes(dias)) return true;
  return modo === "semana" && dias <= DIAS_SEMANA_EFEMERIDE;
}

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

  // RRHH — efemérides de personal (la lista vive arriba, en ENTIDAD_TIPOS_EFEMERIDE)
  ...Object.fromEntries(ENTIDAD_TIPOS_EFEMERIDE.map((t) => [t, "rrhh_eventos"])),

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

/**
 * ¿Es una efeméride (cumpleaños, aniversario, fin de período de prueba)?
 *
 * Se separan del resto porque una vez que la fecha pasó no hay nada que hacer:
 * no se resuelven trabajando, se terminan. Un documento vencido sigue siendo un
 * problema y se sigue avisando; un cumpleaños que fue, no — llegaba por mail
 * con un "Venció el 30/07" que no quería decir nada.
 */
export function esEfemeride(a: { tipo: string; entidad_tipo?: string | null }): boolean {
  if (a.tipo !== "otro") return false;
  return (ENTIDAD_TIPOS_EFEMERIDE as readonly string[]).includes(a.entidad_tipo ?? "");
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
