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
  texto: string;
  patente: string | null;
  persona: string | null;
  fotos: string[];
  quien: string | null;
};

/** Lo último que se cargó, para que se vea como el grupo: foto, texto y fecha. */
export async function getFeedTallerAction(limite = 30): Promise<TrabajoFeed[]> {
  await requireArea("mantenimiento", "read");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("roturas_gomas")
    .select(
      "id, fecha, observaciones, created_at, camion:camiones(patente), acoplado:acoplados(patente), chofer:choferes(nombre, apellido), usuario:usuarios!roturas_gomas_created_by_fkey(nombre, apellido)",
    )
    .order("created_at", { ascending: false })
    .limit(limite);

  const filas = (data ?? []) as {
    id: string;
    fecha: string;
    observaciones: string | null;
    camion: { patente: string } | { patente: string }[] | null;
    acoplado: { patente: string } | { patente: string }[] | null;
    chofer: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
    usuario: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
  }[];

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  // Las fotos salen de la tabla puente de roturas, en UNA consulta para no
  // pedir una por fila: el feed muestra 30 y serían 30 idas al servidor.
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

  return filas.map((f) => {
    const ch = uno(f.chofer);
    const us = uno(f.usuario);
    return {
      id: f.id,
      fecha: f.fecha,
      texto: f.observaciones ?? "",
      patente: uno(f.camion)?.patente ?? uno(f.acoplado)?.patente ?? null,
      persona: ch ? `${ch.apellido ?? ""} ${ch.nombre ?? ""}`.trim() || null : null,
      fotos: fotosPorId.get(f.id) ?? [],
      quien: us ? `${us.nombre ?? ""} ${us.apellido ?? ""}`.trim() || null : null,
    };
  });
}

/**
 * Guarda un trabajo del taller.
 *
 * Lo único obligatorio es el TEXTO. Ni la patente ni la persona lo son a
 * propósito: si el herrero escribe algo que el parser no entiende, se guarda
 * igual y se completa después. Perder el registro por un campo que faltaba es
 * volver al grupo de WhatsApp, que es de donde venimos.
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
