"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  crearUrlSubidaAdjunto,
  vincularAdjuntos,
  type AdjuntoCfg,
  type ArchivoMeta,
  type CrearUrlResult,
} from "@/lib/adjuntos-server";
import type {
  ChoferInfo,
  ComplianceCliente,
  ComplianceClienteAplica,
  ComplianceEstadoRow,
  ComplianceHistorialDoc,
  ComplianceRequisito,
  UnidadInfo,
} from "./types";

function clienteToEnum(c: ComplianceCliente): "YPF" | "LOMA_NEGRA" {
  return c;
}

// Config de adjuntos multi-archivo por tabla destino (bucket + carpeta + tabla puente).
type ComplianceAdjCfg = AdjuntoCfg & { docTable: string };
const COMPLIANCE_ADJ: Record<"chofer" | "camion" | "compliance", ComplianceAdjCfg> = {
  chofer: { bucket: "documentos-personal", folder: "compliance", junctionTable: "chofer_documento_archivos", entityColumn: "chofer_documento_id", docTable: "chofer_documentos" },
  camion: { bucket: "documentos-personal", folder: "compliance", junctionTable: "camion_documento_archivos", entityColumn: "camion_documento_id", docTable: "camion_documentos" },
  compliance: { bucket: "documentos-personal", folder: "compliance", junctionTable: "compliance_documento_archivos", entityColumn: "compliance_documento_id", docTable: "compliance_documentos" },
};

// La misma config, indexada por la tabla donde vive el documento. Es la que
// necesita el editor de vencimiento, que recibe la fuente (no el nivel) desde
// cada fila de v_compliance_estado.
const CFG_POR_FUENTE: Record<
  "compliance_documentos" | "chofer_documentos" | "camion_documentos",
  ComplianceAdjCfg
> = {
  compliance_documentos: COMPLIANCE_ADJ.compliance,
  chofer_documentos: COMPLIANCE_ADJ.chofer,
  camion_documentos: COMPLIANCE_ADJ.camion,
};

/** URL firmada para subir un archivo de compliance directo del navegador (multi-archivo). */
export async function crearUrlSubidaComplianceDocAction(input: { filename: string }): Promise<CrearUrlResult> {
  await requireArea("compliance", "write");
  return crearUrlSubidaAdjunto(COMPLIANCE_ADJ.compliance, input.filename);
}

/**
 * Estado de compliance filtrado por los valores EXACTOS de `cliente_aplica`.
 * - `["AMBOS"]` → documentos generales (van a todas las plataformas).
 * - `["YPF"]` / `["LOMA_NEGRA"]` → solo lo específico de esa plataforma.
 * - `["AMBOS","YPF"]` → todo lo que aplica a YPF (general + específico).
 */
export async function getComplianceEstadoAplica(aplica: ComplianceClienteAplica[]): Promise<{
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  unidades: Record<string, UnidadInfo>;
  choferes: Record<string, ChoferInfo>;
}> {
  await requireArea("compliance", "read");
  const supabase = createAdminClient();

  const [rowsRes, reqRes, unidades, choferes] = await Promise.all([
    supabase
      .from("v_compliance_estado")
      .select("*")
      .in("cliente_aplica", aplica)
      .order("nivel", { ascending: true })
      .order("requisito_codigo", { ascending: true }),
    supabase
      .from("compliance_requisitos")
      .select("*")
      .eq("activo", true)
      .in("cliente_aplica", aplica)
      .order("orden", { ascending: true }),
    getUnidadesInfo(supabase),
    getChoferesInfo(supabase),
  ]);

  const rows = (rowsRes.data as ComplianceEstadoRow[] | null) ?? [];
  await adjuntarObservaciones(supabase, rows);

  return {
    rows,
    requisitos: (reqRes.data as ComplianceRequisito[] | null) ?? [],
    unidades,
    choferes,
  };
}

