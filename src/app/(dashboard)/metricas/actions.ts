"use server";

// Métricas históricas (8vo feedback Bárbara, 08/07): las 6 planillas de
// gestión consolidadas en un dashboard con comparación contra el mes anterior
// y contra el mismo mes del año anterior, más los aumentos de tarifa de
// clientes como contexto de la facturación.
//
// Confidencial: sección `metricas` (por defecto solo administradores).

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Tablas nuevas, aún no tipadas en database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Flota = "escalables" | "tolvas";

export type MetricaChofer = {
  nombre: string;
  choferId: string | null;
  flota: Flota;
  escalTipo: number | null;
  km: number;
  kmVacios: number;
  km100: number;
  facturacion: number;
  sueldoTotal: number;
  sueldoNeto: number;
  toneladas: number;
  ingresoParcial: boolean;
};

export type TotalesMes = {
  mes: string;
  camiones: number;
  km: number;
  kmVacios: number;
  km100: number;
  facturacion: number;
  sueldoTotal: number;
  factPorKm: number | null;
  pctVacios: number | null;
  pctKm100: number | null;
  pctSueldoFact: number | null;
  toneladasProm: number | null;
};

export type CostoMesRow = {
  mes: string;
  factKm: number | null;
  costoKm: number | null;
  promKm: number | null;
};

export type AumentoCliente = {
  id: string;
  clienteId: string | null;
  clienteNombre: string;
  vigenteDesde: string;
  porcentaje: number;
  observaciones: string | null;
};

export type MetricasData = {
  mes: string; // mes mostrado (ISO día 1)
  choferes: MetricaChofer[];
  totales: Record<Flota | "general", TotalesMes | null>;
  mesAnterior: Record<Flota | "general", TotalesMes | null> | null;
  anioAnterior: Record<Flota | "general", TotalesMes | null> | null;
  /** Serie de la planilla COSTO VS KM (últimos 14 meses con datos). */
  serieCosto: CostoMesRow[];
  /** Meses que tienen planillas por chofer cargadas (para el selector). */
  mesesDisponibles: string[];
  /** Aumentos de tarifa en los últimos 13 meses hasta el mes visto. */
  aumentos: AumentoCliente[];
  canWrite: boolean;
};

