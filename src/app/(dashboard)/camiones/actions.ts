"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/database";
import * as XLSX from "xlsx";
import { requireArea } from "@/lib/auth";

type CamionInsert = Database["public"]["Tables"]["camiones"]["Insert"];
type TercerizacionEstado = Database["public"]["Enums"]["tercerizacion_estado"];

// Mismas reglas que el backfill por marca de la migration de Fase 1.
// Bárbara puede sobrescribir manualmente desde la UI; esto es solo el default.
// NOTA: no exportar — este archivo tiene "use server" y Next exige que todo
// export sea async function. La copia client-side vive en AddCamionDialog.
function inferTercerizacionFromMarca(marca: string): TercerizacionEstado {
  const m = marca.trim().toLowerCase();
  if (m === "scania") return "tercerizado";
  if (m === "iveco") return "en_transicion";
  return "interno";
}

const FOTOS_BUCKET = "fotos-camiones";
const FOTO_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

function slugifyCamion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function addCamionAction(data: {
  patente: string;
  marca: string;
  modelo: string;
  ano: number;
  capacidad_tn: number;
  tipo_camion?: Database["public"]["Enums"]["camion_tipo"];
  estado: Database["public"]["Enums"]["camion_estado"];
  tercerizacion_estado?: TercerizacionEstado;
  es_tolva?: boolean;
  km_actual?: number | null;
}) {
  await requireArea("flota", "write");

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
    tercerizacion_estado: data.tercerizacion_estado ?? inferTercerizacionFromMarca(data.marca),
    es_tolva: data.es_tolva ?? false,
    km_actual: data.km_actual ?? null,
    created_by: user?.id ?? null,
  };

  const { data: inserted, error } = await supabase
    .from("camiones")
    .insert(camion)
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar camion:", error);
    return { error: "No se pudo guardar el camión. Verificá que la patente no esté repetida." };
  }

  await supabase.from("audit_log").insert({
    accion: "crear",
    entidad_tipo: "camion",
    entidad_id: inserted?.id ?? null,
    usuario_id: user?.id ?? null,
    valores_nuevos: data as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

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
  tercerizacion_estado?: TercerizacionEstado;
  es_tolva?: boolean;
  km_actual?: number | null;
}) {
  await requireArea("flota", "write");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: previo } = await supabase
    .from("camiones")
    .select("patente, marca, modelo, ano, capacidad_tn, tipo_camion, estado, tercerizacion_estado, es_tolva, km_actual")
    .eq("id", id)
    .single();

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
      tercerizacion_estado: data.tercerizacion_estado,
      es_tolva: data.es_tolva,
      km_actual: data.km_actual,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar camion:", error);
    return { error: friendlyCamionError(error.message) };
  }

  const cambioEstado = previo && previo.estado !== data.estado;
  await supabase.from("audit_log").insert({
    accion: cambioEstado ? "cambio_estado" : "actualizar",
    entidad_tipo: "camion",
    entidad_id: id,
    usuario_id: user?.id ?? null,
    valores_anteriores: previo as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_anteriores"],
    valores_nuevos: data as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

  revalidatePath("/camiones");
  return { success: true };
}

function friendlyCamionError(message: string): string {
  if (message.includes("camiones_patente_key")) return "Ya existe un camión con esa patente.";
  if (message.includes("camiones_capacidad_tn")) return "La capacidad ingresada no está permitida.";
  if (message.includes("camiones_ano_check")) return "El año ingresado no está permitido (debe ser ≥ 1980).";
  return `No se pudo actualizar el camión: ${message}`;
}

export async function deleteCamionAction(id: string) {
  await requireArea("flota", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: previo } = await supabase
    .from("camiones")
    .select("patente, marca, modelo, ano, capacidad_tn, tipo_camion, estado")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("camiones")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar camion:", error);
    return { error: "No se pudo eliminar el camión. Verificá que no tenga registros asociados (viajes, mantenimientos, etc)." };
  }

  await supabase.from("audit_log").insert({
    accion: "eliminar",
    entidad_tipo: "camion",
    entidad_id: id,
    usuario_id: user?.id ?? null,
    valores_anteriores: previo as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_anteriores"],
  });

  revalidatePath("/camiones");
  return { success: true };
}

