"use server";

import { revalidatePath } from "next/cache";
import { avisarCambio } from "@/lib/avisos";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fecha de hoy en Argentina. El server corre en UTC, así que `toISOString()` pasa
 * al día siguiente a partir de las 21:00 ART y la planilla del día real quedaría
 * de solo lectura. Misma convención que @/lib/acceso-horario.
 */
function hoyArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type PlanillaChofer = {
  chofer_id: string;
  nombre: string;
  apellido: string;
  /** Camión "habitual" del chofer (camiones.chofer_actual_id). */
  camion_habitual_id: string | null;
  /** Patente del camión "habitual" del chofer. */
  camion_habitual_patente: string | null;
  /** Camión asignado para la fecha consultada (asignacion_diaria). */
  camion_asignado_id: string | null;
  /** Camión que el chofer tenía ANTES de la planilla de esa fecha. Si difiere del
   *  asignado, ese día hubo un cambio de unidad y se marca en la grilla. */
  camion_previo_id: string | null;
  camion_previo_patente: string | null;
  observaciones: string | null;
};

export type PlanillaCamion = {
  id: string;
  /** Patente del camión. */
  label: string;
  /** false = dado de baja. Sólo aparece en el historial, donde se muestra la
   *  patente de lo que se manejó ese día aunque hoy la unidad no exista más. */
  activo: boolean;
  /** Patente del semi/acoplado enganchado hoy, para poder nombrar el equipo
   *  completo ("AA696BJ · AA373XW") en la lista de equipos sin chofer. */
  acoplado: string | null;
};

