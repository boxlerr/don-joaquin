"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { traerTodo } from "@/lib/supabase/traer-todo";
import { revalidatePath } from "next/cache";
import {
  calcularLitros,
  buscarTarifa,
  type TarifaGasoil,
} from "@/domain/gasoil/litros-por-tonelada";
import {
  armarReporte,
  bordesDelMesAr,
  mesAnterior,
  partesArgentinas,
  totales,
  type AutorizacionCruda,
  type CargaCruda,
  type ReporteAutoconsumo,
} from "@/domain/gasoil/reporte";
import { hoyArgentina } from "@/lib/fecha-ar";
import type { AutorizacionRow, ChoferOpcion } from "./tipos";

/**
 * El gasoil que le corresponde a la vuelta.
 *
 * Las dos tablas son nuevas y todavía no están en `database.ts` generado, así
 * que el cliente va tipado como `any` — mismo criterio que `form931_presentaciones`
 * y `rotacion_bajas`.
 *
 * Los tipos que exporta este módulo viven en `./tipos` y en `@/domain/gasoil/*`:
 * acá adentro sólo pueden salir funciones async.
 */

/** El cuadro de tarifas, ya resuelto a nombres. */
export async function getTarifasGasoilAction(): Promise<TarifaGasoil[]> {
  await requireArea("combustible", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("gasoil_tarifas")
    .select(
      "id, origen_id, destino_id, litros_por_tonelada, origen:puntos_ruta!gasoil_tarifas_origen_id_fkey(nombre), destino:puntos_ruta!gasoil_tarifas_destino_id_fkey(nombre)",
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((r) => {
      const o = Array.isArray(r.origen) ? r.origen[0] : r.origen;
      const d = Array.isArray(r.destino) ? r.destino[0] : r.destino;
      return {
        origenId: String(r.origen_id),
        destinoId: String(r.destino_id),
        origen: String(o?.nombre ?? "—"),
        destino: String(d?.nombre ?? "—"),
        litrosPorTonelada: Number(r.litros_por_tonelada) || 0,
      };
    })
    .filter((t) => t.litrosPorTonelada > 0);
}

/** Los choferes a los que se les puede autorizar gasoil: los que están trabajando. */
export async function getChoferesParaGasoilAction(): Promise<ChoferOpcion[]> {
  await requireArea("combustible", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, estado, rol")
    .eq("estado", "activo")
    .order("apellido");

  return (data ?? [])
    // Un egresado no vuelve de un viaje: ofrecerlo es ofrecer un error.
    .filter((c) => (c.rol ?? "chofer") === "chofer" || (c.rol ?? "") === "fletero")
    .map((c) => ({
      id: String(c.id),
      nombre: [c.apellido, c.nombre].filter(Boolean).join(" ").trim() || "(sin nombre)",
    }));
}

/** Lo último que se autorizó. Es la memoria de la pantalla, no un reporte. */
export async function getAutorizacionesAction(limite = 25): Promise<AutorizacionRow[]> {
  await requireArea("combustible", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .select(
      "id, created_at, toneladas, litros_por_tonelada, litros, observaciones, chofer:choferes(nombre, apellido), origen:puntos_ruta!gasoil_autorizaciones_origen_id_fkey(nombre), destino:puntos_ruta!gasoil_autorizaciones_destino_id_fkey(nombre), usuario:usuarios(nombre, apellido)",
    )
    .order("created_at", { ascending: false })
    .limit(limite);

  const uno = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, string> | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => {
    const ch = uno(r.chofer);
    const us = uno(r.usuario);
    return {
      id: String(r.id),
      created_at: String(r.created_at),
      chofer: ch ? [ch.apellido, ch.nombre].filter(Boolean).join(" ").trim() : null,
      origen: String(uno(r.origen)?.nombre ?? "—"),
      destino: String(uno(r.destino)?.nombre ?? "—"),
      toneladas: Number(r.toneladas) || 0,
      litros_por_tonelada: Number(r.litros_por_tonelada) || 0,
      litros: Number(r.litros) || 0,
      observaciones: r.observaciones ?? null,
      cargadoPor: us ? [us.nombre, us.apellido].filter(Boolean).join(" ").trim() : null,
    };
  });
}

/**
 * Guarda lo que se le autorizó a un chofer.
 *
 * **La cuenta se rehace acá y no se confía en la del navegador.** Lo que manda
 * el cliente son las toneladas y el tramo; los litros salen de la tarifa que hay
 * en la base en este momento. Si alguien edita el número en la pantalla, se
 * guarda igual lo que corresponde.
 */
export async function guardarAutorizacionAction(input: {
  choferId: string | null;
  origenId: string;
  destinoId: string;
  toneladas: number;
  observaciones?: string;
}): Promise<{ ok: true; litros: number } | { error: string }> {
  const user = await requireArea("combustible", "write");
  const supabase = createAdminClient();

  // El chofer es obligatorio. La columna es nullable —hay que poder cargar un
  // histórico sin dueño— pero una autorización nueva sin chofer no sirve para
  // nada: el reporte que hay que presentarle a YPF se arma POR CHOFER, y una
  // fila anónima es una fila que después no se puede cruzar con nada.
  if (!input.choferId) return { error: "Elegí a qué chofer se le autoriza." };

  const tarifas = await getTarifasGasoilAction();
  const tarifa = buscarTarifa(tarifas, input.origenId, input.destinoId);
  const calculo = calcularLitros(tarifa, input.toneladas);
  if (!calculo.ok) return { error: calculo.mensaje };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .insert({
      chofer_id: input.choferId || null,
      origen_id: input.origenId,
      destino_id: input.destinoId,
      toneladas: calculo.toneladas,
      litros_por_tonelada: calculo.litrosPorTonelada,
      litros: calculo.litros,
      observaciones: input.observaciones?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al guardar la autorización de gasoil:", error);
    return { error: "No se pudo guardar." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "gasoil_autorizacion",
    entidadId: data?.id ?? null,
    valoresNuevos: {
      chofer_id: input.choferId,
      toneladas: calculo.toneladas,
      litros: calculo.litros,
      litros_por_tonelada: calculo.litrosPorTonelada,
    },
  });

  revalidatePath("/combustible/autoconsumo");
  return { ok: true, litros: calculo.litros };
}

/**
 * Cambia el rinde de un tramo.
 *
 * Los valores del cuadro no son nuestros: los pone la oficina y cambian con el
 * precio y con los consumos reales. Lo ya autorizado no se toca — cada
 * autorización guarda su coeficiente congelado.
 */
export async function guardarTarifaAction(input: {
  origenId: string;
  destinoId: string;
  litrosPorTonelada: number;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("combustible", "write");
  const supabase = createAdminClient();

  const ltn = Number(input.litrosPorTonelada);
  if (!Number.isFinite(ltn) || ltn <= 0) return { error: "El rinde tiene que ser mayor que cero." };
  if (ltn > 1000) return { error: "Ese rinde no parece de litros por tonelada." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("gasoil_tarifas")
    .select("id, litros_por_tonelada")
    .eq("origen_id", input.origenId)
    .eq("destino_id", input.destinoId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("gasoil_tarifas").upsert(
    {
      ...(previo?.id ? { id: previo.id } : {}),
      origen_id: input.origenId,
      destino_id: input.destinoId,
      litros_por_tonelada: ltn,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      ...(previo?.id ? {} : { created_by: user.id }),
    },
    { onConflict: "origen_id,destino_id" },
  );

  if (error) {
    console.error("Error al guardar el rinde:", error);
    return { error: "No se pudo guardar el rinde." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: previo ? "actualizar" : "crear",
    entidadTipo: "gasoil_tarifa",
    entidadId: previo?.id ?? null,
    valoresAnteriores: previo ? { litros_por_tonelada: previo.litros_por_tonelada } : undefined,
    valoresNuevos: { litros_por_tonelada: ltn },
  });

  revalidatePath("/combustible/autoconsumo");
  return { ok: true };
}

/** ¿Esta persona puede autorizar y cambiar el cuadro, o sólo mirar? */
export async function puedeEditarGasoilAction(): Promise<boolean> {
  const user = await requireArea("combustible", "read");
  return hasArea(user, "combustible", "write");
}

/**
 * Corregir una autorización ya anotada.
 *
 * Se rehace la cuenta con la tarifa vigente: si se corrigen las toneladas, los
 * litros tienen que salir de nuevo. Lo que NO se rehace es el resto del
 * histórico — cada fila guarda su propio coeficiente.
 */
export async function editarAutorizacionAction(
  id: string,
  input: {
    choferId: string | null;
    origenId: string;
    destinoId: string;
    toneladas: number;
    observaciones?: string;
  },
): Promise<{ ok: true; litros: number } | { error: string }> {
  const user = await requireArea("combustible", "write");
  const supabase = createAdminClient();

  if (!input.choferId) return { error: "Elegí a qué chofer se le autoriza." };

  const tarifas = await getTarifasGasoilAction();
  const tarifa = buscarTarifa(tarifas, input.origenId, input.destinoId);
  const calculo = calcularLitros(tarifa, input.toneladas);
  if (!calculo.ok) return { error: calculo.mensaje };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .select("chofer_id, origen_id, destino_id, toneladas, litros_por_tonelada, litros, observaciones")
    .eq("id", id)
    .maybeSingle();
  if (!previo) return { error: "Esa autorización ya no está." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .update({
      chofer_id: input.choferId,
      origen_id: input.origenId,
      destino_id: input.destinoId,
      toneladas: calculo.toneladas,
      litros_por_tonelada: calculo.litrosPorTonelada,
      litros: calculo.litros,
      observaciones: input.observaciones?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error al editar la autorización de gasoil:", error);
    return { error: "No se pudo guardar el cambio." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "gasoil_autorizacion",
    entidadId: id,
    valoresAnteriores: previo,
    valoresNuevos: {
      chofer_id: input.choferId,
      origen_id: input.origenId,
      destino_id: input.destinoId,
      toneladas: calculo.toneladas,
      litros_por_tonelada: calculo.litrosPorTonelada,
      litros: calculo.litros,
      observaciones: input.observaciones?.trim() || null,
    },
  });

  revalidatePath("/combustible/autoconsumo");
  return { ok: true, litros: calculo.litros };
}

/**
 * Borrar una autorización.
 *
 * Borrado real y no lápida: no cuelga nada de esta fila, y lo que hay que poder
 * reconstruir —qué decía antes de desaparecer— queda entero en `audit_log`, que
 * guarda los valores anteriores.
 */
export async function eliminarAutorizacionAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("combustible", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!previo) return { error: "Esa autorización ya no está." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("gasoil_autorizaciones").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar la autorización de gasoil:", error);
    return { error: "No se pudo eliminar." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "gasoil_autorizacion",
    entidadId: id,
    valoresAnteriores: previo,
  });

  revalidatePath("/combustible/autoconsumo");
  return { ok: true };
}

/** Borrar el rinde de un tramo. Queda el hueco visible en el cuadro. */
export async function eliminarTarifaAction(
  origenId: string,
  destinoId: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("combustible", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("gasoil_tarifas")
    .select("id, litros_por_tonelada")
    .eq("origen_id", origenId)
    .eq("destino_id", destinoId)
    .maybeSingle();
  if (!previo) return { error: "Ese tramo no tiene rinde cargado." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("gasoil_tarifas").delete().eq("id", previo.id);
  if (error) {
    console.error("Error al eliminar el rinde:", error);
    return { error: "No se pudo eliminar el rinde." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "gasoil_tarifa",
    entidadId: previo.id,
    valoresAnteriores: previo,
  });

  revalidatePath("/combustible/autoconsumo");
  return { ok: true };
}

// ── El reporte para YPF ──────────────────────────────────────────────────────

/**
 * El reporte de autoconsumo del mes, en el formato del que manda YPF.
 *
 * Se arma de lo que se autorizó, agrupado por tramo —que es exactamente cómo YPF
 * presenta su cuadro (cantera → locación → tn → litros teóricos)— y se le suman
 * los cortes que ellos no pueden hacer: el día a día, el acumulado contra lo
 * cargado en el surtidor y el detalle por chofer.
 *
 * Tres cosas que no son detalle:
 *
 *  * **El mes se recorta con el huso argentino adentro** (`bordesDelMesAr`). Sin
 *    eso, `'2026-09-01'` se lee como medianoche UTC y el mes queda corrido tres
 *    horas: entra la vuelta del 31 de agosto a la noche y se cae la del 30 de
 *    septiembre después de las 21.
 *  * **Se pagina con `traerTodo`.** Junio 2026 ya tiene 311 cargas; el corte de
 *    1000 filas de PostgREST no avisa, y un total que llega de menos en un papel
 *    que se le entrega al cliente es peor que un error.
 *  * **`litrosCargados` es `null` y no `0`** cuando no hay ninguna carga en el
 *    mes. Cero litros cargados sería un desvío del −100 %.
 */
export async function getReporteAutoconsumoAction(mes: string): Promise<ReporteAutoconsumo> {
  await requireArea("combustible", "read");
  const supabase = createAdminClient();

  const [autorizaciones, cargas, previo] = await Promise.all([
    leerAutorizacionesDelMes(supabase, mes),
    leerCargasDelMes(supabase, mes),
    leerTotalesDelMes(supabase, mesAnterior(mes)),
  ]);

  return armarReporte({ mes, autorizaciones, cargas, previo, hoy: hoyArgentina() });
}

/** Las vueltas autorizadas del mes, ya resueltas a nombres y a hora argentina. */
async function leerAutorizacionesDelMes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  mes: string,
): Promise<AutorizacionCruda[]> {
  const { desde, hasta } = bordesDelMesAr(mes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = await traerTodo<any>(
    (d, h) =>
      supabase
        .from("gasoil_autorizaciones")
        .select(
          "id, created_at, toneladas, litros_por_tonelada, litros, observaciones, chofer:choferes(nombre, apellido), origen:puntos_ruta!gasoil_autorizaciones_origen_id_fkey(nombre), destino:puntos_ruta!gasoil_autorizaciones_destino_id_fkey(nombre)",
        )
        .gte("created_at", desde)
        .lt("created_at", hasta)
        .order("id")
        .range(d, h),
    { etiqueta: "autorizaciones de gasoil del mes" },
  );

  const uno = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, string> | null;

  return filas.map((r) => {
    const ch = uno(r.chofer);
    const { fecha, hora } = partesArgentinas(String(r.created_at));
    return {
      id: String(r.id),
      fecha,
      hora,
      chofer: ch ? [ch.apellido, ch.nombre].filter(Boolean).join(" ").trim() || null : null,
      cantera: String(uno(r.origen)?.nombre ?? "—"),
      destino: String(uno(r.destino)?.nombre ?? "—"),
      toneladas: Number(r.toneladas) || 0,
      litrosPorTonelada: Number(r.litros_por_tonelada) || 0,
      litros: Number(r.litros) || 0,
      observaciones: r.observaciones ?? null,
    };
  });
}

/** Lo que efectivamente se cargó en el surtidor durante el mes. */
async function leerCargasDelMes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  mes: string,
): Promise<CargaCruda[]> {
  const { desde, hasta } = bordesDelMesAr(mes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = await traerTodo<any>(
    (d, h) =>
      supabase
        .from("cargas_combustible")
        .select("id, fecha, litros")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("id")
        .range(d, h),
    { etiqueta: "cargas de combustible del mes" },
  );

  return filas.map((r) => ({
    fecha: partesArgentinas(String(r.fecha)).fecha,
    litros: Number(r.litros) || 0,
  }));
}

/**
 * Los totales de un mes, sin el detalle. Es lo que se usa para el mes anterior:
 * no hace falta traerse las filas enteras para poner un "vs. agosto" al lado.
 */
async function leerTotalesDelMes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  mes: string,
) {
  const [autorizaciones, cargas] = await Promise.all([
    leerAutorizacionesDelMes(supabase, mes),
    leerCargasDelMes(supabase, mes),
  ]);
  if (autorizaciones.length === 0 && cargas.length === 0) return null;
  return totales(autorizaciones, cargas);
}
