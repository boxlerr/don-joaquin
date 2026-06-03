"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logChoferAudit } from "./audit";
import * as XLSX from "xlsx";
import { normalizeDate, formatIsoDate, normKey } from "@/lib/excel-utils";

const CUIL_PREFIXES = ["20", "23", "24", "27", "30", "33", "34"];

function serverValidateChofer(data: {
  nombre: string;
  apellido: string;
  dni: string;
  cuil: string;
  telefono: string;
  localidad: string;
  fecha_ingreso: string;
}): string | null {
  if (!data.nombre.trim()) return "El nombre es requerido.";
  if (!data.apellido.trim()) return "El apellido es requerido.";
  if (!data.dni.trim()) return "El DNI es requerido.";
  const cuilDigits = data.cuil.replace(/\D/g, "");
  if (!cuilDigits) return "El CUIL es requerido.";
  if (cuilDigits.length !== 11) return "El CUIL debe tener 11 dígitos.";
  if (!CUIL_PREFIXES.includes(cuilDigits.slice(0, 2))) return "Prefijo de CUIL inválido.";
  const telDigits = data.telefono.replace(/\D/g, "");
  if (!telDigits) return "El teléfono es requerido.";
  if (telDigits.length < 10) return "El teléfono debe tener al menos 10 dígitos.";
  if (!data.localidad.trim()) return "La localidad es requerida.";
  if (!data.fecha_ingreso) return "La fecha de ingreso es requerida.";
  return null;
}

