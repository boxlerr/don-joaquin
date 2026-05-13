"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const MOVIMIENTOS_PAGE_SIZE = 20;

export type CajaMovimientoRow = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  tipo_gasto_nombre: string | null;
  concepto: string;
  monto: number;
  medio: string;
  vinculado_a: string | null;
  usuario: string | null;
};

export type GetCajaMovimientosParams = {
  desde?: string;
  hasta?: string;
  tipoGastoId?: string;
  categoria?: string;
  search?: string;
  page?: number;
};

export type GetCajaMovimientosResult =
  | { data: CajaMovimientoRow[]; hasMore: boolean; count: number }
  | { error: string };

export async function getCajaMovimientosAction(
  params: GetCajaMovimientosParams = {}
): Promise<GetCajaMovimientosResult> {
  const { desde, hasta, tipoGastoId, categoria, search, page = 0 } = params;
  const supabase = createAdminClient();
  const from = page * MOVIMIENTOS_PAGE_SIZE;
  const to = from + MOVIMIENTOS_PAGE_SIZE - 1;

  // Si filtran por tipo de gasto, primero resolvemos los gasto.id que corresponden
  let gastoIdsFiltro: string[] | null = null;
  if (tipoGastoId) {
    const { data: gastosFiltro } = await supabase
      .from("gastos")
      .select("id")
      .eq("tipo_gasto_id", tipoGastoId);
    gastoIdsFiltro = (gastosFiltro ?? []).map((g) => g.id);
    if (gastoIdsFiltro.length === 0) {
      return { data: [], hasMore: false, count: 0 };
    }
  }

  let query = supabase
    .from("caja_movimientos")
    .select(
      "id, fecha, tipo, categoria, concepto, monto, medio, cliente_id, chofer_id, viaje_id, gasto_id, created_by",
      { count: "exact" }
    )
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  if (categoria) query = query.eq("categoria", categoria as never);
  if (gastoIdsFiltro) query = query.in("gasto_id", gastoIdsFiltro);
  if (search) query = query.ilike("concepto", `%${search}%`);

  const { data, count, error } = await query;

  if (error) {
    console.error("Error al obtener movimientos de caja:", error);
    return { error: "No se pudieron cargar los movimientos." };
  }

  const rows = data ?? [];
  const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean) as string[])];
  const choferIds = [...new Set(rows.map((r) => r.chofer_id).filter(Boolean) as string[])];
  const viajeIds = [...new Set(rows.map((r) => r.viaje_id).filter(Boolean) as string[])];
  const usuarioIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean) as string[])];
  const gastoIds = [...new Set(rows.map((r) => r.gasto_id).filter(Boolean) as string[])];

  const [clientesRes, choferesRes, viajesRes, usuariosRes, gastosRes] = await Promise.all([
    clienteIds.length
      ? supabase.from("clientes").select("id, razon_social").in("id", clienteIds)
      : Promise.resolve({ data: [] as { id: string; razon_social: string }[] }),
    choferIds.length
      ? supabase.from("choferes").select("id, nombre, apellido").in("id", choferIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; apellido: string }[] }),
    viajeIds.length
      ? supabase.from("viajes").select("id, codigo").in("id", viajeIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    usuarioIds.length
      ? supabase.from("usuarios").select("id, nombre, apellido").in("id", usuarioIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; apellido: string | null }[] }),
    gastoIds.length
      ? supabase.from("gastos").select("id, tipo_gasto_id").in("id", gastoIds)
      : Promise.resolve({ data: [] as { id: string; tipo_gasto_id: string | null }[] }),
  ]);

  const tipoGastoIds = [
    ...new Set((gastosRes.data ?? []).map((g) => g.tipo_gasto_id).filter(Boolean) as string[]),
  ];
  const tiposGastoRes = tipoGastoIds.length
    ? await supabase.from("tipos_gasto").select("id, nombre").in("id", tipoGastoIds)
    : { data: [] as { id: string; nombre: string }[] };

  const clientesMap = new Map((clientesRes.data ?? []).map((c) => [c.id, c]));
  const choferesMap = new Map((choferesRes.data ?? []).map((c) => [c.id, c]));
  const viajesMap = new Map((viajesRes.data ?? []).map((v) => [v.id, v]));
  const usuariosMap = new Map((usuariosRes.data ?? []).map((u) => [u.id, u]));
  const gastosMap = new Map((gastosRes.data ?? []).map((g) => [g.id, g]));
  const tiposGastoMap = new Map((tiposGastoRes.data ?? []).map((t) => [t.id, t]));

  const mapped: CajaMovimientoRow[] = rows.map((m) => {
    let vinculado: string | null = null;
    if (m.cliente_id) vinculado = clientesMap.get(m.cliente_id)?.razon_social ?? null;
    else if (m.chofer_id) {
      const c = choferesMap.get(m.chofer_id);
      vinculado = c ? `${c.apellido}, ${c.nombre}` : null;
    } else if (m.viaje_id) {
      const v = viajesMap.get(m.viaje_id);
      vinculado = v ? `Viaje ${v.codigo}` : null;
    }

    let usuario: string | null = null;
    if (m.created_by) {
      const u = usuariosMap.get(m.created_by);
      if (u) usuario = `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() || null;
    }

    let tipoGastoNombre: string | null = null;
    if (m.gasto_id) {
      const gasto = gastosMap.get(m.gasto_id);
      if (gasto?.tipo_gasto_id) {
        tipoGastoNombre = tiposGastoMap.get(gasto.tipo_gasto_id)?.nombre ?? null;
      }
    }

    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      categoria: m.categoria,
      tipo_gasto_nombre: tipoGastoNombre,
      concepto: m.concepto,
      monto: Number(m.monto),
      medio: m.medio,
      vinculado_a: vinculado,
      usuario,
    };
  });

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * MOVIMIENTOS_PAGE_SIZE,
    count: count ?? 0,
  };
}

export async function addIngresoAction(data: {
  concepto: string;
  monto: number;
  medio: "efectivo" | "transferencia" | "cheque" | "otro";
  categoria: "cobro_cliente" | "rendicion_vuelto" | "transferencia_interna" | "ajuste" | "otro";
  fecha: string;
}) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { error } = await supabase.from("caja_movimientos").insert({
    tipo: "ingreso",
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    fecha: data.fecha,
    moneda: "ARS",
    created_by: user.id,
  });

  if (error) {
    console.error("Error al registrar ingreso:", error);
    return { error: "No se pudo registrar el ingreso en la caja." };
  }

  revalidatePath("/caja");
  return { success: true };
}

export async function addEgresoAction(data: {
  concepto: string;
  monto: number;
  medio: "efectivo" | "transferencia" | "cheque" | "otro";
  categoria: "pago_proveedor" | "gasto_operativo" | "pago_chofer" | "transferencia_interna" | "ajuste" | "otro";
  tipo_gasto_id?: string | null;
  fecha: string;
}) {
  const user = await requireUser();
  const supabase = createAdminClient();

  let gastoId: string | null = null;

  // Si el usuario eligió un tipo de gasto, creamos un registro real en `gastos`
  // y vinculamos el movimiento de caja a ese gasto (la FK apunta a gastos.id).
  if (data.tipo_gasto_id) {
    // Mapeo a enum gasto_medio_pago: efectivo_caja | transferencia | tarjeta_empresa | cuenta_corriente | efectivo_viatico
    const medioGastoMap = {
      efectivo: "efectivo_caja",
      transferencia: "transferencia",
      cheque: "cuenta_corriente",
      otro: "efectivo_caja",
    } as const;
    const medioPago = medioGastoMap[data.medio];

    const { data: gasto, error: gastoError } = await supabase
      .from("gastos")
      .insert({
        tipo_gasto_id: data.tipo_gasto_id,
        fecha: data.fecha,
        monto: data.monto,
        moneda: "ARS",
        medio_pago: medioPago,
        descripcion: data.concepto,
      })
      .select("id")
      .single();

    if (gastoError) {
      console.error("Error al crear gasto vinculado:", gastoError);
      return { error: "No se pudo registrar el egreso en la caja." };
    }
    gastoId = gasto?.id ?? null;
  }

  const { error } = await supabase.from("caja_movimientos").insert({
    tipo: "egreso",
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    gasto_id: gastoId,
    fecha: data.fecha,
    moneda: "ARS",
    created_by: user.id,
  });

  if (error) {
    console.error("Error al registrar egreso:", error);
    return { error: "No se pudo registrar el egreso en la caja." };
  }

  revalidatePath("/caja");
  return { success: true };
}

export async function addViaticoAction(data: {
  chofer_id: string;
  monto: number;
  medio_entrega: "efectivo" | "transferencia" | "otro";
  concepto: string;
  fecha: string;
}) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const responsable_entrega_id = user.id;

  // 1. Insertar el viático
  const { data: viatico, error: viaticoError } = await supabase
    .from("viaticos")
    .insert({
      chofer_id: data.chofer_id,
      monto_entregado: data.monto,
      monto_adelanto: data.monto,
      monto_devuelto: 0,
      medio_entrega: data.medio_entrega,
      fecha_entrega: data.fecha,
      observaciones: data.concepto,
      estado: "pendiente_rendicion",
      responsable_entrega_id,
      moneda: "ARS",
    })
    .select("id")
    .single();

  if (viaticoError) {
    console.error("Error al crear viático:", viaticoError);
    return { error: "No se pudo registrar la entrega de viático." };
  }

  // 2. Reflejar la salida en la caja general vinculando el viático
  const { error: cajaError } = await supabase.from("caja_movimientos").insert({
    tipo: "egreso",
    concepto: `Entrega de viático: ${data.concepto}`,
    monto: data.monto,
    medio: data.medio_entrega === "transferencia" ? "transferencia" : "efectivo",
    categoria: "entrega_viatico",
    viatico_id: viatico?.id || null,
    chofer_id: data.chofer_id,
    fecha: data.fecha,
    moneda: "ARS",
    created_by: user.id,
  });

  if (cajaError) {
    console.error("Error al reflejar viático en caja:", cajaError);
  }

  revalidatePath("/caja");
  return { success: true };
}
