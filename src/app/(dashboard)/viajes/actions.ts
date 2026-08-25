"use server";

import { revalidatePath } from "next/cache";
import { avisarCambio } from "@/lib/avisos";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { traerTodo } from "@/lib/supabase/traer-todo";
import { logAudit } from "@/lib/audit";
import { coincideEnAlguno } from "@/lib/texto";
import type { ViajeBasico, PaginatedResult, FaltaDato } from "./types";
import { computeCierre } from "./flujo-logic";
import { mezclarObservaciones } from "./mezclar-observaciones";
import { requireArea, requireUser } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import { hoyArgentina, sumarDiasISO } from "@/lib/fecha-ar";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";
import { RUTA_VIA_VALUES } from "@/domain/viajes/ruta-via";
import {
  pickTarifaAplicable,
  computeImporteTarifa,
  detalleTarifa,
  rutaDeTarifa,
  type TarifaModalidad,
} from "@/domain/viajes/tarifa-importe";

const PAGE_SIZE = 20;

// Prefijo centinela para tipos de carga que el form ofrece pero que todavía no
// existen en la tabla (catálogo vacío en el primer arranque). Se materializan
// (get-or-create por nombre) al guardar el viaje, nunca desde una lectura.
const TIPO_CARGA_NUEVO_PREFIX = "nuevo:";

/** Fallback: extrae el material desde observaciones (formato "Material: X | ...")
 *  para viajes anteriores a la columna `material` (no backfilleados). */
function extractMaterialFromObs(obs: string | null): string | null {
  if (!obs) return null;
  const m = obs.match(/Material:\s*([^·|]+)/i);
  return m ? m[1].trim() : null;
}

/**
 * Busca ids en una tabla auxiliar del buscador de viajes, ignorando acentos.
 *
 * El ILIKE de Postgres no ignora los acentos: buscar "agustin" no encontraba a
 * "Agustín". Como estas tablas son chicas (choferes, camiones, clientes y
 * lugares: decenas o pocos cientos de filas), en vez de pedirle a la base que
 * normalice se traen las filas y se filtran acá con el mismo helper que usa el
 * resto del sistema. Sin migración ni columnas nuevas.
 *
 * Sólo se piden el id y las columnas por las que se busca, así que lo que viaja
 * es mínimo. Los viajes en sí, que son muchos, se siguen filtrando en la base
 * por los ids que devuelve esto.
 */
async function buscarIdsPorTexto(
  supabase: ReturnType<typeof createAdminClient>,
  tabla: "choferes" | "camiones" | "clientes" | "puntos_ruta",
  columnas: readonly string[],
  search: string,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from(tabla)
    .select(["id", ...columnas].join(","));
  if (error) {
    console.error(`Error buscando en ${tabla}:`, error);
    return [];
  }
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .filter((fila) => coincideEnAlguno(columnas.map((c) => fila[c]), search))
    .map((fila) => fila.id as string);
}

async function buildSearchOrFilter(
  supabase: ReturnType<typeof createAdminClient>,
  search: string,
): Promise<string> {
  // Las comas y paréntesis rompen el parser de filtros `.or()` de PostgREST.
  const sanitized = search.replace(/[(),]/g, " ").trim();
  const term = `%${sanitized}%`;
  const [choferIds, camionIds, clienteIds, lugarIds] = await Promise.all([
    buscarIdsPorTexto(supabase, "choferes", ["nombre", "apellido"], sanitized),
    buscarIdsPorTexto(supabase, "camiones", ["patente", "marca", "modelo"], sanitized),
    buscarIdsPorTexto(supabase, "clientes", ["razon_social"], sanitized),
    // Lugares. Faltaban: buscar "LOMASER" o "Ramallo" en el listado no traía
    // nada, aunque la columna Destino lo mostrara en pantalla — y los links de
    // "A dónde fueron" caían acá, así que llevaban a una lista vacía.
    buscarIdsPorTexto(supabase, "puntos_ruta", ["nombre"], sanitized),
  ]);

  // Códigos: no llevan acentos, van contra la columna original.
  const parts: string[] = [`codigo.ilike.${term}`, `nro_viaje_ypf.ilike.${term}`];

  if (choferIds.length) parts.push(`chofer_id.in.(${choferIds.join(",")})`);

  if (camionIds.length) parts.push(`camion_id.in.(${camionIds.join(",")})`);

  if (clienteIds.length) parts.push(`cliente_id.in.(${clienteIds.join(",")})`);

  if (lugarIds.length) {
    parts.push(`origen_id.in.(${lugarIds.join(",")})`);
    parts.push(`destino_id.in.(${lugarIds.join(",")})`);
  }

  return parts.join(",");
}

// Columnas reales por las que se puede ordenar (km_totales es una suma derivada,
// no una columna, por eso no se incluye).
const ORDERABLE_COLUMNS = {
  fecha: "fecha_viaje",
  toneladas: "tonelaje_real",
  monto: "monto_flete",
} as const;

export type ViajeOrderBy = keyof typeof ORDERABLE_COLUMNS;

export type GetViajesParams = {
  choferId?: string;
  page?: number;
  pageSize?: number;
  desde?: string;
  hasta?: string;
  facturado?: boolean;
  esVacio?: boolean;
  /** Solo viajes incompletos: les falta origen, destino o chofer. */
  incompleto?: boolean;
  /**
   * Solo viajes a los que les falta ESE dato puntual. Son los mismos criterios
   * que cuenta /metricas para el modo en vivo (ver `liveDesdeViajes`), así que
   * el número del KPI y el largo de esta lista tienen que coincidir.
   */
  falta?: FaltaDato;
  search?: string;
  /**
   * Sólo los viajes que fueron a ESE destino, por nombre exacto. Lo usa el link
   * de "A dónde fueron": el buscador libre traería también los que salieron de
   * ahí, y el resumen agrupa por destino, no por lugar mencionado.
   */
  destino?: string;
  orderBy?: ViajeOrderBy;
  orderDir?: "asc" | "desc";
};


