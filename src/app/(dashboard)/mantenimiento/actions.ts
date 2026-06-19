"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { Database } from "@/types/database";

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
  fecha: string;
  km_odometro: number;
  taller?: string | null;
  costo?: number | null;
  observaciones?: string | null;
  proximo_service_fecha?: string | null;
  proximo_service_km?: number | null;
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
      descripcion: ts.nombre,
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

  await supabase.from("audit_log").insert({
    accion: "crear",
    entidad_tipo: "mantenimiento",
    entidad_id: inserted?.id ?? null,
    usuario_id: user?.id ?? null,
    valores_nuevos: {
      ...data,
      tipo_servicio: ts.nombre,
    } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
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
};

export async function getRoturasAction(): Promise<RoturaRow[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("roturas_gomas")
    .select(
      "id, fecha, tipo, cantidad, costo, moneda, posicion, observaciones, chofer_id, camion_id, acoplado_id, camion:camiones(patente), acoplado:acoplados(patente), chofer:choferes(nombre, apellido)"
    )
    .order("fecha", { ascending: false })
    .limit(200);

  return (data ?? []).map((r) => {
    const camion = Array.isArray(r.camion) ? r.camion[0] : r.camion;
    const acoplado = Array.isArray(r.acoplado) ? r.acoplado[0] : r.acoplado;
    const chofer = Array.isArray(r.chofer) ? r.chofer[0] : r.chofer;
    const unidad_patente = camion?.patente ?? acoplado?.patente ?? null;
    const unidad_tipo: RoturaRow["unidad_tipo"] = camion ? "camion" : acoplado ? "acoplado" : null;
    return {
      id: r.id,
      fecha: r.fecha,
      tipo: r.tipo ?? "goma",
      cantidad: r.cantidad,
      costo: r.costo,
      moneda: r.moneda,
      posicion: r.posicion,
      observaciones: r.observaciones,
      chofer_id: r.chofer_id ?? null,
      camion_id: r.camion_id ?? null,
      acoplado_id: r.acoplado_id ?? null,
      unidad_patente,
      unidad_tipo,
      chofer_nombre: chofer ? `${chofer.apellido}, ${chofer.nombre}` : null,
    };
  });
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

export async function addRoturaAction(data: {
  camion_id?: string | null;
  acoplado_id?: string | null;
  chofer_id?: string | null;
  tipo?: string | null;
  fecha: string;
  cantidad: number;
  costo?: number | null;
  posicion?: string | null;
  observaciones?: string | null;
}) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!data.camion_id && !data.acoplado_id && !data.chofer_id)
    return { error: "Indicá al menos el camión, el acoplado o el chofer." };

  const { data: inserted, error } = await supabase
    .from("roturas_gomas")
    .insert({
      camion_id: data.camion_id || null,
      acoplado_id: data.acoplado_id || null,
      chofer_id: data.chofer_id || null,
      tipo: (data.tipo || "goma").trim() || "goma",
      fecha: data.fecha,
      cantidad: data.cantidad > 0 ? data.cantidad : 1,
      costo: data.costo ?? null,
      moneda: "ARS",
      posicion: data.posicion || null,
      observaciones: data.observaciones || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar rotura:", error);
    return { error: "No se pudo guardar la rotura." };
  }

  await supabase.from("audit_log").insert({
    accion: "crear",
    entidad_tipo: "rotura_goma",
    entidad_id: inserted?.id ?? null,
    usuario_id: user?.id ?? null,
    valores_nuevos: data as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

// ── Editar / borrar servicios ────────────────────────────────────────────────

export async function updateServicioAction(
  id: string,
  data: {
    tipo_servicio_id: string;
    fecha: string;
    km_odometro: number;
    taller?: string | null;
    costo?: number | null;
    observaciones?: string | null;
    proximo_service_fecha?: string | null;
    proximo_service_km?: number | null;
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
      descripcion: ts.nombre,
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

  await supabase.from("audit_log").insert({
    accion: "actualizar",
    entidad_tipo: "mantenimiento",
    entidad_id: id,
    usuario_id: user?.id ?? null,
    valores_nuevos: { ...data, tipo_servicio: ts.nombre } as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

  revalidatePath("/mantenimiento");
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

  const { error } = await supabase.from("mantenimientos").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar servicio:", error);
    return { error: "No se pudo eliminar el servicio." };
  }

  await supabase.from("audit_log").insert({
    accion: "eliminar",
    entidad_tipo: "mantenimiento",
    entidad_id: id,
    usuario_id: user?.id ?? null,
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
    fecha: string;
    cantidad: number;
    costo?: number | null;
    posicion?: string | null;
    observaciones?: string | null;
  },
) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!data.camion_id && !data.acoplado_id && !data.chofer_id)
    return { error: "Indicá al menos el camión, el acoplado o el chofer." };

  const { error } = await supabase
    .from("roturas_gomas")
    .update({
      camion_id: data.camion_id || null,
      acoplado_id: data.acoplado_id || null,
      chofer_id: data.chofer_id || null,
      tipo: (data.tipo || "goma").trim() || "goma",
      fecha: data.fecha,
      cantidad: data.cantidad > 0 ? data.cantidad : 1,
      costo: data.costo ?? null,
      posicion: data.posicion || null,
      observaciones: data.observaciones || null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar rotura:", error);
    return { error: "No se pudo actualizar la rotura." };
  }

  await supabase.from("audit_log").insert({
    accion: "actualizar",
    entidad_tipo: "rotura_goma",
    entidad_id: id,
    usuario_id: user?.id ?? null,
    valores_nuevos: data as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["valores_nuevos"],
  });

  revalidatePath("/mantenimiento");
  return { success: true };
}

export async function deleteRoturaAction(id: string) {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { error } = await supabase.from("roturas_gomas").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar rotura:", error);
    return { error: "No se pudo eliminar la rotura." };
  }

  await supabase.from("audit_log").insert({
    accion: "eliminar",
    entidad_tipo: "rotura_goma",
    entidad_id: id,
    usuario_id: user?.id ?? null,
  });

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
