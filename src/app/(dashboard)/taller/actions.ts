"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { hoyArgentina } from "@/lib/fecha-ar";
import { urlesFirmadas } from "@/lib/storage-urls";
import { revalidatePath } from "next/cache";
import { addRoturaAction, type AdjuntoArchivoMeta } from "../mantenimiento/actions";
import { leerBajas } from "./parseo";
import type { PersonaTaller, UnidadTaller } from "./parseo";

/**
 * La carga del taller, pensada para el teléfono del herrero.
 *
 * Guarda en `roturas_gomas`, que es la tabla que ya existe y que el módulo de
 * Mantenimiento lee: un trabajo cargado desde acá aparece en la misma lista y
 * en el costo por chofer, sin una tabla paralela que después nadie mire.
 *
 * **El texto se guarda TAL CUAL se escribió**, en `observaciones`. Lo que el
 * parser entiende (patente, persona, correlativo) va a sus columnas, pero el
 * mensaje original queda entero: es la única forma de que después se pueda
 * releer lo que quiso decir, y Bárbara pidió justamente eso — *"que quede
 * registrado en algún lado lo que se hace"*.
 */

export type DatosTaller = {
  unidades: UnidadTaller[];
  personas: PersonaTaller[];
};

export async function getDatosTallerAction(): Promise<DatosTaller> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();

  const [camiones, acoplados, choferes] = await Promise.all([
    supabase.from("camiones").select("id, patente").order("patente"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("acoplados").select("id, patente").order("patente"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido, estado")
      .neq("estado", "baja")
      .order("apellido"),
  ]);

  const unidades: UnidadTaller[] = [
    ...((camiones.data ?? []) as { id: string; patente: string }[]).map((c) => ({
      id: c.id,
      patente: c.patente,
      tipo: "camion" as const,
    })),
    ...((acoplados.data ?? []) as { id: string; patente: string }[]).map((a) => ({
      id: a.id,
      patente: a.patente,
      tipo: "acoplado" as const,
    })),
  ];

  const personas: PersonaTaller[] = (
    (choferes.data ?? []) as { id: string; nombre: string; apellido: string }[]
  ).map((c) => ({ id: c.id, nombre: c.nombre ?? "", apellido: c.apellido ?? "" }));

  return { unidades, personas };
}

export type TrabajoFeed = {
  id: string;
  fecha: string;
  /** Cuándo se cargó, con hora. Es lo que permite reconocer el mensaje. */
  cargadoEn: string | null;
  texto: string;
  /** Qué se rompió, cuando la fila no vino del taller y no tiene texto. */
  tipo: string | null;
  posicion: string | null;
  marca: string | null;
  cantidad: number | null;
  patente: string | null;
  /** Id de la unidad, para poder pedir su historial exacto. */
  unidadId: string | null;
  persona: string | null;
  fotos: string[];
  quien: string | null;
};

export type FeedFiltros = {
  /** Texto libre: busca en el mensaje. */
  busca?: string;
  /** Historial de una unidad. */
  unidadId?: string | null;
  /** Historial de una persona. */
  personaId?: string | null;
  /** Cuántos saltear, para el "Ver más". */
  desde?: number;
};

export type FeedResultado = {
  trabajos: TrabajoFeed[];
  /** Cuántos hay en TOTAL con esos filtros, no cuántos vinieron. */
  total: number;
  hayMas: boolean;
};

// De a cuántos se traen. Con 150 cargas, traerlas todas es una pantalla que no
// termina. NO se exporta: un archivo "use server" sólo puede exportar funciones
// async, y exportar la constante rompe el build (no el typecheck).
const FEED_PAGINA = 20;

/**
 * Lo cargado, con filtros y de a tandas.
 *
 * Nace de una pregunta de Julián: *"¿cómo se irá visualizando cuando haya 150
 * cargadas?"*. La primera versión traía las últimas 30 y las apilaba: con 150,
 * 120 quedaban invisibles y no había forma de contestar "qué le hicimos a este
 * acoplado" — que es exactamente el historial que pidió Bárbara.
 *
 * La búsqueda pega sobre el MENSAJE, y eso alcanza para casi todo justamente
 * porque el texto se guarda tal cual se escribió: buscar "AF-112" encuentra el
 * trabajo aunque la patente no esté en su columna. Para el historial exacto de
 * una unidad o una persona están los filtros por id, que es lo que se usa al
 * tocar la patente de una tarjeta.
 */
export async function getFeedTallerAction(filtros: FeedFiltros = {}): Promise<FeedResultado> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();

  const desde = Math.max(0, filtros.desde ?? 0);
  const busca = (filtros.busca ?? "").trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("roturas_gomas")
    .select(
      "id, fecha, observaciones, created_at, tipo, posicion, marca, cantidad, camion_id, acoplado_id, camion:camiones(patente), acoplado:acoplados(patente), chofer:choferes(nombre, apellido), usuario:usuarios!roturas_gomas_created_by_fkey(nombre, apellido)",
      { count: "exact" },
    );

  if (busca) q = q.or(`observaciones.ilike.%${busca}%,tipo.ilike.%${busca}%,marca.ilike.%${busca}%`);
  // La unidad puede ser camión o acoplado: se prueba en las dos columnas.
  if (filtros.unidadId) q = q.or(`camion_id.eq.${filtros.unidadId},acoplado_id.eq.${filtros.unidadId}`);
  if (filtros.personaId) q = q.eq("chofer_id", filtros.personaId);

  const { data, count } = await q
    .order("created_at", { ascending: false })
    .range(desde, desde + FEED_PAGINA - 1);

  const filas = (data ?? []) as {
    id: string;
    fecha: string;
    created_at: string | null;
    observaciones: string | null;
    tipo: string | null;
    posicion: string | null;
    marca: string | null;
    cantidad: number | null;
    camion_id: string | null;
    acoplado_id: string | null;
    camion: { patente: string } | { patente: string }[] | null;
    acoplado: { patente: string } | { patente: string }[] | null;
    chofer: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
    usuario: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
  }[];

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  // Las fotos salen de la tabla puente en UNA consulta: una por fila serían
  // veinte idas al servidor por pantalla.
  const ids = filas.map((f) => f.id);
  const { data: adj } = ids.length
    ? await supabase
        .from("rotura_archivos")
        .select("rotura_id, archivo:documentos_archivos!archivo_id(bucket, path)")
        .in("rotura_id", ids)
    : { data: [] };

  const planos = ((adj ?? []) as { rotura_id: string; archivo: unknown }[]).map((r) => ({
    rotura_id: r.rotura_id,
    archivo: (Array.isArray(r.archivo) ? r.archivo[0] : r.archivo) as
      | { bucket: string; path: string }
      | null,
  }));
  const urls = await urlesFirmadas(planos.map((p) => p.archivo));

  const fotosPorId = new Map<string, string[]>();
  for (const p of planos) {
    if (!p.archivo) continue;
    const url = urls.get(`${p.archivo.bucket}/${p.archivo.path}`);
    if (!url) continue;
    const arr = fotosPorId.get(p.rotura_id) ?? [];
    arr.push(url);
    fotosPorId.set(p.rotura_id, arr);
  }

  const trabajos: TrabajoFeed[] = filas.map((f) => {
    const ch = uno(f.chofer);
    const us = uno(f.usuario);
    return {
      id: f.id,
      fecha: f.fecha,
      cargadoEn: f.created_at ?? null,
      texto: f.observaciones ?? "",
      tipo: f.tipo ?? null,
      posicion: f.posicion ?? null,
      marca: f.marca ?? null,
      cantidad: f.cantidad ?? null,
      patente: uno(f.camion)?.patente ?? uno(f.acoplado)?.patente ?? null,
      unidadId: f.camion_id ?? f.acoplado_id ?? null,
      persona: ch ? `${ch.apellido ?? ""} ${ch.nombre ?? ""}`.trim() || null : null,
      fotos: fotosPorId.get(f.id) ?? [],
      quien: us ? `${us.nombre ?? ""} ${us.apellido ?? ""}`.trim() || null : null,
    };
  });

  const total = count ?? trabajos.length;
  return { trabajos, total, hayMas: desde + trabajos.length < total };
}

