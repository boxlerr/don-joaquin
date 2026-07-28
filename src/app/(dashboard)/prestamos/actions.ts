"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canonizarBanco } from "./bancos";
import { FALTANTES, siguePendiente, type Faltante } from "./faltantes";
import { mergeTopes, TOPES_CLAVE, type TopesConfig } from "./topes";

// ---------------------------------------------------------------------------
// Préstamos bancarios (audio Bárbara 02/07): la planilla de la mamá — por
// fecha, el importe de la cuota, el número de cuota y la tasa — para avisar
// vencimientos y ver cuánto hay que pagar por semana. Tablas nuevas
// (prestamos / prestamo_cuotas) van con `as any` hasta regenerar database.ts.
// ---------------------------------------------------------------------------

export type CuotaRow = {
  id: string;
  nro: number;
  fecha_vencimiento: string;
  importe: number;
  pagada: boolean;
  pagada_en: string | null;
};

export type PrestamoRow = {
  id: string;
  banco: string;
  /** Monto original del préstamo, tal como figura en la planilla. */
  detalle: string | null;
  /** Nombre con que se lo identifica (ej. "SUECA"). No es plata: eso es detalle. */
  referencia: string | null;
  tasa: number | null;
  importe_cuota: number;
  cuotas_total: number;
  estado: string;
  observaciones: string | null;
  /** ARS o USD: los Scania Credit vienen en dólares. */
  moneda: string;
  /**
   * Nota libre de lo que falta cargar y el sistema NO puede verificar (ej. "si
   * es un pago único"). Lo verificable va en `faltantes`.
   */
  datos_faltantes: string | null;
  /** Marcas de datos faltantes verificables: monto | importe | tasa. */
  faltantes: string[];
  /** La cuota cambia mes a mes (tasa variable): el importe de acá es el último conocido. */
  cuota_variable: boolean;
  /** Pago mensual sin fecha de fin (ej. el plan de ARCA). No tiene deuda total. */
  es_recurrente: boolean;
  /** Día del mes en que vence, para los recurrentes (ej. 16). */
  dia_vencimiento: number | null;
  cuotas: CuotaRow[];
  pagadas: number;
  restante: number; // $ que falta pagar (cuotas no pagadas)
  proxima: CuotaRow | null;
};

/**
 * Suma meses manteniendo el día de la cuota (con clamp a fin de mes: una cuota
 * que vence el 31 cae al 30/28 en los meses cortos, como hacen los bancos).
 */
function addMonths(fechaISO: string, meses: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const base = new Date(y!, m! - 1 + meses, 1);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d!, ultimoDia));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/**
 * Grafías de banco ya en uso. Sirve para que escribir "galicia" en el alta no
 * cree un banco nuevo al lado de "Galicia".
 */
async function bancosExistentes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string[]> {
  const { data } = await supabase.from("prestamos").select("banco");
  return [...new Set(((data ?? []) as { banco: string }[]).map((r) => r.banco))];
}

/** Fecha del mes `offset` respecto de hoy, cayendo en `dia` (o el último del mes). */
function vencimientoMensual(dia: number, offsetMeses: number): string {
  const hoy = new Date();
  const base = new Date(hoy.getFullYear(), hoy.getMonth() + offsetMeses, 1);
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(dia, ultimo));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/** Cuántos meses adelante se mantiene cargado un pago recurrente. */
const MESES_RECURRENTE = 12;

/**
 * Los pagos mensuales sin fin no tienen un cronograma cerrado, así que hay que
 * ir generándolo: si a uno le quedan menos de 6 vencimientos futuros, se
 * completa hasta doce. Es idempotente — nunca duplica una fecha ya cargada.
 */
