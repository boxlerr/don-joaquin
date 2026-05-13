"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ViajeBasico, PaginatedResult } from "./types";

const PAGE_SIZE = 20;

export type GetViajesParams = {
  choferId?: string;
  page?: number;
  pageSize?: number;
  desde?: string;
  hasta?: string;
  estado?: string[];
  search?: string;
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
  } = params;

  const supabase = createAdminClient();
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("viajes")
    .select(
      `id, fecha_viaje, km_con_carga, km_vacios, estado, facturado, codigo,
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`,
      { count: "exact" }
    )
    .order("fecha_viaje", { ascending: false })
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
    query = query.ilike("codigo", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error al obtener viajes:", error);
    return { error: "No se pudo cargar los viajes." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped: ViajeBasico[] = (data ?? []).map((v: any) => ({
    id: v.id,
    codigo: v.codigo,
    fecha_viaje: v.fecha_viaje,
    origen: v.origen?.nombre ?? null,
    destino: v.destino?.nombre ?? null,
    km_totales: (v.km_con_carga ?? 0) + (v.km_vacios ?? 0),
    estado: v.estado,
    facturado: v.facturado,
  }));

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

export type ViajeFormData = {
  clientes: ViajeFormOption[];
  choferes: ViajeFormOption[];
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
        .select("id, nombre, apellido")
        .eq("estado", "activo")
        .order("apellido", { ascending: true }),
      supabase
        .from("camiones")
        .select("id, patente")
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

  return {
    clientes: (clientesRes.data ?? []).map((c) => ({
      id: c.id,
      label: c.razon_social,
    })),
    choferes: (choferesRes.data ?? []).map((c) => ({
      id: c.id,
      label: `${c.apellido}, ${c.nombre}`,
    })),
    camiones: (camionesRes.data ?? []).map((c) => ({
      id: c.id,
      label: c.patente,
    })),
    tipos_carga: (tiposCargaRes.data ?? []).map((t) => ({
      id: t.id,
      label: t.nombre,
    })),
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
    tipo_carga_id: z.string().uuid("Tipo de carga inválido."),
    origen_id: z.string().uuid("Origen inválido.").optional().nullable(),
    destino_id: z.string().uuid("Destino inválido.").optional().nullable(),
    km_con_carga: z.number().int().min(0, "Debe ser ≥ 0."),
    km_vacios: z.number().int().min(0, "Debe ser ≥ 0."),
    tonelaje_real: z.number().min(0, "Debe ser ≥ 0."),
    monto_flete: z.number().min(0, "Debe ser ≥ 0."),
  })
  .refine(
    (d) => !(d.origen_id && d.destino_id && d.origen_id === d.destino_id),
    {
      message: "Origen y destino deben ser distintos.",
      path: ["destino_id"],
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
    origen_id: emptyOrNull(formData.get("origen_id")),
    destino_id: emptyOrNull(formData.get("destino_id")),
    km_con_carga: parseNumber(formData.get("km_con_carga")),
    km_vacios: parseNumber(formData.get("km_vacios")),
    tonelaje_real: parseNumber(formData.get("tonelaje_real")),
    monto_flete: parseNumber(formData.get("monto_flete")),
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

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const supabase = createAdminClient();

  let codigo: string;
  try {
    codigo = await generarCodigoViaje(supabase);
  } catch (e) {
    console.error("Error generando código de viaje", e);
    return { error: "No se pudo generar el código del viaje." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("viajes").insert({
    codigo,
    fecha_viaje: parsed.data.fecha_viaje,
    estado: parsed.data.estado,
    cliente_id: parsed.data.cliente_id,
    chofer_id: parsed.data.chofer_id,
    camion_id: parsed.data.camion_id,
    tipo_carga_id: parsed.data.tipo_carga_id,
    origen_id: parsed.data.origen_id ?? null,
    destino_id: parsed.data.destino_id ?? null,
    km_con_carga: parsed.data.km_con_carga,
    km_vacios: parsed.data.km_vacios,
    tonelaje_real: parsed.data.tonelaje_real,
    monto_flete: parsed.data.monto_flete,
    moneda: "ARS",
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
