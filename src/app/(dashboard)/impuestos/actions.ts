"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  crearUrlSubidaAdjunto,
  vincularAdjuntos,
  getAdjuntos,
  deleteAdjunto,
  type AdjuntoCfg,
  type AdjuntoExistente,
  type ArchivoMeta,
  type CrearUrlResult,
} from "@/lib/adjuntos-server";

// `impuesto_vencimientos` es tabla nueva; se accede con `as any` hasta regenerar database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ImpuestoRow = {
  id: string;
  nombre: string;
  organismo: string | null;
  periodo: string | null;
  fecha_vencimiento: string;
  /** Cuándo se presentó. Cargarla marca `presentado`. Null = pendiente. */
  fecha_presentacion: string | null;
  presentado: boolean;
  presentado_at: string | null;
  observaciones: string | null;
  /** Cuántos comprobantes tiene adjuntos (el archivo es opcional). */
  archivos: number;
};

const SELECT_IMPUESTO =
  "id, nombre, organismo, periodo, fecha_vencimiento, fecha_presentacion, presentado, presentado_at, observaciones, impuesto_archivos(count)";

function mapImpuesto(r: any): ImpuestoRow {
  // Supabase devuelve el count agregado como [{ count: n }].
  const c = Array.isArray(r.impuesto_archivos) ? (r.impuesto_archivos[0]?.count ?? 0) : 0;
  return {
    id: r.id,
    nombre: r.nombre,
    organismo: r.organismo,
    periodo: r.periodo,
    fecha_vencimiento: r.fecha_vencimiento,
    fecha_presentacion: r.fecha_presentacion ?? null,
    presentado: Boolean(r.presentado),
    presentado_at: r.presentado_at ?? null,
    observaciones: r.observaciones ?? null,
    archivos: Number(c),
  };
}

export async function getImpuestosAction(): Promise<ImpuestoRow[]> {
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select(SELECT_IMPUESTO)
    .order("fecha_vencimiento", { ascending: true });
  return ((data ?? []) as any[]).map(mapImpuesto);
}

/**
 * Historial de un impuesto: los períodos anteriores del mismo nombre. No hace
 * falta una tabla aparte — cada fila ya ES un período.
 */
export async function getHistorialImpuestoAction(
  nombre: string,
  excluirId: string,
): Promise<ImpuestoRow[]> {
  await requireArea("finanzas", "read");
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select(SELECT_IMPUESTO)
    .eq("nombre", nombre)
    .neq("id", excluirId)
    .order("fecha_vencimiento", { ascending: false })
    .limit(24);
  return ((data ?? []) as any[]).map(mapImpuesto);
}

/**
 * Carga (o limpia) la fecha de presentación. Es lo que marca el impuesto como
 * entregado: con fecha queda presentado; al borrarla vuelve a pendiente.
 */
