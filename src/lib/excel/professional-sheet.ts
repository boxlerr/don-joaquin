import "server-only";
import ExcelJS from "exceljs";

// Estilo corporativo común para los Excel que exporta el sistema: grises suaves,
// encabezado oscuro con texto blanco centrado, filas zebra, bordes finos, fila de
// totales opcional y encabezado fijo (freeze). Lo usan los distintos módulos para
// que TODOS los exports tengan el mismo aspecto sobrio y profesional.

const GRIS_HEADER = "FF595959";
const GRIS_ZEBRA = "FFF7F7F7";
const BORDE_NEGRO = "FF000000"; // grilla negra fina para que no "flote"
const GRIS_TOTAL = "FFD0D0D0";
const GRIS_TITULO = "FF404040";

export type ColAlign = "l" | "c" | "r";
export type ProColumn = {
  header: string;
  width?: number;
  align?: ColAlign;
  numFmt?: string;
};
export type CellValue = string | number | Date | null;

function borde(color = BORDE_NEGRO) {
  const s = { style: "thin" as const, color: { argb: color } };
  return { top: s, left: s, bottom: s, right: s };
}
function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
function align(a: ColAlign = "c"): Partial<ExcelJS.Alignment> {
  return { horizontal: a === "l" ? "left" : a === "r" ? "right" : "center", vertical: "middle" };
}

/**
 * Escribe una tabla con estilo profesional en `ws`. Opcionalmente un título arriba
 * y una fila de totales abajo. Devuelve nada (muta la hoja).
 */
export function writeProfessionalTable(
  ws: ExcelJS.Worksheet,
  opts: {
    columns: ProColumn[];
    rows: CellValue[][];
    title?: string;
    subtitle?: string;
    totals?: CellValue[]; // misma cantidad de columnas (usar null donde no aplica)
  },
): void {
  const { columns, rows, title, subtitle, totals } = opts;
  const n = columns.length;

  ws.columns = columns.map((c) => ({ width: c.width ?? 14 }));

  let cursor = 1;
  if (title) {
    ws.mergeCells(cursor, 1, cursor, n);
    const t = ws.getCell(cursor, 1);
    t.value = title;
    t.font = { bold: true, size: 13, color: { argb: GRIS_TITULO } };
    t.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(cursor).height = 22;
    cursor++;
    if (subtitle) {
      ws.mergeCells(cursor, 1, cursor, n);
      const s = ws.getCell(cursor, 1);
      s.value = subtitle;
      s.font = { size: 10, color: { argb: "FF808080" } };
      s.alignment = { horizontal: "left", vertical: "middle" };
      cursor++;
    }
    cursor++; // fila en blanco
  }

  // Encabezado.
  const headerRowIdx = cursor;
  const hr = ws.getRow(headerRowIdx);
  hr.height = 22;
  columns.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.fill = fill(GRIS_HEADER);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borde();
  });
  cursor++;

  // Datos (zebra).
  rows.forEach((row, ri) => {
    const r = ws.getRow(cursor);
    r.height = 16;
    const zebra = ri % 2 === 1;
    columns.forEach((c, ci) => {
      const cell = r.getCell(ci + 1);
      cell.value = row[ci] ?? null;
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.alignment = align(c.align);
      cell.border = borde();
      if (zebra) cell.fill = fill(GRIS_ZEBRA);
    });
    cursor++;
  });

  // Totales.
  if (totals) {
    const tr = ws.getRow(cursor);
    tr.height = 18;
    columns.forEach((c, ci) => {
      const cell = tr.getCell(ci + 1);
      cell.value = totals[ci] ?? null;
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.font = { bold: true, color: { argb: GRIS_TITULO } };
      cell.fill = fill(GRIS_TOTAL);
      cell.alignment = align(c.align);
      cell.border = borde();
    });
    cursor++;
  }

  // Fijar el encabezado.
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
}

/** Crea un workbook con una sola hoja profesional y devuelve el Buffer. */
export async function buildSingleSheetWorkbook(
  sheetName: string,
  opts: Parameters<typeof writeProfessionalTable>[1],
): Promise<Buffer> {
  return buildMultiSheetWorkbook([{ name: sheetName, opts }]);
}

/** Crea un workbook con varias hojas profesionales (una tabla por hoja). */
export async function buildMultiSheetWorkbook(
  sheets: { name: string; opts: Parameters<typeof writeProfessionalTable>[1] }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Don Joaquín — Sistema de Gestión";
  if (sheets.length === 0) {
    wb.addWorksheet("Sin datos").getCell("A1").value = "No hay datos para exportar.";
  }
  const usados = new Set<string>();
  for (const s of sheets) {
    let name = (s.name || "Hoja").slice(0, 31);
    let i = 2;
    while (usados.has(name)) name = `${(s.name || "Hoja").slice(0, 28)} ${i++}`;
    usados.add(name);
    writeProfessionalTable(wb.addWorksheet(name), s.opts);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
