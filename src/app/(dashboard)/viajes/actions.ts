"use server";

import { createAdminClient } from "@/lib/supabase/admin";
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
