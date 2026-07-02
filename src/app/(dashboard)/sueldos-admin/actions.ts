"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { computeTotalesPeriodo } from "@/app/(dashboard)/choferes/ranking/lib";

// Tablas nuevas (migración 20260701_sueldos_admin_taller.sql), aún sin regenerar
// database.ts → acceso con `as any`, misma convención que insumos_catalogo.
/* eslint-disable @typescript-eslint/no-explicit-any */

const VALOR_HORA_CLAVE = "sueldos_admin_valor_hora";

/** Normaliza el mes pedido a { primer día ISO, rango desde/hasta } (default: mes actual). */
function getMesInfo(monthStr?: string): { mes: string; desde: string; hasta: string } {
  let year: number;
  let month: number;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split("-");
    year = parseInt(y, 10);
    month = parseInt(m, 10) - 1;
  } else {
    const hoy = new Date();
    year = hoy.getFullYear();
    month = hoy.getMonth();
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    mes: fmt(new Date(year, month, 1)),
    desde: fmt(new Date(year, month, 1)),
    hasta: fmt(new Date(year, month + 1, 0)),
  };
}

export type SueldoAdminEmpleado = {
  chofer_id: string;
  nombre: string; // "Apellido, Nombre"
  rol: "administrativo" | "mantenimiento";
  sueldoBase: number; // vigente al mes (0 si nunca se cargó un aumento)
  horasExtras: number;
  valorHora: number | null; // valor propio del mes; null → usa el default global
  plus: number;
  observaciones: string | null;
  total: number; // sueldoBase + horasExtras × valorHora efectivo + plus
};

export type AumentoRow = {
  id: string;
  vigente_desde: string; // primer día del mes (ISO)
  sueldo_base: number;
  observaciones: string | null;
};

export type SueldosAdminResumen = {
  empleados: SueldoAdminEmpleado[];
  totalGeneral: number;
  facturacionCalculada: number; // suma de viajes del mes (misma definición que el ranking)
  facturacionManual: number | null; // si Bárbara cargó un valor a mano, pisa la calculada
  facturacionEfectiva: number;
  porcentaje: number | null; // totalGeneral / facturación × 100; null si facturación 0
  valorHoraDefault: number;
  aumentosPorEmpleado: Record<string, AumentoRow[]>; // historial (más reciente primero)
};

