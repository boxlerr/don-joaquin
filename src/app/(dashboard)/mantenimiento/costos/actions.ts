"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Costos de Repuestos y Reparaciones (resumen mensual por proveedor, fuente "rep y rep").
export type CostoRepRep = {
  id: string;
  mes: string; // YYYY-MM-DD (primer día del mes)
  proveedor: string;
  neto_gravado: number;
  facturado_gravado: number;
  neto_ng: number;
  facturado_ng: number;
  neto_total: number;
  facturado_total: number;
  observaciones: string | null;
};

export type CostosResumenMes = {
  mes: string;
  proveedores: number;
  neto_total: number;
  facturado_total: number;
  /** Facturado − neto: el IVA discriminado del mes. */
  iva_total: number;
};

const CAMPOS =
  "id, mes, proveedor, neto_gravado, facturado_gravado, neto_ng, facturado_ng, neto_total, facturado_total, observaciones";

/**
 * El export contable trae los proveedores con el prefijo "Prov/" (es el código
 * de la cuenta, no parte del nombre). Se normaliza en el borde: si no, el mismo
 * proveedor cargado a mano queda como uno distinto y el unique(mes,proveedor)
 * no lo detecta — así apareció "PUNTO TRUCK S.A." separado del resto.
 */
function limpiar(nombre: string): string {
  return nombre.replace(/^\s*Prov\s*\//i, "").replace(/\s+/g, " ").trim();
}

/**
 * Supabase corta en 1000 filas por request. Con ~30 proveedores por mes eso son
 * menos de 3 años de historia, así que se pagina siempre en vez de confiar en
 * que la tabla sea chica.
 */
async function traerTodo<T>(
  build: () => { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await build().range(desde, desde + PAGE - 1);
    if (error) {
      console.error("Error al leer costos rep/rep:", error);
      break;
    }
    const lote = data ?? [];
    out.push(...lote);
    if (lote.length < PAGE) break;
  }
  return out;
}

/** Lista de meses con datos (YYYY-MM-DD), más nuevo primero. */
export async function getMesesCostosAction(): Promise<string[]> {
  await requireSeccion("mantenimiento_costos", "read");
  const supabase = createAdminClient();
  const filas = await traerTodo<{ mes: string }>(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("costos_rep_rep").select("mes").order("mes", { ascending: false }),
  );
  return [...new Set(filas.map((r) => String(r.mes)))];
}

/** Filas de costos para un mes (o todas si mes = null), ordenadas por monto. */
export async function getCostosRepRepAction(mes: string | null): Promise<CostoRepRep[]> {
  await requireSeccion("mantenimiento_costos", "read");
  const supabase = createAdminClient();
  const filas = await traerTodo<CostoRepRep>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("costos_rep_rep")
      .select(CAMPOS)
      .order("mes", { ascending: false })
      .order("facturado_total", { ascending: false });
    if (mes) q = q.eq("mes", mes);
    return q;
  });
  return filas.map((r) => ({ ...r, proveedor: limpiar(r.proveedor) }));
}

/** Totales por mes (cards, evolución y comparación contra el mes anterior). */
export async function getCostosResumenAction(): Promise<CostosResumenMes[]> {
  await requireSeccion("mantenimiento_costos", "read");
  const supabase = createAdminClient();
  const filas = await traerTodo<{ mes: string; neto_total: number; facturado_total: number }>(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("costos_rep_rep").select("mes, neto_total, facturado_total").order("mes"),
  );
  const byMes = new Map<string, CostosResumenMes>();
  for (const r of filas) {
    const mes = String(r.mes);
    const acc =
      byMes.get(mes) ?? { mes, proveedores: 0, neto_total: 0, facturado_total: 0, iva_total: 0 };
    acc.proveedores += 1;
    acc.neto_total += Number(r.neto_total ?? 0);
    acc.facturado_total += Number(r.facturado_total ?? 0);
    acc.iva_total = acc.facturado_total - acc.neto_total;
    byMes.set(mes, acc);
  }
  return [...byMes.values()].sort((a, b) => (a.mes < b.mes ? 1 : -1));
}

