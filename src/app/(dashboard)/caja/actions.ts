"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import {
  hasSeccion,
  requireArea,
  requireSeccion,
  type CurrentUser,
} from "@/lib/auth";
import { getUsuariosConSeccion } from "@/lib/permisos-usuarios";
import { clausulaVisibilidad } from "./visibilidad";
import { desdeVentanaCajaChica } from "./ventana";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { computeRendicion } from "../viajes/flujo-logic";

const MOVIMIENTOS_PAGE_SIZE = 20;

/**
 * Las dos cajas físicas (audios Bárbara 30/06): la "diaria" es la caja chica
 * operativa; la "grande" es la de dirección (subsección caja_grande).
 * La columna `caja` es nueva (migración 20260701) y no está en los tipos
 * generados, por eso las queries que la tocan usan `(supabase as any)`.
 */
export type CajaId = "diaria" | "grande";

/** Qué se está mirando: una caja, o las dos juntas (vista general de dirección). */
export type CajaFiltro = CajaId | "todas";

/**
 * Las dos pantallas de caja, que es lo que define qué se ve (ya no el rol):
 *
 * · "chica"   → la operativa. Igual para todos, así dirección comprueba qué
 *   está viendo el personal: últimos 30 días y sin los movimientos ocultos.
 * · "general" → la de dirección (exige caja_grande). Historial completo de las
 *   dos cajas, con lo privado incluido.
 */
export type CajaVista = "chica" | "general";

async function requireVerCaja(vista: CajaVista): Promise<CurrentUser> {
  if (vista === "general") return requireSeccion("caja_grande", "read");
  return requireArea("caja", "read");
}

/** En la caja chica no se mira más atrás que la ventana; en la general, todo. */
function acotarDesde(desde: string | undefined, vista: CajaVista): string | undefined {
  if (vista === "general") return desde;
  const limite = desdeVentanaCajaChica();
  return !desde || desde < limite ? limite : desde;
}

/**
 * Cláusula `or` que deja fuera de la caja chica lo privado. En la vista general
 * no se filtra nada: ahí se ve todo, incluido lo que la chica no muestra.
 */
async function filtroVisibilidad(vista: CajaVista): Promise<string | null> {
  if (vista === "general") return null;
  const direccion = await getUsuariosConSeccion("caja_saldo", "read");
  return clausulaVisibilidad(direccion);
}

/**
 * Qué guardar en `privado` al cargar un movimiento.
 *
 * Solo dirección decide: si no marca nada, se guarda privado (así un descuido
 * no expone un retiro). Lo que carga el operativo queda sin decidir (null) —
 * es visible para todos por la regla por autor.
 */
function resolverPrivado(user: CurrentUser, privado?: boolean): boolean | null {
  if (!hasSeccion(user, "caja_saldo", "read")) return null;
  return privado ?? true;
}

async function logCajaAudit(
  supabase: ReturnType<typeof createAdminClient>,
  movimientoId: string,
  accion: "crear" | "actualizar" | "eliminar",
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string,
) {
  await logAudit({
    accion,
    entidadTipo: "caja",
    entidadId: movimientoId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
    client: supabase,
  });
}

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
  /** true = oculto al operativo · false = visible · null = sin decidir. */
  privado: boolean | null;
  /** De qué caja es. Se muestra en la vista general, que mezcla las dos. */
  caja: CajaId;
};

export type CajaResumen = {
  ingresos: number;
  egresos: number;
  movimientos: number;
  /** Saldo histórico de la caja (o de las dos, en la vista general). */
  saldoTotal: number;
  /** Suma de fletes facturados del período (por fecha de viaje). Solo en la
   *  vista general: el valor entra con el remito, así que esto ES el ingreso por
   *  viajes, y es información comercial que la caja chica no muestra. */
  fletesFacturados: number | null;
};

/**
 * Totales del período. Ojo: NO aplica el filtro de privacidad, tampoco en la
 * caja chica. Contra estos números se arquea la plata del cajón, así que tienen
 * que ser los reales. Lo que se oculta es el detalle (la tabla), no el total.
 */
