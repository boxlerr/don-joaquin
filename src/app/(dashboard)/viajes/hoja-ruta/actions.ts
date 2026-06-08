"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// Vista "Hoja de Ruta mensual por chofer" — estilo Excel del cliente.
// Una "página" por chofer, con sus viajes del mes en la misma estructura
// del Excel maestro: DIA · SALE · LLEGA · KM · Tn · REMITO · MATERIAL ·
// KM VACÍOS · $.
// ============================================================================

export type HrChoferListItem = {
  id: string;
  apellido: string;
  nombre: string;
  viajes: number; // del mes seleccionado
  pendientesFacturar: number; // sin importe (esperando remito)
  totalImporte: number;
  totalTn: number;
  totalKm: number;
  totalKmVacios: number;
};

export type HrViajeItem = {
  id: string;
  codigo: string;
  fecha_viaje: string; // ISO
  origen: string | null;
  destino: string | null;
  km_con_carga: number;
  km_vacios: number;
  tonelaje_real: number | null;
  nro_remito: string | null;
  nro_viaje_ypf: string | null;
  material: string | null; // viene de observaciones
  monto_flete: number | null;
  cliente: string | null;
  estado: string;
  facturado: boolean;
  observaciones: string | null;
};

export type HrPanelChofer = {
  id: string;
  apellido: string;
  nombre: string;
  patentes_actuales: string[]; // camiones asignados ahora
  patentes_del_mes: string[]; // camiones que manejó en el mes
  viajes: HrViajeItem[];
  totales: {
    cantidad: number;
    km: number;
    kmVacios: number;
    tonelaje: number;
    importe: number;
    pendientesFacturar: number;
    vacios: number;
  };
};

// ---------------------------------------------------------------------------

function rangoMes(mesISO: string): { desde: string; hasta: string } {
  // mesISO: "YYYY-MM" → primer día y último día del mes
  const [y, m] = mesISO.split("-").map((x) => parseInt(x, 10));
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const hasta = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { desde, hasta };
}

function extractMaterial(obs: string | null): string | null {
  if (!obs) return null;
  const m = obs.match(/Material:\s*([^·|]+)/i);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------

/** Lista todos los choferes activos con stats del mes para el sidebar. */
export async function listChoferesMesAction(
  mesISO: string,
): Promise<HrChoferListItem[]> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  // mesISO === "total" → histórico completo (fechas null en la función).
  const { desde, hasta } = mesISO === "total"
    ? { desde: null, hasta: null }
    : rangoMes(mesISO);

  // Agregación en la base (sin tope de 1000 filas del API REST).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("resumen_choferes_mes", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error || !data) return [];

  return (data as {
    chofer_id: string;
    apellido: string;
    nombre: string;
    viajes: number | string;
    pendientes_facturar: number | string;
    total_importe: number | string;
    total_tn: number | string;
    total_km: number | string;
    total_km_vacios: number | string;
  }[]).map((r) => ({
    id: r.chofer_id,
    apellido: r.apellido,
    nombre: r.nombre,
    viajes: Number(r.viajes),
    pendientesFacturar: Number(r.pendientes_facturar),
    totalImporte: Number(r.total_importe),
    totalTn: Number(r.total_tn),
    totalKm: Number(r.total_km),
    totalKmVacios: Number(r.total_km_vacios),
  }));
}