/**
 * Foto + área de cada chofer, para el avatar de la cabecera de su grupo. Mismo
 * criterio que en Legajos: si subieron la foto va la foto, y si no la silueta
 * del área teñida por el nombre.
 */
async function getChoferesInfo(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Record<string, ChoferInfo>> {
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, rol, foto:documentos_archivos!foto_id(bucket, path)");

  const out: Record<string, ChoferInfo> = {};
  for (const c of data ?? []) {
    const foto = Array.isArray(c.foto) ? c.foto[0] : c.foto;
    out[c.id] = {
      nombre: `${c.apellido ?? ""}${c.nombre ? ` ${c.nombre}` : ""}`.trim(),
      rol: c.rol,
      foto_url: foto
        ? supabase.storage.from(foto.bucket).getPublicUrl(foto.path).data.publicUrl
        : null,
    };
  }
  return out;
}

/**
 * Ficha de cada unidad (marca/modelo/año/capacidad/chofer/acoplado) indexada por
 * `camion_id`, para la cabecera de "Unidades" del checklist. Va aparte de la vista
 * porque `v_compliance_estado` la comparte con las alertas y solo necesita la patente.
 */
async function getUnidadesInfo(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Record<string, UnidadInfo>> {
  const [camionesRes, choferesRes, vinculosRes, fotosRes] = await Promise.all([
    supabase
      .from("camiones")
      .select(
        "id, patente, marca, modelo, ano, capacidad_tn, tipo_camion, tercerizacion_estado, km_actual, chofer_actual_id",
      ),
    supabase.from("choferes").select("id, nombre, apellido"),
    // Solo la vinculación vigente (sin fecha de baja).
    supabase
      .from("camion_acoplados")
      .select("camion_id, acoplado:acoplados(patente)")
      .is("hasta", null),
    // La foto de tapa de cada unidad, la misma que muestra /camiones.
    supabase
      .from("camion_fotos")
      .select("camion_id, archivo:documentos_archivos!archivo_id(bucket, path)")
      .eq("es_principal", true),
  ]);

  const fotoDe = new Map<string, string>();
  for (const f of fotosRes.data ?? []) {
    const archivo = Array.isArray(f.archivo) ? f.archivo[0] : f.archivo;
    if (!archivo) continue;
    fotoDe.set(f.camion_id, supabase.storage.from(archivo.bucket).getPublicUrl(archivo.path).data.publicUrl);
  }

  // Mismo formato que la tabla de /camiones: "Apellido Nombre".
  const choferNombre = new Map<string, string>();
  for (const ch of choferesRes.data ?? []) {
    choferNombre.set(ch.id, `${ch.apellido ?? ""}${ch.nombre ? ` ${ch.nombre}` : ""}`.trim());
  }

  const acopladosDe = new Map<string, string[]>();
  for (const v of vinculosRes.data ?? []) {
    const ac = Array.isArray(v.acoplado) ? v.acoplado[0] : v.acoplado;
    if (!v.camion_id || !ac?.patente) continue;
    const arr = acopladosDe.get(v.camion_id) ?? [];
    arr.push(ac.patente);
    acopladosDe.set(v.camion_id, arr);
  }

  const out: Record<string, UnidadInfo> = {};
  for (const c of camionesRes.data ?? []) {
    out[c.id] = {
      patente: c.patente,
      marca: c.marca,
      modelo: c.modelo,
      ano: c.ano,
      capacidad_tn: c.capacidad_tn === null ? null : Number(c.capacidad_tn),
      tipo_camion: c.tipo_camion,
      tercerizacion_estado: c.tercerizacion_estado,
      km_actual: c.km_actual === null ? null : Number(c.km_actual),
      chofer_id: c.chofer_actual_id,
      chofer_nombre: c.chofer_actual_id ? choferNombre.get(c.chofer_actual_id) ?? null : null,
      acoplados: acopladosDe.get(c.id) ?? [],
      foto_url: fotoDe.get(c.id) ?? null,
    };
  }
  return out;
}

export async function getComplianceEstadoAction(cliente: ComplianceCliente): Promise<{
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  unidades: Record<string, UnidadInfo>;
  choferes: Record<string, ChoferInfo>;
}> {
  return getComplianceEstadoAplica(["AMBOS", clienteToEnum(cliente)]);
}

/**
 * La vista v_compliance_estado no trae las observaciones del documento vigente.
 * Las traemos aparte por documento_id (agrupado por fuente) y las pegamos a cada
 * fila — así se ven en el checklist sin tener que modificar la vista. Muta `rows`.
 */
async function adjuntarObservaciones(
  supabase: ReturnType<typeof createAdminClient>,
  rows: ComplianceEstadoRow[],
): Promise<void> {
  const ids = {
    compliance_documentos: new Set<string>(),
    chofer_documentos: new Set<string>(),
    camion_documentos: new Set<string>(),
  };
  for (const r of rows) {
    if (!r.documento_id || !r.documento_fuente) continue;
    const set = ids[r.documento_fuente as keyof typeof ids];
    if (set) set.add(r.documento_id);
  }

  const obsPorId = new Map<string, string | null>();
  const collect = (data: { id: string; observaciones: string | null }[] | null) => {
    for (const d of data ?? []) obsPorId.set(d.id, d.observaciones ?? null);
  };

  await Promise.all([
    ids.compliance_documentos.size
      ? supabase
          .from("compliance_documentos")
          .select("id, observaciones")
          .in("id", [...ids.compliance_documentos])
          .then((r) => collect(r.data))
      : Promise.resolve(),
    ids.chofer_documentos.size
      ? supabase
          .from("chofer_documentos")
          .select("id, observaciones")
          .in("id", [...ids.chofer_documentos])
          .then((r) => collect(r.data))
      : Promise.resolve(),
    ids.camion_documentos.size
      ? supabase
          .from("camion_documentos")
          .select("id, observaciones")
          .in("id", [...ids.camion_documentos])
          .then((r) => collect(r.data))
      : Promise.resolve(),
  ]);

  for (const r of rows) {
    if (r.documento_id) r.observaciones = obsPorId.get(r.documento_id) ?? null;
  }
}

/**
 * Historial completo de un requisito para una entidad concreta (chofer /
 * camión / empresa). Reúne todas las versiones cargadas a lo largo del
 * tiempo, sin importar si viven en compliance_documentos o en el legajo
 * del chofer/camión (cuando el requisito está mapeado a un tipo_documento).
 */
export async function getComplianceHistorialAction(input: {
  requisito_id: string;
  chofer_id?: string | null;
  camion_id?: string | null;
}): Promise<ComplianceHistorialDoc[]> {
  await requireArea("compliance", "read");
  const supabase = createAdminClient();

  const { data: req } = await supabase
    .from("compliance_requisitos")
    .select("nivel, tipo_documento_id")
    .eq("id", input.requisito_id)
    .single();
  if (!req) return [];

  const nombreUsuario = (u: { nombre?: string | null; apellido?: string | null } | null): string | null => {
    if (!u) return null;
    const full = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
    return full || null;
  };

  // ── Caso legajo: el doc vive en chofer_documentos / camion_documentos ──
  if (req.tipo_documento_id && req.nivel === "chofer" && input.chofer_id) {
    const { data } = await supabase
      .from("chofer_documentos")
      .select(
        "id, numero, fecha_emision, fecha_vencimiento, observaciones, archivo_id, created_at, cargado_por:usuarios(nombre, apellido), archivo:documentos_archivos(nombre_original)",
      )
      .eq("chofer_id", input.chofer_id)
      .eq("tipo_documento_id", req.tipo_documento_id)
      .order("fecha_vencimiento", { ascending: false, nullsFirst: false });
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((d) => ({
      id: d.id as string,
      periodo: null,
      numero: (d.numero as string | null) ?? null,
      fecha_emision: (d.fecha_emision as string | null) ?? null,
      fecha_vencimiento: (d.fecha_vencimiento as string | null) ?? null,
      observaciones: (d.observaciones as string | null) ?? null,
      archivo_id: (d.archivo_id as string | null) ?? null,
      nombre_archivo: (d.archivo as { nombre_original?: string } | null)?.nombre_original ?? null,
      created_at: d.created_at as string,
      cargado_por: nombreUsuario(d.cargado_por as { nombre?: string; apellido?: string } | null),
    }));
  }

  if (req.tipo_documento_id && req.nivel === "unidad" && input.camion_id) {
    const { data } = await supabase
      .from("camion_documentos")
      .select(
        "id, numero, fecha_emision, fecha_vencimiento, observaciones, archivo_id, created_at, cargado_por:usuarios(nombre, apellido), archivo:documentos_archivos(nombre_original)",
      )
      .eq("camion_id", input.camion_id)
      .eq("tipo_documento_id", req.tipo_documento_id)
      .order("fecha_vencimiento", { ascending: false, nullsFirst: false });
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((d) => ({
      id: d.id as string,
      periodo: null,
      numero: (d.numero as string | null) ?? null,
      fecha_emision: (d.fecha_emision as string | null) ?? null,
      fecha_vencimiento: (d.fecha_vencimiento as string | null) ?? null,
      observaciones: (d.observaciones as string | null) ?? null,
      archivo_id: (d.archivo_id as string | null) ?? null,
      nombre_archivo: (d.archivo as { nombre_original?: string } | null)?.nombre_original ?? null,
      created_at: d.created_at as string,
      cargado_por: nombreUsuario(d.cargado_por as { nombre?: string; apellido?: string } | null),
    }));
  }

  // ── Caso compliance_documentos ──
  let query = supabase
    .from("compliance_documentos")
    .select(
      "id, periodo, fecha_emision, fecha_vencimiento, observaciones, archivo_id, created_at, cargado_por:usuarios(nombre, apellido), archivo:documentos_archivos(nombre_original)",
    )
    .eq("requisito_id", input.requisito_id);
  if (input.chofer_id) query = query.eq("chofer_id", input.chofer_id);
  else query = query.is("chofer_id", null);
  if (input.camion_id) query = query.eq("camion_id", input.camion_id);
  else query = query.is("camion_id", null);

  const { data } = await query.order("fecha_vencimiento", {
    ascending: false,
    nullsFirst: false,
  });

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    periodo: (d.periodo as string | null) ?? null,
    numero: null,
    fecha_emision: (d.fecha_emision as string | null) ?? null,
    fecha_vencimiento: (d.fecha_vencimiento as string | null) ?? null,
    observaciones: (d.observaciones as string | null) ?? null,
    archivo_id: (d.archivo_id as string | null) ?? null,
    nombre_archivo: (d.archivo as { nombre_original?: string } | null)?.nombre_original ?? null,
    created_at: d.created_at as string,
    cargado_por: nombreUsuario(d.cargado_por as { nombre?: string; apellido?: string } | null),
  }));
}

