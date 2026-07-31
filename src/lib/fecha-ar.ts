/**
 * Fecha de hoy en Argentina ("YYYY-MM-DD"). El server corre en UTC, así que
 * `toISOString()` pasa al día siguiente a partir de las 21:00 ART y "hoy" dejaría
 * de ser el día real de trabajo. Misma convención que @/lib/acceso-horario.
 */
export function hoyArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Suma días a una fecha "YYYY-MM-DD" y devuelve el mismo formato. */
export function sumarDiasISO(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const r = new Date(Date.UTC(y, m - 1, d + dias));
  return r.toISOString().slice(0, 10);
}