async function reponerCuotasRecurrentes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  recurrentes: { id: string; dia_vencimiento: number | null; importe_cuota: number }[],
  cuotasPorPrestamo: Map<string, CuotaRow[]>,
): Promise<boolean> {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const nuevas: {
    prestamo_id: string;
    nro: number;
    fecha_vencimiento: string;
    importe: number;
    pagada: boolean;
  }[] = [];

  for (const p of recurrentes) {
    const dia = p.dia_vencimiento ?? 1;
    const cs = cuotasPorPrestamo.get(p.id) ?? [];
    const futuras = cs.filter((c) => c.fecha_vencimiento >= hoyISO);
    if (futuras.length >= 6) continue;

    const yaCargadas = new Set(cs.map((c) => c.fecha_vencimiento));
    let nro = cs.reduce((max, c) => Math.max(max, c.nro), 0);
    for (let i = 0; i <= MESES_RECURRENTE; i++) {
      const fecha = vencimientoMensual(dia, i);
      if (fecha < hoyISO || yaCargadas.has(fecha)) continue;
      yaCargadas.add(fecha);
      nro += 1;
      nuevas.push({
        prestamo_id: p.id,
        nro,
        fecha_vencimiento: fecha,
        importe: Number(p.importe_cuota),
        pagada: false,
      });
    }
  }

  if (nuevas.length === 0) return false;
  const { error } = await supabase.from("prestamo_cuotas").insert(nuevas);
  if (error) {
    console.error("No se pudieron reponer las cuotas recurrentes:", error);
    return false;
  }
  // cuotas_total pierde sentido en un recurrente, pero se mantiene coherente
  // con lo que hay cargado para que el progreso no muestre un número absurdo.
  for (const p of recurrentes) {
    const total = (cuotasPorPrestamo.get(p.id)?.length ?? 0) +
      nuevas.filter((n) => n.prestamo_id === p.id).length;
    if (total > 0) await supabase.from("prestamos").update({ cuotas_total: total }).eq("id", p.id);
  }
  return true;
}

/**
 * Todas las cuotas, paginadas: Supabase devuelve como mucho 1000 filas por
 * consulta y un puñado de préstamos a 48 o 60 cuotas ya pasa ese tope. Sin
 * esto, a los que caían fuera del corte no les llegaba ninguna cuota y la
 * pantalla los mostraba como "Cancelado" aunque tuvieran cuotas por pagar.
 */
async function traerCuotas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Map<string, CuotaRow[]>> {
  const PAGINA = 1000;
  const cuotas: (CuotaRow & { prestamo_id: string })[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data: pagina } = await supabase
      .from("prestamo_cuotas")
      .select("id, prestamo_id, nro, fecha_vencimiento, importe, pagada, pagada_en")
      .order("prestamo_id")
      .order("nro")
      .range(desde, desde + PAGINA - 1);
    const filas = (pagina ?? []) as (CuotaRow & { prestamo_id: string })[];
    cuotas.push(...filas);
    if (filas.length < PAGINA) break;
  }

  const porPrestamo = new Map<string, CuotaRow[]>();
  for (const c of cuotas) {
    const list = porPrestamo.get(c.prestamo_id) ?? [];
    list.push({
      id: c.id,
      nro: c.nro,
      fecha_vencimiento: c.fecha_vencimiento,
      importe: Number(c.importe),
      pagada: c.pagada,
      pagada_en: c.pagada_en,
    });
    porPrestamo.set(c.prestamo_id, list);
  }
  return porPrestamo;
}

export async function getPrestamosAction(): Promise<PrestamoRow[]> {
  await requireSeccion("prestamos", "read");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prestamos } = await (supabase as any)
    .from("prestamos")
    .select("id, banco, detalle, referencia, tasa, importe_cuota, cuotas_total, estado, observaciones, moneda, datos_faltantes, faltantes, cuota_variable, es_recurrente, dia_vencimiento")
    .order("banco");

  type Base = Omit<PrestamoRow, "cuotas" | "pagadas" | "restante" | "proxima">;
  const filas = (prestamos ?? []) as Base[];

  let cuotasPorPrestamo = await traerCuotas(supabase);

  // Los pagos mensuales sin fin se van completando solos: si a alguno le quedan
  // pocos vencimientos por delante, se le agregan los que faltan y se releen.
  const recurrentes = filas.filter((p) => p.es_recurrente);
  if (recurrentes.length > 0) {
    const repuso = await reponerCuotasRecurrentes(
      supabase,
      recurrentes.map((p) => ({
        id: p.id,
        dia_vencimiento: p.dia_vencimiento,
        importe_cuota: Number(p.importe_cuota),
      })),
      cuotasPorPrestamo,
    );
    if (repuso) cuotasPorPrestamo = await traerCuotas(supabase);
  }

  return filas.map((p) => {
    const cs = cuotasPorPrestamo.get(p.id) ?? [];
    const noPagadas = cs.filter((c) => !c.pagada);
    return {
      ...p,
      tasa: p.tasa != null ? Number(p.tasa) : null,
      importe_cuota: Number(p.importe_cuota),
      cuotas: cs,
      pagadas: cs.length - noPagadas.length,
      // Un pago sin fin no tiene deuda total: sumar los doce meses que están
      // cargados daría un número inventado.
      restante: p.es_recurrente ? 0 : noPagadas.reduce((s, c) => s + c.importe, 0),
      proxima:
        [...noPagadas].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0] ??
        null,
    };
  });
}