export async function getCajaResumenAction(params: {
  desde?: string;
  hasta?: string;
  vista?: CajaVista;
  caja?: CajaFiltro;
}): Promise<CajaResumen | { error: string }> {
  const vista = params.vista ?? "chica";
  await requireVerCaja(vista);
  const supabase = createAdminClient();
  // La caja chica es siempre la diaria; el filtro por caja es de la general.
  const caja: CajaFiltro = vista === "chica" ? "diaria" : params.caja ?? "todas";
  const desde = acotarDesde(params.desde, vista);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rangoQuery = (supabase as any).from("caja_movimientos").select("tipo, monto");
  if (caja !== "todas") rangoQuery = rangoQuery.eq("caja", caja);
  if (desde) rangoQuery = rangoQuery.gte("fecha", desde);
  if (params.hasta) rangoQuery = rangoQuery.lte("fecha", params.hasta);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let saldoQuery = (supabase as any).from("caja_movimientos").select("tipo, monto");
  if (caja !== "todas") saldoQuery = saldoQuery.eq("caja", caja);

  const [
    { data: rango, error: rangoError },
    { data: todos, error: todosError },
  ] = await Promise.all([rangoQuery, saldoQuery]);

  if (rangoError || todosError) {
    console.error("Error al obtener resumen de caja:", rangoError ?? todosError);
    return { error: "No se pudo cargar el resumen de caja." };
  }

  // Ingresos por fletes del período: con el remito entra el valor y el viaje ya
  // queda facturado, así que la facturación por fecha de viaje ES el ingreso por
  // viajes del mes. Solo caja diaria (concepto operativo). Paginado: el API REST
  // corta en 1000 filas.
  let fletesFacturados = 0;
  if (vista === "general" && caja !== "grande") {
    for (let from = 0; ; from += 1000) {
      let fq = supabase
        .from("viajes")
        .select("monto_flete")
        .eq("facturado", true)
        .eq("es_vacio", false)
        .neq("estado", "cancelado")
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (desde) fq = fq.gte("fecha_viaje", desde);
      if (params.hasta) fq = fq.lte("fecha_viaje", params.hasta);
      const { data: fletes, error: fletesError } = await fq;
      if (fletesError) {
        console.error("Error al sumar fletes facturados:", fletesError);
        break;
      }
      const batch = (fletes ?? []) as { monto_flete: number | null }[];
      for (const f of batch) fletesFacturados += Number(f.monto_flete || 0);
      if (batch.length < 1000) break;
    }
  }

  let ingresos = 0;
  let egresos = 0;
  for (const m of rango ?? []) {
    if (m.tipo === "ingreso") ingresos += Number(m.monto || 0);
    else egresos += Number(m.monto || 0);
  }
  type TipoMonto = { tipo: string; monto: number | null };
  const saldoTotal = ((todos ?? []) as TipoMonto[]).reduce(
    (acc, m) => acc + (m.tipo === "ingreso" ? Number(m.monto) : -Number(m.monto)),
    0,
  );
  return {
    ingresos,
    egresos,
    movimientos: rango?.length ?? 0,
    saldoTotal,
    fletesFacturados: vista === "general" ? fletesFacturados : null,
  };
}

/** Un día de la caja: lo que entró, lo que salió y con cuánto se cerró. */
export type CajaSerieDia = {
  fecha: string;
  ingresos: number;
  egresos: number;
  /** Saldo acumulado al cierre del día, arrancando del saldo previo al período. */
  saldo: number;
};

/**
 * La serie diaria del período, para el gráfico. Igual que el resumen, NO filtra
 * lo privado: son totales, y el gráfico acompaña a las cards —si mostrara otra
 * cosa que el saldo de arriba, no habría forma de cuadrarlos.
 */