export async function getSueldosAdminResumenAction(month?: string): Promise<SueldosAdminResumen> {
  await requireSeccion("sueldos_admin", "read");
  const supabase = createAdminClient();
  const { mes, desde, hasta } = getMesInfo(month);

  // Roster: personal de administración y taller activo. `rol` null significa
  // chofer (el default histórico), por eso el filtro es .in() y no "not chofer".
  const { data: personal } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, rol")
    .eq("estado", "activo")
    .in("rol", ["administrativo", "mantenimiento"])
    .order("apellido");

  const roster = (personal ?? []) as { id: string; nombre: string; apellido: string; rol: string }[];
  const ids = roster.map((c) => c.id);

  const [aumentosRes, mesRes, configRes, paramRes, totales] = await Promise.all([
    ids.length
      ? (supabase as any)
          .from("sueldos_admin_aumentos")
          .select("id, chofer_id, vigente_desde, sueldo_base, observaciones")
          .in("chofer_id", ids)
          .order("vigente_desde", { ascending: false })
      : Promise.resolve({ data: [] }),
    (supabase as any)
      .from("sueldos_admin_mes")
      .select("chofer_id, horas_extras, valor_hora, plus, observaciones")
      .eq("mes", mes),
    (supabase as any)
      .from("sueldos_admin_meses")
      .select("facturacion_manual")
      .eq("mes", mes)
      .maybeSingle(),
    supabase.from("parametros_sistema").select("valor").eq("clave", VALOR_HORA_CLAVE).maybeSingle(),
    // Facturación del mes con la misma definición que usa el dashboard/ranking
    // (todos los viajes no cancelados, convertidos a ARS).
    computeTotalesPeriodo(desde, hasta),
  ]);

  const valorHoraDefault = (() => {
    const n = Number(paramRes.data?.valor);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();

  // Historial de aumentos por empleado (ya viene ordenado más reciente primero).
  const aumentosPorEmpleado: Record<string, AumentoRow[]> = {};
  for (const a of (aumentosRes.data ?? []) as (AumentoRow & { chofer_id: string })[]) {
    (aumentosPorEmpleado[a.chofer_id] ??= []).push({
      id: a.id,
      vigente_desde: a.vigente_desde,
      sueldo_base: Number(a.sueldo_base ?? 0),
      observaciones: a.observaciones ?? null,
    });
  }

  const mesPorChofer = new Map<
    string,
    { horas_extras: number; valor_hora: number | null; plus: number; observaciones: string | null }
  >();
  for (const r of (mesRes.data ?? []) as any[]) {
    mesPorChofer.set(r.chofer_id, {
      horas_extras: Number(r.horas_extras ?? 0),
      valor_hora: r.valor_hora == null ? null : Number(r.valor_hora),
      plus: Number(r.plus ?? 0),
      observaciones: r.observaciones ?? null,
    });
  }

  const empleados: SueldoAdminEmpleado[] = roster.map((c) => {
    // Sueldo base vigente = el aumento con mayor vigente_desde <= mes pedido.
    const vigente = (aumentosPorEmpleado[c.id] ?? []).find((a) => a.vigente_desde <= mes);
    const sueldoBase = vigente ? vigente.sueldo_base : 0;
    const m = mesPorChofer.get(c.id);
    const horasExtras = m?.horas_extras ?? 0;
    const valorHora = m?.valor_hora ?? null;
    const plus = m?.plus ?? 0;
    const total = sueldoBase + horasExtras * (valorHora ?? valorHoraDefault) + plus;
    return {
      chofer_id: c.id,
      nombre: `${c.apellido}, ${c.nombre}`,
      rol: c.rol as "administrativo" | "mantenimiento",
      sueldoBase,
      horasExtras,
      valorHora,
      plus,
      observaciones: m?.observaciones ?? null,
      total,
    };
  });

  const totalGeneral = empleados.reduce((s, e) => s + e.total, 0);
  const facturacionCalculada = totales.facturacion;
  const facturacionManual =
    configRes.data?.facturacion_manual == null ? null : Number(configRes.data.facturacion_manual);
  const facturacionEfectiva = facturacionManual ?? facturacionCalculada;
  const porcentaje = facturacionEfectiva > 0 ? (totalGeneral / facturacionEfectiva) * 100 : null;

  return {
    empleados,
    totalGeneral,
    facturacionCalculada,
    facturacionManual,
    facturacionEfectiva,
    porcentaje,
    valorHoraDefault,
    aumentosPorEmpleado,
  };
}

export async function upsertSueldoAdminMesAction(
  choferId: string,
  month: string,
  data: {
    horasExtras?: number;
    valorHora?: number | null;
    plus?: number;
    observaciones?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos_admin", "write");
  const supabase = createAdminClient();
  const { mes } = getMesInfo(month);

  // Merge con lo ya guardado: la action acepta campos parciales sin pisar el resto.
  const { data: prev } = await (supabase as any)
    .from("sueldos_admin_mes")
    .select("horas_extras, valor_hora, plus, observaciones")
    .eq("chofer_id", choferId)
    .eq("mes", mes)
    .maybeSingle();

  const fila = {
    chofer_id: choferId,
    mes,
    horas_extras: data.horasExtras ?? Number(prev?.horas_extras ?? 0),
    valor_hora: data.valorHora !== undefined ? data.valorHora : (prev?.valor_hora ?? null),
    plus: data.plus ?? Number(prev?.plus ?? 0),
    observaciones:
      data.observaciones !== undefined
        ? data.observaciones?.trim() || null
        : (prev?.observaciones ?? null),
    created_by: user.id,
  };
  if (fila.horas_extras < 0 || (fila.valor_hora != null && fila.valor_hora < 0)) {
    return { error: "Las horas y el valor hora no pueden ser negativos." };
  }

  const { error } = await (supabase as any)
    .from("sueldos_admin_mes")
    .upsert(fila, { onConflict: "chofer_id,mes" });
  if (error) {
    console.error("Error al guardar sueldos_admin_mes:", error);
    return { error: "No se pudo guardar la fila del mes." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "sueldo_admin_mes",
    entidadId: choferId,
    valoresNuevos: { mes, ...data },
    metadata: { origen: "sueldos_admin" },
  });

  revalidatePath("/sueldos-admin");
  return { ok: true };
}

export async function registrarAumentoAction(
  choferId: string,
  vigenteDesdeMonth: string,
  sueldoBase: number,
  observaciones?: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos_admin", "write");
  const supabase = createAdminClient();

  if (!/^\d{4}-\d{2}$/.test(vigenteDesdeMonth)) return { error: "Elegí el mes desde el que rige." };
  if (!Number.isFinite(sueldoBase) || sueldoBase < 0) {
    return { error: "El sueldo base no puede ser negativo." };
  }
  const vigenteDesde = `${vigenteDesdeMonth}-01`;

  // Upsert: si ya había un aumento para ese mes, se corrige (Bárbara ajusta valores).
  const { error } = await (supabase as any).from("sueldos_admin_aumentos").upsert(
    {
      chofer_id: choferId,
      vigente_desde: vigenteDesde,
      sueldo_base: sueldoBase,
      observaciones: observaciones?.trim() || null,
      created_by: user.id,
    },
    { onConflict: "chofer_id,vigente_desde" },
  );
  if (error) {
    console.error("Error al registrar aumento:", error);
    return { error: "No se pudo registrar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "sueldo_admin_aumento",
    entidadId: choferId,
    valoresNuevos: { vigente_desde: vigenteDesde, sueldo_base: sueldoBase, observaciones: observaciones ?? null },
    metadata: { origen: "sueldos_admin" },
  });

  revalidatePath("/sueldos-admin");
  return { ok: true };
}

export async function eliminarAumentoAction(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos_admin", "write");
  const supabase = createAdminClient();

  const { data: prev } = await (supabase as any)
    .from("sueldos_admin_aumentos")
    .select("chofer_id, vigente_desde, sueldo_base")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("sueldos_admin_aumentos").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar aumento:", error);
    return { error: "No se pudo eliminar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "sueldo_admin_aumento",
    entidadId: id,
    valoresAnteriores: prev ?? null,
    metadata: { origen: "sueldos_admin" },
  });

  revalidatePath("/sueldos-admin");
  return { ok: true };
}

export async function setFacturacionManualAction(
  month: string,
  valor: number | null,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos_admin", "write");
  const supabase = createAdminClient();
  const { mes } = getMesInfo(month);

  if (valor != null && (!Number.isFinite(valor) || valor < 0)) {
    return { error: "La facturación no puede ser negativa." };
  }

  // null limpia el override y el % vuelve a calcularse con la facturación del sistema.
  const { error } = await (supabase as any)
    .from("sueldos_admin_meses")
    .upsert({ mes, facturacion_manual: valor, updated_by: user.id }, { onConflict: "mes" });
  if (error) {
    console.error("Error al guardar facturación manual:", error);
    return { error: "No se pudo guardar la facturación del mes." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "sueldo_admin_mes_config",
    entidadId: mes,
    valoresNuevos: { facturacion_manual: valor },
    metadata: { origen: "sueldos_admin" },
  });

  revalidatePath("/sueldos-admin");
  return { ok: true };
}

export async function setValorHoraDefaultAction(
  valor: number,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos_admin", "write");
  const supabase = createAdminClient();

  if (!Number.isFinite(valor) || valor < 0) {
    return { error: "El valor de la hora no puede ser negativo." };
  }

  const { data: prev } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", VALOR_HORA_CLAVE)
    .maybeSingle();

  const { error } = await supabase
    .from("parametros_sistema")
    .update({ valor: String(valor), updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("clave", VALOR_HORA_CLAVE);
  if (error) {
    console.error("Error al actualizar valor hora default:", error);
    return { error: "No se pudo guardar el valor de la hora." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "parametro_sistema",
    entidadId: null,
    valoresAnteriores: { valor: prev?.valor ?? null },
    valoresNuevos: { valor: String(valor) },
    metadata: { origen: "sueldos_admin", clave: VALOR_HORA_CLAVE },
  });

  revalidatePath("/sueldos-admin");
  return { ok: true };
}
