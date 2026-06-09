// Parser del Excel "HOJA DE RUTA completa.xlsx".
// Estructura: cada sheet es un chofer. La fila 1 trae las patentes (sueltas).
// La fila 2 es el encabezado fijo:
//   DIA | SALE DE | LLEGA A | KM REC | TN COM 29 | TN ESC 35 | TN ESC 37,5
//   | REMITO Nº | MATERIAL | KM VACIOS | $
//
// Los 60 sheets de chofer validados tienen exactamente esta estructura
// (1 sola variante). Sheets especiales que se ignoran:
//   TOTALES · HOJA DE GASTOS · HOJA DE GASTOS (2) · FISCHER ·
//   PABLO FISCHER · TOTAL · Hoja1

import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type HrViajeRaw = {
  fecha: string; // ISO YYYY-MM-DD
  saleDe: string;
  llegaA: string;
  kmRec: number | null;
  tnCom29: number | null;
  tnEsc35: number | null;
  tnEsc37_5: number | null;
  remito: string | null; // null o "VACIO" tal cual lo guardan en Excel
  material: string | null;
  kmVacios: number | null;
  importe: number | null; // null = pendiente de facturar
};

export type HrSheetParsed = {
  sheetName: string; // ej "CALIGIURI" o " MARTINEZ NICO"
  patentes: string[]; // patentes que figuran en la fila 1 antes del header
  viajes: HrViajeRaw[];
  filasIgnoradas: number; // filas que no son viajes (totales, gastos pegados)
};

export type HrParseResult = {
  sheets: HrSheetParsed[];
  totalViajes: number;
  totalRemitos: number;
  totalPendientesFacturar: number; // viajes sin importe
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHEETS_IGNORADOS = new Set([
  "TOTALES",
  "TOTAL",
  "HOJA DE GASTOS",
  "HOJA DE GASTOS (2)",
  "FISCHER",
  "PABLO FISCHER",
  "Hoja1",
  "Hoja2",
]);

/** Excel guarda fechas como serial number (días desde 1900-01-01).
 * Esta función las convierte a ISO YYYY-MM-DD sin tema de timezone. */
function excelSerialToISO(n: number): string | null {
  // 25569 = días entre 1900-01-01 y 1970-01-01 (epoch Unix)
  // Excel además tiene el bug del 29-feb-1900 que no existió, por eso resta extra
  const epochDays = n - 25569;
  const ms = epochDays * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function asISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    // Tomar componentes UTC (xlsx puede meter timezone) y armar ISO local
    const yyyy = v.getUTCFullYear();
    const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(v.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof v === "number") return excelSerialToISO(v);
  if (typeof v === "string") {
    // Formatos: "5/4/2026", "5/4/26", "2026-04-05"
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dmy) {
      const [, d, m, yRaw] = dmy;
      const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    // Formato AR: "3.595.944,80" o "35,3"
    const cleaned = v.replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Reconoce las filas 1..(header-1) y extrae lo que parezca una patente
 * argentina: 6-8 chars con letras y números. Tolerante con espacios. */
function extraerPatentes(rows: unknown[][], headerRowIdx: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < headerRowIdx; i++) {
    const row = rows[i] ?? [];
    for (const cell of row) {
      if (typeof cell !== "string") continue;
      const txt = cell.replace(/\s+/g, "").trim().toUpperCase();
      if (txt.length < 6 || txt.length > 9) continue;
      if (!/^[A-Z]{2,3}\d{3,4}[A-Z]{0,2}$/.test(txt)) continue;
      if (!out.includes(txt)) out.push(txt);
    }
  }
  return out;
}

/** Encuentra la fila del header buscando "DIA" en las primeras 8 filas. */
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] ?? [];
    if (row.some((c) => typeof c === "string" && c.trim().toUpperCase() === "DIA")) {
      return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export function parseHojaRutaXlsx(buffer: Buffer | ArrayBuffer): HrParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: HrSheetParsed[] = [];
  const warnings: string[] = [];

  // Pestañas OCULTAS (Hidden=1) o muy ocultas (2): son hojas viejas que el cliente
  // dejó escondidas (ej. "PITTANA EUGENIO" con datos de 2025). No se importan.
  const ocultas = new Set(
    (wb.Workbook?.Sheets ?? [])
      .filter((s) => s && typeof s.Hidden === "number" && s.Hidden !== 0)
      .map((s) => s.name),
  );

  for (const sheetName of wb.SheetNames) {
    if (SHEETS_IGNORADOS.has(sheetName.trim())) continue;
    if (ocultas.has(sheetName)) {
      warnings.push(`${sheetName}: pestaña oculta, se ignoró (data vieja).`);
      continue;
    }
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      raw: true,
      defval: null,
    });

    const headerIdx = findHeaderRow(rows);
    if (headerIdx < 0) {
      warnings.push(`${sheetName}: no se encontró la fila DIA (sheet ignorado).`);
      continue;
    }

    const patentes = extraerPatentes(rows, headerIdx);
    const viajes: HrViajeRaw[] = [];
    let filasIgnoradas = 0;

    // Recorrer desde la fila siguiente al header
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const fecha = asISO(row[0]);
      const saleDe = asStr(row[1]);
      const llegaA = asStr(row[2]);

      // Una fila es viaje si tiene fecha + sale + llega. Filas de totales
      // tienen valores en KM REC pero sin fecha, así que se descartan.
      if (!fecha || !saleDe || !llegaA) {
        if (saleDe || llegaA || asNum(row[3])) filasIgnoradas++;
        continue;
      }

      viajes.push({
        fecha,
        saleDe,
        llegaA,
        kmRec: asNum(row[3]),
        tnCom29: asNum(row[4]),
        tnEsc35: asNum(row[5]),
        tnEsc37_5: asNum(row[6]),
        remito: asStr(row[7]),
        material: asStr(row[8]),
        kmVacios: asNum(row[9]),
        importe: asNum(row[10]),
      });
    }

    sheets.push({ sheetName, patentes, viajes, filasIgnoradas });
  }

  const totalViajes = sheets.reduce((acc, s) => acc + s.viajes.length, 0);
  const totalRemitos = sheets.reduce(
    (acc, s) => acc + s.viajes.filter((v) => v.remito && v.remito.toUpperCase() !== "VACIO").length,
    0,
  );
  const totalPendientesFacturar = sheets.reduce(
    (acc, s) =>
      acc +
      s.viajes.filter(
        (v) => (v.remito && v.remito.toUpperCase() !== "VACIO") && v.importe == null,
      ).length,
    0,
  );

  return { sheets, totalViajes, totalRemitos, totalPendientesFacturar, warnings };
}

/** Tonelaje único de un viaje (la columna que tenga valor de las 3 escalas). */
export function tonelajeDe(v: HrViajeRaw): number | null {
  return v.tnEsc37_5 ?? v.tnEsc35 ?? v.tnCom29 ?? null;
}

/** ¿El viaje fue vacío (sin carga ni remito)? */
export function esViajeVacio(v: HrViajeRaw): boolean {
  if (!v.remito) return true;
  return v.remito.toUpperCase() === "VACIO";
}