export async function getCajaSerieDiariaAction(params: {
  desde?: string;
  hasta?: string;
  vista?: CajaVista;
  caja?: CajaFiltro;
}): Promise<CajaSerieDia[] | { error: string }> {
  const vista = params.vista ?? "chica";
  await requireVerCaja(vista);
  const supabase = createAdminClient();
  const caja: CajaFiltro = vista === "chica" ? "diaria" : params.caja ?? "todas";
  const desde = acotarDesde(params.desde, vista);

  // Movimientos del rango. El API REST corta en 1000 filas: vamos de a tandas.
  const movimientos: { fecha: string; tipo: string; monto: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("caja_movimientos")
      .select("fecha, tipo, monto")
      .order("fecha", { ascending: true })
      .range(from, from + 999);
    if (caja !== "todas") q = q.eq("caja", caja);
    if (desde) q = q.gte("fecha", desde);
    if (params.hasta) q = q.lte("fecha", params.hasta);
    const { data, error } = await q;
    if (error) {
      console.error("Error al obtener la serie diaria de caja:", error);
      return { error: "No se pudo cargar el gráfico de caja." };
    }
    const batch = (data ?? []) as typeof movimientos;
    movimientos.push(...batch);
    if (batch.length < 1000) break;
  }

  // De dónde arranca la línea: el saldo acumulado hasta el día anterior.
  let saldo = 0;
  if (desde) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let previosQuery = (supabase as any)
      .from("caja_movimientos")
      .select("tipo, monto")
      .lt("fecha", desde);
    if (caja !== "todas") previosQuery = previosQuery.eq("caja", caja);
    const { data: previos, error: previosError } = await previosQuery;
    if (previosError) {
      console.error("Error al calcular el saldo inicial del gráfico:", previosError);
      return { error: "No se pudo cargar el gráfico de caja." };
    }
    type TipoMonto = { tipo: string; monto: number | null };
    saldo = ((previos ?? []) as TipoMonto[]).reduce(
      (acc, m) => acc + (m.tipo === "ingreso" ? Number(m.monto || 0) : -Number(m.monto || 0)),
      0,
    );
  }

  const porDia = new Map<string, { ingresos: number; egresos: number }>();
  for (const m of movimientos) {
    const fecha = String(m.fecha).slice(0, 10);
    const dia = porDia.get(fecha) ?? { ingresos: 0, egresos: 0 };
    if (m.tipo === "ingreso") dia.ingresos += Number(m.monto || 0);
    else dia.egresos += Number(m.monto || 0);
    porDia.set(fecha, dia);
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, d]) => {
      saldo += d.ingresos - d.egresos;
      return { fecha, ingresos: d.ingresos, egresos: d.egresos, saldo };
    });
}

export type GetCajaMovimientosParams = {
  desde?: string;
  hasta?: string;
  tipoGastoId?: string;
  categoria?: string;
  search?: string;
  page?: number;
  vista?: CajaVista;
  caja?: CajaFiltro;
};

export type GetCajaMovimientosResult =
  | { data: CajaMovimientoRow[]; hasMore: boolean; count: number }
  | { error: string };

export async function getCajaMovimientosAction(
  params: GetCajaMovimientosParams = {}
): Promise<GetCajaMovimientosResult> {
  const { hasta, tipoGastoId, categoria, search, page = 0 } = params;
  const vista = params.vista ?? "chica";
  await requireVerCaja(vista);
  const supabase = createAdminClient();
  const caja: CajaFiltro = vista === "chica" ? "diaria" : params.caja ?? "todas";
  const visibilidad = await filtroVisibilidad(vista);
  const desde = acotarDesde(params.desde, vista);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("caja_movimientos")
    .select(
      "id, fecha, tipo, categoria, concepto, monto, medio, cliente_id, chofer_id, viaje_id, gasto_id, created_by, privado, caja",
      { count: "exact" }
    )
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (caja !== "todas") query = query.eq("caja", caja);
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  if (categoria) query = query.eq("categoria", categoria as never);
  if (gastoIdsFiltro) query = query.in("gasto_id", gastoIdsFiltro);
  if (search) query = query.ilike("concepto", `%${search}%`);
  if (visibilidad) query = query.or(visibilidad);

  const { data, count, error } = await query;

  if (error) {
    console.error("Error al obtener movimientos de caja:", error);
    return { error: "No se pudieron cargar los movimientos." };
  }

  type MovRow = {
    id: string;
    fecha: string;
    tipo: "ingreso" | "egreso";
    categoria: string;
    concepto: string;
    monto: number;
    medio: string;
    cliente_id: string | null;
    chofer_id: string | null;
    viaje_id: string | null;
    gasto_id: string | null;
    created_by: string | null;
    privado: boolean | null;
    caja: CajaId | null;
  };
  const rows: MovRow[] = data ?? [];
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
      privado: m.privado,
      caja: m.caja ?? "diaria",
    };
  });

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * MOVIMIENTOS_PAGE_SIZE,
    count: count ?? 0,
  };
}

