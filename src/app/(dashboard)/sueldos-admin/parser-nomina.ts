// Parser del Excel "IMPORTES SUELDOS <MES> <AÑO>" que manda Bárbara.
//
// Es un archivo distinto del de la planilla admin/taller (ver parser-sueldos.ts):
// éste no trae desglose de conceptos, trae lo que se le TRANSFIRIÓ a cada persona
// y por qué banco salió cada parte.
//
// Estructura real del archivo de julio 2026:
//
//   Hoja1 — la nómina completa y, a la derecha, los embargos:
//     [Año, 2026]
//     [Empleado, Importe]
//     ["ACOSTA, Pablo Maximo - 148", 4423168.14]
//     ...                                          [ , , , "JOAQUIN, Alan Alexis - 31", 215952.08]
//     ["Total por Columnas", 287618616.66, , , 7771413.08, , 295390029.74]
//
//   Hoja2 — la misma gente agrupada por banco, en dos pares de columnas:
//     [BANCO CREDICOOP, ]                      [BANCO FRANCES, ]
//     ["ROSSI, Adrian Emilio - 29", 2226886.26] ...
//     [ , 40777766.79]           ← total del bloque, sin nombre
//     ...
//     [EMBARGOS, ]               ← un bloque más, que no es un banco
//     [TOTAL SUELDOS, 280118616.66]
//     [SUELDOS + EMBARGOS, 287897380.02]
//
// Decisiones de parseo, todas por lo mismo: que el archivo del mes que viene no
// tenga que salir exactamente igual.
//   - Nada se lee por número de fila o de columna. Los bloques se buscan por su
//     título en TODA la hoja, así que si el año que viene aparece un banco más, o
//     las columnas se corren, sigue funcionando.
//   - El número después del guion ("- 148") es el número de legajo del sistema
//     contable. Es el desambiguador bueno cuando dos personas se apellidan igual,
//     pero NO existe en esta base, así que se conserva como dato y el cruce se
//     hace por apellido y nombre.
//   - El mes NO está adentro del archivo (sólo el año, en una celda suelta). Se
//     saca del nombre del archivo y SIEMPRE se confirma a mano en la pantalla:
//     cargar julio como si fuera agosto es un error que después no se ve.

import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Una persona tal como la nombra el Excel: "APELLIDO, Nombre Segundo - 148". */
export type PersonaExcel = {
  /** El texto completo, tal cual. Es la identidad de la persona dentro del archivo. */
  etiqueta: string;
  /** Sólo el nombre, sin el número de legajo. */
  persona: string;
  /** El número después del guion, si lo trae. */
  legajo: number | null;
};

export type NominaFila = PersonaExcel & {
  rowNum: number;
  /** null cuando la celda del importe viene vacía (pasa: hay una fila así). */
  importe: number | null;
};

export type NominaBloque = {
  /** "BANCO CREDICOOP" → "Credicoop"; el bloque de embargos queda como "EMBARGOS". */
  titulo: string;
  banco: string | null; // null en el bloque de embargos
  esEmbargo: boolean;
  filas: (PersonaExcel & { rowNum: number; importe: number })[];
  /** El total que declara el Excel al pie del bloque. */
  totalExcel: number | null;
};