/** Proveedores ya cargados, para autocompletar el alta y evitar variantes de nombre. */
export async function getProveedoresCostosAction(): Promise<string[]> {
  await requireSeccion("mantenimiento_costos", "read");
  const supabase = createAdminClient();
  const filas = await traerTodo<{ proveedor: string }>(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("costos_rep_rep").select("proveedor"),
  );
  return [...new Set(filas.map((r) => limpiar(String(r.proveedor))))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

/** Historia mes a mes de un proveedor (panel de detalle). */
export async function getHistorialProveedorAction(proveedor: string): Promise<CostoRepRep[]> {
  await requireSeccion("mantenimiento_costos", "read");
  const limpio = limpiar(proveedor);
  const supabase = createAdminClient();
  const filas = await traerTodo<CostoRepRep>(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("costos_rep_rep")
      .select(CAMPOS)
      // El histórico incluye las filas viejas que todavía tengan el prefijo.
      .in("proveedor", [limpio, `Prov/${limpio}`])
      .order("mes", { ascending: false }),
  );
  return filas.map((r) => ({ ...r, proveedor: limpiar(r.proveedor) }));
}

type CostoInput = {
  mes: string; // YYYY-MM
  proveedor: string;
  neto_gravado: number;
  facturado_gravado: number;
  neto_ng: number;
  facturado_ng: number;
  observaciones?: string | null;
};

/**
 * Los importes van con signo: una nota de crédito es un importe negativo y
 * tiene que poder cargarse (el Excel de enero '26 tiene una de R. G. Comercial).
 */
function normalizar(input: CostoInput) {
  const n = (v: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const neto_gravado = n(input.neto_gravado);
  const facturado_gravado = n(input.facturado_gravado);
  const neto_ng = n(input.neto_ng);
  const facturado_ng = n(input.facturado_ng);
  return {
    mes: `${input.mes}-01`,
    proveedor: limpiar(input.proveedor),
    neto_gravado,
    facturado_gravado,
    neto_ng,
    facturado_ng,
    neto_total: neto_gravado + neto_ng,
    facturado_total: facturado_gravado + facturado_ng,
    observaciones: input.observaciones?.trim() || null,
  };
}

function validar(input: CostoInput): string | null {
  if (!limpiar(input.proveedor ?? "")) return "El proveedor es obligatorio.";
  if (!/^\d{4}-\d{2}$/.test(input.mes)) return "Mes inválido (formato AAAA-MM).";
  return null;
}

type FilaNormalizada = ReturnType<typeof normalizar>;

/**
 * Guarda una fila por (mes, proveedor) y devuelve qué pasó.
 *
 * A propósito NO es un `.upsert()`: el upsert reescribe todas las columnas del
 * conflicto, así que `created_by` quedaba pisado por el último que tocó el
 * importe. Como la tabla no tiene `updated_by`, ese campo es el único rastro de
 * quién dio de alta la fila, y con autoguardado se perdía en cada tecleo.
 */
async function guardarFila(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: FilaNormalizada,
  usuarioId: string,
): Promise<
  { ok: true; id: string; creado: boolean; antes: CostoRepRep | null } | { ok: false; error: string }
> {
  const { data: antes } = await supabase
    .from("costos_rep_rep")
    .select(CAMPOS)
    .eq("mes", row.mes)
    .eq("proveedor", row.proveedor)
    .maybeSingle();

  if (antes) {
    const { error } = await supabase.from("costos_rep_rep").update(row).eq("id", antes.id);
    if (error) {
      console.error("Error al actualizar costo rep/rep:", error);
      return { ok: false, error: "No se pudo guardar el costo." };
    }
    return { ok: true, id: antes.id as string, creado: false, antes: antes as CostoRepRep };
  }

  const { data, error } = await supabase
    .from("costos_rep_rep")
    .insert({ ...row, created_by: usuarioId })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Error al crear costo rep/rep:", error);
    return { ok: false, error: "No se pudo guardar el costo." };
  }
  return { ok: true, id: String(data?.id ?? ""), creado: true, antes: null };
}

/** Alta manual de un costo (si ese proveedor ya está en el mes, se actualiza). */
export async function addCostoRepRepAction(
  input: CostoInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSeccion("mantenimiento_costos", "write");
  const invalido = validar(input);
  if (invalido) return { ok: false, error: invalido };

  const row = normalizar(input);
  const supabase = createAdminClient();
  const res = await guardarFila(supabase, row, user.id);
  if (!res.ok) return { ok: false, error: res.error };

  await logAudit({
    client: supabase,
    accion: res.creado ? "crear" : "actualizar",
    entidadTipo: "costo_rep_rep",
    entidadId: res.id,
    usuarioId: user.id,
    valoresAnteriores: res.antes ?? undefined,
    valoresNuevos: row,
  });
  revalidatePath("/mantenimiento/costos");
  return { ok: true };
}

/**
 * Guardado de una fila de la planilla editable. Manda los cuatro importes
 * juntos (el par gravado y el par no gravado) porque los totales se recalculan
 * de los cuatro; el cliente la llama sola, con debounce, sin botón de guardar.
 */
export async function upsertCostoCeldaAction(
  mes: string, // YYYY-MM
  proveedor: string,
  campos: {
    neto_gravado: number;
    facturado_gravado: number;
    neto_ng: number;
    facturado_ng: number;
  },
): Promise<{ ok: true; id: string; proveedor: string } | { ok: false; error: string }> {
  const user = await requireSeccion("mantenimiento_costos", "write");
  const input: CostoInput = { mes, proveedor, ...campos };
  const invalido = validar(input);
  if (invalido) return { ok: false, error: invalido };

  const row = normalizar(input);
  const supabase = createAdminClient();
  const res = await guardarFila(supabase, row, user.id);
  if (!res.ok) return { ok: false, error: res.error };

  await logAudit({
    client: supabase,
    accion: res.creado ? "crear" : "actualizar",
    entidadTipo: "costo_rep_rep",
    entidadId: res.id,
    usuarioId: user.id,
    valoresAnteriores: res.antes ?? undefined,
    valoresNuevos: row,
  });
  // Sin revalidatePath: la planilla se guarda tecla a tecla y refrescar el
  // server component en cada guardado le sacaría el foco a la celda.
  return { ok: true, id: res.id, proveedor: row.proveedor };
}

/**
 * Lo que necesita la planilla para abrir un mes: sus filas y, cuando el mes
 * todavía no tiene nada, los proveedores del último mes cargado — así cargar
 * un mes nuevo es escribir una columna y no dar de alta 30 proveedores.
 */
export async function getMesParaCargaAction(
  mes: string, // YYYY-MM-DD
): Promise<{ rows: CostoRepRep[]; proveedoresPrevios: string[]; mesPrevio: string | null }> {
  await requireSeccion("mantenimiento_costos", "read");
  const rows = await getCostosRepRepAction(mes);
  if (rows.length > 0) return { rows, proveedoresPrevios: [], mesPrevio: null };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("costos_rep_rep")
    .select("mes")
    .lt("mes", mes)
    .order("mes", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mesPrevio = data ? String((data as { mes: string }).mes) : null;
  if (!mesPrevio) return { rows, proveedoresPrevios: [], mesPrevio: null };

  const previas = await getCostosRepRepAction(mesPrevio);
  return {
    rows,
    proveedoresPrevios: previas.map((r) => r.proveedor).sort((a, b) => a.localeCompare(b, "es")),
    mesPrevio,
  };
}

/** Edición de un costo ya cargado (si hay alta, tiene que haber edición). */
export async function updateCostoRepRepAction(
  id: string,
  input: CostoInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSeccion("mantenimiento_costos", "write");
  const invalido = validar(input);
  if (invalido) return { ok: false, error: invalido };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: antes } = await (supabase as any)
    .from("costos_rep_rep")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle();
  if (!antes) return { ok: false, error: "El costo ya no existe." };

  const row = normalizar(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("costos_rep_rep").update(row).eq("id", id);
  if (error) {
    const dup = String((error as { code?: string }).code) === "23505";
    console.error("Error al editar costo rep/rep:", error);
    return {
      ok: false,
      error: dup
        ? "Ese proveedor ya tiene un costo cargado en ese mes."
        : "No se pudo guardar el costo.",
    };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    entidadTipo: "costo_rep_rep",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: antes,
    valoresNuevos: row,
  });
  revalidatePath("/mantenimiento/costos");
  return { ok: true };
}

export async function deleteCostoRepRepAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSeccion("mantenimiento_costos", "write");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: antes } = await (supabase as any)
    .from("costos_rep_rep")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("costos_rep_rep").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar el costo." };

  await logAudit({
    client: supabase,
    accion: "eliminar",
    entidadTipo: "costo_rep_rep",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: antes ?? null,
  });
  revalidatePath("/mantenimiento/costos");
  return { ok: true };
}

