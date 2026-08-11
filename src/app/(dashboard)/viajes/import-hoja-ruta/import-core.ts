// Núcleo del importador de la HOJA DE RUTA (sin "use server").
// Toda la lógica de matching, dedup, preview y escritura vive acá para que
// puedan usarla tanto los server actions (con auth) como scripts de
// mantenimiento/validación (scripts/reimport-hoja-ruta.ts).

import {
  parseHojaRutaXlsx,
  tonelajeDe,
  normalizarRemito,
  REMITO_VACIO,
  type HrParseResult,
  type HrSheetParsed,
  type HrRutaVia,
} from "./parser-hoja-ruta";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";
import { hoyArgentina } from "@/lib/fecha-ar";

// Cliente Supabase admin: los server actions pasan createAdminClient() y los
// scripts un createClient() con service role. Solo usamos la API .from/.insert.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminDb = any;

// ============================================================================
// Tipos compartidos con la UI
// ============================================================================

export type ChoferMatch =
  | { status: "ok"; id: string; apellido: string; nombre: string }
  | { status: "ambiguo"; candidatos: { id: string; label: string }[] }
  | { status: "missing"; sheetName: string };

/** El viaje que YA está cargado y contra el que choca una fila del Excel.
 * Se guarda entero (no solo la clave) para poder mostrar en el preview cuál es
 * el duplicado y de dónde salió, en vez de un número suelto. */
export type ViajeYaCargado = {
  codigo: string;
  fecha: string;
  remito: string | null;
  origen: string | null;
  destino: string | null;
  importe: number | null;
  /** De dónde vino el que ya está: "HOJA DE RUTA · SALTO MAXIMILIANO", "YPF"… */
  cargadoDesde: string | null;
  /** Día en que se cargó (no el del viaje). */
  cargadoEl: string | null;
};

export type SheetViajePreview = {
  fecha: string;
  saleDe: string;
  llegaA: string;
  remito: string; // el número tal cual del Excel, o REMITO_VACIO
  material: string | null;
  via: HrRutaVia | null; // vía marcada (Ruta 5 / Ruta 22), leída de MATERIAL
  ton: number | null;
  km: number | null; // KM REC del Excel (distancia del tramo)
  importe: number | null;
  vacio: boolean;
  dup: boolean; // ya estaba importado (no se vuelve a cargar)
  dupDe: ViajeYaCargado | null; // contra cuál choca (solo cuando dup)
};

export type SheetPreview = {
  sheetName: string;
  patentes: string[];
  chofer: ChoferMatch;
  total: number;
  vacios: number;
  conRemito: number;
  pendientesFacturar: number;
  yaImportados: number;
  viasRuta5: number; // viajes marcados por Ruta 5 (distancia directa)
  viasRuta22: number; // viajes marcados por Ruta 22 (por la base)
  sumaImporte: number;
  sumaTon: number;
  sumaKm: number;
  sumaKmVacios: number;
  warnings: string[];
  viajes: SheetViajePreview[];
};

// Valor especial de AsignacionSheet.chofer_id: crear el chofer a partir del
// nombre del sheet al confirmar. Regla del cliente (reunión Nico 02/07): un viaje
// nunca puede quedar a nombre de un chofer que no está dado de alta en Legajos
// (caso «Goiti»), así que el alta automática SOLO se acepta cuando el caller pasa
// opts.permitirCrearChoferes (scripts de backfill histórico). El flujo web no lo usa.
export const CREAR_CHOFER = "__crear__";

export type AsignacionSheet = {
  sheetName: string;
  chofer_id: string | null; // null = saltear · CREAR_CHOFER = alta automática (solo scripts)
};

/** Fila con fecha posterior a hoy. Un viaje que todavía no pasó no existe: es
 * siempre un error de tipeo en el Excel (un "09/10" que era "09/06"). Se listan
 * para poder decidir si entran o no, sin tocar el dato. */
export type FilaFutura = {
  sheetName: string;
  fecha: string;
  saleDe: string;
  llegaA: string;
  remito: string;
  importe: number | null;
};

/** Fila cuya fecha cae fuera del mes principal del archivo.
 *
 * NO es un error y no se toca: una hoja de ruta de junio arrastra los últimos
 * viajes de mayo (salieron el 30 y llegaron en junio) y a veces filas viejas de
 * meses ya cerrados. Lo que sí importa es saberlo ANTES de confirmar, porque el
 * viaje se guarda con su fecha real y entonces NO aparece al filtrar por junio
 * en la Hoja de ruta mensual: queda archivado en su mes. Sin este aviso, la
 * cuenta del Excel y la del sistema no dan y parece que se perdieron viajes. */
export type FilaFueraDeMes = {
  sheetName: string;
  fecha: string;
  saleDe: string;
  llegaA: string;
  remito: string;
  importe: number | null;
  vacio: boolean;
};

/** Cuántos viajes del archivo caen en cada mes ("2026-06"), de mayor a menor. */
export type ViajesPorMes = { mes: string; viajes: number };