export async function getViajesAction(
  params: GetViajesParams = {}
): Promise<PaginatedResult<ViajeBasico> | { error: string }> {
  const {
    choferId,
    page = 0,
    pageSize = PAGE_SIZE,
    desde,
    hasta,
    facturado,
    esVacio,
    incompleto,
    falta,
    search,
    destino,
    orderBy = "fecha",
    orderDir = "desc",
  } = params;

  const orderColumn = ORDERABLE_COLUMNS[orderBy] ?? ORDERABLE_COLUMNS.fecha;

  const supabase = createAdminClient();
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("viajes")
    .select(
      `id, fecha_viaje, km_con_carga, km_vacios, ruta_via, tonelaje_real, estado, facturado, cobrado, fecha_cobro, es_vacio, codigo, observaciones, material, monto_flete, moneda, nro_viaje_ypf, nro_remito,
       clientes(razon_social),
       choferes(nombre, apellido),
       camiones(patente, marca, modelo),
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`,
      { count: "exact" }
    )
    .order(orderColumn, { ascending: orderDir === "asc" })
    // Desempate estable por orden de carga (código secuencial): dentro del mismo
    // día los viajes salen como se cargaron (la ida antes que su vuelta vacía).
    .order("codigo", { ascending: true })
    .range(from, to);

  if (choferId) {
    query = query.eq("chofer_id", choferId);
  }

  if (desde) {
    query = query.gte("fecha_viaje", desde);
  }

  if (hasta) {
    query = query.lte("fecha_viaje", hasta);
  }

  // El estado operativo se quitó de la UI: siempre se excluyen los cancelados
  // (soft-delete), no hay filtro por estado.
  query = query.neq("estado", "cancelado");

  if (typeof facturado === "boolean") {
    query = query.eq("facturado", facturado);
  }

  if (typeof esVacio === "boolean") {
    query = query.eq("es_vacio", esVacio);
  }

  // Incompleto = le falta origen, destino o chofer (los cargan después, por su
  // forma de trabajar). Se evalúa por columnas (origen_id/destino_id/chofer_id),
  // no por el fallback de observaciones (legado).
  if (incompleto) {
    query = query.or("origen_id.is.null,destino_id.is.null,chofer_id.is.null");
  }

  // "Le falta este dato": mismos criterios que usa /metricas para contar los
  // huecos del mes en vivo. Los .or() encadenados se combinan con AND, que es
  // justo lo que necesita "km" (ninguno de los dos km cargado).
  if (falta === "km") {
    query = query
      .or("km_con_carga.is.null,km_con_carga.eq.0")
      .or("km_vacios.is.null,km_vacios.eq.0");
  } else if (falta === "monto") {
    // Los vacíos no facturan: no cuentan como "sin monto".
    query = query.eq("es_vacio", false).or("monto_flete.is.null,monto_flete.lte.0");
  } else if (falta === "tonelaje") {
    query = query.eq("es_vacio", false).or("tonelaje_real.is.null,tonelaje_real.lte.0");
  } else if (falta === "chofer") {
    query = query.is("chofer_id", null);
  }

  if (search) {
    const orFilter = await buildSearchOrFilter(supabase, search);
    query = query.or(orFilter);
  }

  if (destino?.trim()) {
    // Puede haber más de un punto con el mismo nombre (LOMASER / Lomaser), así
    // que entran todos los que coincidan.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: puntos } = await (supabase as any)
      .from("puntos_ruta")
      .select("id")
      .ilike("nombre", destino.trim());
    const ids = ((puntos ?? []) as { id: string }[]).map((p) => p.id);
    // Sin coincidencias el filtro tiene que dar vacío, no ignorarse: si no,
    // mostraría TODOS los viajes como si el filtro no existiera.
    query = ids.length
      ? query.in("destino_id", ids)
      : query.eq("destino_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error al obtener viajes:", error);
    return { error: "No se pudo cargar los viajes." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped: ViajeBasico[] = (data ?? []).map((v: any) => {
    let oName = v.origen?.nombre ?? null;
    let dName = v.destino?.nombre ?? null;

    if (!oName && v.observaciones) {
      const match = v.observaciones.match(/Origen:\s*([^|]+)/);
      if (match) oName = match[1].trim();
    }

    if (!dName && v.observaciones) {
      const match = v.observaciones.match(/Destino:\s*([^|]+)/);
      if (match) dName = match[1].trim();
    }

    let choferStr: string | null = null;
    if (v.choferes) {
      choferStr = [v.choferes.apellido, v.choferes.nombre].filter(Boolean).join(", ");
    } else if (v.chofer) {
      choferStr = [v.chofer.apellido, v.chofer.nombre].filter(Boolean).join(", ");
    }

    let camionStr: string | null = null;
    if (v.camiones) {
      camionStr = [v.camiones.patente, v.camiones.marca, v.camiones.modelo]
        .filter(Boolean)
        .join(" - ");
    } else if (v.camion) {
      camionStr = [v.camion.patente, v.camion.marca, v.camion.modelo].filter(Boolean).join(" - ");
    }

    return {
      id: v.id,
      codigo: v.codigo,
      fecha_viaje: v.fecha_viaje,
      origen: oName,
      destino: dName,
      cliente: v.clientes?.razon_social ?? v.cliente?.razon_social ?? "—",
      toneladas: Number(v.tonelaje_real) || 0,
      km_totales: (v.km_con_carga ?? 0) + (v.km_vacios ?? 0),
      km_con_carga: v.km_con_carga ?? 0,
      km_vacios: v.km_vacios ?? 0,
      estado: v.estado,
      facturado: v.facturado,
      cobrado: v.cobrado ?? false,
      fecha_cobro: v.fecha_cobro ?? null,
      chofer: choferStr ?? "—",
      camion: camionStr ?? "—",
      monto_flete: v.monto_flete ?? null,
      moneda: v.moneda ?? "ARS",
      observaciones: v.observaciones ?? null,
      nro_viaje_ypf: v.nro_viaje_ypf ?? null,
      nro_remito: v.nro_remito ?? null,
      material: v.material ?? extractMaterialFromObs(v.observaciones),
      es_vacio: v.es_vacio ?? false,
      // Viaja en la fila y no en el detalle: la columna Ruta del listado tiene
      // que estar dibujada antes de que nadie expanda nada.
      ruta_via: (v.ruta_via as RutaVia | null) ?? null,
    };
  });

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * pageSize,
    count: count ?? 0,
  };
}

// ============================================================================
// Data para el formulario de Nuevo Viaje (selects maestros)
// ============================================================================

export type ViajeFormOption = { id: string; label: string };

/** Igual que ViajeFormOption pero con el camión asignado al chofer (puede ser null).
 *  - `disabled` true cuando el legajo del chofer está incompleto (no puede
 *    ser asignado a un viaje hasta que se complete; ver lib/chofer-validation.ts).
 *  - `motivo` resume qué falta. */
export type ChoferFormOption = ViajeFormOption & {
  camionId: string | null;
  disabled?: boolean;
  motivo?: string;
  /** Ausencia/vacaciones vigente o próxima (≤14 días) para avisar al cargar el viaje. */
  ausencia?: { tipo: string; desde: string; hasta: string; enCurso: boolean } | null;
};

/** Circuito (ruta) predefinido: trae origen/destino y km cargados + vacíos para
 *  autocompletar el viaje. Los valores quedan editables (override puntual). */
export type CircuitoFormOption = {
  id: string;
  label: string;
  origen: string;
  destino: string;
  km_con_carga: number;
  km_vacios: number;
};

export type ViajeFormData = {
  clientes: ViajeFormOption[];
  choferes: ChoferFormOption[];
  camiones: ViajeFormOption[];
  tipos_carga: ViajeFormOption[];
  puntos_ruta: ViajeFormOption[];
  circuitos: CircuitoFormOption[];
};

export async function getViajeFormData(): Promise<ViajeFormData | { error: string }> {
  const supabase = createAdminClient();

  // Fecha de hoy para la planilla diaria (se pide dentro del batch paralelo).
  const hoy = new Date().toISOString().slice(0, 10);
  const en14 = new Date();
  en14.setDate(en14.getDate() + 14);
  const en14Str = en14.toISOString().slice(0, 10);

  const [
    clientesRes,
    choferesRes,
    camionesRes,
    tiposCargaRes,
    puntosRes,
    circuitosRes,
    asignacionesHoyRes,
    ausenciasHoyRes,
  ] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, razon_social")
        .eq("estado", "activo")
        .order("razon_social", { ascending: true }),
      supabase
        .from("choferes")
        .select("id, nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso")
        .eq("estado", "activo")
        .order("apellido", { ascending: true }),
      supabase
        .from("camiones")
        .select("id, patente, chofer_actual_id")
        .eq("estado", "activo")
        .order("patente", { ascending: true }),
      supabase
        .from("tipos_carga")
        .select("id, nombre")
        .eq("estado", "activo")
        .order("nombre", { ascending: true }),
      supabase
        .from("puntos_ruta")
        .select("id, nombre")
        .eq("estado", "activo")
        .order("nombre", { ascending: true }),
      supabase
        .from("rutas")
        .select(
          `id, km_oficiales, km_vacios, codigo_interno,
           origen:puntos_ruta!rutas_origen_id_fkey (nombre),
           destino:puntos_ruta!rutas_destino_id_fkey (nombre)`,
        )
        .eq("estado", "activa")
        // Las rutas que sembramos solo para anclar una tarifa van con km 0; no son
        // circuitos reales y no deben aparecer en el desplegable de la carga.
        .gt("km_oficiales", 0)
        .order("codigo_interno", { ascending: true }),
      // Planilla diaria de HOY: antes era una consulta serial después del batch;
      // ahora va en paralelo con el resto. Su error se ignora igual que antes
      // (si falla, se usa el camión habitual del chofer como fallback).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("asignacion_diaria")
        .select("chofer_id, camion_id")
        .eq("fecha", hoy),
      // Ausencias/vacaciones vigentes o que arrancan dentro de 14 días: para avisar
      // si se elige un chofer que no va a estar disponible. Su error se ignora.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("chofer_ausencias")
        .select("chofer_id, tipo, fecha_inicio, fecha_fin")
        .eq("estado", "autorizada")
        .is("deleted_at", null)
        .gte("fecha_fin", hoy)
        .lte("fecha_inicio", en14Str),
    ]);

  if (
    clientesRes.error ||
    choferesRes.error ||
    camionesRes.error ||
    tiposCargaRes.error ||
    puntosRes.error ||
    circuitosRes.error
  ) {
    console.error("Error cargando datos del formulario de viaje", {
      clientes: clientesRes.error,
      choferes: choferesRes.error,
      camiones: camionesRes.error,
      tipos_carga: tiposCargaRes.error,
      puntos_ruta: puntosRes.error,
      circuitos: circuitosRes.error,
    });
    return { error: "No se pudieron cargar los datos del formulario." };
  }

  let tiposCargaList = (tiposCargaRes.data ?? []).map((t) => ({
    id: t.id,
    label: t.nombre,
  }));

  // Catálogo vacío (primer arranque): ofrecemos opciones genéricas SIN escribir
  // en la base desde esta lectura. Van como centinelas "nuevo:<nombre>" (y
  // "otros") que se materializan al guardar el viaje (get-or-create por nombre).
  if (tiposCargaList.length === 0) {
    tiposCargaList = [
      "Carga General",
      "Carga Refrigerada",
      "Carga a Granel",
      "Carga Paletizada",
      "Carga Peligrosa",
      "Otros",
    ].map((nombre) => ({
      id: nombre.toLowerCase() === "otros" ? "otros" : `${TIPO_CARGA_NUEVO_PREFIX}${nombre}`,
      label: nombre,
    }));
  }

  // Garantizar que la opción "Otros" siempre exista en la lista final
  const hasOtros = tiposCargaList.some((t) => t.label.toLowerCase() === "otros");
  if (!hasOtros) {
    tiposCargaList.push({ id: "otros", label: "Otros" });
  }

  // Mapa chofer_id → camión asignado (para auto-completar en el form).
  // Base: el camión "habitual" (chofer_actual_id). Luego, la planilla diaria de
  // HOY tiene prioridad: un titular puede faltar y otro tomar su unidad por un día.
  const camionPorChofer = new Map<string, string>();
  for (const cam of camionesRes.data ?? []) {
    if ((cam as { chofer_actual_id?: string | null }).chofer_actual_id) {
      camionPorChofer.set(
        (cam as { chofer_actual_id: string }).chofer_actual_id,
        cam.id,
      );
    }
  }

  for (const a of (asignacionesHoyRes.data ?? []) as {
    chofer_id: string;
    camion_id: string | null;
  }[]) {
    // camion_id null = la planilla de hoy lo dejó sin unidad; no pisamos el habitual.
    if (a.camion_id) camionPorChofer.set(a.chofer_id, a.camion_id);
  }

  // Ausencia más próxima por chofer (la de fecha_inicio menor). enCurso = ya empezó.
  const ausenciaPorChofer = new Map<string, { tipo: string; desde: string; hasta: string; enCurso: boolean }>();
  for (const a of (ausenciasHoyRes?.data ?? []) as {
    chofer_id: string; tipo: string; fecha_inicio: string; fecha_fin: string;
  }[]) {
    const prev = ausenciaPorChofer.get(a.chofer_id);
    if (prev && prev.desde <= a.fecha_inicio) continue;
    ausenciaPorChofer.set(a.chofer_id, {
      tipo: a.tipo,
      desde: a.fecha_inicio,
      hasta: a.fecha_fin,
      enCurso: a.fecha_inicio <= hoy,
    });
  }

  return {
    clientes: (clientesRes.data ?? []).map((c) => ({
      id: c.id,
      label: c.razon_social,
    })),
    choferes: (choferesRes.data ?? []).map((c) => {
      const estado = getLegajoEstado(c);
      return {
        id: c.id,
        label: estado.completo
          ? `${c.apellido}, ${c.nombre}`
          : `⚠ ${c.apellido}, ${c.nombre} — legajo incompleto`,
        camionId: camionPorChofer.get(c.id) ?? null,
        disabled: !estado.completo,
        motivo: estado.completo ? undefined : `Falta: ${estado.faltantes.join(", ")}`,
        ausencia: ausenciaPorChofer.get(c.id) ?? null,
      };
    }),
    camiones: (camionesRes.data ?? []).map((c) => ({
      id: c.id,
      label: c.patente,
    })),
    tipos_carga: tiposCargaList,
    puntos_ruta: (puntosRes.data ?? []).map((p) => ({
      id: p.id,
      label: p.nombre,
    })),
    circuitos: (circuitosRes.data ?? []).map((r) => {
      const origen = (r.origen as { nombre: string } | null)?.nombre ?? "—";
      const destino = (r.destino as { nombre: string } | null)?.nombre ?? "—";
      const km = Number(r.km_oficiales);
      const codigo = r.codigo_interno ? `${r.codigo_interno} · ` : "";
      return {
        id: r.id,
        label: `${codigo}${origen} → ${destino} (${km} km)`,
        origen,
        destino,
        km_con_carga: km,
        km_vacios: Number(r.km_vacios),
      };
    }),
  };
}


// ============================================================================
// Autocompletado de km por historial (origen → destino)
// ----------------------------------------------------------------------------
// Cuando el operador completa origen y destino, traemos los km del último viaje
// con ese mismo par para precargarlos (ej. Lomaser → Ramallo = 300 km). Es
// direccional: la vuelta usa el par invertido, que tiene su propio historial.
// ============================================================================

export async function getKmHistoricoAction(
  origenNombre: string,
  destinoNombre: string,
  // Vía del viaje (Ruta 5 / Ruta 22): los km cambian según por dónde fue, así
  // que el historial se consulta por vía. Sin vía = cualquier viaje del par.
  via?: "ruta_5" | "ruta_22" | null,
): Promise<{ distancia: number } | null> {
  await requireArea("viajes", "read");

  const o = origenNombre.trim();
  const d = destinoNombre.trim();
  if (!o || !d || o === "—" || d === "—") return null;

  const supabase = createAdminClient();

  // Resolver los puntos por nombre (match exacto case-insensitive).
  const [origenRes, destinoRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("puntos_ruta").select("id").ilike("nombre", o).limit(1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("puntos_ruta").select("id").ilike("nombre", d).limit(1),
  ]);

  const origenId = origenRes.data?.[0]?.id as string | undefined;
  const destinoId = destinoRes.data?.[0]?.id as string | undefined;
  if (!origenId || !destinoId) return null;

  // Buscamos km con carga y km vacíos POR SEPARADO: un par puede tener su
  // distancia "cargada" en un viaje y la "vacía" en otro (ej. rutas que algunas
  // veces van cargadas y otras de retorno vacío). Y hay rutas que SIEMPRE van
  // vacías (km_con_carga = 0): antes el filtro `km_con_carga > 0` las dejaba sin
  // precargar los km vacíos. Tomamos el valor más reciente de cada uno.
  //
  // La vía define la distancia (Ruta 5 va más corto que Ruta 22 en el mismo par):
  //  - Con vía marcada → solo viajes de ESA vía.
  //  - Sin marcar → preferimos viajes también sin marcar, para no arrastrar la
  //    distancia de una Ruta 5/22 a un viaje "normal". Si el par no tiene ningún
  //    viaje sin marcar (todos fueron por una vía), caemos a cualquiera (fallback).
  const base = (col: "km_con_carga" | "km_vacios", soloSinMarcar: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("viajes")
      .select(col)
      .eq("origen_id", origenId)
      .eq("destino_id", destinoId)
      .neq("estado", "cancelado")
      .gt(col, 0);
    if (via) q = q.eq("ruta_via", via);
    else if (soloSinMarcar) q = q.is("ruta_via", null);
    return q.order("fecha_viaje", { ascending: false }).limit(1);
  };

  const leer = async (soloSinMarcar: boolean) => {
    const [conCargaRes, vaciosRes] = await Promise.all([
      base("km_con_carga", soloSinMarcar),
      base("km_vacios", soloSinMarcar),
    ]);
    return {
      km_con_carga: Number(conCargaRes.data?.[0]?.km_con_carga) || 0,
      km_vacios: Number(vaciosRes.data?.[0]?.km_vacios) || 0,
    };
  };

  // Sin vía marcada empezamos exigiendo viajes sin marcar; con vía el flag no aplica.
  let res = await leer(!via);
  // Fallback: par sin historial "sin marcar" → usar cualquier viaje del par.
  if (!via && !res.km_con_carga && !res.km_vacios) {
    res = await leer(false);
  }

  // La distancia de un tramo es UNA sola (la misma vaya cargado o vacío): se
  // prefiere la del viaje cargado y, si la ruta solo tuvo vacíos, se usa esa. El
  // caller la pone en km con carga (viaje cargado) o km vacíos (vuelta vacía),
  // nunca en las dos: un viaje es un tramo.
  const distancia = res.km_con_carga || res.km_vacios;
  if (!distancia) return null;

  return { distancia };
}

