// Núcleo del importador de la "Liquidación de Fletes" de Loma Negra (sin
// "use server"). Toda la lógica de matching, clasificación y escritura vive acá
// para que la puedan usar tanto los server actions (con auth) como tests/scripts.
//
// MODELO "match + completar" (igual que el DM de YPF):
//   El operador YA cargó el viaje a mano —con el nº de transporte/remito en el
//   campo "Nº de viaje"— sin valor. La liquidación de Loma llega después y trae,
//   por flete, el importe oficial + toneladas + km oficiales. Este importador
//   CRUZA cada flete contra los viajes cargados y, en los que coinciden y aún no
//   tienen valor, COMPLETA importe + tonelaje + km y los marca facturados. Los
//   fletes sin viaje cargado se listan para RECLAMAR (no se crean), salvo que el
//   operador active "crear los no cargados" (backfill de meses viejos).
//
// El match es robusto: cruza el Nº de transporte y el Remito de Loma contra las
// TRES columnas donde puede estar el identificador del viaje cargado a mano:
// nro_transporte, nro_remito y nro_viaje_ypf (el campo "Nº de viaje" del alta).

import { parseLomaXlsx, type LomaRow } from "./parser-loma";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminDb = any;

// ============================================================================
// Tipos compartidos con la UI
// ============================================================================

export type ChoferMatch =
  | { status: "ok"; id: string; apellido: string; nombre: string }
  | { status: "ambiguo"; candidatos: { id: string; label: string }[] }
  | { status: "missing"; nombreLoma: string };

// Estado de cada flete de Loma frente a los viajes ya cargados.
//   completar    → hay viaje cargado sin valor: se completa importe + tn + km.
//   ya_con_valor → hay viaje cargado y ya tiene valor (o es vacío): no se toca.
//   no_cargado   → no hay viaje: se reclama (o se crea si el operador lo pide).
export type FleteStatus = "completar" | "ya_con_valor" | "no_cargado";

export type RowPreview = {
  rowNum: number;
  nroTransporte: string;
  remito: string | null;
  fecha: string | null;
  saleDe: string; // expedidor
  llegaA: string; // destinatario
  material: string | null;
  ton: number | null;
  importe: number | null;
  expedidor: string;
  choferNombre: string;
  choferId: string | null; // match automático (o null si no resolvió)
  choferStatus: ChoferMatch["status"];
  status: FleteStatus;
  viajeCodigo: string | null; // código del viaje matcheado (si lo hay)
  montoActual: number | null; // monto del viaje matcheado (para ya_con_valor)
};

export type ExpedidorPreview = {
  nombre: string;
  filas: number;
  importe: number;
  esLomaDefault: boolean; // sugerencia: ¿es un punto de Loma?
};

export type ChoferAsignacion = {
  nombreLoma: string; // string tal cual viene en el Excel
  chofer_id: string | null; // null = importar sin chofer (revisar después)
};

export type LomaPreviewData = {
  ok?: boolean;
  error?: string;
  rows?: RowPreview[];
  expedidores?: ExpedidorPreview[];
  asignaciones?: ChoferAsignacion[];
  choferesAmbiguos?: { nombreLoma: string; candidatos: { id: string; label: string }[] }[];
  choferesMissing?: string[];
  choferesDisponibles?: { id: string; label: string }[];
  clienteLoma?: { id: string; label: string } | null;
  warnings?: string[];
  summary?: {
    totalFilas: number;
    completar: number;
    yaConValor: number;
    noCargados: number;
    totalImporteCompletar: number;
  };
} | null;

export type ConfirmLomaData = {
  ok?: boolean;
  error?: string;
  imported?: {
    completados: number; // viajes cargados a los que se les completó el valor
    yaConValor: number; // matcheaban pero ya tenían valor → no se tocaron
    noCargados: number; // fletes sin viaje cargado (reclamar)
    creados: number; // de los no cargados, cuántos se crearon (si se pidió)
    tercerosOmitidos: number; // expedidores no marcados como Loma
    sinFecha: number; // no cargados sin fecha → no se pudieron crear
    sinChofer: number; // creados sin chofer asignado
    puntosCreados: number;
    archivado: boolean; // ¿se archivó el Excel en Compliance → Loma?
    liqId: string | null;
  };
} | null;

