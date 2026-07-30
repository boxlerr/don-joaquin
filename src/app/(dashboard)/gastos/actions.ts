"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getLegajoEstado } from "@/lib/chofer-validation";
import { logAudit } from "@/lib/audit";
import { normalizarTexto } from "@/lib/texto";

const GASTOS_PAGE_SIZE = 25;

// Se apaga solo si la base todavía no tiene la columna normalizada.
let buscarSinAcentos = true;

export type GastoMedioPago =
  | "efectivo_caja"
  | "transferencia"
  | "tarjeta_empresa"
  | "cuenta_corriente";

export type GastoRow = {
  id: string;
  fecha: string;
  monto: number;
  medio_pago: string;
  descripcion: string | null;
  proveedor: string | null;
  numero_comprobante: string | null;
  tipo_gasto_nombre: string | null;
  tipo_gasto_categoria: string | null;
  viaje_codigo: string | null;
  viaje_id: string | null;
  camion_patente: string | null;
  camion_id: string | null;
  chofer_nombre: string | null;
  chofer_id: string | null;
  usuario: string | null;
};

export type GetGastosParams = {
  desde?: string;
  hasta?: string;
  tipoGastoId?: string;
  viajeId?: string;
  camionId?: string;
  choferId?: string;
  sinAsignar?: boolean;
  search?: string;
  page?: number;
};

export type GetGastosResult =
  | { data: GastoRow[]; hasMore: boolean; count: number; totalMonto: number }
  | { error: string };

