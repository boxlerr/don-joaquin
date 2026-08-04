// Helpers de formato compartidos por la pantalla y el export de Costos rep. y rep.

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "$ 85.593.870" — y "-$ 372.025" cuando es una nota de crédito. */
export function ars(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$ ${Math.abs(r).toLocaleString("es-AR")}`;
}

/** "2026-01-01" o "2026-01" -> "Enero 2026" */
export function mesLabel(mesISO: string): string {
  const [y, m] = mesISO.split("-");
  const nombre = MESES_ES[Number(m) - 1] ?? m;
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${y}`;
}

/** "2026-01-01" -> "ene 26" (para la tira de meses, donde el año importa). */
export function mesCorto(mesISO: string): string {
  const [y, m] = mesISO.split("-");
  return `${MESES_ABR[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

/** Variación porcentual contra el mes anterior; null si no hay con qué comparar. */
export function variacion(actual: number, previo: number | undefined): number | null {
  if (previo === undefined || previo === 0) return null;
  return ((actual - previo) / Math.abs(previo)) * 100;
}

export function porcentaje(n: number, decimales = 1): string {
  return `${n.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}%`;
}

/* ------------------------------------------------------------------ *
 * Números de la planilla editable.
 *
 * OJO con reusar los helpers de otras planillas: la de sueldos trabaja en
 * pesos redondos y corta los centavos a propósito. Acá los importes son los
 * del contador y tienen que cerrar al centavo contra su Excel, así que los
 * centavos se conservan en todo el camino.
 * ------------------------------------------------------------------ */

/**
 * Lee un importe escrito o pegado, venga en formato argentino o inglés.
 *
 * Los dos conviven de verdad acá: el Excel del contador escribe "3,049,365.80"
 * (coma de miles, punto decimal) y quien carga a mano escribe "372.025,11".
 * Asumir uno solo daba null en la mitad de los casos y 1,234 donde iba 1234.
 *
 * Regla: el separador decimal es el ÚLTIMO que aparece, y sólo si lo siguen una
 * o dos cifras (los importes no tienen más centavos que eso). Cualquier otro
 * separador es de miles. "1.234" son mil doscientos treinta y cuatro, no uno
 * coma dos tres cuatro.
 */
export function parseNum(s: string): number | null {
  const t = s.replace(/[^\d,.-]/g, "").trim();
  if (t === "") return null;
  const neg = t.startsWith("-");
  const cuerpo = t.replace(/-/g, "");

  const corte = Math.max(cuerpo.lastIndexOf(","), cuerpo.lastIndexOf("."));
  const decimales = corte >= 0 ? cuerpo.slice(corte + 1) : "";
  const esDecimal = corte >= 0 && /^\d{1,2}$/.test(decimales);

  const enteros = (esDecimal ? cuerpo.slice(0, corte) : cuerpo).replace(/[.,]/g, "");
  if (enteros === "" && decimales === "") return null;

  const n = Number(`${enteros || "0"}${esDecimal ? `.${decimales}` : ""}`);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/**
 * Regla del export contable: el costo va entre paréntesis y una línea SIN
 * paréntesis es una nota de crédito, o sea negativa. Tomar el valor absoluto
 * de todo es lo que dejó enero '26 $744.050 arriba del total del Excel.
 */
export function amt(s: string): number | null {
  const t = String(s).trim();
  if (t === "") return null;
  const entreParentesis = /^\(.*\)$/.test(t);
  const n = parseNum(t.replace(/[()]/g, ""));
  if (n == null) return null;
  return entreParentesis ? Math.abs(n) : -Math.abs(n);
}

/**
 * Separador de miles mientras se escribe, conservando el signo y hasta dos
 * decimales: "372025.11" -> "372.025,11".
 */
export function formatMilesAR(s: string): string {
  if (!s) return "";
  const t = s.trim();
  const neg = t.startsWith("-");
  const cuerpo = t.replace(/^-/, "");
  const corte = cuerpo.includes(",") ? cuerpo.lastIndexOf(",") : cuerpo.lastIndexOf(".");
  const hayDecimales = corte >= 0;
  const enteros = (hayDecimales ? cuerpo.slice(0, corte) : cuerpo).replace(/\D/g, "");
  const decimales = hayDecimales ? cuerpo.slice(corte + 1).replace(/\D/g, "").slice(0, 2) : "";
  if (!enteros && !decimales && !hayDecimales) return neg ? "-" : "";
  const cabeza = (neg ? "-" : "") + Number(enteros || "0").toLocaleString("es-AR");
  // La coma se conserva aunque todavía no haya decimales: si no, no se puede
  // llegar a escribir "1.234,5" (la coma desaparecía al tipearla).
  return hayDecimales ? `${cabeza},${decimales}` : cabeza;
}

/** Compara nombres de proveedor ignorando mayúsculas, acentos y espacios de más. */
export function claveProveedor(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
