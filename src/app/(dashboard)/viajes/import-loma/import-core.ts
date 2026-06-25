// Núcleo del importador de la "Liquidación de Fletes" de Loma Negra (sin
// "use server"). Toda la lógica de matching, clasificación, dedup/enrich y
// escritura vive acá para que la puedan usar tanto los server actions (con auth)
// como scripts de mantenimiento.
//
// Diferencias con el importador de la HOJA DE RUTA interna:
//   - Identidad del flete: `nro_transporte` (único, siempre presente).
//   - Cliente: Loma Negra para los fletes propios de Loma (clasificación por
//     expedidor). Los fletes de terceros NO se tocan (no se importan).
//   - Enrich: si el remito ya existe como viaje (cargado por la hoja interna),
//     se completa con los datos oficiales en vez de duplicar.

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

export type RowStatus = "nuevo" | "enriquecer" | "duplicado";

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
  status: RowStatus;
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
    nuevos: number;
    enriquecer: number;
    duplicados: number;
    totalImporteLoma: number;
  };
} | null;

export type ConfirmLomaData = {
  ok?: boolean;
  error?: string;
  imported?: {
    creados: number;
    enriquecidos: number;
    duplicados: number;
    tercerosOmitidos: number;
    sinFecha: number;
    sinChofer: number;
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
// Existentes: dedup por nro_transporte, enrich por remito
// ============================================================================

type Existentes = {
  transportes: Set<string>; // nro_transporte ya cargados
  remitoToViaje: Map<string, { id: string; tieneTransporte: boolean }>;
};

async function loadExistentes(supabase: AdminDb, rows: LomaRow[]): Promise<Existentes> {
  const transportes = new Set<string>();
  const remitoToViaje = new Map<string, { id: string; tieneTransporte: boolean }>();

  const fechas = rows.map((r) => r.fecha).filter((f): f is string => !!f);
  if (fechas.length === 0) return { transportes, remitoToViaje };
  let fechaMin = "9999-12-31";
  let fechaMax = "0000-01-01";
  for (const f of fechas) {
    if (f < fechaMin) fechaMin = f;
    if (f > fechaMax) fechaMax = f;
  }

  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("viajes")
      .select("id, nro_remito, nro_transporte")
      .gte("fecha_viaje", fechaMin)
      .lte("fecha_viaje", fechaMax)
      .range(from, from + 999);
    const batch = (data ?? []) as {
      id: string;
      nro_remito: string | null;
      nro_transporte: string | null;
    }[];
    for (const v of batch) {
      if (v.nro_transporte) transportes.add(v.nro_transporte);
      if (v.nro_remito && !remitoToViaje.has(v.nro_remito)) {
        remitoToViaje.set(v.nro_remito, { id: v.id, tieneTransporte: !!v.nro_transporte });
      }
    }
    if (batch.length < 1000) break;
  }
  return { transportes, remitoToViaje };
}

function clasificarStatus(r: LomaRow, ex: Existentes): RowStatus {
  if (r.nroTransporte && ex.transportes.has(r.nroTransporte)) return "duplicado";
  if (r.remito) {
    const m = ex.remitoToViaje.get(r.remito);
    if (m && !m.tieneTransporte) return "enriquecer";
  }
  return "nuevo";
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
  const existentes = await loadExistentes(supabase, parsed.rows);

  // Cache de match por nombre (muchas filas comparten chofer).
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
      status: clasificarStatus(r, existentes),
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

  // Asignaciones de chofer (una por nombre distinto del Excel).
  const nombresVistos = new Map<string, ChoferAsignacion>();
  const ambiguos: { nombreLoma: string; candidatos: { id: string; label: string }[] }[] = [];
  const missing: string[] = [];
  for (const r of parsed.rows) {
    const nombre = r.choferNombre;
    const key = normName(nombre);
    if (nombresVistos.has(key)) continue;
    const m = matchDe(nombre);
    nombresVistos.set(key, {
      nombreLoma: nombre,
      chofer_id: m.status === "ok" ? m.id : null,
    });
    if (m.status === "ambiguo") ambiguos.push({ nombreLoma: nombre, candidatos: m.candidatos });
    if (m.status === "missing" && nombre) missing.push(nombre);
  }

  // Resumen solo sobre filas DE LOMA (las que por defecto se importan).
  const lomaExpedidores = new Set(expedidores.filter((e) => e.esLomaDefault).map((e) => e.nombre));
  const lomaRows = rows.filter((r) => lomaExpedidores.has(r.expedidor || "(sin expedidor)"));
  const summary = {
    totalFilas: rows.length,
    nuevos: lomaRows.filter((r) => r.status === "nuevo").length,
    enriquecer: lomaRows.filter((r) => r.status === "enriquecer").length,
    duplicados: lomaRows.filter((r) => r.status === "duplicado").length,
    totalImporteLoma: lomaRows.reduce((acc, r) => acc + (r.importe ?? 0), 0),
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
// CONFIRMACIÓN: crear / enriquecer viajes
// ============================================================================

export type LomaImportInput = {
  expedidoresLoma: string[]; // expedidores marcados como Loma (se importan)
  asignaciones: ChoferAsignacion[]; // chofer elegido por nombre del Excel
};

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
  const asignPorNombre = new Map(
    input.asignaciones.map((a) => [normName(a.nombreLoma), a.chofer_id] as const),
  );

  const [clienteLomaId, tipoCargaId, puntos, camionesRaw, ultimoCodigo] = await Promise.all([
    getOrCreateLomaCliente(supabase, userId),
    getOrCreateTipoCarga(supabase, "Otros"),
    preloadPuntos(supabase),
    supabase.from("camiones").select("id, patente"),
    getLastCodigo(supabase, `V-${new Date().getFullYear()}-`),
  ]);

  const camionPorPatente = new Map<string, string>();
  for (const c of (camionesRaw.data ?? []) as { id: string; patente: string }[]) {
    camionPorPatente.set(normPatente(c.patente), c.id);
  }

  const existentes = await loadExistentes(supabase, parsed.rows);
  const yearPrefix = `V-${new Date().getFullYear()}-`;
  let codigoSeq = ultimoCodigo;

  let creados = 0;
  let enriquecidos = 0;
  let duplicados = 0;
  let tercerosOmitidos = 0;
  let sinFecha = 0;
  let sinChofer = 0;
  let puntosCreados = 0;
  const seenTransporte = new Set<string>();
  const viajesPayload: Record<string, unknown>[] = [];
  // Para la liquidación archivada: ids enriquecidos a estampar + totales/período.
  const enrichedIds: string[] = [];
  let importeTotal = 0;
  let fechaMin: string | null = null;
  let fechaMax: string | null = null;
  const trackPeriodo = (f: string | null) => {
    if (!f) return;
    if (fechaMin === null || f < fechaMin) fechaMin = f;
    if (fechaMax === null || f > fechaMax) fechaMax = f;
  };

  for (const r of parsed.rows) {
    const expKey = r.expedidor || "(sin expedidor)";
    if (!expedidoresLoma.has(expKey)) {
      tercerosOmitidos++;
      continue; // flete de tercero: no se toca
    }

    // Dedup por nro_transporte (en base o dentro de esta corrida).
    if (
      r.nroTransporte &&
      (existentes.transportes.has(r.nroTransporte) || seenTransporte.has(r.nroTransporte))
    ) {
      duplicados++;
      continue;
    }
    if (r.nroTransporte) seenTransporte.add(r.nroTransporte);

    if (!r.fecha) {
      sinFecha++;
      continue;
    }

    const choferId = asignPorNombre.has(normName(r.choferNombre))
      ? asignPorNombre.get(normName(r.choferNombre))!
      : null;
    if (!choferId) sinChofer++;

    const importe = r.importe;
    const facturado = viajeEstaFacturado(importe);
    // fecha_viaje = cierre del transporte (Fin.act.transp.); si falta, el inicio.
    const fechaViaje = r.fechaFin ?? r.fecha;
    const acoplados = r.acoplados.length > 0 ? r.acoplados : null;

    // Enrich: el remito ya existe como viaje (cargado por la hoja interna) y aún
    // no tiene nro_transporte → completar con los datos oficiales en vez de duplicar.
    if (r.remito) {
      const m = existentes.remitoToViaje.get(r.remito);
      if (m && !m.tieneTransporte) {
        const origenId = await ensurePunto(supabase, puntos, r.expedidor, () => puntosCreados++, {
          localidad: r.origenLoc,
          provincia: r.origenProv,
        });
        const destinoId = await ensurePunto(supabase, puntos, r.destinatario, () => puntosCreados++, {
          localidad: r.destinoLoc,
          provincia: r.destinoProv,
        });
        await supabase
          .from("viajes")
          .update({
            nro_transporte: r.nroTransporte,
            cliente_id: clienteLomaId,
            monto_flete: importe,
            km_con_carga: r.kmTotal != null ? Math.round(r.kmTotal) : undefined,
            tonelaje_real: r.tonelaje ?? undefined,
            origen_id: origenId,
            destino_id: destinoId,
            fecha_salida: r.fecha ?? undefined,
            fecha_llegada: r.fechaFin ?? undefined,
            acoplados,
            facturado,
            estado: importe == null ? "pendiente" : "cerrado",
          })
          .eq("id", m.id);
        m.tieneTransporte = true;
        enriquecidos++;
        enrichedIds.push(m.id);
        importeTotal += importe ?? 0;
        trackPeriodo(fechaViaje);
        continue;
      }
    }

    // Alta nueva.
    const origenId = await ensurePunto(supabase, puntos, r.expedidor, () => puntosCreados++, {
      localidad: r.origenLoc,
      provincia: r.origenProv,
    });
    const destinoId = await ensurePunto(supabase, puntos, r.destinatario, () => puntosCreados++, {
      localidad: r.destinoLoc,
      provincia: r.destinoProv,
    });
    const camionId = r.chasis ? camionPorPatente.get(normPatente(r.chasis)) ?? null : null;

    importeTotal += importe ?? 0;
    trackPeriodo(fechaViaje);
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

  // Archivar el Excel en Compliance → Loma (una fila por liquidación) y vincular
  // los viajes con ella. Si nada se importó, no se archiva nada.
  let liqId: string | null = null;
  let archivado = false;
  const totalImportadas = viajesPayload.length + enrichedIds.length;
  if (totalImportadas > 0) {
    try {
      liqId = await archivarLiquidacionLoma(supabase, buffer, opts?.archivo ?? null, userId, {
        periodoDesde: fechaMin,
        periodoHasta: fechaMax,
        total: Math.round(importeTotal * 100) / 100,
        fletes: totalImportadas,
      });
      archivado = !!liqId;
    } catch (e) {
      console.error("No se pudo archivar la liquidación Loma (los viajes igual se cargan):", e);
    }
  }
  // Estampar el vínculo en las altas antes de insertarlas.
  if (liqId) {
    for (const p of viajesPayload) p.liq_loma_id = liqId;
  }

  // Insertar altas en lotes de 500.
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

  // Estampar el vínculo en los viajes enriquecidos.
  if (liqId && enrichedIds.length > 0) {
    for (let i = 0; i < enrichedIds.length; i += 500) {
      await supabase
        .from("viajes")
        .update({ liq_loma_id: liqId })
        .in("id", enrichedIds.slice(i, i + 500));
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
      creados,
      enriquecidos,
      duplicados,
      terceros_omitidos: tercerosOmitidos,
      sin_chofer: sinChofer,
    },
  });

  return {
    ok: true,
    imported: {
      creados,
      enriquecidos,
      duplicados,
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
 * se cargan, solo no quedan vinculados al archivo).
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