// ============================================================================
// Normalización
// ============================================================================

export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normPatente(s: string): string {
  return s.replace(/\s|-/g, "").toUpperCase();
}

/** Identificador genérico (Nº transporte / Nº de viaje): sin espacios, mayúsculas. */
export function normId(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "").trim();
}

/** Remito: solo dígitos (mismo criterio que el importador del DM de YPF). */
export function normRem(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

// ============================================================================
// Clasificación de expedidor (Loma vs tercero)
// ============================================================================

// Este Excel ES la liquidación oficial de Loma: Loma paga TODOS los fletes, sin
// importar quién sea el expedidor de origen (puede ser un tercero como SIDERAR o
// MINERA PIERUCCI en un contraflete que Loma igual liquida). Por eso el default es
// "todo Loma" y el toggle del preview sirve para EXCLUIR algún expedidor puntual,
// no para incluirlo.
export function esExpedidorLoma(): boolean {
  return true;
}

// ============================================================================
// Matching flete de Loma ↔ viaje cargado (por transporte / remito / nº de viaje)
// ============================================================================

/** Forma mínima del viaje cargado que necesitamos para matchear y completar. */
export type ViajeRow = {
  id: string;
  codigo: string;
  nro_remito: string | null;
  nro_transporte: string | null;
  nro_viaje_ypf: string | null;
  monto_flete: number | null;
  tonelaje_real: number | null;
  es_vacio: boolean | null;
  km_con_carga: number | null;
};

export type ViajesIndices = {
  byTransporte: Map<string, ViajeRow>; // viaje.nro_transporte
  byNroViajeId: Map<string, ViajeRow>; // viaje.nro_viaje_ypf como identificador
  byRemito: Map<string, ViajeRow>; // viaje.nro_remito (dígitos)
  byNroViajeRem: Map<string, ViajeRow>; // viaje.nro_viaje_ypf como remito (dígitos)
};

/** Construye los índices de match a partir de los viajes candidatos (puro). */
export function buildViajesIndices(viajes: ViajeRow[]): ViajesIndices {
  const byTransporte = new Map<string, ViajeRow>();
  const byNroViajeId = new Map<string, ViajeRow>();
  const byRemito = new Map<string, ViajeRow>();
  const byNroViajeRem = new Map<string, ViajeRow>();
  for (const v of viajes) {
    const t = normId(v.nro_transporte);
    if (t && !byTransporte.has(t)) byTransporte.set(t, v);
    const nvId = normId(v.nro_viaje_ypf);
    if (nvId && !byNroViajeId.has(nvId)) byNroViajeId.set(nvId, v);
    const rem = normRem(v.nro_remito);
    if (rem && !byRemito.has(rem)) byRemito.set(rem, v);
    const nvRem = normRem(v.nro_viaje_ypf);
    if (nvRem && !byNroViajeRem.has(nvRem)) byNroViajeRem.set(nvRem, v);
  }
  return { byTransporte, byNroViajeId, byRemito, byNroViajeRem };
}

/**
 * Devuelve el viaje cargado que corresponde a un flete de Loma, o null. Prioridad:
 *   1) Nº transporte == viaje.nro_transporte
 *   2) Nº transporte == viaje.nro_viaje_ypf  (lo que el operador tipeó en "Nº de viaje")
 *   3) Remito        == viaje.nro_remito
 *   4) Remito        == viaje.nro_viaje_ypf  (remito completado en "Nº de viaje")
 */
export function matchFleteLoma(
  row: { nroTransporte: string | null; remito: string | null },
  idx: ViajesIndices,
): ViajeRow | null {
  const t = normId(row.nroTransporte);
  if (t) {
    const m = idx.byTransporte.get(t) ?? idx.byNroViajeId.get(t);
    if (m) return m;
  }
  const rem = normRem(row.remito);
  if (rem) {
    const m = idx.byRemito.get(rem) ?? idx.byNroViajeRem.get(rem);
    if (m) return m;
  }
  return null;
}

/** Clasifica un flete según el viaje matcheado (puro). */
export function clasificarFleteLoma(
  match: { monto_flete: number | null; es_vacio: boolean | null } | null,
): FleteStatus {
  if (!match) return "no_cargado";
  const yaTiene = Number(match.monto_flete ?? 0) > 0;
  if (yaTiene || match.es_vacio) return "ya_con_valor";
  return "completar";
}

// ============================================================================
// Matching chofer ↔ "APELLIDO, NOMBRE"
// ============================================================================

export type ChoferRow = {
  id: string;
  apellido: string;
  nombre: string;
  estado?: string;
};

function tokensOf(s: string): string[] {
  return normName(s.replace(/,/g, " ")).split(" ").filter((t) => t.length >= 2);
}

function tokenHit(t: string, set: Set<string>): boolean {
  for (const ct of set) {
    if (ct === t) return true;
    if (t.length >= 3 && (ct.startsWith(t) || t.startsWith(ct))) return true;
  }
  return false;
}

/**
 * Matchea un nombre del Excel ("ALVAREZ, HECTOR MARTIN", a veces invertido como
 * "WALTER NICOLAS, MARTINEZ") contra la tabla de choferes por solapamiento de
 * tokens, sin confiar en el orden ni en la coma. Empata por nombre de pila y,
 * si quedan varios con el mismo apellido, prefiere el único activo.
 */
export function matchChofer(nombreLoma: string, choferes: ChoferRow[]): ChoferMatch {
  const toks = tokensOf(nombreLoma);
  if (toks.length === 0) return { status: "missing", nombreLoma };

  let bestScore = 0;
  let ties: ChoferRow[] = [];
  for (const c of choferes) {
    const set = new Set(tokensOf(`${c.apellido} ${c.nombre}`));
    let score = 0;
    for (const t of toks) if (tokenHit(t, set)) score++;
    if (score > bestScore) {
      bestScore = score;
      ties = [c];
    } else if (score === bestScore && score > 0) {
      ties.push(c);
    }
  }

  if (bestScore === 0) return { status: "missing", nombreLoma };

  if (ties.length === 1) {
    const c = ties[0];
    return { status: "ok", id: c.id, apellido: c.apellido, nombre: c.nombre };
  }

  // Desempate: si entre los empatados hay un solo activo, es ese.
  const activos = ties.filter((c) => c.estado !== "baja");
  if (activos.length === 1) {
    const c = activos[0];
    return { status: "ok", id: c.id, apellido: c.apellido, nombre: c.nombre };
  }

  return {
    status: "ambiguo",
    candidatos: ties.map((c) => ({ id: c.id, label: `${c.apellido}, ${c.nombre}` })),
  };
}

// ============================================================================
// Carga de viajes candidatos para el match
// ============================================================================

/** Suma/resta días a una fecha ISO (YYYY-MM-DD). Puro. */
function shiftIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Trae los viajes candidatos a matchear, acotando por el período de la liquidación
 * (ensanchado ±31 días: un viaje cargado a mano puede tener una fecha algo distinta
 * a la del transporte de Loma). Devuelve los índices ya construidos.
 */
async function loadViajesIndices(supabase: AdminDb, rows: LomaRow[]): Promise<ViajesIndices> {
  const fechas = rows.map((r) => r.fecha).filter((f): f is string => !!f);
  if (fechas.length === 0) return buildViajesIndices([]);
  let min = "9999-12-31";
  let max = "0000-01-01";
  for (const f of fechas) {
    if (f < min) min = f;
    if (f > max) max = f;
  }
  const desde = shiftIsoDays(min, -31);
  const hasta = shiftIsoDays(max, 31);

  const all: ViajeRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("viajes")
      .select(
        "id, codigo, nro_remito, nro_transporte, nro_viaje_ypf, monto_flete, tonelaje_real, es_vacio, km_con_carga",
      )
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .range(from, from + 999);
    const batch = (data ?? []) as ViajeRow[];
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return buildViajesIndices(all);
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function buildLomaPreview(
  supabase: AdminDb,
  buffer: Buffer,
): Promise<NonNullable<LomaPreviewData>> {
  let parsed: ReturnType<typeof parseLomaXlsx>;
  try {
    parsed = parseLomaXlsx(buffer);
  } catch (e) {
    console.error("Error parseando liquidación Loma:", e);
    return { error: "No se pudo leer el Excel (¿es el formato correcto?)." };
  }

  if (parsed.rows.length === 0) {
    return { error: parsed.warnings[0] ?? "El archivo no tiene filas de fletes." };
  }

  const { data: choferesRaw } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, estado");
  const choferes = (choferesRaw ?? []) as ChoferRow[];

  const clienteLoma = await findLomaCliente(supabase);
  const indices = await loadViajesIndices(supabase, parsed.rows);

  // Cache de match de chofer por nombre (muchas filas comparten chofer).
  const matchCache = new Map<string, ChoferMatch>();
  const matchDe = (nombre: string): ChoferMatch => {
    const key = normName(nombre);
    let m = matchCache.get(key);
    if (!m) {
      m = nombre ? matchChofer(nombre, choferes) : { status: "missing", nombreLoma: nombre };
      matchCache.set(key, m);
    }
    return m;
  };

  const rows: RowPreview[] = parsed.rows.map((r) => {
    const viaje = matchFleteLoma(r, indices);
    const status = clasificarFleteLoma(viaje);
    const m = matchDe(r.choferNombre);
    return {
      rowNum: r.rowNum,
      nroTransporte: r.nroTransporte,
      remito: r.remito,
      fecha: r.fecha,
      saleDe: r.expedidor,
      llegaA: r.destinatario,
      material: r.material,
      ton: r.tonelaje,
      importe: r.importe,
      expedidor: r.expedidor,
      choferNombre: r.choferNombre,
      choferId: m.status === "ok" ? m.id : null,
      choferStatus: m.status,
      status,
      viajeCodigo: viaje?.codigo ?? null,
      montoActual: viaje?.monto_flete ?? null,
    };
  });

  // Expedidores únicos con sugerencia Loma/tercero.
  const expMap = new Map<string, ExpedidorPreview>();
  for (const r of parsed.rows) {
    const key = r.expedidor || "(sin expedidor)";
    const e = expMap.get(key) ?? {
      nombre: key,
      filas: 0,
      importe: 0,
      esLomaDefault: esExpedidorLoma(),
    };
    e.filas += 1;
    e.importe += r.importe ?? 0;
    expMap.set(key, e);
  }
  const expedidores = [...expMap.values()].sort((a, b) => b.filas - a.filas);

  // Asignaciones de chofer: solo sobre los fletes NO cargados (los creables). Los
  // que se completan ya tienen su chofer del viaje cargado a mano.
  const nombresVistos = new Map<string, ChoferAsignacion>();
  const ambiguos: { nombreLoma: string; candidatos: { id: string; label: string }[] }[] = [];
  const missing: string[] = [];
  for (const r of rows) {
    if (r.status !== "no_cargado") continue;
    const nombre = r.choferNombre;
    const key = normName(nombre);
    if (nombresVistos.has(key)) continue;
    const m = matchDe(nombre);
    nombresVistos.set(key, { nombreLoma: nombre, chofer_id: m.status === "ok" ? m.id : null });
    if (m.status === "ambiguo") ambiguos.push({ nombreLoma: nombre, candidatos: m.candidatos });
    if (m.status === "missing" && nombre) missing.push(nombre);
  }

  const completarRows = rows.filter((r) => r.status === "completar");
  const summary = {
    totalFilas: rows.length,
    completar: completarRows.length,
    yaConValor: rows.filter((r) => r.status === "ya_con_valor").length,
    noCargados: rows.filter((r) => r.status === "no_cargado").length,
    totalImporteCompletar: completarRows.reduce((acc, r) => acc + (r.importe ?? 0), 0),
  };

  return {
    ok: true,
    rows,
    expedidores,
    asignaciones: [...nombresVistos.values()],
    choferesAmbiguos: ambiguos,
    choferesMissing: missing,
    choferesDisponibles: choferes
      .map((c) => ({
        id: c.id,
        label: `${c.apellido}, ${c.nombre}${c.estado === "baja" ? " (egresado)" : ""}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    clienteLoma,
    warnings: parsed.warnings,
    summary,
  };
}

// ============================================================================
// CONFIRMACIÓN: completar viajes cargados (+ crear los no cargados si se pide)
// ============================================================================

export type LomaImportInput = {
  expedidoresLoma: string[]; // expedidores marcados como Loma (se procesan)
  asignaciones: ChoferAsignacion[]; // chofer elegido por nombre del Excel (para crear)
  crearNoCargados?: boolean; // crear los fletes sin viaje cargado (default: false)
  // Ediciones manuales de la preview, por Nº de transporte (normId): el operador
  // pudo corregir toneladas / importe antes de confirmar.
  ediciones?: Record<string, { ton: number | null; importe: number | null }>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function runLomaImport(
  supabase: AdminDb,
  buffer: Buffer,
  input: LomaImportInput,
  userId: string,
  opts?: { archivo?: string },
): Promise<NonNullable<ConfirmLomaData>> {
  let parsed: ReturnType<typeof parseLomaXlsx>;
  try {
    parsed = parseLomaXlsx(buffer);
  } catch (e) {
    console.error("Error parseando liquidación Loma (confirm):", e);
    return { error: "No se pudo leer el Excel." };
  }

  const expedidoresLoma = new Set(input.expedidoresLoma);
  const crearNoCargados = !!input.crearNoCargados;
  const asignPorNombre = new Map(
    input.asignaciones.map((a) => [normName(a.nombreLoma), a.chofer_id] as const),
  );

  const indices = await loadViajesIndices(supabase, parsed.rows);

  // Solo procesamos fletes de Loma; los de terceros no se tocan.
  const incluidas = parsed.rows.filter((r) =>
    expedidoresLoma.has(r.expedidor || "(sin expedidor)"),
  );
  const tercerosOmitidos = parsed.rows.length - incluidas.length;

  type Clasificada = { row: LomaRow; match: ViajeRow | null; status: FleteStatus };
  const clasificadas: Clasificada[] = incluidas.map((row) => {
    const match = matchFleteLoma(row, indices);
    return { row, match, status: clasificarFleteLoma(match) };
  });

  const aCompletar = clasificadas.filter((c) => c.status === "completar" && c.match);
  const noCargadas = clasificadas.filter((c) => c.status === "no_cargado");
  const yaConValor = clasificadas.filter((c) => c.status === "ya_con_valor").length;

  // Período + total para archivar (sobre lo que efectivamente se importa).
  let fechaMin: string | null = null;
  let fechaMax: string | null = null;
  let importeTotal = 0;
  const trackPeriodo = (f: string | null) => {
    if (!f) return;
    if (fechaMin === null || f < fechaMin) fechaMin = f;
    if (fechaMax === null || f > fechaMax) fechaMax = f;
  };
  const fuentesArchivo = crearNoCargados ? [...aCompletar, ...noCargadas] : aCompletar;
  for (const c of fuentesArchivo) {
    importeTotal += c.row.importe ?? 0;
    trackPeriodo(c.row.fechaFin ?? c.row.fecha);
  }

  // Archivar el Excel en Compliance → Loma para tener el liqId y estamparlo.
  let liqId: string | null = null;
  let archivado = false;
  const totalImportadas = aCompletar.length + (crearNoCargados ? noCargadas.length : 0);
  if (totalImportadas > 0) {
    try {
      liqId = await archivarLiquidacionLoma(supabase, buffer, opts?.archivo ?? null, userId, {
        periodoDesde: fechaMin,
        periodoHasta: fechaMax,
        total: round2(importeTotal),
        fletes: totalImportadas,
      });
      archivado = !!liqId;
    } catch (e) {
      console.error("No se pudo archivar la liquidación Loma (igual se procesa):", e);
    }
  }

  // ── 1) COMPLETAR los viajes cargados sin valor ───────────────────────────
  const ediciones = input.ediciones ?? {};
  let completados = 0;
  const completedIds = new Set<string>();
  const auditRows: Record<string, unknown>[] = [];
  for (const c of aCompletar) {
    const v = c.match!;
    if (completedIds.has(v.id)) continue; // el mismo viaje no se completa dos veces
    const r = c.row;
    // Valores efectivos: los editados a mano en la preview pisan a los del Excel.
    const ed = ediciones[normId(r.nroTransporte)];
    const importe = ed && ed.importe !== undefined ? ed.importe : r.importe;
    const ton = ed && ed.ton !== undefined ? ed.ton : r.tonelaje;

    const update: Record<string, unknown> = {
      monto_flete: importe,
      // El valor de Loma certifica el flete → queda facturado (igual que el DM de YPF).
      facturado: viajeEstaFacturado(importe, !!v.es_vacio),
      estado: importe == null ? "pendiente" : "cerrado",
      // Estampamos la identidad oficial del flete para futuros cruces.
      nro_transporte: r.nroTransporte,
    };
    // No pisamos lo cargado a mano: tonelaje y km solo si faltan (km oficiales prevalecen).
    if (v.tonelaje_real == null && ton != null) update.tonelaje_real = ton;
    if ((v.km_con_carga == null || v.km_con_carga === 0) && r.kmTotal != null) {
      update.km_con_carga = Math.round(r.kmTotal);
    }
    if (liqId) update.liq_loma_id = liqId;

    const { error } = await supabase.from("viajes").update(update).eq("id", v.id);
    if (error) {
      console.error("Error completando viaje Loma:", v.codigo, error);
      continue;
    }
    completados++;
    completedIds.add(v.id);
    auditRows.push({
      usuario_id: userId,
      accion: "completar_liq_loma",
      entidad_tipo: "viaje",
      entidad_id: v.id,
      valores_anteriores: {
        monto_flete: v.monto_flete,
        tonelaje_real: v.tonelaje_real,
        km_con_carga: v.km_con_carga,
      },
      valores_nuevos: {
        monto_flete: importe,
        nro_transporte: r.nroTransporte,
        facturado: update.facturado,
        remito: r.remito,
        liq_loma_id: liqId,
      },
    });
  }

  // ── 2) CREAR los no cargados (opcional, default off) ──────────────────────
  let creados = 0;
  let sinFecha = 0;
  let sinChofer = 0;
  let puntosCreados = 0;
  if (crearNoCargados && noCargadas.length > 0) {
    const [clienteLomaId, tipoCargaId, puntos, camionesRaw, ultimoCodigo] = await Promise.all([
      getOrCreateLomaCliente(supabase, userId),
      getOrCreateTipoCarga(supabase, "Otros"),
      preloadPuntos(supabase),
      supabase.from("camiones").select("id, patente"),
      getLastCodigo(supabase, `V-${new Date().getFullYear()}-`),
    ]);

    const camionPorPatente = new Map<string, string>();
    for (const cm of (camionesRaw.data ?? []) as { id: string; patente: string }[]) {
      camionPorPatente.set(normPatente(cm.patente), cm.id);
    }

    const yearPrefix = `V-${new Date().getFullYear()}-`;
    let codigoSeq = ultimoCodigo;
    const seenTransporte = new Set<string>();
    const viajesPayload: Record<string, unknown>[] = [];

    for (const c of noCargadas) {
      const r = c.row;
      // Dedup dentro del propio archivo.
      if (r.nroTransporte && seenTransporte.has(r.nroTransporte)) continue;
      if (r.nroTransporte) seenTransporte.add(r.nroTransporte);
      if (!r.fecha) {
        sinFecha++;
        continue;
      }

      const choferId = asignPorNombre.get(normName(r.choferNombre)) ?? null;
      if (!choferId) sinChofer++;

      const importe = r.importe;
      const facturado = viajeEstaFacturado(importe);
      const fechaViaje = r.fechaFin ?? r.fecha; // cierre del transporte; si falta, el inicio
      const acoplados = r.acoplados.length > 0 ? r.acoplados : null;

      const origenId = await ensurePunto(supabase, puntos, r.expedidor, () => puntosCreados++, {
        localidad: r.origenLoc,
        provincia: r.origenProv,
      });
      const destinoId = await ensurePunto(supabase, puntos, r.destinatario, () => puntosCreados++, {
        localidad: r.destinoLoc,
        provincia: r.destinoProv,
      });
      const camionId = r.chasis ? camionPorPatente.get(normPatente(r.chasis)) ?? null : null;

      codigoSeq++;
      viajesPayload.push({
        id: crypto.randomUUID(),
        codigo: `${yearPrefix}${String(codigoSeq).padStart(5, "0")}`,
        fecha_viaje: fechaViaje,
        cliente_id: clienteLomaId,
        chofer_id: choferId,
        camion_id: camionId,
        tipo_carga_id: tipoCargaId,
        origen_id: origenId,
        destino_id: destinoId,
        km_con_carga: r.kmTotal != null ? Math.round(r.kmTotal) : 0,
        km_vacios: 0, // Loma no informa el tramo vacío (columna entera)
        tonelaje_real: r.tonelaje,
        monto_flete: importe,
        nro_remito: r.remito,
        nro_transporte: r.nroTransporte,
        fecha_salida: r.fecha,
        fecha_llegada: r.fechaFin,
        acoplados,
        material: r.material,
        es_vacio: false,
        moneda: r.moneda || "ARS",
        estado: importe == null ? "pendiente" : "cerrado",
        facturado,
        liq_loma_id: liqId,
        observaciones: [
          `[Import Loma · Nº transporte ${r.nroTransporte}]`,
          r.material ? `Material: ${r.material}` : null,
          `Exp: ${r.expedidor} → ${r.destinatario}`,
        ]
          .filter(Boolean)
          .join(" · "),
        created_by: userId,
      });
    }

    for (let i = 0; i < viajesPayload.length; i += 500) {
      const lote = viajesPayload.slice(i, i + 500);
      const { data: inserted, error } = await supabase.from("viajes").insert(lote).select("id");
      if (error) {
        console.error("Error insertando viajes Loma:", error);
        return {
          error: `Error al insertar viajes (lote ${i / 500 + 1}, ${creados} ya insertados): ${error.message}`,
        };
      }
      creados += inserted?.length ?? 0;
    }
  }

  // ── Auditoría ─────────────────────────────────────────────────────────────
  if (auditRows.length > 0) {
    for (let i = 0; i < auditRows.length; i += 500) {
      await supabase.from("audit_log").insert(auditRows.slice(i, i + 500));
    }
  }
  await supabase.from("audit_log").insert({
    usuario_id: userId,
    accion: "importar",
    entidad_tipo: "viaje",
    entidad_id: null,
    valores_nuevos: {
      origen: "liquidacion_loma",
      archivo: opts?.archivo ?? null,
      liq_loma_id: liqId,
      completados,
      ya_con_valor: yaConValor,
      no_cargados: noCargadas.length,
      creados,
      terceros_omitidos: tercerosOmitidos,
    },
  });

  return {
    ok: true,
    imported: {
      completados,
      yaConValor,
      noCargados: noCargadas.length,
      creados,
      tercerosOmitidos,
      sinFecha,
      sinChofer,
      puntosCreados,
      archivado,
      liqId,
    },
  };
}

// ============================================================================
// Helpers de DB
// ============================================================================

/**
 * Sube el Excel original a storage y crea la fila en compliance_liq_loma para que
 * aparezca en Compliance → Loma (mismo patrón que el DM de YPF). Devuelve el id de
 * la liquidación, o lanza si falla la subida (el caller lo cachea: los viajes igual
 * se procesan, solo no quedan vinculados al archivo).
 */
const LOMA_BUCKET = "documentos-personal";

async function archivarLiquidacionLoma(
  supabase: AdminDb,
  buffer: Buffer,
  archivoNombre: string | null,
  userId: string,
  meta: { periodoDesde: string | null; periodoHasta: string | null; total: number; fletes: number },
): Promise<string | null> {
  const nombre = archivoNombre || "liquidacion-loma.xlsx";
  // Path seguro: sin espacios ni caracteres raros del nombre original de Loma.
  const safe = nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `liquidaciones-loma/${Date.now()}_${safe}`;

  const { error: upErr } = await supabase.storage
    .from(LOMA_BUCKET)
    .upload(path, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
  if (upErr) throw new Error(`No se pudo subir el Excel: ${upErr.message}`);

  const { data: archivo, error: archErr } = await supabase
    .from("documentos_archivos")
    .insert({
      bucket: LOMA_BUCKET,
      nombre_original: nombre,
      path,
      tamano_bytes: buffer.length,
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      subido_por: userId,
    })
    .select("id")
    .single();
  if (archErr || !archivo) throw new Error("No se pudo registrar el archivo de la liquidación.");

  const { data: liq, error: liqErr } = await supabase
    .from("compliance_liq_loma")
    .insert({
      periodo_desde: meta.periodoDesde,
      periodo_hasta: meta.periodoHasta,
      total_importe_ars: meta.total,
      fletes_count: meta.fletes,
      archivo_id: archivo.id,
      importado_por: userId,
    })
    .select("id")
    .single();
  if (liqErr || !liq) throw new Error("No se pudo registrar la liquidación de Loma.");

  return liq.id as string;
}

async function findLomaCliente(
  supabase: AdminDb,
): Promise<{ id: string; label: string } | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id, razon_social, nombre_comercial")
    .or("razon_social.ilike.%loma negra%,nombre_comercial.ilike.%loma negra%")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, label: data.nombre_comercial || data.razon_social };
}

async function getOrCreateLomaCliente(supabase: AdminDb, userId: string): Promise<string> {
  const existing = await findLomaCliente(supabase);
  if (existing) return existing.id;
  const { data } = await supabase
    .from("clientes")
    .insert({
      razon_social: "LOMA NEGRA CIASA",
      nombre_comercial: "LOMA NEGRA S.A",
      condicion_iva: "responsable_inscripto",
      estado: "activo",
      created_by: userId,
    })
    .select("id")
    .single();
  return data.id;
}

async function getOrCreateTipoCarga(supabase: AdminDb, nombre: string): Promise<string> {
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
  loc?: { localidad?: string | null; provincia?: string | null },
): Promise<string | null> {
  const clean = nombre?.trim();
  if (!clean) return null;
  const key = normName(clean);
  const existing = map.get(key);
  if (existing) return existing; // no piso datos de puntos ya cargados
  const { data, error } = await supabase
    .from("puntos_ruta")
    .insert({
      nombre: clean,
      estado: "activo",
      tipo: "otro",
      localidad: loc?.localidad || null,
      provincia: loc?.provincia || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear punto "${clean}": ${error.message}`);
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
