// Parser del Excel de sueldos de Bárbara ("sueldos interanual.xlsx" y las
// planillas mensuales que siga mandando Nico con el mismo formato).
//
// Estructura: una sola hoja con BLOQUES repetidos, uno por mes:
//
//   [ , fecha, "FACTURACION", "SUELDO", "PORCENTAJE"]   ← header del bloque
//   [ , , 1153842365.27, 44702603.15, 3.87]             ← totales del mes
//   ...filas vacías...
//   [ , "SUELDO", "COMISION FLETEROS", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "TOTAL"]
//   ["PABLO", 2306585.16, 78015, 50000, 369629.82, 68712, 2872941.98]
//   ["DARIO", 1857000, , , , 526792, 2383792]
//   ...
//   [ , , , , , , 44702603.15]                          ← fila de total (sin nombre)
//
// Detalles reales del archivo:
//   - La fecha del bloque puede no ser el día 1 (ej. 2025-06-03) → se normaliza
//     al primer día del mes.
//   - La columna de comisión se llama "COMISION FLETEROS" en los meses viejos y
//     "COMISION LOGISTICA" en los nuevos: es el mismo dato.
//   - Entre bloques puede haber tablas sueltas (ej. "PROMEDIO ANUAL DEL % DE
//     SUELDO SOBRE FACTURACION"): se ignoran porque no tienen el header de
//     bloque ni nombres en la primera columna.
//   - Los nombres son apodos en mayúsculas ("NOE", "ALE", "TREJO"): el matching
//     contra legajos se hace aparte (ver matchNombresContraRoster).

import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SueldoFila = {
  rowNum: number; // fila Excel (1-based) para mostrar en preview
  nombre: string; // como viene en el Excel (apodo en mayúsculas)
  sueldoBase: number | null; // columna SUELDO (null si viene vacía)
  comision: number; // COMISION FLETEROS / COMISION LOGISTICA
  combustible: number;
  plusYpf: number;
  sabados: number;
  aguinaldo: number; // columna AGUINALDO (0 si el archivo no la trae)
  totalExcel: number | null; // columna TOTAL, solo para validar
};

export type SueldoBloque = {
  mes: string; // primer día del mes, ISO YYYY-MM-01
  facturacion: number | null; // FACTURACION del bloque
  filas: SueldoFila[];
};

