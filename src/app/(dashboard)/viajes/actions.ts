"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ViajeBasico, PaginatedResult } from "./types";
import { requireArea } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";

const PAGE_SIZE = 20;

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
      `id, fecha_viaje, km_con_carga, km_vacios, tonelaje_real, estado, facturado, codigo, observaciones, monto_flete, moneda, nro_viaje_ypf,
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
      chofer: choferStr ?? "—",
      camion: camionStr ?? "—",
      monto_flete: v.monto_flete ?? null,
      moneda: v.moneda ?? "ARS",
      observaciones: v.observaciones ?? null,
      nro_viaje_ypf: v.nro_viaje_ypf ?? null,
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

export type ViajeFormData = {
  clientes: ViajeFormOption[];
  choferes: ChoferFormOption[];
  camiones: ViajeFormOption[];
  tipos_carga: ViajeFormOption[];
  puntos_ruta: ViajeFormOption[];
};

export async function getViajeFormData(): Promise<ViajeFormData | { error: string }> {
  const supabase = createAdminClient();

  const [clientesRes, choferesRes, camionesRes, tiposCargaRes, puntosRes] =
    await Promise.all([
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
    ]);

  if (
    clientesRes.error ||
    choferesRes.error ||
    camionesRes.error ||
    tiposCargaRes.error ||
    puntosRes.error
  ) {
    console.error("Error cargando datos del formulario de viaje", {
      clientes: clientesRes.error,
      choferes: choferesRes.error,
      camiones: camionesRes.error,
      tipos_carga: tiposCargaRes.error,
      puntos_ruta: puntosRes.error,
    });
    return { error: "No se pudieron cargar los datos del formulario." };
  }

  let tiposCargaList = (tiposCargaRes.data ?? []).map((t) => ({
    id: t.id,
    label: t.nombre,
  }));

  // Auto-completar opciones genéricas en la base de datos si la tabla está vacía
  if (tiposCargaList.length === 0) {
    const genericOptions = [
      { nombre: "Carga General", requiere_documentacion_especial: false },
      { nombre: "Carga Refrigerada", requiere_documentacion_especial: false },
      { nombre: "Carga a Granel", requiere_documentacion_especial: false },
      { nombre: "Carga Paletizada", requiere_documentacion_especial: false },
      { nombre: "Carga Peligrosa", requiere_documentacion_especial: true },
      { nombre: "Otros", requiere_documentacion_especial: false },
    ];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertRes = await (supabase as any)
        .from("tipos_carga")
        .insert(genericOptions)
        .select("id, nombre");

      if (!insertRes.error && insertRes.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tiposCargaList = insertRes.data.map((t: any) => ({
          id: t.id,
          label: t.nombre,
        }));
      }
    } catch (err) {
      console.error("Error auto-poblando tipos de carga genéricos:", err);
    }
  }

  // Garantizar que la opción "Otros" siempre exista en la lista final
  const hasOtros = tiposCargaList.some((t) => t.label.toLowerCase() === "otros");
  if (!hasOtros) {
    tiposCargaList.push({ id: "otros", label: "Otros" });
  }

  // Mapa chofer_id → camión asignado (para auto-completar en el form)
  const camionPorChofer = new Map<string, string>();
  for (const cam of camionesRes.data ?? []) {
    if ((cam as { chofer_actual_id?: string | null }).chofer_actual_id) {
      camionPorChofer.set(
        (cam as { chofer_actual_id: string }).chofer_actual_id,
        cam.id,
      );
    }
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
    origen_nombre: z.string().optional().nullable(),
    destino_nombre: z.string().optional().nullable(),
    km_con_carga: z.number().int().min(0, "Debe ser ≥ 0."),
    km_vacios: z.number().int().min(0, "Debe ser ≥ 0."),
    tonelaje_real: z.number().min(0, "Debe ser ≥ 0."),
    monto_flete: z.number().min(0, "Debe ser ≥ 0."),
    nro_viaje_ypf: z.string().max(60, "Máximo 60 caracteres.").optional().nullable(),
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
    origen_nombre: emptyOrNull(formData.get("origen_nombre")),
    destino_nombre: emptyOrNull(formData.get("destino_nombre")),
    km_con_carga: parseNumber(formData.get("km_con_carga")),
    km_vacios: parseNumber(formData.get("km_vacios")),
    tonelaje_real: parseNumber(formData.get("tonelaje_real")),
    monto_flete: parseNumber(formData.get("monto_flete")),
    nro_viaje_ypf: emptyOrNull(formData.get("nro_viaje_ypf")),
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
    try {
      realTipoCargaId = await getOrCreateTipoCargaOtros(supabase);
    } catch (e) {
      console.error("Error obteniendo/creando tipo de carga Otros:", e);
      return { error: "No se pudo resolver el tipo de carga 'Otros'." };
    }
    const descOtros = String(formData.get("descripcion_otros") ?? "").trim();
    if (descOtros) {
      notasAdicionales.push(`Carga (Otros): ${descOtros}`);
    }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("viajes").insert({
    codigo,
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
    moneda: "ARS",
    observaciones: observacionesDB,
    nro_viaje_ypf: parsed.data.nro_viaje_ypf ?? null,
    facturado: false,
    created_by: user.id,
  });

  if (error) {
    console.error("Error al crear viaje:", error);
    return { error: error.message };
  }

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
  search?: string;
};

export async function getAllViajesForExportAction(params?: ExportViajesParams) {
  await requireArea("viajes", "read");
  const { choferId, desde, hasta, estado, search } = params ?? {};
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    usuario_id: userId,
    accion,
    entidad_tipo: "viaje",
    entidad_id: viajeId,
    valores_anteriores: valoresAnteriores,
    valores_nuevos: valoresNuevos,
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
  cobro: {
  cobrado: boolean;
    fecha: string;
    medio: "efectivo" | "transferencia" | "cheque" | "otro";
    observaciones: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {

  const user = await requireArea("viajes", "write");

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: viaje, error: fetchError } = await (supabase as any)
    .from("viajes")
    .select("estado, monto_flete, fecha_viaje, codigo, cliente_id, clientes(razon_social)")
    .eq("id", viajeId)
    .single();

  if (fetchError || !viaje) return { ok: false, error: "Viaje no encontrado." };

  // Sin monto de flete no hay nada que impacte en caja: no se marca como facturado
  // para no dejar un cobro "fantasma" sin movimiento asociado.
  const facturadoFinal = cobro.cobrado && viaje.monto_flete > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("viajes")
    .update({ estado: "cerrado", facturado: facturadoFinal })
    .eq("id", viajeId);

  if (updateError) return { ok: false, error: "No se pudo cerrar el viaje." };

  await logViajeAudit(supabase, viajeId, "cambio_estado", { estado: viaje.estado }, {
    estado: "cerrado",
    cobrado: facturadoFinal,
    ...(facturadoFinal && { medio_cobro: cobro.medio }),
    ...(cobro.observaciones && { observaciones: cobro.observaciones }),
  }, user.id);

  if (facturadoFinal) {
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
        monto: viaje.monto_flete,
        medio: cobro.medio,
        fecha: cobro.fecha,
        moneda: "ARS",
        viaje_id: viajeId,
        cliente_id: viaje.cliente_id ?? null,
        observaciones: cobro.observaciones,
        created_by: user.id,
      });
    }
  }

  revalidatePath("/viajes");
  revalidatePath("/caja");
  return { ok: true };
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
       cliente_id, chofer_id, camion_id, tipo_carga_id,
       origen_id, destino_id,
       km_con_carga, km_vacios, tonelaje_real, monto_flete, observaciones,
       nro_viaje_ypf,
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
    descripcion_otros: string | null;
    origen_nombre: string | null;
    destino_nombre: string | null;
    km_con_carga: number;
    km_vacios: number;
    tonelaje_real: number;
    monto_flete: number;
    nro_viaje_ypf: string | null;
  },
): Promise<UpdateViajeState> {

  const parsed = viajeSchema.safeParse({
    fecha_viaje: data.fecha_viaje,
    estado: data.estado,
    cliente_id: data.cliente_id,
    chofer_id: data.chofer_id,
    camion_id: data.camion_id,
    tipo_carga_id: data.tipo_carga_id,
    origen_nombre: data.origen_nombre,
    destino_nombre: data.destino_nombre,
    km_con_carga: data.km_con_carga,
    km_vacios: data.km_vacios,
    tonelaje_real: data.tonelaje_real,
    monto_flete: data.monto_flete,
    nro_viaje_ypf: data.nro_viaje_ypf,
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
    .select("fecha_viaje, estado, cliente_id, chofer_id, camion_id, tipo_carga_id, origen_id, destino_id, km_con_carga, km_vacios, tonelaje_real, monto_flete")
    .eq("id", id)
    .single();

  let realTipoCargaId = parsed.data.tipo_carga_id;
  const notasAdicionales: string[] = [];

  if (realTipoCargaId === "otros") {
    try {
      realTipoCargaId = await getOrCreateTipoCargaOtros(supabase);
    } catch (e) {
      console.error("Error obteniendo/creando tipo de carga Otros:", e);
      return { error: "No se pudo resolver el tipo de carga 'Otros'." };
    }
    if (data.descripcion_otros) {
      notasAdicionales.push(`Carga (Otros): ${data.descripcion_otros}`);
    }
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
      origen_id,
      destino_id,
      km_con_carga: parsed.data.km_con_carga,
      km_vacios: parsed.data.km_vacios,
      tonelaje_real: parsed.data.tonelaje_real,
      monto_flete: parsed.data.monto_flete,
      observaciones: observacionesDB,
      nro_viaje_ypf: parsed.data.nro_viaje_ypf ?? null,
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
    },
    user.id,
  );

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

  // Resolver tipo de carga "otros" si se necesita
  let realTipoCargaOtrosId: string | null = null;
  const needsOtros = parseadas.some((p) => p.tipo_carga_id === "otros");
  if (needsOtros) {
    try {
      realTipoCargaOtrosId = await getOrCreateTipoCargaOtros(supabase);
    } catch {
      return { error: "No se pudo resolver el tipo de carga 'Otros'." };
    }
  }

  // Construir payload batch
  const payload = await Promise.all(
    parseadas.map(async (p) => {
      seq++;
      const codigo = `${prefix}${String(seq).padStart(5, "0")}`;
      const tipoCargaId =
        p.tipo_carga_id === "otros" ? (realTipoCargaOtrosId ?? p.tipo_carga_id) : p.tipo_carga_id;

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
        origen_id,
        destino_id,
        km_con_carga: p.km_con_carga,
        km_vacios: p.km_vacios,
        tonelaje_real: p.tonelaje_real,
        monto_flete: p.monto_flete,
        moneda: "ARS",
        nro_viaje_ypf: p.nro_viaje_ypf ?? null,
        facturado: false,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    usuario_id: user.id,
    accion: "crear_viajes_lote",
    entidad_tipo: "viaje",
    entidad_id: (insertedRows as { id: string }[])?.[0]?.id ?? null,
    valores_nuevos: {
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