export async function uploadComplianceDocAction(input: {
  requisito_id: string;
  chofer_id?: string | null;
  camion_id?: string | null;
  periodo?: string | null;
  fecha_emision?: string | null;
  fecha_vencimiento: string;
  observaciones?: string | null;
  numero?: string | null;
  /** Aseguradora (Nación / Segurcoop / …) — solo aplica al seguro por unidad. */
  aseguradora?: string | null;
  /** Archivos YA subidos al Storage (URL firmada). Opcional: se puede registrar solo el vencimiento. */
  archivos?: ArchivoMeta[];
}) {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();

  const requisito_id = input.requisito_id;
  const chofer_id = input.chofer_id || null;
  const camion_id = input.camion_id || null;
  const periodo = input.periodo || null;
  const fecha_emision = input.fecha_emision || null;
  const fecha_vencimiento = input.fecha_vencimiento;
  const observaciones = input.observaciones || null;
  const numero = input.numero || null;
  // Los archivos son OPCIONALES: Noelia puede registrar/actualizar solo el vencimiento
  // sin subir PDF. archivo_id es nullable en las 3 tablas.
  const archivos = (input.archivos ?? []).filter((a) => a && a.path);

  if (!requisito_id) return { error: "Requisito requerido" };
  if (!fecha_vencimiento) return { error: "Fecha de vencimiento requerida" };

  const { data: req } = await supabase
    .from("compliance_requisitos")
    .select("nivel, codigo, nombre, tipo_documento_id")
    .eq("id", requisito_id)
    .single();
  if (!req) return { error: "Requisito no encontrado" };

  if (req.nivel === "chofer" && !chofer_id) return { error: "Chofer requerido para este requisito" };
  if (req.nivel === "unidad" && !camion_id) return { error: "Camión requerido para este requisito" };
  if (req.nivel === "empresa" && (chofer_id || camion_id)) {
    return { error: "Los requisitos de empresa no llevan chofer ni camión" };
  }

  // Cuando el requisito está mapeado a un tipo_documento existente, el doc se
  // guarda en chofer_documentos / camion_documentos (no en compliance_documentos),
  // así aparece tanto en el legajo como en compliance (v_compliance_estado cruza ambos).
  const usaLegajo = !!req.tipo_documento_id;

  // Crear el doc en la tabla que corresponda (archivo_id se completa luego con el
  // primero de los adjuntos, que es el que abre el checklist).
  let cfg: ComplianceAdjCfg;
  let nuevoDocId: string;

  if (usaLegajo && req.nivel === "chofer") {
    cfg = COMPLIANCE_ADJ.chofer;
    const { data, error: dbError } = await supabase.from("chofer_documentos").insert({
      chofer_id: chofer_id!, tipo_documento_id: req.tipo_documento_id!, numero, fecha_emision,
      fecha_vencimiento, archivo_id: null, observaciones, created_by: user.id,
    }).select("id").single();
    if (dbError || !data) return { error: "Error al guardar el documento" };
    nuevoDocId = data.id;
    revalidatePath("/choferes/[slug]", "page");
  } else if (usaLegajo && req.nivel === "unidad") {
    cfg = COMPLIANCE_ADJ.camion;
    // `as any`: la columna `aseguradora` es nueva y aún no está en database.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: dbError } = await (supabase as any).from("camion_documentos").insert({
      camion_id: camion_id!, tipo_documento_id: req.tipo_documento_id!, numero, fecha_emision,
      fecha_vencimiento, archivo_id: null, observaciones, aseguradora: input.aseguradora || null, created_by: user.id,
    }).select("id").single();
    if (dbError || !data) return { error: "Error al guardar el documento" };
    nuevoDocId = data.id;
    revalidatePath(`/camiones/${camion_id}`);
  } else {
    cfg = COMPLIANCE_ADJ.compliance;
    const { data, error: dbError } = await supabase.from("compliance_documentos").insert({
      requisito_id, chofer_id, camion_id, periodo, fecha_emision, fecha_vencimiento,
      archivo_id: null, observaciones, created_by: user.id,
    }).select("id").single();
    if (dbError || !data) return { error: "Error al guardar el documento" };
    nuevoDocId = data.id;
  }

  // Vincular TODOS los archivos (multi) a la tabla puente + apuntar archivo_id al primero.
  let fallidos = 0;
  if (archivos.length) {
    const r = await vincularAdjuntos(cfg, nuevoDocId, archivos, user.id);
    fallidos = r.fallidos;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: primero } = await (supabase as any)
      .from(cfg.junctionTable)
      .select("archivo_id")
      .eq(cfg.entityColumn, nuevoDocId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (primero?.archivo_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from(cfg.docTable).update({ archivo_id: primero.archivo_id }).eq("id", nuevoDocId);
    }
  }

  revalidatePath("/compliance");
  revalidatePath("/compliance/organismos", "layout");
  return fallidos > 0 ? { success: true, fallidos } : { success: true };
}

