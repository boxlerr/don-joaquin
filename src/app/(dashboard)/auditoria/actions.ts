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
  const entries: AuditLogEntry[] = (data ?? []).map((e: any) => ({
    ...e,
    usuario: Array.isArray(e.usuario) ? (e.usuario[0] ?? null) : e.usuario,
  }));

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
