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
  await requireArea("flota", "read");
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
  camion_id: string;
  camion_patente: string;
  camion_marca_modelo: string;
};

export async function getServiciosAction(): Promise<ServicioRow[]> {
  await requireArea("flota", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mantenimientos")
    .select(
      "id, fecha, tipo, descripcion, km_odometro, costo, moneda, taller, observaciones, proximo_service_fecha, proximo_service_km, camion_id, tipo_servicio:tipos_servicio(nombre, codigo), camion:camiones(patente, marca, modelo)"
    )
    .order("fecha", { ascending: false })
    .limit(200);

  return (data ?? []).map((m) => {
    const camion = Array.isArray(m.camion) ? m.camion[0] : m.camion;
    const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
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
      camion_id: m.camion_id,
      camion_patente: camion?.patente ?? "—",
      camion_marca_modelo: camion ? `${camion.marca} ${camion.modelo}`.trim() : "",
    };
  });
}

export async function addServicioAction(data: {
  camion_id: string;
  tipo_servicio_id: string;
  fecha: string;
  km_odometro: number;
  taller?: string | null;
  costo?: number | null;
  observaciones?: string | null;
  proximo_service_fecha?: string | null;
  proximo_service_km?: number | null;
}) {
  await requireArea("flota", "write");
  const supabase = createAdminClient();
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!data.camion_id) return { error: "Elegí un camión." };
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
      camion_id: data.camion_id,
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
  return { success: true };
}

export type RoturaRow = {
  id: string;
  fecha: string;
  cantidad: number;
  costo: number | null;
  moneda: string;
  posicion: string | null;
  observaciones: string | null;
  unidad_patente: string | null;
  unidad_tipo: "camion" | "acoplado" | null;
  chofer_nombre: string | null;
};

export async function getRoturasAction(): Promise<RoturaRow[]> {
  await requireArea("flota", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("roturas_gomas")
    .select(
      "id, fecha, cantidad, costo, moneda, posicion, observaciones, camion:camiones(patente), acoplado:acoplados(patente), chofer:choferes(nombre, apellido)"
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
      cantidad: r.cantidad,
      costo: r.costo,
      moneda: r.moneda,
      posicion: r.posicion,
      observaciones: r.observaciones,
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
  await requireArea("flota", "read");
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
  fecha: string;
  cantidad: number;
  costo?: number | null;
  posicion?: string | null;
  observaciones?: string | null;
}) {
  await requireArea("flota", "write");
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

export type AlertaServicio = {
  camion_id: string;
  camion_patente: string;
  camion_marca_modelo: string;
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
  await requireArea("flota", "read");
  const supabase = createAdminClient();

  const { data: servicios } = await supabase
    .from("mantenimientos")
    .select(
      "fecha, proximo_service_fecha, proximo_service_km, camion_id, tipo_servicio:tipos_servicio(nombre), camion:camiones(patente, marca, modelo, km_actual)"
    )
    .or("proximo_service_fecha.not.is.null,proximo_service_km.not.is.null")
    .order("fecha", { ascending: false });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const DIAS_AVISO = 30;
  const KM_AVISO = 5000;

  // Quedarse con el último servicio por (camión + tipo) que tenga próximo programado.
  const vistos = new Set<string>();
  const alertas: AlertaServicio[] = [];

  for (const s of servicios ?? []) {
    const camion = Array.isArray(s.camion) ? s.camion[0] : s.camion;
    const ts = Array.isArray(s.tipo_servicio) ? s.tipo_servicio[0] : s.tipo_servicio;
    const servicioNombre = ts?.nombre ?? "Service";
    const key = `${s.camion_id}::${servicioNombre}`;
    if (vistos.has(key)) continue;
    vistos.add(key);

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
      camion_id: s.camion_id,
      camion_patente: camion?.patente ?? "—",
      camion_marca_modelo: camion ? `${camion.marca} ${camion.modelo}`.trim() : "",
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
