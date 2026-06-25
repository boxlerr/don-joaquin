"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { ViajeBasico, PaginatedResult } from "./types";
import { computeCierre } from "./flujo-logic";
import { requireArea } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";

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

async function buildSearchOrFilter(
  supabase: ReturnType<typeof createAdminClient>,
  search: string,
): Promise<string> {
  // Las comas y paréntesis rompen el parser de filtros `.or()` de PostgREST.
  const sanitized = search.replace(/[(),]/g, " ").trim();
  const term = `%${sanitized}%`;
  const [choferes, camiones, clientes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("choferes")
      .select("id")
      .or(`nombre.ilike.${term},apellido.ilike.${term}`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("camiones")
      .select("id")
      .or(`patente.ilike.${term},marca.ilike.${term},modelo.ilike.${term}`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("clientes")
      .select("id")
      .ilike("razon_social", term),
  ]);

  const parts: string[] = [`codigo.ilike.${term}`, `nro_viaje_ypf.ilike.${term}`];

  const choferIds: string[] = (choferes.data ?? []).map((r: { id: string }) => r.id);
  if (choferIds.length) parts.push(`chofer_id.in.(${choferIds.join(",")})`);

  const camionIds: string[] = (camiones.data ?? []).map((r: { id: string }) => r.id);
  if (camionIds.length) parts.push(`camion_id.in.(${camionIds.join(",")})`);

  const clienteIds: string[] = (clientes.data ?? []).map((r: { id: string }) => r.id);
  if (clienteIds.length) parts.push(`cliente_id.in.(${clienteIds.join(",")})`);

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
  estado?: string[];
  facturado?: boolean;
  /** Filtra por estado de cobro: "pendiente" (facturado sin cobrar) o "cobrado". */
  cobroEstado?: "pendiente" | "cobrado";
  esVacio?: boolean;
  search?: string;
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
    estado,
    facturado,
    cobroEstado,
    esVacio,
    search,
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
      `id, fecha_viaje, km_con_carga, km_vacios, tonelaje_real, estado, facturado, cobrado, fecha_cobro, es_vacio, codigo, observaciones, material, monto_flete, moneda, nro_viaje_ypf, nro_remito,
       clientes(razon_social),
       choferes(nombre, apellido),
       camiones(patente, marca, modelo),
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`,
      { count: "exact" }
    )
    .order(orderColumn, { ascending: orderDir === "asc" })
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

  if (estado && estado.length > 0) {
    query = query.in("estado", estado);
  } else {
    query = query.neq("estado", "cancelado");
  }

  if (typeof facturado === "boolean") {
    query = query.eq("facturado", facturado);
  }

  if (cobroEstado === "pendiente") {
    query = query.eq("facturado", true).eq("cobrado", false);
  } else if (cobroEstado === "cobrado") {
    query = query.eq("cobrado", true);
  }

  if (typeof esVacio === "boolean") {
    query = query.eq("es_vacio", esVacio);
  }

  if (search) {
    const orFilter = await buildSearchOrFilter(supabase, search);
    query = query.or(orFilter);
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

  const [
    clientesRes,
    choferesRes,
    camionesRes,
    tiposCargaRes,
    puntosRes,
    circuitosRes,
    asignacionesHoyRes,
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
        .order("codigo_interno", { ascending: true }),
      // Planilla diaria de HOY: antes era una consulta serial después del batch;
      // ahora va en paralelo con el resto. Su error se ignora igual que antes
      // (si falla, se usa el camión habitual del chofer como fallback).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("asignacion_diaria")
        .select("chofer_id, camion_id")
        .eq("fecha", hoy),
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

  for (const a of (asignacionesHoyRes.data ?? []) as { chofer_id: string; camion_id: string }[]) {
    camionPorChofer.set(a.chofer_id, a.camion_id);
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
// Crear viaje
// ============================================================================

const VIAJE_ESTADO_VALUES = ["pendiente", "en_curso", "cerrado"] as const;

const viajeSchema = z
  .object({
    fecha_viaje: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
    estado: z.enum(VIAJE_ESTADO_VALUES),
    cliente_id: z.string().uuid("Cliente inválido."),
    chofer_id: z.string().uuid("Chofer inválido."),
    camion_id: z.string().uuid("Camión inválido."),
    tipo_carga_id: z.string().min(1, "Tipo de carga requerido."),
    ruta_id: z.string().uuid("Circuito inválido.").optional().nullable(),
    origen_nombre: z.string().optional().nullable(),
    destino_nombre: z.string().optional().nullable(),
    km_con_carga: z.number().int().min(0, "Debe ser ≥ 0."),
    km_vacios: z.number().int().min(0, "Debe ser ≥ 0."),
    tonelaje_real: z.number().min(0, "Debe ser ≥ 0."),
    monto_flete: z.number().min(0, "Debe ser ≥ 0."),
    nro_viaje_ypf: z.string().max(60, "Máximo 60 caracteres.").optional().nullable(),
    material: z.string().trim().max(120, "Máximo 120 caracteres.").optional().nullable(),
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

async function generarCodigoViaje(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
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

  return `${prefix}${String(next).padStart(5, "0")}`;
}

async function getOrCreatePuntoRuta(
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string
): Promise<string | null> {
  const trimmed = nombre.trim();
  if (!trimmed) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("puntos_ruta")
    .select("id")
    .ilike("nombre", trimmed)
    .limit(1);

  if (!error && data && data.length > 0) {
    return data[0].id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertRes = await (supabase as any)
    .from("puntos_ruta")
    .insert({
      nombre: trimmed,
      estado: "activo",
      es_frontera: false,
      es_puerto: false,
    })
    .select("id")
    .single();

  if (insertRes.error) return null;
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
    tonelaje_real: parseNumber(formData.get("tonelaje_real")),
    monto_flete: parseNumber(formData.get("monto_flete")),
    nro_viaje_ypf: emptyOrNull(formData.get("nro_viaje_ypf")),
    material: emptyOrNull(formData.get("material")),
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

  let codigo: string;
  try {
    codigo = await generarCodigoViaje(supabase);
  } catch (e) {
    console.error("Error generando código de viaje", e);
    return { error: "No se pudo generar el código del viaje." };
  }

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
  let origen_id: string | null = null;
  if (parsed.data.origen_nombre && parsed.data.origen_nombre !== "—") {
    origen_id = await getOrCreatePuntoRuta(supabase, parsed.data.origen_nombre.trim());
  }

  let destino_id: string | null = null;
  if (parsed.data.destino_nombre && parsed.data.destino_nombre !== "—") {
    destino_id = await getOrCreatePuntoRuta(supabase, parsed.data.destino_nombre.trim());
  }

  // Defensa: aunque la UI bloquea las opciones incompletas, validar acá por
  // si alguien envía el id directo.
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
          ok: false,
          error: `El chofer tiene el legajo incompleto (falta: ${estadoLegajo.faltantes.join(", ")}). Completá los datos en el legajo antes de asignarlo a un viaje.`,
          fieldErrors: { chofer_id: "Legajo incompleto." },
        };
      }
    }
  }

  const observacionesDB = notasAdicionales.length > 0 ? notasAdicionales.join(" | ") : null;

  const viajeData = {
    codigo,
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
    tonelaje_real: parsed.data.tonelaje_real,
    monto_flete: parsed.data.monto_flete,
    moneda: "ARS",
    observaciones: observacionesDB,
    nro_viaje_ypf: parsed.data.nro_viaje_ypf ?? null,
    material: parsed.data.material || null,
    // Regla unificada: con monto de flete > 0 el viaje queda facturado (igual
    // que importadores/hoja de ruta/cierre). Sin monto queda sin facturar.
    facturado: viajeEstaFacturado(parsed.data.monto_flete),
    created_by: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("viajes")
    .insert(viajeData)
    .select("id")
    .single();

  if (error) {
    console.error("Error al crear viaje:", error);
    return { error: error.message };
  }

  await logViajeAudit(supabase, inserted.id, "crear", null, viajeData, user.id);

  revalidatePath("/viajes");
  return { ok: true };
}

// ============================================================================
// Obtener todos los viajes para exportación a Excel
// ============================================================================

export type ExportViajesParams = {
  choferId?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  facturado?: boolean;
  esVacio?: boolean;
  search?: string;
};

export async function getAllViajesForExportAction(params?: ExportViajesParams) {
  await requireArea("viajes", "read");
  const { choferId, desde, hasta, estado, facturado, esVacio, search } = params ?? {};
  const supabase = createAdminClient();
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
    .order("fecha_viaje", { ascending: false });

  if (choferId) {
    query = query.eq("chofer_id", choferId);
  }

  if (desde) {
    query = query.gte("fecha_viaje", desde);
  }

  if (hasta) {
    query = query.lte("fecha_viaje", hasta);
  }

  if (estado) {
    query = query.in("estado", [estado]);
  } else {
    query = query.neq("estado", "cancelado");
  }

  if (typeof facturado === "boolean") {
    query = query.eq("facturado", facturado);
  }

  if (typeof esVacio === "boolean") {
    query = query.eq("es_vacio", esVacio);
  }

  if (search) {
    const orFilter = await buildSearchOrFilter(supabase, search);
    query = query.or(orFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener viajes para exportación:", error);
    throw new Error("No se pudieron cargar los datos para exportar.");
  }

  return data ?? [];
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

  if (viajeActual.facturado) {
    return {
      ok: false,
      error: "El viaje está facturado: revertí el cobro en Caja antes de cancelarlo.",
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
  return { ok: true };
}

// ============================================================================
// Actualizar estado de viaje + auditoría
// ============================================================================

const ESTADOS_VALIDOS = ["pendiente", "en_curso", "cerrado", "cancelado"] as const;

export async function updateViajeEstadoAction(
  id: string,
  estado: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
    return { ok: false, error: "Estado inválido." };
  }

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

  if (viajeActual.facturado) {
    return {
      ok: false,
      error: "El viaje está facturado: revertí el cobro en Caja antes de cambiar su estado.",
    };
  }

  if (viajeActual.estado === "cancelado") {
    return { ok: false, error: "El viaje está cancelado y no puede cambiar de estado." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("viajes")
    .update({ estado })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar estado del viaje:", error);
    return { ok: false, error: "No se pudo actualizar el estado." };
  }

  await logViajeAudit(
    supabase,
    id,
    "cambio_estado",
    { estado: viajeActual.estado },
    { estado },
    user.id,
  );

  revalidatePath("/viajes");
  revalidatePath("/caja");
  return { ok: true };
}

// ============================================================================
// Cerrar viaje con opción de registrar cobro
// ============================================================================

export async function cerrarViajeAction(
  viajeId: string,
  datos: {
    cobrado: boolean;
    fecha: string;
    medio: "efectivo" | "transferencia" | "cheque" | "otro";
    observaciones: string | null;
    // Datos de facturación que se pueden cargar al cerrar el viaje.
    nro_remito?: string | null;
    monto_flete?: number | null;
    tonelaje_real?: number | null;
  },
): Promise<{ ok: boolean; error?: string }> {

  const user = await requireArea("viajes", "write");

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: viaje, error: fetchError } = await (supabase as any)
    .from("viajes")
    .select("estado, monto_flete, tonelaje_real, nro_remito, es_vacio, facturado, cobrado, fecha_cobro, codigo, cliente_id, clientes(razon_social)")
    .eq("id", viajeId)
    .single();

  if (fetchError || !viaje) return { ok: false, error: "Viaje no encontrado." };

  // Regla de cierre/facturación/cobro centralizada en flujo-logic (computeCierre).
  const { montoFinal, facturado: facturadoFinal, cobrado: cobradoFinal } = computeCierre({
    montoActual: viaje.monto_flete,
    montoIngresado: datos.monto_flete ?? null,
    esVacio: viaje.es_vacio,
    cobrado: datos.cobrado,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { estado: "cerrado", facturado: facturadoFinal };
  if (datos.nro_remito !== undefined) update.nro_remito = datos.nro_remito?.trim()?.slice(0, 60) || null;
  if (datos.monto_flete != null) update.monto_flete = montoFinal;
  if (datos.tonelaje_real != null) update.tonelaje_real = Math.min(1000, Math.max(0, datos.tonelaje_real));
  if (cobradoFinal) {
    // Marcar cobrado evita que el viaje vuelva a aparecer como "pendiente de cobro"
    // y que el flujo de cobro en bloque genere un segundo ingreso por el mismo flete.
    update.cobrado = true;
    update.fecha_cobro = datos.fecha;
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
    ...(cobradoFinal && { medio_cobro: datos.medio }),
    ...(datos.observaciones && { observaciones: datos.observaciones }),
  }, user.id);

  if (cobradoFinal) {
    const { count } = await supabase
      .from("caja_movimientos")
      .select("id", { count: "exact", head: true })
      .eq("viaje_id", viajeId);

    if (count === 0) {
      const clienteNombre = viaje.clientes?.razon_social ?? "Cliente";
      await supabase.from("caja_movimientos").insert({
        tipo: "ingreso",
        categoria: "cobro_cliente",
        concepto: `Flete ${viaje.codigo} - ${clienteNombre}`,
        monto: montoFinal,
        medio: datos.medio,
        fecha: datos.fecha,
        moneda: "ARS",
        viaje_id: viajeId,
        cliente_id: viaje.cliente_id ?? null,
        observaciones: datos.observaciones,
        created_by: user.id,
      });
    }
  }

  revalidatePath("/viajes");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ============================================================================
// Facturación en bloque
// ----------------------------------------------------------------------------
// "Facturar" = factura emitida: carga remito + tonelaje real + monto y marca
// el viaje como facturado. NO impacta caja (el cobro se registra aparte), para
// no generar ingresos fantasma al facturar muchos viajes de una. Decisión de
// negocio confirmada: facturar ≠ cobrar.
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

    const update: Record<string, unknown> = { facturado: true };
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
  revalidatePath("/dashboard");
  return { ok: true, facturados, omitidos };
}

// ============================================================================
// Cobrar viajes (en bloque) — vuelca el flete a la Caja
// ----------------------------------------------------------------------------
// A diferencia de facturar (que sólo marca facturado=true), cobrar SÍ genera el
// ingreso en caja_movimientos vinculado por viaje_id y marca el viaje como
// cobrado. Es el puente Caja ↔ Viajes: hasta acá la caja mostraba $0 porque
// nadie volcaba los fletes facturados.
//
// Sólo se pueden cobrar viajes facturados y todavía no cobrados.
// ============================================================================

const cobrarItemSchema = z.object({
  id: z.string().min(1),
  monto: z.number().min(0).optional().nullable(),
});

export type CobrarBloqueItem = {
  id: string;
  /** Override del monto a cobrar. Si no viene, se usa monto_flete del viaje. */
  monto?: number | null;
};

export async function cobrarViajesEnBloqueAction(
  items: CobrarBloqueItem[],
  opts: { fecha_cobro: string; medio: "efectivo" | "transferencia" | "cheque" | "otro" },
): Promise<{ ok: boolean; cobrados?: number; omitidos?: number; error?: string }> {
  const user = await requireArea("caja", "write");

  const parsed = z.array(cobrarItemSchema).min(1).max(200).safeParse(items);
  if (!parsed.success) return { ok: false, error: "Datos de cobro inválidos." };

  const fechaParsed = z
    .object({
      fecha_cobro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      medio: z.enum(["efectivo", "transferencia", "cheque", "otro"]),
    })
    .safeParse(opts);
  if (!fechaParsed.success) return { ok: false, error: "Fecha o medio de cobro inválidos." };
  const { fecha_cobro, medio } = fechaParsed.data;

  const supabase = createAdminClient();
  const ids = parsed.data.map((i) => i.id);

  // Estado previo: sólo se cobra lo facturado y no cobrado. Traemos el flete y
  // el cliente para armar el ingreso de caja.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actuales, error: fetchErr } = await (supabase as any)
    .from("viajes")
    .select("id, codigo, facturado, cobrado, es_vacio, estado, monto_flete, cliente_id, clientes(razon_social)")
    .in("id", ids);

  if (fetchErr) return { ok: false, error: "No se pudieron leer los viajes a cobrar." };

  type Prev = {
    id: string;
    codigo: string;
    facturado: boolean;
    cobrado: boolean;
    es_vacio: boolean;
    estado: string;
    monto_flete: number | null;
    cliente_id: string;
    clientes: { razon_social: string } | { razon_social: string }[] | null;
  };
  const byId = new Map<string, Prev>((actuales ?? []).map((v: Prev) => [v.id, v]));

  let cobrados = 0;
  let omitidos = 0;

  for (const item of parsed.data) {
    const prev = byId.get(item.id);
    if (!prev) {
      omitidos++;
      continue;
    }
    // Sólo facturados, no cobrados, no vacíos, no cancelados.
    if (!prev.facturado || prev.cobrado || prev.es_vacio || prev.estado === "cancelado") {
      omitidos++;
      continue;
    }

    const monto = item.monto != null ? item.monto : Number(prev.monto_flete ?? 0);
    if (!(monto > 0)) {
      omitidos++;
      continue;
    }

    const cliente = Array.isArray(prev.clientes) ? prev.clientes[0] : prev.clientes;
    const concepto = `Cobro flete ${prev.codigo}${cliente?.razon_social ? ` — ${cliente.razon_social}` : ""}`;

    // 1) Crear el ingreso en la caja, vinculado al viaje.
    const movInsert = {
      tipo: "ingreso" as const,
      categoria: "cobro_cliente" as const,
      concepto,
      monto,
      medio,
      moneda: "ARS",
      fecha: fecha_cobro,
      viaje_id: prev.id,
      cliente_id: prev.cliente_id ?? null,
      created_by: user.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mov, error: movErr } = await (supabase as any)
      .from("caja_movimientos")
      .insert(movInsert)
      .select("id")
      .single();

    if (movErr || !mov?.id) {
      omitidos++;
      continue;
    }

    // 2) Marcar el viaje como cobrado.
    const update = { cobrado: true, fecha_cobro };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (supabase as any)
      .from("viajes")
      .update(update)
      .eq("id", prev.id);

    if (updErr) {
      // Revertir el ingreso para no dejar caja inconsistente.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("caja_movimientos").delete().eq("id", mov.id);
      omitidos++;
      continue;
    }

    // Auditoría del viaje y del movimiento de caja.
    await logViajeAudit(
      supabase,
      prev.id,
      "cobrado",
      { cobrado: prev.cobrado, fecha_cobro: null },
      update,
      user.id,
    );
    await logAudit({
      accion: "crear",
      entidadTipo: "caja",
      entidadId: mov.id,
      usuarioId: user.id,
      valoresAnteriores: null,
      valoresNuevos: movInsert,
      client: supabase,
    });

    cobrados++;
  }

  revalidatePath("/viajes");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true, cobrados, omitidos };
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
  tonelaje_real: number;
  monto_flete: number;
  descripcion_otros: string | null;
  nro_viaje_ypf: string | null;
  material: string | null;
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
       km_con_carga, km_vacios, tonelaje_real, monto_flete, observaciones,
       nro_viaje_ypf, material,
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
    tonelaje_real: data.tonelaje_real ?? 0,
    monto_flete: data.monto_flete ?? 0,
    descripcion_otros: otrosMatch ? otrosMatch[1].trim() : null,
    nro_viaje_ypf: data.nro_viaje_ypf ?? null,
    material: data.material ?? extractMaterialFromObs(data.observaciones),
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
    estado: string;
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
    tonelaje_real: number;
    monto_flete: number;
    nro_viaje_ypf: string | null;
    material: string | null;
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
    tonelaje_real: data.tonelaje_real,
    monto_flete: data.monto_flete,
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
    .select("fecha_viaje, estado, cliente_id, chofer_id, camion_id, tipo_carga_id, origen_id, destino_id, km_con_carga, km_vacios, tonelaje_real, monto_flete, es_vacio, cobrado, facturado")
    .eq("id", id)
    .single();

  let realTipoCargaId = parsed.data.tipo_carga_id;
  const notasAdicionales: string[] = [];

  if (realTipoCargaId === "otros" && data.descripcion_otros) {
    notasAdicionales.push(`Carga (Otros): ${data.descripcion_otros}`);
  }

  try {
    realTipoCargaId = await resolveTipoCargaId(supabase, realTipoCargaId);
  } catch (e) {
    console.error("Error resolviendo el tipo de carga:", e);
    return { error: "No se pudo resolver el tipo de carga seleccionado." };
  }

  // Origen/destino viven en origen_id/destino_id (fuente de verdad), no en observaciones.
  let origen_id: string | null = null;
  if (parsed.data.origen_nombre && parsed.data.origen_nombre !== "—") {
    origen_id = await getOrCreatePuntoRuta(supabase, parsed.data.origen_nombre.trim());
  }

  let destino_id: string | null = null;
  if (parsed.data.destino_nombre && parsed.data.destino_nombre !== "—") {
    destino_id = await getOrCreatePuntoRuta(supabase, parsed.data.destino_nombre.trim());
  }

  const observacionesDB =
    notasAdicionales.length > 0 ? notasAdicionales.join(" | ") : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("viajes")
    .update({
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
      tonelaje_real: parsed.data.tonelaje_real,
      monto_flete: parsed.data.monto_flete,
      observaciones: observacionesDB,
      nro_viaje_ypf: parsed.data.nro_viaje_ypf ?? null,
      material: parsed.data.material || null,
      // Regla unificada: facturado se deriva del monto. Si el viaje ya está
      // cobrado se mantiene facturado (no se permite el estado inválido
      // "cobrado pero no facturado").
      facturado:
        viajeEstaFacturado(parsed.data.monto_flete, !!previo?.es_vacio) || !!previo?.cobrado,
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
      estado: parsed.data.estado,
      cliente_id: parsed.data.cliente_id,
      chofer_id: parsed.data.chofer_id,
      camion_id: parsed.data.camion_id,
      tipo_carga_id: realTipoCargaId,
      origen_id,
      destino_id,
      km_con_carga: parsed.data.km_con_carga,
      km_vacios: parsed.data.km_vacios,
      tonelaje_real: parsed.data.tonelaje_real,
      monto_flete: parsed.data.monto_flete,
      facturado:
        viajeEstaFacturado(parsed.data.monto_flete, !!previo?.es_vacio) || !!previo?.cobrado,
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
  return { ok: true };
}

// ============================================================================
// Carga rápida — batch de viajes
// ============================================================================

export type ViajeFilaRapida = {
  fecha_viaje: string;
  estado: string;
  cliente_id: string;
  chofer_id: string;
  camion_id: string;
  tipo_carga_id: string;
  ruta_id?: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  km_con_carga: number;
  km_vacios: number;
  tonelaje_real: number;
  monto_flete: number;
  nro_viaje_ypf: string | null;
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

  // Construir payload batch
  const payload = await Promise.all(
    parseadas.map(async (p) => {
      seq++;
      const codigo = `${prefix}${String(seq).padStart(5, "0")}`;
      const tipoCargaId = tipoCargaResuelto.get(p.tipo_carga_id) ?? p.tipo_carga_id;

      const origen_id = p.origen_nombre ? await getOrCreatePuntoRuta(supabase, p.origen_nombre) : null;
      const destino_id = p.destino_nombre ? await getOrCreatePuntoRuta(supabase, p.destino_nombre) : null;

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
        tonelaje_real: p.tonelaje_real,
        monto_flete: p.monto_flete,
        moneda: "ARS",
        nro_viaje_ypf: p.nro_viaje_ypf ?? null,
        material: p.material || null,
        facturado: viajeEstaFacturado(p.monto_flete),
        created_by: user.id,
      };
    }),
  );

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("viajes")
    .select(
      `chofer_id, km_con_carga, km_vacios, tonelaje_real, monto_flete,
       choferes(nombre, apellido),
       camiones(capacidad_tn)`,
    )
    .gte("fecha_viaje", desde)
    .lte("fecha_viaje", hasta)
    .neq("estado", "cancelado");

  if (error) {
    console.error("Error getViajesMensualPorChoferAction:", error);
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
// Read protegida por la página padre (requireArea("viajes", "read")).
// ---------------------------------------------------------------------------

export type AusenciaProxima = {
  id: string;
  chofer_id: string;
  chofer_nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  autorizado_por_nombre: string | null;
  // true si la ausencia ya está en curso a la fecha de hoy.
  en_curso: boolean;
};

export async function getAusenciasProximasAction(dias = 14): Promise<AusenciaProxima[]> {
  const supabase = createAdminClient();

  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0]!;
  const hasta = new Date(hoy);
  hasta.setDate(hoy.getDate() + dias);
  const hastaStr = hasta.toISOString().split("T")[0]!;

  type Row = {
    id: string;
    chofer_id: string;
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    choferes: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
    autorizado: { nombre: string; apellido: string | null } | { nombre: string; apellido: string | null }[] | null;
  };

  // Ausencias autorizadas que solapan [hoy, hoy+dias]: ya en curso o por arrancar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (supabase as any)
    .from("chofer_ausencias")
    .select(
      "id, chofer_id, tipo, fecha_inicio, fecha_fin, choferes(nombre, apellido), autorizado:usuarios!autorizado_por(nombre, apellido)",
    )
    .eq("estado", "autorizada")
    .is("deleted_at", null)
    .lte("fecha_inicio", hastaStr)
    .gte("fecha_fin", hoyStr)
    .order("fecha_inicio", { ascending: true });

  const rows = (res.data ?? []) as Row[];

  return rows.map((r) => {
    const chofer = Array.isArray(r.choferes) ? r.choferes[0] : r.choferes;
    const aut = Array.isArray(r.autorizado) ? r.autorizado[0] : r.autorizado;
    return {
      id: r.id,
      chofer_id: r.chofer_id,
      chofer_nombre: chofer ? `${chofer.apellido}, ${chofer.nombre}` : "—",
      tipo: r.tipo,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      autorizado_por_nombre: aut ? `${aut.nombre}${aut.apellido ? " " + aut.apellido : ""}` : null,
      en_curso: r.fecha_inicio <= hoyStr && r.fecha_fin >= hoyStr,
    };
  });
}