export async function getGastosAction(
  params: GetGastosParams = {}
): Promise<GetGastosResult> {
  const {
    desde,
    hasta,
    tipoGastoId,
    viajeId,
    camionId,
    choferId,
    sinAsignar,
    search,
    page = 0,
  } = params;
  const supabase = createAdminClient();
  const from = page * GASTOS_PAGE_SIZE;
  const to = from + GASTOS_PAGE_SIZE - 1;

  let query = supabase
    .from("gastos")
    .select(
      "id, fecha, monto, medio_pago, descripcion, proveedor, numero_comprobante, tipo_gasto_id, viaje_id, camion_id, chofer_id, created_by",
      { count: "exact" }
    )
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  if (tipoGastoId) query = query.eq("tipo_gasto_id", tipoGastoId);
  if (viajeId) query = query.eq("viaje_id", viajeId);
  if (camionId) query = query.eq("camion_id", camionId);
  if (choferId) query = query.eq("chofer_id", choferId);
  if (sinAsignar) {
    query = query.is("viaje_id", null).is("camion_id", null).is("chofer_id", null);
  }
  // La búsqueda ignora acentos: se compara contra descripcion_norm, la columna
  // generada que guarda la descripción en minúsculas y sin tildes (migración
  // 20260730_busqueda_sin_acentos). Si esa migración todavía no corrió, se cae
  // a la columna original (búsqueda sensible a acentos, como era antes).
  if (search) {
    query = buscarSinAcentos
      ? query.ilike("descripcion_norm", `%${normalizarTexto(search)}%`)
      : query.ilike("descripcion", `%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    // 42703 = la columna no existe: falta correr la migración de búsqueda sin
    // acentos. Se apaga para lo que queda del proceso y se reintenta una vez.
    if (error.code === "42703" && buscarSinAcentos) {
      buscarSinAcentos = false;
      console.warn(
        "Falta la migración 20260730_busqueda_sin_acentos: la búsqueda de gastos vuelve a ser sensible a acentos."
      );
      return getGastosAction(params);
    }
    console.error("Error al obtener gastos:", error);
    return { error: "No se pudieron cargar los gastos." };
  }

  const rows = data ?? [];
  const tipoIds = [...new Set(rows.map((r) => r.tipo_gasto_id).filter(Boolean) as string[])];
  const viajeIds = [...new Set(rows.map((r) => r.viaje_id).filter(Boolean) as string[])];
  const camionIds = [...new Set(rows.map((r) => r.camion_id).filter(Boolean) as string[])];
  const choferIds = [...new Set(rows.map((r) => r.chofer_id).filter(Boolean) as string[])];
  const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean) as string[])];

  const [tiposRes, viajesRes, camionesRes, choferesRes, usuariosRes] = await Promise.all([
    tipoIds.length
      ? supabase.from("tipos_gasto").select("id, nombre, categoria").in("id", tipoIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; categoria: string | null }[] }),
    viajeIds.length
      ? supabase.from("viajes").select("id, codigo").in("id", viajeIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    camionIds.length
      ? supabase.from("camiones").select("id, patente").in("id", camionIds)
      : Promise.resolve({ data: [] as { id: string; patente: string }[] }),
    choferIds.length
      ? supabase.from("choferes").select("id, nombre, apellido").in("id", choferIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; apellido: string }[] }),
    userIds.length
      ? supabase.from("usuarios").select("id, nombre, apellido").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; apellido: string | null }[] }),
  ]);

  const tiposMap = new Map((tiposRes.data ?? []).map((t) => [t.id, t]));
  const viajesMap = new Map((viajesRes.data ?? []).map((v) => [v.id, v]));
  const camionesMap = new Map((camionesRes.data ?? []).map((c) => [c.id, c]));
  const choferesMap = new Map((choferesRes.data ?? []).map((c) => [c.id, c]));
  const usuariosMap = new Map((usuariosRes.data ?? []).map((u) => [u.id, u]));

  const mapped: GastoRow[] = rows.map((g) => {
    const tipo = g.tipo_gasto_id ? tiposMap.get(g.tipo_gasto_id) : null;
    const viaje = g.viaje_id ? viajesMap.get(g.viaje_id) : null;
    const camion = g.camion_id ? camionesMap.get(g.camion_id) : null;
    const chofer = g.chofer_id ? choferesMap.get(g.chofer_id) : null;
    const usuario = g.created_by ? usuariosMap.get(g.created_by) : null;

    return {
      id: g.id,
      fecha: g.fecha,
      monto: Number(g.monto),
      medio_pago: g.medio_pago,
      descripcion: g.descripcion,
      proveedor: g.proveedor,
      numero_comprobante: g.numero_comprobante,
      tipo_gasto_nombre: tipo?.nombre ?? null,
      tipo_gasto_categoria: tipo?.categoria ?? null,
      viaje_id: g.viaje_id,
      viaje_codigo: viaje?.codigo ?? null,
      camion_id: g.camion_id,
      camion_patente: camion?.patente ?? null,
      chofer_id: g.chofer_id,
      chofer_nombre: chofer ? `${chofer.apellido}, ${chofer.nombre}` : null,
      usuario: usuario ? `${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim() || null : null,
    };
  });

  const totalMonto = mapped.reduce((acc, r) => acc + r.monto, 0);

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * GASTOS_PAGE_SIZE,
    count: count ?? 0,
    totalMonto,
  };
}

/** Total de TODOS los gastos de un viaje (sin paginar), para rentabilidad.
 *  `getGastosAction` solo suma la página pedida; acá juntamos todos los montos
 *  del viaje (suelen ser pocos) para tener la cifra completa. */
export async function getGastosTotalViajeAction(
  viajeId: string,
): Promise<{ total: number; count: number } | { error: string }> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gastos")
    .select("monto")
    .eq("viaje_id", viajeId);

  if (error) {
    console.error("Error al sumar gastos del viaje:", error);
    return { error: "No se pudieron cargar los gastos del viaje." };
  }

  const rows = (data ?? []) as { monto: number | null }[];
  return {
    total: rows.reduce((acc, r) => acc + Number(r.monto ?? 0), 0),
    count: rows.length,
  };
}

