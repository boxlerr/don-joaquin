"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { aniosCumplidos, diasPorAntiguedad } from "./derivar";
import { logChoferAudit } from "../audit";
import { logAudit } from "@/lib/audit";
import { UMBRAL_CLAVE, mergeUmbral, type UmbralConfig } from "./umbral";

/**
 * Guarda el umbral de ausentes por semana del cronograma. Va todo en una sola
 * fila JSON de `parametros_sistema` (mismo patrón que la config del ranking).
 * `mergeUmbral` normaliza antes de escribir, así lo guardado siempre es válido.
 */
export async function guardarUmbralConfigAction(config: UmbralConfig) {
  const user = await requireSeccion("choferes_vacaciones", "write");
  const supabase = createAdminClient();

  const limpia = mergeUmbral(config);
  // Se lee lo que había antes para poder auditar el cambio: sin el valor
  // anterior, el registro dice que alguien tocó el umbral pero no de cuánto
  // venía, y no sirve para explicar por qué una semana dejó de avisar.
  const { data: previo } = await supabase
    .from("parametros_sistema")
    .select("id, valor")
    .eq("clave", UMBRAL_CLAVE)
    .maybeSingle();

  const { error } = await supabase.from("parametros_sistema").upsert(
    {
      clave: UMBRAL_CLAVE,
      valor: JSON.stringify(limpia),
      tipo_dato: "json",
      categoria: "vacaciones",
      editable: true,
      updated_by: user.id,
    },
    { onConflict: "clave" },
  );
  if (error) {
    console.error("Error al guardar el umbral de vacaciones:", error);
    return { error: "No se pudo guardar el umbral de ausentes." };
  }

  await logAudit({
    accion: "actualizar",
    entidadTipo: "parametro_sistema",
    entidadId: previo?.id ?? UMBRAL_CLAVE,
    usuarioId: user.id,
    valoresAnteriores: previo?.valor ? { valor: previo.valor } : null,
    valoresNuevos: { valor: JSON.stringify(limpia) },
  });

  revalidatePath("/choferes/vacaciones");
  return { success: true };
}

/**
 * Recalcula los "días que corresponden" del año en curso según la antigüedad
 * actual de cada empleado (14/21/28/35) sobre `chofer_vacaciones_anios`. Crea la
 * fila del año a quien no la tenga (altas nuevas) y sólo toca a los desfasados;
 * los saldos de años anteriores no se modifican. Si se pasa `choferId`,
 * recalcula sólo ese.
 *
 * NO toca las filas con `origen = 'humano'`: un dato que cargó o corrigió una
 * persona no lo pisa ningún proceso automático. Hasta el 29/07/2026 este botón
 * reescribía la dotación entera de una pasada, así que una corrección a mano
 * (un arrastre acordado, un alta parcial) se perdía con un click.
 */
export async function recalcularDiasPorAntiguedadAction(choferId?: string) {
  const user = await requireSeccion("choferes_vacaciones", "write");
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
    .select("chofer_id, dias_correspondientes, origen")
    .eq("anio", anioActual);
  const actualMap = new Map<string, number>();
  const origenMap = new Map<string, string>();
  for (const f of (filas ?? []) as {
    chofer_id: string;
    dias_correspondientes: number;
    origen: string | null;
  }[]) {
    actualMap.set(f.chofer_id, f.dias_correspondientes ?? 0);
    if (f.origen) origenMap.set(f.chofer_id, f.origen);
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown>[] = [];
  const respetadas: { chofer_id: string; actual: number; propuesto: number }[] = [];
  for (const c of (choferes ?? []) as { id: string; fecha_ingreso: string | null }[]) {
    if (!c.fecha_ingreso) continue;
    const correcto = diasPorAntiguedad(aniosCumplidos(c.fecha_ingreso, anioActual));
    if (actualMap.get(c.id) === correcto) continue; // ya está bien
    // Filtrar ACÁ es obligatorio, no alcanza con el trigger de la base: el
    // upsert es masivo y una sola fila que explote aborta la sentencia entera,
    // así que no se actualizaría NINGUNA. El trigger es la red de seguridad para
    // el día que alguien olvide este filtro, no el camino feliz.
    if (origenMap.get(c.id) === "humano") {
      respetadas.push({ chofer_id: c.id, actual: actualMap.get(c.id) ?? 0, propuesto: correcto });
      continue;
    }
    updates.push({
      chofer_id: c.id,
      anio: anioActual,
      dias_correspondientes: correcto,
      // La procedencia vive en `origen`, no en el texto de la observación.
      observaciones: null,
      origen: "antiguedad",
      updated_by: user.id,
      updated_at: nowIso,
    });
  }

  // Registrar lo que NO se hizo es tan importante como registrar el cambio: sin
  // esto la regla funciona pero es invisible, y nadie puede probar después que
  // el sistema defendió el dato.
  if (respetadas.length > 0) {
    await Promise.all(
      respetadas.map((r) =>
        logChoferAudit(
          r.chofer_id,
          "vacaciones_saldo_protegido",
          { anio: anioActual, dias_correspondientes: r.actual },
          { anio: anioActual, dias_correspondientes_propuesto: r.propuesto, origen: "recalculo_antiguedad" },
          user.id,
          { tipo: "chofer_vacaciones_anio", id: `${r.chofer_id}:${anioActual}` },
        ),
      ),
    );
  }

  if (updates.length > 0) {
    const { error } = await sb
      .from("chofer_vacaciones_anios")
      .upsert(updates, { onConflict: "chofer_id,anio" });
    if (error) return { error: "No se pudieron recalcular los días por antigüedad." };

    // Un upsert masivo sobre toda la dotación tiene que quedar registrado: si
    // mañana aparece un saldo cambiado, esto explica quién y cuándo. En paralelo
    // porque puede ser toda la dotación (~78) y en serie se come el timeout.
    await Promise.all(
      updates.map((u) =>
        logChoferAudit(
          u.chofer_id as string,
          "vacaciones_saldo_editado",
          { anio: anioActual, dias_correspondientes: actualMap.get(u.chofer_id as string) ?? null },
          { anio: anioActual, dias_correspondientes: u.dias_correspondientes, origen: "recalculo_antiguedad" },
          user.id,
          { tipo: "chofer_vacaciones_anio", id: `${u.chofer_id as string}:${anioActual}` },
        ),
      ),
    );
  }

  revalidatePath("/choferes/vacaciones");
  revalidatePath("/choferes/[slug]", "page");
  return { success: true, actualizados: updates.length, respetados: respetadas.length };
}