/**
 * Alta de un préstamo con su cronograma completo. Para préstamos ya en curso
 * (ej. "va por la cuota 44 de 48") se indica la próxima cuota y su fecha: las
 * anteriores se generan como pagadas, así el progreso queda igual que en la
 * planilla de la mamá.
 */
export async function addPrestamoAction(input: {
  banco: string;
  detalle?: string | null;
  referencia?: string | null;
  tasa?: number | null;
  importe_cuota: number;
  cuotas_total: number;
  proxima_cuota_nro: number; // 1 = préstamo nuevo
  proxima_fecha: string; // vencimiento de esa próxima cuota (YYYY-MM-DD)
  observaciones?: string | null;
  /** ARS (default) o USD: los Scania Credit se pactan en dólares. */
  moneda?: string | null;
  /** Pago mensual sin fin (ARCA): en vez de N cuotas, todos los meses el día X. */
  es_recurrente?: boolean;
  dia_vencimiento?: number | null;
  /** La cuota cambia mes a mes (tasa variable). */
  cuota_variable?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");

  const bancoEscrito = input.banco?.trim();
  if (!bancoEscrito) return { error: "Indicá el banco." };
  if (!Number.isFinite(input.importe_cuota) || input.importe_cuota <= 0)
    return { error: "El importe de la cuota debe ser mayor a cero." };

  // Un pago mensual sin fin no tiene "cuántas cuotas son" ni "por cuál va": se
  // arranca en el próximo día que corresponda y se carga un año por delante,
  // que después se va reponiendo solo.
  const recurrente = input.es_recurrente === true;
  const diaMes = recurrente ? Math.trunc(input.dia_vencimiento ?? 0) : null;
  if (recurrente && (!diaMes || diaMes < 1 || diaMes > 31))
    return { error: "Indicá qué día del mes vence (1 a 31)." };

  const cuotasTotal = recurrente ? MESES_RECURRENTE + 1 : input.cuotas_total;
  const proximaNro = recurrente
    ? 1
    : Number.isInteger(input.proxima_cuota_nro)
      ? input.proxima_cuota_nro
      : 1;
  // El primer vencimiento del recurrente es el próximo día X que no haya pasado.
  const hoyISO = new Date().toISOString().slice(0, 10);
  const proximaFecha = recurrente
    ? vencimientoMensual(diaMes!, 0) >= hoyISO
      ? vencimientoMensual(diaMes!, 0)
      : vencimientoMensual(diaMes!, 1)
    : input.proxima_fecha;

  if (!recurrente) {
    if (!Number.isInteger(cuotasTotal) || cuotasTotal <= 0)
      return { error: "La cantidad de cuotas debe ser un entero mayor a cero." };
    if (proximaNro < 1 || proximaNro > cuotasTotal)
      return { error: `La próxima cuota tiene que estar entre 1 y ${cuotasTotal}.` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(proximaFecha))
      return { error: "Indicá la fecha de la próxima cuota." };
  }

  const supabase = createAdminClient();
  // Si ya existe ese banco con otra grafía, se usa la que ya está.
  const banco = canonizarBanco(bancoEscrito, await bancosExistentes(supabase));

  // La cuota N vence en proxima_fecha; el resto se corre de a un mes.
  const primerVencimiento = addMonths(proximaFecha, -(proximaNro - 1));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prestamo, error } = await (supabase as any)
    .from("prestamos")
    .insert({
      banco,
      detalle: input.detalle?.trim() || null,
      referencia: input.referencia?.trim() || null,
      tasa: input.tasa ?? null,
      importe_cuota: input.importe_cuota,
      cuotas_total: cuotasTotal,
      primer_vencimiento: primerVencimiento,
      observaciones: input.observaciones?.trim() || null,
      moneda: input.moneda === "USD" ? "USD" : "ARS",
      es_recurrente: recurrente,
      dia_vencimiento: diaMes,
      cuota_variable: input.cuota_variable === true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !prestamo) {
    console.error("Error al crear préstamo:", error);
    return { error: "No se pudo crear el préstamo." };
  }

  const cuotas = Array.from({ length: cuotasTotal }, (_, i) => ({
    prestamo_id: prestamo.id,
    nro: i + 1,
    fecha_vencimiento: addMonths(proximaFecha, i + 1 - proximaNro),
    importe: input.importe_cuota,
    pagada: i + 1 < proximaNro, // las anteriores a la próxima ya se pagaron
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errCuotas } = await (supabase as any).from("prestamo_cuotas").insert(cuotas);
  if (errCuotas) {
    console.error("Error al generar cuotas:", errCuotas);
    // Sin cronograma el préstamo no sirve: lo damos de baja para no dejar basura.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("prestamos").delete().eq("id", prestamo.id);
    return { error: "No se pudo generar el cronograma de cuotas." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "prestamo",
    entidadId: prestamo.id,
    valoresNuevos: {
      banco,
      cuotas_total: cuotasTotal,
      importe_cuota: input.importe_cuota,
      tasa: input.tasa ?? null,
      es_recurrente: recurrente,
    },
    metadata: { origen: "prestamos" },
  });

  revalidatePath("/prestamos");
  return { ok: true };
}

export async function setCuotaPagadaAction(
  cuotaId: string,
  pagada: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("prestamo_cuotas")
    .select("id, prestamo_id, nro, pagada")
    .eq("id", cuotaId)
    .single();
  if (!previo) return { error: "La cuota no existe." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("prestamo_cuotas")
    .update({ pagada, pagada_en: pagada ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", cuotaId);
  if (error) return { error: "No se pudo actualizar la cuota." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "prestamo_cuota",
    entidadId: cuotaId,
    valoresAnteriores: { pagada: previo.pagada },
    valoresNuevos: { pagada },
    metadata: { origen: "prestamos", prestamo_id: previo.prestamo_id, nro: previo.nro },
  });

  revalidatePath("/prestamos");
  return { ok: true };
}

/** Corrección puntual de una cuota (fecha y/o importe) — la planilla manda. */
/**
 * Edición de la ficha del préstamo. Sirve sobre todo para completar los que
 * entraron desde la planilla con datos a medias: al cargarle lo que faltaba, el
 * aviso de "falta completar" se apaga solo.
 */
export async function updatePrestamoAction(
  id: string,
  input: {
    banco?: string;
    detalle?: string | null;
    referencia?: string | null;
    tasa?: number | null;
    importe_cuota?: number;
    moneda?: string | null;
    datos_faltantes?: string | null;
    observaciones?: string | null;
    es_recurrente?: boolean;
    dia_vencimiento?: number | null;
    cuota_variable?: boolean;
  },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("prestamos")
    .select("banco, detalle, referencia, tasa, importe_cuota, moneda, datos_faltantes, faltantes, observaciones, cuotas_total, cuota_variable, es_recurrente, dia_vencimiento")
    .eq("id", id)
    .single();
  if (!previo) return { error: "No se encontró el préstamo." };

  const update: Record<string, unknown> = {};
  if (input.banco !== undefined) {
    const b = input.banco.trim();
    if (!b) return { error: "Indicá el banco." };
    // Misma unificación de grafías que en el alta: escribir "galicia" en un
    // préstamo que ya tenía otro banco lo manda a "Galicia", no crea uno nuevo.
    update.banco = canonizarBanco(b, await bancosExistentes(supabase));
  }
  if (input.detalle !== undefined) update.detalle = input.detalle?.trim() || null;
  if (input.referencia !== undefined) update.referencia = input.referencia?.trim() || null;
  if (input.observaciones !== undefined) update.observaciones = input.observaciones?.trim() || null;
  if (input.tasa !== undefined) {
    if (input.tasa != null && (!Number.isFinite(input.tasa) || input.tasa < 0))
      return { error: "La tasa tiene que ser un número mayor o igual a cero." };
    update.tasa = input.tasa;
  }
  if (input.moneda !== undefined) update.moneda = input.moneda === "USD" ? "USD" : "ARS";
  if (input.cuota_variable !== undefined) update.cuota_variable = input.cuota_variable;
  if (input.es_recurrente !== undefined) {
    update.es_recurrente = input.es_recurrente;
    // El día sólo tiene sentido si es recurrente; al dejar de serlo se limpia.
    if (!input.es_recurrente) update.dia_vencimiento = null;
    else if (input.dia_vencimiento == null && previo.dia_vencimiento == null)
      return { error: "Indicá qué día del mes vence." };
  }
  if (input.dia_vencimiento !== undefined && input.dia_vencimiento !== null) {
    const d = Math.trunc(input.dia_vencimiento);
    if (d < 1 || d > 31) return { error: "El día del mes tiene que estar entre 1 y 31." };
    update.dia_vencimiento = d;
  }
  if (input.datos_faltantes !== undefined)
    update.datos_faltantes = input.datos_faltantes?.trim() || null;
  if (input.importe_cuota !== undefined) {
    if (!Number.isFinite(input.importe_cuota) || input.importe_cuota < 0)
      return { error: "El importe de la cuota tiene que ser mayor o igual a cero." };
    update.importe_cuota = input.importe_cuota;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("prestamos").update(update).eq("id", id);
  if (error) {
    console.error("Error al editar préstamo:", error);
    return { error: "No se pudo guardar el préstamo." };
  }

  // Las marcas de "falta cargar" se apagan solas: se recalculan contra el
  // préstamo YA guardado, así completar el importe borra su propio aviso sin
  // que nadie tenga que acordarse de sacarlo a mano.
  const despues = { ...previo, ...update } as {
    detalle: string | null;
    importe_cuota: number | string;
    tasa: number | string | null;
    faltantes?: string[] | null;
  };
  const marcasPrevias = (previo.faltantes ?? []) as string[];
  const marcas = marcasPrevias
    .filter((f): f is Faltante => (FALTANTES as readonly string[]).includes(f))
    .filter((f) =>
      siguePendiente(f, {
        detalle: despues.detalle,
        importe_cuota: Number(despues.importe_cuota ?? 0),
        tasa: despues.tasa == null ? null : Number(despues.tasa),
        faltantes: [],
        datos_faltantes: null,
      }),
    );
  if (marcas.length !== marcasPrevias.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("prestamos").update({ faltantes: marcas }).eq("id", id);
  }

  // Cambiar el importe de la cuota lo aplica a las que faltan pagar: las ya
  // pagadas quedan con lo que efectivamente se pagó.
  if (input.importe_cuota !== undefined && input.importe_cuota !== Number(previo.importe_cuota)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("prestamo_cuotas")
      .update({ importe: input.importe_cuota })
      .eq("prestamo_id", id)
      .eq("pagada", false);
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "prestamo",
    entidadId: id,
    valoresAnteriores: previo,
    valoresNuevos: update,
  });

  revalidatePath("/prestamos");
  return { ok: true };
}

export async function updateCuotaAction(
  cuotaId: string,
  input: { fecha_vencimiento?: string; importe?: number },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");

  const update: Record<string, unknown> = {};
  if (input.fecha_vencimiento) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_vencimiento)) return { error: "Fecha inválida." };
    update.fecha_vencimiento = input.fecha_vencimiento;
  }
  if (input.importe != null) {
    if (!Number.isFinite(input.importe) || input.importe < 0) return { error: "Importe inválido." };
    update.importe = input.importe;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("prestamo_cuotas")
    .select("id, prestamo_id, nro, fecha_vencimiento, importe")
    .eq("id", cuotaId)
    .single();
  if (!previo) return { error: "La cuota no existe." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("prestamo_cuotas").update(update).eq("id", cuotaId);
  if (error) return { error: "No se pudo actualizar la cuota." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "prestamo_cuota",
    entidadId: cuotaId,
    valoresAnteriores: { fecha_vencimiento: previo.fecha_vencimiento, importe: previo.importe },
    valoresNuevos: update,
    metadata: { origen: "prestamos", prestamo_id: previo.prestamo_id, nro: previo.nro },
  });

  revalidatePath("/prestamos");
  return { ok: true };
}

export async function deletePrestamoAction(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("prestamos")
    .select("id, banco, detalle, cuotas_total")
    .eq("id", id)
    .single();
  if (!previo) return { error: "El préstamo no existe." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("prestamos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el préstamo." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "prestamo",
    entidadId: id,
    valoresAnteriores: previo,
    metadata: { origen: "prestamos" },
  });

  revalidatePath("/prestamos");
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Topes de pago (alertas en rojo)
 * ------------------------------------------------------------------ */

/** Los topes configurados. Si nunca se tocaron, vienen todos en null. */
export async function getTopesAction(): Promise<TopesConfig> {
  await requireSeccion("prestamos", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", TOPES_CLAVE)
    .maybeSingle();
  if (!data?.valor) return mergeTopes(null);
  try {
    return mergeTopes(JSON.parse(data.valor as string));
  } catch {
    return mergeTopes(null);
  }
}

/**
 * Guarda los topes. Se normaliza antes de escribir (cero o negativo = sin
 * tope), así lo guardado siempre es válido y la pantalla no tiene que defenderse.
 */
export async function guardarTopesAction(
  config: TopesConfig,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");
  const supabase = createAdminClient();

  const limpia = mergeTopes(config);
  const { error } = await supabase.from("parametros_sistema").upsert(
    {
      clave: TOPES_CLAVE,
      valor: JSON.stringify(limpia),
      tipo_dato: "json",
      categoria: "prestamos",
      editable: true,
      updated_by: user.id,
    },
    { onConflict: "clave" },
  );
  if (error) {
    console.error("Error al guardar los topes de préstamos:", error);
    return { error: "No se pudieron guardar los topes." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "parametro_sistema",
    entidadId: TOPES_CLAVE,
    valoresNuevos: limpia,
    metadata: { origen: "prestamos" },
  });

  revalidatePath("/prestamos");
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Corrección de fechas del mes
 * ------------------------------------------------------------------ */

export type CambioCuota = {
  id: string;
  fecha_vencimiento?: string;
  importe?: number;
};

/**
 * Guarda de una vez las correcciones del mes.
 *
 * Es el flujo real de quien usa la sección: "a principio de mes corrijo todas
 * las fechas que tengo, como hago con las planillas". Hacerlo cuota por cuota
 * —abrir el préstamo, buscar la fila, editar, guardar— eran cincuenta idas y
 * vueltas, y por eso el cronograma quedaba desactualizado.
 *
 * Se valida TODO antes de escribir nada: o entra el mes entero o no entra nada,
 * para no dejar la planilla a medio corregir.
 */
export async function actualizarCuotasAction(
  cambios: CambioCuota[],
): Promise<{ ok: true; guardados: number } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");
  if (cambios.length === 0) return { ok: true, guardados: 0 };

  for (const c of cambios) {
    if (!c.id) return { error: "Falta identificar una de las cuotas." };
    if (c.fecha_vencimiento != null && !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha_vencimiento))
      return { error: `Fecha inválida: ${c.fecha_vencimiento}` };
    if (c.importe != null && (!Number.isFinite(c.importe) || c.importe < 0))
      return { error: "Los importes tienen que ser números mayores o iguales a cero." };
  }

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previas } = await (supabase as any)
    .from("prestamo_cuotas")
    .select("id, prestamo_id, nro, fecha_vencimiento, importe")
    .in(
      "id",
      cambios.map((c) => c.id),
    );
  const previaPorId = new Map(
    ((previas ?? []) as { id: string; prestamo_id: string; nro: number; fecha_vencimiento: string; importe: number }[]).map(
      (c) => [c.id, c],
    ),
  );
  const faltan = cambios.filter((c) => !previaPorId.has(c.id));
  if (faltan.length > 0) return { error: "Alguna de las cuotas ya no existe. Recargá la pantalla." };

  let guardados = 0;
  for (const c of cambios) {
    const previa = previaPorId.get(c.id)!;
    const update: Record<string, unknown> = {};
    if (c.fecha_vencimiento != null && c.fecha_vencimiento !== previa.fecha_vencimiento)
      update.fecha_vencimiento = c.fecha_vencimiento;
    if (c.importe != null && c.importe !== Number(previa.importe)) update.importe = c.importe;
    if (Object.keys(update).length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("prestamo_cuotas").update(update).eq("id", c.id);
    if (error) {
      console.error("Error al corregir la cuota:", error);
      return { error: "No se pudieron guardar todos los cambios. Revisá y probá de nuevo." };
    }
    guardados++;

    await logAudit({
      client: supabase,
      usuarioId: user.id,
      accion: "actualizar",
      entidadTipo: "prestamo_cuota",
      entidadId: c.id,
      valoresAnteriores: {
        fecha_vencimiento: previa.fecha_vencimiento,
        importe: Number(previa.importe),
      },
      valoresNuevos: update,
      metadata: { origen: "prestamos", flujo: "fechas_del_mes", prestamo_id: previa.prestamo_id, nro: previa.nro },
    });
  }

  revalidatePath("/prestamos");
  return { ok: true, guardados };
}