export async function addGastoAction(data: {
  tipo_gasto_id: string;
  fecha: string;
  monto: number;
  medio_pago: GastoMedioPago;
  descripcion?: string;
  proveedor?: string;
  numero_comprobante?: string;
  viaje_id?: string | null;
  camion_id?: string | null;
  chofer_id?: string | null;
}) {
  if (!data.tipo_gasto_id) {
    return { error: "Seleccioná un tipo de gasto." };
  }
  if (!data.fecha) {
    return { error: "Seleccioná la fecha del gasto." };
  }
  if (!Number.isFinite(data.monto) || data.monto <= 0) {
    return { error: "El monto debe ser mayor a 0." };
  }

  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { data: gasto, error: gastoError } = await supabase
    .from("gastos")
    .insert({
      tipo_gasto_id: data.tipo_gasto_id,
      fecha: data.fecha,
      monto: data.monto,
      moneda: "ARS",
      medio_pago: data.medio_pago,
      descripcion: data.descripcion?.trim() || null,
      proveedor: data.proveedor?.trim() || null,
      numero_comprobante: data.numero_comprobante?.trim() || null,
      viaje_id: data.viaje_id || null,
      camion_id: data.camion_id || null,
      chofer_id: data.chofer_id || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (gastoError || !gasto) {
    console.error("Error al crear gasto:", gastoError);
    return { error: "No se pudo registrar el gasto." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "gasto",
    entidadId: gasto.id,
    valoresNuevos: {
      tipo_gasto_id: data.tipo_gasto_id,
      fecha: data.fecha,
      monto: data.monto,
      medio_pago: data.medio_pago,
      descripcion: data.descripcion?.trim() || null,
      proveedor: data.proveedor?.trim() || null,
      numero_comprobante: data.numero_comprobante?.trim() || null,
      viaje_id: data.viaje_id || null,
      camion_id: data.camion_id || null,
      chofer_id: data.chofer_id || null,
    },
  });

  // Solo reflejamos en caja los medios que efectivamente afectan a la caja general.
  const reflejaCaja: GastoMedioPago[] = ["efectivo_caja", "transferencia", "tarjeta_empresa"];
  if (reflejaCaja.includes(data.medio_pago)) {
    const medioCaja =
      data.medio_pago === "transferencia"
        ? "transferencia"
        : data.medio_pago === "efectivo_caja"
        ? "efectivo"
        : "otro";

    const { data: mov, error: cajaError } = await supabase
      .from("caja_movimientos")
      .insert({
        tipo: "egreso",
        concepto: data.descripcion?.trim() || "Gasto operativo",
        monto: data.monto,
        medio: medioCaja,
        categoria: "gasto_operativo",
        gasto_id: gasto.id,
        viaje_id: data.viaje_id || null,
        chofer_id: data.chofer_id || null,
        fecha: data.fecha,
        moneda: "ARS",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (cajaError) {
      console.error("Error al reflejar gasto en caja:", cajaError);
    } else if (mov) {
      await logAudit({
        client: supabase,
        usuarioId: user.id,
        accion: "crear",
        entidadTipo: "caja",
        entidadId: mov.id,
        valoresNuevos: {
          tipo: "egreso",
          concepto: data.descripcion?.trim() || "Gasto operativo",
          monto: data.monto,
          medio: medioCaja,
          categoria: "gasto_operativo",
          fecha: data.fecha,
        },
        metadata: { origen: "gasto", gasto_id: gasto.id },
      });
    }
  }

  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/viajes");
  revalidatePath("/camiones");
  return { success: true };
}

export async function getGastoFormData() {
  const supabase = createAdminClient();
  const [{ data: tiposGasto }, { data: viajes }, { data: camiones }, { data: choferes }] =
    await Promise.all([
      supabase
        .from("tipos_gasto")
        .select("id, nombre, categoria")
        .eq("estado", "activo")
        .order("categoria")
        .order("nombre"),
      supabase
        .from("viajes")
        .select("id, codigo, fecha_viaje")
        .neq("estado", "cancelado")
        .order("fecha_viaje", { ascending: false })
        .limit(200),
      supabase
        .from("camiones")
        .select("id, patente")
        .eq("estado", "activo")
        .order("patente"),
      supabase
        .from("choferes")
        .select("id, nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso")
        .eq("estado", "activo")
        .order("apellido"),
    ]);

  const choferesMapeados = (choferes ?? []).map((c) => {
    const estado = getLegajoEstado(c);
    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      disabled: !estado.completo,
      motivo: estado.completo ? undefined : `Legajo incompleto. Falta: ${estado.faltantes.join(", ")}`,
    };
  });

  return {
    tiposGasto: tiposGasto ?? [],
    viajes: viajes ?? [],
    camiones: camiones ?? [],
    choferes: choferesMapeados,
  };
}