/**
 * Borrado de varias filas de una. Sirve para deshacer un mes cargado mal: de a
 * una son treinta confirmaciones. Deja UNA entrada de auditoría con el detalle
 * de lo borrado — el borrado es real, así que el audit_log es el único respaldo.
 */
export async function eliminarCostosLoteAction(
  ids: string[],
): Promise<{ ok: boolean; borrados: number; error?: string }> {
  const user = await requireSeccion("mantenimiento_costos", "write");
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return { ok: true, borrados: 0 };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: antes } = await (supabase as any)
    .from("costos_rep_rep")
    .select(CAMPOS)
    .in("id", unicos);
  const filas = (antes ?? []) as CostoRepRep[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("costos_rep_rep").delete().in("id", unicos);
  if (error) {
    console.error("Error al eliminar costos en lote:", error);
    return { ok: false, borrados: 0, error: "No se pudieron eliminar los costos." };
  }

  await logAudit({
    client: supabase,
    accion: "eliminar",
    entidadTipo: "costo_rep_rep",
    usuarioId: user.id,
    valoresAnteriores: { filas },
    metadata: {
      cantidad: filas.length,
      meses: [...new Set(filas.map((f) => f.mes))],
      proveedores: filas.map((f) => f.proveedor),
    },
  });
  revalidatePath("/mantenimiento/costos");
  return { ok: true, borrados: filas.length };
}