const MANTENIMIENTO_TIPO_LABELS: Record<string, string> = {
  service_preventivo: "Mantenimiento Preventivo",
  reparacion: "Reparación",
  cambio_aceite: "Cambio de Aceite/Filtros",
  cubiertas: "Neumáticos",
  otro: "Otro",
};

// Mapeo de codigo del catálogo tipos_servicio → enum mantenimiento_tipo legacy.
// El enum se mantiene por compat: el feedback dice "todo medible" pero hay viajes,
// caja, listados y exports que ya leen `tipo` directamente. Cuando migremos todo
// a leer por FK, deprecaremos el enum y removeremos este mapeo.
function codigoServicioToEnum(codigo: string): Database["public"]["Enums"]["mantenimiento_tipo"] {
  switch (codigo) {
    case "service_preventivo":
    case "reparacion":
    case "cambio_aceite":
    case "cubiertas":
    case "otro":
      return codigo;
    case "gomeria":
      return "cubiertas";
    default:
      // filtro_aceite, filtro_aire, filtro_combustible, frenos, alineacion y cualquier
      // tipo nuevo que cree Bárbara → cae en "otro" hasta deprecar el enum.
      return "otro";
  }
}

export type TipoServicio = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  requiere_km: boolean;
  requiere_fecha: boolean;
  intervalo_km: number | null;
  intervalo_dias: number | null;
  aplica_a_tercerizado: boolean;
  orden: number;
};

export async function getTiposServicioAction(): Promise<TipoServicio[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tipos_servicio")
    .select(
      "id, codigo, nombre, descripcion, requiere_km, requiere_fecha, intervalo_km, intervalo_dias, aplica_a_tercerizado, orden"
    )
    .eq("estado", "activo")
    .order("orden");
  return (data ?? []).map((t) => ({
    ...t,
    intervalo_km: t.intervalo_km != null ? Number(t.intervalo_km) : null,
  })) as TipoServicio[];
}