/**
 * Guarda un trabajo del taller.
 *
 * Hacen falta el texto y ADEMÁS el camión o el chofer: la tabla tiene un CHECK
 * que exige al menos uno de los dos. Se descubrió cargando los mensajes reales
 * del grupo del 24/08 — los de "27 bajas" no traen patente y la base los
 * rechazaba con un error de Postgres que nadie podría interpretar.
 */
export async function cargarTrabajoTallerAction(input: {
  texto: string;
  unidadId?: string | null;
  unidadTipo?: "camion" | "acoplado" | null;
  personaId?: string | null;
  archivos?: AdjuntoArchivoMeta[];
}): Promise<{ ok: true } | { error: string }> {
  await requireArea("mantenimiento", "write");

  const texto = (input.texto ?? "").trim();
  if (!texto) return { error: "Escribí qué se hizo." };

  // El CHECK `roturas_gomas_unidad_requerida` exige camión, acoplado o chofer.
  // Se comprueba acá para devolver una frase que se entienda, en vez del error
  // crudo de Postgres.
  if (!input.unidadId && !input.personaId) {
    return { error: "Elegí de qué unidad es, o de quién, para poder guardarlo." };
  }

  const bajas = leerBajas(texto);

  // Se delega en `addRoturaAction` en vez de insertar acá: es la que ya sabe
  // vincular los adjuntos y resolver el insumo, y un trabajo cargado desde el
  // teléfono tiene que quedar EXACTAMENTE igual que uno cargado desde
  // Mantenimiento. Dos caminos de escritura distintos para la misma tabla
  // terminan divergiendo.
  const res = await addRoturaAction({
    camion_id: input.unidadTipo === "camion" ? input.unidadId || null : null,
    acoplado_id: input.unidadTipo === "acoplado" ? input.unidadId || null : null,
    chofer_id: input.personaId || null,
    // Un mensaje con correlativo de bajas ES una baja de cubierta; el resto son
    // reparaciones. Es la única clasificación que se deduce, porque el
    // correlativo no aparece en ninguna otra cosa.
    tipo: bajas != null ? "goma" : "taller",
    gravedad: "leve",
    fecha: hoyArgentina(),
    cantidad: 1,
    // El texto va TAL CUAL se escribió. Lo que el parser entendió ya fue a sus
    // columnas, pero el mensaje entero es lo que permite releer después qué
    // quiso decir — que es lo que se pidió: "que quede registrado".
    observaciones: texto,
    archivos: input.archivos,
  });

  if ("error" in res && res.error) return { error: res.error };

  revalidatePath("/taller");
  revalidatePath("/mantenimiento");
  return { ok: true };
}