export type PlanillaDiariaData = {
  fecha: string;
  /** Fecha de hoy (ISO). */
  hoy: string;
  /** Solo la planilla de HOY se edita: cambiarla reescribe la asignación fija.
   *  Las otras fechas son historial de solo lectura. */
  editable: boolean;
  choferes: PlanillaChofer[];
  camiones: PlanillaCamion[];
  guardado_por?: string | null;
  guardado_el?: string | null;
  /** Días con planilla guardada (se marcan en el calendario). */
  fechas_guardadas?: string[];
  /** Días en los que además hubo al menos un cambio de camión. */
  fechas_con_cambios?: string[];
  /** Última fecha con planilla guardada anterior a la que se está viendo. */
  fecha_anterior?: string | null;
  /** false = no hay ninguna planilla vigente para esa fecha (es anterior a la
   *  primera que se guardó, así que no sabemos qué manejaba cada chofer). */
  hay_planilla?: boolean;
  /** Si ese día no se guardó planilla propia, la fecha de la que sigue vigente. */
  vigente_desde?: string | null;
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
  const hoy = hoyArgentina();
  const editable = fecha === hoy;

  const supabase = createAdminClient();
  const [choferesRes, camionesRes, asignacionesRes, fechasRes, vinculosRes, acopladosRes] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      // Solo choferes (no administración, mantenimiento ni fleteros). Null = chofer,
      // misma definición que la tarjeta "Choferes" del legajo.
      .or("rol.is.null,rol.eq.chofer")
      .order("apellido", { ascending: true }),
    // Traemos también los camiones dados de baja: el camión ANTERIOR de un chofer
    // puede ser uno que ya no está activo y igual queremos mostrar su patente.
    supabase
      .from("camiones")
      .select("id, patente, estado, chofer_actual_id")
      .order("patente", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id, camion_anterior_id, cambio, observaciones")
      .eq("fecha", fecha),
    // Vista agregada: 1 fila por día. Traer la tabla entera se truncaba en las
    // 1000 filas de PostgREST (~17 días con 60 choferes) y el calendario mentía.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("v_planilla_diaria_fechas")
      .select("fecha, hubo_cambios")
      .order("fecha", { ascending: false })
      .limit(1000),
    supabase.from("camion_acoplados").select("camion_id, acoplado_id").is("hasta", null),
    supabase.from("acoplados").select("id, patente"),
  ]);

  if (choferesRes.error || camionesRes.error) {
    return { error: "No se pudieron cargar los datos de la planilla." };
  }

  const habitualPorChofer = new Map<string, string>();
  const patentePorCamion = new Map<string, string>();
  for (const cam of camionesRes.data ?? []) {
    patentePorCamion.set(cam.id, cam.patente);
    const chid = (cam as { chofer_actual_id?: string | null }).chofer_actual_id;
    if (chid) habitualPorChofer.set(chid, cam.id);
  }

  // Qué semi/acoplado lleva enganchado cada camión hoy (vínculo abierto).
  const patenteAcoplado = new Map<string, string>();
  for (const a of acopladosRes.data ?? []) patenteAcoplado.set(a.id, a.patente);
  const acopladoPorCamion = new Map<string, string>();
  for (const v of vinculosRes.data ?? []) {
    if (acopladoPorCamion.has(v.camion_id)) continue;
    const pat = patenteAcoplado.get(v.acoplado_id);
    if (pat) acopladoPorCamion.set(v.camion_id, pat);
  }

  // Días con planilla guardada y, de esos, cuáles tuvieron algún cambio de camión.
  const guardadas = new Set<string>();
  const conCambios = new Set<string>();
  for (const f of (fechasRes?.data ?? []) as { fecha: string; hubo_cambios: boolean | null }[]) {
    guardadas.add(f.fecha);
    if (f.hubo_cambios) conCambios.add(f.fecha);
  }
  const fecha_anterior =
    [...guardadas].filter((f) => f < fecha).sort().pop() ?? null;

  type AsigRow = {
    chofer_id: string;
    /** null = ese día el chofer quedó sin unidad. */
    camion_id: string | null;
    camion_anterior_id: string | null;
    cambio: boolean | null;
    observaciones: string | null;
  };
  const asigPorChofer = new Map<string, AsigRow>();
  for (const a of (asignacionesRes.data ?? []) as AsigRow[]) {
    asigPorChofer.set(a.chofer_id, a);
  }

  // La planilla se ARRASTRA: mientras no se cambie nada, sigue rigiendo la última
  // guardada. Así que un día sin planilla propia no está "sin asignar" — muestra
  // la vigente, y ningún chofer figura como cambio (el cambio pasó otro día).
  const propia = asigPorChofer.size > 0;
  let vigente_desde: string | null = null;
  if (!editable && !propia && fecha_anterior) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: vigenteRows } = await (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id, observaciones")
      .eq("fecha", fecha_anterior);
    for (const v of (vigenteRows ?? []) as {
      chofer_id: string;
      camion_id: string | null;
      observaciones: string | null;
    }[]) {
      asigPorChofer.set(v.chofer_id, {
        chofer_id: v.chofer_id,
        camion_id: v.camion_id,
        // Heredada: el camión venía de antes, así que no hubo cambio ESE día.
        camion_anterior_id: v.camion_id,
        cambio: false,
        observaciones: v.observaciones,
      });
    }
    if (asigPorChofer.size > 0) vigente_desde = fecha_anterior;
  }

  // Las planillas viejas (anteriores a esta función) no guardaban fila para el
  // chofer que quedaba sin unidad, así que para esos casos el "anterior" lo
  // sacamos de la última planilla guardada. Solo aplica si ese día EFECTIVAMENTE
  // hubo planilla: si no, cada chofer aparecería como "cambió a sin camión".
  const hayPlanilla = asigPorChofer.size > 0;
  const previoSnapshotAnterior = new Map<string, string>();
  const faltanFila = (choferesRes.data ?? []).some((c) => !asigPorChofer.has(c.id));
  if (!editable && propia && fecha_anterior && faltanFila) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prevRows } = await (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id")
      .eq("fecha", fecha_anterior);
    for (const p of (prevRows ?? []) as { chofer_id: string; camion_id: string | null }[]) {
      if (p.camion_id) previoSnapshotAnterior.set(p.chofer_id, p.camion_id);
    }
  }

  const choferes: PlanillaChofer[] = (choferesRes.data ?? []).map((c) => {
    const asig = asigPorChofer.get(c.id);
    const habitual = habitualPorChofer.get(c.id) ?? null;
    const habitualPatente = habitual ? patentePorCamion.get(habitual) ?? null : null;

    // HOY: la asignación fija manda (sincronizada con el legajo). Otras fechas:
    // lo que regía ese día (planilla propia o, si no hubo, la que venía vigente).
    const asignado = editable ? habitual : asig?.camion_id ?? null;

    // Referencia para marcar el cambio. Si el chofer tiene fila, el anterior real
    // quedó guardado al aplicar la planilla; si no la tiene, caemos a la planilla
    // previa. En cualquier otro caso el previo es el propio asignado (sin cambio).
    const previo = asig
      ? asig.camion_anterior_id
      : previoSnapshotAnterior.get(c.id) ?? asignado;

    return {
      chofer_id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      camion_habitual_id: habitual,
      camion_habitual_patente: habitualPatente,
      camion_asignado_id: asignado,
      camion_previo_id: previo,
      camion_previo_patente: previo ? patentePorCamion.get(previo) ?? null : null,
      observaciones: asig?.observaciones ?? null,
    };
  });

  // Obtenemos los metadatos de edición del snapshot de ese día si no es hoy
  let guardado_por: string | null = null;
  let guardado_el: string | null = null;
  
  const fechaVigente = propia ? fecha : vigente_desde;
  if (!editable && fechaVigente) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: metaData } = await (supabase as any)
      .from("asignacion_diaria")
      .select(`
        updated_at,
        usuarios!updated_by (nombre, apellido)
      `)
      .eq("fecha", fechaVigente)
      .limit(1)
      .maybeSingle();

    const editor = metaData?.usuarios;
    guardado_por = editor
      ? [editor.nombre, editor.apellido].filter(Boolean).join(" ").trim() || null
      : null;
    guardado_el = metaData?.updated_at ?? null;
  }

  return {
    fecha,
    hoy,
    editable,
    choferes,
    // Solo camiones activos: son los únicos elegibles. En el historial (solo
    // lectura) sumamos los que aparecen en esa planilla aunque hoy estén de baja,
    // porque si no el selector de esa fecha se vería en blanco.
    camiones: (camionesRes.data ?? [])
      .filter((c) => {
        if ((c as { estado?: string | null }).estado === "activo") return true;
        if (editable) return false;
        return choferes.some(
          (ch) => ch.camion_asignado_id === c.id || ch.camion_previo_id === c.id,
        );
      })
      .map((c) => ({
        id: c.id,
        label: c.patente,
        activo: (c as { estado?: string | null }).estado === "activo",
        acoplado: acopladoPorCamion.get(c.id) ?? null,
      })),
    guardado_por,
    guardado_el,
    fechas_guardadas: [...guardadas],
    fechas_con_cambios: [...conCambios],
    fecha_anterior,
    hay_planilla: editable || hayPlanilla,
    vigente_desde,
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
  localidad: string;
};

