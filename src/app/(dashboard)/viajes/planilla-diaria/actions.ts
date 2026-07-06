"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";

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
  /** Fecha de hoy (ISO). */
  hoy: string;
  /** Solo la planilla de HOY se edita: cambiarla reescribe la asignación fija.
   *  Las otras fechas son historial de solo lectura. */
  editable: boolean;
  choferes: PlanillaChofer[];
  camiones: { id: string; label: string }[];
};

/**
 * Devuelve la foto de la planilla para una fecha.
 *
 * La asignación fija de cada chofer vive en `camiones.chofer_actual_id` (misma
 * fuente que el legajo). Para HOY mostramos esa asignación fija: así el legajo y
 * la planilla están siempre sincronizados y lo que se cambia queda guardado hasta
 * el próximo cambio. Para fechas pasadas mostramos el snapshot guardado ese día
 * (`asignacion_diaria`) como historial.
 */
export async function getPlanillaDiariaData(
  fecha: string,
): Promise<PlanillaDiariaData | { error: string }> {
  await requireArea("viajes", "read");
  if (!ISO.test(fecha)) return { error: "Fecha inválida." };
  const hoy = new Date().toISOString().slice(0, 10);
  const editable = fecha === hoy;

  const supabase = createAdminClient();
  const [choferesRes, camionesRes, asignacionesRes] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      // Solo choferes (no administración, mantenimiento ni fleteros). Null = chofer,
      // misma definición que la tarjeta "Choferes" del legajo.
      .or("rol.is.null,rol.eq.chofer")
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
    const habitual = habitualPorChofer.get(c.id) ?? null;
    return {
      chofer_id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      camion_habitual_id: habitual,
      // HOY: la asignación fija manda (sincronizada con el legajo). Otras fechas:
      // el snapshot de ese día (historial), con el habitual como último recurso.
      camion_asignado_id: editable ? habitual : asig?.camion_id ?? habitual,
      observaciones: asig?.observaciones ?? null,
    };
  });

  return {
    fecha,
    hoy,
    editable,
    choferes,
    camiones: (camionesRes.data ?? []).map((c) => ({ id: c.id, label: c.patente })),
  };
}

// ---------------------------------------------------------------------------
// Impresión: hoja de asignación con el formato de la fotocopia que usan a mano.
// ---------------------------------------------------------------------------

export type PlanillaImpresionRow = {
  nombre: string;
  cuil: string;
  tractor: string; // patente del camión asignado
  acoplado: string; // patente del semi/acoplado
  telefono: string;
  localidad: string;
};