/**
 * Edita el vencimiento (y observaciones) de un documento YA cargado, sin re-subir
 * el archivo. Replica lo que Noelia mantiene a mano en su Excel. La fuente
 * (`documento_fuente`) y el `documento_id` salen de cada fila de v_compliance_estado.
 */
const FUENTES_VENCIMIENTO = [
  "compliance_documentos",
  "chofer_documentos",
  "camion_documentos",
] as const;
type FuenteVencimiento = (typeof FUENTES_VENCIMIENTO)[number];

export async function setComplianceVencimientoAction(input: {
  documento_id: string;
  fuente: FuenteVencimiento;
  fecha_vencimiento: string;
  observaciones?: string | null;
  /**
   * Archivos para ARCHIVAR junto con la fecha nueva (opcional).
   *
   * Editar el vencimiento era el único camino que no dejaba adjuntar nada: el
   * diálogo decía "actualizá la fecha sin volver a subir el archivo". Ana renovó
   * 45 documentos así, o sea que quedaron 45 fechas nuevas sin el papel detrás.
   * Se suman a los que ya tenga el documento, no los reemplazan: el sentido es
   * tener el archivo de cada presentación, no pisar el anterior.
   */
  archivos?: ArchivoMeta[];
}) {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();

  if (!input.documento_id) return { error: "Documento requerido" };
  if (!input.fecha_vencimiento) return { error: "Fecha de vencimiento requerida" };
  if (!FUENTES_VENCIMIENTO.includes(input.fuente)) return { error: "Fuente inválida" };

  const observaciones = input.observaciones?.trim() || null;
  const upd = { fecha_vencimiento: input.fecha_vencimiento, observaciones };

  // Estado previo (para auditoría) + update. Ramas por tabla literal para mantener
  // el tipado del cliente de Supabase.
  let prev: { fecha_vencimiento: string | null; observaciones: string | null } | null = null;
  let updError = false;
  if (input.fuente === "compliance_documentos") {
    const r = await supabase
      .from("compliance_documentos")
      .select("fecha_vencimiento, observaciones")
      .eq("id", input.documento_id)
      .single();
    prev = r.data;
    if (prev)
      updError = !!(
        await supabase.from("compliance_documentos").update(upd).eq("id", input.documento_id)
      ).error;
  } else if (input.fuente === "chofer_documentos") {
    const r = await supabase
      .from("chofer_documentos")
      .select("fecha_vencimiento, observaciones")
      .eq("id", input.documento_id)
      .single();
    prev = r.data;
    if (prev)
      updError = !!(
        await supabase.from("chofer_documentos").update(upd).eq("id", input.documento_id)
      ).error;
  } else {
    const r = await supabase
      .from("camion_documentos")
      .select("fecha_vencimiento, observaciones")
      .eq("id", input.documento_id)
      .single();
    prev = r.data;
    if (prev)
      updError = !!(
        await supabase.from("camion_documentos").update(upd).eq("id", input.documento_id)
      ).error;
  }
  if (!prev) return { error: "Documento no encontrado" };
  if (updError) return { error: "No se pudo actualizar el vencimiento" };

  // Archivar el papel junto con la fecha. Va DESPUÉS del update: si falla la
  // subida, la fecha ya quedó guardada igual — que es lo que no se puede perder.
  const archivos = input.archivos ?? [];
  let fallidos = 0;
  if (archivos.length > 0) {
    const cfg = CFG_POR_FUENTE[input.fuente];
    const r = await vincularAdjuntos(cfg, input.documento_id, archivos, user.id);
    fallidos = r.fallidos;
    // archivo_id es la portada (lo que muestran el checklist y el historial).
    // Solo se completa si el documento no tenía ninguno: renovar suma archivos,
    // no reemplaza el que ya estaba.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: doc } = await (supabase as any)
      .from(cfg.docTable)
      .select("archivo_id")
      .eq("id", input.documento_id)
      .maybeSingle();
    if (!doc?.archivo_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: primero } = await (supabase as any)
        .from(cfg.junctionTable)
        .select("archivo_id")
        .eq(cfg.entityColumn, input.documento_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (primero?.archivo_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from(cfg.docTable)
          .update({ archivo_id: primero.archivo_id })
          .eq("id", input.documento_id);
      }
    }
  }

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "editar_vencimiento_compliance",
    entidad_tipo: input.fuente,
    entidad_id: input.documento_id,
    valores_anteriores: prev,
    valores_nuevos: {
      fecha_vencimiento: input.fecha_vencimiento,
      observaciones,
      archivos_nuevos: archivos.length,
    },
  });

  revalidatePath("/compliance");
  revalidatePath("/compliance/organismos", "layout");
  return fallidos > 0 ? { success: true, fallidos } : { success: true };
}

