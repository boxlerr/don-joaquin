import * as XLSX from "xlsx";
import {
  extractPatentesFromRow,
  formatIsoDate,
  isCellHighlighted,
  normalizeDate,
  normalizeSheetApellido,
  normKey,
} from "@/lib/excel-utils";

// ============================================================================
// Tipos públicos
// ============================================================================

export type ParsedItem = {
  rowNum: number;               // fila Excel (1-based) para mostrar en preview
  dia: string;                  // ISO YYYY-MM-DD
  sale_de: string;
  llega_a: string;
  km_recorridos: number;
  km_vacios: number;
  tn_com_29: number | null;
  tn_esc_35: number | null;
  tn_esc_37_5: number | null;
  remito_numero: string | null; // null si Excel dice "VACIO" o está vacío
  material: string | null;
  monto_chofer: number | null;
  viaje_vacio: boolean;         // true si remito Excel = "VACIO"
  tolva_detectada_por_color: boolean; // celda DIA resaltada
};

export type ParsedSheet = {
  sheetName: string;            // raw
  apellido: string;             // normalizado (uppercase, espacios colapsados)
  patentesExcel: string[];      // las que aparecen en row 0 (informativo)
  periodoDesde: string | null;  // ISO, min(dia) entre items
  periodoHasta: string | null;  // ISO, max(dia) entre items
  items: ParsedItem[];
  warnings: string[];
  errors: string[];             // si está poblado, la sheet no se puede importar
};

export type ParseResult = {
  sheets: ParsedSheet[];
  skippedSheets: string[];      // sheets que se ignoraron (totales, gastos, etc.)
};

// ============================================================================
// Constantes
// ============================================================================

// Sheets que no son de un chofer: totales, hojas de gastos, sheet vacío inicial.
const SKIP_SHEET_NORM = new Set(
  ["totales", "total", "hoja de gastos", "hoja de gastos (2)", "hoja1"].map(normKey),
);

// Mapeo de header del Excel → campo interno.
//   Importante: "TN ESC 37,5" trae coma, "REMITO Nº" trae Nº. normKey ayuda.
const HEADER_MAP: Record<string, keyof HeaderCols> = {
  dia: "dia",
  "sale de": "sale_de",
  "llega a": "llega_a",
  "km rec": "km_recorridos",
  "km recorridos": "km_recorridos",
  "tn com 29": "tn_com_29",
  "tn esc 35": "tn_esc_35",
  "tn esc 37,5": "tn_esc_37_5",
  "tn esc 37.5": "tn_esc_37_5",
  "remito nº": "remito_numero",
  "remito n°": "remito_numero",
  "remito n": "remito_numero",
  remito: "remito_numero",
  material: "material",
  "km vacios": "km_vacios",
  "km vacíos": "km_vacios",
  $: "monto_chofer",
  monto: "monto_chofer",
};

type HeaderCols = {
  dia: number;
  sale_de: number;
  llega_a: number;
  km_recorridos: number;
  km_vacios: number;
  tn_com_29: number;
  tn_esc_35: number;
  tn_esc_37_5: number;
  remito_numero: number;
  material: number;
  monto_chofer: number;
};

// ============================================================================
// Entry point
// ============================================================================

export function parseHojaRutaWorkbook(buffer: Buffer | ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true, cellDates: false });
  const sheets: ParsedSheet[] = [];
  const skippedSheets: string[] = [];

  for (const name of wb.SheetNames) {
    if (SKIP_SHEET_NORM.has(normKey(name))) {
      skippedSheets.push(name);
      continue;
    }
    const sheet = wb.Sheets[name];
    if (!sheet) {
      skippedSheets.push(name);
      continue;
    }
    sheets.push(parseSheet(sheet, name));
  }

  return { sheets, skippedSheets };
}

// ============================================================================
// Parsing por sheet
// ============================================================================

