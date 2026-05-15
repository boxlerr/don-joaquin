"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/database";
import * as XLSX from "xlsx";

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
  if (file.size > 10 * 1024 * 1024) return { error: "Máximo 10MB" };

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

export async function updateServiceAction(id: string, data: {
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
  const { error } = await supabase
    .from("mantenimientos")
    .update({
      fecha: data.fecha,
      tipo: data.tipo,
      km_odometro: data.km_odometro,
      proximo_service_km: data.proximo_service_km,
      taller: data.taller,
      costo: data.costo,
      descripcion: data.descripcion,
      observaciones: data.observaciones,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el service." };
  revalidatePath("/camiones");
  return { success: true };
}

export async function updateGasoilAction(id: string, data: {
  fecha: string;
  litros: number;
  km_odometro: number;
  importe_total: number;
  estacion?: string;
  observaciones?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cargas_combustible")
    .update({
      fecha: data.fecha,
      litros: data.litros,
      km_odometro: data.km_odometro,
      importe_total: data.importe_total,
      estacion: data.estacion,
      observaciones: data.observaciones,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar la carga de combustible." };
  revalidatePath("/camiones");
  return { success: true };
}

export async function deleteServiceAction(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("mantenimientos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el service." };
  revalidatePath("/camiones");
  return { success: true };
}

export async function deleteGasoilAction(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("cargas_combustible").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la carga de combustible." };
  revalidatePath("/camiones");
  return { success: true };
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

// ============================================================================
// Import / Export camiones
// ============================================================================

const CAMION_TIPOS = ["tractor", "chasis_rigido", "batea", "otro"] as const;
const CAMION_ESTADOS = ["activo", "inactivo", "baja", "en_mantenimiento"] as const;

function normalizeTipo(v: unknown): Database["public"]["Enums"]["camion_tipo"] {
  const s = String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CAMION_TIPOS as readonly string[]).includes(s))
    return s as Database["public"]["Enums"]["camion_tipo"];
  if (s.includes("tractor")) return "tractor";
  if (s.includes("chasis") || s.includes("rigido") || s.includes("rígido")) return "chasis_rigido";
  if (s.includes("batea")) return "batea";
  return "otro";
}

function normalizeEstado(v: unknown): Database["public"]["Enums"]["camion_estado"] {
  const s = String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CAMION_ESTADOS as readonly string[]).includes(s))
    return s as Database["public"]["Enums"]["camion_estado"];
  if (s.includes("baja")) return "baja";
  if (s.includes("manten")) return "en_mantenimiento";
  if (s.includes("inactiv")) return "inactivo";
  return "activo";
}

const CAMION_HEADER_MAP: Record<string, string> = {
  patente: "patente",
  marca: "marca",
  modelo: "modelo",
  año: "ano",
  ano: "ano",
  anio: "ano",
  "capacidad tn": "capacidad_tn",
  capacidad_tn: "capacidad_tn",
  capacidad: "capacidad_tn",
  tipo: "tipo_camion",
  "tipo camion": "tipo_camion",
  tipo_camion: "tipo_camion",
  estado: "estado",
};

function normKeyCamion(k: string): string {
  return k.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function importCamionesAction(formData: FormData): Promise<{
  ok?: boolean;
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  error?: string;
}> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx o .csv." };
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "El archivo no contiene hojas." };
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { error: "No se pudo leer el archivo." };
  }

  if (rows.length === 0) return { error: "El archivo no contiene filas." };

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2;
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      const target = CAMION_HEADER_MAP[normKeyCamion(key)];
      if (target) mapped[target] = value;
    }

    const patente = String(mapped.patente ?? "").trim().toUpperCase();
    if (!patente) {
      skipped++;
      errors.push({ row: rowNum, message: "Falta patente." });
      continue;
    }

    const ano = Number(mapped.ano);
    const capacidad = Number(mapped.capacidad_tn);
    if (!Number.isFinite(ano) || !Number.isFinite(capacidad)) {
      skipped++;
      errors.push({ row: rowNum, message: `Año o capacidad inválidos en patente ${patente}.` });
      continue;
    }

    const { error } = await supabase.from("camiones").insert({
      patente,
      marca: String(mapped.marca ?? "").trim(),
      modelo: String(mapped.modelo ?? "").trim(),
      ano,
      capacidad_tn: capacidad,
      tipo_camion: normalizeTipo(mapped.tipo_camion),
      estado: normalizeEstado(mapped.estado),
      created_by: user?.id ?? null,
    });

    if (error) {
      skipped++;
      errors.push({ row: rowNum, message: error.message });
    } else {
      imported++;
    }
  }

  revalidatePath("/camiones");
  return { ok: true, imported, skipped, errors };
}

export async function exportCamionesAction(): Promise<{
  filename: string;
  base64: string;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("camiones")
    .select("patente, marca, modelo, ano, capacidad_tn, tipo_camion, estado, created_at")
    .order("patente");

  const rows = (data ?? []).map((c) => ({
    Patente: c.patente,
    Marca: c.marca,
    Modelo: c.modelo,
    "Año": c.ano,
    "Capacidad TN": c.capacidad_tn,
    Tipo: c.tipo_camion,
    Estado: c.estado,
    Alta: c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Camiones");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `camiones-${date}.xlsx`,
    base64: buf.toString("base64"),
  };
}
