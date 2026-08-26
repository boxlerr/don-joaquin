import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { urlesFirmadas, claveArchivo } from "@/lib/storage-urls";

/**
 * Infra compartida para adjuntar VARIOS archivos a cualquier entidad, prolijo y
 * consistente en todo el sistema.
 *
 * Modelo: cada entidad tiene una tabla puente `<entidad>_archivos(<entidad>_id,
 * archivo_id → documentos_archivos)`. El archivo se sube directo navegador →
 * Storage con URL firmada (evita el límite de body de Vercel) y acá solo se
 * registran metadatos + la fila puente. Storage prolijo: `{carpeta}/{entidad_id}/{uuid}.{ext}`,
 * con el nombre real preservado en `documentos_archivos.nombre_original`.
 *
 * Estas funciones NO son Server Actions: son helpers que llaman las actions de
 * cada entidad DESPUÉS de validar permisos (cada entidad decide su área/permiso).
 */

export type AdjuntoCfg = {
  /** Bucket del Storage donde viven los archivos de esta entidad. */
  bucket: string;
  /** Tabla puente, ej: "apercibimiento_archivos". */
  junctionTable: string;
  /** Columna FK a la entidad en la tabla puente, ej: "apercibimiento_id". */
  entityColumn: string;
  /** Carpeta raíz en el bucket, ej: "apercibimientos". */
  folder: string;
};

export type ArchivoMeta = {
  bucket: string;
  path: string;
  nombre_original: string;
  mime_type: string | null;
  tamano_bytes: number;
};

export type AdjuntoExistente = {
  id: string;
  nombre_original: string;
  /** URL para VER inline (imágenes, PDF, video se previsualizan en el navegador). */
  url: string;
  /** URL para DESCARGAR con el nombre real (no el UUID del Storage). */
  downloadUrl: string;
  tamano_bytes: number;
  mime_type: string | null;
  created_at: string;
};

export type CrearUrlResult =
  | { signedUrl: string; token: string; path: string; bucket: string }
  | { error: string };

function extDe(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

/**
 * URL firmada para subir un archivo directo del navegador al Storage. `entidadId`
 * es opcional: si la entidad todavía no existe (alta), los archivos van a la
 * carpeta raíz igual y quedan vinculados al crear la entidad.
 */
export async function crearUrlSubidaAdjunto(
  cfg: AdjuntoCfg,
  filename: string,
  entidadId?: string | null,
): Promise<CrearUrlResult> {
  const supabase = createAdminClient();
  const uuid = crypto.randomUUID();
  const path = entidadId
    ? `${cfg.folder}/${entidadId}/${uuid}.${extDe(filename)}`
    : `${cfg.folder}/${uuid}.${extDe(filename)}`;
  const { data, error } = await supabase.storage.from(cfg.bucket).createSignedUploadUrl(path);
  if (error || !data) return { error: "No se pudo iniciar la subida del archivo" };
  return { signedUrl: data.signedUrl, token: data.token, path, bucket: cfg.bucket };
}

/**
 * Registra en `documentos_archivos` + la tabla puente los archivos ya subidos al
 * Storage. Si un archivo falla al registrarse, se limpia su objeto del Storage y
 * se sigue con el resto. Devuelve cuántos quedaron vinculados.
 */
export async function vincularAdjuntos(
  cfg: AdjuntoCfg,
  entidadId: string,
  archivos: ArchivoMeta[],
  userId: string,
  /** Columnas extra para la fila puente (ej: { descripcion } en siniestros). */
  extra?: Record<string, unknown>,
): Promise<{ vinculados: number; fallidos: number }> {
  if (!entidadId || !archivos?.length) return { vinculados: 0, fallidos: 0 };
  const supabase = createAdminClient();

  let vinculados = 0;
  let fallidos = 0;
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
        subido_por: userId,
      })
      .select("id")
      .single();

    if (archivoError || !archivoData) {
      // Dejamos el objeto en el Storage (no lo borramos): así el archivo NO se
      // pierde y el usuario puede reintentar. Registramos para poder rastrearlo.
      console.error(
        `vincularAdjuntos: no se pudo registrar el archivo "${archivo.nombre_original}" (${cfg.junctionTable}/${entidadId}):`,
        archivoError,
      );
      fallidos++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linkError } = await (supabase as any)
      .from(cfg.junctionTable)
      .insert({ [cfg.entityColumn]: entidadId, archivo_id: archivoData.id, created_by: userId, ...extra });

    if (linkError) {
      console.error(
        `vincularAdjuntos: no se pudo vincular "${archivo.nombre_original}" a ${cfg.junctionTable}/${entidadId}:`,
        linkError,
      );
      // Revertimos el metadato pero conservamos el objeto en Storage (recuperable).
      await supabase.from("documentos_archivos").delete().eq("id", archivoData.id);
      fallidos++;
      continue;
    }
    vinculados++;
  }
  return { vinculados, fallidos };
}