export async function getPlanillaImpresionAction(
  fecha: string,
): Promise<{ fecha: string; rows: PlanillaImpresionRow[] } | { error: string }> {
  await requireArea("viajes", "read");
  if (!ISO.test(fecha)) return { error: "Fecha inválida." };

  const supabase = createAdminClient();
  const [choferesRes, camionesRes, asignacionesRes, vinculosRes, acopladosRes] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, cuil, telefono, localidad")
      .eq("estado", "activo")
      // Solo choferes (no administración, mantenimiento ni fleteros).
      .or("rol.is.null,rol.eq.chofer")
      .order("apellido", { ascending: true }),
    supabase.from("camiones").select("id, patente, chofer_actual_id").eq("estado", "activo"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("asignacion_diaria").select("chofer_id, camion_id").eq("fecha", fecha),
    supabase.from("camion_acoplados").select("camion_id, acoplado_id").is("hasta", null),
    supabase.from("acoplados").select("id, patente"),
  ]);

  if (choferesRes.error || camionesRes.error) {
    return { error: "No se pudieron cargar los datos para imprimir." };
  }

  const patentePorCamion = new Map<string, string>();
  const habitualPorChofer = new Map<string, string>();
  for (const c of camionesRes.data ?? []) {
    patentePorCamion.set(c.id, c.patente);
    const chid = (c as { chofer_actual_id?: string | null }).chofer_actual_id;
    if (chid) habitualPorChofer.set(chid, c.id);
  }

  const asigPorChofer = new Map<string, string>();
  for (const a of (asignacionesRes.data ?? []) as { chofer_id: string; camion_id: string }[]) {
    asigPorChofer.set(a.chofer_id, a.camion_id);
  }

  const patenteAcoplado = new Map<string, string>();
  for (const a of acopladosRes.data ?? []) patenteAcoplado.set(a.id, a.patente);
  const acopladoPorCamion = new Map<string, string>();
  for (const v of vinculosRes.data ?? []) {
    if (!acopladoPorCamion.has(v.camion_id)) {
      const pat = patenteAcoplado.get(v.acoplado_id);
      if (pat) acopladoPorCamion.set(v.camion_id, pat);
    }
  }

  const rows: PlanillaImpresionRow[] = (choferesRes.data ?? []).map((c) => {
    const camionId = asigPorChofer.get(c.id) ?? habitualPorChofer.get(c.id) ?? null;
    return {
      nombre: `${c.apellido} ${c.nombre}`.trim(),
      cuil: c.cuil ?? "",
      tractor: camionId ? patentePorCamion.get(camionId) ?? "" : "",
      acoplado: camionId ? acopladoPorCamion.get(camionId) ?? "" : "",
      telefono: c.telefono ?? "",
      localidad: c.localidad ?? "",
    };
  });

  return { fecha, rows };
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
 * Guarda la planilla de HOY. El modelo es "asignación fija": el camión de cada
 * chofer vive en `camiones.chofer_actual_id` (misma fuente que el legajo), así que
 * guardar reescribe esa asignación fija (queda hasta el próximo cambio) y sincroniza
 * el legajo. Además deja un snapshot del día en `asignacion_diaria` (historial +
 * default de la carga de viajes). Las fechas pasadas son solo lectura.
 */
export async function guardarPlanillaDiariaAction(
  input: GuardarPlanillaInput,
): Promise<GuardarPlanillaResult> {
  const user = await requireArea("viajes", "write");
  // Guardar la planilla reescribe la asignación FIJA de camiones (mismo dato que
  // el legajo), así que además de viajes:write exigimos logistica:write —igual que
  // asignar/desasignar desde el legajo— para que el permiso no dependa del camino.
  if (!hasArea(user, "logistica", "write")) {
    return {
      ok: false,
      error: "Necesitás permiso de Logística (escritura) para cambiar la asignación de camiones.",
    };
  }

  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const { fecha, items } = parsed.data;

  // Solo se edita la planilla de HOY: cambiarla reescribe la asignación fija.
  const hoy = new Date().toISOString().slice(0, 10);
  if (fecha !== hoy) {
    return {
      ok: false,
      error: "Solo se puede editar la planilla de hoy. Las fechas anteriores son historial.",
    };
  }

  // Validar que un mismo camión no quede en dos choferes (lo garantiza también el
  // unique de la tabla, pero damos un error claro y temprano).
  const camionVisto = new Set<string>();
  for (const it of items) {
    if (!it.camion_id) continue;
    if (camionVisto.has(it.camion_id)) {
      return {
        ok: false,
        error: "Hay un camión asignado a dos choferes. Revisá la planilla.",
      };
    }
    camionVisto.add(it.camion_id);
  }

  const supabase = createAdminClient();

  // Toda la reconciliación (reescribir la asignación fija de camiones + snapshot
  // del día) va en UNA transacción dentro de la función: si algo falla, se revierte
  // entero y no quedan choferes liberados sin reasignar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("aplicar_planilla_estandar", {
    p_items: items.map((i) => ({
      chofer_id: i.chofer_id,
      camion_id: i.camion_id ?? null,
      observaciones: i.observaciones?.trim() || null,
    })),
    p_fecha: fecha,
    p_user: user.id,
  });
  if (error) {
    console.error("Error guardando planilla (rpc aplicar_planilla_estandar):", error);
    return { ok: false, error: "No se pudo guardar. Revisá que no haya camiones repetidos." };
  }

  const guardadas = items.filter((i) => i.camion_id).length;

  revalidatePath("/viajes/planilla-diaria");
  revalidatePath("/viajes/carga-rapida");
  revalidatePath("/choferes");
  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/camiones");
  return { ok: true, guardadas };
}
