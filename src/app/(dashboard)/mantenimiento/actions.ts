"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { Database } from "@/types/database";
import { urlesFirmadas, claveArchivo } from "@/lib/storage-urls";

type MantenimientoTipo = Database["public"]["Enums"]["mantenimiento_tipo"];

// El form de carga usa el catálogo `tipos_servicio` (rico), pero la tabla
// `mantenimientos` conserva la columna enum `tipo` (5 valores). Mapeamos el
// código del catálogo al enum para no perder ese dato durante la transición.
function tipoEnumFromCodigo(codigo: string): MantenimientoTipo {
  switch (codigo) {
    case "service_preventivo":
      return "service_preventivo";
    case "reparacion":
      return "reparacion";
    case "cambio_aceite":
      return "cambio_aceite";
    case "cubiertas":
    case "gomeria":
      return "cubiertas";
    default:
      return "otro";
  }
}

export async function getTiposServicioAction() {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tipos_servicio")
    .select("id, codigo, nombre, aplica_a_tercerizado, requiere_km, requiere_fecha, intervalo_km, intervalo_dias, orden")
    .eq("estado", "activo")
    .order("orden");
  return data ?? [];
}

export type ServicioRow = {
  id: string;
  fecha: string;
  tipo: MantenimientoTipo;
  tipo_servicio_id: string | null;
  tipo_servicio_nombre: string | null;
  tipo_servicio_codigo: string | null;
  descripcion: string;
  km_odometro: number;
  costo: number | null;
  moneda: string;
  taller: string | null;
  observaciones: string | null;
  proximo_service_fecha: string | null;
  proximo_service_km: number | null;
  camion_id: string | null;
  acoplado_id: string | null;
  unidad_patente: string;
  unidad_marca_modelo: string;
  unidad_tipo: "camion" | "acoplado";
};

export async function getServiciosAction(): Promise<ServicioRow[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mantenimientos")
    .select(
      "id, fecha, tipo, tipo_servicio_id, descripcion, km_odometro, costo, moneda, taller, observaciones, proximo_service_fecha, proximo_service_km, camion_id, acoplado_id, tipo_servicio:tipos_servicio(nombre, codigo), camion:camiones(patente, marca, modelo), acoplado:acoplados(patente, marca, modelo)"
    )
    .order("fecha", { ascending: false })
    .limit(200);

  return (data ?? []).map((m) => {
    const camion = Array.isArray(m.camion) ? m.camion[0] : m.camion;
    const acoplado = Array.isArray(m.acoplado) ? m.acoplado[0] : m.acoplado;
    const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
    const unidad = camion ?? acoplado ?? null;
    const unidad_tipo: ServicioRow["unidad_tipo"] = camion ? "camion" : "acoplado";
    const marcaModelo = unidad ? [unidad.marca, unidad.modelo].filter(Boolean).join(" ").trim() : "";
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      tipo_servicio_id: m.tipo_servicio_id ?? null,
      tipo_servicio_nombre: ts?.nombre ?? null,
      tipo_servicio_codigo: ts?.codigo ?? null,
      descripcion: m.descripcion,
      km_odometro: m.km_odometro,
      costo: m.costo,
      moneda: m.moneda,
      taller: m.taller,
      observaciones: m.observaciones,
      proximo_service_fecha: m.proximo_service_fecha,
      proximo_service_km: m.proximo_service_km,
      camion_id: m.camion_id ?? null,
      acoplado_id: m.acoplado_id ?? null,
      unidad_patente: unidad?.patente ?? "—",
      unidad_marca_modelo: marcaModelo,
      unidad_tipo,
    };
  });
}

