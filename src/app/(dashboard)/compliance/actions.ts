"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import type {
  ComplianceCliente,
  ComplianceClienteAplica,
  ComplianceEstadoRow,
  ComplianceHistorialDoc,
  ComplianceRequisito,
} from "./types";

function clienteToEnum(c: ComplianceCliente): "YPF" | "LOMA_NEGRA" {
  return c;
}

/** Convierte un nombre en un segmento de path/carpeta legible (sin acentos ni símbolos). */
function slugify(s: string): string {
  return (
    (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "sin-nombre"
  );
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
}> {
  await requireArea("compliance", "read");
  const supabase = createAdminClient();

  const [rowsRes, reqRes] = await Promise.all([
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
  ]);

  const rows = (rowsRes.data as ComplianceEstadoRow[] | null) ?? [];
  await adjuntarObservaciones(supabase, rows);

  return {
    rows,
    requisitos: (reqRes.data as ComplianceRequisito[] | null) ?? [],
  };
}

export async function getComplianceEstadoAction(cliente: ComplianceCliente): Promise<{
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
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

export async function uploadComplianceDocAction(formData: FormData) {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();

  const requisito_id = formData.get("requisito_id") as string;
  const chofer_id = (formData.get("chofer_id") as string) || null;
  const camion_id = (formData.get("camion_id") as string) || null;
  const periodo = (formData.get("periodo") as string) || null;
  const fecha_emision = (formData.get("fecha_emision") as string) || null;
  const fecha_vencimiento = formData.get("fecha_vencimiento") as string;
  const observaciones = (formData.get("observaciones") as string) || null;
  const numero = (formData.get("numero") as string) || null;
  // El archivo es OPCIONAL: Noelia puede registrar/actualizar solo el vencimiento
  // (lo que mantiene en su Excel) sin volver a subir el PDF. archivo_id es nullable
  // en las 3 tablas, así que el documento se guarda igual.
  const fileRaw = formData.get("file");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;

  if (!requisito_id) return { error: "Requisito requerido" };
  if (!fecha_vencimiento) return { error: "Fecha de vencimiento requerida" };
  if (file && file.size > 10 * 1024 * 1024) return { error: "Máximo 10MB" };

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

  // Cuando el requisito está mapeado a un tipo_documento existente, el doc
  // se guarda en chofer_documentos / camion_documentos (no en compliance_documentos).
  // Esto evita duplicar el archivo: aparece tanto en el legajo como en compliance,
  // porque v_compliance_estado cruza ambas fuentes.
  const usaLegajo = !!req.tipo_documento_id;

  // Subir el PDF solo si vino uno; si no, el documento queda sin archivo.
  let archivoId: string | null = null;
  if (file) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();

    // Nombre legible de la entidad, para ordenar el storage en carpetas y para
    // que el archivo se descargue con un nombre prolijo (no el UUID interno).
    let scope: "choferes" | "camiones" | "empresa" = "empresa";
    let entidadNombre = "Empresa";
    if (chofer_id) {
      scope = "choferes";
      const { data: ch } = await supabase
        .from("choferes")
        .select("nombre, apellido")
        .eq("id", chofer_id)
        .single();
      entidadNombre = [ch?.nombre, ch?.apellido].filter(Boolean).join(" ").trim() || "Chofer";
    } else if (camion_id) {
      scope = "camiones";
      const { data: cm } = await supabase
        .from("camiones")
        .select("patente")
        .eq("id", camion_id)
        .single();
      entidadNombre = cm?.patente || "Unidad";
    }

    const reqNombre = req.nombre ?? req.codigo;
    const fechaHoy = new Date().toISOString().slice(0, 10);
    // Carpeta legible: compliance/<scope>/<entidad>/<documento>-<fecha>-<rand>.<ext>
    const storagePath = `compliance/${scope}/${slugify(entidadNombre)}/${slugify(reqNombre)}-${fechaHoy}-${Date.now().toString(36).slice(-4)}.${ext}`;
    // Nombre con el que se descarga desde la web: "<Entidad> - <Documento>.<ext>"
    const nombreDescarga = `${entidadNombre} - ${reqNombre}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos-personal")
      .upload(storagePath, file);
    if (uploadError) return { error: "Error al subir el archivo" };

    const { data: archivo, error: archivoError } = await supabase
      .from("documentos_archivos")
      .insert({
        bucket: "documentos-personal",
        nombre_original: nombreDescarga,
        path: storagePath,
        tamano_bytes: file.size,
        mime_type: file.type,
        subido_por: user.id,
      })
      .select("id")
      .single();
    if (archivoError || !archivo) return { error: "Error al registrar el archivo" };
    archivoId = archivo.id;
  }

  if (usaLegajo && req.nivel === "chofer") {
    const { error: dbError } = await supabase.from("chofer_documentos").insert({
      chofer_id: chofer_id!,
      tipo_documento_id: req.tipo_documento_id!,
      numero,
      fecha_emision,
      fecha_vencimiento,
      archivo_id: archivoId,
      observaciones,
      created_by: user.id,
    });
    if (dbError) return { error: "Error al guardar el documento" };
    revalidatePath("/choferes/[slug]", "page");
  } else if (usaLegajo && req.nivel === "unidad") {
    const { error: dbError } = await supabase.from("camion_documentos").insert({
      camion_id: camion_id!,
      tipo_documento_id: req.tipo_documento_id!,
      numero,
      fecha_emision,
      fecha_vencimiento,
      archivo_id: archivoId,
      observaciones,
      created_by: user.id,
    });
    if (dbError) return { error: "Error al guardar el documento" };
    revalidatePath(`/camiones/${camion_id}`);
  } else {
    const { error: dbError } = await supabase.from("compliance_documentos").insert({
      requisito_id,
      chofer_id,
      camion_id,
      periodo,
      fecha_emision,
      fecha_vencimiento,
      archivo_id: archivoId,
      observaciones,
      created_by: user.id,
    });
    if (dbError) return { error: "Error al guardar el documento" };
  }

  revalidatePath("/compliance");
  revalidatePath("/compliance/organismos", "layout");
  return { success: true };
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

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "editar_vencimiento_compliance",
    entidad_tipo: input.fuente,
    entidad_id: input.documento_id,
    valores_anteriores: prev,
    valores_nuevos: { fecha_vencimiento: input.fecha_vencimiento, observaciones },
  });

  revalidatePath("/compliance");
  revalidatePath("/compliance/organismos", "layout");
  return { success: true };
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
  await requireArea("compliance", "admin");
  const supabase = createAdminClient();
  const { error } = await supabase.from("compliance_documentos").delete().eq("id", doc_id);
  if (error) return { error: "Error al eliminar" };
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
