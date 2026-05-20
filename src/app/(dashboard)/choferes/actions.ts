"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logChoferAudit } from "./audit";

export async function addChoferAction(data: {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  localidad?: string;
  fecha_ingreso: string;
  estado: "activo" | "inactivo";
}) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const insertData = {
    nombre: data.nombre,
    apellido: data.apellido,
    dni: data.dni,
    telefono: data.telefono || null,
    localidad: data.localidad || null,
    fecha_ingreso: data.fecha_ingreso,
    estado: data.estado,
  };

  const { data: inserted, error } = await supabase
    .from("choferes")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar chofer:", error);
    return { error: "No se pudo registrar el chofer. Verificá que el DNI no esté duplicado." };
  }

  if (inserted?.id) {
    await logChoferAudit(inserted.id, "crear", null, insertData, user.id);
  }

  revalidatePath("/choferes");
  return { success: true };
}

export async function updateChoferAction(id: string, data: {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  localidad?: string;
  estado: "activo" | "inactivo";
}) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("choferes")
    .select("nombre, apellido, dni, telefono, localidad, estado")
    .eq("id", id)
    .single();

  const updateData = {
    nombre: data.nombre,
    apellido: data.apellido,
    dni: data.dni,
    telefono: data.telefono || null,
    localidad: data.localidad || null,
    estado: data.estado,
  };

  const { error } = await supabase
    .from("choferes")
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar chofer:", error);
    return { error: "No se pudo actualizar los datos del chofer." };
  }

  const cambioEstado = previo && previo.estado !== data.estado;
  await logChoferAudit(
    id,
    cambioEstado ? "cambio_estado" : "actualizar",
    previo ?? null,
    updateData,
    user.id,
  );

  revalidatePath("/choferes");
  return { success: true };
}

export async function updateChoferEstadoAction(id: string, estado: "activo" | "inactivo") {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("choferes")
    .select("estado")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("choferes")
    .update({
      estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al cambiar estado de chofer:", error);
    return { error: "No se pudo cambiar el estado del chofer." };
  }

  if (previo && previo.estado !== estado) {
    await logChoferAudit(
      id,
      "cambio_estado",
      { estado: previo.estado },
      { estado },
      user.id,
    );
  }

  revalidatePath("/choferes");
  return { success: true };
}

export async function deleteChoferAction(id: string) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("choferes")
    .select("nombre, apellido, dni, telefono, localidad, email, domicilio, provincia, fecha_ingreso, estado")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("choferes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar chofer:", error);
    return { error: "No se pudo eliminar el chofer. Es posible que tenga registros o viajes asociados." };
  }

  await logChoferAudit(id, "eliminar", previo ?? null, null, user.id);

  revalidatePath("/choferes");
  return { success: true };
}

const FOTOS_BUCKET = "avatares-choferes";
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function uploadFotoChoferAction(formData: FormData) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const chofer_id = formData.get("chofer_id") as string;
  const file = formData.get("file") as File;

  if (!chofer_id) return { error: "Chofer requerido" };
  if (!file || !file.size) return { error: "Archivo requerido" };
  if (!file.type.startsWith("image/")) return { error: "Solo se permiten imágenes" };
  if (file.size > 5 * 1024 * 1024) return { error: "Máximo 5MB" };

  const ext = MIME_EXT[file.type];
  if (!ext) return { error: "Formato no soportado (usá JPG, PNG, WEBP, GIF o HEIC)" };

  const { data: chofer, error: choferErr } = await supabase
    .from("choferes")
    .select("nombre, apellido, dni, foto_id")
    .eq("id", chofer_id)
    .single();
  if (choferErr || !chofer) return { error: "Chofer no encontrado" };

  const carpeta = `${slugify(chofer.apellido)}-${slugify(chofer.nombre)}-${chofer.dni}`;
  const storagePath = `${carpeta}/avatar-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(FOTOS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadError) {
    console.error("Error al subir foto:", uploadError);
    return { error: `Error al subir la foto: ${uploadError.message}` };
  }

  const { data: archivoData, error: archivoError } = await supabase
    .from("documentos_archivos")
    .insert({
      bucket: FOTOS_BUCKET,
      nombre_original: file.name,
      path: storagePath,
      tamano_bytes: file.size,
      mime_type: file.type,
    })
    .select("id")
    .single();
  if (archivoError || !archivoData) {
    await supabase.storage.from(FOTOS_BUCKET).remove([storagePath]);
    console.error("Error al registrar archivo:", archivoError);
    return { error: "Error al registrar el archivo" };
  }

  const fotoIdPrevia = chofer.foto_id;

  const { error: dbError } = await supabase
    .from("choferes")
    .update({
      foto_id: archivoData.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chofer_id);
  if (dbError) {
    await supabase.storage.from(FOTOS_BUCKET).remove([storagePath]);
    await supabase.from("documentos_archivos").delete().eq("id", archivoData.id);
    console.error("Error al actualizar chofer:", dbError);
    return { error: "Error al guardar la foto en el chofer" };
  }

  if (fotoIdPrevia) {
    const { data: previo } = await supabase
      .from("documentos_archivos")
      .select("bucket, path")
      .eq("id", fotoIdPrevia)
      .single();
    if (previo) {
      await supabase.storage.from(previo.bucket).remove([previo.path]);
      await supabase.from("documentos_archivos").delete().eq("id", fotoIdPrevia);
    }
  }

  const { data: publicUrl } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(storagePath);
  await logChoferAudit(
    chofer_id,
    "foto_agregada",
    null,
    {
      archivo: file.name,
      foto_url: publicUrl?.publicUrl ?? null,
    },
    user.id,
  );

  revalidatePath("/choferes");
  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function deleteFotoChoferAction(chofer_id: string) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { data: chofer, error: choferErr } = await supabase
    .from("choferes")
    .select("foto_id")
    .eq("id", chofer_id)
    .single();
  if (choferErr || !chofer) return { error: "Chofer no encontrado" };
  if (!chofer.foto_id) return { success: true };

  const { data: archivo } = await supabase
    .from("documentos_archivos")
    .select("bucket, path")
    .eq("id", chofer.foto_id)
    .single();

  const { error: updErr } = await supabase
    .from("choferes")
    .update({ foto_id: null, updated_at: new Date().toISOString() })
    .eq("id", chofer_id);
  if (updErr) return { error: "No se pudo desvincular la foto" };

  let fotoUrl: string | null = null;
  if (archivo) {
    const { data: publicUrl } = supabase.storage
      .from(archivo.bucket)
      .getPublicUrl(archivo.path);
    fotoUrl = publicUrl?.publicUrl ?? null;
    await supabase.storage.from(archivo.bucket).remove([archivo.path]);
    await supabase.from("documentos_archivos").delete().eq("id", chofer.foto_id);
  }

  await logChoferAudit(
    chofer_id,
    "foto_eliminada",
    { foto_url: fotoUrl },
    null,
    user.id,
  );

  revalidatePath("/choferes");
  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}
