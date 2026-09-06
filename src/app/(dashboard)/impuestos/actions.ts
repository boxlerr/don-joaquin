"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSeccion, requireArea, requireSeccion, type CurrentUser } from "@/lib/auth";
import { COLUMNA_IMPUESTOS_PERSONALES, esReservado } from "@/domain/impuestos/entidades";
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
  /**
   * Cuánto se pagó. `null` es "todavía no se cargó", que NO es cero: el total
   * por mes cuenta aparte los que faltan para no dar un número que miente.
   */
  importe: number | null;
  /** Cuándo se pagó — distinta de la de presentación (mamá de Bárbara, 27/08). */
  fecha_pago: string | null;
  presentado: boolean;
  presentado_at: string | null;
  observaciones: string | null;
  /** Cuántos comprobantes tiene adjuntos (el archivo es opcional). */
  archivos: number;
  /** De qué contribuyente es. Decide a quién le llega la alerta. */
  entidad_codigo: string;
  /** Nombre para mostrar del contribuyente ("Joaquín Hnos", "Joaquín Nicolás"). */
  entidad_nombre: string;
};

/** Un contribuyente del calendario, para el filtro y el importador. */
export type EntidadImpuesto = {
  codigo: string;
  nombre: string;
  cuit: string;
};

const SELECT_IMPUESTO =
  "id, nombre, organismo, periodo, fecha_vencimiento, fecha_presentacion, importe, fecha_pago, presentado, presentado_at, observaciones, entidad_codigo, entidad:impuesto_entidades(nombre), impuesto_archivos(count)";

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
    // Postgres devuelve `numeric` como string para no perder precisión.
    importe: r.importe === null || r.importe === undefined ? null : Number(r.importe),
    fecha_pago: r.fecha_pago ?? null,
    presentado: Boolean(r.presentado),
    presentado_at: r.presentado_at ?? null,
    observaciones: r.observaciones ?? null,
    archivos: Number(c),
    // Las filas de antes del 02/09/2026 son todas de la empresa; la migración ya
    // las completó, pero el fallback evita que una fila suelta quede sin dueño.
    entidad_codigo: r.entidad_codigo ?? "joaquin_hnos",
    entidad_nombre: r.entidad?.nombre ?? "Joaquín Hnos",
  };
}

/**
 * Los códigos de contribuyente que este usuario NO puede ver, o `null` si puede
 * verlos todos.
 *
 * La sección «Impuestos personales» está marcada confidencial desde el 02/09,
 * pero eso sólo estaba cortando a quién le llegaba el AVISO: las filas del
 * calendario de Nicolás se veían igual en la tabla —con su CUIT en el
 * desplegable— para los nueve que tienen Finanzas. Un tilde que dice "reservado"
 * y no reserva nada es peor que no tenerlo, así que el mismo permiso que decide
 * el correo decide también la lista.
 */
async function codigosVedados(user: CurrentUser, supabase: any): Promise<string[] | null> {
  if (hasSeccion(user, "impuestos_personales", "read")) return null;
  const { data } = await supabase
    .from("impuesto_entidades")
    .select("codigo, columna_alerta")
    .eq("columna_alerta", COLUMNA_IMPUESTOS_PERSONALES);
  const codigos = ((data ?? []) as { codigo: string }[]).map((e) => e.codigo);
  return codigos.length > 0 ? codigos : null;
}

export async function getImpuestosAction(): Promise<ImpuestoRow[]> {
  // El chequeo va acá y no sólo en la página: una server action exportada la
  // puede llamar cualquiera que esté logueado, tenga o no la pantalla.
  const user = await requireSeccion("impuestos", "read");
  const supabase = createAdminClient();
  const vedados = await codigosVedados(user, supabase);

  let q = (supabase as any)
    .from("impuesto_vencimientos")
    .select(SELECT_IMPUESTO)
    .order("fecha_vencimiento", { ascending: true });
  if (vedados) q = q.not("entidad_codigo", "in", `(${vedados.join(",")})`);

  const { data } = await q;
  return ((data ?? []) as any[]).map(mapImpuesto);
}

/**
 * Cargar un vencimiento de una persona física necesita su sección: el permiso
 * viaja con el dato, igual que en el importador. Devuelve el motivo, o `null`.
 */
