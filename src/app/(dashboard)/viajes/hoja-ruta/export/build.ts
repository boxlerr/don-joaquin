import ExcelJS from "exceljs";
import { etiquetaRutaViaExcel } from "@/domain/viajes/ruta-via";

// Export "Hoja de ruta" con look profesional/corporativo (grises suaves, info
// centrada, bordes finos, filas zebra) y fiel a la estructura del Excel maestro:
// una hoja por chofer, fila de patentes arriba, encabezado y columnas
// DIA · SALE DE · LLEGA A · RUTA · KM REC · TN COM 29 · TN ESC 35 · TN ESC 37,5 ·
// REMITO Nº · MATERIAL · KM VACIOS · $. Cuando el viaje es vacío, "VACIO" en rojo
// en la columna REMITO. Usa exceljs porque el SheetJS gratis no escribe estilos.
//
// Las celdas se escriben por nombre de columna (COL.X), no por número: agregar
// una columna al medio es insertarla en COL y correr los números de ahí para
// abajo, en un solo lugar. Antes los índices estaban repetidos en cada getCell()
// y al agregar RUTA quedaron desfasados: los importes salían bajo "KM VACIOS".

export type ExportViaje = {
  fecha: string; // YYYY-MM-DD
  origen: string;
  destino: string;
  /** 'ruta_5' | 'ruta_22' | null — por qué vía fue el camión (de ella dependen los km). */
  ruta_via: string | null;
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

// Posición (1-based) de cada columna de la planilla. Única fuente de verdad: el
// encabezado, los anchos, la alineación y cada getCell() salen de acá.
const COL = {
  DIA: 1,
  ORIGEN: 2,
  DESTINO: 3,
  RUTA: 4,
  KM_REC: 5,
  TN_29: 6,
  TN_35: 7,
  TN_375: 8,
  REMITO: 9,
  MATERIAL: 10,
  KM_VACIOS: 11,
  IMPORTE: 12,
} as const;

// Definición de las columnas en orden — el índice del array es COL.X - 1.
// Alineación: l=izquierda, c=centro, r=derecha.
const COLUMNAS: { header: string; width: number; align: "l" | "c" | "r" }[] = [
  { header: "DIA", width: 11, align: "c" },
  { header: "SALE DE", width: 16, align: "l" },
  { header: "LLEGA A", width: 16, align: "l" },
  { header: "RUTA", width: 10, align: "c" },
  { header: "KM REC", width: 9, align: "c" },
  { header: "TN COM 29", width: 11, align: "c" },
  { header: "TN ESC 35", width: 11, align: "c" },
  { header: "TN ESC 37,5", width: 11, align: "c" },
  { header: "REMITO Nº", width: 13, align: "c" },
  { header: "MATERIAL", width: 18, align: "l" },
  { header: "KM VACIOS", width: 11, align: "c" },
  { header: "$", width: 16, align: "r" },
];

// Ancho de la tabla: lo usan el banner de la ficha, la fila de patentes, la zebra
// y la fila de totales. Sale del array para que no se desfasen entre sí.
const COLS = COLUMNAS.length;

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

/** Alineación de una columna por su posición (1-based). */
function alinearCol(col: number): Partial<ExcelJS.Alignment> {
  return alinear(COLUMNAS[col - 1].align);
}

function fmtFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Fila combinada A:L (banner) con texto a la izquierda — para la ficha del chofer. */
function bannerRow(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string,
  opts: { fillArgb: string; fontColor: string; bold: boolean; size: number; height: number },
) {
  ws.mergeCells(row, 1, row, COLS);
  for (let c = 1; c <= COLS; c++) {
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

/** Columna de toneladas según la capacidad del camión. */
function bucketCol(capacidad: number | null): number {
  if (capacidad == null) return COL.TN_375;
  if (capacidad <= 31) return COL.TN_29;
  if (capacidad <= 36) return COL.TN_35;
  return COL.TN_375;
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
    ws.columns = COLUMNAS.map(({ width }) => ({ width }));

    // Filas 1-3: ficha del chofer (legajo) — nombre + datos de contacto. El
    // período va a la derecha de la misma fila: la hoja se imprime y hay que
    // poder saber de qué fechas es sin mirar el nombre del archivo.
    const nombreCompleto = [ch.apellido, ch.nombre].filter(Boolean).join(", ").toUpperCase() || "CHOFER";
    bannerRow(ws, 1, nombreCompleto, { fillArgb: GRIS_HEADER, fontColor: "FFFFFFFF", bold: true, size: 13, height: 22 });
    if (periodo) {
      // Se rompe el merge A:L de la fila para reservar H:L al período.
      ws.unMergeCells(1, 1, 1, COLS);
      ws.mergeCells(1, 1, 1, 7);
      ws.mergeCells(1, 8, 1, COLS);
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
    for (let c = 1; c <= COLS; c++) {
      const cell = r1.getCell(c);
      cell.fill = fill(GRIS_PATENTE);
      cell.border = borde();
    }
    // La posición de las patentes es estética (no van bajo ningún encabezado):
    // se mantienen en las mismas tres columnas de siempre, ahora corridas por la
    // aparición de RUTA para que sigan quedando centradas sobre la tabla.
    const COLS_PATENTE = [COL.KM_REC, COL.TN_29, COL.TN_35];
    const [colTractor, colY, colAcoplado] = COLS_PATENTE;
    r1.getCell(colTractor).value = ch.tractor || "";
    r1.getCell(colY).value = ch.tractor && ch.acoplado ? "Y" : "";
    r1.getCell(colAcoplado).value = ch.acoplado || "";
    for (const c of COLS_PATENTE) {
      r1.getCell(c).font = { bold: true, color: { argb: "FF404040" } };
      r1.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    }

    // Fila 5: encabezado.
    const hr = ws.getRow(5);
    hr.height = 24;
    COLUMNAS.forEach(({ header }, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = header;
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

      const dia = row.getCell(COL.DIA);
      dia.value = v.fecha ? new Date(`${v.fecha}T12:00:00`) : null;
      dia.numFmt = "dd-mmm-yy";

      row.getCell(COL.ORIGEN).value = v.origen || "";
      row.getCell(COL.DESTINO).value = v.destino || "";

      // Sin vía la celda va VACÍA y no "—": el guion ensucia los filtros de Excel.
      row.getCell(COL.RUTA).value = etiquetaRutaViaExcel(v.ruta_via);

      // Convención de la planilla del cliente: TODO tramo (cargado o vacío) lleva
      // sus km en KM REC; el vacío se distingue solo por "VACIO" en remito. La
      // columna KM VACIOS queda para km vacíos embebidos en un viaje cargado —
      // nunca se repite ahí el km del tramo vacío (salía duplicado, reunión 02/07).
      const kmRec = v.es_vacio ? v.km_vacios : v.km_con_carga;
      row.getCell(COL.KM_REC).value = kmRec || null;

      if (v.tonelaje != null && v.tonelaje > 0) {
        row.getCell(bucketCol(v.capacidad)).value = v.tonelaje;
      }

      // REMITO Nº: "VACIO" en rojo cuando el viaje es vacío.
      const remito = row.getCell(COL.REMITO);
      if (v.es_vacio) {
        remito.value = "VACIO";
        remito.font = { bold: true, color: { argb: ROJO_VACIO } };
      } else {
        remito.value = v.remito || "";
      }

      row.getCell(COL.MATERIAL).value = v.es_vacio ? "" : v.material || "";
      row.getCell(COL.KM_VACIOS).value = v.es_vacio ? null : v.km_vacios || null;

      const imp = row.getCell(COL.IMPORTE);
      imp.value = v.es_vacio ? 0 : v.importe ?? null;
      imp.numFmt = '"$" #,##0.00';

      // Estilo de toda la fila (zebra + bordes + alineación).
      for (let c = 1; c <= COLS; c++) {
        const cell = row.getCell(c);
        cell.border = borde();
        cell.alignment = alinearCol(c);
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
    tot.getCell(COL.DESTINO).value = "TOTALES";
    tot.getCell(COL.KM_REC).value = sumKm || null;
    // El total de toneladas va en la última columna de TN, sin importar en qué
    // bucket cayó cada viaje (así venía la planilla).
    tot.getCell(COL.TN_375).value = sumTn ? Number(sumTn.toFixed(2)) : null;
    tot.getCell(COL.KM_VACIOS).value = sumVac || null;
    const totImp = tot.getCell(COL.IMPORTE);
    totImp.value = sumImp || null;
    totImp.numFmt = '"$" #,##0.00';
    for (let c = 1; c <= COLS; c++) {
      const cell = tot.getCell(c);
      cell.font = { bold: true, color: { argb: "FF404040" } };
      cell.fill = fill(GRIS_TOTAL);
      cell.border = borde();
      cell.alignment = alinearCol(c);
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
