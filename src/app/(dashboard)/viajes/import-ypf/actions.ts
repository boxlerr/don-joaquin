"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";
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

/** Fila tal como quedó en la preview (con las ediciones del usuario), lista para aplicar. */
export type ConfirmRowInput = {
  remito: string | null;
  netoTn: number;
  importe: number | null;
  /** Si el usuario la dejó tildada para escribirla en el viaje. */
  aplicar: boolean;
};

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

  // Filas editadas por el usuario en la preview (pudo corregir remito/tonelaje/importe).
  // Si no vinieron, se derivan del PDF (default: aplicar las que coinciden) para no
  // romper llamados viejos.
  let editedRows: ConfirmRowInput[] = [];
  const rowsRaw = formData.get("rows");
  if (typeof rowsRaw === "string" && rowsRaw) {
    try {
      editedRows = JSON.parse(rowsRaw) as ConfirmRowInput[];
    } catch {
      return { error: "No se pudieron leer las filas editadas del DM." };
    }
  }
  if (editedRows.length === 0) {
    const rows0 = buildRows(
      parsed.viajes,
      await matchViajesPorRemito(
        supabase,
        [...new Set(parsed.viajes.map((v) => onlyDigits(v.remito)).filter(Boolean))],
      ),
    );
    editedRows = rows0.map((r) => ({
      remito: r.remito,
      netoTn: r.netoTn,
      importe: r.importe,
      aplicar: r.status === "coincide",
    }));
  }

  // Re-matcheo por el remito FINAL (posiblemente corregido a mano) de todas las filas:
  // sirve para contar los que faltan cargar y para aplicar solo los tildados.
  const remitos = [...new Set(editedRows.map((r) => onlyDigits(r.remito)).filter(Boolean))];
  const matches = await matchViajesPorRemito(supabase, remitos);

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

  // Aplica solo las filas que el usuario dejó tildadas y que matchean un viaje real
  // (no vacío). Usa los valores EDITADOS (tonelaje/importe pudieron corregirse a mano).
  const auditRows: Record<string, unknown>[] = [];
  let completados = 0;
  let yaTenian = 0;

  for (const r of editedRows) {
    if (!r.aplicar) continue;
    const key = onlyDigits(r.remito);
    const m = key ? matches.get(key) : undefined;
    if (!m || m.es_vacio) continue;

    const montoDm = round2(r.importe ?? 0);
    const update: Record<string, unknown> = {
      tonelaje_real: r.netoTn,
      monto_flete: montoDm,
      // El DM es la certificación de YPF: completar el viaje con su valor lo deja
      // facturado (sale del estado "sin facturar"/$0) y cobrado de una — no hay
      // flujo de cobro aparte (03/07/2026). Regla unificada: solo con monto > 0.
      facturado: viajeEstaFacturado(montoDm),
      cobrado: viajeEstaFacturado(montoDm),
    };
    if (dmYpfId) update.dm_ypf_id = dmYpfId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("viajes").update(update).eq("id", m.id);
    if (error) {
      console.error("Error completando viaje YPF:", m.codigo, error);
      continue;
    }
    completados++;
    if ((m.monto_flete ?? 0) > 0) yaTenian++;
    auditRows.push({
      usuario_id: user.id,
      accion: "completar_dm_ypf",
      entidad_tipo: "viaje",
      entidad_id: m.id,
      valores_anteriores: { monto_flete: m.monto_flete, tonelaje_real: m.tonelaje_real },
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
  revalidatePath("/compliance");
  revalidatePath("/viajes/liquidaciones");
  revalidatePath("/tarifas");

  return {
    ok: true,
    result: {
      completados,
      yaTenian,
      // Remitos del DM que no matchean ningún viaje cargado → a reclamar.
      noCargados: editedRows.filter((r) => {
        const k = onlyDigits(r.remito);
        return k !== "" && !matches.get(k);
      }).length,
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

  // Ingreso a caja consolidado por el DM (decisión 20/07/2026): el cobro de los
  // fletes de YPF entra a la caja al cargar el DM, como UN único movimiento (no
  // viaje por viaje). Best-effort. Fecha contable = fecha de certificación del DM
  // (o el período). El índice único (dm_ypf_id) evita duplicar si se reprocesa.
  const totalDm = Number(parsed.caratula?.totalCertificadoArs ?? 0);
  if (totalDm > 0) {
    try {
      const { data: ypfCliente } = await sb
        .from("clientes")
        .select("id")
        .or("razon_social.ilike.%ypf%,nombre_comercial.ilike.%ypf%")
        .limit(1)
        .maybeSingle();
      const fechaContable =
        parsed.caratula?.fechaCertificacion ??
        parsed.quincenaHasta ??
        parsed.quincenaDesde ??
        new Date().toISOString().slice(0, 10);
      await sb.from("caja_movimientos").insert({
        tipo: "ingreso",
        categoria: "cobro_cliente",
        medio: "transferencia",
        concepto: `DM YPF (${parsed.quincenaDesde} a ${parsed.quincenaHasta})`,
        observaciones: `Certificación YPF. Cargado el ${new Date().toISOString().slice(0, 10)}.`,
        monto: totalDm,
        moneda: "ARS",
        fecha: fechaContable,
        cliente_id: ypfCliente?.id ?? null,
        dm_ypf_id: dm.id,
        created_by: userId,
      });
    } catch (e) {
      console.error("No se pudo generar el ingreso de caja del DM YPF:", e);
    }
  }

  return dm.id as string;
}
