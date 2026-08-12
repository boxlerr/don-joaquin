"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { avisarCambio } from "@/lib/avisos";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";
import { logAudit } from "@/lib/audit";
// Sólo el tipo: se borra en compilación, así que no arrastra el módulo de
// server actions del listado hasta acá.
import type { RutaVia } from "../actions";

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
  pendientesFacturar: number; // sin importe cargado (el remito no tiene nada que ver)
  /** Viajes con carga que todavía no tienen remito. Las vueltas en vacío no
   *  cuentan: no llevan remito por definición. */
  sinRemito: number;
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
  /** Por qué ruta fue el camión: de la vía dependen los km del par. */
  ruta_via: RutaVia | null;
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
  /** Sólo en la vista "sin remito", que cruza choferes. */
  chofer?: string;
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
    sinRemito: number;
    vacios: number;
  };
};

/** Un viaje sin remito, con el chofer al que pertenece (la lista cruza choferes). */
export type HrViajeSinRemito = HrViajeItem & { chofer: string; chofer_id: string };

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
      .neq("estado", "cancelado") // los borrados (soft delete) no cuentan en la hoja
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
      viajes: 0, pendientesFacturar: 0, sinRemito: 0, totalImporte: 0, totalTn: 0, totalKm: 0, totalKmVacios: 0,
    };
    s.viajes++;
    s.totalKm += v.km_con_carga ?? 0;
    s.totalKmVacios += v.km_vacios ?? 0;
    s.totalTn += v.tonelaje_real ?? 0;
    s.totalImporte += v.monto_flete ?? 0;
    const vacio = !!v.es_vacio;
    if (!vacio && v.monto_flete == null) s.pendientesFacturar++;
    if (!vacio && !v.nro_remito) s.sinRemito++;
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
        viajes: 0, pendientesFacturar: 0, sinRemito: 0, totalImporte: 0, totalTn: 0, totalKm: 0, totalKmVacios: 0,
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
        observaciones, material, ruta_via,
        cliente:clientes(razon_social, nombre_comercial),
        origen:puntos_ruta!viajes_origen_id_fkey(nombre),
        destino:puntos_ruta!viajes_destino_id_fkey(nombre),
        camion:camiones(patente)
      `)
      .eq("chofer_id", choferId)
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .neq("estado", "cancelado") // los borrados (soft delete) no aparecen en la hoja
      .order("fecha_viaje", { ascending: true })
      // Desempate dentro del mismo día por orden de carga (el código es secuencial):
      // sin esto el par ida/vuelta puede salir invertido (la vuelta vacía arriba).
      .order("codigo", { ascending: true }),
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
    ruta_via: string | null;
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
      ruta_via: (v.ruta_via as RutaVia | null) ?? null,
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
      if (!vacio && !v.nro_remito) acc.sinRemito++;
      return acc;
    },
    { cantidad: 0, km: 0, kmVacios: 0, tonelaje: 0, importe: 0, vacios: 0, pendientesFacturar: 0, sinRemito: 0 },
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

/**
 * Todos los viajes del mes que todavía no tienen remito, de todos los choferes.
 *
 * Es el trabajo pendiente concreto de la hoja de ruta: hasta que no está el
 * remito el viaje no se puede facturar. Antes había que entrar chofer por chofer
 * a buscarlos.
 *
 * Las vueltas en vacío quedan afuera: no llevan remito, así que contarlas sería
 * inventar trabajo que no existe.
 */
export async function getViajesSinRemitoMesAction(mesISO: string): Promise<HrViajeSinRemito[]> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  const { desde, hasta } =
    mesISO === "total" ? { desde: "1900-01-01", hasta: "2999-12-31" } : rangoMes(mesISO);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("viajes")
    .select(`
      id, codigo, fecha_viaje, km_con_carga, km_vacios, tonelaje_real,
      nro_remito, nro_viaje_ypf, monto_flete, estado, facturado, es_vacio,
      observaciones, material, ruta_via, chofer_id,
      chofer:choferes(nombre, apellido),
      cliente:clientes(razon_social, nombre_comercial),
      origen:puntos_ruta!viajes_origen_id_fkey(nombre),
      destino:puntos_ruta!viajes_destino_id_fkey(nombre)
    `)
    .gte("fecha_viaje", desde)
    .lte("fecha_viaje", hasta)
    .neq("estado", "cancelado")
    .eq("es_vacio", false)
    .is("nro_remito", null)
    .not("chofer_id", "is", null)
    .order("fecha_viaje", { ascending: true })
    .order("codigo", { ascending: true });

  if (error) {
    console.error("[hoja de ruta] no se pudieron leer los viajes sin remito:", error);
    throw new Error("No se pudieron leer los viajes sin remito.");
  }

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((v) => {
    const ch = uno(v.chofer) as { nombre?: string; apellido?: string } | null;
    const cli = uno(v.cliente) as { razon_social?: string; nombre_comercial?: string | null } | null;
    return {
      id: v.id,
      codigo: v.codigo,
      fecha_viaje: v.fecha_viaje,
      origen: (uno(v.origen) as { nombre: string } | null)?.nombre ?? null,
      destino: (uno(v.destino) as { nombre: string } | null)?.nombre ?? null,
      // Acá el row es `any`: si falta en el select de arriba, TypeScript no
      // avisa y la columna Ruta sale "—" para todos los viajes sin remito.
      ruta_via: (v.ruta_via as RutaVia | null) ?? null,
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
      chofer_id: v.chofer_id,
      chofer: ch ? `${ch.apellido ?? ""}, ${ch.nombre ?? ""}`.trim() : "—",
    };
  });
}

/** Actualizar remito + monto de un viaje individual desde la grilla. */

/**
 * Resuelve un nombre de lugar a su id, creándolo si no existía. Es el mismo
 * criterio que usa el alta de viajes: los destinos nuevos se dan de alta solos
 * en vez de frenar la carga.
 *
 * Si el alta falla, LANZA: devolver null hacía que corregir el destino desde la
 * hoja de ruta lo dejara vacío, y encima con cartel de guardado.
 */
async function getOrCreatePunto(
  // Tipado a propósito (sin `as any`): el tipo generado de la tabla es lo único
  // que impide escribir una columna que no existe.
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string | null | undefined,
): Promise<string | null | undefined> {
  // undefined = no lo tocaron; null/"" = lo vaciaron a propósito.
  if (nombre === undefined) return undefined;
  const limpio = (nombre ?? "").trim();
  if (!limpio) return null;

  const { data } = await supabase.from("puntos_ruta").select("id").ilike("nombre", limpio).limit(1);
  if (data && data.length > 0) return data[0].id as string;

  const ins = await supabase
    .from("puntos_ruta")
    .insert({ nombre: limpio, estado: "activo", tipo: "otro" })
    .select("id")
    .single();
  if (ins.error) {
    console.error(`[hoja de ruta] no se pudo crear el punto "${limpio}":`, ins.error);
    throw new Error(`No se pudo dar de alta el lugar "${limpio}".`);
  }
  return ins.data.id as string;
}

/**
 * Corrección del viaje desde la hoja de ruta.
 *
 * Lo pidió Nico: el destino cambia con el camión andando. "Ayer le di ese
 * viaje, pero hoy a la mañana me pidieron que en lugar de ir a Planta Escobar
 * vaya para Dársena F2" — el chofer todavía no había llegado, así que es el
 * MISMO viaje con otro destino, no uno nuevo. (Cuando ya llegó y lo derivan,
 * ahí sí carga un viaje aparte.)
 *
 * Antes desde acá sólo se podían tocar el remito y el monto, así que había que
 * ir al listado a corregir un dato que se corrige todos los días.
 */
export async function actualizarViajeHojaRutaAction(
  viajeId: string,
  data: {
    origen_nombre?: string | null;
    destino_nombre?: string | null;
    km_con_carga?: number | null;
    km_vacios?: number | null;
    tonelaje_real?: number | null;
    nro_remito?: string | null;
    monto_flete?: number | null;
    material?: string | null;
  },
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireArea("viajes", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("viajes")
    .select(
      `id, km_con_carga, km_vacios, tonelaje_real, nro_remito, monto_flete, material, es_vacio,
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`,
    )
    .eq("id", viajeId)
    .single();
  if (!previo) return { error: "El viaje ya no existe." };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  try {
    const origenId = await getOrCreatePunto(supabase, data.origen_nombre);
    if (origenId !== undefined) payload.origen_id = origenId;
    const destinoId = await getOrCreatePunto(supabase, data.destino_nombre);
    if (destinoId !== undefined) payload.destino_id = destinoId;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dar de alta el lugar." };
  }

  for (const campo of ["km_con_carga", "km_vacios", "tonelaje_real"] as const) {
    const v = data[campo];
    if (v === undefined) continue;
    if (v != null && (!Number.isFinite(v) || v < 0))
      return {
        error:
          campo === "tonelaje_real"
            ? "Las toneladas tienen que ser un número mayor o igual a cero."
            : "Los kilómetros tienen que ser un número mayor o igual a cero.",
      };
    payload[campo] = v;
  }

  if (data.nro_remito !== undefined) payload.nro_remito = data.nro_remito || null;
  // Qué llevaba: lo escribe quien recibe el remito, así que se corrige acá.
  if (data.material !== undefined) payload.material = data.material || null;
  if (data.monto_flete !== undefined) {
    payload.monto_flete = data.monto_flete;
    // Misma regla que la edición de remito: tener valor = facturado y cobrado.
    // El tramo vacío no factura por más importe que se le tipee: sin pasarle
    // `es_vacio` quedaba marcado como facturado y ensuciaba los totales del mes.
    payload.facturado = viajeEstaFacturado(data.monto_flete, !!previo.es_vacio);
    payload.cobrado = payload.facturado;
  }
  if (data.nro_remito && data.monto_flete != null) payload.estado = "cerrado";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("viajes").update(payload).eq("id", viajeId);
  if (error) return { error: error.message };

  const uno = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { nombre: string } | null;
  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "viaje",
    entidadId: viajeId,
    valoresAnteriores: {
      origen: uno(previo.origen)?.nombre ?? null,
      destino: uno(previo.destino)?.nombre ?? null,
      km_con_carga: previo.km_con_carga,
      km_vacios: previo.km_vacios,
      tonelaje_real: previo.tonelaje_real,
      nro_remito: previo.nro_remito,
      monto_flete: previo.monto_flete,
      material: previo.material,
    },
    valoresNuevos: {
      ...(data.origen_nombre !== undefined ? { origen: data.origen_nombre } : {}),
      ...(data.destino_nombre !== undefined ? { destino: data.destino_nombre } : {}),
      ...(data.km_con_carga !== undefined ? { km_con_carga: data.km_con_carga } : {}),
      ...(data.km_vacios !== undefined ? { km_vacios: data.km_vacios } : {}),
      ...(data.tonelaje_real !== undefined ? { tonelaje_real: data.tonelaje_real } : {}),
      ...(data.nro_remito !== undefined ? { nro_remito: data.nro_remito } : {}),
      ...(data.monto_flete !== undefined ? { monto_flete: data.monto_flete } : {}),
      ...(data.material !== undefined ? { material: data.material } : {}),
    },
    metadata: { origen: "hoja_ruta" },
  });

  revalidatePath("/viajes/hoja-ruta");
  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  return { ok: true };
}

export type CambioViajeHr = {
  id: string;
  origen_nombre?: string | null;
  destino_nombre?: string | null;
  km_con_carga?: number | null;
  km_vacios?: number | null;
  tonelaje_real?: number | null;
  nro_remito?: string | null;
  monto_flete?: number | null;
  material?: string | null;
};

/**
 * Guarda varias filas de la hoja de ruta de una vez.
 *
 * Corregir de a una era abrir, editar, guardar y cerrar por cada viaje, y en un
 * mes de 100 viajes eso es la mayor parte del trabajo.
 *
 * Lo verificable se valida antes de escribir. Lo que NO se puede prometer es
 * atomicidad: cada fila es un UPDATE aparte contra PostgREST, sin transacción,
 * así que si la número 12 falla las once anteriores ya quedaron guardadas. Por
 * eso el error viaja junto con cuántas entraron, y la pantalla recarga igual:
 * decir "no se guardó nada" cuando sí se guardó la mitad es peor que el error.
 */
export async function actualizarViajesHojaRutaAction(
  cambios: CambioViajeHr[],
): Promise<{ ok: true; guardados: number } | { error: string; guardados: number }> {
  await requireArea("viajes", "write");
  if (cambios.length === 0) return { ok: true, guardados: 0 };
  let guardados = 0;

  for (const c of cambios) {
    if (!c.id) return { error: "Falta identificar uno de los viajes.", guardados };
    for (const campo of ["km_con_carga", "km_vacios", "tonelaje_real"] as const) {
      const v = c[campo];
      if (v != null && (!Number.isFinite(v) || v < 0))
        return {
          error:
            campo === "tonelaje_real"
              ? "Las toneladas tienen que ser un número mayor o igual a cero."
              : "Los kilómetros tienen que ser un número mayor o igual a cero.",
          guardados,
        };
    }
    if (c.monto_flete != null && (!Number.isFinite(c.monto_flete) || c.monto_flete < 0))
      return { error: "Los importes tienen que ser mayores o iguales a cero.", guardados };
  }

  for (const c of cambios) {
    const { id, ...resto } = c;
    const res = await actualizarViajeHojaRutaAction(id, resto);
    if (res.error) {
      return {
        error:
          guardados > 0
            ? `Se guardaron ${guardados} de ${cambios.length} y falló el siguiente: ${res.error}`
            : res.error,
        guardados,
      };
    }
    guardados++;
  }
  return { ok: true, guardados };
}
