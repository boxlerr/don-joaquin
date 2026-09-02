"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { buscarTarifa, calcularLitros } from "@/domain/gasoil/litros-por-tonelada";
import { buscarRepetida, TOPE_DIARIO_POR_CHOFER } from "@/domain/gasoil/enlace";
import { partesArgentinas } from "@/domain/gasoil/reporte";
import {
  enlaceActivo,
  leerTarifas,
  leerChoferesDelEnlace,
  leerVueltasDelChofer,
} from "@/app/gasoil/[token]/datos";
import type { ResultadoAnotar, ResultadoCarga } from "./tipos";

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
  /** Los que ya traía cargados antes de cargar la arena. Opcional. */
  litrosPrevios?: number | null;
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

  // Los litros que ya traía. Van como una carga más, marcada `previa`: para el
  // saldo cuentan igual, y hay que poder distinguirlas de las que hizo durante
  // el viaje. Si esto falla, la vuelta ya quedó guardada y es lo que importa —
  // el chofer puede volver a anotar la carga desde la misma pantalla.
  const previos = Number(input.litrosPrevios) || 0;
  if (previos > 0 && data?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errPrevia } = await (supabase as any)
      .from("gasoil_cargas_declaradas")
      .insert({ autorizacion_id: data.id, litros: previos, previa: true });
    if (errPrevia) console.error("No se pudo guardar la carga previa:", errPrevia);
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


/**
 * Las vueltas del chofer, con lo que lleva cargado en cada una.
 *
 * Es lo primero que ve apenas se identifica. Pide el token igual que todo lo
 * demás: sin él, esta acción sería una forma de leerle el historial a cualquier
 * chofer sabiendo su id.
 */
export async function misVueltasAction(input: {
  token: string;
  choferId: string;
}): Promise<ResultadoCarga> {
  const supabase = createAdminClient();

  if (!(await enlaceActivo(supabase, input.token))) {
    return { ok: false, mensaje: "Este enlace ya no sirve. Pedile el nuevo a la oficina." };
  }
  const choferes = await leerChoferesDelEnlace(supabase);
  if (!choferes.some((c) => c.id === input.choferId)) {
    return { ok: false, mensaje: "No te encontramos en la lista. Volvé a elegir tu nombre." };
  }

  return { ok: true, vueltas: await leerVueltasDelChofer(supabase, input.choferId) };
}

/**
 * El chofer anota que cargó gasoil.
 *
 * **Lo que se guarda acá no es el registro oficial**: ese sale del reporte de
 * YPF, que llega a día vencido. Esto es lo que él dice que cargó, y sirve para
 * dos cosas: mostrarle el saldo en el momento —que es lo único que le importa
 * parado en el surtidor— y poder cruzar después las dos versiones.
 *
 * Se verifica que la vuelta sea suya: sin eso, con el token y un id ajeno se le
 * podrían anotar litros a cualquiera.
 */
export async function anotarCargaChoferAction(input: {
  token: string;
  choferId: string;
  autorizacionId: string;
  litros: number;
}): Promise<ResultadoCarga> {
  const supabase = createAdminClient();

  if (!(await enlaceActivo(supabase, input.token))) {
    return { ok: false, mensaje: "Este enlace ya no sirve. Pedile el nuevo a la oficina." };
  }

  const litros = Number(input.litros);
  if (!Number.isFinite(litros) || litros <= 0) {
    return { ok: false, mensaje: "Poné cuántos litros cargaste." };
  }
  // Tope de cordura, no una regla del negocio: el tanque más grande de la flota
  // no llega a 1.000 y el 4350 sale de tipear 435 con el dedo resbalado.
  if (litros > 1500) {
    return { ok: false, mensaje: `${litros} litros no entran en un tanque. ¿No te sobró un número?` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vuelta } = await (supabase as any)
    .from("gasoil_autorizaciones")
    .select("id, chofer_id")
    .eq("id", input.autorizacionId)
    .maybeSingle();

  if (!vuelta || vuelta.chofer_id !== input.choferId) {
    return { ok: false, mensaje: "Esa vuelta no es tuya. Volvé a abrir el enlace." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nueva, error } = await (supabase as any)
    .from("gasoil_cargas_declaradas")
    .insert({ autorizacion_id: input.autorizacionId, litros, previa: false })
    .select("id")
    .single();

  if (error) {
    console.error("Error al anotar la carga del chofer:", error);
    return { ok: false, mensaje: "No se pudo guardar. Fijate que tengas señal y probá de nuevo." };
  }

  const cabeceras = await headers();
  await logAudit({
    client: supabase,
    usuarioId: null,
    accion: "crear",
    entidadTipo: "gasoil_carga_declarada",
    entidadId: nueva?.id ?? null,
    valoresNuevos: { autorizacion_id: input.autorizacionId, litros },
    metadata: { via: "enlace_chofer" },
    ip: cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: cabeceras.get("user-agent"),
  });

  return { ok: true, vueltas: await leerVueltasDelChofer(supabase, input.choferId) };
}
