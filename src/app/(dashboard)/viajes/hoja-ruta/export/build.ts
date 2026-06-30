import ExcelJS from "exceljs";

// Export "Hoja de ruta" con look profesional/corporativo (grises suaves, info
// centrada, bordes finos, filas zebra) y fiel a la estructura del Excel maestro:
// una hoja por chofer, fila de patentes arriba, encabezado y columnas
// DIA · SALE DE · LLEGA A · KM REC · TN COM 29 · TN ESC 35 · TN ESC 37,5 ·
// REMITO Nº · MATERIAL · KM VACIOS · $. Cuando el viaje es vacío, "VACIO" en rojo
// en la columna REMITO. Usa exceljs porque el SheetJS gratis no escribe estilos.

export type ExportViaje = {
  fecha: string; // YYYY-MM-DD
  origen: string;
  destino: string;
  km_con_carga: number;
  km_vacios: number;
  capacidad: number | null;
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
const WIDTHS = [11, 16, 16, 9, 11, 11, 11, 13, 18, 11, 16];
// Alineación por columna (1-based): l=izquierda, c=centro, r=derecha.
const ALIGN: ("l" | "c" | "r")[] = ["c", "l", "l", "c", "c", "c", "c", "c", "l", "c", "r"];

// Paleta sobria.
const GRIS_HEADER = "FF595959"; // encabezado (gris medio-oscuro)
const GRIS_PATENTE = "FFD9D9D9"; // fila de patentes
const GRIS_ZEBRA = "FFF7F7F7"; // filas pares
const GRIS_BORDE = "FFE0E0E0";
const GRIS_TOTAL = "FFD0D0D0";
const ROJO_VACIO = "FFC00000";

function borde(color = GRIS_BORDE) {
  const s = { style: "thin" as const, color: { argb: color } };
  return { top: s, left: s, bottom: s, right: s };
}
function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
function alinear(a: "l" | "c" | "r"): Partial<ExcelJS.Alignment> {
  return { horizontal: a === "l" ? "left" : a === "r" ? "right" : "center", vertical: "middle" };
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
    const ws = wb.addWorksheet(sheetName(ch.apellido, used), {
      views: [{ state: "frozen", ySplit: 2 }], // fijar patentes + encabezado
    });
    ws.columns = WIDTHS.map((width) => ({ width }));

    // Fila 1: patentes (tractor / Y / acoplado) — gris suave, centrado.
    const r1 = ws.getRow(1);
    r1.height = 18;
    for (let c = 1; c <= 11; c++) {
      const cell = r1.getCell(c);
      cell.fill = fill(GRIS_PATENTE);
      cell.border = borde();
    }
    r1.getCell(4).value = ch.tractor || "";
    r1.getCell(5).value = ch.tractor && ch.acoplado ? "Y" : "";
    r1.getCell(6).value = ch.acoplado || "";
    for (const c of [4, 5, 6]) {
      r1.getCell(c).font = { bold: true, color: { argb: "FF404040" } };
      r1.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    }

    // Fila 2: encabezado.
    const hr = ws.getRow(2);
    hr.height = 24;
    HEADER.forEach((h, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = h;
      cell.fill = fill(GRIS_HEADER);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = borde("FF808080");
    });

    // Filas de viajes.
    let r = 3;
    let sumKm = 0, sumTn = 0, sumVac = 0, sumImp = 0;
    let idx = 0;
    for (const v of ch.viajes) {
      const row = ws.getRow(r);
      row.height = 16;
      const zebra = idx % 2 === 1;

      const dia = row.getCell(1);
      dia.value = v.fecha ? new Date(`${v.fecha}T12:00:00`) : null;
      dia.numFmt = "dd-mmm-yy";

      row.getCell(2).value = v.origen || "";
      row.getCell(3).value = v.destino || "";

      const kmRec = v.es_vacio ? v.km_vacios : v.km_con_carga;
      row.getCell(4).value = kmRec || null;

      if (v.tonelaje != null && v.tonelaje > 0) {
        row.getCell(bucketCol(v.capacidad)).value = v.tonelaje;
      }

      // REMITO Nº: "VACIO" en rojo cuando el viaje es vacío.
      const remito = row.getCell(8);
      if (v.es_vacio) {
        remito.value = "VACIO";
        remito.font = { bold: true, color: { argb: ROJO_VACIO } };
      } else {
        remito.value = v.remito || "";
      }

      row.getCell(9).value = v.es_vacio ? "" : v.material || "";
      row.getCell(10).value = v.km_vacios || null;

      const imp = row.getCell(11);
      imp.value = v.es_vacio ? 0 : v.importe ?? null;
      imp.numFmt = '"$" #,##0.00';

      // Estilo de toda la fila (zebra + bordes + alineación).
      for (let c = 1; c <= 11; c++) {
        const cell = row.getCell(c);
        cell.border = borde();
        cell.alignment = alinear(ALIGN[c - 1]);
        if (zebra) cell.fill = fill(GRIS_ZEBRA);
      }

      sumKm += kmRec || 0;
      sumTn += v.tonelaje ?? 0;
      sumVac += v.km_vacios || 0;
      sumImp += v.es_vacio ? 0 : v.importe ?? 0;
      r++;
      idx++;
    }

    // Fila de totales.
    const tot = ws.getRow(r);
    tot.height = 18;
    tot.getCell(3).value = "TOTALES";
    tot.getCell(4).value = sumKm || null;
    tot.getCell(7).value = sumTn ? Number(sumTn.toFixed(2)) : null;
    tot.getCell(10).value = sumVac || null;
    const totImp = tot.getCell(11);
    totImp.value = sumImp || null;
    totImp.numFmt = '"$" #,##0.00';
    for (let c = 1; c <= 11; c++) {
      const cell = tot.getCell(c);
      cell.font = { bold: true, color: { argb: "FF404040" } };
      cell.fill = fill(GRIS_TOTAL);
      cell.border = borde("FFBFBFBF");
      cell.alignment = alinear(ALIGN[c - 1]);
    }
  }

  if (choferes.length === 0) {
    wb.addWorksheet("Sin datos").getCell("A1").value = "No hay viajes en el período seleccionado.";
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
