"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { parseYpfPdf, type YpfTarifa } from "./parser-ypf";
import { seedTarifasFromYpf } from "./tarifas-seed";

// ============================================================================
// Importador del DM de YPF — modelo "match por remito + completar".
// ----------------------------------------------------------------------------
// Flujo del negocio (reunión Nico): el operador YA cargó los viajes a mano (con
// el nº de remito, sin valor). El DM de YPF llega después y trae, por remito, el
// neto en toneladas y el precio unitario del destino → el importe del viaje
// (neto × precio). Este importador NO crea viajes: cruza cada renglón del DM
// contra `viajes.nro_remito` y, en los que coinciden, completa tonelaje + monto
// y los marca facturados. Los remitos del DM que no estén cargados se listan
// para RECLAMAR (no se crean automáticamente). El PDF firmado se archiva en
// Compliance → YPF (guardarDmYpf), igual que antes.
// ============================================================================

type Admin = ReturnType<typeof createAdminClient>;
const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;

export type DmMatchStatus = "coincide" | "ya_con_valor" | "no_cargado" | "sin_remito" | "sin_precio";

export type DmRowPreview = {
  idx: number;
  remito: string | null;
  fecha: string | null; // fecha de descarga del DM (YYYY-MM-DD)
  destino: string | null;
  choferDm: string; // nombre del chofer según el DM (informativo)
  netoTn: number;
  precioUnitario: number | null;
  importe: number | null; // neto × precio unitario del destino
  status: DmMatchStatus;
  viaje?: {
    id: string;
    codigo: string;
    chofer: string | null; // chofer del viaje ya cargado en el sistema
    montoActual: number | null;
    tonelajeActual: number | null;
  };
};

export type YpfSummary = {
  total: number;
  coinciden: number; // se van a completar
  yaConValor: number; // coinciden pero ya tenían monto (no se tocan)
  noCargados: number; // remito del DM sin viaje cargado → reclamar
  sinRemito: number;
  sinPrecio: number;
  totalTnACompletar: number;
  totalImporteACompletar: number;
};

export type YpfPreviewState = {
  ok?: boolean;
  archivo?: string;
  quincenaDesde?: string | null;
  quincenaHasta?: string | null;
  tarifas?: YpfTarifa[];
  rows?: DmRowPreview[];
  warnings?: string[];
  summary?: YpfSummary;
  error?: string;
} | null;

type ViajeMatch = {
  id: string;
  codigo: string;
  nro_remito: string | null;
  monto_flete: number | null;
  tonelaje_real: number | null;
  es_vacio: boolean | null;
  chofer: string | null;
};

/** Trae los viajes cuyo nº de remito coincide con alguno del DM, indexados por
 *  remito normalizado (solo dígitos). */
async function matchViajesPorRemito(supabase: Admin, remitos: string[]): Promise<Map<string, ViajeMatch>> {
  const map = new Map<string, ViajeMatch>();
  if (remitos.length === 0) return map;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("viajes")
    .select("id, codigo, nro_remito, monto_flete, tonelaje_real, es_vacio, choferes(nombre, apellido)")
    .in("nro_remito", remitos);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const key = onlyDigits(r.nro_remito);
    if (!key || map.has(key)) continue; // primer viaje gana ante remito repetido
    const ch = Array.isArray(r.choferes) ? r.choferes[0] : r.choferes;
    map.set(key, {
      id: r.id,
      codigo: r.codigo,
      nro_remito: r.nro_remito,
      monto_flete: r.monto_flete != null ? Number(r.monto_flete) : null,
      tonelaje_real: r.tonelaje_real != null ? Number(r.tonelaje_real) : null,
      es_vacio: r.es_vacio,
      chofer: ch ? `${ch.apellido}, ${ch.nombre}` : null,
    });
  }
  return map;
}

/** Clasifica cada renglón del DM contra los viajes encontrados. */
function buildRows(
  viajes: Awaited<ReturnType<typeof parseYpfPdf>>["viajes"],
  matches: Map<string, ViajeMatch>,
): DmRowPreview[] {
  return viajes.map((v) => {
    const base = {
      idx: v.idx,
      remito: v.remito,
      fecha: v.fechaDescarga,
      destino: v.destino,
      choferDm: v.choferNombre,
      netoTn: v.netoTn,
      precioUnitario: v.precioUnitario,
      importe: v.importe,
    };
    const remitoNorm = onlyDigits(v.remito);
    if (!remitoNorm) return { ...base, status: "sin_remito" as const };
    if (v.precioUnitario == null) return { ...base, status: "sin_precio" as const };
    const m = matches.get(remitoNorm);
    if (!m) return { ...base, status: "no_cargado" as const };
    const viaje = {
      id: m.id,
      codigo: m.codigo,
      chofer: m.chofer,
      montoActual: m.monto_flete,
      tonelajeActual: m.tonelaje_real,
    };
    const yaTiene = (m.monto_flete ?? 0) > 0;
    return { ...base, status: yaTiene ? ("ya_con_valor" as const) : ("coincide" as const), viaje };
  });
}