/** Equipo que ese día no quedó con ningún chofer. */
export type PlanillaEquipoLibre = {
  tractor: string;
  acoplado: string;
};

export async function getPlanillaImpresionAction(
  fecha: string,
): Promise<
  | { fecha: string; rows: PlanillaImpresionRow[]; sinChofer: PlanillaEquipoLibre[] }
  | { error: string }
> {
  await requireArea("viajes", "read");
  if (!ISO.test(fecha)) return { error: "Fecha inválida." };

  const supabase = createAdminClient();
  const [choferesRes, camionesRes, asignacionesRes, vinculosRes, acopladosRes] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, cuil, localidad")
      .eq("estado", "activo")
      // Solo choferes (no administración, mantenimiento ni fleteros).
      .or("rol.is.null,rol.eq.chofer")
      .order("apellido", { ascending: true }),
    supabase.from("camiones").select("id, patente, chofer_actual_id").eq("estado", "activo"),
    // La planilla se arrastra: si ese día no se guardó una nueva, imprimimos la
    // que seguía vigente (la última guardada hasta esa fecha).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id, fecha")
      .lte("fecha", fecha)
      .order("fecha", { ascending: false })
      .limit(500),
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

  // Nos quedamos solo con la planilla vigente (la fecha más nueva del lote).
  const filasVigentes = (asignacionesRes.data ?? []) as {
    chofer_id: string;
    camion_id: string | null;
    fecha: string;
  }[];
  const fechaVigente = filasVigentes[0]?.fecha ?? null;
  const asigPorChofer = new Map<string, string | null>();
  for (const a of filasVigentes) {
    if (a.fecha === fechaVigente) asigPorChofer.set(a.chofer_id, a.camion_id);
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

  // Para hoy, un chofer sin fila todavía no tiene planilla guardada: mostramos su
  // camión habitual. Para una fecha pasada imprimimos exactamente lo que se guardó.
  const esHoy = fecha === hoyArgentina();

  /** Camiones que quedaron con alguien: lo que sobra son los equipos parados. */
  const asignados = new Set<string>();

  const rows: PlanillaImpresionRow[] = (choferesRes.data ?? []).map((c) => {
    // Ojo: `has` y no `??`, porque una fila con camion_id null significa "ese día
    // no manejó" y no debe caer al camión habitual.
    const camionId = asigPorChofer.has(c.id)
      ? asigPorChofer.get(c.id) ?? null
      : esHoy
        ? habitualPorChofer.get(c.id) ?? null
        : null;
    if (camionId) asignados.add(camionId);
    return {
      nombre: `${c.apellido} ${c.nombre}`.trim(),
      cuil: c.cuil ?? "",
      tractor: camionId ? patentePorCamion.get(camionId) ?? "" : "",
      acoplado: camionId ? acopladoPorCamion.get(camionId) ?? "" : "",
      localidad: c.localidad ?? "",
    };
  });

  // Equipos que quedan sin chofer (pedido de Nico, 31/08): con la hoja en la mano
  // hay que saber qué unidades quedaron paradas, y eso en la lista de choferes no
  // se ve — un camión sin nadie simplemente no aparece.
  const sinChofer: PlanillaEquipoLibre[] = (camionesRes.data ?? [])
    .filter((c) => !asignados.has(c.id))
    .map((c) => ({ tractor: c.patente, acoplado: acopladoPorCamion.get(c.id) ?? "" }))
    .sort((a, b) => a.tractor.localeCompare(b.tractor, "es"));

  return { fecha, rows, sinChofer };
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
  | { ok: true; guardadas: number; cambios: number }
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
  const hoy = hoyArgentina();
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

  // Foto del estado previo (asignación fija) para poder decir qué cambió: lo usa
  // el mensaje de confirmación y el registro de auditoría.
  const { data: camionesPrevios } = await supabase
    .from("camiones")
    .select("id, patente, chofer_actual_id");

  const patentePorCamion = new Map<string, string>();
  const camionPorChofer = new Map<string, string>();
  for (const c of camionesPrevios ?? []) {
    patentePorCamion.set(c.id, c.patente);
    const chid = (c as { chofer_actual_id?: string | null }).chofer_actual_id;
    if (chid) camionPorChofer.set(chid, c.id);
  }

  const { data: choferesNombre } = await supabase
    .from("choferes")
    .select("id, nombre, apellido")
    .in("id", items.map((i) => i.chofer_id));
  const nombrePorChofer = new Map<string, string>(
    (choferesNombre ?? []).map((c) => [
      c.id,
      `${c.apellido ?? ""}, ${c.nombre ?? ""}`.trim(),
    ]),
  );

  const cambios = items
    .filter((i) => (camionPorChofer.get(i.chofer_id) ?? null) !== (i.camion_id ?? null))
    .map((i) => {
      const antes = camionPorChofer.get(i.chofer_id) ?? null;
      return {
        chofer: nombrePorChofer.get(i.chofer_id) ?? i.chofer_id,
        de: antes ? patentePorCamion.get(antes) ?? antes : null,
        a: i.camion_id ? patentePorCamion.get(i.camion_id) ?? i.camion_id : null,
      };
    });

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

  if (cambios.length > 0) {
    // Un par antes/después por chofer: así el panel de auditoría lo muestra como
    // un diff legible ("Bustos: AD916TF → AE601GF") y no como "N elemento(s)".
    await logAudit({
      client: supabase,
      usuarioId: user.id,
      accion: "actualizar",
      entidadTipo: "planilla_diaria",
      valoresAnteriores: Object.fromEntries(
        cambios.map((c) => [c.chofer, c.de ?? "sin camión"]),
      ),
      valoresNuevos: Object.fromEntries(
        cambios.map((c) => [c.chofer, c.a ?? "sin camión"]),
      ),
      metadata: { origen: "planilla-diaria", fecha, cambios: cambios.length },
    });
  }

  revalidatePath("/viajes/planilla-diaria");
  // Las planillas abiertas en otras pantallas se enteran solas.
  await avisarCambio("planilla-diaria");
  revalidatePath("/viajes/carga-rapida");
  revalidatePath("/choferes");
  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/camiones");
  return { ok: true, guardadas, cambios: cambios.length };
}

export type PlanillaCambioRow = {
  id: string;
  fecha: string;
  chofer_nombre: string;
  /** Patente que tenía antes (null = no tenía camión asignado). */
  patente_anterior: string | null;
  /** Patente que pasó a manejar ese día (null = quedó sin unidad). */
  patente_nueva: string | null;
  observaciones: string | null;
  editor_nombre: string | null;
  editor_email: string | null;
  created_at: string;
};

/**
 * Todos los cambios de camión registrados en las planillas, del más nuevo al más
 * viejo. Alimenta el panel "Cambios de unidad" del historial: solo trae las filas
 * marcadas como cambio, no la planilla entera.
 */
export async function getPlanillaCambiosHistorialAction(): Promise<
  PlanillaCambioRow[] | { error: string }
> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("asignacion_diaria")
    .select(
      `
      id,
      fecha,
      observaciones,
      created_at,
      choferes (nombre, apellido),
      camiones!asignacion_diaria_camion_id_fkey (patente),
      anterior:camiones!asignacion_diaria_camion_anterior_id_fkey (patente),
      usuarios!updated_by (nombre, apellido, email)
    `,
    )
    .eq("cambio", true)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Error cargando los cambios de la planilla diaria:", error);
    return { error: "No se pudo cargar el historial de cambios." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
    const chofer = row.choferes;
    const editor = row.usuarios;

    return {
      id: row.id,
      fecha: row.fecha,
      chofer_nombre: chofer
        ? [chofer.apellido, chofer.nombre].filter(Boolean).join(", ").trim()
        : "Desconocido",
      patente_anterior: row.anterior?.patente ?? null,
      patente_nueva: row.camiones?.patente ?? null,
      observaciones: row.observaciones,
      editor_nombre: editor
        ? [editor.nombre, editor.apellido].filter(Boolean).join(" ").trim() || null
        : null,
      editor_email: editor?.email ?? null,
      created_at: row.created_at,
    };
  });
}
