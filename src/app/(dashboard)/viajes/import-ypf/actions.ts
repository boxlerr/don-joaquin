"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { parseYpfPdf, type YpfTarifa, type YpfViajeRaw } from "./parser-ypf";

// ============================================================================
// Tipos del preview
// ============================================================================

export type ChoferResuelto =
  | { status: "ok"; id: string; nombre: string; apellido: string }
  | { status: "inactivo"; id: string; nombre: string; apellido: string; estado: string }
  | { status: "not_found" };
export type CamionResuelto = { status: "ok"; id: string; patente: string } | { status: "missing" };

export type YpfViajePreview = YpfViajeRaw & {
  chofer: ChoferResuelto;
  camion: CamionResuelto;
  yaImportado: boolean;
  importable: boolean;
};

export type YpfPreviewState = {
  ok?: boolean;
  archivo?: string;
  quincenaDesde?: string | null;
  quincenaHasta?: string | null;
  tarifas?: YpfTarifa[];
  viajes?: YpfViajePreview[];
  warnings?: string[];
  summary?: {
    total: number;
    importables: number;
    sinChofer: number;
    sinCamion: number;
    yaImportados: number;
    sinPrecio: number;
    totalTn: number;
    totalImporte: number;
  };
  error?: string;
} | null;

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const importTag = (desde: string | null, hasta: string | null) => `[IMPORT YPF ${desde ?? "?"}..${hasta ?? "?"}]`;
const dedupKey = (choferId: string, fecha: string, neto: number) => `${choferId}|${fecha}|${neto.toFixed(2)}`;

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewYpfImportAction(formData: FormData): Promise<YpfPreviewState> {
  await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá el PDF de YPF." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "El archivo debe ser un PDF." };
  }

  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = await parseYpfPdf(buf);
  } catch (e) {
    console.error("Error parseando PDF de YPF:", e);
    return { error: "No se pudo leer el PDF." };
  }

  const supabase = createAdminClient();
  const [{ data: choferesRaw }, { data: camionesRaw }, existentes] = await Promise.all([
    supabase.from("choferes").select("id, nombre, apellido, cuil, estado"),
    supabase.from("camiones").select("id, patente, chofer_actual_id"),
    loadYaImportados(supabase, parsed.quincenaDesde, parsed.quincenaHasta),
  ]);

  const choferes = (choferesRaw ?? []) as { id: string; nombre: string; apellido: string; cuil: string | null; estado: string }[];
  const camiones = (camionesRaw ?? []) as { id: string; patente: string; chofer_actual_id: string | null }[];

  const choferPorCuil = new Map<string, { id: string; nombre: string; apellido: string; estado: string }>();
  for (const c of choferes) {
    const d = onlyDigits(c.cuil);
    if (d.length === 11) choferPorCuil.set(d, { id: c.id, nombre: c.nombre, apellido: c.apellido, estado: c.estado });
  }
  const camionPorChofer = new Map<string, { id: string; patente: string }>();
  for (const c of camiones) if (c.chofer_actual_id) camionPorChofer.set(c.chofer_actual_id, { id: c.id, patente: c.patente });

  const viajes: YpfViajePreview[] = parsed.viajes.map((v) => {
    const ch = choferPorCuil.get(v.choferCuil);
    let chofer: ChoferResuelto;
    if (!ch) chofer = { status: "not_found" };
    else if (ch.estado === "activo") chofer = { status: "ok", id: ch.id, nombre: ch.nombre, apellido: ch.apellido };
    else chofer = { status: "inactivo", id: ch.id, nombre: ch.nombre, apellido: ch.apellido, estado: ch.estado };

    let camion: CamionResuelto = { status: "missing" };
    let yaImportado = false;
    if (chofer.status === "ok") {
      const cam = camionPorChofer.get(chofer.id);
      if (cam) camion = { status: "ok", ...cam };
      const fecha = v.fechaDescarga ?? parsed.quincenaHasta ?? "";
      if (fecha) yaImportado = existentes.has(dedupKey(chofer.id, fecha, v.netoTn));
    }
    const importable = chofer.status === "ok" && camion.status === "ok" && v.precioUnitario != null && !yaImportado;
    return { ...v, chofer, camion, yaImportado, importable };
  });

  const summary = {
    total: viajes.length,
    importables: viajes.filter((v) => v.importable).length,
    sinChofer: viajes.filter((v) => v.chofer.status !== "ok").length,
    sinCamion: viajes.filter((v) => v.chofer.status === "ok" && v.camion.status === "missing").length,
    yaImportados: viajes.filter((v) => v.yaImportado).length,
    sinPrecio: viajes.filter((v) => v.precioUnitario == null).length,
    totalTn: viajes.reduce((s, v) => s + v.netoTn, 0),
    totalImporte: viajes.reduce((s, v) => s + (v.importable ? v.importe ?? 0 : 0), 0),
  };

  return {
    ok: true,
    archivo: file.name,
    quincenaDesde: parsed.quincenaDesde,
    quincenaHasta: parsed.quincenaHasta,
    tarifas: parsed.tarifas,
    viajes,
    warnings: parsed.warnings,
    summary,
  };
}