export type HojaRutaPreviewData = {
  ok?: boolean;
  error?: string;
  sheets?: SheetPreview[];
  filasFuturas?: FilaFutura[];
  filasFueraDeMes?: FilaFueraDeMes[];
  summary?: {
    totalSheets: number;
    sheetsOk: number;
    sheetsConWarning: number;
    sheetsConError: number;
    totalViajes: number;
    totalImportables: number;
    totalDuplicados: number;
    totalImporte: number;
    totalVacios: number;
    totalPendientesFacturar: number;
    totalTon: number;
    totalKm: number;
    /** Período que cubre el Excel. Es el dato que explica los duplicados: una
     * pestaña que arrastra filas de meses anteriores ya cargados. */
    fechaMin: string | null;
    fechaMax: string | null;
    /** De qué mes es el archivo, leído de los datos y no del nombre: el mes con
     * más viajes ("2026-06"). null si no hay viajes. */
    mesPrincipal: string | null;
    /** Reparto por mes de lo que se va a importar (sin duplicados). */
    porMes: ViajesPorMes[];
  };
  warnings?: string[];
  asignaciones?: AsignacionSheet[];
  choferesDisponibles?: { id: string; label: string }[];
} | null;

export type ConfirmImportData = {
  ok?: boolean;
  error?: string;
  imported?: {
    viajes: number;
    pendientesFacturar: number;
    duplicados: number;
    omitidos: number;
    /** Filas con fecha posterior a hoy que se dejaron afuera a pedido. */
    futurasOmitidas: number;
    puntosCreados: number;
    sheetsConfirmados: number;
    choferesCreados: number;
    /** Mes al que pertenece el grueso de lo importado ("2026-06"). */
    mesPrincipal: string | null;
    /** Viajes creados con fecha de OTRO mes. Se guardaron con su fecha real, así
     * que en la Hoja de ruta mensual salen en su mes, no en el del archivo. */
    fueraDeMes: number;
    /** Reparto por mes de lo efectivamente creado. */
    porMes: ViajesPorMes[];
  };
} | null;

// ============================================================================
// Normalización y dedup
// ============================================================================

export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export function normPatente(s: string): string {
  return s.replace(/\s|-/g, "").toUpperCase();
}

/** Un remito "real" identifica unívocamente al viaje: tiene al menos un dígito.
 * Notas como "SCANIA" en la columna remito NO son clave única (puede haber
 * varios tramos el mismo día con la misma nota). */
function esRemitoReal(remito: string | null): boolean {
  return !!remito && remito.toUpperCase() !== "VACIO" && /\d/.test(remito);
}

/** Clave de dedup de un viaje no-vacío.
 *  - Con remito real: chofer + fecha + remito (la clave única natural).
 *  - Sin remito real: chofer + fecha + ruta + tonelaje + vía, para no pisar
 *    viajes distintos del mismo día (ej. dos tramos con nota "SCANIA" en remito,
 *    o el mismo par hecho una vez por Ruta 5 y otra sin marcar: son viajes
 *    distintos con distancia propia, no un duplicado). */
export function dedupKey(
  choferId: string,
  fecha: string,
  remito: string | null,
  ton: number | null,
  ruta: string,
  via?: string | null,
): string {
  if (esRemitoReal(remito)) {
    return `${choferId}|${fecha}|R:${remito!.trim()}`;
  }
  return `${choferId}|${fecha}|X:${ruta}|T:${ton == null ? "" : ton.toFixed(2)}|V:${via ?? ""}`;
}

function rutaKey(saleDe: string | null, llegaA: string | null): string {
  return `${normName(saleDe ?? "")}>${normName(llegaA ?? "")}`;
}

/** Clave de un viaje VACÍO: chofer + día + tramo, porque no tienen remito.
 *
 * Antes los vacíos no se dedupeaban y se cargaban todos. El resultado: una
 * pestaña que arrastra días de meses ya importados (el caso «SALTO MAXIMILIANO»
 * con marzo dentro de la planilla de junio) volvía a crear esas vueltas en
 * vacío. Ahora se dedupean por multiplicidad: si el Excel trae dos vacíos
 * idénticos el mismo día y en la base hay uno, se crea el que falta.
 *
 * El prefijo `V:` no colisiona con los que arma `dedupKey` (`R:` y `X:`). */
export function vacioKey(choferId: string, fecha: string, ruta: string): string {
  return `${choferId}|${fecha}|V:${ruta}`;
}

/** Cómo entró al sistema el viaje que ya está: lo dice el prefijo que deja cada
 * importador en observaciones. Sin prefijo = lo cargó una persona a mano. */
function cargadoDesde(observaciones: string | null): string | null {
  const m = observaciones?.match(/^\[(?:Import\s+)?([^\]]+)\]/i);
  if (m) return m[1].trim();
  return observaciones ? null : "Carga manual";
}

/** Índice de lo que ya está cargado: clave → los viajes que la comparten.
 *
 * Es una lista y no un solo viaje porque los vacíos se dedupean por cantidad
 * (dos vueltas iguales el mismo día son dos viajes, no uno). Para los viajes con
 * remito la lista tiene siempre un elemento: el remito ya es único. */
export type ExistentesIndex = Map<string, ViajeYaCargado[]>;

/** Carga los viajes ya existentes en el rango de fechas del Excel, indexados por
 * su clave (los vacíos con `vacioKey`, el resto con `dedupKey`).
 *
 * Guarda el viaje entero y no solo la clave: el preview necesita poder mostrar
 * CUÁL es el viaje repetido, no nada más cuántos hay. */
