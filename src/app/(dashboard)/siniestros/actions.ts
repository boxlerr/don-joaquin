"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TipoSiniestro, EstadoSiniestro } from "./components/SiniestrosTable";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  crearUrlSubidaAdjunto,
  vincularAdjuntos,
  type AdjuntoCfg,
  type ArchivoMeta as AdjuntoArchivoMeta,
  type CrearUrlResult,
} from "@/lib/adjuntos-server";

export async function createSiniestroAction(data: {
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  tipo_siniestro: TipoSiniestro;
  tipo_siniestro_detalle: string | null;
  estado: EstadoSiniestro;
  descripcion: string;
  monto_danos: number | null;
  compania_seguro: string;
  numero_siniestro_seguro: string;
  terceros_involucrados: string;
}): Promise<{ error?: string; success?: true }> {
  await requireSeccion("siniestros", "write");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("siniestros")
    .insert({ ...data, created_by: user?.id ?? null })
    .select("id")
    .single();

  if (error) {
    console.error("Error al crear siniestro:", error);
    return { error: error.message };
  }

  await logAudit({
    client: supabase,
    usuarioId: user?.id ?? null,
    accion: "crear",
    entidadTipo: "siniestro",
    entidadId: inserted?.id ?? null,
    valoresNuevos: data,
  });

  revalidatePath("/siniestros");
  return { success: true };
}

export async function updateSiniestroAction(id: string, data: {
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  tipo_siniestro: TipoSiniestro;
  tipo_siniestro_detalle: string | null;
  estado: EstadoSiniestro;
  descripcion: string;
  monto_danos: number | null;
  compania_seguro: string;
  numero_siniestro_seguro: string;
  terceros_involucrados: string;
}): Promise<{ error?: string; success?: true }> {
  await requireSeccion("siniestros", "write");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("siniestros")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("siniestros").update(data).eq("id", id);

  if (error) {
    console.error("Error al actualizar siniestro:", error);
    return { error: error.message };
  }

  const antes = previo
    ? Object.fromEntries(Object.keys(data).map((k) => [k, (previo as Record<string, unknown>)[k]]))
    : null;
  await logAudit({
    client: supabase,
    usuarioId: user?.id ?? null,
    accion: "actualizar",
    entidadTipo: "siniestro",
    entidadId: id,
    valoresAnteriores: antes,
    valoresNuevos: data,
  });

  revalidatePath("/siniestros");
  return { success: true };
}

export async function deleteSiniestroAction(id: string): Promise<{ error?: string; success?: true }> {
  await requireSeccion("siniestros", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("siniestros")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("siniestros").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar siniestro:", error);
    return { error: error.message };
  }

  await logAudit({
    client: supabase,
    usuarioId: user?.id ?? null,
    accion: "eliminar",
    entidadTipo: "siniestro",
    entidadId: id,
    valoresAnteriores: previo ?? null,
  });

  revalidatePath("/siniestros");
  return { success: true };
}

export async function registrarPagoSiniestroAction(data: {
  siniestro_id: string;
  monto: number;
  fecha: string;
  medio: "efectivo" | "transferencia" | "cheque" | "otro";
  concepto: string;
  observaciones: string | null;
}): Promise<{ error?: string; success?: true }> {
  await requireSeccion("siniestros", "write");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mov, error } = await (supabase as any).from("caja_movimientos").insert({
    tipo: "egreso",
    categoria: "gasto_operativo",
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    fecha: data.fecha,
    moneda: "ARS",
    siniestro_id: data.siniestro_id,
    observaciones: data.observaciones,
    created_by: user?.id ?? null,
  })
    .select("id")
    .single();

  if (error) {
    console.error("Error al registrar pago de siniestro:", error);
    return { error: "No se pudo registrar el pago en caja." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user?.id ?? null,
    accion: "crear",
    entidadTipo: "caja",
    entidadId: mov?.id ?? null,
    valoresNuevos: {
      tipo: "egreso",
      categoria: "gasto_operativo",
      concepto: data.concepto,
      monto: data.monto,
      medio: data.medio,
      fecha: data.fecha,
    },
    metadata: { origen: "siniestro", siniestro_id: data.siniestro_id },
  });

  revalidatePath("/siniestros");
  revalidatePath("/caja");
  return { success: true };
}

const BUCKET = "documentos-siniestros";

// Adjuntos del siniestro (fotos, parte policial, informe, VIDEO, etc.) — varios.
// Vía URL firmada: sin el límite de ~4,5 MB del body de Server Action (permite videos).
const SINIESTRO_CFG: AdjuntoCfg = {
  bucket: BUCKET,
  junctionTable: "siniestro_archivos",
  entityColumn: "siniestro_id",
  folder: "siniestros",
};