// ============================================================================
// CONFIRM — escribe a BDD
// ============================================================================

export type ConfirmYpfState = {
  ok?: boolean;
  imported?: {
    viajes: number;
    omitidos: number;
    puntosCreados: number;
    dmYpfId?: string;
  };
  error?: string;
} | null;

export async function confirmYpfImportAction(formData: FormData): Promise<ConfirmYpfState> {
  const user = await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Adjuntá el PDF para confirmar." };

  let parsed;
  try {
    parsed = await parseYpfPdf(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("Error parseando PDF al confirmar:", e);
    return { error: "No se pudo leer el PDF." };
  }

  const supabase = createAdminClient();
  const [{ data: choferesRaw }, { data: camionesRaw }, existentes, clienteYpfId, tipoCargaId, puntosMap, ultimoCodigo] =
    await Promise.all([
      supabase.from("choferes").select("id, cuil, estado").neq("estado", "baja"),
      supabase.from("camiones").select("id, patente, chofer_actual_id"),
      loadYaImportados(supabase, parsed.quincenaDesde, parsed.quincenaHasta),
      getOrCreateCliente(supabase, user.id, "YPF"),
      getOrCreateTipoCarga(supabase, "Arena granel"),
      preloadPuntos(supabase),
      getLastCodigo(supabase, `V-${new Date().getFullYear()}-`),
    ]);

  const choferes = (choferesRaw ?? []) as { id: string; cuil: string | null }[];
  const camiones = (camionesRaw ?? []) as { id: string; patente: string; chofer_actual_id: string | null }[];
  const choferPorCuil = new Map<string, string>();
  for (const c of choferes) {
    const d = onlyDigits(c.cuil);
    if (d.length === 11) choferPorCuil.set(d, c.id);
  }
  const camionPorChofer = new Map<string, string>();
  for (const c of camiones) if (c.chofer_actual_id) camionPorChofer.set(c.chofer_actual_id, c.id);

  const tag = importTag(parsed.quincenaDesde, parsed.quincenaHasta);
  const yearPrefix = `V-${new Date().getFullYear()}-`;
  let codigoSeq = ultimoCodigo;
  let puntosCreados = 0;
  let omitidos = 0;
  const seenThisRun = new Set<string>();
  const viajesPayload: Record<string, unknown>[] = [];

  for (const v of parsed.viajes) {
    const choferId = choferPorCuil.get(v.choferCuil);
    const fecha = v.fechaDescarga ?? parsed.quincenaHasta ?? null;
    if (!choferId || !fecha || v.precioUnitario == null) { omitidos++; continue; }
    const camionId = camionPorChofer.get(choferId);
    if (!camionId) { omitidos++; continue; }
    const key = dedupKey(choferId, fecha, v.netoTn);
    if (existentes.has(key) || seenThisRun.has(key)) { omitidos++; continue; }
    seenThisRun.add(key);

    // Puntos origen/destino (los trae el parser por viaje) — opcionales
    const destinoId = v.destino ? await ensurePunto(supabase, puntosMap, v.destino, () => puntosCreados++) : null;
    const origenId = v.origen ? await ensurePunto(supabase, puntosMap, v.origen, () => puntosCreados++) : null;

    codigoSeq++;
    viajesPayload.push({
      id: randomUUID(),
      codigo: `${yearPrefix}${String(codigoSeq).padStart(5, "0")}`,
      fecha_viaje: fecha,
      cliente_id: clienteYpfId,
      chofer_id: choferId,
      camion_id: camionId,
      tipo_carga_id: tipoCargaId,
      origen_id: origenId,
      destino_id: destinoId,
      km_con_carga: 0,
      km_vacios: 0,
      tonelaje_real: v.netoTn,
      monto_flete: v.importe ?? 0,
      moneda: "ARS",
      estado: "cerrado",
      facturado: false,
      observaciones: `${tag} Remito: ${v.remito ?? "—"} · Neto: ${v.netoTn} tn · $u: ${v.precioUnitario}`,
      created_by: user.id,
    });
  }

  if (viajesPayload.length === 0) {
    return { ok: true, imported: { viajes: 0, omitidos, puntosCreados } };
  }

  // -- Guardar el DM original en storage + crear el registro compliance_dm_ypf --
  // Esto preserva el PDF firmado por YPF (carátula página 1) junto con el total
  // certificado, para que Bárbara/contador puedan volver a verlo desde
  // /compliance/ypf/dm. Si algo falla acá, igual seguimos importando los viajes
  // sin DM (queda dm_ypf_id=null en esos viajes — no es crítico).
  let dmYpfId: string | null = null;
  try {
    dmYpfId = await guardarDmYpf(supabase, user.id, file, parsed);
  } catch (e) {
    console.error("Error guardando DM YPF en compliance:", e);
    // no return — seguimos con la inserción de viajes
  }

  // Cada viaje queda vinculado al DM que lo certifica
  if (dmYpfId) {
    for (const v of viajesPayload) v.dm_ypf_id = dmYpfId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any).from("viajes").insert(viajesPayload).select("id");
  if (error) {
    console.error("Error insertando viajes YPF:", error);
    return { error: `Error al insertar viajes: ${error.message}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    usuario_id: user.id,
    accion: "importar_ypf",
    entidad_tipo: dmYpfId ? "dm_ypf" : "viaje",
    entidad_id: dmYpfId,
    valores_nuevos: {
      archivo: file.name,
      quincena: `${parsed.quincenaDesde} a ${parsed.quincenaHasta}`,
      viajes_creados: inserted?.length ?? 0,
      omitidos,
      total_certificado_ars: parsed.caratula?.totalCertificadoArs ?? null,
    },
  });

  revalidatePath("/viajes");
  revalidatePath("/compliance/ypf/dm");
  return {
    ok: true,
    imported: {
      viajes: inserted?.length ?? 0,
      omitidos,
      puntosCreados,
      dmYpfId: dmYpfId ?? undefined,
    },
  };
}

/**
 * Sube el PDF a Supabase Storage y crea los registros
 * `documentos_archivos` + `compliance_dm_ypf`. Devuelve el id del DM
 * creado, o lanza si algo falla. La transacción "best effort": si el
 * período ya existe (unique índex), reutiliza el existente en vez de
 * fallar — eso permite re-importar para corregir.
 */
async function guardarDmYpf(
  supabase: Admin,
  userId: string,
  file: File,
  parsed: Awaited<ReturnType<typeof parseYpfPdf>>,
): Promise<string | null> {
  if (!parsed.quincenaDesde || !parsed.quincenaHasta) return null;

  // 1) Si ya hay un DM para este período, lo reusamos (no rompemos el unique)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existente } = await sb
    .from("compliance_dm_ypf")
    .select("id")
    .eq("periodo_desde", parsed.quincenaDesde)
    .eq("periodo_hasta", parsed.quincenaHasta)
    .maybeSingle();
  if (existente?.id) return existente.id as string;

  // 2) Subir el PDF al storage. Path: ypf-dm/<año>/<mes>/<archivo>.pdf
  const yyyy = parsed.quincenaDesde.slice(0, 4);
  const mm = parsed.quincenaDesde.slice(5, 7);
  const ext = file.name.split(".").pop() || "pdf";
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
  const storagePath = `ypf-dm/${yyyy}/${mm}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("documentos-personal")
    .upload(storagePath, file, { contentType: file.type || "application/pdf" });
  if (upErr) {
    console.error("Storage upload DM YPF:", upErr);
    return null;
  }

  // 3) Crear documentos_archivos
  const { data: archivo, error: archErr } = await sb
    .from("documentos_archivos")
    .insert({
      bucket: "documentos-personal",
      path: storagePath,
      nombre_original: file.name,
      tamano_bytes: file.size,
      mime_type: file.type || "application/pdf",
      subido_por: userId,
    })
    .select("id")
    .single();
  if (archErr || !archivo) {
    console.error("Error creando documentos_archivos:", archErr);
    return null;
  }

  // 4) Crear el DM con los datos de la carátula
  const { data: dm, error: dmErr } = await sb
    .from("compliance_dm_ypf")
    .insert({
      periodo_desde: parsed.quincenaDesde,
      periodo_hasta: parsed.quincenaHasta,
      numero_solpe: parsed.caratula?.numeroSolpe ?? null,
      numero_pedido: parsed.caratula?.numeroPedido ?? null,
      contrato_sap: parsed.caratula?.contratoSap ?? null,
      solicitante: parsed.caratula?.solicitante ?? null,
      total_certificado_ars: parsed.caratula?.totalCertificadoArs ?? null,
      fecha_certificacion: parsed.caratula?.fechaCertificacion ?? null,
      archivo_id: archivo.id,
      importado_por: userId,
      estado: "importado",
      observaciones: `Archivo: ${file.name} (${ext})`,
    })
    .select("id")
    .single();
  if (dmErr || !dm) {
    console.error("Error creando compliance_dm_ypf:", dmErr);
    return null;
  }
  return dm.id as string;
}

// ============================================================================
// Helpers
// ============================================================================

type Admin = ReturnType<typeof createAdminClient>;

async function loadYaImportados(supabase: Admin, desde: string | null, hasta: string | null): Promise<Set<string>> {
  const tag = importTag(desde, hasta);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("viajes")
    .select("chofer_id, fecha_viaje, tonelaje_real, observaciones")
    .ilike("observaciones", `${tag}%`);
  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r.chofer_id && r.fecha_viaje && r.tonelaje_real != null) {
      set.add(dedupKey(r.chofer_id, r.fecha_viaje, Number(r.tonelaje_real)));
    }
  }
  return set;
}

async function getOrCreateCliente(supabase: Admin, userId: string, razon: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("clientes").select("id").ilike("razon_social", razon).limit(1).maybeSingle();
  if (data?.id) return data.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ins, error } = await (supabase as any)
    .from("clientes")
    .insert({ razon_social: razon, condicion_iva: "responsable_inscripto", estado: "activo", observaciones: "Cliente creado por el importador de YPF.", created_by: userId })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear cliente ${razon}: ${error.message}`);
  return ins.id;
}

async function getOrCreateTipoCarga(supabase: Admin, nombre: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("tipos_carga").select("id").ilike("nombre", nombre).limit(1).maybeSingle();
  if (data?.id) return data.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ins, error } = await (supabase as any)
    .from("tipos_carga")
    .insert({ nombre, descripcion: "Arena a granel (import YPF)", requiere_documentacion_especial: false, estado: "activo" })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear tipo de carga ${nombre}: ${error.message}`);
  return ins.id;
}

function normName(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function preloadPuntos(supabase: Admin): Promise<Map<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("puntos_ruta").select("id, nombre");
  const map = new Map<string, string>();
  for (const r of data ?? []) map.set(normName(r.nombre), r.id);
  return map;
}

async function ensurePunto(supabase: Admin, map: Map<string, string>, nombre: string, onCreate: () => void): Promise<string> {
  const key = normName(nombre);
  const existing = map.get(key);
  if (existing) return existing;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("puntos_ruta")
    .insert({ nombre, estado: "activo", es_frontera: false, es_puerto: false })
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
  if (!data?.length) return 0;
  const n = parseInt(data[0].codigo.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : 0;
}