export async function addServicioAction(data: {
  camion_id?: string | null;
  acoplado_id?: string | null;
  tipo_servicio_id: string;
  /** Texto libre cuando el tipo es "Otro": qué servicio se hizo. */
  tipo_detalle?: string | null;
  fecha: string;
  km_odometro: number;
  taller?: string | null;
  costo?: number | null;
  observaciones?: string | null;
  proximo_service_fecha?: string | null;
  proximo_service_km?: number | null;
  archivos?: AdjuntoArchivoMeta[];
}) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!data.camion_id && !data.acoplado_id) return { error: "Elegí un camión o acoplado." };
  if (data.camion_id && data.acoplado_id) return { error: "Elegí solo una unidad." };
  if (!data.tipo_servicio_id) return { error: "Elegí el tipo de servicio." };

  const { data: ts } = await supabase
    .from("tipos_servicio")
    .select("codigo, nombre")
    .eq("id", data.tipo_servicio_id)
    .single();

  if (!ts) return { error: "El tipo de servicio no existe." };

  const { data: inserted, error } = await supabase
    .from("mantenimientos")
    .insert({
      camion_id: data.camion_id || null,
      acoplado_id: data.acoplado_id || null,
      tipo_servicio_id: data.tipo_servicio_id,
      tipo: tipoEnumFromCodigo(ts.codigo),
      // "Otro" con texto libre: la descripción guarda qué servicio fue.
      descripcion: ts.codigo === "otro" && data.tipo_detalle?.trim() ? data.tipo_detalle.trim() : ts.nombre,
      fecha: data.fecha,
      km_odometro: data.km_odometro,
      taller: data.taller || null,
      costo: data.costo ?? null,
      moneda: "ARS",
      observaciones: data.observaciones || null,
      proximo_service_fecha: data.proximo_service_fecha || null,
      proximo_service_km: data.proximo_service_km ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar servicio:", error);
    return { error: "No se pudo guardar el servicio." };
  }

  // Vincular los comprobantes/fotos que ya se subieron al Storage.
  if (inserted && data.archivos?.length) {
    const mantId = inserted.id;
    await vincularArchivos(supabase, data.archivos, user?.id ?? null, (archivoId) =>
      supabase.from("mantenimiento_archivos").insert({ mantenimiento_id: mantId, archivo_id: archivoId, created_by: user?.id ?? null }),
    );
  }

  // Resolver patente de la unidad (camión o acoplado) para la caja / concepto.
  let unidadPatente: string | null = null;
  if (data.camion_id) {
    const { data: c } = await supabase.from("camiones").select("patente, km_actual").eq("id", data.camion_id).single();
    unidadPatente = c?.patente ?? null;
    // Actualizar km_actual del camión si el odómetro cargado es mayor (mantiene
    // las alertas por km al día). Solo aplica a camiones (los acoplados no tienen).
    if (c && data.km_odometro > 0 && (c.km_actual == null || data.km_odometro > c.km_actual)) {
      await supabase.from("camiones").update({ km_actual: data.km_odometro }).eq("id", data.camion_id);
    }
  } else if (data.acoplado_id) {
    const { data: a } = await supabase.from("acoplados").select("patente").eq("id", data.acoplado_id).single();
    unidadPatente = a?.patente ?? null;
  }

  // Registrar el costo en Caja como egreso (mismo comportamiento que el alta
  // desde la ficha del camión, para que no dependa de por dónde se cargue).
  if (data.costo && data.costo > 0 && inserted) {
    const patenteLabel = unidadPatente ? ` - ${unidadPatente}` : "";
    await supabase.from("caja_movimientos").insert({
      tipo: "egreso",
      categoria: "gasto_operativo",
      concepto: `${ts.nombre}${patenteLabel}${data.taller ? ` (${data.taller})` : ""}`,
      monto: data.costo,
      medio: "otro",
      fecha: data.fecha,
      moneda: "ARS",
      mantenimiento_id: inserted.id,
      created_by: user?.id ?? null,
    } as never);
  }

  await logAudit({
    client: supabase,
    accion: "crear",
    entidadTipo: "mantenimiento",
    entidadId: inserted?.id ?? null,
    usuarioId: user?.id ?? null,
    valoresNuevos: { ...data, tipo_servicio: ts.nombre },
  });

  revalidatePath("/mantenimiento");
  revalidatePath("/caja");
  revalidatePath("/camiones");
  return { success: true };
}

export type RoturaRow = {
  id: string;
  fecha: string;
  tipo: string;
  gravedad: string; // "leve" | "grave" (relevante solo para roturas que no son gomas)
  cantidad: number;
  costo: number | null;
  moneda: string;
  posicion: string | null;
  observaciones: string | null;
  chofer_id: string | null;
  camion_id: string | null;
  acoplado_id: string | null;
  unidad_patente: string | null;
  unidad_tipo: "camion" | "acoplado" | null;
  chofer_nombre: string | null;
  insumo_id: string | null;
  marca: string | null;
  estado_uso: string | null;
};

// insumo_id/marca/estado_uso son columnas nuevas todavía no reflejadas en los
// tipos generados; usamos un cast puntual para poder pedirlas en el select.
const SELECT_ROTURA =
  "id, fecha, tipo, gravedad, cantidad, costo, moneda, posicion, observaciones, chofer_id, camion_id, acoplado_id, insumo_id, marca, estado_uso, camion:camiones(patente), acoplado:acoplados(patente), chofer:choferes(nombre, apellido)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRotura(r: any): RoturaRow {
  const camion = Array.isArray(r.camion) ? r.camion[0] : r.camion;
  const acoplado = Array.isArray(r.acoplado) ? r.acoplado[0] : r.acoplado;
  const chofer = Array.isArray(r.chofer) ? r.chofer[0] : r.chofer;
  return {
    id: r.id,
    fecha: r.fecha,
    tipo: r.tipo ?? "goma",
    gravedad: r.gravedad ?? "leve",
    cantidad: r.cantidad,
    costo: r.costo,
    moneda: r.moneda,
    posicion: r.posicion,
    observaciones: r.observaciones,
    chofer_id: r.chofer_id ?? null,
    camion_id: r.camion_id ?? null,
    acoplado_id: r.acoplado_id ?? null,
    unidad_patente: camion?.patente ?? acoplado?.patente ?? null,
    unidad_tipo: camion ? "camion" : acoplado ? "acoplado" : null,
    chofer_nombre: chofer ? `${chofer.apellido}, ${chofer.nombre}` : null,
    insumo_id: r.insumo_id ?? null,
    marca: r.marca ?? null,
    estado_uso: r.estado_uso ?? null,
  };
}

export async function getRoturasAction(): Promise<RoturaRow[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("roturas_gomas")
    .select(SELECT_ROTURA)
    .order("fecha", { ascending: false })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(mapRotura);
}

/**
 * Una rotura suelta, por id.
 *
 * La tabla muestra las últimas 200 por fecha. Un enlace del Taller a una rotura
 * más vieja caería fuera de esa tanda y la pantalla se abriría sin nada
 * desplegado: el link "no anda" sin decir por qué. Con esto se la trae aparte y
 * el enlace funciona siempre.
 */
export async function getRoturaPorIdAction(id: string): Promise<RoturaRow | null> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("roturas_gomas")
    .select(SELECT_ROTURA)
    .eq("id", id)
    .maybeSingle();
  return data ? mapRotura(data) : null;
}

export type RoturaPorChofer = {
  chofer: string;
  eventos: number;
  cantidad: number;
};

