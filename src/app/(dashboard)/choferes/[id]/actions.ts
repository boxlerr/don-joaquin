"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logChoferAudit } from "../audit";
import type {
  ChoferDetail,
  ApercibimientoGravedad,
  PrestamoEstado,
  ProductividadKPIs,
  CamionHistorialItem,
  AdelantoMes,
} from "./types";

export async function getChoferDetailAction(chofer_id: string): Promise<ChoferDetail | null> {
  const user = await requireArea("logistica", "read");
  const supabase = createAdminClient();

  const { data: chofer } = await supabase
    .from("choferes")
    .select(
      "id, nombre, apellido, dni, cuil, estado, localidad, email, telefono, domicilio, provincia, fecha_nacimiento, fecha_ingreso, fecha_egreso, motivo_egreso, observaciones, cbu, alias_cbu, banco, telefono_emergencia, ciudad_nacimiento, updated_at, foto_id, foto:documentos_archivos(bucket, path)"
    )
    .eq("id", chofer_id)
    .single();

  if (!chofer) return null;

  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [
    { data: docs },
    { data: viajes },
    { data: movimientos },
    { data: tiposDoc },
    { data: apercibimientos },
    { data: licencias },
    { data: prestamos },
    { data: categoriasApe },
    { data: viajesMes },
    { data: viaticosMes },
    { data: camionesHist },
  ] = await Promise.all([
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

    supabase
      .from("chofer_apercibimientos")
      .select("id, fecha, categoria_id, gravedad, motivo, observaciones, created_at, categoria:apercibimiento_categorias(nombre)")
      .eq("chofer_id", chofer_id)
      .order("fecha", { ascending: false }),

    supabase
      .from("chofer_licencias_medicas")
      .select("id, fecha_desde, fecha_hasta, motivo, observaciones, created_at")
      .eq("chofer_id", chofer_id)
      .order("fecha_desde", { ascending: false }),

    supabase
      .from("chofer_prestamos")
      .select("id, fecha, monto, moneda, cuotas, saldo_pendiente, estado, motivo, observaciones, created_at")
      .eq("chofer_id", chofer_id)
      .order("fecha", { ascending: false }),

    supabase
      .from("apercibimiento_categorias")
      .select("id, codigo, nombre, descripcion")
      .eq("estado", "activo")
      .order("orden"),

    supabase
      .from("viajes")
      .select("km_con_carga, km_vacios, tonelaje_real, monto_flete, moneda")
      .eq("chofer_id", chofer_id)
      .gte("fecha_viaje", primerDia)
      .lte("fecha_viaje", ultimoDia),

    supabase
      .from("viaticos")
      .select("id, fecha_entrega, monto_adelanto, moneda, viaje:viajes(codigo)")
      .eq("chofer_id", chofer_id)
      .gt("monto_adelanto", 0)
      .gte("fecha_entrega", primerDia)
      .lte("fecha_entrega", ultimoDia)
      .order("fecha_entrega", { ascending: false }),

    supabase
      .from("chofer_camion_historial")
      .select("id, camion_id, desde, hasta, motivo_cambio, camion:camiones(patente, marca, modelo)")
      .eq("chofer_id", chofer_id)
      .order("desde", { ascending: false }),
  ]);

  // Camión actualmente asignado al chofer (puede ser ninguno).
  const { data: camionActual } = await supabase
    .from("camiones")
    .select("id, patente, marca, modelo, ano")
    .eq("chofer_actual_id", chofer_id)
    .maybeSingle();

  const fotoObj = chofer.foto ? (Array.isArray(chofer.foto) ? chofer.foto[0] : chofer.foto) : null;

  const docIds = (docs ?? []).map((d) => d.id).filter(Boolean) as string[];
  let alertsQuery = supabase
    .from("alertas")
    .select("id, tipo, severidad, titulo, mensaje, entidad_id, entidad_tipo")
    .eq("estado", "pendiente");

  if (docIds.length > 0) {
    alertsQuery = alertsQuery.or(
      `entidad_id.eq.${chofer_id},and(entidad_tipo.eq.chofer_documentos,entidad_id.in.(${docIds.map(id => `"${id}"`).join(",")}))`
    );
  } else {
    alertsQuery = alertsQuery.eq("entidad_id", chofer_id);
  }

  const { data: activeAlerts } = await alertsQuery;

  const viajesMesArr = viajesMes ?? [];
  const km_con_carga = viajesMesArr.reduce((acc, v) => acc + Number(v.km_con_carga ?? 0), 0);
  const km_vacios = viajesMesArr.reduce((acc, v) => acc + Number(v.km_vacios ?? 0), 0);
  const km_total = km_con_carga + km_vacios;
  const toneladas = viajesMesArr.reduce((acc, v) => acc + Number(v.tonelaje_real ?? 0), 0);
  const facturacion_ars = viajesMesArr
    .filter((v) => v.moneda === "ARS")
    .reduce((acc, v) => acc + Number(v.monto_flete ?? 0), 0);
  const facturacion_usd = viajesMesArr
    .filter((v) => v.moneda === "USD")
    .reduce((acc, v) => acc + Number(v.monto_flete ?? 0), 0);

  const viaticosArr = viaticosMes ?? [];
  const adelantos_viaticos_ars = viaticosArr
    .filter((v) => v.moneda === "ARS")
    .reduce((acc, v) => acc + Number(v.monto_adelanto ?? 0), 0);
  const adelantos_viaticos_usd = viaticosArr
    .filter((v) => v.moneda === "USD")
    .reduce((acc, v) => acc + Number(v.monto_adelanto ?? 0), 0);

  const productividad_kpis: ProductividadKPIs = {
    periodo_desde: primerDia,
    periodo_hasta: ultimoDia,
    viajes_count: viajesMesArr.length,
    km_con_carga,
    km_vacios,
    km_total,
    pct_vacios: km_total > 0 ? (km_vacios / km_total) * 100 : 0,
    toneladas,
    facturacion_ars,
    facturacion_usd,
    adelantos_viaticos_ars,
    adelantos_viaticos_usd,
  };

  const camiones_historial: CamionHistorialItem[] = (camionesHist ?? []).map((h) => {
    const cam = Array.isArray(h.camion) ? h.camion[0] : h.camion;
    const c = cam as { patente?: string; marca?: string | null; modelo?: string | null } | null;
    return {
      id: h.id,
      camion_id: h.camion_id,
      patente: c?.patente ?? "—",
      marca: c?.marca ?? null,
      modelo: c?.modelo ?? null,
      desde: h.desde,
      hasta: h.hasta,
      motivo_cambio: h.motivo_cambio,
    };
  });

  const adelantos_mes: AdelantoMes[] = viaticosArr.map((v) => {
    const vj = Array.isArray(v.viaje) ? v.viaje[0] : v.viaje;
    return {
      id: v.id,
      fecha_entrega: v.fecha_entrega,
      monto_adelanto: Number(v.monto_adelanto),
      moneda: v.moneda,
      viaje_codigo: (vj as { codigo?: string } | null)?.codigo ?? null,
    };
  });

  return {
    ...chofer,
    foto: fotoObj as { bucket: string; path: string } | null,
    documentos_vigencia: docs ?? [],
    alertas: (activeAlerts ?? []).map((a) => ({
      id: a.id,
      tipo: a.tipo,
      severidad: a.severidad,
      titulo: a.titulo,
      mensaje: a.mensaje,
    })),
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
    camion_actual: camionActual
      ? {
          id: camionActual.id,
          patente: camionActual.patente,
          marca: camionActual.marca,
          modelo: camionActual.modelo,
          ano: camionActual.ano,
        }
      : null,
    apercibimientos: (apercibimientos ?? []).map((a) => {
      const cat = Array.isArray(a.categoria) ? a.categoria[0] : a.categoria;
      return {
        id: a.id,
        fecha: a.fecha,
        categoria_id: a.categoria_id,
        categoria_nombre: (cat as { nombre?: string } | null)?.nombre ?? null,
        gravedad: a.gravedad as ApercibimientoGravedad,
        motivo: a.motivo,
        observaciones: a.observaciones,
        created_at: a.created_at,
      };
    }),
    licencias_medicas: (licencias ?? []).map((l) => {
      const desde = new Date(l.fecha_desde);
      const hasta = l.fecha_hasta ? new Date(l.fecha_hasta) : null;
      const dias = hasta
        ? Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1)
        : null;
      return {
        id: l.id,
        fecha_desde: l.fecha_desde,
        fecha_hasta: l.fecha_hasta,
        motivo: l.motivo,
        observaciones: l.observaciones,
        dias,
        en_curso: !l.fecha_hasta,
        created_at: l.created_at,
      };
    }),
    prestamos: (prestamos ?? []).map((p) => ({
      id: p.id,
      fecha: p.fecha,
      monto: Number(p.monto),
      moneda: p.moneda,
      cuotas: p.cuotas,
      saldo_pendiente: Number(p.saldo_pendiente),
      estado: p.estado as PrestamoEstado,
      motivo: p.motivo,
      observaciones: p.observaciones,
      created_at: p.created_at,
    })),
    categorias_apercibimiento: categoriasApe ?? [],
    productividad_kpis,
    camiones_historial,
    adelantos_mes,
    is_admin: user.rol.codigo === "admin",
  };
}