function resumir(rows: DmRowPreview[]): YpfSummary {
  const coinciden = rows.filter((r) => r.status === "coincide");
  return {
    total: rows.length,
    coinciden: coinciden.length,
    yaConValor: rows.filter((r) => r.status === "ya_con_valor").length,
    noCargados: rows.filter((r) => r.status === "no_cargado").length,
    sinRemito: rows.filter((r) => r.status === "sin_remito").length,
    sinPrecio: rows.filter((r) => r.status === "sin_precio").length,
    totalTnACompletar: round2(coinciden.reduce((s, r) => s + r.netoTn, 0)),
    totalImporteACompletar: round2(coinciden.reduce((s, r) => s + (r.importe ?? 0), 0)),
  };
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewYpfImportAction(formData: FormData): Promise<YpfPreviewState> {
  await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Adjuntá el PDF del DM de YPF." };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { error: "El archivo debe ser un PDF." };

  let parsed;
  try {
    parsed = await parseYpfPdf(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("Error parseando PDF de YPF:", e);
    return { error: "No se pudo leer el PDF del DM." };
  }

  const supabase = createAdminClient();
  const remitos = [...new Set(parsed.viajes.map((v) => onlyDigits(v.remito)).filter(Boolean))];
  const matches = await matchViajesPorRemito(supabase, remitos);
  const rows = buildRows(parsed.viajes, matches);

  return {
    ok: true,
    archivo: file.name,
    quincenaDesde: parsed.quincenaDesde,
    quincenaHasta: parsed.quincenaHasta,
    tarifas: parsed.tarifas,
    rows,
    warnings: parsed.warnings,
    summary: resumir(rows),
  };
}

// ============================================================================
// CONFIRM — completa los viajes que coinciden por remito
// ============================================================================

export type ConfirmYpfState = {
  ok?: boolean;
  result?: {
    completados: number;
    yaTenian: number;
    noCargados: number;
    dmYpfId?: string;
    // Tarifas sembradas en la tabla `tarifas` (alimentan el cálculo de importe
    // en el alta de viajes).
    tarifasCreadas?: number;
    tarifasActualizadas?: number;
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
    return { error: "No se pudo leer el PDF del DM." };
  }

  const supabase = createAdminClient();
  const remitos = [...new Set(parsed.viajes.map((v) => onlyDigits(v.remito)).filter(Boolean))];
  const matches = await matchViajesPorRemito(supabase, remitos);
  const rows = buildRows(parsed.viajes, matches);

  // Archivar el DM firmado en Compliance → YPF (best-effort) y vincular su id.
  let dmYpfId: string | null = null;
  try {
    dmYpfId = await guardarDmYpf(supabase, user.id, file, parsed);
  } catch (e) {
    console.error("Error guardando DM YPF en compliance:", e);
  }

  // Sembrar las tarifas del DM en la tabla `tarifas` (best-effort): así el alta
  // de viajes precarga el monto por destino y "coincide con el DM".
  let tarifasCreadas = 0;
  let tarifasActualizadas = 0;
  try {
    const seed = await seedTarifasFromYpf(supabase, user.id, parsed);
    tarifasCreadas = seed.creadas;
    tarifasActualizadas = seed.actualizadas;
  } catch (e) {
    console.error("Error sembrando tarifas desde el DM de YPF:", e);
  }

  // Solo completamos los que coinciden y no son tramos vacíos.
  const aCompletar = rows.filter(
    (r) => r.status === "coincide" && r.viaje && !matches.get(onlyDigits(r.remito))?.es_vacio,
  );

  const auditRows: Record<string, unknown>[] = [];
  let completados = 0;

  for (const r of aCompletar) {
    const update: Record<string, unknown> = {
      tonelaje_real: r.netoTn,
      monto_flete: round2(r.importe ?? 0),
      // El DM es la certificación de YPF: completar el viaje con su valor lo deja
      // facturado (sale del estado "sin facturar"/$0).
      facturado: true,
    };
    if (dmYpfId) update.dm_ypf_id = dmYpfId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("viajes").update(update).eq("id", r.viaje!.id);
    if (error) {
      console.error("Error completando viaje YPF:", r.viaje!.codigo, error);
      continue;
    }
    completados++;
    auditRows.push({
      usuario_id: user.id,
      accion: "completar_dm_ypf",
      entidad_tipo: "viaje",
      entidad_id: r.viaje!.id,
      valores_anteriores: { monto_flete: r.viaje!.montoActual, tonelaje_real: r.viaje!.tonelajeActual },
      valores_nuevos: {
        monto_flete: round2(r.importe ?? 0),
        tonelaje_real: r.netoTn,
        facturado: true,
        remito: r.remito,
        dm_ypf_id: dmYpfId,
      },
    });
  }

  if (auditRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_log").insert(auditRows);
  }

  revalidatePath("/viajes");
  revalidatePath("/viajes/hoja-ruta");
  revalidatePath("/compliance/ypf");
  revalidatePath("/compliance/ypf/dm");
  revalidatePath("/tarifas");

  return {
    ok: true,
    result: {
      completados,
      yaTenian: rows.filter((r) => r.status === "ya_con_valor").length,
      noCargados: rows.filter((r) => r.status === "no_cargado").length,
      dmYpfId: dmYpfId ?? undefined,
      tarifasCreadas,
      tarifasActualizadas,
    },
  };
}

// ============================================================================
// Archivar el DM en Compliance → YPF (sube el PDF + crea compliance_dm_ypf)
// ============================================================================

async function guardarDmYpf(
  supabase: Admin,
  userId: string,
  file: File,
  parsed: Awaited<ReturnType<typeof parseYpfPdf>>,
): Promise<string | null> {
  if (!parsed.quincenaDesde || !parsed.quincenaHasta) return null;

  // 1) Si ya hay un DM para este período, lo reusamos (no rompemos el unique).
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