export async function getRoturasPorChoferAction(): Promise<RoturaPorChofer[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  // Últimos 6 meses, agrupado por chofer.
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 6);
  const { data } = await supabase
    .from("roturas_gomas")
    .select("cantidad, chofer:choferes(nombre, apellido)")
    .gte("fecha", desde.toISOString().split("T")[0])
    .not("chofer_id", "is", null);

  const map = new Map<string, RoturaPorChofer>();
  for (const r of data ?? []) {
    const chofer = Array.isArray(r.chofer) ? r.chofer[0] : r.chofer;
    if (!chofer) continue;
    const nombre = `${chofer.apellido}, ${chofer.nombre}`;
    const prev = map.get(nombre) ?? { chofer: nombre, eventos: 0, cantidad: 0 };
    prev.eventos += 1;
    prev.cantidad += r.cantidad ?? 1;
    map.set(nombre, prev);
  }
  return [...map.values()].sort((a, b) => b.cantidad - a.cantidad);
}

export type CostoRepuestosPorChofer = {
  chofer: string;
  eventos: number;
  costo_total: number;
};

// Cuánto costó cada chofer en repuestos (roturas con costo) en los últimos 6
// meses. Es lo que Bárbara quiere sumarle al sueldo para saber el costo real.
export async function getCostoRepuestosPorChoferAction(): Promise<CostoRepuestosPorChofer[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 6);
  const { data } = await supabase
    .from("roturas_gomas")
    .select("costo, chofer:choferes(nombre, apellido)")
    .gte("fecha", desde.toISOString().split("T")[0])
    .not("chofer_id", "is", null)
    .not("costo", "is", null);

  const map = new Map<string, CostoRepuestosPorChofer>();
  for (const r of data ?? []) {
    const chofer = Array.isArray(r.chofer) ? r.chofer[0] : r.chofer;
    if (!chofer) continue;
    const nombre = `${chofer.apellido}, ${chofer.nombre}`;
    const prev = map.get(nombre) ?? { chofer: nombre, eventos: 0, costo_total: 0 };
    prev.eventos += 1;
    prev.costo_total += Number(r.costo ?? 0);
    map.set(nombre, prev);
  }
  return [...map.values()].sort((a, b) => b.costo_total - a.costo_total);
}

// ── Catálogo de insumos ──────────────────────────────────────────────────────
//
// El taller no carga facturas. Administración mantiene un catálogo de los insumos
// comunes (goma, lámpara, óptica, etc.) con marca + precio, y al cargar una rotura
// se elige el insumo para traer el importe (queda editable). El sistema recuerda
// actualizar los precios cada `alerta_insumo_precio_meses` (motor de alertas).

export type InsumoRow = {
  id: string;
  tipo: string;
  nombre: string;
  marca: string | null;
  precio: number;
  moneda: string;
  estado: string; // "activo" | "inactivo"
  orden: number;
  precio_actualizado_en: string;
  observaciones: string | null;
  precio_desactualizado: boolean;
  /** Cuántas roturas usan este insumo (para avisar antes de borrar). */
  usos: number;
};

/** Meses configurados antes de considerar un precio "desactualizado" (default 3). */
async function getInsumoPrecioMeses(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", "alerta_insumo_precio_meses")
    .maybeSingle();
  const n = Number(data?.valor);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export async function getInsumosAction(): Promise<InsumoRow[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  const meses = await getInsumoPrecioMeses(supabase);
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  const limiteStr = limite.toISOString().split("T")[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("insumos_catalogo")
    .select("id, tipo, nombre, marca, precio, moneda, estado, orden, precio_actualizado_en, observaciones")
    .order("estado", { ascending: true }) // activo antes que inactivo
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al cargar insumos:", error);
    return [];
  }

  // Cuántas roturas referencian cada insumo (para avisar antes de borrar).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usosData } = await (supabase as any)
    .from("roturas_gomas")
    .select("insumo_id")
    .not("insumo_id", "is", null);
  const usosMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (usosData ?? []) as any[]) {
    usosMap.set(r.insumo_id, (usosMap.get(r.insumo_id) ?? 0) + 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    tipo: r.tipo ?? "goma",
    nombre: r.nombre,
    marca: r.marca ?? null,
    precio: Number(r.precio ?? 0),
    moneda: r.moneda ?? "ARS",
    estado: r.estado ?? "activo",
    orden: r.orden ?? 0,
    precio_actualizado_en: r.precio_actualizado_en,
    observaciones: r.observaciones ?? null,
    precio_desactualizado:
      r.estado === "activo" && !!r.precio_actualizado_en && String(r.precio_actualizado_en) < limiteStr,
    usos: usosMap.get(r.id) ?? 0,
  }));
}

/** Trae precio y marca del insumo elegido para autocompletar la rotura. */
async function resolverInsumoRotura(
  supabase: ReturnType<typeof createAdminClient>,
  data: { insumo_id?: string | null; costo?: number | null; marca?: string | null },
): Promise<{ costo: number | null; marca: string | null }> {
  let costo = data.costo ?? null;
  let marca = data.marca?.trim() || null;
  if (data.insumo_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ins } = await (supabase as any)
      .from("insumos_catalogo")
      .select("precio, marca")
      .eq("id", data.insumo_id)
      .maybeSingle();
    if (ins) {
      if (costo == null) costo = Number(ins.precio ?? 0);
      if (!marca) marca = ins.marca ?? null;
    }
  }
  return { costo, marca };
}

