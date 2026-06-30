"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// `viajes.zona` es columna nueva; se accede con `as any` hasta regenerar database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

function getRangoMes(monthStr?: string): { desde: string; hasta: string } {
  let year: number;
  let month: number;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split("-");
    year = parseInt(y, 10);
    month = parseInt(m, 10) - 1;
  } else {
    const hoy = new Date();
    year = hoy.getFullYear();
    month = hoy.getMonth();
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: fmt(new Date(year, month, 1)), hasta: fmt(new Date(year, month + 1, 0)) };
}

export type SueldoChoferRow = {
  chofer_id: string;
  chofer: string;
  viajes: number;
  km_con_carga: number; // "al 100%"
  km_vacios: number;
  km_total: number;
  tonelaje: number;
  sur: number;
  pozo: number;
};

export async function getSueldosResumenAction(month?: string): Promise<SueldoChoferRow[]> {
  await requireSeccion("sueldos", "read");
  const supabase = createAdminClient();
  const { desde, hasta } = getRangoMes(month);

  const { data } = await (supabase as any)
    .from("viajes")
    .select("chofer_id, km_con_carga, km_vacios, tonelaje_real, zona")
    .eq("estado", "cerrado")
    .gte("fecha_viaje", desde)
    .lte("fecha_viaje", hasta)
    .not("chofer_id", "is", null);

  const rows = (data ?? []) as {
    chofer_id: string; km_con_carga: number; km_vacios: number; tonelaje_real: number | null; zona: string | null;
  }[];

  const map = new Map<string, SueldoChoferRow>();
  for (const v of rows) {
    let r = map.get(v.chofer_id);
    if (!r) {
      r = { chofer_id: v.chofer_id, chofer: "", viajes: 0, km_con_carga: 0, km_vacios: 0, km_total: 0, tonelaje: 0, sur: 0, pozo: 0 };
      map.set(v.chofer_id, r);
    }
    r.viajes++;
    r.km_con_carga += Number(v.km_con_carga ?? 0);
    r.km_vacios += Number(v.km_vacios ?? 0);
    r.tonelaje += Number(v.tonelaje_real ?? 0);
    if (v.zona === "sur") r.sur++;
    if (v.zona === "pozo") r.pozo++;
  }
  for (const r of map.values()) r.km_total = r.km_con_carga + r.km_vacios;

  const ids = [...map.keys()];
  if (ids.length) {
    const { data: chs } = await supabase.from("choferes").select("id, nombre, apellido").in("id", ids);
    for (const c of chs ?? []) {
      const r = map.get(c.id);
      if (r) r.chofer = `${c.apellido}, ${c.nombre}`;
    }
  }

  return [...map.values()].sort((a, b) => a.chofer.localeCompare(b.chofer));
}

export type ViajeZonaRow = {
  id: string;
  codigo: string;
  fecha: string;
  destino: string;
  km_con_carga: number;
  km_vacios: number;
  zona: string | null;
};

export async function getViajesChoferMesAction(choferId: string, month?: string): Promise<ViajeZonaRow[]> {
  await requireSeccion("sueldos", "read");
  const supabase = createAdminClient();
  const { desde, hasta } = getRangoMes(month);

  const { data } = await (supabase as any)
    .from("viajes")
    .select("id, codigo, fecha_viaje, km_con_carga, km_vacios, destino_id, zona")
    .eq("estado", "cerrado")
    .eq("chofer_id", choferId)
    .gte("fecha_viaje", desde)
    .lte("fecha_viaje", hasta)
    .order("fecha_viaje", { ascending: true });

  const rows = (data ?? []) as {
    id: string; codigo: string; fecha_viaje: string; km_con_carga: number; km_vacios: number; destino_id: string | null; zona: string | null;
  }[];

  const destinoIds = [...new Set(rows.map((r) => r.destino_id).filter(Boolean) as string[])];
  const destinoNombre = new Map<string, string>();
  if (destinoIds.length) {
    const { data: pts } = await supabase.from("puntos_ruta").select("id, nombre").in("id", destinoIds);
    for (const p of pts ?? []) destinoNombre.set(p.id, p.nombre);
  }

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    fecha: r.fecha_viaje,
    destino: r.destino_id ? destinoNombre.get(r.destino_id) ?? "—" : "—",
    km_con_carga: Number(r.km_con_carga ?? 0),
    km_vacios: Number(r.km_vacios ?? 0),
    zona: r.zona,
  }));
}

export async function setViajeZonaAction(
  viajeId: string,
  zona: "sur" | "pozo" | null,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos", "write");
  const supabase = createAdminClient();

  const { error } = await (supabase as any).from("viajes").update({ zona }).eq("id", viajeId);
  if (error) return { error: "No se pudo marcar la zona del viaje." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "viaje",
    entidadId: viajeId,
    valoresNuevos: { zona },
    metadata: { origen: "sueldos" },
  });

  revalidatePath("/choferes/sueldos");
  return { ok: true };
}
