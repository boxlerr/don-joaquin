"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { aniosCumplidos, diasPorAntiguedad } from "./derivar";

/**
 * Recalcula los "días que corresponden" del año en curso según la antigüedad
 * actual de cada empleado (14/21/28/35) sobre `chofer_vacaciones_anios`. Crea la
 * fila del año a quien no la tenga (altas nuevas) y sólo toca a los desfasados;
 * los saldos de años anteriores no se modifican. Si se pasa `choferId`,
 * recalcula sólo ese.
 */
export async function recalcularDiasPorAntiguedadAction(choferId?: string) {
  const user = await requireArea("logistica", "write");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const anioActual = new Date().getFullYear();

  let q = sb
    .from("choferes")
    .select("id, fecha_ingreso")
    .eq("estado", "activo")
    .eq("es_demo", false);
  if (choferId) q = q.eq("id", choferId);
  const { data: choferes } = await q;

  const { data: filas } = await sb
    .from("chofer_vacaciones_anios")
    .select("chofer_id, dias_correspondientes")
    .eq("anio", anioActual);
  const actualMap = new Map<string, number>();
  for (const f of (filas ?? []) as { chofer_id: string; dias_correspondientes: number }[]) {
    actualMap.set(f.chofer_id, f.dias_correspondientes ?? 0);
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown>[] = [];
  for (const c of (choferes ?? []) as { id: string; fecha_ingreso: string | null }[]) {
    if (!c.fecha_ingreso) continue;
    const correcto = diasPorAntiguedad(aniosCumplidos(c.fecha_ingreso, anioActual));
    if (actualMap.get(c.id) === correcto) continue; // ya está bien
    updates.push({
      chofer_id: c.id,
      anio: anioActual,
      dias_correspondientes: correcto,
      observaciones: "Días por antigüedad (LCT art. 150)",
      updated_by: user.id,
      updated_at: nowIso,
    });
  }

  if (updates.length > 0) {
    const { error } = await sb
      .from("chofer_vacaciones_anios")
      .upsert(updates, { onConflict: "chofer_id,anio" });
    if (error) return { error: "No se pudieron recalcular los días por antigüedad." };
  }

  revalidatePath("/choferes/vacaciones");
  revalidatePath("/choferes/[slug]", "page");
  return { success: true, actualizados: updates.length };
}