export async function addInsumoAction(data: {
  tipo: string;
  nombre: string;
  marca?: string | null;
  precio: number;
  estado?: string;
  observaciones?: string | null;
}) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const nombre = data.nombre?.trim();
  if (!nombre) return { error: "Escribí el nombre del insumo." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("insumos_catalogo")
    .insert({
      tipo: (data.tipo || "goma").trim() || "goma",
      nombre,
      marca: data.marca?.trim() || null,
      precio: data.precio > 0 ? data.precio : 0,
      estado: data.estado === "inactivo" ? "inactivo" : "activo",
      observaciones: data.observaciones?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar insumo:", error);
    return { error: "No se pudo guardar el insumo." };
  }

  await logAudit({
    client: supabase,
    accion: "crear",
    entidadTipo: "insumo_catalogo",
    entidadId: inserted?.id ?? null,
    usuarioId: user?.id ?? null,
    valoresNuevos: data,
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

export async function updateInsumoAction(
  id: string,
  data: {
    tipo: string;
    nombre: string;
    marca?: string | null;
    precio: number;
    estado?: string;
    observaciones?: string | null;
  },
) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const nombre = data.nombre?.trim();
  if (!nombre) return { error: "Escribí el nombre del insumo." };

  // Si cambia el precio, refrescamos precio_actualizado_en (apaga el recordatorio).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prev } = await (supabase as any)
    .from("insumos_catalogo")
    .select("precio")
    .eq("id", id)
    .maybeSingle();
  const precio = data.precio > 0 ? data.precio : 0;
  const precioCambio = !prev || Number(prev.precio) !== precio;

  const update: Record<string, unknown> = {
    tipo: (data.tipo || "goma").trim() || "goma",
    nombre,
    marca: data.marca?.trim() || null,
    precio,
    estado: data.estado === "inactivo" ? "inactivo" : "activo",
    observaciones: data.observaciones?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (precioCambio) update.precio_actualizado_en = new Date().toISOString().split("T")[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("insumos_catalogo").update(update).eq("id", id);
  if (error) {
    console.error("Error al actualizar insumo:", error);
    return { error: "No se pudo actualizar el insumo." };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    entidadTipo: "insumo_catalogo",
    entidadId: id,
    usuarioId: user?.id ?? null,
    valoresNuevos: data,
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

export async function deleteInsumoAction(id: string) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Las roturas que lo referencian quedan con insumo_id = null (ON DELETE SET NULL);
  // no se pierde el costo ya cargado en cada rotura.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("insumos_catalogo").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar insumo:", error);
    return { error: "No se pudo eliminar el insumo." };
  }

  await logAudit({
    client: supabase,
    accion: "eliminar",
    entidadTipo: "insumo_catalogo",
    entidadId: id,
    usuarioId: user?.id ?? null,
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

/**
 * Actualiza SOLO el precio de un insumo (para el "editar precio rápido" en la
 * tabla, sin abrir el modal completo). Refresca `precio_actualizado_en` para
 * apagar el recordatorio de precio desactualizado.
 */
export async function updateInsumoPrecioAction(id: string, precio: number) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const p = Number.isFinite(precio) && precio > 0 ? precio : 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("insumos_catalogo")
    .update({
      precio: p,
      precio_actualizado_en: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("Error al actualizar precio de insumo:", error);
    return { error: "No se pudo actualizar el precio." };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    entidadTipo: "insumo_catalogo",
    entidadId: id,
    usuarioId: user?.id ?? null,
    valoresNuevos: { precio: p },
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

/**
 * Activa o desactiva un insumo sin borrarlo. Es la alternativa segura al borrado
 * (sobre todo para insumos ya usados en roturas): el catálogo lo conserva pero no
 * lo ofrece al cargar una rotura ni dispara la alerta de precio.
 */
export async function setInsumoEstadoAction(id: string, estado: "activo" | "inactivo") {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const nuevo = estado === "inactivo" ? "inactivo" : "activo";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("insumos_catalogo")
    .update({ estado: nuevo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Error al cambiar el estado del insumo:", error);
    return { error: "No se pudo cambiar el estado del insumo." };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    entidadTipo: "insumo_catalogo",
    entidadId: id,
    usuarioId: user?.id ?? null,
    valoresNuevos: { estado: nuevo },
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

export async function addRoturaAction(data: {
  camion_id?: string | null;
  acoplado_id?: string | null;
  chofer_id?: string | null;
  tipo?: string | null;
  gravedad?: string | null;
  fecha: string;
  cantidad: number;
  costo?: number | null;
  posicion?: string | null;
  observaciones?: string | null;
  insumo_id?: string | null;
  marca?: string | null;
  estado_uso?: string | null;
  archivos?: AdjuntoArchivoMeta[];
}) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!data.camion_id && !data.acoplado_id && !data.chofer_id)
    return { error: "Indicá al menos el camión, el acoplado o el chofer." };

  // El taller no carga facturas: si eligió un insumo del catálogo, tomamos su
  // precio (cuando no se cargó un costo a mano) y su marca (cuando no se escribió
  // una). El costo queda editable, así que un costo cargado explícito prevalece.
  const { costo: costoFinal, marca: marcaFinal } = await resolverInsumoRotura(supabase, data);

  // insumo_id/marca/estado_uso son columnas nuevas aún no reflejadas en los tipos
  // generados; cast puntual (mismo patrón que el resto de tablas nuevas del repo).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("roturas_gomas")
    .insert({
      camion_id: data.camion_id || null,
      acoplado_id: data.acoplado_id || null,
      chofer_id: data.chofer_id || null,
      tipo: (data.tipo || "goma").trim() || "goma",
      gravedad: data.gravedad === "grave" ? "grave" : "leve",
      fecha: data.fecha,
      cantidad: data.cantidad > 0 ? data.cantidad : 1,
      costo: costoFinal,
      moneda: "ARS",
      posicion: data.posicion || null,
      observaciones: data.observaciones || null,
      insumo_id: data.insumo_id || null,
      marca: marcaFinal,
      estado_uso: data.estado_uso?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar rotura:", error);
    return { error: "No se pudo guardar la rotura." };
  }

  // Vincular los comprobantes/fotos que ya se subieron al Storage.
  if (inserted && data.archivos?.length) {
    const roturaId = inserted.id;
    await vincularArchivos(supabase, data.archivos, user?.id ?? null, (archivoId) =>
      supabase.from("rotura_archivos").insert({ rotura_id: roturaId, archivo_id: archivoId, created_by: user?.id ?? null }),
    );
  }

  await logAudit({
    client: supabase,
    accion: "crear",
    entidadTipo: "rotura_goma",
    entidadId: inserted?.id ?? null,
    usuarioId: user?.id ?? null,
    valoresNuevos: data,
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

// ── Editar / borrar servicios ────────────────────────────────────────────────

export async function updateServicioAction(
  id: string,
  data: {
    tipo_servicio_id: string;
    /** Texto libre cuando el tipo es "Otro": qué servicio se hizo. */
    tipo_detalle?: string | null;
    fecha: string;
    km_odometro: number;
    taller?: string | null;
    costo?: number | null;
    observaciones?: string | null;
    proximo_service_fecha?: string | null;
    proximo_service_km?: number | null;
    archivos?: AdjuntoArchivoMeta[];
  },
) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: ts } = await supabase
    .from("tipos_servicio")
    .select("codigo, nombre")
    .eq("id", data.tipo_servicio_id)
    .single();
  if (!ts) return { error: "El tipo de servicio no existe." };

  const { error } = await supabase
    .from("mantenimientos")
    .update({
      tipo_servicio_id: data.tipo_servicio_id,
      tipo: tipoEnumFromCodigo(ts.codigo),
      // "Otro" con texto libre: la descripción guarda qué servicio fue.
      descripcion: ts.codigo === "otro" && data.tipo_detalle?.trim() ? data.tipo_detalle.trim() : ts.nombre,
      fecha: data.fecha,
      km_odometro: data.km_odometro,
      taller: data.taller || null,
      costo: data.costo ?? null,
      observaciones: data.observaciones || null,
      proximo_service_fecha: data.proximo_service_fecha || null,
      proximo_service_km: data.proximo_service_km ?? null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar servicio:", error);
    return { error: "No se pudo actualizar el servicio." };
  }

  // Vincular comprobantes/fotos nuevos que se hayan subido al editar.
  if (data.archivos?.length) {
    await vincularArchivos(supabase, data.archivos, user?.id ?? null, (archivoId) =>
      supabase.from("mantenimiento_archivos").insert({ mantenimiento_id: id, archivo_id: archivoId, created_by: user?.id ?? null }),
    );
  }

  // Reconciliar el egreso de Caja: al editar pudo cambiar el costo, la fecha o el
  // taller. Borramos el/los movimientos vinculados y reinsertamos si sigue con
  // costo (mismo criterio que el alta), para que Caja no quede descuadrada.
  await supabase.from("caja_movimientos").delete().eq("mantenimiento_id", id);
  if (data.costo && data.costo > 0) {
    const { data: mant } = await supabase
      .from("mantenimientos")
      .select("camion_id, acoplado_id")
      .eq("id", id)
      .single();
    let unidadPatente: string | null = null;
    if (mant?.camion_id) {
      const { data: c } = await supabase.from("camiones").select("patente").eq("id", mant.camion_id).single();
      unidadPatente = c?.patente ?? null;
    } else if (mant?.acoplado_id) {
      const { data: a } = await supabase.from("acoplados").select("patente").eq("id", mant.acoplado_id).single();
      unidadPatente = a?.patente ?? null;
    }
    const patenteLabel = unidadPatente ? ` - ${unidadPatente}` : "";
    await supabase.from("caja_movimientos").insert({
      tipo: "egreso",
      categoria: "gasto_operativo",
      concepto: `${ts.nombre}${patenteLabel}${data.taller ? ` (${data.taller})` : ""}`,
      monto: data.costo,
      medio: "otro",
      fecha: data.fecha,
      moneda: "ARS",
      mantenimiento_id: id,
      created_by: user?.id ?? null,
    } as never);
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    entidadTipo: "mantenimiento",
    entidadId: id,
    usuarioId: user?.id ?? null,
    valoresNuevos: { ...data, tipo_servicio: ts.nombre },
  });

  revalidatePath("/mantenimiento");
  revalidatePath("/caja");
  revalidatePath("/camiones");
  return { success: true };
}

export async function deleteServicioAction(id: string) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Borrar el egreso de caja asociado (si lo hay), para no dejar el gasto huérfano.
  await supabase.from("caja_movimientos").delete().eq("mantenimiento_id", id);

  // Limpiar los adjuntos del Storage. El borrado en cascada elimina la fila
  // puente, pero no el objeto físico ni el metadato en `documentos_archivos`.
  const { data: adjuntos } = await supabase
    .from("mantenimiento_archivos")
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("mantenimiento_id", id);
  for (const adj of adjuntos ?? []) {
    const archivo = Array.isArray(adj.archivo) ? adj.archivo[0] : adj.archivo;
    await eliminarArchivoFisico(supabase, archivo);
  }

  const { error } = await supabase.from("mantenimientos").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar servicio:", error);
    return { error: "No se pudo eliminar el servicio." };
  }

  await logAudit({
    client: supabase,
    accion: "eliminar",
    entidadTipo: "mantenimiento",
    entidadId: id,
    usuarioId: user?.id ?? null,
  });

  revalidatePath("/mantenimiento");
  revalidatePath("/caja");
  revalidatePath("/camiones");
  return { success: true };
}

// ── Editar / borrar roturas ──────────────────────────────────────────────────

export async function updateRoturaAction(
  id: string,
  data: {
    camion_id?: string | null;
    acoplado_id?: string | null;
    chofer_id?: string | null;
    tipo?: string | null;
    gravedad?: string | null;
    fecha: string;
    cantidad: number;
    costo?: number | null;
    posicion?: string | null;
    observaciones?: string | null;
    insumo_id?: string | null;
    marca?: string | null;
    estado_uso?: string | null;
    archivos?: AdjuntoArchivoMeta[];
  },
) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!data.camion_id && !data.acoplado_id && !data.chofer_id)
    return { error: "Indicá al menos el camión, el acoplado o el chofer." };

  const { costo: costoFinal, marca: marcaFinal } = await resolverInsumoRotura(supabase, data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("roturas_gomas")
    .update({
      camion_id: data.camion_id || null,
      acoplado_id: data.acoplado_id || null,
      chofer_id: data.chofer_id || null,
      tipo: (data.tipo || "goma").trim() || "goma",
      gravedad: data.gravedad === "grave" ? "grave" : "leve",
      fecha: data.fecha,
      cantidad: data.cantidad > 0 ? data.cantidad : 1,
      costo: costoFinal,
      posicion: data.posicion || null,
      observaciones: data.observaciones || null,
      insumo_id: data.insumo_id || null,
      marca: marcaFinal,
      estado_uso: data.estado_uso?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar rotura:", error);
    return { error: "No se pudo actualizar la rotura." };
  }

  // Vincular comprobantes/fotos nuevos que se hayan subido al editar.
  if (data.archivos?.length) {
    await vincularArchivos(supabase, data.archivos, user?.id ?? null, (archivoId) =>
      supabase.from("rotura_archivos").insert({ rotura_id: id, archivo_id: archivoId, created_by: user?.id ?? null }),
    );
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    entidadTipo: "rotura_goma",
    entidadId: id,
    usuarioId: user?.id ?? null,
    valoresNuevos: data,
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

export async function deleteRoturaAction(id: string) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Antes de borrar la rotura, limpiar sus adjuntos. El borrado en cascada
  // elimina las filas puente de `rotura_archivos`, pero no los objetos físicos
  // del bucket ni los metadatos en `documentos_archivos`: los limpiamos a mano.
  const { data: adjuntos } = await supabase
    .from("rotura_archivos")
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("rotura_id", id);
  const archivos = (adjuntos ?? [])
    .map((adj) => (Array.isArray(adj.archivo) ? adj.archivo[0] : adj.archivo))
    .filter((a): a is { id: string; bucket: string; path: string } => !!a);
  for (const archivo of archivos) {
    await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
  }
  if (archivos.length) {
    // Borrar el metadato cascadea y elimina la fila puente correspondiente.
    await supabase.from("documentos_archivos").delete().in("id", archivos.map((a) => a.id));
  }

  const { error } = await supabase.from("roturas_gomas").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar rotura:", error);
    return { error: "No se pudo eliminar la rotura." };
  }

  await logAudit({
    client: supabase,
    accion: "eliminar",
    entidadTipo: "rotura_goma",
    entidadId: id,
    usuarioId: user?.id ?? null,
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

// ── Adjuntos de mantenimiento (roturas y servicios) ──────────────────────────
//
// Tanto las roturas como los servicios pueden adjuntar comprobantes (factura del
// taller, remito, foto, etc.). Mismo patrón que `siniestro_archivos`: el archivo
// se sube directo del navegador al Storage con una URL firmada (sin pasar por el
// Server Action, que en Vercel topea el body en ~4,5 MB) y después se registran
// solo los metadatos. Los buckets permiten hasta 100 MB, igual que el legajo.
//
// Helpers compartidos abajo; las actions específicas de cada entidad (rotura /
// servicio) los reutilizan para no duplicar lógica.

const ROTURA_BUCKET = "documentos-roturas";
const SERVICIO_BUCKET = "documentos-mantenimiento";

export type AdjuntoArchivoMeta = {
  bucket: string;
  path: string;
  nombre_original: string;
  mime_type: string | null;
  tamano_bytes: number;
};

export type AdjuntoArchivo = {
  id: string;
  nombre_original: string;
  url: string;
  tamano_bytes: number;
  mime_type: string | null;
  created_at: string;
};

/** Genera la URL firmada de subida en `bucket/carpeta/<uuid>.<ext>`. */
async function crearUrlSubida(
  bucket: string,
  carpeta: string,
  filename: string,
): Promise<{ signedUrl: string; token: string; path: string; bucket: string } | { error: string }> {
  const supabase = createAdminClient();
  const ext =
    (filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return { error: "No se pudo iniciar la subida del archivo" };
  return { signedUrl: data.signedUrl, token: data.token, path, bucket };
}

/** Mapea una fila puente (con su archivo embebido) a la forma de la UI. */
function mapAdjunto(
  urls: Map<string, string>,
  row: {
    id: string;
    created_at: string;
    archivo:
      | { bucket: string; path: string; nombre_original: string; tamano_bytes: number | null; mime_type: string | null }
      | { bucket: string; path: string; nombre_original: string; tamano_bytes: number | null; mime_type: string | null }[]
      | null;
  },
): AdjuntoArchivo | null {
  const archivo = Array.isArray(row.archivo) ? row.archivo[0] : row.archivo;
  if (!archivo) return null;
  return {
    id: row.id,
    nombre_original: archivo.nombre_original,
    url: urls.get(claveArchivo(archivo)) ?? "",
    tamano_bytes: archivo.tamano_bytes ?? 0,
    mime_type: archivo.mime_type,
    created_at: row.created_at,
  };
}

/**
 * Registra (vincula) archivos ya subidos al Storage. Inserta el metadato en
 * `documentos_archivos` y delega la fila puente (rotura / mantenimiento) en
 * `vincular`. Si algo falla con un archivo, lo deja fuera y sigue con el resto.
 */
async function vincularArchivos(
  supabase: ReturnType<typeof createAdminClient>,
  archivos: AdjuntoArchivoMeta[],
  userId: string | null,
  vincular: (archivoId: string) => PromiseLike<{ error: unknown }>,
) {
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
      await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
      continue;
    }

    const { error: linkError } = await vincular(archivoData.id);
    if (linkError) {
      await supabase.from("documentos_archivos").delete().eq("id", archivoData.id);
      await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
    }
  }
}

/** Borra el objeto del Storage y su metadato en `documentos_archivos`. */
async function eliminarArchivoFisico(
  supabase: ReturnType<typeof createAdminClient>,
  archivo: { id: string; bucket: string; path: string } | null,
) {
  if (!archivo) return;
  await supabase.storage.from(archivo.bucket).remove([archivo.path]).then(undefined, () => {});
  await supabase.from("documentos_archivos").delete().eq("id", archivo.id);
}

// ── Roturas ──────────────────────────────────────────────────────────────────

/** URL firmada para subir un archivo de rotura directo navegador → Storage. */
export async function crearUrlSubidaRoturaAction(input: { filename: string }) {
  await requireArea("mantenimiento", "write");
  return crearUrlSubida(ROTURA_BUCKET, "roturas", input.filename);
}

/** Lista los adjuntos de una rotura con URL firmada para ver / descargar. */
export async function getArchivosRoturaAction(rotura_id: string): Promise<AdjuntoArchivo[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  if (!rotura_id) return [];
  const { data, error } = await supabase
    .from("rotura_archivos")
    .select("id, created_at, archivo:documentos_archivos!archivo_id(bucket, path, nombre_original, tamano_bytes, mime_type)")
    .eq("rotura_id", rotura_id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error al cargar archivos de rotura:", error);
    return [];
  }
  const urls = await urlesFirmadas(
    (data ?? []).map((r) => (Array.isArray(r.archivo) ? r.archivo[0] : r.archivo)),
  );
  return (data ?? []).map((r) => mapAdjunto(urls, r)).filter((a): a is AdjuntoArchivo => a !== null);
}

/** Elimina un adjunto puntual de una rotura (fila puente + metadato + objeto). */
export async function deleteArchivoRoturaAction(adjunto_id: string) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const { data: adjunto, error: getErr } = await supabase
    .from("rotura_archivos")
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("id", adjunto_id)
    .single();
  if (getErr || !adjunto) return { error: "Archivo no encontrado" };
  const archivo = Array.isArray(adjunto.archivo) ? adjunto.archivo[0] : adjunto.archivo;
  const { error: delErr } = await supabase.from("rotura_archivos").delete().eq("id", adjunto_id);
  if (delErr) return { error: "No se pudo eliminar el archivo" };
  await eliminarArchivoFisico(supabase, archivo);
  revalidatePath("/mantenimiento");
  return { success: true };
}

// ── Servicios / mantenimientos ───────────────────────────────────────────────

/** URL firmada para subir un archivo de servicio directo navegador → Storage. */
export async function crearUrlSubidaServicioAction(input: { filename: string }) {
  await requireArea("mantenimiento", "write");
  return crearUrlSubida(SERVICIO_BUCKET, "mantenimientos", input.filename);
}

/** Lista los adjuntos de un servicio con URL firmada para ver / descargar. */
export async function getArchivosServicioAction(mantenimiento_id: string): Promise<AdjuntoArchivo[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  if (!mantenimiento_id) return [];
  const { data, error } = await supabase
    .from("mantenimiento_archivos")
    .select("id, created_at, archivo:documentos_archivos!archivo_id(bucket, path, nombre_original, tamano_bytes, mime_type)")
    .eq("mantenimiento_id", mantenimiento_id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error al cargar archivos de servicio:", error);
    return [];
  }
  const urls = await urlesFirmadas(
    (data ?? []).map((r) => (Array.isArray(r.archivo) ? r.archivo[0] : r.archivo)),
  );
  return (data ?? []).map((r) => mapAdjunto(urls, r)).filter((a): a is AdjuntoArchivo => a !== null);
}

/** Elimina un adjunto puntual de un servicio (fila puente + metadato + objeto). */
export async function deleteArchivoServicioAction(adjunto_id: string) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const { data: adjunto, error: getErr } = await supabase
    .from("mantenimiento_archivos")
    .select("archivo:documentos_archivos!archivo_id(id, bucket, path)")
    .eq("id", adjunto_id)
    .single();
  if (getErr || !adjunto) return { error: "Archivo no encontrado" };
  const archivo = Array.isArray(adjunto.archivo) ? adjunto.archivo[0] : adjunto.archivo;
  const { error: delErr } = await supabase.from("mantenimiento_archivos").delete().eq("id", adjunto_id);
  if (delErr) return { error: "No se pudo eliminar el archivo" };
  await eliminarArchivoFisico(supabase, archivo);
  revalidatePath("/mantenimiento");
  return { success: true };
}

export type ReporteUnidadMant = {
  unidad_patente: string;
  unidad_marca_modelo: string;
  unidad_tipo: "camion" | "acoplado";
  visitas_taller: number;
  servicios_total: number;
  costo_total: number;
};

// Reporte por unidad de los últimos 6 meses: visitas a taller (reparación +
// gomería, misma definición que usa el ranking de choferes), total de servicios
// y costo acumulado. Expone como reporte lo que hoy solo alimentaba el ranking.
export async function getReporteMantenimientoPorUnidadAction(): Promise<ReporteUnidadMant[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();

  const desde = new Date();
  desde.setMonth(desde.getMonth() - 6);

  const { data } = await supabase
    .from("mantenimientos")
    .select(
      "costo, tipo, camion_id, acoplado_id, tipo_servicio:tipos_servicio(codigo), camion:camiones(patente, marca, modelo), acoplado:acoplados(patente, marca, modelo)"
    )
    .gte("fecha", desde.toISOString().split("T")[0]);

  const TALLER_CODIGOS = new Set(["reparacion", "gomeria"]);
  const map = new Map<string, ReporteUnidadMant>();

  for (const m of data ?? []) {
    const camion = Array.isArray(m.camion) ? m.camion[0] : m.camion;
    const acoplado = Array.isArray(m.acoplado) ? m.acoplado[0] : m.acoplado;
    const unidad = camion ?? acoplado ?? null;
    if (!unidad) continue;
    const unidad_tipo: ReporteUnidadMant["unidad_tipo"] = camion ? "camion" : "acoplado";
    const key = `${unidad_tipo}:${unidad.patente}`;

    const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
    const codigo = (ts as { codigo?: string } | null)?.codigo;
    const esTaller = codigo ? TALLER_CODIGOS.has(codigo) : m.tipo === "reparacion";

    const prev =
      map.get(key) ??
      {
        unidad_patente: unidad.patente,
        unidad_marca_modelo: [unidad.marca, unidad.modelo].filter(Boolean).join(" ").trim(),
        unidad_tipo,
        visitas_taller: 0,
        servicios_total: 0,
        costo_total: 0,
      };
    prev.servicios_total += 1;
    if (esTaller) prev.visitas_taller += 1;
    prev.costo_total += m.costo ?? 0;
    map.set(key, prev);
  }

  // Más visitas a taller primero; desempate por costo.
  return [...map.values()].sort(
    (a, b) => b.visitas_taller - a.visitas_taller || b.costo_total - a.costo_total,
  );
}

export type AlertaServicio = {
  unidad_id: string;
  unidad_patente: string;
  unidad_marca_modelo: string;
  unidad_tipo: "camion" | "acoplado";
  servicio: string;
  proximo_service_fecha: string | null;
  proximo_service_km: number | null;
  km_actual: number | null;
  dias_restantes: number | null;
  km_restantes: number | null;
  estado: "vencido" | "por_vencer";
};

// Próximos services del módulo: el último servicio de cada camión que dejó
// programado un próximo (por fecha o km). No duplica las alertas tipo VTV del
// navbar — solo mira mantenimientos cargados acá.
export async function getAlertasProximosServicesAction(): Promise<AlertaServicio[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();

  const { data: servicios } = await supabase
    .from("mantenimientos")
    .select(
      "fecha, proximo_service_fecha, proximo_service_km, camion_id, acoplado_id, tipo_servicio:tipos_servicio(nombre), camion:camiones(patente, marca, modelo, km_actual), acoplado:acoplados(patente, marca, modelo)"
    )
    .or("proximo_service_fecha.not.is.null,proximo_service_km.not.is.null")
    .order("fecha", { ascending: false });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const DIAS_AVISO = 30;
  const KM_AVISO = 5000;

  // Quedarse con el último servicio por (unidad + tipo) que tenga próximo programado.
  const vistos = new Set<string>();
  const alertas: AlertaServicio[] = [];

  for (const s of servicios ?? []) {
    const camion = Array.isArray(s.camion) ? s.camion[0] : s.camion;
    const acoplado = Array.isArray(s.acoplado) ? s.acoplado[0] : s.acoplado;
    const ts = Array.isArray(s.tipo_servicio) ? s.tipo_servicio[0] : s.tipo_servicio;
    const servicioNombre = ts?.nombre ?? "Service";

    const unidad = camion ?? acoplado ?? null;
    const unidad_id = s.camion_id ?? s.acoplado_id ?? "";
    const unidad_tipo: AlertaServicio["unidad_tipo"] = camion ? "camion" : "acoplado";
    const key = `${unidad_id}::${servicioNombre}`;
    if (vistos.has(key)) continue;
    vistos.add(key);

    // Solo los camiones tienen km_actual; para acoplados el aviso es por fecha.
    const kmActual = camion?.km_actual ?? null;

    let diasRestantes: number | null = null;
    if (s.proximo_service_fecha) {
      const f = new Date(s.proximo_service_fecha);
      f.setHours(0, 0, 0, 0);
      diasRestantes = Math.round((f.getTime() - hoy.getTime()) / 86400000);
    }

    let kmRestantes: number | null = null;
    if (s.proximo_service_km != null && kmActual != null) {
      kmRestantes = s.proximo_service_km - kmActual;
    }

    const venceFecha = diasRestantes != null && diasRestantes <= DIAS_AVISO;
    const venceKm = kmRestantes != null && kmRestantes <= KM_AVISO;
    if (!venceFecha && !venceKm) continue;

    const vencido =
      (diasRestantes != null && diasRestantes < 0) || (kmRestantes != null && kmRestantes < 0);

    alertas.push({
      unidad_id,
      unidad_patente: unidad?.patente ?? "—",
      unidad_marca_modelo: unidad ? [unidad.marca, unidad.modelo].filter(Boolean).join(" ").trim() : "",
      unidad_tipo,
      servicio: servicioNombre,
      proximo_service_fecha: s.proximo_service_fecha,
      proximo_service_km: s.proximo_service_km,
      km_actual: kmActual,
      dias_restantes: diasRestantes,
      km_restantes: kmRestantes,
      estado: vencido ? "vencido" : "por_vencer",
    });
  }

  // Vencidos primero, luego por días restantes.
  return alertas.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "vencido" ? -1 : 1;
    return (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999);
  });
}
