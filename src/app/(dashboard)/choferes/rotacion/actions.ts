"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { TipoBaja } from "./compute";

const TIPOS: TipoBaja[] = ["renuncia_voluntaria", "despido", "jubilacion", "abandono", "otro"];

export type BajaInput = {
  nombre: string;
  chofer_id?: string | null;
  fecha_ingreso?: string | null;
  fecha_egreso?: string | null;
  anio: number;
  antiguedad_meses?: number | null;
  tipo_baja: TipoBaja;
  motivo?: string | null;
  base_zona?: string | null;
  observaciones?: string | null;
};

function mesesEntre(ing?: string | null, egr?: string | null): number | null {
  if (!ing || !egr) return null;
  const a = new Date(ing + "T00:00:00");
  const b = new Date(egr + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

function normalizar(input: BajaInput) {
  const nombre = input.nombre.trim();
  const tipo_baja = TIPOS.includes(input.tipo_baja) ? input.tipo_baja : "renuncia_voluntaria";
  const anio = Number(input.anio);
  // Antigüedad: si hay ambas fechas la calculamos; si no, respetamos la cargada.
  const antiguedad_meses =
    mesesEntre(input.fecha_ingreso, input.fecha_egreso) ?? input.antiguedad_meses ?? null;
  return {
    nombre,
    chofer_id: input.chofer_id || null,
    fecha_ingreso: input.fecha_ingreso || null,
    fecha_egreso: input.fecha_egreso || null,
    anio,
    antiguedad_meses,
    tipo_baja,
    motivo: input.motivo?.trim() || null,
    base_zona: input.base_zona?.trim() || null,
    observaciones: input.observaciones?.trim() || null,
  };
}

export async function crearBajaAction(input: BajaInput): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireSeccion("choferes_rotacion", "write");
  const supabase = createAdminClient();
  const row = normalizar(input);
  if (!row.nombre) return { error: "El nombre es obligatorio." };
  if (!Number.isFinite(row.anio) || row.anio < 1990 || row.anio > 2100) return { error: "Año inválido." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("rotacion_bajas").insert({ ...row, created_by: user.id, updated_by: user.id });
  if (error) return { error: "No se pudo registrar la baja." };
  revalidatePath("/choferes/rotacion");
  return { ok: true };
}

export async function editarBajaAction(id: string, input: BajaInput): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireSeccion("choferes_rotacion", "write");
  const supabase = createAdminClient();
  const row = normalizar(input);
  if (!id) return { error: "Falta el id." };
  if (!row.nombre) return { error: "El nombre es obligatorio." };
  if (!Number.isFinite(row.anio) || row.anio < 1990 || row.anio > 2100) return { error: "Año inválido." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("rotacion_bajas").update({ ...row, updated_by: user.id }).eq("id", id);
  if (error) return { error: "No se pudo actualizar la baja." };
  revalidatePath("/choferes/rotacion");
  return { ok: true };
}

export async function eliminarBajaAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  await requireSeccion("choferes_rotacion", "write");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("rotacion_bajas").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la baja." };
  revalidatePath("/choferes/rotacion");
  return { ok: true };
}

export async function guardarParametrosAnioAction(
  anio: number,
  data: { flota_inicial: number | null; flota_final: number | null },
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireSeccion("choferes_rotacion", "write");
  const supabase = createAdminClient();
  const a = Number(anio);
  if (!Number.isFinite(a)) return { error: "Año inválido." };
  const fi = data.flota_inicial;
  const ff = data.flota_final;
  if ((fi != null && fi < 0) || (ff != null && ff < 0)) return { error: "La flota no puede ser negativa." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("rotacion_anual")
    .upsert({ anio: a, flota_inicial: fi, flota_final: ff, updated_by: user.id }, { onConflict: "anio" });
  if (error) return { error: "No se pudieron guardar los parámetros." };
  revalidatePath("/choferes/rotacion");
  return { ok: true };
}
