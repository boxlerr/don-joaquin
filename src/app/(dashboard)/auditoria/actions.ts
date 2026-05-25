"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireArea } from "@/lib/auth";

const AUDIT_PAGE_SIZE = 25;

export type AuditLogEntry = {
  id: string;
  accion: string;
  entidad_tipo: string;
  entidad_id: string;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  created_at: string;
  usuario: { nombre: string; apellido: string } | null;
  /** Nombre legible del recurso afectado, resuelto desde entidad_id.
   *  Ej. para chofer: "Grodz, Lucas". Null si no se pudo resolver. */
  entidad_label: string | null;
  /** Detalle adicional del recurso (ej. DNI del chofer, patente del camión). */
  entidad_detalle: string | null;
};

export type GetAuditLogsParams = {
  desde?: string;
  hasta?: string;
  usuario_id?: string;
  entidad_tipos?: string[];
  page?: number;
};

export type AuditLogsResult = {
  data: AuditLogEntry[];
  total: number;
};

export async function getGlobalAuditLogsAction(
  params: GetAuditLogsParams = {}
): Promise<AuditLogsResult | { error: string }> {
  await requireUser();

  const { desde, hasta, usuario_id, entidad_tipos, page = 0 } = params;
  const supabase = createAdminClient();
  const rangeFrom = page * AUDIT_PAGE_SIZE;
  const rangeTo = rangeFrom + AUDIT_PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("audit_log")
    .select(
      "id, accion, entidad_tipo, entidad_id, valores_anteriores, valores_nuevos, created_at, usuario:usuario_id(nombre, apellido)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta + "T23:59:59");
  if (usuario_id) query = query.eq("usuario_id", usuario_id);
  if (entidad_tipos && entidad_tipos.length > 0) {
    query = query.in("entidad_tipo", entidad_tipos);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error al obtener auditoría:", error);
    return { error: "No se pudo cargar el registro de auditoría." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entriesBase: Omit<AuditLogEntry, "entidad_label" | "entidad_detalle">[] = (data ?? []).map((e: any) => ({
    ...e,
    usuario: Array.isArray(e.usuario) ? (e.usuario[0] ?? null) : e.usuario,
  }));

  // Resolver labels de los recursos afectados (chofer, camion, cliente, viaje, etc.)
  // Hacemos 1 query por tipo para todos los IDs únicos.
  const idsPorTipo: Record<string, Set<string>> = {};
  for (const e of entriesBase) {
    if (!e.entidad_id) continue;
    if (!idsPorTipo[e.entidad_tipo]) idsPorTipo[e.entidad_tipo] = new Set();
    idsPorTipo[e.entidad_tipo].add(e.entidad_id);
  }

  const labels: Record<string, { label: string | null; detalle: string | null }> = {};

  // Choferes
  if (idsPorTipo.chofer?.size) {
    const { data: rows } = await supabase
      .from("choferes")
      .select("id, nombre, apellido, dni")
      .in("id", Array.from(idsPorTipo.chofer));
    for (const r of rows ?? []) {
      labels[`chofer:${r.id}`] = {
        label: `${r.apellido}, ${r.nombre}`,
        detalle: r.dni ? `DNI ${r.dni}` : null,
      };
    }
  }

  // Camiones
  if (idsPorTipo.camion?.size) {
    const { data: rows } = await supabase
      .from("camiones")
      .select("id, patente, marca, modelo")
      .in("id", Array.from(idsPorTipo.camion));
    for (const r of rows ?? []) {
      const detalle = [r.marca, r.modelo].filter(Boolean).join(" ").trim();
      labels[`camion:${r.id}`] = {
        label: r.patente ?? "Camión",
        detalle: detalle || null,
      };
    }
  }

  // Clientes
  if (idsPorTipo.cliente?.size) {
    const { data: rows } = await supabase
      .from("clientes")
      .select("id, razon_social, cuit")
      .in("id", Array.from(idsPorTipo.cliente));
    for (const r of rows ?? []) {
      labels[`cliente:${r.id}`] = {
        label: r.razon_social ?? "Cliente",
        detalle: r.cuit ? `CUIT ${r.cuit}` : null,
      };
    }
  }

  // Viajes
  if (idsPorTipo.viaje?.size) {
    const { data: rows } = await supabase
      .from("viajes")
      .select("id, codigo, fecha_viaje")
      .in("id", Array.from(idsPorTipo.viaje));
    for (const r of rows ?? []) {
      labels[`viaje:${r.id}`] = {
        label: r.codigo ?? "Viaje",
        detalle: r.fecha_viaje ? new Date(r.fecha_viaje).toLocaleDateString("es-AR") : null,
      };
    }
  }

  const entries: AuditLogEntry[] = entriesBase.map((e) => {
    const key = `${e.entidad_tipo}:${e.entidad_id}`;
    const resolved = labels[key];
    return {
      ...e,
      entidad_label: resolved?.label ?? null,
      entidad_detalle: resolved?.detalle ?? null,
    };
  });

  return { data: entries, total: count ?? 0 };
}

export async function getAuditUsuariosAction(): Promise<
  { id: string; nombre: string; apellido: string | null }[]
> {
  await requireUser();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, apellido")
    .order("nombre");
  return (data ?? []) as { id: string; nombre: string; apellido: string | null }[];
}