async function motivoSinPermisoEntidad(
  user: CurrentUser,
  entidadCodigo: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from("impuesto_entidades")
    .select("nombre, columna_alerta")
    .eq("codigo", entidadCodigo)
    .maybeSingle();
  if (!data) return "No se encontró el contribuyente.";
  if (data.columna_alerta !== COLUMNA_IMPUESTOS_PERSONALES) return null;
  if (hasSeccion(user, "impuestos_personales", "write")) return null;
  return `El calendario de ${data.nombre} es de acceso reservado.`;
}

/**
 * Los contribuyentes cargados. La pantalla los usa para el filtro; si hay uno
 * solo el filtro ni se dibuja, igual que el de organismo.
 */
export async function getEntidadesAction(): Promise<EntidadImpuesto[]> {
  const user = await requireSeccion("impuestos", "read");
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta")
    .order("orden", { ascending: true });

  const puedePersonales = hasSeccion(user, "impuestos_personales", "read");
  return ((data ?? []) as (EntidadImpuesto & { columna_alerta: string })[])
    .filter((e) => puedePersonales || !esReservado(e.columna_alerta))
    .map(({ codigo, nombre, cuit }) => ({ codigo, nombre, cuit }));
}

/**
 * Historial de un impuesto: los períodos anteriores del mismo nombre. No hace
 * falta una tabla aparte — cada fila ya ES un período.
 */
export async function getHistorialImpuestoAction(
  nombre: string,
  excluirId: string,
): Promise<ImpuestoRow[]> {
  // El historial cruza contribuyentes: "IVA" lo tienen los dos. Sin el mismo
  // recorte que el listado, abrir el IVA de la empresa mostraba abajo el de la
  // persona física.
  const user = await requireSeccion("impuestos", "read");
  const supabase = createAdminClient();
  const vedados = await codigosVedados(user, supabase);

  let q = (supabase as any)
    .from("impuesto_vencimientos")
    .select(SELECT_IMPUESTO)
    .eq("nombre", nombre)
    .neq("id", excluirId)
    .order("fecha_vencimiento", { ascending: false })
    .limit(24);
  if (vedados) q = q.not("entidad_codigo", "in", `(${vedados.join(",")})`);

  const { data } = await q;
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

/**
 * Cuánto se pagó. Se carga desde la tabla, igual que las fechas.
 *
 * `null` borra el importe y NO es lo mismo que un 0: cero es "se pagó cero" y
 * vacío es "no lo sabemos". La tira de totales los cuenta distinto.
 */
export async function setImporteImpuestoAction(
  id: string,
  importe: number | null,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (importe !== null && (!Number.isFinite(importe) || importe < 0)) {
    return { error: "Importe inválido" };
  }
  const supabase = createAdminClient();

  const { data: actual } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, importe")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return { error: "No se encontró el impuesto" };

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({ importe, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar el importe" };

  await logAudit({
    accion: "actualizar",
    entidadTipo: "impuesto_vencimiento",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: { importe: actual.importe },
    valoresNuevos: { importe },
    metadata: { nombre: actual.nombre },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

/**
 * Cuándo se pagó. Va aparte de `fecha_presentacion` a propósito: se presenta la
 * declaración y se paga, y las dos fechas se separan seguido.
 */
export async function setFechaPagoImpuestoAction(
  id: string,
  fecha: string | null,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida" };
  const supabase = createAdminClient();

  const { data: actual } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, fecha_pago")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return { error: "No se encontró el impuesto" };

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({ fecha_pago: fecha, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar la fecha de pago" };

  await logAudit({
    accion: "actualizar",
    entidadTipo: "impuesto_vencimiento",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: { fecha_pago: actual.fecha_pago },
    valoresNuevos: { fecha_pago: fecha },
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
  data: {
    nombre: string;
    organismo: string | null;
    periodo: string | null;
    fecha_vencimiento: string;
    /** De quién es. Sin dato, la empresa: es lo que era todo antes del 02/09/2026. */
    entidad_codigo?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (!data.nombre.trim()) return { error: "El nombre es obligatorio." };
  if (!data.fecha_vencimiento) return { error: "La fecha de vencimiento es obligatoria." };

  const entidad_codigo = data.entidad_codigo?.trim() || "joaquin_hnos";
  const sinPermiso = await motivoSinPermisoEntidad(user, entidad_codigo);
  if (sinPermiso) return { error: sinPermiso };

  const supabase = createAdminClient();
  const { data: inserted, error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .insert({
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      periodo: data.periodo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
      entidad_codigo,
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
      entidad_codigo,
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
