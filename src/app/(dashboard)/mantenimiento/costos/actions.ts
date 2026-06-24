"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Costos de Repuestos y Reparaciones (resumen mensual por proveedor, fuente "rep y rep").
export type CostoRepRep = {
  id: string;
  mes: string; // YYYY-MM-DD (primer día del mes)
  proveedor: string;
  neto_gravado: number;
  facturado_gravado: number;
  neto_ng: number;
  facturado_ng: number;
  neto_total: number;
  facturado_total: number;
  observaciones: string | null;
};

export type CostosResumenMes = {
  mes: string;
  proveedores: number;
  neto_total: number;
  facturado_total: number;
};

/** Lista de meses con datos (YYYY-MM-DD), más nuevo primero. */
export async function getMesesCostosAction(): Promise<string[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("costos_rep_rep")
    .select("mes")
    .order("mes", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...new Set(((data ?? []) as any[]).map((r) => String(r.mes)))];
}

/** Filas de costos para un mes (o todas si mes = null), ordenadas por monto. */
export async function getCostosRepRepAction(mes: string | null): Promise<CostoRepRep[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("costos_rep_rep")
    .select("id, mes, proveedor, neto_gravado, facturado_gravado, neto_ng, facturado_ng, neto_total, facturado_total, observaciones")
    .order("facturado_total", { ascending: false });
  if (mes) q = q.eq("mes", mes);
  const { data, error } = await q;
  if (error) {
    console.error("Error al cargar costos rep/rep:", error);
    return [];
  }
  return (data ?? []) as CostoRepRep[];
}

/** Totales por mes (para el encabezado/reporte). */
export async function getCostosResumenAction(): Promise<CostosResumenMes[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("costos_rep_rep")
    .select("mes, neto_total, facturado_total");
  const byMes = new Map<string, CostosResumenMes>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const mes = String(r.mes);
    const acc = byMes.get(mes) ?? { mes, proveedores: 0, neto_total: 0, facturado_total: 0 };
    acc.proveedores += 1;
    acc.neto_total += Number(r.neto_total ?? 0);
    acc.facturado_total += Number(r.facturado_total ?? 0);
    byMes.set(mes, acc);
  }
  return [...byMes.values()].sort((a, b) => (a.mes < b.mes ? 1 : -1));
}

/** Alta/edición manual de un costo (upsert por mes+proveedor, como el importador). */
export async function addCostoRepRepAction(input: {
  mes: string; // YYYY-MM
  proveedor: string;
  neto_gravado: number;
  facturado_gravado: number;
  neto_ng: number;
  facturado_ng: number;
  observaciones?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireArea("mantenimiento", "write");
  const proveedor = input.proveedor?.trim();
  if (!proveedor) return { ok: false, error: "El proveedor es obligatorio." };
  if (!/^\d{4}-\d{2}$/.test(input.mes)) return { ok: false, error: "Mes inválido (formato AAAA-MM)." };

  const n = (v: number) => Math.max(0, Number(v) || 0);
  const neto_gravado = n(input.neto_gravado);
  const facturado_gravado = n(input.facturado_gravado);
  const neto_ng = n(input.neto_ng);
  const facturado_ng = n(input.facturado_ng);

  const row = {
    mes: `${input.mes}-01`,
    proveedor,
    neto_gravado,
    facturado_gravado,
    neto_ng,
    facturado_ng,
    neto_total: neto_gravado + neto_ng,
    facturado_total: facturado_gravado + facturado_ng,
    observaciones: input.observaciones?.trim() || null,
    created_by: user.id,
  };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("costos_rep_rep")
    .upsert(row, { onConflict: "mes,proveedor" });
  if (error) {
    console.error("Error al guardar costo rep/rep:", error);
    return { ok: false, error: "No se pudo guardar el costo." };
  }
  revalidatePath("/mantenimiento/costos");
  return { ok: true };
}

export async function deleteCostoRepRepAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireArea("mantenimiento", "write");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("costos_rep_rep").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar el costo." };
  revalidatePath("/mantenimiento/costos");
  return { ok: true };
}
