// Parser del Excel de entrevistas de Bárbara. Formato flexible: busca la fila
// de encabezados (la que tiene "NOMBRE") y mapea las columnas por nombre,
// tolerando variantes ("DE DONDE ES" / "LOCALIDAD", "OBSERVACION(ES)", etc.).
// Las filas siguientes son candidatos hasta que se corta la data.

import * as XLSX from "xlsx";

export type EntrevistaImportFila = {
  rowNum: number; // fila Excel (1-based), para el preview
  nombre: string;
  fecha: string | null; // ISO YYYY-MM-DD
  edad: number | null;
  localidad: string | null;
  telefono: string | null;
  observaciones: string | null;
  preocupacional_nota: string | null;
  aprobado: string | null;
  entro: string | null;
  se_mantuvo: string | null;
};

export type EntrevistasParseResult =
  | { ok: true; filas: EntrevistaImportFila[]; hoja: string; avisos: string[] }
  | { ok: false; error: string };

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-ZÑ0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Variantes conocidas de cada columna (se matchea por inclusión).
const COLUMNAS: { campo: keyof Omit<EntrevistaImportFila, "rowNum">; variantes: string[] }[] = [
  { campo: "nombre", variantes: ["NOMBRE"] },
  { campo: "fecha", variantes: ["FECHA"] },
  { campo: "edad", variantes: ["EDAD"] },
  { campo: "localidad", variantes: ["DE DONDE", "LOCALIDAD", "CIUDAD", "DONDE ES"] },
  { campo: "telefono", variantes: ["TELEFONO", "TEL", "CELULAR"] },
  { campo: "observaciones", variantes: ["OBSERVACION", "NOTAS", "COMENTARIO"] },
  { campo: "preocupacional_nota", variantes: ["PREOCUPACIONAL", "PREOCUP"] },
  { campo: "aprobado", variantes: ["APROBADO"] },
  { campo: "entro", variantes: ["ENTRO", "INGRESO"] },
  { campo: "se_mantuvo", variantes: ["SE MANTUVO", "MANTUVO", "SIGUE"] },
];

function celdaTexto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function celdaFecha(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Serial de Excel (base 1900).
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return null;
  }
  const s = String(v).trim();
  // dd/mm/yyyy o dd-mm-yyyy (año de 2 o 4 dígitos)
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function parseEntrevistasExcel(buffer: ArrayBuffer | Buffer): EntrevistasParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return { ok: false, error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx/.xls)?" };
  }

  const avisos: string[] = [];

  for (const nombreHoja of wb.SheetNames) {
    const hoja = wb.Sheets[nombreHoja];
    const grid: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });

    // Buscar la fila de encabezados: la primera que tenga una celda "NOMBRE".
    let headerRow = -1;
    for (let i = 0; i < Math.min(grid.length, 30); i++) {
      if ((grid[i] ?? []).some((c) => norm(c) === "NOMBRE" || norm(c).startsWith("NOMBRE "))) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) continue; // probar la próxima hoja

    // Mapear columnas por variantes.
    const idxPorCampo = new Map<string, number>();
    (grid[headerRow] ?? []).forEach((celda, idx) => {
      const h = norm(celda);
      if (!h) return;
      for (const col of COLUMNAS) {
        if (idxPorCampo.has(col.campo)) continue;
        if (col.variantes.some((v) => h === v || h.includes(v))) {
          idxPorCampo.set(col.campo, idx);
          break;
        }
      }
    });
    if (!idxPorCampo.has("nombre")) continue;

    const faltantes = COLUMNAS.filter((c) => !idxPorCampo.has(c.campo)).map((c) => c.campo);
    if (faltantes.length) {
      avisos.push(`Columnas no encontradas (quedan vacías): ${faltantes.join(", ")}.`);
    }

    const filas: EntrevistaImportFila[] = [];
    let vaciasSeguidas = 0;
    for (let i = headerRow + 1; i < grid.length; i++) {
      const fila = grid[i] ?? [];
      const nombre = celdaTexto(fila[idxPorCampo.get("nombre")!]);
      if (!nombre) {
        vaciasSeguidas += 1;
        if (vaciasSeguidas >= 10) break; // fin de la data
        continue;
      }
      vaciasSeguidas = 0;
      // Saltear filas de sección/encabezado repetido.
      if (norm(nombre) === "NOMBRE" || norm(nombre).startsWith("NO INGRES")) continue;

      const get = (campo: string) => {
        const idx = idxPorCampo.get(campo);
        return idx == null ? null : fila[idx];
      };
      const edadRaw = get("edad");
      const edadNum = edadRaw == null || edadRaw === "" ? null : Number(String(edadRaw).replace(/[^\d]/g, ""));

      filas.push({
        rowNum: i + 1,
        nombre,
        fecha: celdaFecha(get("fecha")),
        edad: edadNum != null && Number.isInteger(edadNum) && edadNum >= 14 && edadNum <= 99 ? edadNum : null,
        localidad: celdaTexto(get("localidad")),
        telefono: celdaTexto(get("telefono")),
        observaciones: celdaTexto(get("observaciones")),
        preocupacional_nota: celdaTexto(get("preocupacional_nota")),
        aprobado: celdaTexto(get("aprobado")),
        entro: celdaTexto(get("entro")),
        se_mantuvo: celdaTexto(get("se_mantuvo")),
      });
    }

    if (filas.length) return { ok: true, filas, hoja: nombreHoja, avisos };
  }

  return {
    ok: false,
    error: "No se encontró ninguna hoja con una columna NOMBRE y candidatos debajo. Fijate que la planilla tenga los encabezados en una fila (NOMBRE, FECHA, EDAD, DE DÓNDE ES, OBSERVACIONES…).",
  };
}

/** Normalización para dedup por nombre (mayúsculas, sin tildes ni dobles espacios). */
export const nombreClave = (s: string) => norm(s);
