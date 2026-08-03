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
  // Ficha del chofer (legajo) para el encabezado de la hoja.
  dni: string;
  cuil: string;
  telefono: string;
  telefonoEmergencia: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  fechaIngreso: string; // YYYY-MM-DD
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
const BORDE_NEGRO = "FF000000"; // grilla negra fina para que no "flote"
const GRIS_TOTAL = "FFD0D0D0";
const ROJO_VACIO = "FFC00000";

function borde(color = BORDE_NEGRO) {
  const s = { style: "thin" as const, color: { argb: color } };
  return { top: s, left: s, bottom: s, right: s };
}
function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
function alinear(a: "l" | "c" | "r"): Partial<ExcelJS.Alignment> {
  return { horizontal: a === "l" ? "left" : a === "r" ? "right" : "center", vertical: "middle" };
}

function fmtFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Fila combinada A:K (banner) con texto a la izquierda — para la ficha del chofer. */
function bannerRow(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string,
  opts: { fillArgb: string; fontColor: string; bold: boolean; size: number; height: number },
) {
  ws.mergeCells(row, 1, row, 11);
  for (let c = 1; c <= 11; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = fill(opts.fillArgb);
    cell.border = borde();
  }
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: opts.bold, size: opts.size, color: { argb: opts.fontColor } };
  cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(row).height = opts.height;
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

export async function buildHojaRutaWorkbook(
  choferes: ExportChofer[],
  /** Período exportado ("Julio 2026", "01/05/2026 al 15/07/2026"). Va en el
   *  encabezado de cada hoja: con rangos libres, el nombre del archivo no
   *  alcanza para saber qué se está mirando una vez impreso. */
  periodo?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Don Joaquín — Sistema de Gestión";

  const used = new Set<string>();

  for (const ch of choferes) {
    const ws = wb.addWorksheet(sheetName(ch.apellido, used), {
      views: [{ state: "frozen", ySplit: 5 }], // fijar ficha + patentes + encabezado
    });
    ws.columns = WIDTHS.map((width) => ({ width }));

    // Filas 1-3: ficha del chofer (legajo) — nombre + datos de contacto. El
    // período va a la derecha de la misma fila: la hoja se imprime y hay que
    // poder saber de qué fechas es sin mirar el nombre del archivo.
    const nombreCompleto = [ch.apellido, ch.nombre].filter(Boolean).join(", ").toUpperCase() || "CHOFER";
    bannerRow(ws, 1, nombreCompleto, { fillArgb: GRIS_HEADER, fontColor: "FFFFFFFF", bold: true, size: 13, height: 22 });
    if (periodo) {
      // Se rompe el merge A:K de la fila para reservar H:K al período.
      ws.unMergeCells(1, 1, 1, 11);
      ws.mergeCells(1, 1, 1, 7);
      ws.mergeCells(1, 8, 1, 11);
      const per = ws.getCell(1, 8);
      per.value = periodo;
      per.font = { bold: false, size: 10, color: { argb: "FFD9D9D9" } };
      per.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    }

    const datos = [
      ch.dni ? `DNI: ${ch.dni}` : "",
      ch.cuil ? `CUIL: ${ch.cuil}` : "",
      ch.telefono ? `Tel.: ${ch.telefono}` : "",
      ch.telefonoEmergencia ? `Emergencia: ${ch.telefonoEmergencia}` : "",
    ].filter(Boolean).join("      ·      ");
    const ubic = [ch.localidad, ch.provincia].filter(Boolean).join(", ");
    const ubicacion = [
      ch.domicilio ? `Domicilio: ${ch.domicilio}` : "",
      ubic ? `Localidad: ${ubic}` : "",
      ch.fechaIngreso ? `Ingreso: ${fmtFecha(ch.fechaIngreso)}` : "",
    ].filter(Boolean).join("      ·      ");
    bannerRow(ws, 2, datos, { fillArgb: "FFF2F2F2", fontColor: "FF404040", bold: false, size: 10, height: 16 });
    bannerRow(ws, 3, ubicacion, { fillArgb: "FFF2F2F2", fontColor: "FF404040", bold: false, size: 10, height: 16 });

    // Fila 4: patentes (tractor / Y / acoplado).
    const r1 = ws.getRow(4);
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

    // Fila 5: encabezado.
    const hr = ws.getRow(5);
    hr.height = 24;
    HEADER.forEach((h, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = h;
      cell.fill = fill(GRIS_HEADER);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = borde();
    });

    // Filas de viajes.
    let r = 6;
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

      // Convención de la planilla del cliente: TODO tramo (cargado o vacío) lleva
      // sus km en KM REC; el vacío se distingue solo por "VACIO" en remito. La
      // columna KM VACIOS queda para km vacíos embebidos en un viaje cargado —
      // nunca se repite ahí el km del tramo vacío (salía duplicado, reunión 02/07).
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
      row.getCell(10).value = v.es_vacio ? null : v.km_vacios || null;

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
      sumVac += v.es_vacio ? 0 : v.km_vacios || 0;
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
      cell.border = borde();
      cell.alignment = alinear(ALIGN[c - 1]);
    }
  }

  if (choferes.length === 0) {
    wb.addWorksheet("Sin datos").getCell("A1").value = periodo
      ? `No hay viajes cargados en el período seleccionado (${periodo}).`
      : "No hay viajes en el período seleccionado.";
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