function mesInfo(monthStr?: string): string {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) return `${monthStr}-01`;
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function addMonths(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split("-").map((n) => parseInt(n, 10));
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

function totalesDe(mes: string, rows: MetricaChofer[]): Record<Flota | "general", TotalesMes | null> {
  const calc = (subset: MetricaChofer[]): TotalesMes | null => {
    if (!subset.length) return null;
    const sum = (f: (r: MetricaChofer) => number) => subset.reduce((s, r) => s + f(r), 0);
    const km = sum((r) => r.km);
    const kmVacios = sum((r) => r.kmVacios);
    const km100 = sum((r) => r.km100);
    const facturacion = sum((r) => r.facturacion);
    const sueldoTotal = sum((r) => r.sueldoTotal);
    const conTon = subset.filter((r) => r.toneladas > 0);
    return {
      mes,
      camiones: subset.length,
      km,
      kmVacios,
      km100,
      facturacion,
      sueldoTotal,
      factPorKm: km > 0 ? facturacion / km : null,
      pctVacios: km > 0 ? (kmVacios / km) * 100 : null,
      pctKm100: km > 0 ? (km100 / km) * 100 : null,
      pctSueldoFact: facturacion > 0 ? (sueldoTotal / facturacion) * 100 : null,
      toneladasProm: conTon.length ? conTon.reduce((s, r) => s + r.toneladas, 0) / conTon.length : null,
    };
  };
  return {
    general: calc(rows),
    escalables: calc(rows.filter((r) => r.flota === "escalables")),
    tolvas: calc(rows.filter((r) => r.flota === "tolvas")),
  };
}

async function choferesDelMes(supabase: any, mes: string): Promise<MetricaChofer[]> {
  const { data } = await supabase
    .from("metricas_chofer_mes")
    .select(
      "chofer_nombre, chofer_id, flota, escal_tipo, km_totales, km_vacios, km_100, facturacion, sueldo_total, sueldo_neto, toneladas_prom, ingreso_parcial",
    )
    .eq("mes", mes);
  return ((data ?? []) as any[]).map((r) => ({
    nombre: r.chofer_nombre,
    choferId: r.chofer_id ?? null,
    flota: r.flota as Flota,
    escalTipo: r.escal_tipo ?? null,
    km: Number(r.km_totales ?? 0),
    kmVacios: Number(r.km_vacios ?? 0),
    km100: Number(r.km_100 ?? 0),
    facturacion: Number(r.facturacion ?? 0),
    sueldoTotal: Number(r.sueldo_total ?? 0),
    sueldoNeto: Number(r.sueldo_neto ?? 0),
    toneladas: Number(r.toneladas_prom ?? 0),
    ingresoParcial: Boolean(r.ingreso_parcial),
  }));
}

export async function getMetricasAction(month?: string): Promise<MetricasData> {
  const user = await requireSeccion("metricas", "read");
  const supabase = createAdminClient();

  // Meses con planillas cargadas; si no se pidió un mes puntual, mostrar el último.
  const { data: mesesRaw } = await (supabase as any)
    .from("metricas_chofer_mes")
    .select("mes")
    .order("mes", { ascending: false });
  const mesesDisponibles = Array.from(new Set(((mesesRaw ?? []) as any[]).map((r) => String(r.mes))));

  let mes = mesInfo(month);
  if (!month && mesesDisponibles.length && !mesesDisponibles.includes(mes)) {
    mes = mesesDisponibles[0]; // default: último mes con datos
  }
  const mesPrevio = addMonths(mes, -1);
  const mesInteranual = addMonths(mes, -12);

  const [choferes, choferesPrev, choferesYoY, costoRes, aumentosRes] = await Promise.all([
    choferesDelMes(supabase, mes),
    choferesDelMes(supabase, mesPrevio),
    choferesDelMes(supabase, mesInteranual),
    (supabase as any)
      .from("metricas_mes")
      .select("mes, flota, fact_km, costo_km_estudio, prom_km")
      .is("flota", null)
      .lte("mes", mes)
      .order("mes", { ascending: false })
      .limit(14),
    (supabase as any)
      .from("clientes_aumentos")
      .select("id, cliente_id, cliente_nombre, vigente_desde, porcentaje, observaciones")
      .gte("vigente_desde", mesInteranual)
      .lte("vigente_desde", addMonths(mes, 1))
      .order("vigente_desde", { ascending: false }),
  ]);

  return {
    mes,
    choferes,
    totales: totalesDe(mes, choferes),
    mesAnterior: choferesPrev.length ? totalesDe(mesPrevio, choferesPrev) : null,
    anioAnterior: choferesYoY.length ? totalesDe(mesInteranual, choferesYoY) : null,
    serieCosto: (((costoRes.data ?? []) as any[]).map((r) => ({
      mes: String(r.mes),
      factKm: r.fact_km == null ? null : Number(r.fact_km),
      costoKm: r.costo_km_estudio == null ? null : Number(r.costo_km_estudio),
      promKm: r.prom_km == null ? null : Number(r.prom_km),
    })) as CostoMesRow[]).reverse(),
    mesesDisponibles,
    aumentos: ((aumentosRes.data ?? []) as any[]).map((r) => ({
      id: r.id,
      clienteId: r.cliente_id ?? null,
      clienteNombre: r.cliente_nombre,
      vigenteDesde: String(r.vigente_desde),
      porcentaje: Number(r.porcentaje),
      observaciones: r.observaciones ?? null,
    })),
    canWrite: hasSeccion(user, "metricas", "write"),
  };
}

// ── Aumentos de tarifa de clientes ─────────────────────────────────────────

export async function getClientesParaAumentoAction(): Promise<{ id: string; nombre: string }[]> {
  await requireSeccion("metricas", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, razon_social")
    .eq("estado", "activo")
    .order("razon_social");
  return ((data ?? []) as any[]).map((c) => ({ id: c.id, nombre: c.razon_social }));
}

export async function crearAumentoClienteAction(input: {
  clienteId: string | null;
  clienteNombre: string;
  vigenteDesde: string; // YYYY-MM-DD
  porcentaje: number;
  observaciones?: string;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("metricas", "write");
  const supabase = createAdminClient();

  const nombre = input.clienteNombre.trim();
  if (!nombre) return { error: "Falta el cliente." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vigenteDesde)) return { error: "Fecha inválida." };
  if (!Number.isFinite(input.porcentaje) || input.porcentaje <= -100 || input.porcentaje >= 1000) {
    return { error: "El porcentaje no es válido." };
  }

  const { error } = await (supabase as any).from("clientes_aumentos").insert({
    cliente_id: input.clienteId,
    cliente_nombre: nombre,
    vigente_desde: input.vigenteDesde,
    porcentaje: input.porcentaje,
    observaciones: input.observaciones?.trim() || null,
    created_by: user.id,
  });
  if (error) {
    console.error("Error al crear aumento de cliente:", error);
    return { error: "No se pudo guardar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "cliente_aumento",
    entidadId: nombre,
    valoresNuevos: { ...input },
    metadata: { origen: "metricas" },
  });

  revalidatePath("/metricas");
  return { ok: true };
}

export async function eliminarAumentoClienteAction(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("metricas", "write");
  const supabase = createAdminClient();

  const { data: prev } = await (supabase as any)
    .from("clientes_aumentos")
    .select("cliente_nombre, vigente_desde, porcentaje")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("clientes_aumentos").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar aumento:", error);
    return { error: "No se pudo eliminar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "cliente_aumento",
    entidadId: id,
    valoresAnteriores: prev ?? null,
    metadata: { origen: "metricas" },
  });

  revalidatePath("/metricas");
  return { ok: true };
}
