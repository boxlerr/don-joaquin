"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import type {
  ComplianceCliente,
  ComplianceEstadoRow,
  ComplianceHistorialDoc,
  ComplianceRequisito,
} from "./types";

function clienteToEnum(c: ComplianceCliente): "YPF" | "LOMA_NEGRA" {
  return c;
}

export async function getComplianceEstadoAction(cliente: ComplianceCliente): Promise<{
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
}> {
  await requireArea("compliance", "read");
  const supabase = createAdminClient();

  const clienteEnum = clienteToEnum(cliente);

  const [rowsRes, reqRes] = await Promise.all([
    supabase
      .from("v_compliance_estado")
      .select("*")
      .in("cliente_aplica", ["AMBOS", clienteEnum])
      .order("nivel", { ascending: true })
      .order("requisito_codigo", { ascending: true }),
    supabase
      .from("compliance_requisitos")
      .select("*")
      .eq("activo", true)
      .in("cliente_aplica", ["AMBOS", clienteEnum])
      .order("orden", { ascending: true }),
  ]);

  return {
    rows: (rowsRes.data as ComplianceEstadoRow[] | null) ?? [],
    requisitos: (reqRes.data as ComplianceRequisito[] | null) ?? [],
  };
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
  const file = formData.get("file") as File;

  if (!requisito_id) return { error: "Requisito requerido" };
  if (!fecha_vencimiento) return { error: "Fecha de vencimiento requerida" };
  if (!file || !file.size) return { error: "Archivo requerido" };
  if (file.size > 10 * 1024 * 1024) return { error: "Máximo 10MB" };

  const { data: req } = await supabase
    .from("compliance_requisitos")
    .select("nivel, codigo, tipo_documento_id")
    .eq("id", requisito_id)
    .single();
  if (!req) return { error: "Requisito no encontrado" };

  if (req.nivel === "chofer" && !chofer_id) return { error: "Chofer requerido para este requisito" };
  if (req.nivel === "unidad" && !camion_id) return { error: "Camión requerido para este requisito" };
  if (req.nivel === "empresa" && (chofer_id || camion_id)) {
    return { error: "Los requisitos de empresa no llevan chofer ni camión" };
  }

  const ext = file.name.split(".").pop();

  // Cuando el requisito está mapeado a un tipo_documento existente, el PDF
  // se guarda en chofer_documentos / camion_documentos (no en compliance_documentos).
  // Esto evita duplicar el archivo: aparece tanto en el legajo como en compliance,
  // porque v_compliance_estado cruza ambas fuentes.
  const usaLegajo = !!req.tipo_documento_id;

  const storagePath = usaLegajo
    ? req.nivel === "chofer"
      ? `choferes/${chofer_id}/${req.tipo_documento_id}_${Date.now()}.${ext}`
      : `camiones/${camion_id}/${req.tipo_documento_id}_${Date.now()}.${ext}`
    : `compliance/${req.codigo}/${chofer_id ?? camion_id ?? "empresa"}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documentos-personal")
    .upload(storagePath, file);
  if (uploadError) return { error: "Error al subir el archivo" };

  const { data: archivo, error: archivoError } = await supabase
    .from("documentos_archivos")
    .insert({
      bucket: "documentos-personal",
      nombre_original: file.name,
      path: storagePath,
      tamano_bytes: file.size,
      mime_type: file.type,
      subido_por: user.id,
    })
    .select("id")
    .single();
  if (archivoError || !archivo) return { error: "Error al registrar el archivo" };

  if (usaLegajo && req.nivel === "chofer") {
    const { error: dbError } = await supabase.from("chofer_documentos").insert({
      chofer_id: chofer_id!,
      tipo_documento_id: req.tipo_documento_id!,
      numero,
      fecha_emision,
      fecha_vencimiento,
      archivo_id: archivo.id,
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
      archivo_id: archivo.id,
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
      archivo_id: archivo.id,
      observaciones,
      created_by: user.id,
    });
    if (dbError) return { error: "Error al guardar el documento" };
  }

  revalidatePath("/compliance/loma-negra");
  revalidatePath("/compliance/ypf");
  revalidatePath("/compliance/organismos", "layout");
  return { success: true };
}

export async function deleteComplianceDocAction(doc_id: string) {
  await requireArea("compliance", "admin");
  const supabase = createAdminClient();
  const { error } = await supabase.from("compliance_documentos").delete().eq("id", doc_id);
  if (error) return { error: "Error al eliminar" };
  revalidatePath("/compliance/loma-negra");
  revalidatePath("/compliance/ypf");
  revalidatePath("/compliance/organismos", "layout");
  return { success: true };
}

export async function getSignedUrlComplianceArchivoAction(archivo_id: string) {
  await requireArea("compliance", "read");
  const supabase = createAdminClient();
  const { data: arch } = await supabase
    .from("documentos_archivos")
    .select("bucket, path")
    .eq("id", archivo_id)
    .single();
  if (!arch) return { error: "Archivo no encontrado" };
  const { data, error } = await supabase.storage.from(arch.bucket).createSignedUrl(arch.path, 60);
  if (error || !data) return { error: "No se pudo generar el link" };
  return { url: data.signedUrl };
}