/**
 * Guarda "a dónde se manda" un documento (portales/mails) a nivel requisito.
 * Pedido de Nico (02/07): que cualquiera sepa a qué portal/mail enviar cada doc
 * cuando no está Noelia. Se muestra en el checklist y en las alertas.
 */
export async function setComplianceEnviarAAction(input: {
  requisito_id: string;
  enviar_a: string | null;
}) {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();

  if (!input.requisito_id) return { error: "Requisito requerido" };
  const enviarA = input.enviar_a?.trim() || null;

  // `enviar_a` es columna nueva (no está en database.ts generado todavía).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: prev } = await sb
    .from("compliance_requisitos")
    .select("enviar_a")
    .eq("id", input.requisito_id)
    .single();
  if (!prev) return { error: "Requisito no encontrado" };
  if ((prev.enviar_a ?? null) === enviarA) return { success: true }; // sin cambios

  const { error } = await sb
    .from("compliance_requisitos")
    .update({ enviar_a: enviarA })
    .eq("id", input.requisito_id);
  if (error) return { error: "No se pudo guardar el destino de envío" };

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "editar_envio_compliance",
    entidad_tipo: "compliance_requisitos",
    entidad_id: input.requisito_id,
    valores_anteriores: { enviar_a: prev.enviar_a ?? null },
    valores_nuevos: { enviar_a: enviarA },
  });

  revalidatePath("/compliance");
  revalidatePath("/compliance/organismos", "layout");
  return { success: true };
}