/**
 * Cambia la privacidad de un movimiento ya cargado. Solo dirección: es quien
 * decide qué ve el personal operativo, y sirve para corregir una marca puesta
 * al apuro. Queda en auditoría como cualquier cambio sobre la caja.
 */
export async function setMovimientoPrivadoAction(data: { id: string; privado: boolean }) {
  const user = await requireSeccion("caja_saldo", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previo } = await (supabase as any)
    .from("caja_movimientos")
    .select("privado")
    .eq("id", data.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("caja_movimientos")
    .update({ privado: data.privado })
    .eq("id", data.id);

  if (error) {
    console.error("Error al cambiar la privacidad del movimiento:", error);
    return { error: "No se pudo cambiar la visibilidad del movimiento." };
  }

  await logCajaAudit(
    supabase,
    data.id,
    "actualizar",
    { privado: previo?.privado ?? null },
    { privado: data.privado },
    user.id,
  );

  revalidatePath("/caja");
  return { success: true };
}

export async function addIngresoAction(data: {
  concepto: string;
  monto: number;
  medio: "efectivo" | "transferencia" | "cheque" | "otro";
  categoria: "cobro_cliente" | "rendicion_vuelto" | "transferencia_interna" | "ajuste" | "otro";
  fecha: string;
  caja?: CajaId;
  /** Solo dirección lo define: si no lo manda, el movimiento queda privado. */
  privado?: boolean;
}) {

  const user = await requireArea("caja", "write");
  const caja = data.caja ?? "diaria";
  // La caja grande es privada de dirección: además del área hace falta la subsección.
  if (caja === "grande") await requireSeccion("caja_grande", "write");
  const supabase = createAdminClient();

  const insertData = {
    tipo: "ingreso" as const,
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    fecha: data.fecha,
    moneda: "ARS",
    caja,
    privado: resolverPrivado(user, data.privado),
    created_by: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("caja_movimientos")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    console.error("Error al registrar ingreso:", error);
    return { error: "No se pudo registrar el ingreso en la caja." };
  }

  if (inserted?.id) {
    await logCajaAudit(supabase, inserted.id, "crear", null, insertData, user.id);
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
  caja?: CajaId;
  /** Solo dirección lo define: si no lo manda, el movimiento queda privado. */
  privado?: boolean;
}) {

  const user = await requireArea("caja", "write");
  const caja = data.caja ?? "diaria";
  // La caja grande es privada de dirección: además del área hace falta la subsección.
  if (caja === "grande") await requireSeccion("caja_grande", "write");
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

  const insertData = {
    tipo: "egreso" as const,
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    gasto_id: gastoId,
    fecha: data.fecha,
    moneda: "ARS",
    caja,
    privado: resolverPrivado(user, data.privado),
    created_by: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("caja_movimientos")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    console.error("Error al registrar egreso:", error);
    return { error: "No se pudo registrar el egreso en la caja." };
  }

  if (inserted?.id) {
    await logCajaAudit(supabase, inserted.id, "crear", null, insertData, user.id);
  }

  revalidatePath("/caja");
  return { success: true };
}

// ============================================================================
// Transferencias entre cajas
// ----------------------------------------------------------------------------
// Mover plata de la caja diaria a la grande (retiro de dirección) o al revés
// (fondeo de la operativa). Queda registrado como un PAR de movimientos con
// categoría transferencia_interna unidos por transferencia_id: egreso en la
// caja origen e ingreso en la destino. Siempre en efectivo (es plata física
// que pasa de una caja a la otra).
// ============================================================================
export async function transferirEntreCajasAction(data: {
  direccion: "diaria_a_grande" | "grande_a_diaria";
  monto: number;
  fecha: string;
  concepto?: string | null;
}): Promise<{ success?: boolean; error?: string }> {
  const user = await requireSeccion("caja_grande", "write");
  const supabase = createAdminClient();

  if (!Number.isFinite(data.monto) || data.monto <= 0) {
    return { error: "El monto debe ser mayor a cero." };
  }
  if (!data.fecha) {
    return { error: "Indicá la fecha de la transferencia." };
  }

  const origen: CajaId = data.direccion === "diaria_a_grande" ? "diaria" : "grande";
  const destino: CajaId = origen === "diaria" ? "grande" : "diaria";
  const concepto =
    data.concepto?.trim() ||
    (data.direccion === "diaria_a_grande"
      ? "Transferencia caja diaria → caja grande"
      : "Transferencia caja grande → caja diaria");

  const transferenciaId = crypto.randomUUID();
  const base = {
    categoria: "transferencia_interna" as const,
    concepto,
    monto: data.monto,
    medio: "efectivo" as const,
    fecha: data.fecha,
    moneda: "ARS",
    transferencia_id: transferenciaId,
    created_by: user.id,
  };
  const movimientos = [
    { ...base, tipo: "egreso" as const, caja: origen },
    { ...base, tipo: "ingreso" as const, caja: destino },
  ];

  // Insert único para que el par sea atómico: o entran los dos o ninguno.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("caja_movimientos")
    .insert(movimientos)
    .select("id, tipo");

  if (error) {
    console.error("Error al transferir entre cajas:", error);
    return { error: "No se pudo registrar la transferencia." };
  }

  for (const mov of (inserted ?? []) as { id: string; tipo: "ingreso" | "egreso" }[]) {
    const valores = movimientos.find((m) => m.tipo === mov.tipo) ?? null;
    await logCajaAudit(supabase, mov.id, "crear", null, valores, user.id);
  }

  revalidatePath("/caja");
  return { success: true };
}

// ============================================================================
// Importación masiva desde Excel / CSV
// ============================================================================

const CAJA_TIPO_VALUES = ["ingreso", "egreso"] as const;
const CAJA_MEDIO_VALUES = ["efectivo", "transferencia", "cheque", "otro"] as const;
const CAJA_CATEGORIA_VALUES = [
  "cobro_cliente",
  "pago_proveedor",
  "entrega_viatico",
  "rendicion_vuelto",
  "gasto_operativo",
  "pago_chofer",
  "transferencia_interna",
  "ajuste",
  "otro",
] as const;

type CajaTipo = (typeof CAJA_TIPO_VALUES)[number];
type CajaMedio = (typeof CAJA_MEDIO_VALUES)[number];
type CajaCategoria = (typeof CAJA_CATEGORIA_VALUES)[number];

export type ImportMovimientosState = {
  ok?: boolean;
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  error?: string;
} | null;

type RawMovRow = {
  fecha?: string;
  tipo?: string;
  categoria?: string;
  concepto?: string;
  monto?: string;
  medio?: string;
  observaciones?: string;
};

const HEADER_MAP_MOV: Record<string, keyof RawMovRow> = {
  fecha: "fecha",
  tipo: "tipo",
  categoria: "categoria",
  categoría: "categoria",
  concepto: "concepto",
  descripcion: "concepto",
  descripción: "concepto",
  monto: "monto",
  importe: "monto",
  medio: "medio",
  "medio de pago": "medio",
  medio_pago: "medio",
  observaciones: "observaciones",
  observacion: "observaciones",
};

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function cell(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function normalizeTipo(v?: string): CajaTipo | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("ing")) return "ingreso";
  if (s.startsWith("egr") || s.startsWith("sal") || s.startsWith("gas")) return "egreso";
  if ((CAJA_TIPO_VALUES as readonly string[]).includes(s)) return s as CajaTipo;
  return null;
}