/** Trae los viajes detallados del chofer en el mes, en formato Excel-like. */
export async function getPanelChoferAction(
  choferId: string,
  mesISO: string,
): Promise<HrPanelChofer | null> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  // "total" → histórico completo (rango bien amplio para no filtrar por mes).
  const { desde, hasta } = mesISO === "total"
    ? { desde: "1900-01-01", hasta: "2999-12-31" }
    : rangoMes(mesISO);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: chofer }, { data: viajesRaw }, { data: camiones }] = await Promise.all([
    sb.from("choferes").select("id, apellido, nombre").eq("id", choferId).maybeSingle(),
    sb
      .from("viajes")
      .select(`
        id, codigo, fecha_viaje, km_con_carga, km_vacios, tonelaje_real,
        nro_remito, nro_viaje_ypf, monto_flete, estado, facturado,
        observaciones,
        cliente:clientes(razon_social, nombre_comercial),
        origen:puntos_ruta!viajes_origen_id_fkey(nombre),
        destino:puntos_ruta!viajes_destino_id_fkey(nombre),
        camion:camiones(patente)
      `)
      .eq("chofer_id", choferId)
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .order("fecha_viaje", { ascending: true }),
    sb.from("camiones").select("patente").eq("chofer_actual_id", choferId),
  ]);

  if (!chofer) return null;

  const viajes: HrViajeItem[] = (viajesRaw ?? []).map((v: {
    id: string;
    codigo: string;
    fecha_viaje: string;
    km_con_carga: number;
    km_vacios: number;
    tonelaje_real: number | null;
    nro_remito: string | null;
    nro_viaje_ypf: string | null;
    monto_flete: number | null;
    estado: string;
    facturado: boolean;
    observaciones: string | null;
    cliente: { razon_social?: string; nombre_comercial?: string | null } | { razon_social?: string; nombre_comercial?: string | null }[] | null;
    origen: { nombre: string } | { nombre: string }[] | null;
    destino: { nombre: string } | { nombre: string }[] | null;
    camion: { patente: string } | { patente: string }[] | null;
  }) => {
    const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    const ori = Array.isArray(v.origen) ? v.origen[0] : v.origen;
    const des = Array.isArray(v.destino) ? v.destino[0] : v.destino;
    return {
      id: v.id,
      codigo: v.codigo,
      fecha_viaje: v.fecha_viaje,
      origen: ori?.nombre ?? null,
      destino: des?.nombre ?? null,
      km_con_carga: v.km_con_carga,
      km_vacios: v.km_vacios,
      tonelaje_real: v.tonelaje_real,
      nro_remito: v.nro_remito,
      nro_viaje_ypf: v.nro_viaje_ypf,
      material: extractMaterial(v.observaciones),
      monto_flete: v.monto_flete,
      cliente: cli?.nombre_comercial ?? cli?.razon_social ?? null,
      estado: v.estado,
      facturado: v.facturado,
      observaciones: v.observaciones,
    };
  });

  const patentesDelMes = new Set<string>();
  for (const v of (viajesRaw ?? []) as { camion: { patente: string } | { patente: string }[] | null }[]) {
    const c = Array.isArray(v.camion) ? v.camion[0] : v.camion;
    if (c?.patente) patentesDelMes.add(c.patente);
  }

  // Totales
  const totales = viajes.reduce(
    (acc, v) => {
      acc.cantidad++;
      acc.km += v.km_con_carga;
      acc.kmVacios += v.km_vacios;
      acc.tonelaje += v.tonelaje_real ?? 0;
      acc.importe += v.monto_flete ?? 0;
      const vacio = !v.nro_remito || v.nro_remito.toUpperCase() === "VACIO";
      if (vacio) acc.vacios++;
      if (!vacio && v.monto_flete == null) acc.pendientesFacturar++;
      return acc;
    },
    { cantidad: 0, km: 0, kmVacios: 0, tonelaje: 0, importe: 0, vacios: 0, pendientesFacturar: 0 },
  );

  return {
    id: (chofer as { id: string; apellido: string; nombre: string }).id,
    apellido: (chofer as { id: string; apellido: string; nombre: string }).apellido,
    nombre: (chofer as { id: string; apellido: string; nombre: string }).nombre,
    patentes_actuales: (camiones ?? []).map((c: { patente: string }) => c.patente),
    patentes_del_mes: Array.from(patentesDelMes),
    viajes,
    totales,
  };
}

/** Actualizar remito + monto de un viaje individual desde la grilla. */
export async function actualizarRemitoYMontoAction(
  viajeId: string,
  data: { nro_remito?: string | null; monto_flete?: number | null },
): Promise<{ ok?: boolean; error?: string }> {
  await requireArea("viajes", "write");
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.nro_remito !== undefined) payload.nro_remito = data.nro_remito || null;
  if (data.monto_flete !== undefined) payload.monto_flete = data.monto_flete;
  // Si ahora tiene remito + monto, marcar como cerrado
  if (data.nro_remito && data.monto_flete != null) {
    payload.estado = "cerrado";
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("viajes").update(payload).eq("id", viajeId);
  if (error) return { error: error.message };
  revalidatePath("/viajes/hoja-ruta");
  revalidatePath("/viajes");
  return { ok: true };
}