export async function deleteComplianceDocAction(doc_id: string) {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();
  const { error } = await supabase.from("compliance_documentos").delete().eq("id", doc_id);
  if (error) return { error: "Error al eliminar" };
  await logAudit({
    accion: "eliminar",
    entidadTipo: "compliance_documentos",
    entidadId: doc_id,
    usuarioId: user.id,
  });
  revalidatePath("/compliance");
  revalidatePath("/compliance/organismos", "layout");
  return { success: true };
}

export async function getSignedUrlComplianceArchivoAction(
  archivo_id: string,
  opts?: { download?: boolean },
) {
  await requireArea("compliance", "read");
  const supabase = createAdminClient();
  const { data: arch } = await supabase
    .from("documentos_archivos")
    .select("bucket, path, nombre_original")
    .eq("id", archivo_id)
    .single();
  if (!arch) return { error: "Archivo no encontrado" };
  // Con `download` fuerza la descarga con el nombre prolijo (ej. "Juan Pérez - Carnet.pdf");
  // sin él, abre el PDF en el navegador para verlo.
  const { data, error } = await supabase.storage
    .from(arch.bucket)
    .createSignedUrl(arch.path, 60, opts?.download && arch.nombre_original ? { download: arch.nombre_original } : undefined);
  if (error || !data) return { error: "No se pudo generar el link" };
  return { url: data.signedUrl };
}
