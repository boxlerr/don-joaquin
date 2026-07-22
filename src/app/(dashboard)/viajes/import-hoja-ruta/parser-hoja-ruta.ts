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

/** Vía del viaje según por dónde fue (reunión Nico 02/07). La marcan a mano en la
 * columna MATERIAL: "Ruta 5" = directa (más corta) · "Ruta 22" = por la base/zona.
 * NULL = sin marcar (la mayoría de los corredores no tiene variante de vía). */
export type HrRutaVia = "ruta_5" | "ruta_22";

export type HrViajeRaw = {
  fecha: string; // ISO YYYY-MM-DD
  saleDe: string;
  llegaA: string;
  kmRec: number | null;
  tnCom29: number | null;
  tnEsc35: number | null;
  tnEsc37_5: number | null;
  remito: string | null; // celda cruda: número, null, o "VACIO" tal cual lo guardan en Excel
  material: string | null; // ya sin la marca de vía (ver extraerVia)
  rutaVia: HrRutaVia | null; // vía leída de la marca "RUTA 5"/"RUTA 22" del material
  kmVacios: number | null;
  importe: number | null; // null = todavía sin importe cargado
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
  warnings: string[];
};

/** Etiqueta única para la ausencia de remito. La columna REMITO Nº del Excel
 * viene en blanco o con la palabra "VACIO" cuando el viaje no llevó carga. */
export const REMITO_VACIO = "vacío";

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

      const { via, material } = extraerVia(asStr(row[8]));
      viajes.push({
        fecha,
        saleDe,
        llegaA,
        kmRec: asNum(row[3]),
        tnCom29: asNum(row[4]),
        tnEsc35: asNum(row[5]),
        tnEsc37_5: asNum(row[6]),
        remito: asStr(row[7]),
        material,
        rutaVia: via,
        kmVacios: asNum(row[9]),
        importe: asNum(row[10]),
      });
    }

    sheets.push({ sheetName, patentes, viajes, filasIgnoradas });
  }

  const totalViajes = sheets.reduce((acc, s) => acc + s.viajes.length, 0);

  return { sheets, totalViajes, warnings };
}

/** Tonelaje único de un viaje (la columna que tenga valor de las 3 escalas). */
export function tonelajeDe(v: HrViajeRaw): number | null {
  return v.tnEsc37_5 ?? v.tnEsc35 ?? v.tnCom29 ?? null;
}

/** Lee la celda REMITO Nº y nada más: el número tal cual si lo hay, o
 * REMITO_VACIO si viene en blanco, nula o dice "VACIO". No depende del importe:
 * un remito cargado sin valor de flete sigue siendo un remito, y que el
 * resultado sea REMITO_VACIO es lo único que define un viaje vacío. */
export function normalizarRemito(remito: string | null | undefined): string {
  const s = remito?.trim();
  if (!s || s.toUpperCase() === "VACIO") return REMITO_VACIO;
  return s;
}

// La vía se marca a mano dentro de la columna MATERIAL, pegada al material. Dos
// formas conviven:
//  1) Explícita: "YPF LAJE RUTA 5", "YPF RUTA  5" (doble espacio), "RUTA 22", o
//     "RUTA 5" sola en un vacío.
//  2) Abreviada: solo el número de vía al final del material ("YPF TORO 5" = por
//     Ruta 5, confirmado por el cliente).
// En ambas separamos la vía a su columna (ruta_via) y dejamos el material limpio.
// Solo 5 y 22 son vías válidas.
const VIA_EN_MATERIAL = /\bRUTA\s*(5|22)\b/i;
// Número de vía suelto al final, con material real (con letras) delante. El chequeo
// de letras evita tomar por vía una celda que es solo un número (ej. "10000").
const VIA_NUMERO_FINAL = /^(.+?)\s+(5|22)\s*$/;

/** Separa la marca de vía del texto del material.
 *  - "YPF LAJE RUTA 5" → { via: "ruta_5", material: "YPF LAJE" }
 *  - "RUTA 22"         → { via: "ruta_22", material: null }
 *  - "YPF TORO 5"      → { via: "ruta_5", material: "YPF TORO" }  (número al final)
 *  - "10000" / "CLINKER" / null → { via: null, material: <igual> } */
export function extraerVia(
  material: string | null,
): { via: HrRutaVia | null; material: string | null } {
  if (!material) return { via: null, material };

  // 1) Marca explícita "RUTA 5/22" en cualquier parte del texto.
  const m = material.match(VIA_EN_MATERIAL);
  if (m) {
    const via: HrRutaVia = m[1] === "22" ? "ruta_22" : "ruta_5";
    const limpio = material.replace(VIA_EN_MATERIAL, " ").replace(/\s+/g, " ").trim();
    return { via, material: limpio ? limpio : null };
  }

  // 2) Número de vía suelto al final ("YPF TORO 5"), solo si hay material con letras
  //    delante (no una celda numérica suelta).
  const m2 = material.match(VIA_NUMERO_FINAL);
  if (m2 && /[a-z]/i.test(m2[1])) {
    const via: HrRutaVia = m2[2] === "22" ? "ruta_22" : "ruta_5";
    return { via, material: m2[1].replace(/\s+/g, " ").trim() };
  }

  return { via: null, material };
}
