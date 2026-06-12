"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type PlanillaChofer = {
  chofer_id: string;
  nombre: string;
  apellido: string;
  /** Camión "habitual" del chofer (camiones.chofer_actual_id). */
  camion_habitual_id: string | null;
  /** Camión asignado para la fecha consultada (asignacion_diaria). */
  camion_asignado_id: string | null;
  observaciones: string | null;
};

export type PlanillaDiariaData = {
  fecha: string;
  choferes: PlanillaChofer[];
  camiones: { id: string; label: string }[];
};

/**
 * Devuelve la foto de la planilla para una fecha: todos los choferes activos con
 * su camión habitual + lo que ya esté asignado ese día. Si un chofer no tiene fila
 * para la fecha, `camion_asignado_id` es null (la UI sugiere el habitual).
 */
export async function getPlanillaDiariaData(
  fecha: string,
): Promise<PlanillaDiariaData | { error: string }> {
  await requireArea("viajes", "read");
  if (!ISO.test(fecha)) return { error: "Fecha inválida." };

  const supabase = createAdminClient();
  const [choferesRes, camionesRes, asignacionesRes] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido", { ascending: true }),
    supabase
      .from("camiones")
      .select("id, patente, chofer_actual_id")
      .eq("estado", "activo")
      .order("patente", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id, observaciones")
      .eq("fecha", fecha),
  ]);

  if (choferesRes.error || camionesRes.error) {
    return { error: "No se pudieron cargar los datos de la planilla." };
  }

  const habitualPorChofer = new Map<string, string>();
  for (const cam of camionesRes.data ?? []) {
    const chid = (cam as { chofer_actual_id?: string | null }).chofer_actual_id;
    if (chid) habitualPorChofer.set(chid, cam.id);
  }

  type AsigRow = { chofer_id: string; camion_id: string; observaciones: string | null };
  const asigPorChofer = new Map<string, AsigRow>();
  for (const a of (asignacionesRes.data ?? []) as AsigRow[]) {
    asigPorChofer.set(a.chofer_id, a);
  }

  const choferes: PlanillaChofer[] = (choferesRes.data ?? []).map((c) => {
    const asig = asigPorChofer.get(c.id);
    return {
      chofer_id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      camion_habitual_id: habitualPorChofer.get(c.id) ?? null,
      camion_asignado_id: asig?.camion_id ?? null,
      observaciones: asig?.observaciones ?? null,
    };
  });

  return {
    fecha,
    choferes,
    camiones: (camionesRes.data ?? []).map((c) => ({ id: c.id, label: c.patente })),
  };
}

const guardarSchema = z.object({
  fecha: z.string().regex(ISO, "Fecha inválida."),
  items: z.array(
    z.object({
      chofer_id: z.string().uuid(),
      camion_id: z.string().uuid().nullable(),
      observaciones: z.string().max(500).nullable().optional(),
    }),
  ),
});

export type GuardarPlanillaInput = z.infer<typeof guardarSchema>;
export type GuardarPlanillaResult =
  | { ok: true; guardadas: number }
  | { ok: false; error: string };

/**
 * Reemplaza la planilla completa de la fecha: borra las filas del día y reinserta
 * solo las que tienen camión. Guardar la planilla entera de una vez mantiene la
 * lógica simple y predecible (la fecha es la unidad de edición).
 */
export async function guardarPlanillaDiariaAction(
  input: GuardarPlanillaInput,
): Promise<GuardarPlanillaResult> {
  const user = await requireArea("viajes", "write");
  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const { fecha, items } = parsed.data;

  // Validar que un mismo camión no quede en dos choferes el mismo día
  // (también lo garantiza el unique de la tabla, pero damos un error claro).
  const camionVisto = new Set<string>();
  for (const it of items) {
    if (!it.camion_id) continue;
    if (camionVisto.has(it.camion_id)) {
      return {
        ok: false,
        error: "Hay un camión asignado a dos choferes el mismo día. Revisá la planilla.",
      };
    }
    camionVisto.add(it.camion_id);
  }

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any)
    .from("asignacion_diaria")
    .delete()
    .eq("fecha", fecha);
  if (delErr) {
    console.error("Error limpiando planilla diaria:", delErr);
    return { ok: false, error: "No se pudo actualizar la planilla." };
  }

  const rows = items
    .filter((i) => i.camion_id)
    .map((i) => ({
      fecha,
      chofer_id: i.chofer_id,
      camion_id: i.camion_id,
      observaciones: i.observaciones?.trim() || null,
      created_by: user.id,
      updated_by: user.id,
    }));

  if (rows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("asignacion_diaria").insert(rows);
    if (error) {
      console.error("Error guardando planilla diaria:", error);
      return { ok: false, error: "No se pudo guardar. Revisá que no haya camiones repetidos." };
    }
  }

  revalidatePath("/viajes/planilla-diaria");
  revalidatePath("/viajes/carga-rapida");
  return { ok: true, guardadas: rows.length };
}
