"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { buscarTarifa, calcularLitros } from "@/domain/gasoil/litros-por-tonelada";
import { buscarRepetida, TOPE_DIARIO_POR_CHOFER } from "@/domain/gasoil/enlace";
import { partesArgentinas } from "@/domain/gasoil/reporte";
import { leerTarifas, leerChoferesDelEnlace } from "@/app/gasoil/[token]/datos";
import type { ResultadoAnotar } from "./tipos";

/**
 * Lo que anota el chofer desde el enlace público.
 *
 * **Esta acción vive del otro lado de la puerta**: la URL no pide sesión, así que
 * acá no hay un `requireArea` que haya verificado nada antes. Todo lo que llega
 * es un dato que mandó un navegador cualquiera, y todo se vuelve a verificar
 * contra la base antes de escribir una fila:
 *
 *   1. El token existe y está activo. Si la oficina lo rotó, se corta acá.
 *   2. El chofer existe, sigue activo y es chofer o fletero. Un egresado no
 *      autoriza gasoil aunque tenga el enlace guardado en el teléfono.
 *   3. El tramo está en el cuadro y **los litros se calculan de nuevo** con la
 *      tarifa vigente. Lo que dijo la pantalla no se guarda: se recalcula.
 *   4. No se pasó del tope diario.
 *   5. No es la misma vuelta anotada hace un rato.
 *
 * El mensaje de error se le muestra tal cual al chofer, así que está escrito
 * para él y no para un log: tiene que poder leerlo en la playa y saber si vuelve
 * a intentar o si tiene que llamar a la oficina.
 */
export async function anotarVueltaChoferAction(input: {
  token: string;
  choferId: string;
  origenId: string;
  destinoId: string;
  toneladas: number;
}): Promise<ResultadoAnotar> {
  const supabase = createAdminClient();

  // ── 1) El enlace ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enlace } = await (supabase as any)
    .from("gasoil_enlace")
    .select("id, activo")
    .eq("token", input.token)
    .eq("activo", true)
    .maybeSingle();
  if (!enlace) {
    return {
      ok: false,
      mensaje: "Este enlace ya no sirve. Pedile el nuevo a la oficina.",
    };
  }

  // ── 2) El chofer ───────────────────────────────────────────────────────────
  const choferes = await leerChoferesDelEnlace(supabase);
  const chofer = choferes.find((c) => c.id === input.choferId);
  if (!chofer) {
    return {
      ok: false,
      mensaje: "No te encontramos en la lista. Volvé a elegir tu nombre y probá de nuevo.",
    };
  }

  // ── 3) La cuenta, hecha de nuevo acá ───────────────────────────────────────
  const tarifas = await leerTarifas(supabase);
  const tarifa = buscarTarifa(tarifas, input.origenId, input.destinoId);
  const calculo = calcularLitros(tarifa, input.toneladas);
  if (!calculo.ok) return { ok: false, mensaje: calculo.mensaje };

  // ── 4) Lo que ya anotó hoy ─────────────────────────────────────────────────
  const ahora = new Date();
  const hoy = partesArgentinas(ahora).fecha;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: delDia } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .select("id, created_at, origen_id, destino_id, toneladas, litros")
    .eq("chofer_id", chofer.id)
    .gte("created_at", `${hoy}T00:00:00-03:00`)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (delDia ?? []) as any[];

  if (filas.length >= TOPE_DIARIO_POR_CHOFER) {
    return {
      ok: false,
      mensaje: `Ya anotaste ${filas.length} vueltas hoy. Si está bien, llamá a la oficina para que la carguen ellos.`,
    };
  }

  // ── 5) La misma vuelta, dos veces ──────────────────────────────────────────
  const repetida = buscarRepetida(
    filas,
    { origenId: input.origenId, destinoId: input.destinoId, toneladas: calculo.toneladas },
    ahora,
  );
  if (repetida) {
    // No es un error y no se le dice que falló: se le devuelve la vuelta que ya
    // tiene anotada. Para el chofer el resultado es el mismo —sabe cuántos
    // litros puede cargar— y en la base no quedan dos filas por un doble toque.
    return {
      ok: true,
      vuelta: {
        litros: Number(repetida.litros) || calculo.litros,
        litrosPorTonelada: calculo.litrosPorTonelada,
        toneladas: calculo.toneladas,
        cantera: tarifa!.origen,
        destino: tarifa!.destino,
        yaEstaba: true,
      },
    };
  }

  // ── 6) A la base ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .insert({
      chofer_id: chofer.id,
      origen_id: input.origenId,
      destino_id: input.destinoId,
      toneladas: calculo.toneladas,
      litros_por_tonelada: calculo.litrosPorTonelada,
      litros: calculo.litros,
      cargada_por_chofer: true,
      // `created_by` queda en NULL: del otro lado del enlace no hay un usuario
      // del sistema. Quién fue lo dice `chofer_id` + `cargada_por_chofer`.
      created_by: null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al anotar la vuelta del chofer:", error);
    return {
      ok: false,
      mensaje: "No se pudo guardar. Fijate que tengas señal y probá de nuevo.",
    };
  }

  // La auditoría guarda de dónde vino: es lo único que queda para reconstruir
  // una vuelta que después nadie reconozca.
  const cabeceras = await headers();
  await logAudit({
    client: supabase,
    usuarioId: null,
    accion: "crear",
    entidadTipo: "gasoil_autorizacion",
    entidadId: data?.id ?? null,
    valoresNuevos: {
      chofer_id: chofer.id,
      toneladas: calculo.toneladas,
      litros: calculo.litros,
      litros_por_tonelada: calculo.litrosPorTonelada,
      cargada_por_chofer: true,
    },
    metadata: { via: "enlace_chofer", chofer: chofer.nombre },
    ip: cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: cabeceras.get("user-agent"),
  });

  return {
    ok: true,
    vuelta: {
      litros: calculo.litros,
      litrosPorTonelada: calculo.litrosPorTonelada,
      toneladas: calculo.toneladas,
      cantera: tarifa!.origen,
      destino: tarifa!.destino,
      yaEstaba: false,
    },
  };
}
