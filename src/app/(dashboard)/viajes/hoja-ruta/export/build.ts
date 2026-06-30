import ExcelJS from "exceljs";

// Construcción del Excel "Hoja de ruta" con el MISMO diseño que el maestro del
// cliente: una hoja por chofer, fila de patentes arriba, encabezado amarillo
// (DIA · SALE DE · LLEGA A · KM REC · TN COM 29 · TN ESC 35 · TN ESC 37,5 ·
// REMITO Nº · MATERIAL · KM VACIOS · $) y una fila por viaje. Usa exceljs porque
// el SheetJS gratis no escribe estilos (rellenos, formato de fecha, bordes).

export type ExportViaje = {
  fecha: string; // YYYY-MM-DD
  origen: string;
  destino: string;
  km_con_carga: number;
  km_vacios: number;
  capacidad: number | null; // capacidad_tn del camión → define la columna de toneladas
  tonelaje: number | null;
  remito: string;
  material: string;
  importe: number | null;
  es_vacio: boolean;
};

export type ExportChofer = {
  apellido: string;
  nombre: string;
  tractor: string;
  acoplado: string;
  viajes: ExportViaje[];
};

const HEADER = [
  "DIA", "SALE DE", "LLEGA A", "KM REC", "TN COM 29", "TN ESC 35",
  "TN ESC 37,5", "REMITO Nº", "MATERIAL", "KM VACIOS", "$",
];
const WIDTHS = [10, 14, 14, 9, 10, 10, 11, 12, 16, 11, 15];

const AMARILLO = "FFFFFF99";
const NARANJA = "FFE46C0A";

function thin() {
  const s = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  return { top: s, left: s, bottom: s, right: s };
}

/** Columna de toneladas según la capacidad del camión: 29 → E, 35 → F, 37,5 → G. */
function bucketCol(capacidad: number | null): 5 | 6 | 7 {
  if (capacidad == null) return 7;
  if (capacidad <= 31) return 5;
  if (capacidad <= 36) return 6;
  return 7;
}

function sheetName(apellido: string, used: Set<string>): string {
  const base =
    (apellido || "CHOFER").toUpperCase().replace(/[\\/?*[\]:]/g, "").slice(0, 28).trim() || "CHOFER";
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base} ${i++}`.slice(0, 31);
  used.add(name);
  return name;
}

export async function buildHojaRutaWorkbook(choferes: ExportChofer[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Don Joaquín — Sistema de Gestión";
  const used = new Set<string>();

  for (const ch of choferes) {
    const ws = wb.addWorksheet(sheetName(ch.apellido, used));
    ws.columns = WIDTHS.map((width) => ({ width }));

    // Fila 1: patentes (tractor / Y / acoplado) — igual que el maestro (cols D-F).
    const pat = ws.getCell("D1");
    pat.value = ch.tractor || "";
    pat.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NARANJA } };
    pat.font = { bold: true, color: { argb: "FFFFFFFF" } };
    pat.alignment = { horizontal: "center" };
    ws.getCell("E1").value = ch.tractor && ch.acoplado ? "Y" : "";
    ws.getCell("E1").alignment = { horizontal: "center" };
    const aco = ws.getCell("F1");
    aco.value = ch.acoplado || "";
    aco.font = { bold: true };
    aco.alignment = { horizontal: "center" };

    // Fila 2: encabezado amarillo.
    const headerRow = ws.getRow(2);
    HEADER.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMARILLO } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thin();
    });
    headerRow.height = 26;

    // Filas de viajes.
    let r = 3;
    let sumKm = 0, sumTn = 0, sumVac = 0, sumImp = 0;
    for (const v of ch.viajes) {
      const row = ws.getRow(r);

      const dia = row.getCell(1);
      // Mediodía para evitar corrimientos de día por zona horaria al serializar.
      dia.value = v.fecha ? new Date(`${v.fecha}T12:00:00`) : null;
      dia.numFmt = "dd-mmm-yy";

      row.getCell(2).value = v.origen || "";
      row.getCell(3).value = v.destino || "";

      const kmRec = v.es_vacio ? v.km_vacios : v.km_con_carga;
      row.getCell(4).value = kmRec || null;

      if (v.tonelaje != null && v.tonelaje > 0) {
        row.getCell(bucketCol(v.capacidad)).value = v.tonelaje;
      }

      row.getCell(8).value = v.remito || "";
      row.getCell(9).value = v.es_vacio ? "VACIO" : v.material || "";
      row.getCell(10).value = v.km_vacios || null;

      const imp = row.getCell(11);
      imp.value = v.importe ?? null;
      imp.numFmt = "#,##0.00";

      for (let c = 1; c <= 11; c++) row.getCell(c).border = thin();

      sumKm += kmRec || 0;
      sumTn += v.tonelaje ?? 0;
      sumVac += v.km_vacios || 0;
      sumImp += v.importe ?? 0;
      r++;
    }

    // Fila de totales.
    const tot = ws.getRow(r);
    tot.getCell(3).value = "TOTALES";
    tot.getCell(4).value = sumKm || null;
    tot.getCell(7).value = sumTn ? Number(sumTn.toFixed(2)) : null;
    tot.getCell(10).value = sumVac || null;
    const totImp = tot.getCell(11);
    totImp.value = sumImp || null;
    totImp.numFmt = "#,##0.00";
    for (let c = 1; c <= 11; c++) {
      tot.getCell(c).font = { bold: true };
      tot.getCell(c).border = thin();
      tot.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    }
  }

  if (choferes.length === 0) {
    wb.addWorksheet("Sin datos").getCell("A1").value = "No hay viajes en el período seleccionado.";
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