// ---------------------------------------------------------------------------
// Apercibimientos
// ---------------------------------------------------------------------------

export async function crearApercibimientoAction(
  chofer_id: string,
  data: {
    fecha: string;
    categoria_id: string | null;
    gravedad: ApercibimientoGravedad;
    motivo: string;
    observaciones?: string | null;
  },
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (!data.motivo.trim()) return { error: "El motivo es obligatorio" };

  const { data: nuevo, error } = await supabase
    .from("chofer_apercibimientos")
    .insert({
      chofer_id,
      fecha: data.fecha,
      categoria_id: data.categoria_id,
      gravedad: data.gravedad,
      motivo: data.motivo.trim(),
      observaciones: data.observaciones?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !nuevo) return { error: "No se pudo registrar el apercibimiento" };

  await logChoferAudit(
    chofer_id,
    "apercibimiento_creado",
    null,
    {
      fecha: data.fecha,
      gravedad: data.gravedad,
      motivo: data.motivo.trim(),
    },
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function eliminarApercibimientoAction(id: string, chofer_id: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_apercibimientos")
    .select("fecha, gravedad, motivo")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("chofer_apercibimientos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el apercibimiento" };

  await logChoferAudit(chofer_id, "apercibimiento_eliminado", previo, null, user.id);
  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Licencias médicas
// ---------------------------------------------------------------------------

export async function crearLicenciaAction(
  chofer_id: string,
  data: {
    fecha_desde: string;
    fecha_hasta?: string | null;
    motivo?: string | null;
    observaciones?: string | null;
  },
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (data.fecha_hasta && data.fecha_hasta < data.fecha_desde)
    return { error: "La fecha hasta no puede ser anterior a desde" };

  const { error } = await supabase.from("chofer_licencias_medicas").insert({
    chofer_id,
    fecha_desde: data.fecha_desde,
    fecha_hasta: data.fecha_hasta || null,
    motivo: data.motivo?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    created_by: user.id,
  });

  if (error) return { error: "No se pudo registrar la licencia" };

  await logChoferAudit(
    chofer_id,
    "licencia_creada",
    null,
    {
      fecha_desde: data.fecha_desde,
      fecha_hasta: data.fecha_hasta || null,
      motivo: data.motivo?.trim() || null,
    },
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function cerrarLicenciaAction(id: string, chofer_id: string, fecha_hasta: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_licencias_medicas")
    .select("fecha_desde, fecha_hasta")
    .eq("id", id)
    .single();

  if (previo && fecha_hasta < previo.fecha_desde)
    return { error: "La fecha hasta no puede ser anterior a desde" };

  const { error } = await supabase
    .from("chofer_licencias_medicas")
    .update({ fecha_hasta, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No se pudo cerrar la licencia" };

  await logChoferAudit(
    chofer_id,
    "licencia_cerrada",
    previo,
    { ...previo, fecha_hasta },
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function eliminarLicenciaAction(id: string, chofer_id: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_licencias_medicas")
    .select("fecha_desde, fecha_hasta, motivo")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("chofer_licencias_medicas").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la licencia" };

  await logChoferAudit(chofer_id, "licencia_eliminada", previo, null, user.id);
  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export async function crearPrestamoAction(
  chofer_id: string,
  data: {
    fecha: string;
    monto: number;
    cuotas: number;
    motivo?: string | null;
    observaciones?: string | null;
  },
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (!Number.isFinite(data.monto) || data.monto <= 0)
    return { error: "El monto debe ser mayor a cero" };
  if (!Number.isInteger(data.cuotas) || data.cuotas < 1)
    return { error: "Las cuotas deben ser un entero mayor o igual a 1" };

  const { error } = await supabase.from("chofer_prestamos").insert({
    chofer_id,
    fecha: data.fecha,
    monto: data.monto,
    cuotas: data.cuotas,
    saldo_pendiente: data.monto,
    motivo: data.motivo?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    created_by: user.id,
  });

  if (error) return { error: "No se pudo registrar el préstamo" };

  await logChoferAudit(
    chofer_id,
    "prestamo_creado",
    null,
    {
      fecha: data.fecha,
      monto: data.monto,
      cuotas: data.cuotas,
    },
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function actualizarSaldoPrestamoAction(
  id: string,
  chofer_id: string,
  nuevo_saldo: number,
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (!Number.isFinite(nuevo_saldo) || nuevo_saldo < 0)
    return { error: "El saldo no puede ser negativo" };

  const { data: previo } = await supabase
    .from("chofer_prestamos")
    .select("monto, saldo_pendiente, estado")
    .eq("id", id)
    .single();

  if (!previo) return { error: "Préstamo no encontrado" };
  if (nuevo_saldo > Number(previo.monto))
    return { error: "El saldo no puede superar el monto original" };

  const estado: PrestamoEstado =
    nuevo_saldo === 0 ? "cancelado" : nuevo_saldo < Number(previo.monto) ? "parcial" : "pendiente";

  const { error } = await supabase
    .from("chofer_prestamos")
    .update({
      saldo_pendiente: nuevo_saldo,
      estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el saldo" };

  await logChoferAudit(
    chofer_id,
    "prestamo_saldo_actualizado",
    { saldo_pendiente: Number(previo.saldo_pendiente), estado: previo.estado },
    { saldo_pendiente: nuevo_saldo, estado },
    user.id,
  );

  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function eliminarPrestamoAction(id: string, chofer_id: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_prestamos")
    .select("fecha, monto, cuotas, saldo_pendiente")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("chofer_prestamos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el préstamo" };

  await logChoferAudit(chofer_id, "prestamo_eliminado", previo, null, user.id);
  revalidatePath(`/choferes/${chofer_id}`);
  return { success: true };
}

export async function uploadDocumentoChoferAction(formData: FormData) {
  const user = await requireArea("logistica", "write");
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
    ciudad_nacimiento: string;
    localidad: string;
    provincia: string;
  }>
) {

  const user = await requireArea("logistica", "write");
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
  const user = await requireArea("logistica", "write");
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
