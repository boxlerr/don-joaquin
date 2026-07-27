"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canonizarBanco } from "./bancos";

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
  /** Qué falta cargar, en castellano. Null = el préstamo está completo. */
  datos_faltantes: string | null;
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

export async function getPrestamosAction(): Promise<PrestamoRow[]> {
  await requireSeccion("prestamos", "read");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prestamos } = await (supabase as any)
    .from("prestamos")
    .select("id, banco, detalle, referencia, tasa, importe_cuota, cuotas_total, estado, observaciones, moneda, datos_faltantes")
    .order("banco");

  // Las cuotas se traen paginadas: Supabase devuelve como mucho 1000 filas por
  // consulta y un puñado de préstamos a 48 o 60 cuotas ya pasa ese tope. Sin
  // esto, a los que caían fuera del corte no les llegaba ninguna cuota y la
  // pantalla los mostraba como "Cancelado" aunque tuvieran cuotas por pagar.
  const PAGINA = 1000;
  const cuotas: (CuotaRow & { prestamo_id: string })[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pagina } = await (supabase as any)
      .from("prestamo_cuotas")
      .select("id, prestamo_id, nro, fecha_vencimiento, importe, pagada, pagada_en")
      .order("prestamo_id")
      .order("nro")
      .range(desde, desde + PAGINA - 1);
    const filas = (pagina ?? []) as (CuotaRow & { prestamo_id: string })[];
    cuotas.push(...filas);
    if (filas.length < PAGINA) break;
  }

  const cuotasPorPrestamo = new Map<string, CuotaRow[]>();
  for (const c of cuotas) {
    const list = cuotasPorPrestamo.get(c.prestamo_id) ?? [];
    list.push({
      id: c.id,
      nro: c.nro,
      fecha_vencimiento: c.fecha_vencimiento,
      importe: Number(c.importe),
      pagada: c.pagada,
      pagada_en: c.pagada_en,
    });
    cuotasPorPrestamo.set(c.prestamo_id, list);
  }

  return ((prestamos ?? []) as Omit<PrestamoRow, "cuotas" | "pagadas" | "restante" | "proxima">[]).map(
    (p) => {
      const cs = cuotasPorPrestamo.get(p.id) ?? [];
      const noPagadas = cs.filter((c) => !c.pagada);
      return {
        ...p,
        tasa: p.tasa != null ? Number(p.tasa) : null,
        importe_cuota: Number(p.importe_cuota),
        cuotas: cs,
        pagadas: cs.length - noPagadas.length,
        restante: noPagadas.reduce((s, c) => s + c.importe, 0),
        proxima:
          [...noPagadas].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0] ??
          null,
      };
    },
  );
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
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");

  const bancoEscrito = input.banco?.trim();
  if (!bancoEscrito) return { error: "Indicá el banco." };
  if (!Number.isFinite(input.importe_cuota) || input.importe_cuota <= 0)
    return { error: "El importe de la cuota debe ser mayor a cero." };
  if (!Number.isInteger(input.cuotas_total) || input.cuotas_total <= 0)
    return { error: "La cantidad de cuotas debe ser un entero mayor a cero." };
  const proximaNro = Number.isInteger(input.proxima_cuota_nro) ? input.proxima_cuota_nro : 1;
  if (proximaNro < 1 || proximaNro > input.cuotas_total)
    return { error: `La próxima cuota tiene que estar entre 1 y ${input.cuotas_total}.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.proxima_fecha))
    return { error: "Indicá la fecha de la próxima cuota." };

  const supabase = createAdminClient();
  // Si ya existe ese banco con otra grafía, se usa la que ya está.
  const banco = canonizarBanco(bancoEscrito, await bancosExistentes(supabase));

  // La cuota N vence en proxima_fecha; el resto se corre de a un mes.
  const primerVencimiento = addMonths(input.proxima_fecha, -(proximaNro - 1));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prestamo, error } = await (supabase as any)
    .from("prestamos")
    .insert({
      banco,
      detalle: input.detalle?.trim() || null,
      referencia: input.referencia?.trim() || null,
      tasa: input.tasa ?? null,
      importe_cuota: input.importe_cuota,
      cuotas_total: input.cuotas_total,
      primer_vencimiento: primerVencimiento,
      observaciones: input.observaciones?.trim() || null,
      moneda: input.moneda === "USD" ? "USD" : "ARS",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !prestamo) {
    console.error("Error al crear préstamo:", error);
    return { error: "No se pudo crear el préstamo." };
  }

  const cuotas = Array.from({ length: input.cuotas_total }, (_, i) => ({
    prestamo_id: prestamo.id,
    nro: i + 1,
    fecha_vencimiento: addMonths(input.proxima_fecha, i + 1 - proximaNro),
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
    valoresNuevos: { banco, cuotas_total: input.cuotas_total, importe_cuota: input.importe_cuota, tasa: input.tasa ?? null },
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
  },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prestamos", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("prestamos")
    .select("banco, detalle, referencia, tasa, importe_cuota, moneda, datos_faltantes, observaciones, cuotas_total")
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