export async function loadExistentes(
  supabase: AdminDb,
  parsed: HrParseResult,
): Promise<ExistentesIndex> {
  const existentes: ExistentesIndex = new Map();
  const todasLasFechas = parsed.sheets.flatMap((s) => s.viajes.map((v) => v.fecha));
  if (todasLasFechas.length === 0) return existentes;
  let fechaMin = "9999-12-31", fechaMax = "0000-01-01";
  for (const f of todasLasFechas) {
    if (f < fechaMin) fechaMin = f;
    if (f > fechaMax) fechaMax = f;
  }
  // Paginado: el API REST corta en 1000 filas por request.
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("viajes")
      .select(`
        codigo, chofer_id, fecha_viaje, nro_remito, tonelaje_real, es_vacio, ruta_via,
        monto_flete, observaciones, created_at,
        origen:puntos_ruta!viajes_origen_id_fkey(nombre),
        destino:puntos_ruta!viajes_destino_id_fkey(nombre)
      `)
      .gte("fecha_viaje", fechaMin)
      .lte("fecha_viaje", fechaMax)
      .not("chofer_id", "is", null)
      .range(from, from + 999);
    const rows = (data ?? []) as {
      codigo: string;
      chofer_id: string;
      fecha_viaje: string;
      nro_remito: string | null;
      tonelaje_real: number | null;
      es_vacio: boolean | null;
      ruta_via: string | null;
      monto_flete: number | null;
      observaciones: string | null;
      created_at: string | null;
      origen: { nombre: string } | { nombre: string }[] | null;
      destino: { nombre: string } | { nombre: string }[] | null;
    }[];
    for (const v of rows) {
      const ori = Array.isArray(v.origen) ? v.origen[0] : v.origen;
      const des = Array.isArray(v.destino) ? v.destino[0] : v.destino;
      const ruta = rutaKey(ori?.nombre ?? null, des?.nombre ?? null);
      const key = v.es_vacio
        ? vacioKey(v.chofer_id, v.fecha_viaje, ruta)
        : dedupKey(
            v.chofer_id,
            v.fecha_viaje,
            v.nro_remito,
            v.tonelaje_real,
            ruta,
            v.ruta_via,
          );
      const yaEn = existentes.get(key);
      const ref: ViajeYaCargado = {
        codigo: v.codigo,
        fecha: v.fecha_viaje,
        remito: v.nro_remito,
        origen: ori?.nombre ?? null,
        destino: des?.nombre ?? null,
        importe: v.monto_flete,
        cargadoDesde: cargadoDesde(v.observaciones),
        cargadoEl: v.created_at ? v.created_at.slice(0, 10) : null,
      };
      if (yaEn) yaEn.push(ref);
      else existentes.set(key, [ref]);
    }
    if (rows.length < 1000) break;
  }
  return existentes;
}

/**
 * Consumidor del índice de existentes: cada clave se puede "gastar" tantas veces
 * como viajes haya cargados con ella, y no más.
 *
 * Sin esto, dos vueltas en vacío iguales el mismo día (misma clave) se saltearían
 * las dos por un solo viaje cargado, y se perdería una. Devuelve el viaje contra
 * el que choca la fila, o null si ya no queda ninguno libre.
 */
export function crearConsumidor(existentes: ExistentesIndex) {
  const restantes = new Map<string, number>();
  for (const [k, v] of existentes) restantes.set(k, v.length);
  return (key: string): ViajeYaCargado | null => {
    const quedan = restantes.get(key) ?? 0;
    if (quedan <= 0) return null;
    const lista = existentes.get(key)!;
    restantes.set(key, quedan - 1);
    return lista[lista.length - quedan] ?? lista[0];
  };
}

// ============================================================================
// Matching chofer ↔ sheet name
// ============================================================================

export type ChoferRow = {
  id: string;
  apellido: string;
  nombre: string;
  estado?: string;
};

const VARIANTES_APELLIDO: Record<string, string> = {
  guilfor: "guilford",
  pitana: "pittana",
  pitta: "pittana",
};

// Candidatos por apellido (incluye compuestos como "Saenz Buruaga" / "De Libano
// Elorrieta" y typos como "GUILFOR"/"PITANA"/"EUGENIO PITTA").
function apellidoCandidatos(raw: string, choferes: ChoferRow[]): ChoferRow[] {
  const apMatch = (apRaw: string) =>
    raw === apRaw || raw.startsWith(apRaw + " ") || apRaw.startsWith(raw + " ");
  let c = choferes.filter((x) => apMatch(normName(x.apellido)));
  if (c.length === 0) {
    const t0 = raw.split(" ")[0];
    c = choferes.filter((x) => normName(x.apellido).split(" ")[0] === t0);
  }
  if (c.length === 0) {
    for (const t of raw.split(" ")) {
      const v = VARIANTES_APELLIDO[t];
      if (v) {
        c = choferes.filter((x) => normName(x.apellido).split(" ")[0] === v);
        if (c.length) break;
      }
    }
  }
  return c;
}

// Tokens del sheet que NO son parte del apellido (= pistas del nombre de pila).
// Ej: "JUAREZ LUIS" → ["luis"]; "CEJAS DIEGO" → ["diego"]; "JUAREZ N" → ["n"].
function tokensNombre(raw: string, cands: ChoferRow[]): string[] {
  const apWords = new Set<string>();
  for (const c of cands) for (const w of normName(c.apellido).split(" ")) apWords.add(w);
  return raw.split(" ").filter((t) => t && !apWords.has(t));
}

function matchNombre(cands: ChoferRow[], tokens: string[]): ChoferRow[] {
  if (tokens.length === 0) return [];
  return cands.filter((c) => {
    const nom = normName(c.nombre).split(" ");
    return tokens.some((t) =>
      t.length >= 3 ? nom.some((n) => n === t || n.startsWith(t)) : nom.some((n) => n.startsWith(t)),
    );
  });
}

