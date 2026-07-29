"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { resolverEntidadLabels } from "./resolve-labels";
import { resolverReferencias } from "./resolve-refs";
import type { RefsMap } from "@/lib/audit-catalog";

const AUDIT_PAGE_SIZE = 25;

export type AuditLogEntry = {
  id: string;
  accion: string;
  entidad_tipo: string;
  entidad_id: string;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
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
  accion?: string;
  page?: number;
  /** Contar el total (query cara). Solo hace falta al cambiar filtros, no al paginar. */
  withCount?: boolean;
  /**
   * Esconder los registros que escribe el trigger de base (`metadata.fuente =
   * 'trigger_db'`). Las escrituras que pasan por la app dejan DOS entradas: la
   * de la server action, que tiene la intención y el usuario real, y la del
   * trigger, que tiene el antes/después crudo y cubre lo que NO pasa por la app.
   * Las dos hacen falta, pero verlas juntas ahoga el panel.
   */
  ocultar_db?: boolean;
};

export type AuditLogsResult = {
  data: AuditLogEntry[];
  total: number;
  refs: RefsMap;
};

export async function getGlobalAuditLogsAction(
  params: GetAuditLogsParams = {}
): Promise<AuditLogsResult | { error: string }> {
  await requireArea("sistema", "read");

  const {
    desde,
    hasta,
    usuario_id,
    entidad_tipos,
    accion,
    page = 0,
    withCount = true,
    ocultar_db = false,
  } = params;
  const supabase = createAdminClient();
  const rangeFrom = page * AUDIT_PAGE_SIZE;
  const rangeTo = rangeFrom + AUDIT_PAGE_SIZE - 1;

  // El count exacto es la parte cara y solo cambia al filtrar: al paginar se
  // omite (el cliente reusa el total que ya tiene) → cambiar de página es más liviano.
  const selectOpts = withCount ? { count: "exact" as const } : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("audit_log")
    .select(
      "id, accion, entidad_tipo, entidad_id, valores_anteriores, valores_nuevos, metadata, created_at, usuario:usuario_id(nombre, apellido)",
      selectOpts
    )
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta + "T23:59:59");
  if (usuario_id) query = query.eq("usuario_id", usuario_id);
  if (accion) query = query.eq("accion", accion);
  if (entidad_tipos && entidad_tipos.length > 0) {
    query = query.in("entidad_tipo", entidad_tipos);
  }
  // Se filtra por el prefijo de la acción y no por `metadata->>'fuente'`: son
  // exactamente las mismas filas (el trigger escribe las dos cosas en el mismo
  // INSERT) y `accion` es una columna NOT NULL, así que el filtro no puede
  // dejar afuera por accidente registros con metadata vacío.
  if (ocultar_db) query = query.not("accion", "like", "vacaciones_db_%");

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

  // Resolver el nombre legible del recurso afectado, por entidad (ver resolve-labels.ts).
  const idsPorTipo: Record<string, Set<string>> = {};
  for (const e of entriesBase) {
    if (!e.entidad_id) continue;
    (idsPorTipo[e.entidad_tipo] ??= new Set()).add(e.entidad_id);
  }

  const labels = await resolverEntidadLabels(supabase, idsPorTipo);

  const entries: AuditLogEntry[] = entriesBase.map((e) => {
    const resolved = labels[`${e.entidad_tipo}:${e.entidad_id}`];
    return {
      ...e,
      entidad_label: resolved?.label ?? null,
      entidad_detalle: resolved?.detalle ?? null,
    };
  });

  const refs = await resolverReferencias(supabase, entries);

  // total = -1 cuando no se pidió count: el cliente mantiene el total que ya tenía.
  return { data: entries, total: withCount ? (count ?? 0) : -1, refs };
}

export async function getAuditUsuariosAction(): Promise<
  { id: string; nombre: string; apellido: string | null }[]
> {
  await requireArea("sistema", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, apellido")
    .order("nombre");
  return (data ?? []) as { id: string; nombre: string; apellido: string | null }[];
}
