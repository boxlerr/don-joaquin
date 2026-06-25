"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";

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
  estado: string; // "activo" | "baja" — egresados con viajes en el mes también se listan
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
  material: string | null; // columna material (fallback: regex en observaciones)
  monto_flete: number | null;
  cliente: string | null;
  estado: string;
  facturado: boolean;
  es_vacio: boolean;
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

/**
 * Lista los choferes con stats del mes para el sidebar.
 * Incluye: todos los choferes activos con rol "chofer" + cualquier chofer
 * (incluso dado de baja o con otro rol) que tenga viajes en el período.
 * Antes esto era un RPC (`resumen_choferes_mes`) que filtraba estado='activo',
 * con lo cual los viajes de choferes egresados quedaban invisibles y el
 * total del contador no cerraba contra la hoja de ruta del Excel.
 */
export async function listChoferesMesAction(
  mesISO: string,
): Promise<HrChoferListItem[]> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // mesISO === "total" → histórico completo.
  const { desde, hasta } = mesISO === "total"
    ? { desde: "1900-01-01", hasta: "2999-12-31" }
    : rangoMes(mesISO);

  const { data: choferesRaw } = await sb
    .from("choferes")
    .select("id, apellido, nombre, estado, rol");
  const choferes = (choferesRaw ?? []) as {
    id: string;
    apellido: string;
    nombre: string;
    estado: string;
    rol: string | null;
  }[];

  // Viajes del período, paginados (el API REST corta en 1000 filas por request).
  type ViajeRow = {
    chofer_id: string;
    km_con_carga: number | null;
    km_vacios: number | null;
    tonelaje_real: number | null;
    monto_flete: number | null;
    nro_remito: string | null;
    es_vacio: boolean | null;
  };
  const viajes: ViajeRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("viajes")
      .select("chofer_id, km_con_carga, km_vacios, tonelaje_real, monto_flete, nro_remito, es_vacio")
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .not("chofer_id", "is", null)
      .range(from, from + 999);
    const rows = (data ?? []) as ViajeRow[];
    viajes.push(...rows);
    if (rows.length < 1000) break;
  }

  // Agregar por chofer. Vacío = columna es_vacio (fuente de verdad explícita).
  // No usar la heurística !nro_remito: un viaje con carga pendiente de remito
  // tiene es_vacio=false y NO es vacío, es pendiente de facturar.
  type Stats = Omit<HrChoferListItem, "id" | "apellido" | "nombre" | "estado">;
  const statsPorChofer = new Map<string, Stats>();
  for (const v of viajes) {
    const s = statsPorChofer.get(v.chofer_id) ?? {
      viajes: 0, pendientesFacturar: 0, totalImporte: 0, totalTn: 0, totalKm: 0, totalKmVacios: 0,
    };
    s.viajes++;
    s.totalKm += v.km_con_carga ?? 0;
    s.totalKmVacios += v.km_vacios ?? 0;
    s.totalTn += v.tonelaje_real ?? 0;
    s.totalImporte += v.monto_flete ?? 0;
    const vacio = !!v.es_vacio;
    if (!vacio && v.monto_flete == null) s.pendientesFacturar++;
    statsPorChofer.set(v.chofer_id, s);
  }

  return choferes
    .filter((c) => {
      const tieneViajes = (statsPorChofer.get(c.id)?.viajes ?? 0) > 0;
      return (c.rol === "chofer" && c.estado === "activo") || tieneViajes;
    })
    .map((c) => ({
      id: c.id,
      apellido: c.apellido,
      nombre: c.nombre,
      estado: c.estado,
      ...(statsPorChofer.get(c.id) ?? {
        viajes: 0, pendientesFacturar: 0, totalImporte: 0, totalTn: 0, totalKm: 0, totalKmVacios: 0,
      }),
    }))
    .sort((a, b) =>
      a.apellido.localeCompare(b.apellido, "es") || a.nombre.localeCompare(b.nombre, "es"),
    );
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
        nro_remito, nro_viaje_ypf, monto_flete, estado, facturado, es_vacio,
        observaciones, material,
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
    es_vacio: boolean | null;
    observaciones: string | null;
    material: string | null;
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
      material: v.material ?? extractMaterial(v.observaciones),
      monto_flete: v.monto_flete,
      cliente: cli?.nombre_comercial ?? cli?.razon_social ?? null,
      estado: v.estado,
      facturado: v.facturado,
      es_vacio: !!v.es_vacio,
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
      const vacio = v.es_vacio;
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
  if (data.monto_flete !== undefined) {
    payload.monto_flete = data.monto_flete;
    // Regla del cliente: tener valor = está facturado (el valor entra con el remito).
    payload.facturado = viajeEstaFacturado(data.monto_flete);
  }
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
