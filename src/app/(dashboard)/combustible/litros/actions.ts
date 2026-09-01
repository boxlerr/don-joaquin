"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  calcularLitros,
  buscarTarifa,
  type TarifaGasoil,
} from "@/domain/gasoil/litros-por-tonelada";

/**
 * El gasoil que le corresponde a la vuelta.
 *
 * Las dos tablas son nuevas y todavía no están en `database.ts` generado, así
 * que el cliente va tipado como `any` — mismo criterio que `form931_presentaciones`
 * y `rotacion_bajas`.
 */

export type ChoferOpcion = { id: string; nombre: string };

export type AutorizacionRow = {
  id: string;
  created_at: string;
  chofer: string | null;
  origen: string;
  destino: string;
  toneladas: number;
  litros_por_tonelada: number;
  litros: number;
  observaciones: string | null;
  cargadoPor: string | null;
};

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

  revalidatePath("/combustible/litros");
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

  revalidatePath("/combustible/litros");
  return { ok: true };
}

/** ¿Esta persona puede autorizar y cambiar el cuadro, o sólo mirar? */
export async function puedeEditarGasoilAction(): Promise<boolean> {
  const user = await requireArea("combustible", "read");
  return hasArea(user, "combustible", "write");
}