export async function setFechaPresentacionAction(
  id: string,
  fecha: string | null,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { data: actual } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, fecha_presentacion, presentado")
    .eq("id", id)
    .single();
  if (!actual) return { error: "No se encontró el impuesto" };

  const presentado = fecha !== null;
  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({
      fecha_presentacion: fecha,
      presentado,
      presentado_at: presentado ? new Date().toISOString() : null,
      presentado_por: presentado ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar la fecha de presentación" };

  await logAudit({
    accion: "actualizar",
    entidadTipo: "impuesto_vencimiento",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: {
      fecha_presentacion: actual.fecha_presentacion,
      presentado: actual.presentado,
    },
    valoresNuevos: { fecha_presentacion: fecha, presentado },
    metadata: { nombre: actual.nombre },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

/** Edición rápida del vencimiento desde la propia tabla. */
export async function setFechaVencimientoAction(
  id: string,
  fecha: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida" };
  const supabase = createAdminClient();

  const { data: actual } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, fecha_vencimiento")
    .eq("id", id)
    .single();
  if (!actual) return { error: "No se encontró el impuesto" };

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({ fecha_vencimiento: fecha, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar el vencimiento" };

  await logAudit({
    accion: "actualizar",
    entidadTipo: "impuesto_vencimiento",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: { fecha_vencimiento: actual.fecha_vencimiento },
    valoresNuevos: { fecha_vencimiento: fecha },
    metadata: { nombre: actual.nombre },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function togglePresentadoImpuestoAction(
  id: string,
  presentado: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({
      presentado,
      presentado_at: presentado ? new Date().toISOString() : null,
      presentado_por: presentado ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el estado." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "impuesto",
    entidadId: id,
    valoresNuevos: { presentado },
    metadata: { evento: presentado ? "marcado_presentado" : "desmarcado" },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function updateImpuestoAction(
  id: string,
  // `periodo` también se edita: se carga al crear y hasta ahora, si venía con un
  // error de tipeo, sólo se arreglaba borrando el impuesto y cargándolo de nuevo.
  data: {
    nombre: string;
    organismo: string | null;
    periodo?: string | null;
    fecha_vencimiento: string;
    observaciones: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (!data.nombre.trim()) return { error: "El nombre es obligatorio." };
  if (!data.fecha_vencimiento) return { error: "La fecha de vencimiento es obligatoria." };

  const supabase = createAdminClient();

  const { data: previo } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, organismo, periodo, fecha_vencimiento, observaciones")
    .eq("id", id)
    .maybeSingle();

  const valores = {
    nombre: data.nombre.trim(),
    organismo: data.organismo?.trim() || null,
    fecha_vencimiento: data.fecha_vencimiento,
    observaciones: data.observaciones?.trim() || null,
    // Sin el campo en el formulario no se toca la columna: `undefined` es "no
    // vino", que no es lo mismo que "lo vaciaron".
    ...(data.periodo !== undefined ? { periodo: data.periodo?.trim() || null } : {}),
  };

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({ ...valores, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el impuesto." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "impuesto",
    entidadId: id,
    valoresAnteriores: previo ?? null,
    valoresNuevos: valores,
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function createImpuestoAction(
  data: { nombre: string; organismo: string | null; periodo: string | null; fecha_vencimiento: string },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (!data.nombre.trim()) return { error: "El nombre es obligatorio." };
  if (!data.fecha_vencimiento) return { error: "La fecha de vencimiento es obligatoria." };

  const supabase = createAdminClient();
  const { data: inserted, error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .insert({
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      periodo: data.periodo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "No se pudo crear el impuesto." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "impuesto",
    entidadId: inserted.id,
    valoresNuevos: {
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      periodo: data.periodo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
    },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function deleteImpuestoAction(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { data: previo } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, organismo, fecha_vencimiento")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("impuesto_vencimientos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el impuesto." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "impuesto",
    entidadId: id,
    valoresAnteriores: previo ?? null,
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Adjuntos (comprobantes). El archivo es OPCIONAL: hay impuestos que sólo
// tienen fecha. Usa la infra compartida de adjuntos, igual que apercibimientos,
// siniestros y documentos de chofer/camión.
// ---------------------------------------------------------------------------

const IMPUESTO_CFG: AdjuntoCfg = {
  bucket: "documentos-impuestos",
  junctionTable: "impuesto_archivos",
  entityColumn: "impuesto_id",
  folder: "impuestos",
};

export async function crearUrlSubidaImpuestoAction(
  input: { filename: string },
  impuestoId?: string | null,
): Promise<CrearUrlResult> {
  await requireArea("finanzas", "write");
  return crearUrlSubidaAdjunto(IMPUESTO_CFG, input.filename, impuestoId ?? null);
}

export async function vincularArchivosImpuestoAction(
  impuestoId: string,
  archivos: ArchivoMeta[],
): Promise<{ ok: true; vinculados: number } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const { vinculados, fallidos } = await vincularAdjuntos(
    IMPUESTO_CFG,
    impuestoId,
    archivos,
    user.id,
  );

  if (vinculados > 0) {
    await logAudit({
      accion: "actualizar",
      entidadTipo: "impuesto_vencimiento",
      entidadId: impuestoId,
      usuarioId: user.id,
      valoresAnteriores: null,
      valoresNuevos: { archivos_adjuntados: vinculados },
      metadata: { origen: "adjuntos" },
    });
  }

  revalidatePath("/impuestos");
  if (vinculados === 0 && fallidos > 0) return { error: "No se pudo adjuntar el archivo" };
  return { ok: true, vinculados };
}

export async function getArchivosImpuestoAction(impuestoId: string): Promise<AdjuntoExistente[]> {
  await requireArea("finanzas", "read");
  return getAdjuntos(IMPUESTO_CFG, impuestoId);
}

export async function deleteArchivoImpuestoAction(
  adjuntoId: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const res = await deleteAdjunto(IMPUESTO_CFG, adjuntoId);
  if (!res.ok) return { error: res.error ?? "No se pudo eliminar el archivo" };

  await logAudit({
    accion: "eliminar",
    entidadTipo: "impuesto_archivo",
    entidadId: adjuntoId,
    usuarioId: user.id,
    valoresAnteriores: { adjunto_id: adjuntoId },
    valoresNuevos: null,
  });

  revalidatePath("/impuestos");
  return { ok: true };
}