export async function crearUrlSubidaSiniestroAction(input: {
  siniestro_id: string;
  filename: string;
}): Promise<CrearUrlResult> {
  await requireSeccion("siniestros", "write");
  return crearUrlSubidaAdjunto(SINIESTRO_CFG, input.filename, input.siniestro_id);
}

export async function vincularArchivosSiniestroAction(
  siniestro_id: string,
  descripcion: string | null,
  archivos: AdjuntoArchivoMeta[],
): Promise<{ ok: boolean; vinculados?: number; fallidos?: number; error?: string }> {
  const user = await requireSeccion("siniestros", "write");
  if (!siniestro_id || !archivos?.length) return { ok: false, error: "Datos incompletos." };
  const desc = descripcion?.trim() || null;
  const { vinculados, fallidos } = await vincularAdjuntos(
    SINIESTRO_CFG,
    siniestro_id,
    archivos,
    user.id,
    desc ? { descripcion: desc } : undefined,
  );
  revalidatePath("/siniestros");
  return { ok: true, vinculados, fallidos };
}

export type SiniestroArchivo = {
  id: string;
  descripcion: string | null;
  created_at: string;
  nombre_original: string;
  url: string;
  tamano_bytes: number;
  mime_type: string;
};

export async function getArchivosSiniestroAction(siniestro_id: string): Promise<SiniestroArchivo[]> {
  await requireSeccion("siniestros", "read");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("siniestro_archivos")
    .select("id, descripcion, created_at, archivo:documentos_archivos!archivo_id(bucket, path, nombre_original, tamano_bytes, mime_type)")
    .eq("siniestro_id", siniestro_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al cargar archivos de siniestro:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const archivo = Array.isArray(row.archivo) ? row.archivo[0] : row.archivo;
    if (!archivo) return null;
    const { data: pub } = supabase.storage.from(archivo.bucket).getPublicUrl(archivo.path);
    return {
      id: row.id,
      descripcion: row.descripcion,
      created_at: row.created_at,
      nombre_original: archivo.nombre_original,
      url: pub.publicUrl,
      tamano_bytes: archivo.tamano_bytes,
      mime_type: archivo.mime_type,
    };
  }).filter((a): a is SiniestroArchivo => a !== null);
}

export async function uploadArchivoSiniestroAction(formData: FormData): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const siniestro_id = formData.get("siniestro_id") as string;
  const descripcion = (formData.get("descripcion") as string | null)?.trim() || null;
  const file = formData.get("file") as File;

  if (!siniestro_id) return { error: "Siniestro requerido" };
  if (!file || !file.size) return { error: "Archivo requerido" };
  if (file.size > 20 * 1024 * 1024) return { error: "Máximo 20 MB por archivo" };

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `siniestros/${siniestro_id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Error al subir archivo:", uploadError);
    return { error: `Error al subir el archivo: ${uploadError.message}` };
  }

  const { data: archivoData, error: archivoError } = await supabase
    .from("documentos_archivos")
    .insert({
      bucket: BUCKET,
      nombre_original: file.name,
      path: storagePath,
      tamano_bytes: file.size,
      mime_type: file.type,
    })
    .select("id")
    .single();

  if (archivoError || !archivoData) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: "Error al registrar el archivo" };
  }

  const { error: insertError } = await supabase.from("siniestro_archivos").insert({
    siniestro_id,
    archivo_id: archivoData.id,
    descripcion,
    created_by: user?.id ?? null,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    await supabase.from("documentos_archivos").delete().eq("id", archivoData.id);
    return { error: "Error al guardar el archivo" };
  }

  revalidatePath("/siniestros");
  return { success: true };
}

export async function deleteArchivoSiniestroAction(adjunto_id: string): Promise<{ error?: string; success?: true }> {
  await requireSeccion("siniestros", "write");
  const supabase = createAdminClient();

  const { data: adjunto, error: getErr } = await supabase
    .from("siniestro_archivos")
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("id", adjunto_id)
    .single();

  if (getErr || !adjunto) return { error: "Archivo no encontrado" };

  const archivo = Array.isArray(adjunto.archivo) ? adjunto.archivo[0] : adjunto.archivo;

  const { error: delErr } = await supabase.from("siniestro_archivos").delete().eq("id", adjunto_id);
  if (delErr) return { error: "No se pudo eliminar el archivo" };

  if (archivo) {
    await supabase.storage.from(archivo.bucket).remove([archivo.path]);
    await supabase.from("documentos_archivos").delete().eq("id", archivo.id);
  }

  revalidatePath("/siniestros");
  return { success: true };
}
