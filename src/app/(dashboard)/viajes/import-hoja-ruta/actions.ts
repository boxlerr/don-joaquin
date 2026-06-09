"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  parseHojaRutaXlsx,
  tonelajeDe,
  esViajeVacio,
  type HrSheetParsed,
} from "./parser-hoja-ruta";

// ============================================================================
// Tipos del preview
// ============================================================================

export type ChoferMatch =
  | { status: "ok"; id: string; apellido: string; nombre: string }
  | { status: "ambiguo"; candidatos: { id: string; label: string }[] }
  | { status: "missing"; sheetName: string };

// Viaje individual para mostrar al desplegar una pestaña en el preview.
export type SheetViajePreview = {
  fecha: string;
  saleDe: string;
  llegaA: string;
  remito: string | null;
  material: string | null;
  ton: number | null;
  importe: number | null;
  vacio: boolean;
  dup: boolean; // ya estaba importado (no se vuelve a cargar)
};

export type SheetPreview = {
  sheetName: string;
  patentes: string[];
  chofer: ChoferMatch;
  total: number; // viajes parseados
  vacios: number; // viajes vacíos
  conRemito: number;
  pendientesFacturar: number; // remito sí, importe no
  yaImportados: number; // dedup contra DB (cliente YPF u otro)
  sumaImporte: number;
  sumaTon: number;
  sumaKm: number;
  sumaKmVacios: number;
  warnings: string[];
  viajes: SheetViajePreview[]; // detalle para desplegar
};

export type HojaRutaPreviewState = {
  ok?: boolean;
  error?: string;
  sheets?: SheetPreview[];
  summary?: {
    totalSheets: number;
    sheetsOk: number;
    sheetsConWarning: number;
    sheetsConError: number;
    totalViajes: number;
    totalImportables: number; // viajes que entrarían
    totalDuplicados: number;
    totalImporte: number;
  };
  warnings?: string[];
  // Mapeo manual chofer→sheet, en caso de ambigüedad. Se inicializa con
  // la decisión automática y el usuario puede ajustarlo en el preview.
  asignaciones?: AsignacionSheet[];
  // Lista de choferes para el selector manual del preview (resolver ambiguos/missing).
  choferesDisponibles?: { id: string; label: string }[];
} | null;