export type SueldosParseResult = {
  bloques: SueldoBloque[];
  warnings: string[];
  /** Nombres únicos del Excel, en orden de aparición. */
  nombres: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normHeader(v: unknown): string {
  return String(v ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Fecha del header del bloque (serial de Excel, Date o string) → "YYYY-MM-01". */
function mesDelBloque(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-01`;
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    // ISO: "2025-06-03", "2025-06", "2025-6".
    const iso = s.match(/^(\d{4})-(\d{1,2})(\D|$)/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-01`;
    // Formato local: "03/06/2025" o "3/6/2025" (dd/mm/yyyy).
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-01`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parseo
// ---------------------------------------------------------------------------

export function parseSueldosExcel(data: ArrayBuffer | Uint8Array): SueldosParseResult {
  const wb = XLSX.read(data, { type: data instanceof Uint8Array ? "buffer" : "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { bloques: [], warnings: ["El Excel no tiene hojas."], nombres: [] };

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const bloques: SueldoBloque[] = [];
  const warnings: string[] = [];
  const nombresSet = new Set<string>();

  let i = 0;
  while (i < rows.length) {
    const row = rows[i] ?? [];
    // Header de bloque: alguna celda dice FACTURACION y a su izquierda hay una fecha.
    const factIdx = row.findIndex((c) => normHeader(c) === "FACTURACION");
    const mes = factIdx > 0 ? mesDelBloque(row[factIdx - 1]) : null;
    if (!mes) {
      if (factIdx > 0) {
        // Parece el encabezado de un bloque pero la fecha no se entiende: avisar
        // en vez de descartar el mes en silencio.
        warnings.push(
          `Fila ${i + 1}: encabezado de mes con fecha ilegible ("${String(row[factIdx - 1] ?? "")}"); se saltea ese bloque.`,
        );
      }
      i++;
      continue;
    }

    // Totales del bloque: la fila siguiente no vacía trae la facturación bajo FACTURACION.
    let facturacion: number | null = null;
    let j = i + 1;
    while (j < rows.length && (rows[j] ?? []).every((c) => c == null)) j++;
    if (j < rows.length) facturacion = asNum((rows[j] ?? [])[factIdx]);

    // Header de la tabla de empleados: fila cuyo segundo valor no nulo es "SUELDO".
    let headerRow = -1;
    for (let k = j; k < Math.min(j + 8, rows.length); k++) {
      const r = rows[k] ?? [];
      if (r[0] == null && normHeader(r[1]) === "SUELDO") {
        headerRow = k;
        break;
      }
    }
    if (headerRow === -1) {
      warnings.push(`Bloque de ${mes}: no se encontró la tabla de empleados; se saltea.`);
      i = j + 1;
      continue;
    }

    // Índices de columnas por nombre de header (la comisión cambia de nombre).
    const headers = (rows[headerRow] ?? []).map(normHeader);
    const idxDe = (pred: (h: string) => boolean) => headers.findIndex(pred);
    const cols = {
      sueldo: idxDe((h) => h === "SUELDO"),
      comision: idxDe((h) => h.startsWith("COMISION")),
      combustible: idxDe((h) => h === "COMBUSTIBLE"),
      plusYpf: idxDe((h) => h === "PLUS YPF" || h === "PLUS"),
      sabados: idxDe((h) => h === "SABADOS"),
      aguinaldo: idxDe((h) => h === "AGUINALDO" || h === "SAC"),
      total: idxDe((h) => h === "TOTAL"),
    };

    // Filas de empleados: nombre en la primera columna hasta la fila de total.
    const filas: SueldoFila[] = [];
    const nombresDelBloque = new Set<string>();
    let k = headerRow + 1;
    for (; k < rows.length; k++) {
      const r = rows[k] ?? [];
      const nombre = typeof r[0] === "string" ? r[0].trim() : "";
      if (!nombre) break; // fila de total del bloque (o vacía) → fin de la tabla
      if (nombresDelBloque.has(nombre)) {
        warnings.push(`${mes}: "${nombre}" aparece más de una vez; se usa la última fila.`);
      }
      nombresDelBloque.add(nombre);
      const at = (idx: number) => (idx >= 0 ? asNum(r[idx]) : null);
      const fila: SueldoFila = {
        rowNum: k + 1,
        nombre,
        sueldoBase: at(cols.sueldo),
        comision: at(cols.comision) ?? 0,
        combustible: at(cols.combustible) ?? 0,
        plusYpf: at(cols.plusYpf) ?? 0,
        sabados: at(cols.sabados) ?? 0,
        aguinaldo: at(cols.aguinaldo) ?? 0,
        totalExcel: at(cols.total),
      };
      const suma =
        (fila.sueldoBase ?? 0) +
        fila.comision +
        fila.combustible +
        fila.plusYpf +
        fila.sabados +
        fila.aguinaldo;
      if (fila.totalExcel != null && Math.abs(suma - fila.totalExcel) > 1) {
        warnings.push(
          `${mes} · ${nombre} (fila ${fila.rowNum}): la suma (${Math.round(suma)}) no coincide con el TOTAL del Excel (${Math.round(fila.totalExcel)}).`,
        );
      }
      filas.push(fila);
      nombresSet.add(nombre);
    }

    if (filas.length) {
      if (bloques.some((b) => b.mes === mes)) {
        warnings.push(`El mes ${mes} aparece más de una vez; se usa el último bloque.`);
        bloques.splice(
          bloques.findIndex((b) => b.mes === mes),
          1,
        );
      }
      bloques.push({ mes, facturacion, filas });
    } else {
      warnings.push(`Bloque de ${mes}: sin filas de empleados.`);
    }
    i = k + 1;
  }

  bloques.sort((a, b) => a.mes.localeCompare(b.mes));
  return { bloques, warnings, nombres: Array.from(nombresSet) };
}

// ---------------------------------------------------------------------------
// Matching de nombres del Excel contra el roster de legajos
// ---------------------------------------------------------------------------

export type RosterEntry = {
  id: string;
  nombre: string; // nombre del legajo
  apellido: string | null;
  rol: string; // 'administrativo' | 'mantenimiento' | 'chofer'
};

export type NombreMatch = {
  nombreExcel: string;
  choferId: string | null; // null → sin match automático (se asigna a mano u omite)
  /** true si se asignó solo (único candidato claro dentro de admin/taller). */
  auto: boolean;
  /** Candidato sugerido cuando no se auto-asigna (ej. matchea un chofer). */
  sugeridoId: string | null;
};

function normToken(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length][b.length];
}

/** Puntaje de similitud entre el apodo del Excel y un token del legajo. */
function scoreToken(apodo: string, token: string): number {
  if (!apodo || !token) return 0;
  if (apodo === token) return 3;
  // Apodo como prefijo (NOE → NOELIA, JERE → JEREMIAS) o prefijo común largo
  // con apodo corto (JONY → JONATAN comparten "JON").
  if (apodo.length >= 3 && token.startsWith(apodo)) return 2;
  if (apodo.length <= 5 && apodo.length >= 3 && token.length >= 4) {
    let common = 0;
    while (common < Math.min(apodo.length, token.length) && apodo[common] === token[common]) common++;
    if (common >= 3) return 2;
  }
  // Typos / variantes (ANABELLA vs ANABELA).
  if (apodo.length >= 4 && token.length >= 4 && levenshtein(apodo, token) <= 2) return 1;
  return 0;
}

/**
 * Matchea cada nombre del Excel contra el roster. Solo auto-asigna cuando hay
 * UN único mejor candidato dentro de admin/taller; si el mejor candidato es un
 * chofer (ej. "JOSE" → chofer José Luis Fernandez) queda como sugerencia y
 * requiere confirmación manual, para no cargarle el sueldo a la persona
 * equivocada.
 */
export function matchNombresContraRoster(nombres: string[], roster: RosterEntry[]): NombreMatch[] {
  const scored = roster.map((r) => ({
    ...r,
    tokens: `${r.nombre} ${r.apellido ?? ""}`
      .split(/\s+/)
      .map(normToken)
      .filter((t) => t.length >= 2),
  }));

  return nombres.map((nombreExcel) => {
    const apodo = normToken(nombreExcel);
    let best: { id: string; rol: string; score: number; tokenIdx: number }[] = [];
    let bestScore = 0;
    for (const r of scored) {
      let score = 0;
      let tokenIdx = -1;
      r.tokens.forEach((t, idx) => {
        const s = scoreToken(apodo, t);
        if (s > score) {
          score = s;
          tokenIdx = idx;
        }
      });
      if (score === 0) continue;
      if (score > bestScore) {
        bestScore = score;
        best = [{ id: r.id, rol: r.rol, score, tokenIdx }];
      } else if (score === bestScore) {
        best.push({ id: r.id, rol: r.rol, score, tokenIdx });
      }
    }
    // Desempate: el apodo suele salir del PRIMER nombre (ALE → ALEjandro, no
    // Alan ALExis). Si exactamente uno de los empatados matcheó el token 0, gana.
    if (best.length > 1) {
      const primerToken = best.filter((b) => b.tokenIdx === 0);
      if (primerToken.length === 1) best = primerToken;
    }
    // Entre empatados, preferir admin/taller sobre choferes.
    const adminTaller = best.filter((b) => b.rol !== "chofer");
    if (adminTaller.length === 1) {
      return { nombreExcel, choferId: adminTaller[0].id, auto: true, sugeridoId: null };
    }
    if (adminTaller.length === 0 && best.length === 1) {
      // Único candidato pero es chofer → sugerir, no auto-asignar.
      return { nombreExcel, choferId: null, auto: false, sugeridoId: best[0].id };
    }
    return { nombreExcel, choferId: null, auto: false, sugeridoId: null };
  });
}
