"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const BUCKET = "documentos-siniestros";

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
