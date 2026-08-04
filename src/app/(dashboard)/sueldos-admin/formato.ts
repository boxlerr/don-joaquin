// Helpers de formato compartidos por la planilla de sueldos admin/taller.

export const pesos = (n: number) =>
  `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export const pct1 = (n: number) =>
  `${n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const MESES_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-08-01" → "agosto 2026" */
export function mesLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MESES_FULL[parseInt(m, 10) - 1]} ${y}`;
}

/** "2026-08" → "ago 2026" */
export function mesCortoLabel(mes: string): string {
  const [y, m] = mes.slice(0, 7).split("-");
  return `${MESES_CORTO[parseInt(m, 10) - 1]} ${y}`;
}

export function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Interpreta un monto escrito o pegado desde Excel. Formato AR: la coma es
 * decimal y los puntos son separador de miles. Tolera "$", espacios y demás
 * adornos que vienen al copiar celdas de una planilla.
 */
export function parseNum(s: string): number | null {
  let t = s.replace(/[^\d,.-]/g, "").trim();
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Formatea un monto (entero) con separador de miles AR mientras se tipea. */
export function formatMiles(s: string): string {
  if (!s) return "";
  const neg = s.trim().startsWith("-");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return neg ? "-" : "";
  return (neg ? "-" : "") + Number(digits).toLocaleString("es-AR");
}