function parseSheet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet: any,
  sheetName: string,
): ParsedSheet {
  const apellido = normalizeSheetApellido(sheetName);

  // El Excel viene con 16384 columnas de styling pegado por Bárbara.
  // Limitamos el rango a las primeras 15 columnas (DIA..$ son 11) antes de
  // pasarlo a sheet_to_json, que sino itera todo el ancho innecesariamente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheetView: any = { ...sheet };
  if (sheet["!ref"]) {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const limited = XLSX.utils.encode_range({
      s: { r: range.s.r, c: range.s.c },
      e: { r: range.e.r, c: Math.min(range.e.c, range.s.c + 14) },
    });
    sheetView["!ref"] = limited;
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheetView, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const warnings: string[] = [];
  const errors: string[] = [];

  // Buscar la fila de headers (la que contiene "DIA" en alguna columna).
  const headerRowIdx = findHeaderRow(aoa);
  if (headerRowIdx === -1) {
    errors.push("No se encontró la fila de encabezados (DIA, SALE DE, …).");
    return emptySheet(sheetName, apellido, [], warnings, errors);
  }

  // Patentes del Excel: la fila inmediata anterior al header suele tenerlas.
  // Las leemos como pista informativa, sin validar contra `camiones`.
  const patentesRow = headerRowIdx > 0 ? (aoa[headerRowIdx - 1] ?? []) : [];
  const patentesExcel = extractPatentesFromRow(patentesRow as unknown[]);

  // Mapear cada header de Excel a su índice de columna.
  const headerCols = buildHeaderCols(aoa[headerRowIdx] as unknown[]);
  const missing = requiredHeaders.filter((h) => headerCols[h] === -1);
  if (missing.length) {
    errors.push(`Faltan columnas obligatorias: ${missing.join(", ")}`);
    return emptySheet(sheetName, apellido, patentesExcel, warnings, errors);
  }

  const diaCol = headerCols.dia;
  const items: ParsedItem[] = [];
  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const rowVals = (aoa[r] ?? []) as unknown[];
    const item = parseDataRow(rowVals, headerCols, r + 1);
    if (item) {
      // Detección de tolva: ¿celda DIA resaltada?
      const ref = XLSX.utils.encode_cell({ r, c: diaCol });
      item.tolva_detectada_por_color = isCellHighlighted(sheet[ref]);
      items.push(item);
    }
  }

  if (items.length === 0) {
    warnings.push("La hoja no contiene viajes válidos.");
  }

  const fechas = items.map((i) => i.dia).sort();
  return {
    sheetName,
    apellido,
    patentesExcel,
    periodoDesde: fechas[0] ?? null,
    periodoHasta: fechas[fechas.length - 1] ?? null,
    items,
    warnings,
    errors,
  };
}

// ============================================================================
// Helpers internos
// ============================================================================

const requiredHeaders: (keyof HeaderCols)[] = ["dia", "sale_de", "llega_a", "km_recorridos"];

function findHeaderRow(aoa: unknown[][]): number {
  for (let r = 0; r < Math.min(aoa.length, 10); r++) {
    const row = aoa[r] ?? [];
    for (const cell of row) {
      if (typeof cell !== "string") continue;
      if (normKey(cell) === "dia") return r;
    }
  }
  return -1;
}

function buildHeaderCols(headerRow: unknown[]): HeaderCols {
  const out: HeaderCols = {
    dia: -1,
    sale_de: -1,
    llega_a: -1,
    km_recorridos: -1,
    km_vacios: -1,
    tn_com_29: -1,
    tn_esc_35: -1,
    tn_esc_37_5: -1,
    remito_numero: -1,
    material: -1,
    monto_chofer: -1,
  };
  for (let c = 0; c < headerRow.length; c++) {
    const raw = headerRow[c];
    if (raw == null || raw === "") continue;
    const target = HEADER_MAP[normKey(String(raw))];
    if (target && out[target] === -1) out[target] = c;
  }
  return out;
}

function parseDataRow(
  row: unknown[],
  cols: HeaderCols,
  rowNum: number,
): ParsedItem | null {
  const rawDia = row[cols.dia];
  const dia = normalizeDate(rawDia);
  if (!dia) return null; // fila de cierre / vacía / subtotal

  const saleDe = toCleanString(row[cols.sale_de]);
  const llegaA = toCleanString(row[cols.llega_a]);
  if (!saleDe || !llegaA) return null;

  const km = toIntOrZero(row[cols.km_recorridos]);
  const kmVacios = toIntOrZero(row[cols.km_vacios]);
  const tnCom29 = toNumOrNull(row[cols.tn_com_29]);
  const tnEsc35 = toNumOrNull(row[cols.tn_esc_35]);
  const tnEsc375 = toNumOrNull(row[cols.tn_esc_37_5]);
  const remito = toCleanString(row[cols.remito_numero]);
  const material = toCleanString(row[cols.material]) || null;
  const monto = toNumOrNull(row[cols.monto_chofer]);

  const viajeVacio = remito.toUpperCase() === "VACIO";
  const remitoFinal = !remito || viajeVacio ? null : remito;

  return {
    rowNum,
    dia: formatIsoDate(dia),
    sale_de: saleDe,
    llega_a: llegaA,
    km_recorridos: km,
    km_vacios: kmVacios,
    tn_com_29: tnCom29,
    tn_esc_35: tnEsc35,
    tn_esc_37_5: tnEsc375,
    remito_numero: remitoFinal,
    material,
    monto_chofer: monto,
    viaje_vacio: viajeVacio,
    tolva_detectada_por_color: false,
  };
}

function emptySheet(
  sheetName: string,
  apellido: string,
  patentesExcel: string[],
  warnings: string[],
  errors: string[],
): ParsedSheet {
  return {
    sheetName,
    apellido,
    patentesExcel,
    periodoDesde: null,
    periodoHasta: null,
    items: [],
    warnings,
    errors,
  };
}

function toCleanString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().replace(/\s+/g, " ");
}

function toIntOrZero(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function toNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
