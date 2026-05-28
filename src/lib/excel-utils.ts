import * as XLSX from "xlsx";

// ============================================================================
// Normalización de claves y valores
// ============================================================================

export function normKey(k: string): string {
  return k.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["si", "sí", "yes", "true", "1", "x", "✓", "verdadero"].includes(s)) return true;
  if (["no", "false", "0", "falso"].includes(s)) return false;
  return null;
}

// ============================================================================
// Fechas: el Excel mezcla Date objects, seriales (number) y strings
// ============================================================================

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30); // 1899-12-30 UTC, compensa el bug del año bisiesto

export function normalizeDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1 || value > 200000) return null;
    return new Date(EXCEL_EPOCH_MS + value * 86400000);
  }
  if (typeof value === "string") {
    const s = value.trim();
    const mDmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (mDmy) {
      const d = Number(mDmy[1]);
      const m = Number(mDmy[2]) - 1;
      let y = Number(mDmy[3]);
      if (y < 100) y += 2000;
      const date = new Date(Date.UTC(y, m, d));
      return isNaN(date.getTime()) ? null : date;
    }
    const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (mIso) {
      const date = new Date(Date.UTC(Number(mIso[1]), Number(mIso[2]) - 1, Number(mIso[3])));
      return isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

export function formatIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============================================================================
// Estilos de celda — detectar resaltado por color de relleno
//
// El xlsx community no siempre devuelve colores indexed/themed; tratamos esos
// como no resaltados (mejor falso negativo que falso positivo).
// ============================================================================

export function isCellHighlighted(cell: XLSX.CellObject | undefined): boolean {
  if (!cell) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style: any = (cell as any).s;
  if (!style) return false;
  const fg = style.fgColor || style.fill?.fgColor || style.bgColor;
  if (!fg || typeof fg.rgb !== "string") return false;
  const rgb = fg.rgb.toUpperCase().replace(/^FF/, "");
  return rgb !== "FFFFFF" && rgb !== "000000" && rgb !== "FFFFFFFF";
}

// ============================================================================
// Mapeo header → letra de columna
//
// Para hojas donde necesitamos leer estilos por celda (ej. tolva por color)
// sheet_to_json no alcanza; hay que saber en qué columna está cada campo.
// ============================================================================

export function buildHeaderToColMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet: any,
  headerMap: Record<string, string>,
  headerRow = 0,
): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const r = range.s.r + headerRow;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[ref];
      if (!cell) continue;
      const target = headerMap[normKey(String(cell.v ?? ""))];
      if (target && !out[target]) {
        out[target] = XLSX.utils.encode_col(c);
      }
    }
  } catch {
    // si "!ref" está roto devolvemos lo que se haya juntado hasta acá
  }
  return out;
}

// ============================================================================
// Detección de patentes y nombres de sheet
// ============================================================================

// Formatos AR: AAA999 (viejo), AA999AA (Mercosur). Aceptamos opcionalmente
// espacios o guiones para tolerar Excels desprolijos. NO valida que la patente
// exista — solo que la cadena tenga forma de patente.
const PATENTE_REGEX = /^[A-Z]{2,3}\s?-?\s?\d{3}\s?-?\s?[A-Z]{0,3}$/;
const PATENTE_INLINE_REGEX = /[A-Z]{2,3}\s?\d{3}(?:\s?[A-Z]{2,3})?/g;

export function normalizePatente(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, " ");
  if (!s) return null;
  const compact = s.replace(/[\s-]/g, "");
  if (!PATENTE_REGEX.test(s)) {
    if (!/^[A-Z]{2,3}\d{3}([A-Z]{2,3})?$/.test(compact)) return null;
  }
  return compact;
}

export function extractPatentesFromRow(row: unknown[]): string[] {
  const found = new Set<string>();
  for (const cell of row) {
    if (typeof cell !== "string") continue;
    const upper = cell.toUpperCase();
    const matches = upper.match(PATENTE_INLINE_REGEX);
    if (!matches) continue;
    for (const m of matches) {
      const p = normalizePatente(m);
      if (p) found.add(p);
    }
  }
  return [...found];
}

// Para "  SALTO MAXIMILIANO " → "SALTO MAXIMILIANO"
// Para " MARTINEZ NICO" → "MARTINEZ NICO"
export function normalizeSheetApellido(sheetName: string): string {
  return sheetName.trim().toUpperCase().replace(/\s+/g, " ");
}