function normalizeMedio(v?: string): CajaMedio {
  const s = (v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CAJA_MEDIO_VALUES as readonly string[]).includes(s)) return s as CajaMedio;
  if (s.includes("transf")) return "transferencia";
  if (s.includes("efec") || s.includes("cash")) return "efectivo";
  if (s.includes("cheq")) return "cheque";
  return "otro";
}

function normalizeCategoria(v: string | undefined, tipo: CajaTipo): CajaCategoria {
  const s = (v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CAJA_CATEGORIA_VALUES as readonly string[]).includes(s)) {
    return s as CajaCategoria;
  }
  if (s.includes("cobro") || s.includes("cliente")) return "cobro_cliente";
  if (s.includes("proveedor")) return "pago_proveedor";
  if (s.includes("viatico") || s.includes("viático")) return "entrega_viatico";
  if (s.includes("rendicion") || s.includes("vuelto")) return "rendicion_vuelto";
  if (s.includes("operativo") || s.includes("gasto")) return "gasto_operativo";
  if (s.includes("chofer")) return "pago_chofer";
  if (s.includes("transferencia") || s.includes("interna")) return "transferencia_interna";
  if (s.includes("ajuste")) return "ajuste";
  return tipo === "ingreso" ? "otro" : "gasto_operativo";
}