/**
 * Resuelve TODAS las pestañas a la vez, de forma determinística (sin intervención
 * del usuario). Clave: cuando hay varios choferes con el mismo apellido, el Excel
 * usa el apellido "pelado" para uno y "APELLIDO NOMBRE" para el otro
 * (CEJAS vs CEJAS DIEGO). Se resuelve por nombre y por eliminación.
 */
export function resolverAsignaciones(
  parsedSheets: HrSheetParsed[],
  choferes: ChoferRow[],
): Map<string, ChoferMatch> {
  const info = parsedSheets.map((sp) => {
    const raw = normName(sp.sheetName);
    const cands = apellidoCandidatos(raw, choferes);
    return { sp, raw, cands, tokens: tokensNombre(raw, cands), assigned: null as string | null };
  });

  const claimed = new Set<string>();

  // Fase A: match único por nombre de pila (permite que 2 pestañas apunten al mismo
  // chofer, ej. "PITTANA EUGENIO" + "EUGENIO PITTA").
  for (const it of info) {
    if (!it.cands.length) continue;
    const nm = matchNombre(it.cands, it.tokens);
    if (nm.length === 1) {
      it.assigned = nm[0].id;
      claimed.add(nm[0].id);
    }
  }

  // Fase B: eliminación iterativa para los apellidos "pelados" y ambiguos restantes.
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of info) {
      if (it.assigned || !it.cands.length) continue;
      let pool = it.cands.filter((c) => !claimed.has(c.id));
      if (it.tokens.length) {
        const nm = matchNombre(it.cands, it.tokens).filter((c) => !claimed.has(c.id));
        if (nm.length) pool = nm;
      }
      let elegido: ChoferRow | null = null;
      if (pool.length === 1) {
        elegido = pool[0];
      } else if (pool.length > 1) {
        // Desempate: si entre los que quedan hay un solo ACTIVO, es ese (un egresado
        // sin pestaña propia no se queda con el apellido "pelado").
        const activos = pool.filter((c) => c.estado !== "baja");
        if (activos.length === 1) elegido = activos[0];
      }
      if (elegido) {
        it.assigned = elegido.id;
        claimed.add(elegido.id);
        changed = true;
      }
    }
  }

  const result = new Map<string, ChoferMatch>();
  for (const it of info) {
    if (it.assigned) {
      const c = choferes.find((x) => x.id === it.assigned)!;
      result.set(it.sp.sheetName, { status: "ok", id: c.id, apellido: c.apellido, nombre: c.nombre });
    } else if (!it.cands.length) {
      result.set(it.sp.sheetName, { status: "missing", sheetName: it.sp.sheetName });
    } else {
      const pool = it.cands.filter((c) => !claimed.has(c.id));
      const finals = pool.length ? pool : it.cands;
      result.set(it.sp.sheetName, {
        status: "ambiguo",
        candidatos: finals.map((c) => ({ id: c.id, label: `${c.apellido}, ${c.nombre}` })),
      });
    }
  }
  return result;
}

/** "SALTO MAXIMILIANO" → { apellido: "Salto", nombre: "Maximiliano" }.
 * Heurística simple: primer token = apellido, el resto nombre. El usuario puede
 * corregir el legajo después; lo importante es no perder los viajes. */
export function choferDesdeSheetName(sheetName: string): { apellido: string; nombre: string } {
  const title = (s: string) =>
    s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
  const tokens = sheetName.trim().replace(/\s+/g, " ").split(" ");
  const apellido = title(tokens[0] ?? sheetName.trim());
  const nombre = title(tokens.slice(1).join(" ").replace(/\./g, ""));
  return { apellido, nombre };
}

// ============================================================================
// Mes del archivo
// ============================================================================

/** "2026-06-30" → "2026-06". */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Reparto por mes, de mayor a menor cantidad; a igual cantidad, el mes más
 * nuevo primero (una hoja de junio con 20 de junio y 20 de mayo es de junio). */
export function contarPorMes(fechas: string[]): ViajesPorMes[] {
  const acc = new Map<string, number>();
  for (const f of fechas) {
    const m = mesDe(f);
    acc.set(m, (acc.get(m) ?? 0) + 1);
  }
  return [...acc.entries()]
    .map(([mes, viajes]) => ({ mes, viajes }))
    .sort((a, b) => b.viajes - a.viajes || b.mes.localeCompare(a.mes));
}

/** De qué mes es el archivo: el que más viajes tiene. No se lee del nombre del
 * Excel («JUNIO COMPLETA» trae filas de febrero), sino de los datos. */