export type NominaParseResult = {
  /** Mes deducido del nombre del archivo, "YYYY-MM-01". Null si no se pudo. */
  mesSugerido: string | null;
  anio: number | null;
  nomina: NominaFila[];
  bloques: NominaBloque[];
  totales: {
    /** Suma de la columna Importe de la nómina (lo que declara el Excel). */
    nominaExcel: number | null;
    /** "TOTAL SUELDOS" de la hoja de bancos. */
    sueldosExcel: number | null;
    /** "SUELDOS + EMBARGOS". */
    sueldosMasEmbargosExcel: number | null;
  };
  /** Todas las personas mencionadas, sin repetir, en orden de aparición. */
  personas: PersonaExcel[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(v: unknown): string {
  return String(v ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  // "1.234.567,89" (formato local) y "1234567.89" conviven en estos archivos.
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}

function asTexto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/** "RUCKERT, Carlos David  - 153" → { persona: "RUCKERT, Carlos David", legajo: 153 }. */
export function parsePersona(etiqueta: string): PersonaExcel {
  const limpio = etiqueta.replace(/\s+/g, " ").trim();
  const m = limpio.match(/^(.*?)\s*-\s*(\d{1,5})$/);
  if (!m) return { etiqueta: limpio, persona: limpio, legajo: null };
  return { etiqueta: limpio, persona: m[1].trim(), legajo: Number(m[2]) };
}

const MESES_NOMBRE = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

/**
 * Mes a partir del nombre del archivo: "IMPORTES SUELDOS JULIO 2026.xlsx".
 * También entiende "2026-07" y "07-2026". Devuelve "YYYY-MM-01".
 *
 * Si el archivo llega renombrado (WhatsApp a veces lo manda como "Sin título"),
 * devuelve null y la pantalla obliga a elegir el mes.
 */
export function mesDesdeNombreArchivo(nombre: string, anioFallback?: number | null): string | null {
  const n = norm(nombre);
  const iso = n.match(/(20\d{2})[-_ ](0[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${iso[2]}-01`;
  const inv = n.match(/\b(0[1-9]|1[0-2])[-_](20\d{2})\b/);
  if (inv) return `${inv[2]}-${inv[1]}-01`;
  const idx = MESES_NOMBRE.findIndex((m) => n.includes(m));
  if (idx === -1) return null;
  const anio = n.match(/\b(20\d{2})\b/)?.[1] ?? (anioFallback ? String(anioFallback) : null);
  if (!anio) return null;
  return `${anio}-${String(idx + 1).padStart(2, "0")}-01`;
}

type Grilla = unknown[][];

function leerHojas(wb: XLSX.WorkBook): { nombre: string; filas: Grilla }[] {
  return wb.SheetNames.map((nombre) => {
    const ws = wb.Sheets[nombre];
    return {
      nombre,
      filas: ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Grilla) : [],
    };
  });
}

function anchoMaximo(filas: Grilla): number {
  return filas.reduce((max, f) => Math.max(max, f?.length ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Hoja de la nómina: "Empleado | Importe"
// ---------------------------------------------------------------------------

type Nomina = { filas: NominaFila[]; totalExcel: number | null; anio: number | null };

function leerNomina(filas: Grilla): Nomina | null {
  const ancho = anchoMaximo(filas);
  // El encabezado puede estar en cualquier fila y columna: se busca "Empleado"
  // con "Importe" a la derecha.
  let hdrFila = -1;
  let colNombre = -1;
  let colImporte = -1;
  for (let i = 0; i < filas.length && hdrFila === -1; i++) {
    const f = filas[i] ?? [];
    for (let c = 0; c < ancho; c++) {
      if (norm(f[c]) !== "EMPLEADO") continue;
      for (let d = c + 1; d < Math.min(c + 4, ancho); d++) {
        if (norm(f[d]) === "IMPORTE") {
          hdrFila = i;
          colNombre = c;
          colImporte = d;
          break;
        }
      }
      if (hdrFila !== -1) break;
    }
  }
  if (hdrFila === -1) return null;

  // El año está en una celda suelta arriba del encabezado ("Año | 2026").
  let anio: number | null = null;
  for (let i = 0; i < hdrFila; i++) {
    const f = filas[i] ?? [];
    for (let c = 0; c < ancho - 1; c++) {
      if (norm(f[c]) === "ANO" || norm(f[c]) === "AÑO") {
        const v = asNum(f[c + 1]);
        if (v && v > 2000 && v < 2100) anio = v;
      }
    }
  }

  const out: NominaFila[] = [];
  let totalExcel: number | null = null;
  for (let i = hdrFila + 1; i < filas.length; i++) {
    const f = filas[i] ?? [];
    const texto = asTexto(f[colNombre]);
    if (!texto) continue;
    if (norm(texto).startsWith("TOTAL")) {
      totalExcel = asNum(f[colImporte]);
      break;
    }
    out.push({ ...parsePersona(texto), rowNum: i + 1, importe: asNum(f[colImporte]) });
  }
  return { filas: out, totalExcel, anio };
}

// ---------------------------------------------------------------------------
// Hoja de bancos: bloques con título
// ---------------------------------------------------------------------------

const TOTALES_CONOCIDOS = ["TOTAL SUELDOS", "SUELDOS + EMBARGOS", "TOTAL", "TOTAL GENERAL"];

/** "BANCO CREDICOOP" → "Credicoop". El catálogo de la app canoniza después. */
function bancoDesdeTitulo(titulo: string): string {
  return titulo.replace(/^\s*BANCOS?\s+/i, "").replace(/\s+/g, " ").trim();
}

function esTituloDeBloque(texto: string): boolean {
  const n = norm(texto);
  if (TOTALES_CONOCIDOS.includes(n)) return false;
  return /^BANCOS?\b/.test(n) || n === "EMBARGOS" || n === "EMBARGO";
}

function leerBloques(filas: Grilla): { bloques: NominaBloque[]; totales: Record<string, number> } {
  const ancho = anchoMaximo(filas);
  const bloques: NominaBloque[] = [];
  const totales: Record<string, number> = {};

  // Los bloques viven en pares de columnas (nombre, importe). Se recorre columna
  // por columna en vez de asumir cuáles son: el archivo de julio usa A/B y D/E,
  // pero eso es sólo cómo quedó acomodado.
  for (let c = 0; c < ancho; c++) {
    let abierto: NominaBloque | null = null;
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i] ?? [];
      const texto = asTexto(f[c]);
      const valor = asNum(f[c + 1]);

      if (texto && valor == null && esTituloDeBloque(texto)) {
        const esEmbargo = norm(texto).startsWith("EMBARGO");
        abierto = {
          titulo: texto,
          banco: esEmbargo ? null : bancoDesdeTitulo(texto),
          esEmbargo,
          filas: [],
          totalExcel: null,
        };
        bloques.push(abierto);
        continue;
      }

      if (texto && valor != null && TOTALES_CONOCIDOS.includes(norm(texto))) {
        totales[norm(texto)] = valor;
        abierto = null;
        continue;
      }

      if (!abierto) continue;

      // Fila sin nombre y con número: es el total al pie y cierra el bloque.
      if (!texto && valor != null) {
        abierto.totalExcel = valor;
        abierto = null;
        continue;
      }
      if (texto && valor != null) {
        abierto.filas.push({ ...parsePersona(texto), rowNum: i + 1, importe: valor });
        continue;
      }
      // Celda vacía en las dos columnas: el bloque terminó sin fila de total.
      if (!texto && valor == null) abierto = null;
    }
  }
  return { bloques, totales };
}

// ---------------------------------------------------------------------------
// Parseo completo
// ---------------------------------------------------------------------------

export function parseNominaExcel(
  data: ArrayBuffer | Uint8Array,
  nombreArchivo = "",
): NominaParseResult {
  const wb = XLSX.read(data, { type: data instanceof Uint8Array ? "buffer" : "array" });
  const hojas = leerHojas(wb);
  const warnings: string[] = [];

  // La hoja de la nómina es la que tiene el encabezado "Empleado | Importe".
  let nomina: Nomina | null = null;
  let hojaNomina = "";
  for (const h of hojas) {
    const n = leerNomina(h.filas);
    if (n && n.filas.length) {
      nomina = n;
      hojaNomina = h.nombre;
      break;
    }
  }

  // Los bloques por banco pueden estar en cualquier otra hoja.
  let bloques: NominaBloque[] = [];
  let totalesBloques: Record<string, number> = {};
  for (const h of hojas) {
    if (h.nombre === hojaNomina) continue;
    const r = leerBloques(h.filas);
    if (r.bloques.length) {
      bloques = r.bloques;
      totalesBloques = r.totales;
      break;
    }
  }

  if (!nomina) {
    return {
      mesSugerido: null,
      anio: null,
      nomina: [],
      bloques,
      totales: { nominaExcel: null, sueldosExcel: null, sueldosMasEmbargosExcel: null },
      personas: [],
      warnings: [
        'No se encontró la hoja con la lista de la nómina. Se espera una hoja con las columnas "Empleado" e "Importe".',
      ],
    };
  }

  // ── Controles contra los totales del propio Excel ──────────────────────────
  const sumaNomina = nomina.filas.reduce((s, f) => s + (f.importe ?? 0), 0);
  if (nomina.totalExcel != null && Math.abs(sumaNomina - nomina.totalExcel) > 1) {
    warnings.push(
      `La suma de la nómina (${redondear(sumaNomina)}) no coincide con el total del Excel (${redondear(nomina.totalExcel)}).`,
    );
  }
  for (const b of bloques) {
    const suma = b.filas.reduce((s, f) => s + f.importe, 0);
    if (b.totalExcel != null && Math.abs(suma - b.totalExcel) > 1) {
      warnings.push(
        `${b.titulo}: la suma de las filas (${redondear(suma)}) no coincide con el total del bloque (${redondear(b.totalExcel)}).`,
      );
    }
  }

  const bancos = bloques.filter((b) => !b.esEmbargo);
  const embargos = bloques.filter((b) => b.esEmbargo);

  // ── Cada persona: lo que dice la nómina vs. lo que suman sus bancos ────────
  const porPersona = new Map<string, number>();
  for (const b of bancos) {
    for (const f of b.filas) porPersona.set(f.etiqueta, (porPersona.get(f.etiqueta) ?? 0) + f.importe);
  }
  for (const f of nomina.filas) {
    const enBancos = porPersona.get(f.etiqueta);
    if (f.importe == null) {
      warnings.push(`${f.etiqueta}: figura en la nómina sin importe (fila ${f.rowNum}).`);
      continue;
    }
    if (enBancos == null) {
      warnings.push(
        `${f.etiqueta}: cobra ${redondear(f.importe)} pero no aparece en ningún banco; se carga sin banco.`,
      );
      continue;
    }
    if (Math.abs(enBancos - f.importe) > 1) {
      warnings.push(
        `${f.etiqueta}: la nómina dice ${redondear(f.importe)} y los bancos suman ${redondear(enBancos)}.`,
      );
    }
  }
  const enNomina = new Set(nomina.filas.map((f) => f.etiqueta));
  for (const etiqueta of porPersona.keys()) {
    if (!enNomina.has(etiqueta)) {
      warnings.push(`${etiqueta}: aparece en un banco pero no está en la lista de la nómina.`);
    }
  }

  // ── Personas, sin repetir y en orden de aparición ──────────────────────────
  const personas: PersonaExcel[] = [];
  const vistas = new Set<string>();
  const agregar = (p: PersonaExcel) => {
    if (vistas.has(p.etiqueta)) return;
    vistas.add(p.etiqueta);
    personas.push({ etiqueta: p.etiqueta, persona: p.persona, legajo: p.legajo });
  };
  nomina.filas.forEach(agregar);
  for (const b of bloques) b.filas.forEach(agregar);

  const mesSugerido = mesDesdeNombreArchivo(nombreArchivo, nomina.anio);
  if (!mesSugerido) {
    warnings.push(
      "El nombre del archivo no dice de qué mes es la nómina; hay que elegirlo antes de cargar.",
    );
  }

  return {
    mesSugerido,
    anio: nomina.anio,
    nomina: nomina.filas,
    bloques,
    totales: {
      nominaExcel: nomina.totalExcel,
      sueldosExcel: totalesBloques["TOTAL SUELDOS"] ?? null,
      sueldosMasEmbargosExcel: totalesBloques["SUELDOS + EMBARGOS"] ?? null,
    },
    personas,
    warnings: warnings.concat(avisosDeEmbargos(embargos)),
  };
}

/**
 * El Excel repite la lista de embargos en las dos hojas y no siempre con el
 * mismo número (en julio, BAZAN figura con 717.326,85 en una y 724.677,13 en la
 * otra). Se carga la de la hoja de bancos, que es la que cuadra con el total
 * "SUELDOS + EMBARGOS", y la diferencia se avisa en vez de elegirla en silencio.
 */
function avisosDeEmbargos(embargos: NominaBloque[]): string[] {
  const avisos: string[] = [];
  const total = embargos.reduce((s, b) => s + b.filas.reduce((t, f) => t + f.importe, 0), 0);
  if (embargos.length > 1) {
    avisos.push(`Hay ${embargos.length} bloques de embargos; se cargan todos (${redondear(total)}).`);
  }
  return avisos;
}

function redondear(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

// ---------------------------------------------------------------------------
// Matching contra el roster de legajos
// ---------------------------------------------------------------------------

export type RosterNominaEntry = {
  id: string;
  nombre: string;
  apellido: string | null;
  rol: string;
  estado: string;
};

export type NominaMatch = {
  etiqueta: string;
  persona: string;
  legajo: number | null;
  /** Legajo asignado automáticamente, o null si hay que resolverlo a mano. */
  choferId: string | null;
  auto: boolean;
  /** Candidatos ordenados de mejor a peor, para el desplegable de la pantalla. */
  candidatos: { id: string; nombre: string; puntaje: number }[];
};

function tokens(s: string): string[] {
  return norm(s)
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
}

/**
 * Cruza "APELLIDO, Nombre Segundo - 148" contra el roster por apellido y nombre.
 *
 * A diferencia del otro Excel (el de apodos: "NOE", "ALE"), acá viene el nombre
 * completo, así que el criterio puede ser exigente: se pide que coincidan al
 * menos DOS palabras y que una de ellas sea del apellido. Con eso las 79
 * personas de julio cruzan solas salvo las que no tienen legajo en el sistema.
 *
 * Sólo se auto-asigna cuando hay un ganador claro; si dos legajos empatan queda
 * a mano, porque cargarle el sueldo a la persona equivocada no se nota después.
 */
export function matchNominaContraRoster(
  personas: PersonaExcel[],
  roster: RosterNominaEntry[],
): NominaMatch[] {
  const preparado = roster.map((r) => ({
    ...r,
    apellidoTokens: new Set(tokens(r.apellido ?? "")),
    todos: new Set(tokens(`${r.apellido ?? ""} ${r.nombre}`)),
  }));

  return personas.map((p) => {
    // La coma separa apellido de nombres: "RUCKERT, Carlos David". Cuando no hay
    // coma ("ASTEAZARAN Agustin"), la primera palabra es el apellido.
    const partes = p.persona.split(",");
    const apellidoExcel = tokens(partes[0] ?? "");
    const todosExcel = tokens(p.persona);

    const puntuados = preparado
      .map((r) => {
        let comunes = 0;
        for (const t of todosExcel) if (r.todos.has(t)) comunes++;
        const apellidoOk = apellidoExcel.some((t) => r.apellidoTokens.has(t));
        // Sin coincidencia de apellido no hay candidato: "Nicolas" solo matchea
        // con media empresa.
        if (!apellidoOk || comunes < 2) return null;
        // Se premia cubrir todo el apellido del Excel y todos los nombres.
        const cubreApellido = apellidoExcel.filter((t) => r.apellidoTokens.has(t)).length;
        return { id: r.id, nombre: `${r.apellido}, ${r.nombre}`, puntaje: comunes * 10 + cubreApellido };
      })
      .filter((x): x is { id: string; nombre: string; puntaje: number } => x !== null)
      .sort((a, b) => b.puntaje - a.puntaje);

    const ganaSolo =
      puntuados.length === 1 || (puntuados.length > 1 && puntuados[0].puntaje > puntuados[1].puntaje);

    return {
      etiqueta: p.etiqueta,
      persona: p.persona,
      legajo: p.legajo,
      choferId: ganaSolo ? puntuados[0].id : null,
      auto: ganaSolo,
      candidatos: puntuados.slice(0, 5),
    };
  });
}