function parseMonto(v?: string): number | null {
  if (!v) return null;
  // Quitar símbolos de moneda y separadores de miles tipo es-AR ($ 1.234,56)
  const cleaned = v
    .replace(/[$\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n);
}

function parseFecha(v?: string): string | null {
  if (!v) return null;
  const s = v.trim();
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Excel serial date
  if (/^\d+$/.test(s)) {
    const serial = Number(s);
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) {
      const yyyy = String(d.y).padStart(4, "0");
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  // Intento genérico
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
}

export async function importMovimientosCajaAction(
  _prev: ImportMovimientosState,
  formData: FormData,
): Promise<ImportMovimientosState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx o .csv." };
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "El archivo no contiene hojas." };
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { error: "No se pudo leer el archivo. Verificá el formato." };
  }

  if (rows.length === 0) {
    return { error: "El archivo no contiene filas." };
  }

  const user = await requireArea("caja", "write");
  const supabase = createAdminClient();

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // header + 1-indexed

    const mapped: RawMovRow = {};
    for (const [key, value] of Object.entries(raw)) {
      const norm = normalizeKey(key);
      const target = HEADER_MAP_MOV[norm];
      if (target) mapped[target] = cell(value);
    }

    const tipo = normalizeTipo(mapped.tipo);
    if (!tipo) {
      skipped++;
      errors.push({ row: rowNum, message: "Tipo inválido (usá ingreso/egreso)." });
      continue;
    }

    const fecha = parseFecha(mapped.fecha);
    if (!fecha) {
      skipped++;
      errors.push({ row: rowNum, message: "Fecha inválida (usá yyyy-mm-dd o dd/mm/yyyy)." });
      continue;
    }

    const monto = parseMonto(mapped.monto);
    if (monto === null || monto <= 0) {
      skipped++;
      errors.push({ row: rowNum, message: "Monto inválido." });
      continue;
    }

    const concepto = cell(mapped.concepto);
    if (!concepto) {
      skipped++;
      errors.push({ row: rowNum, message: "Falta concepto." });
      continue;
    }

    const medio = normalizeMedio(mapped.medio);
    const categoria = normalizeCategoria(mapped.categoria, tipo);
    const observaciones = cell(mapped.observaciones) ?? null;

    const insertRow = {
      tipo,
      fecha,
      concepto,
      monto,
      medio,
      categoria,
      moneda: "ARS",
      observaciones,
      created_by: user.id,
    };

    const { data: inserted, error } = await supabase
      .from("caja_movimientos")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      skipped++;
      errors.push({ row: rowNum, message: error.message });
    } else {
      imported++;
      if (inserted?.id) {
        await logCajaAudit(supabase, inserted.id, "crear", null, insertRow, user.id);
      }
    }
  }

  revalidatePath("/caja");
  return { ok: true, imported, skipped, errors };
}

