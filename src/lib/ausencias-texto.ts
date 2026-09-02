/**
 * Cómo se cuenta una ausencia en pantalla — el mismo texto en /viajes y en el
 * dashboard.
 *
 * Vivía adentro de la tarjeta de disponibilidad de /viajes. Se separó cuando el
 * dashboard empezó a mostrar lo mismo: dos copias del mismo texto se despegan a
 * la primera corrección ("En vacaciones" en una pantalla y "Vacaciones" en la
 * otra para la misma persona el mismo día).
 */

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Las fechas de ausencia son `date` (sin hora). Parsearlas con `new Date(iso)`
 * las lee en UTC y en Argentina caen al día anterior, así que el día de la
 * semana salía corrido: se parsea siempre a mediodía local.
 */
function aFechaLocal(iso: string): Date {
  return new Date(`${iso.split("T")[0]}T12:00:00`);
}

/** "24 ago" — para rangos, donde el año se sobreentiende. */
export function fechaCorta(iso: string): string {
  const d = aFechaLocal(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/**
 * "lun 24 ago" — con el día de la semana, que es lo que se mira para saber si
 * llega a tiempo para el lunes. Sin año: sólo se usa a 14 días vista.
 */
export function fechaCortaConDia(iso: string): string {
  const d = aFechaLocal(iso);
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "hoy" / "mañana" / "en 2 días", para decir cuándo se va sin hacer cuentas. */
export function cuandoSeVa(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

/**
 * Estado de quien hoy no está, nombrando el motivo: "En vacaciones" dice más
 * que "no está". `tipo` es texto libre en la base, así que la preposición se
 * elige por el tipo y hay fallback genérico. Las vacaciones se reconocen por la
 * marca de la carga (`es_vacaciones`), no por cómo esté escrito el tipo.
 */
export function estadoAusente(tipo: string, esVacaciones = false): string {
  const t = tipo.toLowerCase().trim();
  if (esVacaciones || t.startsWith("vacacion")) return "En vacaciones";
  if (t.startsWith("licencia")) return `De ${t}`;
  if (t.startsWith("permiso") || t.startsWith("franco")) return `De ${t}`;
  return `No está hoy · ${t}`;
}

/**
 * El motivo a secas, para cuando la frase ya dice que la persona no está (o que
 * todavía no se fue) y sólo falta por qué. El tipo se muestra tal cual lo
 * escribieron —"Turno médico", "Carnet de conducir"—: es un campo libre y
 * corregirlo acá sería inventarle otro texto al que lo cargó.
 */
export function motivoAusencia(tipo: string, esVacaciones = false): string {
  const t = tipo.trim();
  if (esVacaciones || t.toLowerCase().startsWith("vacacion")) return "Vacaciones";
  return t || "Sin motivo";
}

/**
 * Cuántos días para adelante miran las tarjetas de disponibilidad (el tablero y
 * /viajes). Vivía repetido como `DIAS_DISPONIBILIDAD` en las dos pantallas; se
 * centralizó cuando el alta de ausencias empezó a prometerle a quien carga
 * *desde cuándo* lo va a ver Logística — si la ventana cambia en un lado y la
 * promesa queda en el otro, el diálogo miente.
 */
export const VENTANA_DISPONIBILIDAD_DIAS = 14;

const MESES_LARGOS = [
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

/** "11 de septiembre" — para una fecha suelta dentro de una frase. */
export function fechaProsa(iso: string): string {
  const d = aFechaLocal(iso);
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
}

/**
 * El motivo de un día pedido cuando no hubo ninguno: "se lo doy porque se lo
 * doy" (Bárbara, 02/09/2026). Se guarda como texto, igual que cualquier otro
 * motivo, para que en el legajo y en la tarjeta de Logística se lea solo.
 */
export const SIN_MOTIVO = "Sin motivo";

/** true si el motivo cargado es el "sin motivo" explícito, y no un texto vacío. */
export function esSinMotivo(tipo: string): boolean {
  return tipo.trim().toLowerCase() === SIN_MOTIVO.toLowerCase();
}