// ============================================================================
// Autocompletado de importe por tarifa (el destino define el precio)
// ----------------------------------------------------------------------------
// Al cargar un viaje, una vez elegidos cliente + destino + tonelaje, buscamos la
// tarifa vigente que aplica y devolvemos el importe sugerido — igual que lo
// calcula el DM (toneladas × precio del destino). El monto queda EDITABLE: esto
// solo lo precarga, y al guardar persistimos `tarifa_id` como snapshot de la
// tarifa usada.
//
// "El destino define el precio": priorizamos el match por destino. La tabla
// `tarifas` ancla el precio a una ruta (origen→destino) por cliente; para YPF el
// origen es constante (la cantera) y el destino varía, así que el match por
// destino cubre el caso aunque el origen difiera levemente.
// ============================================================================

export type ImporteSugerido = {
  importe: number;
  tarifaId: string;
  modalidad: TarifaModalidad;
  valor: number;
  moneda: string;
  detalle: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TarifaVigente = any;

export async function getImporteSugeridoAction(
  clienteId: string,
  origenNombre: string | null,
  destinoNombre: string | null,
  tonelaje: number,
  kmConCarga: number,
  fechaViaje?: string | null,
): Promise<ImporteSugerido | null> {
  await requireArea("viajes", "read");

  if (!clienteId) return null;
  const tn = Number.isFinite(tonelaje) ? tonelaje : 0;
  const km = Number.isFinite(kmConCarga) ? kmConCarga : 0;

  const supabase = createAdminClient();
  const ref =
    fechaViaje && /^\d{4}-\d{2}-\d{2}$/.test(fechaViaje)
      ? fechaViaje
      : new Date().toISOString().slice(0, 10);

  // Resolver origen/destino por nombre (puede no resolver: una tarifa con ruta
  // null igual aplica como tarifa general del cliente).
  const resolvePunto = async (nombre: string | null): Promise<string | null> => {
    const n = (nombre ?? "").trim();
    if (!n || n === "—") return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("puntos_ruta")
      .select("id")
      .ilike("nombre", n)
      .limit(1);
    return data?.[0]?.id ?? null;
  };
  const [origenId, destinoId] = await Promise.all([
    resolvePunto(origenNombre),
    resolvePunto(destinoNombre),
  ]);

  // Tarifas activas y vigentes del cliente, con su ruta (origen/destino/km).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tarifas } = await (supabase as any)
    .from("tarifas")
    .select(
      "id, modalidad, valor, moneda, ruta_id, vigencia_desde, vigencia_hasta, ruta:ruta_id(origen_id, destino_id, km_oficiales)",
    )
    .eq("cliente_id", clienteId)
    .eq("activa", true)
    .lte("vigencia_desde", ref)
    .order("vigencia_desde", { ascending: false });

  const vigentes: TarifaVigente[] = (tarifas ?? []).filter(
    (t: TarifaVigente) => t.vigencia_hasta == null || t.vigencia_hasta >= ref,
  );
  if (vigentes.length === 0) return null;

  // Selección (ruta exacta → mismo destino → general) y cálculo: lógica pura,
  // testeable, en domain/viajes/tarifa-importe.
  const elegida = pickTarifaAplicable(vigentes, origenId, destinoId);
  if (!elegida) return null;

  const modalidad = elegida.modalidad as TarifaModalidad;
  const valor = Number(elegida.valor) || 0;
  const kmRuta = rutaDeTarifa(elegida)?.km_oficiales ?? null;

  const importe = computeImporteTarifa(modalidad, valor, { tonelaje: tn, kmConCarga: km, kmRuta });
  if (!(importe > 0)) return null;

  const kmUsado = kmRuta && kmRuta > 0 ? Number(kmRuta) : km;
  return {
    importe,
    tarifaId: elegida.id as string,
    modalidad,
    valor,
    moneda: (elegida.moneda as string) ?? "ARS",
    detalle: detalleTarifa(modalidad, valor, { tonelaje: tn, km: kmUsado }),
  };
}

// ============================================================================
// Crear viaje
// ============================================================================

const VIAJE_ESTADO_VALUES = ["pendiente", "en_curso", "cerrado"] as const;

// Vía del viaje (reunión Nico 02/07): Ruta 5 = directa (más corta) · Ruta 22 =
// por la base/zona (combustible, roturas). De la vía dependen los km del par.
// Los valores salen de @/domain/viajes/ruta-via, que es de donde también salen
// las etiquetas: si el enum y el mapa se separan, la UI muestra el crudo.
export type RutaVia = (typeof RUTA_VIA_VALUES)[number];

const viajeSchema = z
  .object({
    fecha_viaje: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
    // El estado operativo se quitó de la UI; el alta/edición/carga rápida ya no
    // lo mandan. Se defaultea a 'pendiente' para satisfacer la columna NOT NULL.
    estado: z.enum(VIAJE_ESTADO_VALUES).optional().default("pendiente"),
    cliente_id: z.string().uuid("Cliente inválido."),
    chofer_id: z.string().uuid("Chofer inválido."),
    camion_id: z.string().uuid("Camión inválido."),
    tipo_carga_id: z.string().min(1, "Tipo de carga requerido."),
    ruta_id: z.string().uuid("Circuito inválido.").optional().nullable(),
    origen_nombre: z.string().optional().nullable(),
    destino_nombre: z.string().optional().nullable(),
    km_con_carga: z.number().int().min(0, "Debe ser ≥ 0."),
    km_vacios: z.number().int().min(0, "Debe ser ≥ 0."),
    ruta_via: z.enum(RUTA_VIA_VALUES).optional().nullable(),
    tonelaje_real: z.number().min(0, "Debe ser ≥ 0."),
    monto_flete: z.number().min(0, "Debe ser ≥ 0."),
    nro_viaje_ypf: z.string().max(60, "Máximo 60 caracteres.").optional().nullable(),
    material: z.string().trim().max(120, "Máximo 120 caracteres.").optional().nullable(),
    // Tarifa usada para precargar el monto (snapshot). El monto sigue siendo
    // editable; si el operador lo cambió a mano, el front no envía tarifa_id.
    tarifa_id: z.string().uuid("Tarifa inválida.").optional().nullable(),
  })
  .refine(
    (d) =>
      !(
        d.origen_nombre &&
        d.destino_nombre &&
        d.origen_nombre.toLowerCase().trim() ===
          d.destino_nombre.toLowerCase().trim()
      ),
    {
      message: "Origen y destino deben ser distintos.",
      path: ["destino_nombre"],
    },
  );

// Tramo de vuelta (opcional) que se carga junto con la ida en el mismo submit.
// `modo` distingue si el camión vuelve vacío (sin flete) o cargado (puede ser
// con material distinto al de la ida).
const VUELTA_MODO_VALUES = ["vacio", "cargado"] as const;

/** Tope de tramos extra por salida: una vuelta larga rara vez pasa de esto y
 *  evita que un form armado a mano inserte cientos de viajes de una. */
const MAX_TRAMOS = 12;

const vueltaSchema = z.object({
  modo: z.enum(VUELTA_MODO_VALUES),
  origen_nombre: z.string().optional().nullable(),
  destino_nombre: z.string().optional().nullable(),
  km_con_carga: z.number().int().min(0, "Debe ser ≥ 0."),
  km_vacios: z.number().int().min(0, "Debe ser ≥ 0."),
  ruta_via: z.enum(RUTA_VIA_VALUES).optional().nullable(),
  tonelaje_real: z.number().min(0, "Debe ser ≥ 0."),
  monto_flete: z.number().min(0, "Debe ser ≥ 0."),
  material: z.string().trim().max(120, "Máximo 120 caracteres.").optional().nullable(),
  nro_viaje_ypf: z.string().max(60, "Máximo 60 caracteres.").optional().nullable(),
});

export type CreateViajeState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

function emptyOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumber(v: FormDataEntryValue | null): number {
  const s = String(v ?? "").trim();
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Genera `count` códigos de viaje secuenciales (`V-AAAA-NNNNN`). Se usa para
 *  alta unitaria (count=1) y para el alta ida+vuelta (count=2). */
async function generarCodigosViaje(
  supabase: ReturnType<typeof createAdminClient>,
  count: number,
): Promise<string[]> {
  const year = new Date().getFullYear();
  const prefix = `V-${year}-`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("viajes")
    .select("codigo")
    .like("codigo", `${prefix}%`)
    .order("codigo", { ascending: false })
    .limit(1);

  if (error) throw error;

  let next = 1;
  if (data && data.length > 0) {
    const lastCodigo: string = data[0].codigo;
    const tail = lastCodigo.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed)) next = parsed + 1;
  }

  return Array.from({ length: count }, (_, i) =>
    `${prefix}${String(next + i).padStart(5, "0")}`,
  );
}

/**
 * Punto de ruta por nombre, dándolo de alta si es la primera vez que se escribe.
 *
 * Si el alta falla, LANZA. Antes devolvía null y el viaje se guardaba igual con
 * origen/destino vacíos: la pantalla decía "listo" y el error recién aparecía
 * días después en la hoja de ruta, con el viaje mostrando dos guiones y sin
 * forma de saber a dónde había ido el camión.
 */
async function getOrCreatePuntoRuta(
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string
): Promise<string | null> {
  const trimmed = nombre.trim();
  if (!trimmed) return null;

  const buscarPorNombre = async (): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("puntos_ruta")
      .select("id")
      .ilike("nombre", trimmed)
      .limit(1);
    return !error && data && data.length > 0 ? (data[0].id as string) : null;
  };

  const existente = await buscarPorNombre();
  if (existente) return existente;

  // Sin `as any` a propósito: acá el tipo generado de la tabla es la única
  // defensa contra escribir una columna que no existe. Con el cast, el insert
  // traía `es_frontera`/`es_puerto` (columnas inexistentes), fallaba siempre y
  // ningún lugar nuevo se llegaba a crear.
  const insertRes = await supabase
    .from("puntos_ruta")
    .insert({ nombre: trimmed, estado: "activo", tipo: "otro" })
    .select("id")
    .single();

  if (insertRes.error) {
    // 23505 = el índice único de `puntos_ruta.nombre` rechazó el alta porque
    // otra alta simultánea del MISMO lugar llegó primero. Eso no es un error:
    // el lugar existe, sólo hay que volver a leerlo. Sin este reintento, cargar
    // varias filas con un destino nuevo (LAJE9, LAJE41) hacía que todas menos
    // una explotaran y se cayera el lote entero.
    if (insertRes.error.code === "23505") {
      const ganador = await buscarPorNombre();
      if (ganador) return ganador;
    }
    console.error(`Error creando el punto de ruta "${trimmed}":`, insertRes.error);
    throw new Error(`No se pudo dar de alta el lugar "${trimmed}".`);
  }
  return insertRes.data.id;
}

