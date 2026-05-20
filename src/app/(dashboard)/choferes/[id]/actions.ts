"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logChoferAudit } from "../audit";
import type { ChoferDetail } from "./types";

export async function getChoferDetailAction(chofer_id: string): Promise<ChoferDetail | null> {
  const supabase = createAdminClient();

  const { data: chofer } = await supabase
    .from("choferes")
    .select(
      "id, nombre, apellido, dni, estado, localidad, email, telefono, domicilio, provincia, fecha_nacimiento, fecha_ingreso, fecha_egreso, cbu, alias_cbu, banco, telefono_emergencia, updated_at, foto_id, foto:documentos_archivos(bucket, path)"
    )
    .eq("id", chofer_id)
    .single();

  if (!chofer) return null;

  const primerDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [{ data: docs }, { data: viajes }, { data: movimientos }, { data: tiposDoc }] =
    await Promise.all([
      supabase
        .from("v_chofer_documentos_vigencia")
        .select("id, tipo_documento, tipo_documento_codigo, fecha_vencimiento, dias_restantes, estado_vigencia, numero")
        .eq("chofer_id", chofer_id),

      supabase
        .from("viajes")
        .select("id, codigo, fecha_viaje, km_con_carga, km_vacios, estado, facturado")
        .eq("chofer_id", chofer_id)
        .order("fecha_viaje", { ascending: false })
        .limit(20),

      supabase
        .from("caja_movimientos")
        .select("id, fecha, concepto, tipo, monto, categoria")
        .eq("chofer_id", chofer_id)
        .gte("fecha", primerDia)
        .order("fecha", { ascending: false }),

      supabase
        .from("tipos_documento")
        .select("id, nombre, codigo")
        .eq("aplica_a", "chofer")
        .eq("estado", "activo"),
    ]);

  const fotoObj = chofer.foto ? (Array.isArray(chofer.foto) ? chofer.foto[0] : chofer.foto) : null;

  return {
    ...chofer,
    foto: fotoObj as { bucket: string; path: string } | null,
    documentos_vigencia: docs ?? [],
    tipos_documento: (tiposDoc ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      codigo: t.codigo,
    })),
    viajes_recientes: viajes ?? [],
    movimientos_mes: (movimientos ?? []).map((m) => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto,
      tipo: m.tipo as "ingreso" | "egreso",
      monto: m.monto,
      categoria: m.categoria,
    })),
  };
}

export async function uploadDocumentoChoferAction(formData: FormData) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const chofer_id = formData.get("chofer_id") as string;
  const tipo_nombre_custom = formData.get("tipo_nombre_custom") as string | null;
  let tipo_documento_id = formData.get("tipo_documento_id") as string;
  const file = formData.get("file") as File;
  const numero = formData.get("numero") as string | null;
  const fecha_vencimiento = formData.get("fecha_vencimiento") as string | null;
  const fecha_emision = formData.get("fecha_emision") as string | null;

  if (!file || !file.size) return { error: "Archivo requerido" };
  if (file.size > 10 * 1024 * 1024) return { error: "Máximo 10MB" };

  // Si el usuario eligió "Otro", buscar o crear el tipo de documento
  if (tipo_nombre_custom) {
    const nombreNorm = tipo_nombre_custom.trim();
    if (!nombreNorm) return { error: "El nombre del tipo de documento no puede estar vacío" };

    // Buscar si ya existe un tipo con ese nombre
    const { data: existente } = await supabase
      .from("tipos_documento")
      .select("id")
      .eq("nombre", nombreNorm)
      .eq("aplica_a", "chofer")
      .maybeSingle();

    if (existente) {
      tipo_documento_id = existente.id;
    } else {
      // Crear el tipo nuevo
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
          aplica_a: "chofer",
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
  const storagePath = `choferes/${chofer_id}/${tipo_documento_id}_${Date.now()}.${ext}`;

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

  const { error: dbError } = await supabase.from("chofer_documentos").insert({
    chofer_id,
    tipo_documento_id,
    numero: numero || null,
    fecha_emision: fecha_emision || null,
    fecha_vencimiento: fecha_vencimiento || null,
    archivo_id: archivoData.id,
  });
  if (dbError) return { error: "Error al guardar el documento" };

  const { data: tipoDoc } = await supabase
    .from("tipos_documento")
    .select("nombre")
    .eq("id", tipo_documento_id)
    .single();

  await logChoferAudit(
    chofer_id,
    "documento_agregado",
    null,
    {
      tipo_documento: tipoDoc?.nombre ?? null,
      archivo: file.name,
      numero: numero || null,
      fecha_emision: fecha_emision || null,
      fecha_vencimiento: fecha_vencimiento || null,
    },
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function updateChoferInfoAction(
  chofer_id: string,
  data: Partial<{
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    domicilio: string;
    cbu: string;
    alias_cbu: string;
    banco: string;
    telefono_emergencia: string;
  }>
) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const camposEditables = Object.keys(data) as (keyof typeof data)[];
  const { data: previo } = await supabase
    .from("choferes")
    .select(camposEditables.join(", "))
    .eq("id", chofer_id)
    .single();

  const { error } = await supabase
    .from("choferes")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", chofer_id);
  if (error) return { error: "Error al actualizar" };

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "actualizar",
    entidad_tipo: "chofer",
    entidad_id: chofer_id,
    valores_anteriores: previo ?? null,
    valores_nuevos: data,
  });

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function deleteDocumentoAction(doc_id: string, chofer_id: string) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_documentos")
    .select(
      "numero, fecha_emision, fecha_vencimiento, tipo_documento_id, archivo_id",
    )
    .eq("id", doc_id)
    .single();

  let tipoNombre: string | null = null;
  let archivoNombre: string | null = null;
  if (previo?.tipo_documento_id) {
    const { data: tipoDoc } = await supabase
      .from("tipos_documento")
      .select("nombre")
      .eq("id", previo.tipo_documento_id)
      .single();
    tipoNombre = tipoDoc?.nombre ?? null;
  }
  if (previo?.archivo_id) {
    const { data: arch } = await supabase
      .from("documentos_archivos")
      .select("nombre_original")
      .eq("id", previo.archivo_id)
      .single();
    archivoNombre = arch?.nombre_original ?? null;
  }

  const { error } = await supabase
    .from("chofer_documentos")
    .delete()
    .eq("id", doc_id);
  if (error) return { error: "No se pudo eliminar el documento" };

  await logChoferAudit(
    chofer_id,
    "documento_eliminado",
    {
      tipo_documento: tipoNombre,
      archivo: archivoNombre,
      numero: previo?.numero ?? null,
      fecha_emision: previo?.fecha_emision ?? null,
      fecha_vencimiento: previo?.fecha_vencimiento ?? null,
    },
    null,
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}