export async function addViaticoAction(data: {
  chofer_id: string;
  monto: number;
  medio_entrega: "efectivo" | "transferencia" | "otro";
  concepto: string;
  fecha: string;
}) {

  const user = await requireArea("caja", "write");
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
  const cajaInsert = {
    tipo: "egreso" as const,
    concepto: `Entrega de viático: ${data.concepto}`,
    monto: data.monto,
    medio: (data.medio_entrega === "transferencia" ? "transferencia" : "efectivo") as
      | "transferencia"
      | "efectivo",
    categoria: "entrega_viatico" as const,
    viatico_id: viatico?.id || null,
    chofer_id: data.chofer_id,
    fecha: data.fecha,
    moneda: "ARS",
    created_by: user.id,
  };

  const { data: cajaMov, error: cajaError } = await supabase
    .from("caja_movimientos")
    .insert(cajaInsert)
    .select("id")
    .single();

  if (cajaError) {
    console.error("Error al reflejar viático en caja:", cajaError);
  } else if (cajaMov?.id) {
    await logCajaAudit(supabase, cajaMov.id, "crear", null, cajaInsert, user.id);
  }

  revalidatePath("/caja");
  return { success: true };
}

// ============================================================================
// Rendición de viático
// ----------------------------------------------------------------------------
// El chofer rinde el adelanto: cuánto gastó/justificó (monto_rendido) y cuánto
// devolvió en efectivo (monto_devuelto). El devuelto vuelve a la caja como
// ingreso (categoría rendicion_vuelto). El estado pasa a rendido o
// parcialmente_rendido según si lo rendido+devuelto cubre lo entregado.
// ============================================================================
export async function rendirViaticoAction(data: {
  viatico_id: string;
  fecha_rendicion: string;
  monto_rendido: number;
  monto_devuelto: number;
  observaciones?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireArea("caja", "write");
  const supabase = createAdminClient();

  const { data: v, error } = await supabase
    .from("viaticos")
    .select("id, chofer_id, monto_entregado, estado, observaciones")
    .eq("id", data.viatico_id)
    .single();
  if (error || !v) return { ok: false, error: "Viático no encontrado." };
  if (v.estado !== "pendiente_rendicion") return { ok: false, error: "El viático ya fue rendido." };

  // Regla de rendición centralizada en flujo-logic (computeRendicion).
  const { rendido, devuelto, diferencia, estado } = computeRendicion(
    Number(v.monto_entregado ?? 0),
    data.monto_rendido,
    data.monto_devuelto,
  );

  const obsFinal = data.observaciones?.trim()
    ? `${v.observaciones ? v.observaciones + " · " : ""}Rendición: ${data.observaciones.trim()}`
    : v.observaciones;

  const { error: updErr } = await supabase
    .from("viaticos")
    .update({
      estado,
      fecha_rendicion: data.fecha_rendicion,
      monto_rendido: rendido,
      monto_devuelto: devuelto,
      diferencia,
      observaciones: obsFinal,
    })
    .eq("id", v.id);
  if (updErr) {
    console.error("Error al rendir viático:", updErr);
    return { ok: false, error: "No se pudo registrar la rendición." };
  }

  // El vuelto en efectivo reingresa a la caja, vinculado al viático.
  if (devuelto > 0) {
    const cajaInsert = {
      tipo: "ingreso" as const,
      categoria: "rendicion_vuelto" as const,
      concepto: "Vuelto de rendición de viático",
      monto: devuelto,
      medio: "efectivo" as const,
      fecha: data.fecha_rendicion,
      moneda: "ARS",
      viatico_id: v.id,
      chofer_id: v.chofer_id,
      created_by: user.id,
    };
    const { data: cajaMov, error: cajaError } = await supabase
      .from("caja_movimientos")
      .insert(cajaInsert)
      .select("id")
      .single();
    if (cajaError) console.error("Error al reflejar vuelto en caja:", cajaError);
    else if (cajaMov?.id) await logCajaAudit(supabase, cajaMov.id, "crear", null, cajaInsert, user.id);
  }

  revalidatePath("/caja");
  return { ok: true };
}