async function getOrCreateTipoCargaOtros(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("tipos_carga")
    .select("id")
    .ilike("nombre", "otros")
    .limit(1);

  if (!error && data && data.length > 0) {
    return data[0].id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertRes = await (supabase as any)
    .from("tipos_carga")
    .insert({
      nombre: "Otros",
      descripcion: "Carga general / Otros",
      requiere_documentacion_especial: false,
      estado: "activo",
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;
  return insertRes.data.id;
}

/** Get-or-create de un tipo de carga por nombre (case-insensitive). */
async function getOrCreateTipoCargaByNombre(
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("tipos_carga")
    .select("id")
    .ilike("nombre", nombre)
    .limit(1);

  if (!error && data && data.length > 0) return data[0].id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertRes = await (supabase as any)
    .from("tipos_carga")
    .insert({
      nombre,
      descripcion: `Carga ${nombre}`,
      requiere_documentacion_especial: /peligros/i.test(nombre),
      estado: "activo",
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;
  return insertRes.data.id;
}

/** Resuelve el tipo_carga_id elegido en el form a un id real de la tabla.
 *  Materializa los centinelas del form ("otros" y "nuevo:<nombre>") al escribir;
 *  cualquier otro valor se asume ya un id válido y se devuelve tal cual. */
async function resolveTipoCargaId(
  supabase: ReturnType<typeof createAdminClient>,
  tipoCargaId: string,
): Promise<string> {
  if (tipoCargaId === "otros") return getOrCreateTipoCargaOtros(supabase);
  if (tipoCargaId.startsWith(TIPO_CARGA_NUEVO_PREFIX)) {
    return getOrCreateTipoCargaByNombre(
      supabase,
      tipoCargaId.slice(TIPO_CARGA_NUEVO_PREFIX.length).trim(),
    );
  }
  return tipoCargaId;
}

export async function createViajeAction(
  _prev: CreateViajeState,
  formData: FormData,
): Promise<CreateViajeState> {
  const parsed = viajeSchema.safeParse({
    fecha_viaje: String(formData.get("fecha_viaje") ?? "").trim(),
    estado: formData.get("estado") ?? "pendiente",
    cliente_id: String(formData.get("cliente_id") ?? "").trim(),
    chofer_id: String(formData.get("chofer_id") ?? "").trim(),
    camion_id: String(formData.get("camion_id") ?? "").trim(),
    tipo_carga_id: String(formData.get("tipo_carga_id") ?? "").trim(),
    ruta_id: emptyOrNull(formData.get("ruta_id")),
    origen_nombre: emptyOrNull(formData.get("origen_nombre")),
    destino_nombre: emptyOrNull(formData.get("destino_nombre")),
    km_con_carga: parseNumber(formData.get("km_con_carga")),
    km_vacios: parseNumber(formData.get("km_vacios")),
    ruta_via: emptyOrNull(formData.get("ruta_via")),
    tonelaje_real: parseNumber(formData.get("tonelaje_real")),
    monto_flete: parseNumber(formData.get("monto_flete")),
    nro_viaje_ypf: emptyOrNull(formData.get("nro_viaje_ypf")),
    material: emptyOrNull(formData.get("material")),
    tarifa_id: emptyOrNull(formData.get("tarifa_id")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  // Tramos siguientes (opcionales): la salida rara vez es ida y vuelta y listo.
  // Nico (27/07): Olavarría→Cerrito, Cerrito→Ramallo vacío y Ramallo→Lomaser
  // cargado — con un solo tramo de vuelta le quedaba un viaje sin registrar.
  // Se validan TODOS antes de tocar la base: o entra la salida completa o no
  // entra nada.
  const tramosCount = Math.min(MAX_TRAMOS, Math.max(0, parseNumber(formData.get("tramos_count"))));
  const tramos: z.infer<typeof vueltaSchema>[] = [];
  for (let i = 0; i < tramosCount; i++) {
    const campo = (n: string) => formData.get(`tramo_${i}_${n}`);
    const tParsed = vueltaSchema.safeParse({
      modo: String(campo("modo") ?? "vacio"),
      origen_nombre: emptyOrNull(campo("origen_nombre")),
      destino_nombre: emptyOrNull(campo("destino_nombre")),
      km_con_carga: parseNumber(campo("km_con_carga")),
      km_vacios: parseNumber(campo("km_vacios")),
      ruta_via: emptyOrNull(campo("ruta_via")),
      tonelaje_real: parseNumber(campo("tonelaje_real")),
      monto_flete: parseNumber(campo("monto_flete")),
      material: emptyOrNull(campo("material")),
      nro_viaje_ypf: emptyOrNull(campo("nro_viaje_ypf")),
    });
    if (!tParsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of tParsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[`tramo_${i}_${key}`]) {
          fieldErrors[`tramo_${i}_${key}`] = issue.message;
        }
      }
      return { error: `Revisá los datos del tramo ${i + 2}.`, fieldErrors };
    }
    const tramo = tParsed.data;
    // Si va vacío no hay flete, tonelaje ni material: se fuerza acá para no
    // confiar en lo que mande el form.
    if (tramo.modo === "vacio") {
      tramo.tonelaje_real = 0;
      tramo.monto_flete = 0;
      tramo.material = null;
    }
    if (
      tramo.origen_nombre &&
      tramo.destino_nombre &&
      tramo.origen_nombre.toLowerCase().trim() === tramo.destino_nombre.toLowerCase().trim()
    ) {
      return {
        error: `El origen y el destino del tramo ${i + 2} deben ser distintos.`,
        fieldErrors: { [`tramo_${i}_destino_nombre`]: "Origen y destino deben ser distintos." },
      };
    }
    tramos.push(tramo);
  }

  const user = await requireArea("viajes", "write");

  const supabase = createAdminClient();

  let realTipoCargaId = parsed.data.tipo_carga_id;
  const notasAdicionales: string[] = [];

  if (realTipoCargaId === "otros") {
    const descOtros = String(formData.get("descripcion_otros") ?? "").trim();
    if (descOtros) {
      notasAdicionales.push(`Carga (Otros): ${descOtros}`);
    }
  }

  try {
    realTipoCargaId = await resolveTipoCargaId(supabase, realTipoCargaId);
  } catch (e) {
    console.error("Error resolviendo el tipo de carga:", e);
    return { error: "No se pudo resolver el tipo de carga seleccionado." };
  }

  // Origen/destino se persisten en sus columnas (origen_id/destino_id), que son la
  // fuente de verdad. No se duplican en observaciones.
  //
  // Si el lugar no se puede dar de alta, el viaje no se guarda: guardarlo sin
  // origen ni destino es peor que devolver el error, porque queda cargado a
  // medias y nadie se entera hasta la hoja de ruta.
  let origen_id: string | null = null;
  let destino_id: string | null = null;
  try {
    if (parsed.data.origen_nombre && parsed.data.origen_nombre !== "—") {
      origen_id = await getOrCreatePuntoRuta(supabase, parsed.data.origen_nombre.trim());
    }
    if (parsed.data.destino_nombre && parsed.data.destino_nombre !== "—") {
      destino_id = await getOrCreatePuntoRuta(supabase, parsed.data.destino_nombre.trim());
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dar de alta el lugar." };
  }

  // Defensa: aunque la UI bloquea las opciones incompletas, validar acá por
  // si alguien envía el id directo.
  {
    const { data: choferRow } = await supabase
      .from("choferes")
      .select("nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso, estado")
      .eq("id", parsed.data.chofer_id)
      .single();
    if (choferRow) {
      if (choferRow.estado === "baja") {
        return {
          ok: false,
          error: `${choferRow.apellido}, ${choferRow.nombre} está egresado: no se le pueden cargar viajes nuevos.`,
          fieldErrors: { chofer_id: "Chofer egresado." },
        };
      }
      const estadoLegajo = getLegajoEstado(choferRow);
      if (!estadoLegajo.completo) {
        return {
          ok: false,
          error: `El chofer tiene el legajo incompleto (falta: ${estadoLegajo.faltantes.join(", ")}). Completá los datos en el legajo antes de asignarlo a un viaje.`,
          fieldErrors: { chofer_id: "Legajo incompleto." },
        };
      }
    }
  }

  // Origen/destino de cada tramo extra.
  const tramosPuntos: { origenId: string | null; destinoId: string | null }[] = [];
  try {
    for (const t of tramos) {
      tramosPuntos.push({
        origenId:
          t.origen_nombre && t.origen_nombre !== "—"
            ? await getOrCreatePuntoRuta(supabase, t.origen_nombre.trim())
            : null,
        destinoId:
          t.destino_nombre && t.destino_nombre !== "—"
            ? await getOrCreatePuntoRuta(supabase, t.destino_nombre.trim())
            : null,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dar de alta el lugar." };
  }

  let codigos: string[];
  try {
    codigos = await generarCodigosViaje(supabase, 1 + tramos.length);
  } catch (e) {
    console.error("Error generando código de viaje", e);
    return { error: "No se pudo generar el código del viaje." };
  }

  const observacionesDB = notasAdicionales.length > 0 ? notasAdicionales.join(" | ") : null;

  const idaData = {
    codigo: codigos[0],
    fecha_viaje: parsed.data.fecha_viaje,
    estado: parsed.data.estado,
    cliente_id: parsed.data.cliente_id,
    chofer_id: parsed.data.chofer_id,
    camion_id: parsed.data.camion_id,
    tipo_carga_id: realTipoCargaId,
    ruta_id: parsed.data.ruta_id ?? null,
    origen_id,
    destino_id,
    km_con_carga: parsed.data.km_con_carga,
    km_vacios: parsed.data.km_vacios,
    ruta_via: parsed.data.ruta_via ?? null,
    tonelaje_real: parsed.data.tonelaje_real,
    monto_flete: parsed.data.monto_flete,
    moneda: "ARS",
    observaciones: observacionesDB,
    nro_viaje_ypf: parsed.data.nro_viaje_ypf ?? null,
    material: parsed.data.material || null,
    es_vacio: false,
    // Snapshot de la tarifa que precargó el monto (null si se cargó/editó a mano).
    tarifa_id: parsed.data.tarifa_id ?? null,
    // Regla unificada: con monto de flete > 0 el viaje queda facturado (igual
    // que importadores/hoja de ruta/cierre). Sin monto queda sin facturar.
    // `cobrado` es espejo de facturado: no hay flujo de cobro aparte (03/07/2026).
    facturado: viajeEstaFacturado(parsed.data.monto_flete),
    cobrado: viajeEstaFacturado(parsed.data.monto_flete),
    created_by: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloads: Record<string, any>[] = [idaData];

  tramos.forEach((t, i) => {
    const esVacio = t.modo === "vacio";
    payloads.push({
      codigo: codigos[i + 1],
      fecha_viaje: parsed.data.fecha_viaje,
      estado: parsed.data.estado,
      cliente_id: parsed.data.cliente_id,
      chofer_id: parsed.data.chofer_id,
      camion_id: parsed.data.camion_id,
      tipo_carga_id: realTipoCargaId,
      ruta_id: null,
      origen_id: tramosPuntos[i]!.origenId,
      destino_id: tramosPuntos[i]!.destinoId,
      km_con_carga: t.km_con_carga,
      km_vacios: t.km_vacios,
      ruta_via: t.ruta_via ?? null,
      tonelaje_real: t.tonelaje_real,
      monto_flete: t.monto_flete,
      moneda: "ARS",
      // Deja rastro de a qué salida pertenece y en qué orden va.
      observaciones: `Tramo ${i + 2} de ${codigos[0]}${esVacio ? " · vacío" : ""}`,
      nro_viaje_ypf: t.nro_viaje_ypf ?? null,
      material: t.material || null,
      es_vacio: esVacio,
      facturado: viajeEstaFacturado(t.monto_flete, esVacio),
      cobrado: viajeEstaFacturado(t.monto_flete, esVacio),
      created_by: user.id,
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("viajes")
    .insert(payloads)
    .select("id, codigo");

  if (error) {
    console.error("Error al crear viaje:", error);
    return { error: error.message };
  }

  // Auditar cada viaje creado, emparejando por código (el orden de retorno del
  // insert no está garantizado).
  const payloadPorCodigo = new Map(payloads.map((p) => [p.codigo as string, p]));
  for (const row of (inserted ?? []) as { id: string; codigo: string }[]) {
    const p = payloadPorCodigo.get(row.codigo);
    if (p) await logViajeAudit(supabase, row.id, "crear", null, p, user.id);
  }

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  return { ok: true };
}

// ============================================================================
// Obtener todos los viajes para exportación a Excel
// ============================================================================

export type ExportViajesParams = {
  choferId?: string;
  desde?: string;
  hasta?: string;
  facturado?: boolean;
  esVacio?: boolean;
  incompleto?: boolean;
  falta?: FaltaDato;
  search?: string;
  destino?: string;
};

export async function getAllViajesForExportAction(params?: ExportViajesParams) {
  await requireArea("viajes", "read");
  const { choferId, desde, hasta, facturado, esVacio, incompleto, falta, search, destino } =
    params ?? {};
  const supabase = createAdminClient();

  // Las dos lecturas auxiliares van una sola vez, no en cada página.
  const orFilter = search ? await buildSearchOrFilter(supabase, search) : null;

  let destinoIds: string[] | null = null;
  if (destino?.trim()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: puntos } = await (supabase as any)
      .from("puntos_ruta")
      .select("id")
      .ilike("nombre", destino.trim());
    destinoIds = ((puntos ?? []) as { id: string }[]).map((p) => p.id);
  }

  // La consulta se rearma en cada página: el paginado necesita repetir los
  // mismos filtros, y un builder de Supabase no se puede reusar entre páginas.
  const armar = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("viajes")
      .select(
        `id, codigo, fecha_viaje, km_con_carga, km_vacios, tonelaje_real, estado, facturado, monto_flete, moneda, observaciones, nro_viaje_ypf,
       clientes(razon_social),
       chofer:choferes(nombre, apellido),
       camion:camiones(patente, marca, modelo),
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`
      )
      .order("fecha_viaje", { ascending: false })
      // Desempate por código (secuencial y único): además de dejar la ida antes
      // que su vuelta vacía, le da al paginado un orden estable — sin eso las
      // páginas se pisan entre sí y el Excel sale con filas repetidas y faltantes.
      .order("codigo", { ascending: true });

    if (choferId) {
      query = query.eq("chofer_id", choferId);
    }

    if (desde) {
      query = query.gte("fecha_viaje", desde);
    }

    if (hasta) {
      query = query.lte("fecha_viaje", hasta);
    }

    // Igual que el listado: solo se excluyen los cancelados (soft-delete).
    query = query.neq("estado", "cancelado");

    if (typeof facturado === "boolean") {
      query = query.eq("facturado", facturado);
    }

    if (typeof esVacio === "boolean") {
      query = query.eq("es_vacio", esVacio);
    }

    if (incompleto) {
      query = query.or("origen_id.is.null,destino_id.is.null,chofer_id.is.null");
    }

    // Mismos criterios que el listado, para que exportar lo filtrado dé lo mismo.
    if (falta === "km") {
      query = query
        .or("km_con_carga.is.null,km_con_carga.eq.0")
        .or("km_vacios.is.null,km_vacios.eq.0");
    } else if (falta === "monto") {
      query = query.eq("es_vacio", false).or("monto_flete.is.null,monto_flete.lte.0");
    } else if (falta === "tonelaje") {
      query = query.eq("es_vacio", false).or("tonelaje_real.is.null,tonelaje_real.lte.0");
    } else if (falta === "chofer") {
      query = query.is("chofer_id", null);
    }

    if (orFilter) {
      query = query.or(orFilter);
    }

    // Exportar lo filtrado tiene que dar lo mismo que muestra la pantalla.
    if (destinoIds) {
      query = destinoIds.length
        ? query.in("destino_id", destinoIds)
        : query.eq("destino_id", "00000000-0000-0000-0000-000000000000");
    }

    return query;
  };

  // Un export que trae 1000 de 1540 es peor que uno que falla: nadie nota que
  // le faltan filas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return traerTodo<any>((from, to) => armar().range(from, to), { etiqueta: "export de viajes" });
}

// ============================================================================
// Auditoría de viajes
// ============================================================================

async function logViajeAudit(
  supabase: ReturnType<typeof createAdminClient>,
  viajeId: string,
  accion: string,
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown>,
  userId: string,
) {
  await logAudit({
    accion,
    entidadTipo: "viaje",
    entidadId: viajeId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
    client: supabase,
  });
}

export type AuditTrailEntry = {
  id: string;
  accion: string;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown>;
  created_at: string;
  usuario: { nombre: string; apellido: string } | null;
};

export async function getViajeAuditTrail(
  viajeId: string,
): Promise<{ data?: AuditTrailEntry[]; error?: string }> {
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("audit_log")
    .select(
      `
      id,
      accion,
      valores_anteriores,
      valores_nuevos,
      created_at,
      usuario:usuario_id(nombre, apellido)
    `
    )
    .eq("entidad_tipo", "viaje")
    .eq("entidad_id", viajeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching audit trail:", error);
    return { error: "No se pudo cargar el historial de auditoría." };
  }

  return { data: data ?? [] };
}

// ============================================================================
// Eliminar viaje (soft delete + auditoría)
// ============================================================================

export async function deleteViajeAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireArea("viajes", "write");

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: viajeActual, error: fetchError } = await (supabase as any)
    .from("viajes")
    .select("estado, facturado")
    .eq("id", id)
    .single();

  if (fetchError || !viajeActual) {
    return { ok: false, error: "Viaje no encontrado." };
  }

  // Un viaje facturado se puede borrar (el valor entra solo con el remito).
  // Lo único que bloquea es tener movimientos reales vinculados en Caja
  // (cobros históricos, de cuando existía el flujo de cobro).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: movsCaja } = await (supabase as any)
    .from("caja_movimientos")
    .select("id", { count: "exact", head: true })
    .eq("viaje_id", id);
  if ((movsCaja ?? 0) > 0) {
    return {
      ok: false,
      error: "El viaje tiene movimientos vinculados en Caja: eliminalos primero desde Caja.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("viajes")
    .update({ estado: "cancelado" })
    .eq("id", id);

  if (error) {
    console.error("Error al cancelar viaje:", error);
    return { ok: false, error: "No se pudo cancelar el viaje." };
  }

  await logViajeAudit(
    supabase,
    id,
    "cambio_estado",
    { estado: viajeActual.estado },
    { estado: "cancelado" },
    user.id,
  );

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  return { ok: true };
}

// ============================================================================
// Eliminar viajes en bloque (mismo soft delete + auditoría, uno por uno)
// ----------------------------------------------------------------------------
// Sirve para limpiar rápido varias filas de prueba desde el listado. Las reglas
// son las mismas que borrando de a uno: lo único que bloquea es tener
// movimientos vinculados en Caja.
// ============================================================================

export async function deleteViajesEnBloqueAction(
  ids: string[],
): Promise<{ ok: boolean; eliminados?: number; bloqueados?: number; error?: string }> {
  const user = await requireArea("viajes", "write");

  const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Selección inválida." };

  const supabase = createAdminClient();
  const unicos = [...new Set(parsed.data)];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actuales, error: fetchErr } = await (supabase as any)
    .from("viajes")
    .select("id, estado")
    .in("id", unicos);

  if (fetchErr) return { ok: false, error: "No se pudieron leer los viajes a eliminar." };

  type Prev = { id: string; estado: string };
  const byId = new Map<string, Prev>((actuales ?? []).map((v: Prev) => [v.id, v]));

  // Los que tienen movimientos en Caja se saltean (se avisa al final).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: movs } = await (supabase as any)
    .from("caja_movimientos")
    .select("viaje_id")
    .in("viaje_id", unicos);
  const conCaja = new Set<string>((movs ?? []).map((m: { viaje_id: string }) => m.viaje_id));

  let eliminados = 0;
  let bloqueados = 0;

  for (const id of unicos) {
    const prev = byId.get(id);
    if (!prev || conCaja.has(id)) {
      bloqueados++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (supabase as any)
      .from("viajes")
      .update({ estado: "cancelado" })
      .eq("id", id);

    if (updErr) {
      bloqueados++;
      continue;
    }

    await logViajeAudit(
      supabase,
      id,
      "cambio_estado",
      { estado: prev.estado },
      { estado: "cancelado" },
      user.id,
    );
    eliminados++;
  }

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  revalidatePath("/dashboard");
  return { ok: true, eliminados, bloqueados };
}

// ============================================================================
// Cerrar viaje (cargar remito + valor)
// ----------------------------------------------------------------------------
// Regla del cliente (03/07/2026): no hay flujo de cobro aparte. Entra el remito
// con su valor y el viaje queda facturado (y cobrado, como espejo) de una.
// No impacta la Caja: los fletes no generan movimientos de caja.
// ============================================================================

export async function cerrarViajeAction(
  viajeId: string,
  datos: {
    observaciones: string | null;
    // Datos de facturación que se pueden cargar al cerrar el viaje.
    nro_remito?: string | null;
    monto_flete?: number | null;
    tonelaje_real?: number | null;
  },
): Promise<{ ok: boolean; observaciones?: string | null; error?: string }> {

  const user = await requireArea("viajes", "write");

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: viaje, error: fetchError } = await (supabase as any)
    .from("viajes")
    .select("estado, monto_flete, tonelaje_real, nro_remito, es_vacio, facturado, cobrado, codigo, observaciones")
    .eq("id", viajeId)
    .single();

  if (fetchError || !viaje) return { ok: false, error: "Viaje no encontrado." };

  // Regla de cierre/facturación centralizada en flujo-logic (computeCierre).
  const { montoFinal, facturado: facturadoFinal, cobrado: cobradoFinal } = computeCierre({
    montoActual: viaje.monto_flete,
    montoIngresado: datos.monto_flete ?? null,
    esVacio: viaje.es_vacio,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {
    estado: "cerrado",
    facturado: facturadoFinal,
    cobrado: cobradoFinal, // espejo de facturado (no hay flujo de cobro)
  };
  if (datos.nro_remito !== undefined) update.nro_remito = datos.nro_remito?.trim()?.slice(0, 60) || null;
  if (datos.monto_flete != null) update.monto_flete = montoFinal;
  if (datos.tonelaje_real != null) update.tonelaje_real = Math.min(1000, Math.max(0, datos.tonelaje_real));
  // Las observaciones del diálogo se guardan en el viaje (antes solo iban al
  // audit log y el texto desaparecía de la pantalla). Se agregan al final de
  // lo que ya haya, sin pisar nada.
  const obsNueva = datos.observaciones?.trim().slice(0, 1000);
  if (obsNueva) {
    const obsActual: string | null = viaje.observaciones ?? null;
    update.observaciones = obsActual?.trim() ? `${obsActual.trim()} | ${obsNueva}` : obsNueva;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("viajes")
    .update(update)
    .eq("id", viajeId);

  if (updateError) return { ok: false, error: "No se pudo cerrar el viaje." };

  await logViajeAudit(supabase, viajeId, "cambio_estado", {
    estado: viaje.estado,
    facturado: viaje.facturado,
    cobrado: viaje.cobrado,
    nro_remito: viaje.nro_remito,
    monto_flete: viaje.monto_flete,
  }, {
    estado: "cerrado",
    facturado: facturadoFinal,
    cobrado: cobradoFinal,
    ...(datos.nro_remito !== undefined && { nro_remito: update.nro_remito }),
    ...(datos.monto_flete != null && { monto_flete: montoFinal }),
    ...(datos.observaciones && { observaciones: datos.observaciones }),
  }, user.id);

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  revalidatePath("/dashboard");
  return {
    ok: true,
    ...(update.observaciones !== undefined && { observaciones: update.observaciones as string }),
  };
}

/** Guarda las notas del viaje editadas desde el detalle expandido. Conserva los
 *  segmentos legados "Origen: ..."/"Destino: ..." que algunos viajes importados
 *  llevan en observaciones y reemplaza solo el texto libre. */
export async function updateNotasViajeAction(
  viajeId: string,
  notas: string,
): Promise<{ ok: boolean; observaciones?: string | null; error?: string }> {
  const user = await requireArea("viajes", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: viaje, error: fetchError } = await (supabase as any)
    .from("viajes")
    .select("observaciones")
    .eq("id", viajeId)
    .single();
  if (fetchError || !viaje) return { ok: false, error: "Viaje no encontrado." };

  const limpio = notas.trim().slice(0, 1000);
  const legado = ((viaje.observaciones as string | null) ?? "")
    .split("|")
    .map((p) => p.trim())
    .filter((p) => /^(Origen|Destino):/i.test(p));
  const observaciones = [...legado, ...(limpio ? [limpio] : [])].join(" | ") || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("viajes")
    .update({ observaciones })
    .eq("id", viajeId);
  if (updateError) return { ok: false, error: "No se pudieron guardar las notas." };

  await logViajeAudit(
    supabase,
    viajeId,
    "actualizar",
    { observaciones: viaje.observaciones ?? null },
    { observaciones },
    user.id,
  );

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  return { ok: true, observaciones };
}

// ============================================================================
// Facturación en bloque
// ----------------------------------------------------------------------------
// "Facturar" = carga remito + tonelaje real + monto y marca el viaje como
// facturado (y cobrado, espejo: regla del cliente 03/07/2026 — no hay flujo
// de cobro aparte). No impacta la Caja.
// ============================================================================

const facturarItemSchema = z.object({
  id: z.string().min(1),
  nro_remito: z.string().trim().max(60).optional().nullable(),
  tonelaje_real: z.number().min(0).max(1000).optional().nullable(),
  monto_flete: z.number().min(0).optional().nullable(),
});

export type FacturarBloqueItem = {
  id: string;
  nro_remito?: string | null;
  tonelaje_real?: number | null;
  monto_flete?: number | null;
};

export async function facturarViajesEnBloqueAction(
  items: FacturarBloqueItem[],
): Promise<{ ok: boolean; facturados?: number; omitidos?: number; error?: string }> {
  const user = await requireArea("viajes", "write");

  const parsed = z.array(facturarItemSchema).min(1).max(200).safeParse(items);
  if (!parsed.success) return { ok: false, error: "Datos de facturación inválidos." };

  const supabase = createAdminClient();
  const ids = parsed.data.map((i) => i.id);

  // Estado previo (para auditoría y para excluir vacíos/cancelados, que no se facturan).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actuales, error: fetchErr } = await (supabase as any)
    .from("viajes")
    .select("id, facturado, es_vacio, estado, nro_remito, tonelaje_real, monto_flete")
    .in("id", ids);

  if (fetchErr) return { ok: false, error: "No se pudieron leer los viajes a facturar." };

  type Prev = {
    id: string;
    facturado: boolean;
    es_vacio: boolean;
    estado: string;
    nro_remito: string | null;
    tonelaje_real: number | null;
    monto_flete: number | null;
  };
  const byId = new Map<string, Prev>((actuales ?? []).map((v: Prev) => [v.id, v]));

  let facturados = 0;
  let omitidos = 0;

  for (const item of parsed.data) {
    const prev = byId.get(item.id);
    if (!prev) {
      omitidos++;
      continue;
    }
    // No se facturan viajes vacíos ni cancelados.
    if (prev.es_vacio || prev.estado === "cancelado") {
      omitidos++;
      continue;
    }

    const update: Record<string, unknown> = { facturado: true, cobrado: true };
    if (item.nro_remito !== undefined) update.nro_remito = item.nro_remito?.trim() || null;
    if (item.tonelaje_real != null) update.tonelaje_real = item.tonelaje_real;
    if (item.monto_flete != null) update.monto_flete = item.monto_flete;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (supabase as any)
      .from("viajes")
      .update(update)
      .eq("id", item.id);

    if (updErr) {
      omitidos++;
      continue;
    }

    await logViajeAudit(
      supabase,
      item.id,
      "facturado",
      {
        facturado: prev.facturado,
        nro_remito: prev.nro_remito,
        tonelaje_real: prev.tonelaje_real,
        monto_flete: prev.monto_flete,
      },
      update,
      user.id,
    );
    facturados++;
  }

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  revalidatePath("/dashboard");
  return { ok: true, facturados, omitidos };
}

// ============================================================================
// Obtener viaje completo para editar
// ============================================================================

export type ViajeParaEditar = {
  id: string;
  codigo: string;
  fecha_viaje: string;
  estado: string;
  facturado: boolean;
  cliente_id: string;
  chofer_id: string;
  camion_id: string;
  tipo_carga_id: string;
  ruta_id: string | null;
  origen_id: string | null;
  origen_nombre: string | null;
  destino_id: string | null;
  destino_nombre: string | null;
  km_con_carga: number;
  km_vacios: number;
  ruta_via: RutaVia | null;
  tonelaje_real: number;
  monto_flete: number;
  tarifa_id: string | null;
  descripcion_otros: string | null;
  nro_viaje_ypf: string | null;
  material: string | null;
  /** Tramo vacío (la vuelta sin carga): define dónde van los km y que no factura. */
  es_vacio: boolean;
};

export async function getViajeParaEditarAction(
  id: string,
): Promise<ViajeParaEditar | { error: string }> {
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("viajes")
    .select(
      `id, codigo, fecha_viaje, estado, facturado,
       cliente_id, chofer_id, camion_id, tipo_carga_id, ruta_id,
       origen_id, destino_id,
       km_con_carga, km_vacios, ruta_via, tonelaje_real, monto_flete, tarifa_id, observaciones,
       nro_viaje_ypf, material, es_vacio,
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`,
    )
    .eq("id", id)
    .single();

  if (error || !data) return { error: "No se pudo cargar el viaje." };

  const obs: string = data.observaciones ?? "";
  const otrosMatch = obs.match(/Carga \(Otros\):\s*([^|]+)/);

  const origen = Array.isArray(data.origen) ? data.origen[0] : data.origen;
  const destino = Array.isArray(data.destino) ? data.destino[0] : data.destino;

  return {
    id: data.id,
    codigo: data.codigo,
    fecha_viaje: data.fecha_viaje,
    estado: data.estado,
    facturado: data.facturado,
    cliente_id: data.cliente_id,
    chofer_id: data.chofer_id,
    camion_id: data.camion_id,
    tipo_carga_id: data.tipo_carga_id,
    ruta_id: data.ruta_id ?? null,
    origen_id: data.origen_id ?? null,
    origen_nombre: origen?.nombre ?? null,
    destino_id: data.destino_id ?? null,
    destino_nombre: destino?.nombre ?? null,
    km_con_carga: data.km_con_carga ?? 0,
    km_vacios: data.km_vacios ?? 0,
    ruta_via: (data.ruta_via as RutaVia | null) ?? null,
    tonelaje_real: data.tonelaje_real ?? 0,
    monto_flete: data.monto_flete ?? 0,
    tarifa_id: data.tarifa_id ?? null,
    descripcion_otros: otrosMatch ? otrosMatch[1].trim() : null,
    nro_viaje_ypf: data.nro_viaje_ypf ?? null,
    material: data.material ?? extractMaterialFromObs(data.observaciones),
    es_vacio: !!data.es_vacio,
  };
}

// ============================================================================
// Actualizar viaje
// ============================================================================

export type UpdateViajeState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

export async function updateViajeAction(
  id: string,
  data: {
  fecha_viaje: string;
    /** Ya no se envía desde la UI (el editar no toca el estado operativo). */
    estado?: string;
    cliente_id: string;
    chofer_id: string;
    camion_id: string;
    tipo_carga_id: string;
    ruta_id?: string | null;
    descripcion_otros: string | null;
    origen_nombre: string | null;
    destino_nombre: string | null;
    km_con_carga: number;
    km_vacios: number;
    ruta_via?: RutaVia | null;
    tonelaje_real: number;
    monto_flete: number;
    tarifa_id?: string | null;
    nro_viaje_ypf: string | null;
    material: string | null;
    /** Tramo vacío. Si no viene, se conserva el que ya tenía el viaje. */
    es_vacio?: boolean;
  },
): Promise<UpdateViajeState> {

  const parsed = viajeSchema.safeParse({
    fecha_viaje: data.fecha_viaje,
    estado: data.estado,
    cliente_id: data.cliente_id,
    chofer_id: data.chofer_id,
    camion_id: data.camion_id,
    tipo_carga_id: data.tipo_carga_id,
    ruta_id: data.ruta_id ?? null,
    origen_nombre: data.origen_nombre,
    destino_nombre: data.destino_nombre,
    km_con_carga: data.km_con_carga,
    km_vacios: data.km_vacios,
    ruta_via: data.ruta_via ?? null,
    tonelaje_real: data.tonelaje_real,
    monto_flete: data.monto_flete,
    tarifa_id: data.tarifa_id ?? null,
    nro_viaje_ypf: data.nro_viaje_ypf,
    material: data.material,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const user = await requireArea("viajes", "write");

  const supabase = createAdminClient();

  // Defensa: legajo del chofer debe estar completo.
  {
    const { data: choferRow } = await supabase
      .from("choferes")
      .select("nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso")
      .eq("id", parsed.data.chofer_id)
      .single();
    if (choferRow) {
      const estadoLegajo = getLegajoEstado(choferRow);
      if (!estadoLegajo.completo) {
        return {
          error: `El chofer tiene el legajo incompleto (falta: ${estadoLegajo.faltantes.join(", ")}). Completá los datos antes de asignarlo a este viaje.`,
          fieldErrors: { chofer_id: "Legajo incompleto." },
        };
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("viajes")
    .select("fecha_viaje, estado, cliente_id, chofer_id, camion_id, tipo_carga_id, origen_id, destino_id, km_con_carga, km_vacios, ruta_via, tonelaje_real, monto_flete, es_vacio, cobrado, facturado, observaciones")
    .eq("id", id)
    .single();

  // Los viajes borrados (soft delete) no se editan: no aparecen en las vistas
  // y modificarlos generaría datos fantasma.
  if (previo?.estado === "cancelado") {
    return { error: "El viaje está eliminado y no se puede editar." };
  }

  // Pasarle el viaje a un egresado es asignarle trabajo nuevo. Corregir un viaje
  // viejo del propio egresado sí se puede: se compara contra el chofer que ya
  // tenía, así que sólo se frena el CAMBIO de chofer.
  if (parsed.data.chofer_id !== previo?.chofer_id) {
    const { data: nuevoChofer } = await supabase
      .from("choferes")
      .select("nombre, apellido, estado")
      .eq("id", parsed.data.chofer_id)
      .single();
    if (nuevoChofer?.estado === "baja") {
      return {
        error: `${nuevoChofer.apellido}, ${nuevoChofer.nombre} está egresado: no se le pueden asignar viajes.`,
        fieldErrors: { chofer_id: "Chofer egresado." },
      };
    }
  }

  let realTipoCargaId = parsed.data.tipo_carga_id;

  try {
    realTipoCargaId = await resolveTipoCargaId(supabase, realTipoCargaId);
  } catch (e) {
    console.error("Error resolviendo el tipo de carga:", e);
    return { error: "No se pudo resolver el tipo de carga seleccionado." };
  }

  // La descripción de "Otros" se decide por el tipo YA RESUELTO: al editar, el
  // diálogo manda el uuid del tipo (no el literal "otros"), así que compararlo
  // contra el string tiraba la descripción que el operador acababa de escribir.
  const notasAdicionales: string[] = [];
  if (data.descripcion_otros?.trim()) {
    const { data: tipoRow } = await supabase
      .from("tipos_carga")
      .select("nombre")
      .eq("id", realTipoCargaId)
      .single();
    if ((tipoRow?.nombre ?? "").trim().toLowerCase() === "otros") {
      notasAdicionales.push(`Carga (Otros): ${data.descripcion_otros.trim()}`);
    }
  }

  // Origen/destino viven en origen_id/destino_id (fuente de verdad), no en observaciones.
  // Si el lugar no se puede dar de alta, la edición no se guarda: mejor el error
  // que borrarle el destino al viaje sin avisar.
  let origen_id: string | null = null;
  let destino_id: string | null = null;
  try {
    if (parsed.data.origen_nombre && parsed.data.origen_nombre !== "—") {
      origen_id = await getOrCreatePuntoRuta(supabase, parsed.data.origen_nombre.trim());
    }
    if (parsed.data.destino_nombre && parsed.data.destino_nombre !== "—") {
      destino_id = await getOrCreatePuntoRuta(supabase, parsed.data.destino_nombre.trim());
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dar de alta el lugar." };
  }

  // `observaciones` es una columna compartida: ahí viven la nota libre que
  // escribe el operador en el detalle, la observación del cierre, la marca
  // "Tramo 2 de V-…" y los segmentos legados de los importados. Editar un viaje
  // sólo puede tocar SU segmento ("Carga (Otros): …"); todo lo demás se conserva.
  // Antes se reescribía la columna entera y la nota desaparecía sin aviso.
  const observacionesDB = mezclarObservaciones(
    (previo?.observaciones as string | null) ?? null,
    notasAdicionales,
  );

  // Un tramo vacío no factura (facturado = !esVacio && monto > 0). Hasta ahora
  // el editar nunca escribía esta columna: un viaje cargado por error como vacío
  // no había forma de corregirlo, y la plata que le cargaran quedaba escondida.
  const esVacio = data.es_vacio ?? !!previo?.es_vacio;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("viajes")
    .update({
      fecha_viaje: parsed.data.fecha_viaje,
      // Editar NO toca `estado`: el estado operativo se quitó de la UI y la
      // columna solo la maneja el flujo (cerrar/facturar) y el soft-delete.
      cliente_id: parsed.data.cliente_id,
      chofer_id: parsed.data.chofer_id,
      camion_id: parsed.data.camion_id,
      tipo_carga_id: realTipoCargaId,
      ruta_id: parsed.data.ruta_id ?? null,
      origen_id,
      destino_id,
      km_con_carga: parsed.data.km_con_carga,
      km_vacios: parsed.data.km_vacios,
      ruta_via: parsed.data.ruta_via ?? null,
      tonelaje_real: parsed.data.tonelaje_real,
      monto_flete: parsed.data.monto_flete,
      tarifa_id: parsed.data.tarifa_id ?? null,
      observaciones: observacionesDB,
      nro_viaje_ypf: parsed.data.nro_viaje_ypf ?? null,
      material: parsed.data.material || null,
      es_vacio: esVacio,
      // Regla unificada: facturado se deriva del monto, y cobrado es su espejo
      // (no hay flujo de cobro aparte — 03/07/2026).
      facturado: viajeEstaFacturado(parsed.data.monto_flete, esVacio),
      cobrado: viajeEstaFacturado(parsed.data.monto_flete, esVacio),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar viaje:", error);
    return { error: error.message };
  }

  await logViajeAudit(
    supabase,
    id,
    "actualizar",
    previo ?? null,
    {
      fecha_viaje: parsed.data.fecha_viaje,
      cliente_id: parsed.data.cliente_id,
      chofer_id: parsed.data.chofer_id,
      camion_id: parsed.data.camion_id,
      tipo_carga_id: realTipoCargaId,
      origen_id,
      destino_id,
      km_con_carga: parsed.data.km_con_carga,
      km_vacios: parsed.data.km_vacios,
      ruta_via: parsed.data.ruta_via ?? null,
      tonelaje_real: parsed.data.tonelaje_real,
      monto_flete: parsed.data.monto_flete,
      es_vacio: esVacio,
      observaciones: observacionesDB,
      facturado: viajeEstaFacturado(parsed.data.monto_flete, esVacio),
      cobrado: viajeEstaFacturado(parsed.data.monto_flete, esVacio),
    },
    user.id,
  );

  // Resincronizar el cobro en caja si cambió el monto del flete.
  // El cobro de un viaje crea un movimiento (categoria cobro_cliente) con
  // monto = monto_flete. Si después se corrige el monto del viaje, ese
  // movimiento quedaba con el valor viejo → desfasaje silencioso en caja.
  // Solo se resincronizan los movimientos que reflejaban el flete completo
  // (monto == monto_flete anterior), para no pisar cobros parciales/custom.
  const montoAnterior = Number(previo?.monto_flete ?? 0);
  const montoNuevo = parsed.data.monto_flete;
  if (previo && montoAnterior !== montoNuevo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: movs } = await (supabase as any)
      .from("caja_movimientos")
      .select("id, monto")
      .eq("viaje_id", id)
      .eq("categoria", "cobro_cliente");

    let resincronizados = 0;
    for (const mov of (movs ?? []) as { id: string; monto: number }[]) {
      if (Number(mov.monto) !== montoAnterior) continue; // cobro parcial/custom: no tocar
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: movErr } = await (supabase as any)
        .from("caja_movimientos")
        .update({ monto: montoNuevo })
        .eq("id", mov.id);
      if (movErr) {
        console.error("Error al resincronizar cobro en caja:", movErr);
        continue;
      }
      await logAudit({
        accion: "actualizar",
        entidadTipo: "caja",
        entidadId: mov.id,
        usuarioId: user.id,
        valoresAnteriores: { monto: mov.monto },
        valoresNuevos: { monto: montoNuevo, motivo: "Resincronización por edición del monto del viaje" },
        client: supabase,
      });
      resincronizados++;
    }
    if (resincronizados > 0) {
      revalidatePath("/caja");
      revalidatePath("/dashboard");
    }
  }

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  return { ok: true };
}

// ============================================================================
// Carga rápida — batch de viajes
// ============================================================================

export type ViajeFilaRapida = {
  fecha_viaje: string;
  /** El estado operativo se quitó de la UI; si no viene, el schema lo defaultea a 'pendiente'. */
  estado?: string;
  cliente_id: string;
  chofer_id: string;
  camion_id: string;
  tipo_carga_id: string;
  ruta_id?: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  km_con_carga: number;
  km_vacios: number;
  /** Vía del viaje (Ruta 5 directa / Ruta 22 por la base) — define los km. */
  ruta_via?: RutaVia | null;
  tonelaje_real: number;
  monto_flete: number;
  /** Tarifa que precargó el monto (snapshot). Vacío = cargado a mano. */
  tarifa_id?: string | null;
  nro_viaje_ypf: string | null;
  /** Tramo vacío (vuelta sin carga): no factura ni suma tonelaje. */
  es_vacio?: boolean;
};

export type BatchViajesResult = {
  ok?: boolean;
  creados?: number;
  errores?: { fila: number; mensaje: string }[];
  error?: string;
};

export async function createViajesBatchAction(
  filas: ViajeFilaRapida[],
): Promise<BatchViajesResult> {
  if (!filas.length) return { error: "No hay filas para importar." };

  const user = await requireArea("viajes", "write");
  const supabase = createAdminClient();

  // Validar todas las filas antes de insertar ninguna
  const erroresValidacion: { fila: number; mensaje: string }[] = [];
  const parseadas: (typeof viajeSchema._output)[] = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const parsed = viajeSchema.safeParse(fila);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      erroresValidacion.push({ fila: i + 1, mensaje: msg });
    } else {
      parseadas.push(parsed.data);
    }
  }

  if (erroresValidacion.length) {
    return {
      ok: false,
      errores: erroresValidacion,
      error: `${erroresValidacion.length} fila(s) con errores de validación.`,
    };
  }

  // Generar códigos en serie (patrón del importador de hojas de ruta)
  const year = new Date().getFullYear();
  const prefix = `V-${year}-`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastRow } = await (supabase as any)
    .from("viajes")
    .select("codigo")
    .like("codigo", `${prefix}%`)
    .order("codigo", { ascending: false })
    .limit(1);

  let seq = 0;
  if (lastRow?.length) {
    const tail = (lastRow[0].codigo as string).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) seq = n;
  }

  // Resolver los centinelas de tipo de carga ("otros" / "nuevo:<nombre>") una vez
  // por valor distinto, para no insertar duplicados durante el map paralelo.
  const sentinelTipos = [
    ...new Set(
      parseadas
        .map((p) => p.tipo_carga_id)
        .filter((t) => t === "otros" || t.startsWith(TIPO_CARGA_NUEVO_PREFIX)),
    ),
  ];
  const tipoCargaResuelto = new Map<string, string>();
  for (const sid of sentinelTipos) {
    try {
      tipoCargaResuelto.set(sid, await resolveTipoCargaId(supabase, sid));
    } catch {
      return { error: "No se pudo resolver el tipo de carga seleccionado." };
    }
  }

  // Los lugares se resuelven UNA vez por nombre distinto y en serie. Antes cada
  // fila resolvía los suyos dentro de un `Promise.all`: siete filas con el mismo
  // destino nuevo disparaban siete SELECT que no encontraban nada y después
  // siete INSERT a la vez, y el índice único de `puntos_ruta.nombre` volteaba
  // todos menos uno. El throw resultante escapaba del Promise.all, la acción se
  // caía sin respuesta y la pantalla quedaba clavada en "Guardando...".
  const nombresPuntos = [
    ...new Set(
      parseadas
        .flatMap((p) => [p.origen_nombre, p.destino_nombre])
        .map((n) => n?.trim())
        .filter((n): n is string => !!n && n !== "—"),
    ),
  ];
  const puntoPorNombre = new Map<string, string | null>();
  try {
    for (const nombre of nombresPuntos) {
      puntoPorNombre.set(nombre, await getOrCreatePuntoRuta(supabase, nombre));
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo dar de alta el lugar.",
    };
  }

  const idDelPunto = (nombre: string | null | undefined): string | null => {
    const t = nombre?.trim();
    if (!t || t === "—") return null;
    return puntoPorNombre.get(t) ?? null;
  };

  // Construir payload batch. `parseadas` está alineado por índice con `filas`
  // (si hubiera error de validación se retorna antes), así que tomamos es_vacio
  // de la fila original — viajeSchema no lo incluye.
  const payload = parseadas.map((p, idx) => {
    seq++;
    const codigo = `${prefix}${String(seq).padStart(5, "0")}`;
    const tipoCargaId = tipoCargaResuelto.get(p.tipo_carga_id) ?? p.tipo_carga_id;
    const esVacio = filas[idx]?.es_vacio ?? false;

    const origen_id = idDelPunto(p.origen_nombre);
    const destino_id = idDelPunto(p.destino_nombre);

    return {
      codigo,
      fecha_viaje: p.fecha_viaje,
      estado: p.estado,
      cliente_id: p.cliente_id,
      chofer_id: p.chofer_id,
      camion_id: p.camion_id,
      tipo_carga_id: tipoCargaId,
      ruta_id: p.ruta_id ?? null,
      origen_id,
      destino_id,
      km_con_carga: p.km_con_carga,
      km_vacios: p.km_vacios,
      ruta_via: p.ruta_via ?? null,
      tonelaje_real: esVacio ? 0 : p.tonelaje_real,
      monto_flete: esVacio ? 0 : p.monto_flete,
      tarifa_id: esVacio ? null : p.tarifa_id ?? null,
      moneda: "ARS",
      nro_viaje_ypf: p.nro_viaje_ypf ?? null,
      material: p.material || null,
      es_vacio: esVacio,
      facturado: viajeEstaFacturado(p.monto_flete, esVacio),
      cobrado: viajeEstaFacturado(p.monto_flete, esVacio),
      created_by: user.id,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: insertedRows, error: insertError } = await (supabase as any)
    .from("viajes")
    .insert(payload)
    .select("id, codigo");

  if (insertError) {
    console.error("Error en carga rápida batch:", insertError);
    return { error: insertError.message };
  }

  const creados = insertedRows?.length ?? 0;

  // Auditoría del lote
  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear_viajes_lote",
    entidadTipo: "viaje",
    entidadId: (insertedRows as { id: string }[])?.[0]?.id ?? null,
    valoresNuevos: {
      cantidad: creados,
      codigos: (insertedRows as { codigo: string }[] ?? []).map((r) => r.codigo),
    },
  });

  revalidatePath("/viajes");
  // Las pantallas de viajes abiertas se enteran solas.
  await avisarCambio("viajes");
  return { ok: true, creados };
}

// ============================================================================
// Vista mensual — viajes por chofer
// ============================================================================

export type ViajesChoferMes = {
  chofer_id: string;
  chofer: string;
  cantidad_viajes: number;
  km_totales: number;
  tonelaje_total: number;
  monto_flete_total: number;
  // tonelaje_total / cantidad_viajes (solo considerando viajes con tonelaje > 0)
  tonelaje_promedio: number;
  // Σ tonelaje / Σ capacidad_camion (en %). null si no se pudo determinar la
  // capacidad de ningún viaje (camión sin capacidad_tn cargada).
  utilizacion_pct: number | null;
};

export type ViajesMensualResult = {
  data?: ViajesChoferMes[];
  totales?: { viajes: number; km: number; tonelaje: number; flete: number };
  error?: string;
};

export async function getViajesMensualPorChoferAction(
  mes: string, // formato "YYYY-MM"
): Promise<ViajesMensualResult> {
  await requireArea("viajes", "read");

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return { error: "Formato de mes inválido. Usar YYYY-MM." };
  }

  const [year, month] = mes.split("-");
  const desde = `${year}-${month}-01`;
  // Último día del mes
  const hasta = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

  const supabase = createAdminClient();

  // Un mes puede pasar largamente las 1000 filas (abril-26: 1322), así que la
  // lectura pagina: si no, los totales del mes salen sobre una parte.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data = await traerTodo<any>(
      (from, to) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("viajes")
          .select(
            `chofer_id, km_con_carga, km_vacios, tonelaje_real, monto_flete,
       choferes(nombre, apellido),
       camiones(capacidad_tn)`,
          )
          .gte("fecha_viaje", desde)
          .lte("fecha_viaje", hasta)
          .neq("estado", "cancelado")
          .order("codigo", { ascending: true })
          .range(from, to),
      { etiqueta: `viajes de ${mes}` },
    );
  } catch (e) {
    console.error("Error getViajesMensualPorChoferAction:", e);
    return { error: "No se pudieron cargar los viajes del mes." };
  }

  // Agregar por chofer en memoria.
  //
  // Para el promedio y la utilización contamos por separado:
  //   - viajesConTn: cuántos viajes tuvieron tonelaje > 0 (los "VACIO" no
  //     deberían bajar el promedio del chofer).
  //   - capacidadAcum: Σ capacidad_camion para esos mismos viajes con tn > 0,
  //     así la utilización compara peras con peras (sólo cuando se cargó algo).
  const map = new Map<
    string,
    {
      chofer: string;
      cantidad: number;
      km: number;
      tonelaje: number;
      flete: number;
      viajesConTn: number;
      capacidadAcum: number;
    }
  >();

  for (const v of data ?? []) {
    const id: string = v.chofer_id;
    const nombreChofer = v.choferes
      ? `${v.choferes.apellido}, ${v.choferes.nombre}`
      : "—";
    const tn = Number(v.tonelaje_real) || 0;
    const cap = Number(v.camiones?.capacidad_tn) || 0;
    const existing = map.get(id);
    if (existing) {
      existing.cantidad++;
      existing.km += (v.km_con_carga ?? 0) + (v.km_vacios ?? 0);
      existing.tonelaje += tn;
      existing.flete += v.monto_flete ?? 0;
      if (tn > 0) {
        existing.viajesConTn++;
        if (cap > 0) existing.capacidadAcum += cap;
      }
    } else {
      map.set(id, {
        chofer: nombreChofer,
        cantidad: 1,
        km: (v.km_con_carga ?? 0) + (v.km_vacios ?? 0),
        tonelaje: tn,
        flete: v.monto_flete ?? 0,
        viajesConTn: tn > 0 ? 1 : 0,
        capacidadAcum: tn > 0 && cap > 0 ? cap : 0,
      });
    }
  }

  const rows: ViajesChoferMes[] = Array.from(map.entries())
    .map(([chofer_id, val]) => ({
      chofer_id,
      chofer: val.chofer,
      cantidad_viajes: val.cantidad,
      km_totales: val.km,
      tonelaje_total: val.tonelaje,
      monto_flete_total: val.flete,
      tonelaje_promedio:
        val.viajesConTn > 0 ? val.tonelaje / val.viajesConTn : 0,
      utilizacion_pct:
        val.capacidadAcum > 0 ? (val.tonelaje / val.capacidadAcum) * 100 : null,
    }))
    .sort((a, b) => a.chofer.localeCompare(b.chofer));

  const totales = rows.reduce(
    (acc, r) => {
      acc.viajes += r.cantidad_viajes;
      acc.km += r.km_totales;
      acc.tonelaje += r.tonelaje_total;
      acc.flete += r.monto_flete_total;
      return acc;
    },
    { viajes: 0, km: 0, tonelaje: 0, flete: 0 },
  );

  return { data: rows, totales };
}

// ---------------------------------------------------------------------------
// Disponibilidad: choferes ausentes en una ventana de días (default próximos 14).
//
// La protege ella misma, no la página que la llama: una server action exportada
// es un endpoint, y cualquiera con sesión puede invocarla sin pasar por /viajes.
//
// El piso es tener sesión, a propósito: quién está de vacaciones o pidió días no
// es dato reservado a personal —lo necesita cualquiera para saber con quién
// cuenta hoy— así que no se pide `choferes` ni `viajes`. Lo que sí queda
// reservado es el resto del legajo y el cronograma completo, cada uno con su
// permiso en su propia pantalla.
// ---------------------------------------------------------------------------

export type AusenciaProxima = {
  id: string;
  chofer_id: string;
  chofer_nombre: string;
  tipo: string;
  /** Vacaciones o no, según cómo se cargó — no según cómo esté escrito el tipo. */
  es_vacaciones: boolean;
  /** La carga avisó que las fechas son estimadas (todavía no está confirmado). */
  fecha_aproximada: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  autorizado_por_nombre: string | null;
  // true si la ausencia ya está en curso a la fecha de hoy.
  en_curso: boolean;
  /** Días que faltan para que arranque. 0 si ya está en curso. */
  dias_hasta_inicio: number;
  /** Primer día que vuelve a estar disponible (el siguiente a fecha_fin). */
  fecha_regreso: string;
};

export async function getAusenciasProximasAction(dias = 14): Promise<AusenciaProxima[]> {
  await requireUser();
  const supabase = createAdminClient();

  // Hoy en Argentina, no en UTC: el server corre en UTC y a partir de las 21:00
  // "hoy" pasaba a ser el día siguiente — el que estaba de vacaciones hasta hoy
  // figuraba de vuelta media jornada antes.
  const hoyStr = hoyArgentina();
  const hastaStr = sumarDiasISO(hoyStr, dias);

  type Chofer = { nombre: string; apellido: string; estado: string | null; es_demo: boolean | null };
  type Row = {
    id: string;
    chofer_id: string;
    tipo: string;
    es_vacaciones: boolean | null;
    fecha_aproximada: boolean | null;
    fecha_inicio: string;
    fecha_fin: string;
    choferes: Chofer | Chofer[] | null;
    autorizado: { nombre: string; apellido: string | null } | { nombre: string; apellido: string | null }[] | null;
  };

  // Ausencias autorizadas que solapan [hoy, hoy+dias]: ya en curso o por arrancar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (supabase as any)
    .from("chofer_ausencias")
    .select(
      "id, chofer_id, tipo, es_vacaciones, fecha_aproximada, fecha_inicio, fecha_fin, choferes(nombre, apellido, estado, es_demo), autorizado:usuarios!autorizado_por(nombre, apellido)",
    )
    .eq("estado", "autorizada")
    .is("deleted_at", null)
    .lte("fecha_inicio", hastaStr)
    .gte("fecha_fin", hoyStr)
    .order("fecha_inicio", { ascending: true });

  const rows = (res.data ?? []) as Row[];

  // Días entre dos fechas ISO, en días de calendario (sin hora: las fechas de
  // ausencia son `date`, no timestamp).
  const diasEntre = (desdeISO: string, hastaISO: string) =>
    Math.round((Date.parse(`${hastaISO}T00:00:00Z`) - Date.parse(`${desdeISO}T00:00:00Z`)) / 86_400_000);
  const diaSiguiente = (iso: string) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  const mapeadas = rows
    // Un egresado no es "un chofer que hoy no está": ya no está en la nómina, y
    // sus vacaciones viejas seguían apareciendo como si hubiera que reemplazarlo.
    // Los legajos de demo tampoco cuentan para la disponibilidad real.
    .filter((r) => {
      const c = Array.isArray(r.choferes) ? r.choferes[0] : r.choferes;
      return c != null && c.estado !== "baja" && c.es_demo !== true;
    })
    .map((r) => {
      const chofer = Array.isArray(r.choferes) ? r.choferes[0] : r.choferes;
      const aut = Array.isArray(r.autorizado) ? r.autorizado[0] : r.autorizado;
      const enCurso = r.fecha_inicio <= hoyStr && r.fecha_fin >= hoyStr;
      return {
        id: r.id,
        chofer_id: r.chofer_id,
        chofer_nombre: chofer ? `${chofer.apellido}, ${chofer.nombre}` : "—",
        tipo: r.tipo,
        es_vacaciones: r.es_vacaciones === true,
        fecha_aproximada: r.fecha_aproximada === true,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        autorizado_por_nombre: aut ? `${aut.nombre}${aut.apellido ? " " + aut.apellido : ""}` : null,
        en_curso: enCurso,
        dias_hasta_inicio: enCurso ? 0 : Math.max(0, diasEntre(hoyStr, r.fecha_inicio)),
        fecha_regreso: diaSiguiente(r.fecha_fin),
      };
    });

  // Primero los que hoy no están, después los que se van, por fecha de salida.
  return mapeadas.sort((a, b) =>
    a.en_curso === b.en_curso
      ? a.fecha_inicio.localeCompare(b.fecha_inicio)
      : a.en_curso ? -1 : 1,
  );
}

/* ------------------------------------------------------------------ *
 * Reasignar viajes a otro cliente
 * ------------------------------------------------------------------ */

/**
 * Mueve viajes de un cliente a otro.
 *
 * Existe por los 1.315 viajes colgados de "Sin asignar (import)": mientras
 * estén ahí, cualquier número por cliente es mentira. Hasta ahora la única
 * forma de sacarlos era uno por uno.
 *
 * Dos alcances a propósito:
 *  · `ids` — lo que está tildado en la tabla. Sirve para un puñado.
 *  · `clienteOrigenId` — TODOS los de ese cliente, estén o no en la página
 *    visible. Es el único que sirve para 1.315: seleccionarlos a mano es
 *    imposible con la tabla paginada.
 *
 * `simular` no toca nada y devuelve cuántos se moverían. La pantalla lo llama
 * SIEMPRE antes de confirmar, así el número que se lee en el botón es el mismo
 * que se va a ejecutar y no una estimación.
 */
export async function reasignarClienteViajesAction(input: {
  clienteDestinoId: string;
  ids?: string[];
  clienteOrigenId?: string;
  simular?: boolean;
}): Promise<{ ok: true; movidos: number; simulado: boolean } | { error: string }> {
  const user = await requireArea("viajes", "write");

  const destino = z.string().uuid().safeParse(input.clienteDestinoId);
  if (!destino.success) return { error: "Elegí el cliente al que van los viajes." };

  const porIds = Array.isArray(input.ids) && input.ids.length > 0;
  const porCliente = typeof input.clienteOrigenId === "string" && input.clienteOrigenId.length > 0;
  if (!porIds && !porCliente) return { error: "No hay viajes para reasignar." };
  if (porCliente && input.clienteOrigenId === input.clienteDestinoId) {
    return { error: "El cliente de origen y el de destino son el mismo." };
  }

  const supabase = createAdminClient();

  // Se listan primero para poder contar exacto y auditar qué se movió. Sin
  // esto, un update masivo devuelve un número que nadie puede verificar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from("viajes").select("id").neq("cliente_id", destino.data);
  if (porIds) {
    const ids = z.array(z.string().uuid()).min(1).safeParse([...new Set(input.ids!)]);
    if (!ids.success) return { error: "Selección inválida." };
    q = q.in("id", ids.data);
  } else {
    const origen = z.string().uuid().safeParse(input.clienteOrigenId);
    if (!origen.success) return { error: "Cliente de origen inválido." };
    q = q.eq("cliente_id", origen.data);
  }

  const { data: aMover, error: leerErr } = await q;
  if (leerErr) return { error: "No se pudieron leer los viajes a reasignar." };

  const idsAMover: string[] = (aMover ?? []).map((v: { id: string }) => v.id);
  if (idsAMover.length === 0) return { ok: true, movidos: 0, simulado: !!input.simular };
  if (input.simular) return { ok: true, movidos: idsAMover.length, simulado: true };

  // De a 500: un `in` con 1.315 uuid arma una URL que el proxy corta.
  let movidos = 0;
  for (let i = 0; i < idsAMover.length; i += 500) {
    const lote = idsAMover.slice(i, i + 500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("viajes")
      .update({ cliente_id: destino.data })
      .in("id", lote);
    if (error) {
      console.error("Error al reasignar viajes:", error);
      return {
        error:
          movidos > 0
            ? `Se reasignaron ${movidos} viajes y después falló. Volvé a intentar: los ya movidos no se repiten.`
            : "No se pudieron reasignar los viajes.",
      };
    }
    movidos += lote.length;
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "viajes",
    entidadId: destino.data,
    valoresAnteriores: { cliente_id: input.clienteOrigenId ?? null, viajes: idsAMover.length },
    valoresNuevos: { cliente_id: destino.data, viajes: movidos },
    metadata: { origen: "reasignacion_masiva", alcance: porIds ? "seleccion" : "cliente_completo" },
  });

  revalidatePath("/viajes");
  revalidatePath("/clientes");
  return { ok: true, movidos, simulado: false };
}

/**
 * Los clientes con cuántos viajes tiene cada uno.
 *
 * El conteo no es decorativo: es lo que hace evidente el problema al abrir el
 * diálogo. "Sin asignar (import) — 1.315 viajes" al lado de clientes con 20
 * dice solo dónde está la pila que hay que repartir.
 */
export async function getClientesConViajesAction(): Promise<
  { id: string; razon_social: string; viajes: number }[]
> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();

  const [{ data: clientes }, viajes] = await Promise.all([
    supabase.from("clientes").select("id, razon_social").order("razon_social"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traerTodo<any>(
      (from, to) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("viajes").select("cliente_id").order("id").range(from, to),
      { etiqueta: "viajes por cliente" },
    ),
  ]);

  const conteo = new Map<string, number>();
  for (const v of (viajes ?? []) as { cliente_id: string | null }[]) {
    if (!v.cliente_id) continue;
    conteo.set(v.cliente_id, (conteo.get(v.cliente_id) ?? 0) + 1);
  }

  return ((clientes ?? []) as { id: string; razon_social: string }[]).map((c) => ({
    id: c.id,
    razon_social: c.razon_social,
    viajes: conteo.get(c.id) ?? 0,
  }));
}