/**
 * Completa la "portada" del documento (`archivo_id`) con el primero de sus
 * adjuntos, si todavía no tiene ninguna. La portada es lo que miran las vistas y
 * los listados que muestran un solo papel por documento — `v_compliance_estado`
 * entre ellas.
 *
 * Sin esto, un documento cargado desde la ficha del camión guarda el PDF en la
 * tabla puente pero en Compliance se ve como si no tuviera papel: fue lo que
 * pasó con las VTV que se cargaron en agosto. No pisa una portada existente:
 * renovar suma archivos, no reemplaza el que ya estaba.
 */
export async function asegurarPortada(
  cfg: AdjuntoCfg,
  docTable: string,
  entidadId: string,
): Promise<void> {
  if (!entidadId) return;
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (supabase as any)
    .from(docTable)
    .select("archivo_id")
    .eq("id", entidadId)
    .maybeSingle();
  if (!doc || doc.archivo_id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: primero } = await (supabase as any)
    .from(cfg.junctionTable)
    .select("archivo_id")
    .eq(cfg.entityColumn, entidadId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!primero?.archivo_id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from(docTable).update({ archivo_id: primero.archivo_id }).eq("id", entidadId);
}

/**
 * Los `archivo_id` de varias entidades, en el orden en que se subieron. Es la
 * lista completa de papeles de cada documento — la portada es apenas el primero.
 */
export async function archivoIdsDeAdjuntos(
  cfg: AdjuntoCfg,
  entidadIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const ids = [...new Set(entidadIds.filter(Boolean))];
  if (!ids.length) return out;
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from(cfg.junctionTable)
    .select(`${cfg.entityColumn}, archivo_id, created_at`)
    .in(cfg.entityColumn, ids)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(`archivoIdsDeAdjuntos: error en ${cfg.junctionTable}:`, error);
    return out;
  }
  for (const r of (data ?? []) as Record<string, string>[]) {
    const key = r[cfg.entityColumn];
    if (!key || !r.archivo_id) continue;
    const lista = out.get(key);
    if (lista) lista.push(r.archivo_id);
    else out.set(key, [r.archivo_id]);
  }
  return out;
}

/** Lista los adjuntos de una entidad con URL firmada (1 h) para ver / descargar. */
export async function getAdjuntos(cfg: AdjuntoCfg, entidadId: string): Promise<AdjuntoExistente[]> {
  if (!entidadId) return [];
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from(cfg.junctionTable)
    .select("id, created_at, archivo:documentos_archivos!archivo_id(bucket, path, nombre_original, tamano_bytes, mime_type)")
    .eq(cfg.entityColumn, entidadId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(`Error al cargar adjuntos de ${cfg.junctionTable}:`, error);
    return [];
  }

  type ArchivoEmbed = {
    bucket: string;
    path: string;
    nombre_original: string;
    tamano_bytes: number | null;
    mime_type: string | null;
  };
  type Row = { id: string; created_at: string; archivo: ArchivoEmbed | ArchivoEmbed[] | null };
  const rows = ((data ?? []) as Row[])
    .map((r) => ({
      id: r.id,
      created_at: r.created_at,
      archivo: (Array.isArray(r.archivo) ? r.archivo[0] ?? null : r.archivo) as ArchivoEmbed | null,
    }))
    .filter((r): r is { id: string; created_at: string; archivo: ArchivoEmbed } => r.archivo != null);

  // URLs firmadas en lote (una llamada por bucket) — funciona con buckets privados.
  const urlPorPath = await urlesFirmadas(rows.map((r) => r.archivo));

  return rows.map((r): AdjuntoExistente => {
    const url = urlPorPath.get(claveArchivo(r.archivo)) ?? "";
    // `&download=<nombre>` fuerza Content-Disposition: attachment con el nombre real
    // (verificado contra el Storage), en vez de descargar con el UUID del path.
    const downloadUrl = url
      ? `${url}&download=${encodeURIComponent(r.archivo.nombre_original)}`
      : "";
    return {
      id: r.id,
      nombre_original: r.archivo.nombre_original,
      url,
      downloadUrl,
      tamano_bytes: r.archivo.tamano_bytes ?? 0,
      mime_type: r.archivo.mime_type,
      created_at: r.created_at,
    };
  });
}

/** Elimina un adjunto puntual: fila puente + metadato + objeto del Storage. */
export async function deleteAdjunto(
  cfg: AdjuntoCfg,
  adjuntoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adjunto, error: getErr } = await (supabase as any)
    .from(cfg.junctionTable)
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("id", adjuntoId)
    .single();
  if (getErr || !adjunto) return { ok: false, error: "Archivo no encontrado" };
  const archivo = Array.isArray(adjunto.archivo) ? adjunto.archivo[0] : adjunto.archivo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any).from(cfg.junctionTable).delete().eq("id", adjuntoId);
  if (delErr) return { ok: false, error: "No se pudo eliminar el archivo" };

  if (archivo) {
    await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
    await supabase.from("documentos_archivos").delete().eq("id", archivo.id);
  }
  return { ok: true };
}
