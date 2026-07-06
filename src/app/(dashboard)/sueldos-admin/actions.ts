"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { computeTotalesPeriodo } from "@/app/(dashboard)/choferes/ranking/lib";

// Tablas de sueldos admin/taller. Acceso con `as any` (no están en database.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

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

// Variables del mes fieles al Excel de Bárbara.
export type VariablesMes = {
  comisionLogistica: number;
  combustible: number;
  plusYpf: number;
  sabados: number;
};

export type SueldoAdminEmpleado = {
  chofer_id: string;
  nombre: string; // "Apellido, Nombre"
  rol: "administrativo" | "mantenimiento";
  sueldoBase: number; // vigente al mes (0 si nunca se cargó un aumento)
  comisionLogistica: number;
  combustible: number;
  plusYpf: number;
  sabados: number;
  observaciones: string | null;
  total: number; // sueldoBase + comisión + combustible + plus YPF + sábados
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
  aumentosPorEmpleado: Record<string, AumentoRow[]>; // historial (más reciente primero)
};

export async function getSueldosAdminResumenAction(month?: string): Promise<SueldosAdminResumen> {
  await requireSeccion("sueldos_admin", "read");
  const supabase = createAdminClient();
  const { mes, desde, hasta } = getMesInfo(month);

  // Roster: personal de administración y taller activo.
  const { data: personal } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, rol")
    .eq("estado", "activo")
    .in("rol", ["administrativo", "mantenimiento"])
    .order("apellido");

  const roster = (personal ?? []) as { id: string; nombre: string; apellido: string; rol: string }[];
  const ids = roster.map((c) => c.id);

  const [aumentosRes, mesRes, configRes, totales] = await Promise.all([
    ids.length
      ? (supabase as any)
          .from("sueldos_admin_aumentos")
          .select("id, chofer_id, vigente_desde, sueldo_base, observaciones")
          .in("chofer_id", ids)
          .order("vigente_desde", { ascending: false })
      : Promise.resolve({ data: [] }),
    (supabase as any)
      .from("sueldos_admin_mes")
      .select("chofer_id, comision_logistica, combustible, plus_ypf, sabados, observaciones")
      .eq("mes", mes),
    (supabase as any)
      .from("sueldos_admin_meses")
      .select("facturacion_manual")
      .eq("mes", mes)
      .maybeSingle(),
    computeTotalesPeriodo(desde, hasta),
  ]);

  const aumentosPorEmpleado: Record<string, AumentoRow[]> = {};
  for (const a of (aumentosRes.data ?? []) as (AumentoRow & { chofer_id: string })[]) {
    (aumentosPorEmpleado[a.chofer_id] ??= []).push({
      id: a.id,
      vigente_desde: a.vigente_desde,
      sueldo_base: Number(a.sueldo_base ?? 0),
      observaciones: a.observaciones ?? null,
    });
  }

  const mesPorChofer = new Map<string, VariablesMes & { observaciones: string | null }>();
  for (const r of (mesRes.data ?? []) as any[]) {
    mesPorChofer.set(r.chofer_id, {
      comisionLogistica: Number(r.comision_logistica ?? 0),
      combustible: Number(r.combustible ?? 0),
      plusYpf: Number(r.plus_ypf ?? 0),
      sabados: Number(r.sabados ?? 0),
      observaciones: r.observaciones ?? null,
    });
  }

  const empleados: SueldoAdminEmpleado[] = roster.map((c) => {
    const vigente = (aumentosPorEmpleado[c.id] ?? []).find((a) => a.vigente_desde <= mes);
    const sueldoBase = vigente ? vigente.sueldo_base : 0;
    const m = mesPorChofer.get(c.id);
    const comisionLogistica = m?.comisionLogistica ?? 0;
    const combustible = m?.combustible ?? 0;
    const plusYpf = m?.plusYpf ?? 0;
    const sabados = m?.sabados ?? 0;
    const total = sueldoBase + comisionLogistica + combustible + plusYpf + sabados;
    return {
      chofer_id: c.id,
      nombre: `${c.apellido}, ${c.nombre}`,
      rol: c.rol as "administrativo" | "mantenimiento",
      sueldoBase,
      comisionLogistica,
      combustible,
      plusYpf,
      sabados,
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
    aumentosPorEmpleado,
  };
}

export async function upsertSueldoAdminMesAction(
  choferId: string,
  month: string,
  data: Partial<VariablesMes> & { observaciones?: string | null },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("sueldos_admin", "write");
  const supabase = createAdminClient();
  const { mes } = getMesInfo(month);

  const { data: prev } = await (supabase as any)
    .from("sueldos_admin_mes")
    .select("comision_logistica, combustible, plus_ypf, sabados, observaciones")
    .eq("chofer_id", choferId)
    .eq("mes", mes)
    .maybeSingle();

  const fila = {
    chofer_id: choferId,
    mes,
    comision_logistica: data.comisionLogistica ?? Number(prev?.comision_logistica ?? 0),
    combustible: data.combustible ?? Number(prev?.combustible ?? 0),
    plus_ypf: data.plusYpf ?? Number(prev?.plus_ypf ?? 0),
    sabados: data.sabados ?? Number(prev?.sabados ?? 0),
    observaciones:
      data.observaciones !== undefined
        ? data.observaciones?.trim() || null
        : (prev?.observaciones ?? null),
    created_by: user.id,
  };
  if ([fila.comision_logistica, fila.combustible, fila.plus_ypf, fila.sabados].some((n) => n < 0)) {
    return { error: "Los montos no pueden ser negativos." };
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
