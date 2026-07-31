// Helpers de formato compartidos del módulo de métricas (es-AR).

export const money = (n: number | null | undefined, dec = 0) =>
  n == null ? "—" : "$" + n.toLocaleString("es-AR", { maximumFractionDigits: dec });

export const numAr = (n: number | null | undefined, dec = 0) =>
  n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: dec });

export const pct = (n: number | null | undefined, dec = 1) =>
  n == null ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: dec })}%`;

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};

export const mesCorto = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1].slice(0, 3)} ${y.slice(2)}`;
};

/** Suma meses a un ISO YYYY-MM-01. */
export function addM(mesISO: string, d: number): string {
  const [y, m] = mesISO.split("-").map((n) => parseInt(n, 10));
  const total = y * 12 + (m - 1) + d;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Delta % entre dos valores (null-safe). */
export const delta = (actual: number | null | undefined, previo: number | null | undefined): number | null =>
  actual == null || previo == null || previo === 0 ? null : (actual / previo - 1) * 100;

/** Diferencia en puntos porcentuales (null-safe). */
export const deltaPP = (actual: number | null | undefined, previo: number | null | undefined): number | null =>
  actual == null || previo == null ? null : actual - previo;
