"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { aniosCumplidos, diasPorAntiguedad } from "./derivar";

/**
 * Recalcula los "días que corresponden" del período en curso según la antigüedad
 * actual de cada empleado (14/21/28/35). Sólo toca a quienes están desfasados;
 * preserva el saldo adeudado. Si se pasa `choferId`, recalcula sólo ese.
 */
export async function recalcularDiasPorAntiguedadAction(choferId?: string) {
  const user = await requireArea("logistica", "write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const finPeriodoY = new Date().getFullYear();

  let q = sb
    .from("choferes")
    .select("id, fecha_ingreso")
    .eq("estado", "activo")
    .eq("es_demo", false);
  if (choferId) q = q.eq("id", choferId);
  const { data: choferes } = await q;

  const { data: saldos } = await sb
    .from("chofer_vacaciones")
    .select("chofer_id, dias_correspondientes, dias_adeudados");
  const saldoMap = new Map<string, { corr: number; adeu: number }>();
  for (const s of (saldos ?? []) as { chofer_id: string; dias_correspondientes: number; dias_adeudados: number }[]) {
    saldoMap.set(s.chofer_id, { corr: s.dias_correspondientes ?? 0, adeu: s.dias_adeudados ?? 0 });
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown>[] = [];
  for (const c of (choferes ?? []) as { id: string; fecha_ingreso: string | null }[]) {
    if (!c.fecha_ingreso) continue;
    const correcto = diasPorAntiguedad(aniosCumplidos(c.fecha_ingreso, finPeriodoY));
    const existente = saldoMap.get(c.id);
    if (existente && existente.corr === correcto) continue; // ya está bien
    updates.push({
      chofer_id: c.id,
      dias_correspondientes: correcto,
      dias_adeudados: existente?.adeu ?? 0,
      updated_by: user.id,
      updated_at: nowIso,
    });
  }

  if (updates.length > 0) {
    const { error } = await sb.from("chofer_vacaciones").upsert(updates, { onConflict: "chofer_id" });
    if (error) return { error: "No se pudieron recalcular los días por antigüedad." };
  }

  revalidatePath("/choferes/vacaciones");
  revalidatePath("/choferes/[slug]", "page");
  return { success: true, actualizados: updates.length };
}
