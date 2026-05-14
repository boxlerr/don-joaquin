"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/database";

type CamionInsert = Database["public"]["Tables"]["camiones"]["Insert"];

export async function addCamionAction(data: {
  patente: string;
  marca: string;
  modelo: string;
  ano: number;
  capacidad_tn: number;
  tipo_camion?: Database["public"]["Enums"]["camion_tipo"];
  estado: Database["public"]["Enums"]["camion_estado"];
}) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const camion: CamionInsert = {
    patente: data.patente,
    marca: data.marca,
    modelo: data.modelo,
    ano: data.ano,
    capacidad_tn: data.capacidad_tn,
    tipo_camion: data.tipo_camion,
    estado: data.estado,
    created_by: user?.id ?? null,
  };

  const { error } = await supabase.from("camiones").insert(camion);

  if (error) {
    console.error("Error al insertar camion:", error);
    return { error: "No se pudo guardar el camión. Verificá que la patente no esté repetida." };
  }

  revalidatePath("/camiones");
  return { success: true };
}

export async function updateCamionAction(id: string, data: {
  patente: string;
  marca: string;
  modelo: string;
  ano: number;
  capacidad_tn: number;
  tipo_camion?: Database["public"]["Enums"]["camion_tipo"];
  estado: Database["public"]["Enums"]["camion_estado"];
}) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("camiones")
    .update({
      patente: data.patente,
      marca: data.marca,
      modelo: data.modelo,
      ano: data.ano,
      capacidad_tn: data.capacidad_tn,
      tipo_camion: data.tipo_camion,
      estado: data.estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar camion:", error);
    return { error: "No se pudo actualizar el camión." };
  }

  revalidatePath("/camiones");
  return { success: true };
}

export async function deleteCamionAction(id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("camiones")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar camion:", error);
    return { error: "No se pudo eliminar el camión. Verificá que no tenga registros asociados (viajes, mantenimientos, etc)." };
  }

  revalidatePath("/camiones");
  return { success: true };
}

export async function addServiceAction(data: {
  camion_id: string;
  fecha: string;
  tipo: Database["public"]["Enums"]["mantenimiento_tipo"];
  km_odometro: number;
  proximo_service_km?: number;
  taller?: string;
  costo?: number;
  descripcion: string;
  observaciones?: string;
}) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { error } = await supabase.from("mantenimientos").insert({
    camion_id: data.camion_id,
    fecha: data.fecha,
    tipo: data.tipo,
    km_odometro: data.km_odometro,
    proximo_service_km: data.proximo_service_km,
    taller: data.taller,
    costo: data.costo,
    descripcion: data.descripcion,
    observaciones: data.observaciones,
    moneda: "ARS",
    created_by: user?.id ?? null,
  });

  if (error) {
    console.error("Error al insertar mantenimiento:", error);
    return { error: "No se pudo registrar el service." };
  }

  revalidatePath("/camiones");
  return { success: true };
}

export async function addGasoilAction(data: {
  camion_id: string;
  fecha: string;
  litros: number;
  km_odometro: number;
  importe_total: number;
  estacion?: string;
  observaciones?: string;
}) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { error } = await supabase.from("cargas_combustible").insert({
    camion_id: data.camion_id,
    fecha: data.fecha,
    litros: data.litros,
    km_odometro: data.km_odometro,
    importe_total: data.importe_total,
    estacion: data.estacion,
    observaciones: data.observaciones,
    moneda: "ARS",
    origen: "estacion_servicio",
    created_by: user?.id ?? null,
  });

  if (error) {
    console.error("Error al insertar carga combustible:", error);
    return { error: "No se pudo registrar la carga de combustible." };
  }

  revalidatePath("/camiones");
  return { success: true };
}

export async function getCamionDocumentosAction(camion_id: string) {
  const supabase = createAdminClient();

  const [{ data: docs }, { data: tipos }] = await Promise.all([
    supabase
      .from("v_camion_documentos_vigencia")
      .select("id, tipo_documento, tipo_documento_codigo, fecha_vencimiento, dias_restantes, estado_vigencia, numero")
      .eq("camion_id", camion_id),

    supabase
      .from("tipos_documento")
      .select("id, nombre, codigo")
      .eq("aplica_a", "camion")
      .eq("estado", "activo"),
  ]);

  return {
    documentos: docs ?? [],
    tipos: tipos ?? [],
  };
}