export async function addChoferAction(data: {
  nombre: string;
  apellido: string;
  dni: string;
  cuil: string;
  telefono: string;
  localidad: string;
  fecha_ingreso: string;
  estado: "activo" | "inactivo";
  rol: "chofer" | "administrativo" | "mantenimiento";
}) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const validationError = serverValidateChofer(data);
  if (validationError) return { error: validationError };

  const insertData = {
    nombre: data.nombre.trim(),
    apellido: data.apellido.trim(),
    dni: data.dni.trim(),
    cuil: data.cuil.trim(),
    telefono: data.telefono.trim(),
    localidad: data.localidad.trim(),
    fecha_ingreso: data.fecha_ingreso,
    estado: data.estado,
    rol: data.rol,
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
  const user = await requireArea("logistica", "write");
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
  const user = await requireArea("logistica", "write");
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

export type ChoferMotivoEgreso = "renuncia" | "despido" | "jubilacion" | "otro";

/**
 * Soft delete del chofer: lo marca como "baja" con motivo + fecha de egreso.
 * Es lo que llamamos "Egresar" en UI. Preserva el legajo y los registros asociados
 * (viajes, gastos, etc.) y lo mueve a la sección "Historial de choferes".
 */
export async function egresarChoferAction(
  id: string,
  data: { motivo: ChoferMotivoEgreso; fecha_egreso: string; observacion?: string }
) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("choferes")
    .select("estado, motivo_egreso, fecha_egreso, observaciones")
    .eq("id", id)
    .single();

  const observacionesActualizadas = data.observacion
    ? [previo?.observaciones, `Egreso: ${data.observacion}`].filter(Boolean).join("\n")
    : previo?.observaciones ?? null;

  const { error } = await supabase
    .from("choferes")
    .update({
      estado: "baja",
      motivo_egreso: data.motivo,
      fecha_egreso: data.fecha_egreso,
      observaciones: observacionesActualizadas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al egresar chofer:", error);
    return { error: "No se pudo egresar el chofer." };
  }

  await logChoferAudit(
    id,
    "cambio_estado",
    { estado: previo?.estado, motivo_egreso: previo?.motivo_egreso, fecha_egreso: previo?.fecha_egreso },
    { estado: "baja", motivo_egreso: data.motivo, fecha_egreso: data.fecha_egreso },
    user.id,
  );

  revalidatePath("/choferes");
  return { success: true };
}

/**
 * Reactiva a un chofer egresado: limpia motivo + fecha de egreso y vuelve a "activo".
 */
export async function reactivarChoferAction(id: string) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("choferes")
    .select("estado, motivo_egreso, fecha_egreso")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("choferes")
    .update({
      estado: "activo",
      motivo_egreso: null,
      fecha_egreso: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al reactivar chofer:", error);
    return { error: "No se pudo reactivar el chofer." };
  }

  await logChoferAudit(
    id,
    "cambio_estado",
    { estado: previo?.estado, motivo_egreso: previo?.motivo_egreso, fecha_egreso: previo?.fecha_egreso },
    { estado: "activo", motivo_egreso: null, fecha_egreso: null },
    user.id,
  );

  revalidatePath("/choferes");
  return { success: true };
}

export async function deleteChoferAction(id: string) {
  const user = await requireArea("logistica", "write");
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
  const user = await requireArea("logistica", "write");
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
  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

export async function deleteFotoChoferAction(chofer_id: string) {
  const user = await requireArea("logistica", "write");
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
  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

// ============================================================================
// Importación inteligente de Choferes / Licencias / Manuales
// ============================================================================

const NAME_FIXES: Record<string, string> = {
  "scwhindt": "schwindt",
  "pitanna eugenio": "pittana eugenio",
  "pitana maxi": "pittana maximiliano",
  "eugenio pitta": "pittana eugenio",
  "guilfor": "guilford pablo",
  "gustavo bermay": "bermay gustavo",
  "sebastian godoy": "godoy sebastian",
  "garmendia damian": "garmendia andres damian",
  "garmendia andres": "garmendia andres damian",
};

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixName(raw: string): string {
  const n = normalizeName(raw);
  return NAME_FIXES[n] ?? n;
}

type ChoferMatch = {
  id: string;
  apellido: string;
  nombre: string;
  cuil: string | null;
  dni: string | null;
};

function findDriverMatch(
  rawName: string,
  cuilOrDni: string | null,
  dbDrivers: ChoferMatch[]
): ChoferMatch | null {
  if (cuilOrDni) {
    const cleanNum = cuilOrDni.replace(/\D/g, "");
    if (cleanNum) {
      const found = dbDrivers.find((d) => {
        const dbCuil = d.cuil ? d.cuil.replace(/\D/g, "") : "";
        const dbDni = d.dni ? d.dni.replace(/\D/g, "") : "";
        return (
          (dbCuil && dbCuil === cleanNum) ||
          (dbDni && dbDni === cleanNum) ||
          (dbCuil.includes(cleanNum) && cleanNum.length >= 7)
        );
      });
      if (found) return found;
    }
  }

  const normName = normalizeName(rawName);
  if (!normName) return null;

  const tokens = normName.split(" ");
  const lastNameToken = tokens[0];
  const nextTokens = tokens.slice(1);

  let candidates = dbDrivers.filter((d) => {
    const dbAp = normalizeName(d.apellido);
    return dbAp === lastNameToken || dbAp.startsWith(lastNameToken + " ");
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1 && nextTokens.length > 0) {
    const exFirstNom = nextTokens[0] ?? "";
    let match = candidates.find((c) => {
      const dbNom = normalizeName(c.nombre);
      const dbNomTokens = dbNom.split(" ");
      const dbFirstNom = dbNomTokens[0] ?? "";
      return dbFirstNom.startsWith(exFirstNom) || exFirstNom.startsWith(dbFirstNom);
    });
    if (match) return match;

    match = candidates.find((c) => {
      const dbNom = normalizeName(c.nombre);
      const dbNomTokens = dbNom.split(" ");
      return dbNomTokens.some((tok) => tok.startsWith(exFirstNom) || exFirstNom.startsWith(tok));
    });
    if (match) return match;
  }

  const fixed = fixName(rawName);
  const fixedTokens = fixed.split(" ");
  const fixedLast = fixedTokens[0];
  candidates = dbDrivers.filter((d) => {
    const dbAp = normalizeName(d.apellido);
    return dbAp === fixedLast || dbAp.startsWith(fixedLast + " ");
  });
  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

const CHOFERES_HEADER_MAP: Record<string, string> = {
  dni: "dni",
  documento: "dni",
  cuil: "cuil",
  nombre: "nombre",
  apellido: "apellido",
  telefono: "telefono",
  celular: "telefono",
  localidad: "localidad",
  ciudad: "localidad",
  ingreso: "fecha_ingreso",
  "fecha ingreso": "fecha_ingreso",
  "fecha de ingreso": "fecha_ingreso",
  estado: "estado",
};

const DOCUMENTOS_HEADER_MAP: Record<string, string> = {
  chofer: "chofer",
  choferes: "chofer",
  nombre: "chofer",
  cuil: "cuil",
  dni: "cuil",
  lic: "vencimiento",
  licencia: "vencimiento",
  "venc c munic": "vencimiento",
  "venc c. munic": "vencimiento",
  "venc manual": "vencimiento",
  vencimiento: "vencimiento",
  "vencimiento manual": "vencimiento",
};

export type ParsedChoferImportRow = {
  rowNum: number;
  dni: string;
  cuil: string | null;
  nombre: string;
  apellido: string;
  telefono: string | null;
  localidad: string | null;
  fecha_ingreso: string | null;
  estado: "activo" | "inactivo" | "baja";
  isValid: boolean;
  errorMsg?: string;
  warningMsg?: string;
};

export type ParsedDocumentImportRow = {
  rowNum: number;
  choferExcel: string;
  cuilExcel: string | null;
  vencimientoExcel: string | null;
  fechaVencimiento: string | null;
  choferId: string | null;
  choferNombreDb: string | null;
  isValid: boolean;
  errorMsg?: string;
  warningMsg?: string;
};

export async function previewChoferesImportAction(formData: FormData): Promise<{
  detectedType: "choferes" | "licencias" | "manuales";
  choferesRows?: ParsedChoferImportRow[];
  documentRows?: ParsedDocumentImportRow[];
  summary?: { validas: number; invalidas: number };
  error?: string;
}> {
  await requireArea("logistica", "read");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx o .csv.", detectedType: "choferes" };
  }

  const filename = file.name.toUpperCase();
  let detectedType: "choferes" | "licencias" | "manuales";

  if (filename.includes("VENCIMIENTOS_CHOFERES")) {
    detectedType = "licencias";
  } else if (filename.includes("VENC_MANUALES")) {
    detectedType = "manuales";
  } else if (filename.includes("CHOFERES_VEHICULOS") || filename.includes("PATENTES_MODELOS_TN")) {
    detectedType = "choferes";
  } else {
    return {
      error: "Archivo no reconocido. Los archivos válidos para esta sección son: VENCIMIENTOS_CHOFERES, VENC_MANUALES, CHOFERES_VEHICULOS o PATENTES_MODELOS_TN.",
      detectedType: "choferes",
    };
  }

  let rows: any[][];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "El archivo no contiene hojas.", detectedType };
    rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  } catch {
    return { error: "No se pudo leer el archivo.", detectedType };
  }

  if (rows.length === 0) return { error: "El archivo no contiene filas.", detectedType };

  const supabase = createAdminClient();
  const { data: dbDrivers } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, cuil, dni");

  const driversList = (dbDrivers || []) as ChoferMatch[];

  // Intentar mapear columnas según el tipo detectado
  const headerMapToUse = detectedType === "choferes" ? CHOFERES_HEADER_MAP : DOCUMENTOS_HEADER_MAP;
  let colMap: Record<number, string> = {};
  let headerRowIndex = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row) continue;
    let matches = 0;
    const tempMap: Record<number, string> = {};
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val == null) continue;
      const cleanKey = normKey(String(val));
      const target = headerMapToUse[cleanKey];
      if (target) {
        tempMap[c] = target;
        matches++;
      }
    }
    if (matches >= 2) {
      colMap = tempMap;
      headerRowIndex = r;
      break;
    }
  }

  const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

  if (detectedType === "choferes") {
    const choferesRows: ParsedChoferImportRow[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const nonNullCells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
      if (nonNullCells.length === 0) continue;

      let dniRaw = "";
      let cuilRaw = "";
      let nombreRaw = "";
      let apellidoRaw = "";
      let telefonoRaw = "";
      let localidadRaw = "";
      let ingresoRaw: any = null;
      let estadoRaw = "";

      if (headerRowIndex !== -1) {
        for (const [colIdxStr, target] of Object.entries(colMap)) {
          const colIdx = Number(colIdxStr);
          const val = row[colIdx];
          if (val == null) continue;
          const strVal = String(val).trim();
          if (target === "dni") dniRaw = strVal;
          else if (target === "cuil") cuilRaw = strVal;
          else if (target === "nombre") nombreRaw = strVal;
          else if (target === "apellido") apellidoRaw = strVal;
          else if (target === "telefono") telefonoRaw = strVal;
          else if (target === "localidad") localidadRaw = strVal;
          else if (target === "fecha_ingreso") ingresoRaw = val;
          else if (target === "estado") estadoRaw = strVal;
        }
      } else {
        dniRaw = row[0] ? String(row[0]).trim() : "";
        apellidoRaw = row[1] ? String(row[1]).trim() : "";
        nombreRaw = row[2] ? String(row[2]).trim() : "";
        cuilRaw = row[3] ? String(row[3]).trim() : "";
        telefonoRaw = row[4] ? String(row[4]).trim() : "";
        localidadRaw = row[5] ? String(row[5]).trim() : "";
        ingresoRaw = row[6];
        estadoRaw = row[7] ? String(row[7]).trim() : "";
      }

      if (!dniRaw && !apellidoRaw && !nombreRaw) continue;

      // Saltar cabeceras repetidas
      if (normKey(dniRaw) === "dni" || normKey(dniRaw) === "documento" || normKey(apellidoRaw) === "apellido") {
        continue;
      }

      const cuilClean = cuilRaw.replace(/\D/g, "");
      let dniClean = dniRaw.replace(/\D/g, "");
      if (!dniClean && cuilClean && cuilClean.length === 11) {
        dniClean = cuilClean.substring(2, 10);
      }
      const dateObj = normalizeDate(ingresoRaw);
      const fechaIngreso = dateObj ? formatIsoDate(dateObj) : null;

      let warningMsg: string | undefined;
      if (ingresoRaw && !fechaIngreso) {
        warningMsg = `Fecha de ingreso no reconocida: "${ingresoRaw}"`;
      }

      // Normalizar estado
      let estado: "activo" | "inactivo" | "baja" = "activo";
      const cleanEst = estadoRaw.trim().toLowerCase();
      if (cleanEst.includes("inact") || cleanEst.includes("baja")) {
        estado = "inactivo";
      }

      const isValid = !!dniClean && !!nombreRaw && !!apellidoRaw;
      let errorMsg: string | undefined;
      if (!dniClean) errorMsg = "Falta DNI";
      else if (!apellidoRaw) errorMsg = "Falta Apellido";
      else if (!nombreRaw) errorMsg = "Falta Nombre";

      choferesRows.push({
        rowNum: i + 1,
        dni: dniClean,
        cuil: cuilClean || null,
        nombre: nombreRaw,
        apellido: apellidoRaw,
        telefono: telefonoRaw || null,
        localidad: localidadRaw || null,
        fecha_ingreso: fechaIngreso,
        estado,
        isValid,
        errorMsg,
        warningMsg,
      });
    }

    const validas = choferesRows.filter((r) => r.isValid).length;
    return {
      detectedType,
      choferesRows,
      summary: { validas, invalidas: choferesRows.length - validas },
    };
  } else {
    // licencias o manuales
    const documentRows: ParsedDocumentImportRow[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const nonNullCells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
      if (nonNullCells.length === 0) continue;

      let choferRaw = "";
      let cuilRaw = "";
      let vencimientoRaw: any = null;

      if (headerRowIndex !== -1) {
        for (const [colIdxStr, target] of Object.entries(colMap)) {
          const colIdx = Number(colIdxStr);
          const val = row[colIdx];
          if (val == null) continue;
          const strVal = String(val).trim();
          if (target === "chofer") choferRaw = strVal;
          else if (target === "cuil") cuilRaw = strVal;
          else if (target === "vencimiento") vencimientoRaw = val;
        }
      } else {
        choferRaw = row[0] ? String(row[0]).trim() : "";
        cuilRaw = row[1] ? String(row[1]).trim() : "";
        vencimientoRaw = row[2];
      }

      if (!choferRaw && !vencimientoRaw) continue;

      // Saltar cabeceras
      if (normKey(choferRaw) === "chofer" || normKey(choferRaw) === "nombre" || normKey(choferRaw) === "choferes") {
        continue;
      }

      // Emparejar chofer
      const matched = findDriverMatch(choferRaw, cuilRaw || null, driversList);

      const dateObj = normalizeDate(vencimientoRaw);
      const fechaVencimiento = dateObj ? formatIsoDate(dateObj) : null;

      let warningMsg: string | undefined;
      if (vencimientoRaw && !fechaVencimiento) {
        warningMsg = `Vencimiento no reconocido: "${vencimientoRaw}"`;
      }

      const isValid = !!matched && !!fechaVencimiento;
      let errorMsg: string | undefined;
      if (!matched) errorMsg = "Chofer no encontrado en el sistema";
      else if (!fechaVencimiento) errorMsg = "Falta Fecha de Vencimiento";

      documentRows.push({
        rowNum: i + 1,
        choferExcel: choferRaw,
        cuilExcel: cuilRaw || null,
        vencimientoExcel: vencimientoRaw ? String(vencimientoRaw) : null,
        fechaVencimiento,
        choferId: matched?.id ?? null,
        choferNombreDb: matched ? `${matched.apellido}, ${matched.nombre}` : null,
        isValid,
        errorMsg,
        warningMsg,
      });
    }

    const validas = documentRows.filter((r) => r.isValid).length;
    return {
      detectedType,
      documentRows,
      summary: { validas, invalidas: documentRows.length - validas },
    };
  }
}