export type AsignacionSheet = {
  sheetName: string;
  chofer_id: string | null; // null = saltear este sheet
};

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewHojaRutaImportAction(
  formData: FormData,
): Promise<HojaRutaPreviewState> {
  await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá el archivo .xlsx para analizarlo." };
  }

  let parsed;
  try {
    parsed = parseHojaRutaXlsx(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("Error parseando HOJA DE RUTA:", e);
    return { error: "No se pudo leer el Excel (¿es el formato correcto?)." };
  }

  const supabase = createAdminClient();

  // Todos los choferes (incluidos egresados/baja): la HOJA DE RUTA es histórica,
  // así que un chofer que ya egresó pero manejó en el período debe poder matchear.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: choferesRaw } = await (supabase as any)
    .from("choferes")
    .select("id, apellido, nombre, cuil, estado");

  const choferes = (choferesRaw ?? []) as {
    id: string;
    apellido: string;
    nombre: string;
    cuil: string | null;
    estado: string;
  }[];

  // Viajes ya importados (todos los del rango de fechas del Excel) para dedup.
  // Usamos un set por (chofer_id|fecha|remito) cuando hay remito y por
  // (chofer_id|fecha|ton) cuando no hay (caso poco común).
  const todasLasFechas = parsed.sheets
    .flatMap((s) => s.viajes.map((v) => v.fecha))
    .filter((f): f is string => !!f);
  let fechaMin = "9999-12-31", fechaMax = "0000-01-01";
  for (const f of todasLasFechas) {
    if (f < fechaMin) fechaMin = f;
    if (f > fechaMax) fechaMax = f;
  }

  const existentes = new Set<string>();
  if (todasLasFechas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ex } = await (supabase as any)
      .from("viajes")
      .select("chofer_id, fecha_viaje, nro_remito, tonelaje_real")
      .gte("fecha_viaje", fechaMin)
      .lte("fecha_viaje", fechaMax)
      .not("chofer_id", "is", null);
    for (const v of (ex ?? []) as {
      chofer_id: string;
      fecha_viaje: string;
      nro_remito: string | null;
      tonelaje_real: number | null;
    }[]) {
      existentes.add(dedupKey(v.chofer_id, v.fecha_viaje, v.nro_remito, v.tonelaje_real));
    }
  }

  // Resolver TODAS las pestañas de una (determinístico, por nombre + eliminación)
  const matchPorSheet = resolverAsignaciones(parsed.sheets, choferes);

  // Procesar cada sheet
  const sheets: SheetPreview[] = [];
  for (const sp of parsed.sheets) {
    sheets.push(buildSheetPreview(sp, matchPorSheet.get(sp.sheetName)!, existentes));
  }

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
  };

  const asignaciones: AsignacionSheet[] = sheets.map((s) => ({
    sheetName: s.sheetName,
    chofer_id: s.chofer.status === "ok" ? s.chofer.id : null,
  }));

  return {
    ok: true,
    sheets,
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

// ============================================================================
// CONFIRMACIÓN: insertar viajes
// ============================================================================

export type ConfirmHojaRutaState = {
  ok?: boolean;
  error?: string;
  imported?: {
    viajes: number;
    pendientesFacturar: number; // creados con monto NULL
    duplicados: number;
    omitidos: number; // sin chofer / sin asignación
    puntosCreados: number;
    sheetsConfirmados: number;
  };
} | null;

export async function confirmHojaRutaImportAction(
  formData: FormData,
): Promise<ConfirmHojaRutaState> {
  const user = await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Volvé a adjuntar el archivo para confirmar la carga." };
  }
  const asignacionesRaw = formData.get("asignaciones");
  if (typeof asignacionesRaw !== "string") {
    return { error: "Faltan las asignaciones chofer-sheet del preview." };
  }
  let asignaciones: AsignacionSheet[];
  try {
    asignaciones = JSON.parse(asignacionesRaw);
  } catch {
    return { error: "Asignaciones inválidas." };
  }
  const asignPorSheet = new Map(asignaciones.map((a) => [a.sheetName, a.chofer_id]));

  let parsed;
  try {
    parsed = parseHojaRutaXlsx(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("Error parseando HOJA DE RUTA (confirm):", e);
    return { error: "No se pudo leer el Excel." };
  }

  const supabase = createAdminClient();

  // Cargar choferes para mapear chofer→camión actual
  const [{ data: camionesRaw }, clienteSinAsignarId, tipoCargaIdGenerico, puntosMap, ultimoCodigo] =
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("camiones")
        .select("id, patente, chofer_actual_id"),
      getOrCreateCliente(supabase, user.id, "Sin asignar (import)"),
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

  // Pre-cargar dedup
  const todasLasFechas = parsed.sheets.flatMap((s) => s.viajes.map((v) => v.fecha));
  let fechaMin = "9999-12-31", fechaMax = "0000-01-01";
  for (const f of todasLasFechas) {
    if (f < fechaMin) fechaMin = f;
    if (f > fechaMax) fechaMax = f;
  }
  const existentes = new Set<string>();
  if (todasLasFechas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ex } = await (supabase as any)
      .from("viajes")
      .select("chofer_id, fecha_viaje, nro_remito, tonelaje_real")
      .gte("fecha_viaje", fechaMin)
      .lte("fecha_viaje", fechaMax)
      .not("chofer_id", "is", null);
    for (const v of (ex ?? []) as {
      chofer_id: string;
      fecha_viaje: string;
      nro_remito: string | null;
      tonelaje_real: number | null;
    }[]) {
      existentes.add(dedupKey(v.chofer_id, v.fecha_viaje, v.nro_remito, v.tonelaje_real));
    }
  }

  let codigoSeq = ultimoCodigo;
  let puntosCreados = 0;
  let duplicados = 0;
  let omitidos = 0;
  let pendientesFacturar = 0;
  let sheetsConfirmados = 0;
  const seenThisRun = new Set<string>();
  const viajesPayload: Record<string, unknown>[] = [];

  // Importar sheets unificando los que apuntan al mismo chofer
  const yearPrefix = `V-${new Date().getFullYear()}-`;

  for (const sp of parsed.sheets) {
    const choferId = asignPorSheet.get(sp.sheetName);
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
      const vacio = esViajeVacio(v);
      const ton = tonelajeDe(v);

      // Dedup SOLO para viajes con remito real (el remito es la clave única).
      // Los viajes VACÍOS no tienen remito → no se pueden diferenciar entre sí y
      // antes se pisaban (varios vacíos del mismo día/chofer = 1). Ahora se cargan
      // todos: un vacío no puede ser "duplicado" de otro.
      if (!vacio) {
        const key = dedupKey(choferId, v.fecha, v.remito, ton);
        if (existentes.has(key) || seenThisRun.has(key)) {
          duplicados++;
          continue;
        }
        seenThisRun.add(key);
      }

      const remitoNormalizado = vacio ? null : v.remito;
      const importeFinal = vacio ? 0 : v.importe; // NULL si esperando remito

      if (!vacio && importeFinal == null) pendientesFacturar++;

      // Puntos origen/destino
      const origenId = await ensurePunto(supabase, puntosMap, v.saleDe, () => puntosCreados++);
      const destinoId = await ensurePunto(supabase, puntosMap, v.llegaA, () => puntosCreados++);

      codigoSeq++;
      viajesPayload.push({
        id: randomUUID(),
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
        es_vacio: vacio,
        moneda: "ARS",
        estado: importeFinal == null ? "pendiente" : "cerrado",
        // Regla del cliente: el viaje tiene valor solo cuando entra el remito y se
        // factura → tener monto > 0 significa facturado. Vacíos (0) y "esperando
        // remito" (null) quedan sin facturar.
        facturado: (importeFinal ?? 0) > 0,
        observaciones: [
          `[Import HOJA DE RUTA · ${sp.sheetName}]`,
          v.material ? `Material: ${v.material}` : null,
          vacio ? "VIAJE VACÍO" : null,
        ].filter(Boolean).join(" · "),
        created_by: user.id,
      });
    }
  }

  if (viajesPayload.length === 0) {
    return {
      ok: true,
      imported: {
        viajes: 0, pendientesFacturar, duplicados, omitidos, puntosCreados, sheetsConfirmados,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("viajes")
    .insert(viajesPayload)
    .select("id");

  if (error) {
    console.error("Error insertando HOJA DE RUTA:", error);
    return { error: `Error al insertar viajes: ${error.message}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    usuario_id: user.id,
    accion: "importar_hoja_ruta",
    entidad_tipo: "viaje",
    entidad_id: null,
    valores_nuevos: {
      archivo: file.name,
      viajes_creados: inserted?.length ?? 0,
      pendientes_facturar: pendientesFacturar,
      duplicados,
      omitidos,
      sheets: sheetsConfirmados,
    },
  });

  revalidatePath("/viajes");
  revalidatePath("/viajes/hoja-ruta");

  return {
    ok: true,
    imported: {
      viajes: inserted?.length ?? 0,
      pendientesFacturar,
      duplicados,
      omitidos,
      puntosCreados,
      sheetsConfirmados,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

type Admin = ReturnType<typeof createAdminClient>;

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function normPatente(s: string): string {
  return s.replace(/\s|-/g, "").toUpperCase();
}

function dedupKey(
  choferId: string,
  fecha: string,
  remito: string | null,
  ton: number | null,
): string {
  // El remito es la clave única natural; cuando no existe (vacío) usamos
  // tonelaje como fallback. Si tampoco hay, usamos un marcador especial.
  if (remito && remito.toUpperCase() !== "VACIO") {
    return `${choferId}|${fecha}|R:${remito.trim()}`;
  }
  if (ton != null) return `${choferId}|${fecha}|T:${ton.toFixed(2)}`;
  return `${choferId}|${fecha}|VACIO`;
}

// ---------------------------------------------------------------------------
// Matching chofer ↔ sheet name
// ---------------------------------------------------------------------------

type ChoferRow = {
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
function resolverAsignaciones(
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

function buildSheetPreview(
  sp: HrSheetParsed,
  chofer: ChoferMatch,
  existentes: Set<string>,
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
  const viajes: SheetViajePreview[] = [];

  for (const v of sp.viajes) {
    const ton = tonelajeDe(v);
    const vacio = esViajeVacio(v);
    sumaImporte += v.importe ?? 0;
    sumaTon += ton ?? 0;
    sumaKm += v.kmRec ?? 0;
    sumaKmVacios += v.kmVacios ?? 0;
    if (vacio) vacios++;
    else conRemito++;
    if (!vacio && v.importe == null) pendientes++;
    let dup = false;
    if (chofer.status === "ok") {
      const key = dedupKey(chofer.id, v.fecha, v.remito, ton);
      if (existentes.has(key)) {
        yaImportados++;
        dup = true;
      }
    }
    viajes.push({
      fecha: v.fecha,
      saleDe: v.saleDe,
      llegaA: v.llegaA,
      remito: vacio ? null : v.remito,
      material: v.material,
      ton,
      importe: vacio ? 0 : v.importe,
      vacio,
      dup,
    });
  }

  if (sp.filasIgnoradas > 0) {
    warnings.push(`${sp.filasIgnoradas} filas no son viajes (totales / gastos pegados).`);
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
    sumaImporte,
    sumaTon,
    sumaKm,
    sumaKmVacios,
    warnings,
    viajes,
  };
}

// ---------------------------------------------------------------------------
// Helpers de DB (mismos que en el importador YPF)
// ---------------------------------------------------------------------------

async function getOrCreateCliente(
  supabase: Admin,
  userId: string,
  razon: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb
    .from("clientes")
    .select("id")
    .ilike("razon_social", razon)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  // El placeholder "Sin asignar (import)" es un comodín de sistema: nace inactivo
  // para no aparecer como cliente seleccionable. Cualquier otro cliente, activo.
  const esPlaceholder = razon.trim().toLowerCase() === "sin asignar (import)";
  const { data } = await sb
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
  supabase: Admin,
  nombre: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb
    .from("tipos_carga")
    .select("id")
    .ilike("nombre", nombre)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data } = await sb
    .from("tipos_carga")
    .insert({ nombre, estado: "activo" })
    .select("id")
    .single();
  return data.id;
}

async function preloadPuntos(supabase: Admin): Promise<Map<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("puntos_ruta")
    .select("id, nombre");
  const map = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; nombre: string }[]) {
    map.set(normName(r.nombre), r.id);
  }
  return map;
}

async function ensurePunto(
  supabase: Admin,
  map: Map<string, string>,
  nombre: string,
  onCreate: () => void,
): Promise<string> {
  const key = normName(nombre);
  const existing = map.get(key);
  if (existing) return existing;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("puntos_ruta")
    .insert({ nombre, estado: "activo", tipo: "otro" })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear punto "${nombre}": ${error.message}`);
  map.set(key, data.id);
  onCreate();
  return data.id;
}

async function getLastCodigo(supabase: Admin, prefix: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
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