export async function uploadDocumentoCamionAction(formData: FormData) {
  const supabase = createAdminClient();

  const camion_id = formData.get("camion_id") as string;
  const tipo_nombre_custom = formData.get("tipo_nombre_custom") as string | null;
  let tipo_documento_id = formData.get("tipo_documento_id") as string;
  const file = formData.get("file") as File;
  const numero = formData.get("numero") as string | null;
  const fecha_vencimiento = formData.get("fecha_vencimiento") as string | null;
  const fecha_emision = formData.get("fecha_emision") as string | null;

  if (!file || !file.size) return { error: "Archivo requerido" };
  if (!file.type.startsWith("application/pdf") && !file.type.startsWith("image/"))
    return { error: "Solo se permiten PDF e imágenes" };
  if (file.size > 5 * 1024 * 1024) return { error: "Máximo 5MB" };

  if (tipo_nombre_custom) {
    const nombreNorm = tipo_nombre_custom.trim();
    if (!nombreNorm) return { error: "El nombre del tipo de documento no puede estar vacío" };

    const { data: existente } = await supabase
      .from("tipos_documento")
      .select("id")
      .eq("nombre", nombreNorm)
      .eq("aplica_a", "camion")
      .maybeSingle();

    if (existente) {
      tipo_documento_id = existente.id;
    } else {
      const codigoBase = nombreNorm
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "")
        .slice(0, 30);

      const { data: nuevo, error: crearError } = await supabase
        .from("tipos_documento")
        .insert({
          nombre: nombreNorm,
          codigo: `CUSTOM_${codigoBase}_${Date.now()}`,
          aplica_a: "camion",
          estado: "activo",
        })
        .select("id")
        .single();

      if (crearError || !nuevo) return { error: "No se pudo crear el tipo de documento" };
      tipo_documento_id = nuevo.id;
    }
  }

  if (!tipo_documento_id) return { error: "Tipo de documento requerido" };

  const ext = file.name.split(".").pop();
  const storagePath = `camiones/${camion_id}/${tipo_documento_id}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documentos-personal")
    .upload(storagePath, file);
  if (uploadError) return { error: "Error al subir el archivo" };

  const { data: archivoData, error: archivoError } = await supabase
    .from("documentos_archivos")
    .insert({
      bucket: "documentos-personal",
      nombre_original: file.name,
      path: storagePath,
      tamano_bytes: file.size,
      mime_type: file.type,
    })
    .select("id")
    .single();
  if (archivoError || !archivoData) return { error: "Error al registrar el archivo" };

  const { error: dbError } = await supabase.from("camion_documentos").insert({
    camion_id,
    tipo_documento_id,
    numero: numero || null,
    fecha_emision: fecha_emision || null,
    fecha_vencimiento: fecha_vencimiento || null,
    archivo_id: archivoData.id,
  });
  if (dbError) return { error: "Error al guardar el documento" };

  revalidatePath("/camiones");
  return { success: true };
}

export async function deleteDocumentoCamionAction(doc_id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("camion_documentos")
    .delete()
    .eq("id", doc_id);
  if (error) return { error: "No se pudo eliminar el documento" };

  revalidatePath("/camiones");
  return { success: true };
}

const HISTORY_PAGE_SIZE = 20;

export async function getServiceHistoryAction(camionId: string, page = 0) {
  const supabase = createAdminClient();
  const from = page * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("mantenimientos")
    .select("id, fecha, tipo, km_odometro, descripcion, costo, taller", { count: "exact" })
    .eq("camion_id", camionId)
    .order("fecha", { ascending: false })
    .range(from, to);

  return {
    data: data || [],
    hasMore: (count ?? 0) > (page + 1) * HISTORY_PAGE_SIZE,
  };
}

export async function getGasoilHistoryAction(camionId: string, page = 0) {
  const supabase = createAdminClient();
  const from = page * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, estacion", { count: "exact" })
    .eq("camion_id", camionId)
    .order("fecha", { ascending: false })
    .range(from, to);

  return {
    data: data || [],
    hasMore: (count ?? 0) > (page + 1) * HISTORY_PAGE_SIZE,
  };
}