export async function addServiceAction(data: {
  camion_id: string;
  fecha: string;
  tipo_servicio_id: string;
  km_odometro: number;
  proximo_service_km?: number;
  taller?: string;
  costo?: number;
  descripcion: string;
  observaciones?: string;
}) {
  await requireArea("flota", "write");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Derivar el enum legacy a partir del codigo del catálogo (mantiene compat
  // con el resto del código que lee `tipo` directamente).
  const { data: ts } = await supabase
    .from("tipos_servicio")
    .select("codigo, nombre")
    .eq("id", data.tipo_servicio_id)
    .single();

  if (!ts) return { error: "El tipo de servicio elegido ya no existe." };

  const tipoEnum = codigoServicioToEnum(ts.codigo);

  const { data: inserted, error } = await supabase.from("mantenimientos").insert({
    camion_id: data.camion_id,
    fecha: data.fecha,
    tipo: tipoEnum,
    tipo_servicio_id: data.tipo_servicio_id,
    km_odometro: data.km_odometro,
    proximo_service_km: data.proximo_service_km,
    taller: data.taller,
    costo: data.costo,
    descripcion: data.descripcion,
    observaciones: data.observaciones,
    moneda: "ARS",
    created_by: user?.id ?? null,
  }).select("id").single();

  if (error) {
    console.error("Error al insertar mantenimiento:", error);
    return { error: "No se pudo registrar el service." };
  }

  if (data.costo && data.costo > 0 && inserted) {
    const { data: camion } = await supabase.from("camiones").select("patente").eq("id", data.camion_id).single();
    // Etiqueta para caja: preferimos el nombre del catálogo (más rico que el enum).
    const tipoLabel = ts.nombre ?? MANTENIMIENTO_TIPO_LABELS[tipoEnum] ?? tipoEnum;
    const patenteLabel = camion?.patente ? ` - ${camion.patente}` : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("caja_movimientos").insert({
      tipo: "egreso",
      categoria: "gasto_operativo",
      concepto: `${tipoLabel}${patenteLabel}${data.taller ? ` (${data.taller})` : ""}`,
      monto: data.costo,
      medio: "otro",
      fecha: data.fecha,
      moneda: "ARS",
      mantenimiento_id: inserted.id,
      created_by: user?.id ?? null,
    });
  }

  revalidatePath("/camiones");
  revalidatePath("/caja");
  return { success: true };
}

export async function addGasoilAction(data: {
  camion_id: string;
  chofer_id?: string | null;
  fecha: string;
  litros: number;
  km_odometro: number;
  importe_total: number;
  estacion?: string;
  observaciones?: string;
}) {
  const user = await requireArea("combustible", "write");

  const supabase = createAdminClient();

  const { data: inserted, error } = await supabase.from("cargas_combustible").insert({
    camion_id: data.camion_id,
    chofer_id: data.chofer_id ?? null,
    fecha: data.fecha,
    litros: data.litros,
    km_odometro: data.km_odometro,
    importe_total: data.importe_total,
    estacion: data.estacion,
    observaciones: data.observaciones,
    moneda: "ARS",
    origen: "estacion_servicio",
    created_by: user.id,
  }).select("id").single();

  if (error) {
    console.error("Error al insertar carga combustible:", error);
    return { error: "No se pudo registrar la carga de combustible." };
  }

  if (inserted) {
    const { data: camion } = await supabase.from("camiones").select("patente").eq("id", data.camion_id).single();
    const patenteLabel = camion?.patente ? ` - ${camion.patente}` : "";
    const estacionLabel = data.estacion ? ` (${data.estacion})` : "";
    await supabase.from("caja_movimientos").insert({
      tipo: "egreso",
      categoria: "gasto_operativo",
      concepto: `Combustible ${data.litros}L${patenteLabel}${estacionLabel}`,
      monto: data.importe_total,
      medio: "otro",
      fecha: data.fecha,
      moneda: "ARS",
      carga_combustible_id: inserted.id,
      chofer_id: data.chofer_id ?? null,
      created_by: user.id,
    });
  }

  revalidatePath("/camiones");
  revalidatePath("/combustible");
  revalidatePath("/caja");
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
    .select(
      "id, fecha, tipo, tipo_servicio_id, km_odometro, proximo_service_km, descripcion, costo, taller, tipo_servicio:tipos_servicio(id, codigo, nombre)",
      { count: "exact" }
    )
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
  tipo_servicio_id: string;
  km_odometro: number;
  proximo_service_km?: number;
  taller?: string;
  costo?: number;
  descripcion: string;
  observaciones?: string;
}) {

  const supabase = createAdminClient();

  const { data: ts } = await supabase
    .from("tipos_servicio")
    .select("codigo")
    .eq("id", data.tipo_servicio_id)
    .single();

  if (!ts) return { error: "El tipo de servicio elegido ya no existe." };

  const tipoEnum = codigoServicioToEnum(ts.codigo);

  const { error } = await supabase
    .from("mantenimientos")
    .update({
      fecha: data.fecha,
      tipo: tipoEnum,
      tipo_servicio_id: data.tipo_servicio_id,
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
  chofer_id?: string | null;
  estacion?: string;
  observaciones?: string;
}) {
  await requireArea("combustible", "write");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cargas_combustible")
    .update({
      fecha: data.fecha,
      litros: data.litros,
      km_odometro: data.km_odometro,
      importe_total: data.importe_total,
      chofer_id: data.chofer_id ?? null,
      estacion: data.estacion,
      observaciones: data.observaciones,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar la carga de combustible." };
  revalidatePath("/camiones");
  revalidatePath("/combustible");
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
  await requireArea("combustible", "write");
  const supabase = createAdminClient();
  const { error } = await supabase.from("cargas_combustible").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la carga de combustible." };
  revalidatePath("/camiones");
  revalidatePath("/combustible");
  return { success: true };
}

export async function getGasoilHistoryAction(camionId: string, page = 0) {
  const supabase = createAdminClient();
  const from = page * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, estacion, chofer_id, observaciones", { count: "exact" })
    .eq("camion_id", camionId)
    .order("fecha", { ascending: false })
    .range(from, to);

  return {
    data: data || [],
    hasMore: (count ?? 0) > (page + 1) * HISTORY_PAGE_SIZE,
  };
}

// ============================================================================
// Fotos del camión
// ============================================================================

export async function getFotosCamionAction(camion_id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("camion_fotos")
    .select("id, descripcion, es_principal, created_at, archivo:documentos_archivos!archivo_id(bucket, path, nombre_original)")
    .eq("camion_id", camion_id)
    .order("es_principal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al cargar fotos:", error);
    return { fotos: [] };
  }

  const fotos = (data ?? []).map((row) => {
    const archivo = Array.isArray(row.archivo) ? row.archivo[0] : row.archivo;
    if (!archivo) return null;
    const { data: pub } = supabase.storage.from(archivo.bucket).getPublicUrl(archivo.path);
    return {
      id: row.id,
      url: pub.publicUrl,
      descripcion: row.descripcion,
      es_principal: row.es_principal,
      created_at: row.created_at,
      nombre_original: archivo.nombre_original,
    };
  }).filter((f): f is NonNullable<typeof f> => f !== null);

  return { fotos };
}

export async function uploadFotoCamionAction(formData: FormData) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const camion_id = formData.get("camion_id") as string;
  const descripcion = (formData.get("descripcion") as string | null)?.trim() || null;
  const file = formData.get("file") as File;

  if (!camion_id) return { error: "Camión requerido" };
  if (!file || !file.size) return { error: "Archivo requerido" };
  if (!file.type.startsWith("image/")) return { error: "Solo se permiten imágenes" };
  if (file.size > 5 * 1024 * 1024) return { error: "Máximo 5MB" };

  const ext = FOTO_MIME_EXT[file.type];
  if (!ext) return { error: "Formato no soportado (JPG, PNG, WEBP, GIF, HEIC)" };

  const { data: camion, error: camionErr } = await supabase
    .from("camiones")
    .select("patente")
    .eq("id", camion_id)
    .single();
  if (camionErr || !camion) return { error: "Camión no encontrado" };

  const carpeta = slugifyCamion(camion.patente);
  const storagePath = `${carpeta}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(FOTOS_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
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
    return { error: "Error al registrar el archivo" };
  }

  const { count: existentes } = await supabase
    .from("camion_fotos")
    .select("*", { count: "exact", head: true })
    .eq("camion_id", camion_id);

  const esPrimera = (existentes ?? 0) === 0;
  const { error: insertError } = await supabase.from("camion_fotos").insert({
    camion_id,
    archivo_id: archivoData.id,
    descripcion,
    es_principal: esPrimera,
    created_by: user?.id ?? null,
  });
  if (insertError) {
    await supabase.storage.from(FOTOS_BUCKET).remove([storagePath]);
    await supabase.from("documentos_archivos").delete().eq("id", archivoData.id);
    return { error: "Error al registrar la foto" };
  }

  const { data: pubFoto } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(storagePath);

  await supabase.from("audit_log").insert({
    accion: "foto_agregada",
    entidad_tipo: "camion",
    entidad_id: camion_id,
    usuario_id: user?.id ?? null,
    valores_nuevos: {
      archivo: file.name,
      nota: descripcion ?? null,
      es_principal: esPrimera,
      foto_url: pubFoto.publicUrl,
    } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

  revalidatePath("/camiones");
  return { success: true };
}

export async function setFotoPrincipalAction(foto_id: string, camion_id: string) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: foto } = await supabase
    .from("camion_fotos")
    .select("descripcion, archivo:documentos_archivos!archivo_id(nombre_original, bucket, path)")
    .eq("id", foto_id)
    .single();
  const archivoFp = Array.isArray(foto?.archivo) ? foto?.archivo[0] : foto?.archivo;
  const urlFp = archivoFp
    ? supabase.storage.from(archivoFp.bucket).getPublicUrl(archivoFp.path).data.publicUrl
    : null;

  const { error: clearError } = await supabase
    .from("camion_fotos")
    .update({ es_principal: false })
    .eq("camion_id", camion_id)
    .eq("es_principal", true);
  if (clearError) return { error: "No se pudo actualizar la foto principal" };

  const { error: setError } = await supabase
    .from("camion_fotos")
    .update({ es_principal: true })
    .eq("id", foto_id);
  if (setError) return { error: "No se pudo marcar la foto como principal" };

  await supabase.from("audit_log").insert({
    accion: "foto_principal",
    entidad_tipo: "camion",
    entidad_id: camion_id,
    usuario_id: user?.id ?? null,
    valores_nuevos: {
      archivo: archivoFp?.nombre_original ?? null,
      nota: foto?.descripcion ?? null,
      foto_url: urlFp,
    } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

  revalidatePath("/camiones");
  return { success: true };
}

export async function updateFotoDescripcionAction(foto_id: string, descripcion: string | null) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: previo } = await supabase
    .from("camion_fotos")
    .select("camion_id, descripcion, archivo:documentos_archivos!archivo_id(nombre_original, bucket, path)")
    .eq("id", foto_id)
    .single();
  const archivoUf = Array.isArray(previo?.archivo) ? previo?.archivo[0] : previo?.archivo;
  const urlUf = archivoUf
    ? supabase.storage.from(archivoUf.bucket).getPublicUrl(archivoUf.path).data.publicUrl
    : null;

  const desc = descripcion?.trim() || null;
  const { error } = await supabase
    .from("camion_fotos")
    .update({ descripcion: desc })
    .eq("id", foto_id);
  if (error) return { error: "No se pudo actualizar la nota" };

  if (previo?.camion_id) {
    await supabase.from("audit_log").insert({
      accion: "nota_foto",
      entidad_tipo: "camion",
      entidad_id: previo.camion_id,
      usuario_id: user?.id ?? null,
      valores_anteriores: {
        archivo: archivoUf?.nombre_original ?? null,
        nota: previo.descripcion ?? null,
        foto_url: urlUf,
      } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_anteriores"],
      valores_nuevos: {
        archivo: archivoUf?.nombre_original ?? null,
        nota: desc,
        foto_url: urlUf,
      } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
    });
  }

  revalidatePath("/camiones");
  return { success: true };
}

export async function deleteFotoCamionAction(foto_id: string) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: foto, error: getErr } = await supabase
    .from("camion_fotos")
    .select("camion_id, es_principal, descripcion, archivo:documentos_archivos!archivo_id(id, bucket, path, nombre_original)")
    .eq("id", foto_id)
    .single();
  if (getErr || !foto) return { error: "Foto no encontrada" };

  const archivo = Array.isArray(foto.archivo) ? foto.archivo[0] : foto.archivo;

  const { error: delFotoErr } = await supabase.from("camion_fotos").delete().eq("id", foto_id);
  if (delFotoErr) return { error: "No se pudo eliminar la foto" };

  if (archivo) {
    await supabase.storage.from(archivo.bucket).remove([archivo.path]);
    await supabase.from("documentos_archivos").delete().eq("id", archivo.id);
  }

  await supabase.from("audit_log").insert({
    accion: "foto_eliminada",
    entidad_tipo: "camion",
    entidad_id: foto.camion_id,
    usuario_id: user?.id ?? null,
    valores_anteriores: {
      archivo: archivo?.nombre_original ?? null,
      nota: foto.descripcion ?? null,
      era_principal: foto.es_principal,
    } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_anteriores"],
  });

  if (foto.es_principal) {
    const { data: siguiente } = await supabase
      .from("camion_fotos")
      .select("id")
      .eq("camion_id", foto.camion_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (siguiente) {
      await supabase
        .from("camion_fotos")
        .update({ es_principal: true })
        .eq("id", siguiente.id);
    }
  }

  revalidatePath("/camiones");
  return { success: true };
}

// ============================================================================
// Helpers
// ============================================================================

export async function getChoferesParaCargaAction(): Promise<
  { id: string; nombre: string; apellido: string }[]
> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido")
    .eq("estado", "activo")
    .order("apellido", { ascending: true });
  return (data ?? []) as { id: string; nombre: string; apellido: string }[];
}

export async function getUltimoKmCamionAction(camion_id: string): Promise<number | null> {
  const supabase = createAdminClient();
  const [{ data: ultimoService }, { data: ultimaCarga }] = await Promise.all([
    supabase
      .from("mantenimientos")
      .select("km_odometro")
      .eq("camion_id", camion_id)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cargas_combustible")
      .select("km_odometro")
      .eq("camion_id", camion_id)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const a = ultimoService?.km_odometro ?? null;
  const b = ultimaCarga?.km_odometro ?? null;
  if (a === null && b === null) return null;
  return Math.max(a ?? 0, b ?? 0);
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

export type ParsedImportRow = {
  rowNum: number;
  patente: string;
  marca: string;
  modelo: string;
  ano: number;
  capacidad_tn: number;
  tipo_camion: Database["public"]["Enums"]["camion_tipo"];
  estado: Database["public"]["Enums"]["camion_estado"];
  isValid: boolean;
  errorMsg?: string;
};

export async function previewCamionesImportAction(formData: FormData): Promise<{
  rows?: ParsedImportRow[];
  summary?: { validas: number; invalidas: number };
  error?: string;
}> {

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx o .csv." };
  }

  let raw: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "El archivo no contiene hojas." };
    raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { error: "No se pudo leer el archivo." };
  }

  if (raw.length === 0) return { error: "El archivo no contiene filas." };

  const rows: ParsedImportRow[] = raw.map((r, i) => {
    const rowNum = i + 2;
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(r)) {
      const target = CAMION_HEADER_MAP[normKeyCamion(key)];
      if (target) mapped[target] = value;
    }

    const patente = String(mapped.patente ?? "").trim().toUpperCase();
    const ano = Number(mapped.ano);
    const capacidad = Number(mapped.capacidad_tn);

    const base: ParsedImportRow = {
      rowNum,
      patente,
      marca: String(mapped.marca ?? "").trim(),
      modelo: String(mapped.modelo ?? "").trim(),
      ano: Number.isFinite(ano) ? ano : 0,
      capacidad_tn: Number.isFinite(capacidad) ? capacidad : 0,
      tipo_camion: normalizeTipo(mapped.tipo_camion),
      estado: normalizeEstado(mapped.estado),
      isValid: true,
    };

    if (!patente) return { ...base, isValid: false, errorMsg: "Falta patente" };
    if (!Number.isFinite(ano)) return { ...base, isValid: false, errorMsg: "Año inválido" };
    if (!Number.isFinite(capacidad) || capacidad <= 0)
      return { ...base, isValid: false, errorMsg: "Capacidad inválida" };
    return base;
  });

  const validas = rows.filter((r) => r.isValid).length;
  return { rows, summary: { validas, invalidas: rows.length - validas } };
}

export async function confirmCamionesImportAction(rows: ParsedImportRow[]): Promise<{
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}> {

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.isValid) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("camiones").insert({
      patente: r.patente,
      marca: r.marca,
      modelo: r.modelo,
      ano: r.ano,
      capacidad_tn: r.capacidad_tn,
      tipo_camion: r.tipo_camion,
      estado: r.estado,
      created_by: user?.id ?? null,
    });
    if (error) {
      skipped++;
      errors.push({ row: r.rowNum, message: error.message });
    } else {
      imported++;
    }
  }

  revalidatePath("/camiones");
  return { imported, skipped, errors };
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
