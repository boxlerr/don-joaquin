"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Adjuntos de un viaje (remito / factura / otro). Mismo patrón que mantenimiento_archivos:
// el archivo se sube directo del navegador al Storage con URL firmada y acá solo se
// registran los metadatos en documentos_archivos + la fila puente en viaje_archivos.

const VIAJE_BUCKET = "documentos-viajes";

export type TipoArchivoViaje = "remito" | "factura" | "otro";

export type ArchivoMeta = {
  bucket: string;
  path: string;
  nombre_original: string;
  mime_type: string | null;
  tamano_bytes: number;
};

export type ArchivoViaje = {
  id: string;
  tipo: TipoArchivoViaje;
  nombre_original: string;
  url: string;
  tamano_bytes: number;
  mime_type: string | null;
  created_at: string;
};

/** URL firmada para subir un archivo de viaje directo navegador → Storage. */
export async function crearUrlSubidaViajeAction(
  input: { filename: string },
): Promise<{ signedUrl: string; token: string; path: string; bucket: string } | { error: string }> {
  await requireArea("viajes", "write");
  const supabase = createAdminClient();
  const ext =
    (input.filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `viajes/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(VIAJE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "No se pudo iniciar la subida del archivo" };
  return { signedUrl: data.signedUrl, token: data.token, path, bucket: VIAJE_BUCKET };
}

/** Registra (vincula) archivos ya subidos al Storage a un viaje, con su tipo. */
export async function vincularArchivosViajeAction(
  viajeId: string,
  tipo: TipoArchivoViaje,
  archivos: ArchivoMeta[],
): Promise<{ ok: boolean; vinculados?: number; error?: string }> {
  const user = await requireArea("viajes", "write");
  if (!viajeId || !archivos?.length) return { ok: false, error: "Datos incompletos." };
  const tipoFinal: TipoArchivoViaje = ["remito", "factura", "otro"].includes(tipo) ? tipo : "otro";
  const supabase = createAdminClient();

  let vinculados = 0;
  for (const archivo of archivos) {
    if (!archivo?.path) continue;
    const { data: archivoData, error: archivoError } = await supabase
      .from("documentos_archivos")
      .insert({
        bucket: archivo.bucket,
        nombre_original: archivo.nombre_original,
        path: archivo.path,
        tamano_bytes: archivo.tamano_bytes,
        mime_type: archivo.mime_type,
        subido_por: user.id,
      })
      .select("id")
      .single();

    if (archivoError || !archivoData) {
      await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linkError } = await (supabase as any)
      .from("viaje_archivos")
      .insert({ viaje_id: viajeId, archivo_id: archivoData.id, tipo: tipoFinal, created_by: user.id });

    if (linkError) {
      await supabase.from("documentos_archivos").delete().eq("id", archivoData.id);
      await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
      continue;
    }
    vinculados++;
  }

  revalidatePath("/viajes");
  return { ok: true, vinculados };
}

/** Lista los adjuntos de un viaje con URL pública para ver / descargar. */
export async function getArchivosViajeAction(viajeId: string): Promise<ArchivoViaje[]> {
  await requireArea("viajes", "read");
  if (!viajeId) return [];
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("viaje_archivos")
    .select("id, tipo, created_at, archivo:documentos_archivos!archivo_id(bucket, path, nombre_original, tamano_bytes, mime_type)")
    .eq("viaje_id", viajeId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error al cargar archivos del viaje:", error);
    return [];
  }
  type Row = {
    id: string;
    tipo: TipoArchivoViaje;
    created_at: string;
    archivo:
      | { bucket: string; path: string; nombre_original: string; tamano_bytes: number | null; mime_type: string | null }
      | { bucket: string; path: string; nombre_original: string; tamano_bytes: number | null; mime_type: string | null }[]
      | null;
  };
  return ((data ?? []) as Row[])
    .map((r): ArchivoViaje | null => {
      const archivo = Array.isArray(r.archivo) ? r.archivo[0] : r.archivo;
      if (!archivo) return null;
      const { data: pub } = supabase.storage.from(archivo.bucket).getPublicUrl(archivo.path);
      return {
        id: r.id,
        tipo: r.tipo,
        nombre_original: archivo.nombre_original,
        url: pub.publicUrl,
        tamano_bytes: archivo.tamano_bytes ?? 0,
        mime_type: archivo.mime_type,
        created_at: r.created_at,
      };
    })
    .filter((a): a is ArchivoViaje => a !== null);
}

/** Elimina un adjunto puntual de un viaje (fila puente + metadato + objeto). */
export async function deleteArchivoViajeAction(adjuntoId: string): Promise<{ ok: boolean; error?: string }> {
  await requireArea("viajes", "write");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adjunto, error: getErr } = await (supabase as any)
    .from("viaje_archivos")
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("id", adjuntoId)
    .single();
  if (getErr || !adjunto) return { ok: false, error: "Archivo no encontrado" };
  const archivo = Array.isArray(adjunto.archivo) ? adjunto.archivo[0] : adjunto.archivo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any).from("viaje_archivos").delete().eq("id", adjuntoId);
  if (delErr) return { ok: false, error: "No se pudo eliminar el archivo" };

  if (archivo) {
    await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
    await supabase.from("documentos_archivos").delete().eq("id", archivo.id);
  }
  revalidatePath("/viajes");
  return { ok: true };
}