export async function confirmChoferesImportAction(
  detectedType: "choferes" | "licencias" | "manuales",
  choferesRows: ParsedChoferImportRow[] | undefined,
  documentRows: ParsedDocumentImportRow[] | undefined
): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}> {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  if (detectedType === "choferes") {
    if (!choferesRows) return { imported, updated, skipped, errors };

    // Cargar choferes actuales para upsert lógico por DNI
    const { data: dbDrivers } = await supabase.from("choferes").select("id, dni");
    const dniMap = new Map<string, string>(); // dni -> id
    for (const d of dbDrivers || []) {
      if (d.dni) dniMap.set(d.dni.replace(/\D/g, ""), d.id);
    }

    for (const r of choferesRows) {
      if (!r.isValid) {
        skipped++;
        continue;
      }

      const payload = {
        dni: r.dni,
        cuil: r.cuil,
        nombre: r.nombre,
        apellido: r.apellido,
        telefono: r.telefono,
        localidad: r.localidad,
        estado: r.estado,
        updated_at: new Date().toISOString(),
      };

      const existingId = dniMap.get(r.dni);

      if (existingId) {
        const { error } = await supabase
          .from("choferes")
          .update(payload)
          .eq("id", existingId);

        if (error) {
          skipped++;
          errors.push({ row: r.rowNum, message: `Error al actualizar: ${error.message}` });
        } else {
          updated++;
          await logChoferAudit(existingId, "actualizar", null, payload, user.id);
        }
      } else {
        const { data: ins, error } = await supabase
          .from("choferes")
          .insert({ ...payload, fecha_ingreso: r.fecha_ingreso || new Date().toISOString().slice(0, 10) })
          .select("id")
          .single();

        if (error) {
          skipped++;
          errors.push({ row: r.rowNum, message: `Error al insertar: ${error.message}` });
        } else {
          imported++;
          if (ins?.id) {
            await logChoferAudit(ins.id, "crear", null, payload, user.id);
          }
        }
      }
    }
  } else {
    // licencias o manuales
    if (!documentRows) return { imported, updated, skipped, errors };

    const docCode = detectedType === "licencias" ? "licencia" : "manual_induccion";

    // Buscar tipo de documento en DB
    let { data: typeDoc } = await supabase
      .from("tipos_documento")
      .select("id")
      .eq("codigo", docCode)
      .maybeSingle();

    if (!typeDoc) {
      // Crear si no existe (robusto)
      const { data: newTypeDoc, error } = await supabase
        .from("tipos_documento")
        .insert({
          codigo: docCode,
          nombre: docCode === "licencia" ? "Licencia de conducir" : "Manual de Inducción",
          aplica_a: "chofer",
          estado: "activo",
        })
        .select("id")
        .single();
      if (error || !newTypeDoc) {
        return {
          imported,
          updated,
          skipped,
          errors: [{ row: 0, message: `No se pudo encontrar ni crear el tipo de documento: ${docCode}` }],
        };
      }
      typeDoc = newTypeDoc;
    }

    // Obtener documentos existentes de este tipo para upsert lógico
    const { data: dbDocs } = await supabase
      .from("chofer_documentos")
      .select("id, chofer_id")
      .eq("tipo_documento_id", typeDoc.id);

    const docMap = new Map<string, string>(); // chofer_id -> id_documento
    for (const d of dbDocs || []) {
      docMap.set(d.chofer_id, d.id);
    }

    for (const r of documentRows) {
      if (!r.isValid || !r.choferId || !r.fechaVencimiento) {
        skipped++;
        continue;
      }

      const payload = {
        chofer_id: r.choferId,
        tipo_documento_id: typeDoc.id,
        fecha_vencimiento: r.fechaVencimiento,
        observaciones: r.warningMsg ? `Vencimiento original: ${r.vencimientoExcel} (${r.warningMsg})` : null,
        updated_at: new Date().toISOString(),
      };

      const existingDocId = docMap.get(r.choferId);

      if (existingDocId) {
        const { error } = await supabase
          .from("chofer_documentos")
          .update(payload)
          .eq("id", existingDocId);

        if (error) {
          skipped++;
          errors.push({ row: r.rowNum, message: `Error al actualizar documento: ${error.message}` });
        } else {
          updated++;
        }
      } else {
        const { error } = await supabase
          .from("chofer_documentos")
          .insert(payload);

        if (error) {
          skipped++;
          errors.push({ row: r.rowNum, message: `Error al insertar documento: ${error.message}` });
        } else {
          imported++;
        }
      }
    }
  }

  revalidatePath("/choferes");
  return { imported, updated, skipped, errors };
}

