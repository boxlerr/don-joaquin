// Parser del Excel "Liquidación de Fletes" de Loma Negra.
//
// Estructura: una sola hoja ("Data") con una tabla plana. La fila 1 es el
// encabezado. Cada fila siguiente es UN flete ya liquidado por Loma, con todos
// los datos oficiales (Nº transporte, remito, tn neto, importe, chofer, chasis,
// origen/destino y distancia).
//
// Diferencias con la HOJA DE RUTA interna (que se importa aparte):
//   - Es la fuente OFICIAL del cliente: trae la facturación real (Importe) y los
//     km oficiales (Distancia total), cosas que la hoja interna no tenía.
//   - NO trae km vacíos ni desvíos (Loma solo paga el tramo con carga).
//   - El "neto" viene en T o en KG según la columna UM; hay que normalizar a tn.

import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type LomaRow = {
  rowNum: number; // fila Excel (1-based) para mostrar en preview
  nroTransporte: string; // identidad del flete (único, siempre presente)
  remito: string | null; // "Referencia" (puede faltar)
  fecha: string | null; // ISO YYYY-MM-DD desde "In.act.transp."
  tonelaje: number | null; // "Peso neto" normalizado a toneladas
  importe: number | null; // "Importe" (facturación oficial al cliente)
  moneda: string;
  choferNombre: string; // "APELLIDO, NOMBRE" (orden no garantizado)
  chasis: string | null; // "ID Vehículo" (patente del tractor)
  expedidor: string; // nombre del expedidor (define si el flete es de Loma)
  destinatario: string;
  origenDir: string | null;
  destinoDir: string | null;
  material: string | null; // "Descripción"
  kmTotal: number | null; // "Distancia total" (km oficiales con carga)
};

export type LomaParseResult = {
  rows: LomaRow[];
  warnings: string[];
  sheetName: string;
};

const PREFERRED_SHEET = "Data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Excel guarda fechas como serial (días desde 1900). 25569 = días a epoch Unix. */
function excelSerialToISO(n: number): string | null {
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function asISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const yyyy = v.getUTCFullYear();
    const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(v.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof v === "number") return excelSerialToISO(v);
  if (typeof v === "string") {
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

/** Número en formato AR ("3.595.944,80" o "35,3"). Los puntos son miles. */
function asNumAR(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export function parseLomaXlsx(buffer: Buffer | ArrayBuffer): LomaParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", raw: true });
  const sheetName = wb.SheetNames.includes(PREFERRED_SHEET)
    ? PREFERRED_SHEET
    : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const warnings: string[] = [];

  if (!ws) {
    return { rows: [], warnings: ["El archivo no tiene hojas legibles."], sheetName: "" };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const header = (rows[0] ?? []).map((h) => (h == null ? "" : String(h).trim()));
  const idx = (name: string) => header.indexOf(name);

  const iNT = idx("Nº transporte");
  const iRef = idx("Referencia");
  const iNeto = idx("Peso neto");
  const iUM = idx("UM peso neto");
  const iImp = idx("Importe");
  const iMon = idx("Moneda");
  const iChof = idx("Nombre Chofer");
  const iVeh = idx("ID Vehículo");
  const iIni = idx("In.act.transp.");
  const iDesc = idx("Descripción");
  const iDist = idx("Distancia total");
  const iExp = idx("Expedidor");
  const iDest = idx("Destinatario");
  const iDirO = idx("Dir.ubicación origen");
  const iDirD = idx("Direc.ubic.destino");

  // El nombre del expedidor/destinatario vive en la columna SIGUIENTE al código
  // (su header viene vacío en el export). El código queda en iExp/iDest.
  const iExpName = iExp >= 0 ? iExp + 1 : -1;
  const iDestName = iDest >= 0 ? iDest + 1 : -1;

  if (iNT < 0) {
    warnings.push(
      "No se encontró la columna «Nº transporte». ¿Es la liquidación de fletes de Loma?",
    );
    return { rows: [], warnings, sheetName };
  }

  const out: LomaRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const nt = asStr(row[iNT]);
    if (!nt) continue; // fila vacía / no-dato

    const um = asStr(iUM >= 0 ? row[iUM] : null) ?? "";
    let ton = asNumAR(iNeto >= 0 ? row[iNeto] : null);
    if (ton != null && /kg/i.test(um)) ton = ton / 1000; // KG → toneladas

    out.push({
      rowNum: r + 1,
      nroTransporte: nt,
      remito: asStr(iRef >= 0 ? row[iRef] : null),
      fecha: asISO(iIni >= 0 ? row[iIni] : null),
      tonelaje: ton != null ? round2(ton) : null,
      importe: asNumAR(iImp >= 0 ? row[iImp] : null),
      moneda: asStr(iMon >= 0 ? row[iMon] : null) ?? "ARS",
      choferNombre: asStr(iChof >= 0 ? row[iChof] : null) ?? "",
      chasis: asStr(iVeh >= 0 ? row[iVeh] : null),
      expedidor:
        asStr(iExpName >= 0 ? row[iExpName] : null) ??
        asStr(iExp >= 0 ? row[iExp] : null) ??
        "",
      destinatario:
        asStr(iDestName >= 0 ? row[iDestName] : null) ??
        asStr(iDest >= 0 ? row[iDest] : null) ??
        "",
      origenDir: asStr(iDirO >= 0 ? row[iDirO] : null),
      destinoDir: asStr(iDirD >= 0 ? row[iDirD] : null),
      material: asStr(iDesc >= 0 ? row[iDesc] : null),
      kmTotal: asNumAR(iDist >= 0 ? row[iDist] : null),
    });
  }

  if (out.length === 0) {
    warnings.push("No se encontraron filas de fletes en la hoja.");
  }

  return { rows: out, warnings, sheetName };
}