export function mesPrincipalDe(fechas: string[]): string | null {
  return contarPorMes(fechas)[0]?.mes ?? null;
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function buildHojaRutaPreview(
  supabase: AdminDb,
  buffer: Buffer,
): Promise<NonNullable<HojaRutaPreviewData>> {
  let parsed: HrParseResult;
  try {
    parsed = parseHojaRutaXlsx(buffer);
  } catch (e) {
    console.error("Error parseando HOJA DE RUTA:", e);
    return { error: "No se pudo leer el Excel (¿es el formato correcto?)." };
  }

  // Todos los choferes (incluidos egresados/baja): la HOJA DE RUTA es histórica,
  // así que un chofer que ya egresó pero manejó en el período debe poder matchear.
  const { data: choferesRaw } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, cuil, estado");

  const choferes = (choferesRaw ?? []) as (ChoferRow & { cuil: string | null })[];

  const existentes = await loadExistentes(supabase, parsed);

  // Resolver TODAS las pestañas de una (determinístico, por nombre + eliminación)
  const matchPorSheet = resolverAsignaciones(parsed.sheets, choferes);

  // Un solo consumidor para todas las pestañas: si dos arrastran el mismo viaje,
  // la primera se lo lleva y la segunda ya no lo ve como duplicado (que es lo
  // que va a pasar al importar).
  const consumir = crearConsumidor(existentes);
  const sheets: SheetPreview[] = [];
  for (const sp of parsed.sheets) {
    sheets.push(buildSheetPreview(sp, matchPorSheet.get(sp.sheetName)!, consumir));
  }

  // Período que cubre el archivo: se saca de los viajes parseados, no del
  // nombre del Excel («JUNIO COMPLETA» puede traer filas de marzo).
  let fechaMin: string | null = null;
  let fechaMax: string | null = null;
  const hoy = hoyArgentina();
  const filasFuturas: FilaFutura[] = [];
  for (const sh of sheets) {
    for (const v of sh.viajes) {
      if (fechaMin == null || v.fecha < fechaMin) fechaMin = v.fecha;
      if (fechaMax == null || v.fecha > fechaMax) fechaMax = v.fecha;
      // Los duplicados no entran: esos ya no se iban a importar igual.
      if (v.fecha > hoy && !v.dup) {
        filasFuturas.push({
          sheetName: sh.sheetName,
          fecha: v.fecha,
          saleDe: v.saleDe,
          llegaA: v.llegaA,
          remito: v.remito,
          importe: v.importe,
        });
      }
    }
  }
  filasFuturas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // De qué mes es realmente el archivo y qué filas se le escapan. Se mide sobre
  // lo que se va a importar (sin duplicados): los repetidos no entran, así que
  // no cambian el mes de nada.
  const aImportar = sheets.flatMap((sh) => sh.viajes.filter((v) => !v.dup).map((v) => ({ sh, v })));
  const porMes = contarPorMes(aImportar.map((x) => x.v.fecha));
  const mesPrincipal = porMes[0]?.mes ?? null;
  const filasFueraDeMes: FilaFueraDeMes[] = aImportar
    .filter(({ v }) => mesDe(v.fecha) !== mesPrincipal)
    .map(({ sh, v }) => ({
      sheetName: sh.sheetName,
      fecha: v.fecha,
      saleDe: v.saleDe,
      llegaA: v.llegaA,
      remito: v.remito,
      importe: v.importe,
      vacio: v.vacio,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const summary = {
    totalSheets: sheets.length,
    sheetsOk: sheets.filter((s) => s.chofer.status === "ok").length,
    sheetsConWarning: sheets.filter(
      (s) => s.chofer.status === "ok" && s.warnings.length > 0,
    ).length,
    sheetsConError: sheets.filter((s) => s.chofer.status !== "ok").length,
    totalViajes: sheets.reduce((acc, s) => acc + s.total, 0),
    totalImportables: sheets.reduce(
      (acc, s) =>
        acc + (s.chofer.status === "ok" ? s.total - s.yaImportados : 0),
      0,
    ),
    totalDuplicados: sheets.reduce((acc, s) => acc + s.yaImportados, 0),
    totalImporte: sheets.reduce((acc, s) => acc + s.sumaImporte, 0),
    totalVacios: sheets.reduce((acc, s) => acc + s.vacios, 0),
    totalPendientesFacturar: sheets.reduce((acc, s) => acc + s.pendientesFacturar, 0),
    totalTon: sheets.reduce((acc, s) => acc + s.sumaTon, 0),
    totalKm: sheets.reduce((acc, s) => acc + s.sumaKm + s.sumaKmVacios, 0),
    fechaMin,
    fechaMax,
    mesPrincipal,
    porMes,
  };

  // Default por sheet: ok → ese chofer · missing/ambiguo → sin asignar (missing
  // bloquea la confirmación hasta que el chofer esté dado de alta en Legajos o el
  // usuario lo resuelva a mano en el preview).
  const asignaciones: AsignacionSheet[] = sheets.map((s) => ({
    sheetName: s.sheetName,
    chofer_id: s.chofer.status === "ok" ? s.chofer.id : null,
  }));

  return {
    ok: true,
    sheets,
    filasFuturas,
    filasFueraDeMes,
    summary,
    warnings: parsed.warnings,
    asignaciones,
    choferesDisponibles: choferes
      .map((c) => ({
        id: c.id,
        label: `${c.apellido}, ${c.nombre}${c.estado === "baja" ? " (egresado)" : ""}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

function buildSheetPreview(
  sp: HrSheetParsed,
  chofer: ChoferMatch,
  consumir: (key: string) => ViajeYaCargado | null,
): SheetPreview {
  const warnings: string[] = [];

  let sumaImporte = 0;
  let sumaTon = 0;
  let sumaKm = 0;
  let sumaKmVacios = 0;
  let vacios = 0;
  let conRemito = 0;
  let pendientes = 0;
  let yaImportados = 0;
  let viasRuta5 = 0;
  let viasRuta22 = 0;
  const viajes: SheetViajePreview[] = [];

  for (const v of sp.viajes) {
    const ton = tonelajeDe(v);
    const remito = normalizarRemito(v.remito);
    const vacio = remito === REMITO_VACIO;
    sumaImporte += v.importe ?? 0;
    sumaTon += ton ?? 0;
    sumaKm += v.kmRec ?? 0;
    sumaKmVacios += v.kmVacios ?? 0;
    if (vacio) vacios++;
    else conRemito++;
    if (!vacio && v.importe == null) pendientes++;
    if (v.rutaVia === "ruta_5") viasRuta5++;
    else if (v.rutaVia === "ruta_22") viasRuta22++;
    let dupDe: ViajeYaCargado | null = null;
    if (chofer.status === "ok") {
      const key = vacio
        ? vacioKey(chofer.id, v.fecha, rutaKey(v.saleDe, v.llegaA))
        : dedupKey(chofer.id, v.fecha, v.remito, ton, rutaKey(v.saleDe, v.llegaA), v.rutaVia);
      dupDe = consumir(key);
      if (dupDe) yaImportados++;
    }
    viajes.push({
      fecha: v.fecha,
      saleDe: v.saleDe,
      llegaA: v.llegaA,
      remito,
      material: v.material,
      via: v.rutaVia,
      ton,
      km: v.kmRec,
      importe: vacio ? 0 : v.importe,
      vacio,
      dup: dupDe != null,
      dupDe,
    });
  }

  if (sp.filasIgnoradas > 0) {
    warnings.push(`${sp.filasIgnoradas} filas no son viajes (totales / gastos pegados).`);
  }
  if (viasRuta5 + viasRuta22 > 0) {
    const partes = [
      viasRuta5 ? `${viasRuta5} por Ruta 5` : null,
      viasRuta22 ? `${viasRuta22} por Ruta 22` : null,
    ].filter(Boolean);
    warnings.push(`Vía marcada: ${partes.join(" · ")} (distancia propia del par).`);
  }

  return {
    sheetName: sp.sheetName,
    patentes: sp.patentes,
    chofer,
    total: sp.viajes.length,
    vacios,
    conRemito,
    pendientesFacturar: pendientes,
    yaImportados,
    viasRuta5,
    viasRuta22,
    sumaImporte,
    sumaTon,
    sumaKm,
    sumaKmVacios,
    warnings,
    viajes,
  };
}

// ============================================================================
// CONFIRMACIÓN: insertar viajes (y crear choferes faltantes)
// ============================================================================

export async function runHojaRutaImport(
  supabase: AdminDb,
  buffer: Buffer,
  asignaciones: AsignacionSheet[],
  userId: string,
  opts?: {
    archivo?: string;
    permitirCrearChoferes?: boolean;
    /** Dejar afuera las filas con fecha posterior a hoy (typos del Excel). El
     * dato NO se corrige: la fila simplemente no entra. */
    omitirFechasFuturas?: boolean;
  },
): Promise<NonNullable<ConfirmImportData>> {
  let parsed: HrParseResult;
  try {
    parsed = parseHojaRutaXlsx(buffer);
  } catch (e) {
    console.error("Error parseando HOJA DE RUTA (confirm):", e);
    return { error: "No se pudo leer el Excel." };
  }

  const asignPorSheet = new Map(asignaciones.map((a) => [a.sheetName, a.chofer_id]));

  // Validación previa a cualquier escritura (caso «Goiti», 02/07): ningún viaje
  // puede quedar a nombre de un chofer que no está dado de alta en Legajos. El
  // alta automática solo se acepta desde scripts que pasan permitirCrearChoferes.
  const { data: choferesExistentes } = await supabase.from("choferes").select("id");
  const idsValidos = new Set(
    ((choferesExistentes ?? []) as { id: string }[]).map((c) => c.id),
  );
  const sheetsSinChofer: string[] = [];
  for (const sp of parsed.sheets) {
    const ch = asignPorSheet.get(sp.sheetName);
    if (!ch) continue; // null = saltear, se cuenta como omitido más abajo
    const esAltaNoPermitida = ch === CREAR_CHOFER && !opts?.permitirCrearChoferes;
    if (esAltaNoPermitida || (ch !== CREAR_CHOFER && !idsValidos.has(ch))) {
      sheetsSinChofer.push(sp.sheetName.trim());
    }
  }
  if (sheetsSinChofer.length > 0) {
    return {
      error:
        `No se importó nada: ${sheetsSinChofer.map((s) => `«${s}»`).join(", ")} no ` +
        `corresponde a un chofer dado de alta. Cargalo en Choferes → Legajos y volvé ` +
        `a analizar el archivo, o asignale un chofer existente en el preview.`,
    };
  }

  // Cargar camiones para mapear chofer→camión actual
  const [{ data: camionesRaw }, clienteSinAsignarId, tipoCargaIdGenerico, puntosMap, ultimoCodigo] =
    await Promise.all([
      supabase.from("camiones").select("id, patente, chofer_actual_id"),
      getOrCreateCliente(supabase, userId, "Sin asignar (import)"),
      getOrCreateTipoCarga(supabase, "Otros"),
      preloadPuntos(supabase),
      getLastCodigo(supabase, `V-${new Date().getFullYear()}-`),
    ]);

  const camiones = (camionesRaw ?? []) as {
    id: string;
    patente: string;
    chofer_actual_id: string | null;
  }[];
  const camionPorChofer = new Map<string, string>();
  const camionPorPatente = new Map<string, string>();
  for (const c of camiones) {
    if (c.chofer_actual_id) camionPorChofer.set(c.chofer_actual_id, c.id);
    camionPorPatente.set(normPatente(c.patente), c.id);
  }

  const consumir = crearConsumidor(await loadExistentes(supabase, parsed));

  let codigoSeq = ultimoCodigo;
  let puntosCreados = 0;
  let duplicados = 0;
  let omitidos = 0;
  let futurasOmitidas = 0;
  let pendientesFacturar = 0;
  let sheetsConfirmados = 0;
  let choferesCreados = 0;
  const seenThisRun = new Set<string>();
  const viajesPayload: Record<string, unknown>[] = [];

  const hoy = hoyArgentina();
  const yearPrefix = `V-${new Date().getFullYear()}-`;

  for (const sp of parsed.sheets) {
    let choferId = asignPorSheet.get(sp.sheetName);
    if (choferId === CREAR_CHOFER) {
      // Alta automática (solo scripts con permitirCrearChoferes; ya validado arriba).
      const { apellido, nombre } = choferDesdeSheetName(sp.sheetName);
      const { data: nuevo, error: chErr } = await supabase
        .from("choferes")
        .insert({
          apellido,
          nombre,
          estado: "activo",
          rol: "chofer",
          observaciones: `[IMPORT HR] Creado automáticamente desde la hoja de ruta (sheet «${sp.sheetName.trim()}»). Completar legajo.`,
          created_by: userId,
        })
        .select("id")
        .single();
      if (chErr || !nuevo) {
        console.error(`No se pudo crear el chofer del sheet ${sp.sheetName}:`, chErr);
        omitidos += sp.viajes.length;
        continue;
      }
      choferId = nuevo.id;
      choferesCreados++;
    }
    if (!choferId) {
      omitidos += sp.viajes.length;
      continue;
    }
    sheetsConfirmados++;

    // Resolver camión: 1) habitual del chofer si existe; 2) primera patente del sheet
    let camionDefault: string | null = camionPorChofer.get(choferId) ?? null;
    if (!camionDefault) {
      for (const p of sp.patentes) {
        const m = camionPorPatente.get(normPatente(p));
        if (m) { camionDefault = m; break; }
      }
    }

    for (const v of sp.viajes) {
      const remito = normalizarRemito(v.remito);
      const vacio = remito === REMITO_VACIO;
      const ton = tonelajeDe(v);

      // Fecha que todavía no pasó = typo en el Excel. Se deja afuera solo si el
      // usuario lo pidió; el dato del Excel no se toca nunca.
      if (opts?.omitirFechasFuturas && v.fecha > hoy) {
        futurasOmitidas++;
        continue;
      }

      // Dedup contra lo que ya está cargado. Con remito la clave usa el remito
      // (o ruta+tonelaje cuando la columna trae notas tipo "SCANIA", ver
      // dedupKey); los vacíos van por chofer+día+tramo y se dedupean por
      // cantidad, así que dos vueltas iguales el mismo día siguen siendo dos.
      const key = vacio
        ? vacioKey(choferId, v.fecha, rutaKey(v.saleDe, v.llegaA))
        : dedupKey(choferId, v.fecha, v.remito, ton, rutaKey(v.saleDe, v.llegaA), v.rutaVia);
      if (consumir(key)) {
        duplicados++;
        continue;
      }
      // `seenThisRun` solo para los que tienen remito: el remito es único, dos
      // filas con el mismo son la misma. Dos vacíos idénticos, no.
      if (!vacio) {
        if (seenThisRun.has(key)) {
          duplicados++;
          continue;
        }
        seenThisRun.add(key);
      }

      // En la BD el viaje vacío se marca con es_vacio, así que nro_remito queda NULL.
      const remitoNormalizado = vacio ? null : remito;
      const importeFinal = vacio ? 0 : v.importe; // NULL = todavía sin importe

      if (!vacio && importeFinal == null) pendientesFacturar++;

      // Puntos origen/destino
      const origenId = await ensurePunto(supabase, puntosMap, v.saleDe, () => puntosCreados++);
      const destinoId = await ensurePunto(supabase, puntosMap, v.llegaA, () => puntosCreados++);

      codigoSeq++;
      viajesPayload.push({
        id: crypto.randomUUID(),
        codigo: `${yearPrefix}${String(codigoSeq).padStart(5, "0")}`,
        fecha_viaje: v.fecha,
        cliente_id: clienteSinAsignarId, // queda asignable manualmente
        chofer_id: choferId,
        camion_id: camionDefault,
        tipo_carga_id: tipoCargaIdGenerico,
        origen_id: origenId,
        destino_id: destinoId,
        km_con_carga: vacio ? 0 : (v.kmRec ?? 0),
        km_vacios: vacio ? (v.kmVacios ?? v.kmRec ?? 0) : (v.kmVacios ?? 0),
        tonelaje_real: ton,
        monto_flete: importeFinal,
        nro_remito: remitoNormalizado,
        material: v.material,
        // Vía leída de la marca "RUTA 5"/"RUTA 22" del material: define los km del
        // par (IBICUY→LAJE 20 va 1360 por Ruta 5 y ~1480 sin marcar). NULL = sin marcar.
        ruta_via: v.rutaVia,
        es_vacio: vacio,
        moneda: "ARS",
        estado: importeFinal == null ? "pendiente" : "cerrado",
        // Regla del cliente: el viaje tiene valor solo cuando se factura → tener
        // monto > 0 significa facturado (y cobrado, espejo: no hay flujo de cobro
        // aparte). Vacíos (0) y viajes sin importe (null) quedan sin facturar.
        facturado: viajeEstaFacturado(importeFinal, vacio),
        cobrado: viajeEstaFacturado(importeFinal, vacio),
        observaciones: [
          `[Import HOJA DE RUTA · ${sp.sheetName}]`,
          v.material ? `Material: ${v.material}` : null,
          v.rutaVia === "ruta_5" ? "Ruta 5" : v.rutaVia === "ruta_22" ? "Ruta 22" : null,
          vacio ? "VIAJE VACÍO" : null,
        ].filter(Boolean).join(" · "),
        created_by: userId,
      });
    }
  }

  // Reparto por mes de lo que se está creando. El viaje va con la fecha del
  // Excel siempre; esto es solo para poder decir después "30 de estos no son de
  // junio", que es lo que explica por qué la Hoja de ruta de junio muestra menos
  // viajes que el archivo.
  const porMes = contarPorMes(viajesPayload.map((v) => v.fecha_viaje as string));
  const mesPrincipal = porMes[0]?.mes ?? null;
  const fueraDeMes = porMes
    .filter((m) => m.mes !== mesPrincipal)
    .reduce((acc, m) => acc + m.viajes, 0);

  if (viajesPayload.length === 0) {
    return {
      ok: true,
      imported: {
        viajes: 0, pendientesFacturar, duplicados, omitidos, futurasOmitidas, puntosCreados, sheetsConfirmados, choferesCreados,
        mesPrincipal, fueraDeMes, porMes,
      },
    };
  }

  // Insertar en lotes de 500 (payloads de 1400+ filas superan límites del API).
  let insertados = 0;
  for (let i = 0; i < viajesPayload.length; i += 500) {
    const lote = viajesPayload.slice(i, i + 500);
    const { data: inserted, error } = await supabase
      .from("viajes")
      .insert(lote)
      .select("id");
    if (error) {
      console.error("Error insertando HOJA DE RUTA:", error);
      return {
        error: `Error al insertar viajes (lote ${i / 500 + 1}, ${insertados} ya insertados): ${error.message}`,
      };
    }
    insertados += inserted?.length ?? 0;
  }

  await supabase.from("audit_log").insert({
    usuario_id: userId,
    accion: "importar_hoja_ruta",
    entidad_tipo: "viaje",
    entidad_id: null,
    valores_nuevos: {
      archivo: opts?.archivo ?? null,
      viajes_creados: insertados,
      pendientes_facturar: pendientesFacturar,
      duplicados,
      omitidos,
      futuras_omitidas: futurasOmitidas,
      sheets: sheetsConfirmados,
      choferes_creados: choferesCreados,
      mes_principal: mesPrincipal,
      fuera_del_mes: fueraDeMes,
      // Una línea legible en el panel: "junio 2026: 1.397 · mayo 2026: 25 · …".
      // Es la trazabilidad de por qué el mes del sistema no da igual que el Excel.
      reparto_por_mes: porMes.map((m) => `${m.mes}: ${m.viajes}`).join(" · "),
    },
  });

  return {
    ok: true,
    imported: {
      viajes: insertados,
      pendientesFacturar,
      duplicados,
      omitidos,
      futurasOmitidas,
      puntosCreados,
      sheetsConfirmados,
      choferesCreados,
      mesPrincipal,
      fueraDeMes,
      porMes,
    },
  };
}

// ============================================================================
// Helpers de DB (mismos que en el importador YPF)
// ============================================================================

async function getOrCreateCliente(
  supabase: AdminDb,
  userId: string,
  razon: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("clientes")
    .select("id")
    .ilike("razon_social", razon)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  // El placeholder "Sin asignar (import)" es un comodín de sistema: nace inactivo
  // para no aparecer como cliente seleccionable. Cualquier otro cliente, activo.
  const esPlaceholder = razon.trim().toLowerCase() === "sin asignar (import)";
  const { data } = await supabase
    .from("clientes")
    .insert({
      razon_social: razon,
      condicion_iva: "no_categorizado",
      estado: esPlaceholder ? "inactivo" : "activo",
      created_by: userId,
    })
    .select("id")
    .single();
  return data.id;
}

async function getOrCreateTipoCarga(
  supabase: AdminDb,
  nombre: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("tipos_carga")
    .select("id")
    .ilike("nombre", nombre)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data } = await supabase
    .from("tipos_carga")
    .insert({ nombre, estado: "activo" })
    .select("id")
    .single();
  return data.id;
}

async function preloadPuntos(supabase: AdminDb): Promise<Map<string, string>> {
  const { data } = await supabase.from("puntos_ruta").select("id, nombre");
  const map = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; nombre: string }[]) {
    map.set(normName(r.nombre), r.id);
  }
  return map;
}

async function ensurePunto(
  supabase: AdminDb,
  map: Map<string, string>,
  nombre: string,
  onCreate: () => void,
): Promise<string> {
  const key = normName(nombre);
  const existing = map.get(key);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("puntos_ruta")
    .insert({ nombre, estado: "activo", tipo: "otro" })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear punto "${nombre}": ${error.message}`);
  map.set(key, data.id);
  onCreate();
  return data.id;
}

async function getLastCodigo(supabase: AdminDb, prefix: string): Promise<number> {
  const { data } = await supabase
    .from("viajes")
    .select("codigo")
    .like("codigo", `${prefix}%`)
    .order("codigo", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return 0;
  const last = (data[0] as { codigo: string }).codigo;
  const num = parseInt(last.slice(prefix.length), 10);
  return Number.isFinite(num) ? num : 0;
}
