"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireArea, requireSeccion } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { computeRendicion } from "../viajes/flujo-logic";

const MOVIMIENTOS_PAGE_SIZE = 20;

/**
 * Las dos cajas físicas (audios Bárbara 30/06): la "diaria" es la operativa
 * multiusuario; la "grande" es privada de dirección (subsección caja_grande).
 * La columna `caja` es nueva (migración 20260701) y no está en los tipos
 * generados, por eso las queries que la tocan usan `(supabase as any)`.
 */
export type CajaId = "diaria" | "grande";

/**
 * Saldo/historial son confidenciales: la caja diaria exige la subsección
 * caja_saldo y la grande caja_grande (los admin tienen ambas siempre).
 */
async function requireVerCaja(caja: CajaId) {
  if (caja === "grande") await requireSeccion("caja_grande", "read");
  else await requireSeccion("caja_saldo", "read");
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
};

export type CajaResumen = {
  ingresos: number;
  egresos: number;
  movimientos: number;
  saldoTotal: number;
  /** Suma de fletes facturados que todavía no se cobraron (no entraron a caja). */
  pendienteCobro: number;
};

export async function getCajaResumenAction(params: {
  desde?: string;
  hasta?: string;
  caja?: CajaId;
}): Promise<CajaResumen | { error: string }> {
  const caja = params.caja ?? "diaria";
  await requireVerCaja(caja);
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rangoQuery = (supabase as any)
    .from("caja_movimientos")
    .select("tipo, monto")
    .eq("caja", caja);
  if (params.desde) rangoQuery = rangoQuery.gte("fecha", params.desde);
  if (params.hasta) rangoQuery = rangoQuery.lte("fecha", params.hasta);

  const [
    { data: rango, error: rangoError },
    { data: todos, error: todosError },
    { data: pendientes, error: pendientesError },
  ] = await Promise.all([
    rangoQuery,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("caja_movimientos").select("tipo, monto").eq("caja", caja),
    // Fletes facturados y todavía no cobrados (lo que falta volcar a la caja).
    // Es un concepto operativo: solo tiene sentido para la caja diaria.
    caja === "diaria"
      ? supabase
          .from("viajes")
          .select("monto_flete")
          .eq("facturado", true)
          .eq("cobrado", false)
          .eq("es_vacio", false)
      : Promise.resolve({ data: [] as { monto_flete: number | null }[], error: null }),
  ]);

  if (rangoError || todosError || pendientesError) {
    console.error(
      "Error al obtener resumen de caja:",
      rangoError ?? todosError ?? pendientesError,
    );
    return { error: "No se pudo cargar el resumen de caja." };
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
  const pendienteCobro = (pendientes ?? []).reduce(
    (acc, v) => acc + Number(v.monto_flete || 0),
    0,
  );

  return { ingresos, egresos, movimientos: rango?.length ?? 0, saldoTotal, pendienteCobro };
}

export type ViajeCobroOption = {
  id: string;
  codigo: string;
  fecha: string;
  cliente: string | null;
  cliente_id: string | null;
  monto_flete: number;
  facturado: boolean;
};

export async function getViajesParaCobroAction(): Promise<
  ViajeCobroOption[] | { error: string }
> {
  await requireArea("caja", "read");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("viajes")
    .select("id, codigo, fecha_viaje, monto_flete, facturado, cliente_id, clientes(razon_social)")
    .not("monto_flete", "is", null)
    .eq("es_vacio", false)
    .order("fecha_viaje", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Error al obtener viajes para cobro:", error);
    return { error: "No se pudieron cargar los viajes." };
  }

  return (data ?? []).map((v) => {
    const cliente = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
    return {
      id: v.id,
      codigo: v.codigo,
      fecha: v.fecha_viaje,
      cliente: cliente?.razon_social ?? null,
      cliente_id: v.cliente_id,
      monto_flete: Number(v.monto_flete),
      facturado: v.facturado,
    };
  });
}

export type GetCajaMovimientosParams = {
  desde?: string;
  hasta?: string;
  tipoGastoId?: string;
  categoria?: string;
  search?: string;
  page?: number;
  caja?: CajaId;
};

export type GetCajaMovimientosResult =
  | { data: CajaMovimientoRow[]; hasMore: boolean; count: number }
  | { error: string };

export async function getCajaMovimientosAction(
  params: GetCajaMovimientosParams = {}
): Promise<GetCajaMovimientosResult> {
  const { desde, hasta, tipoGastoId, categoria, search, page = 0, caja = "diaria" } = params;
  await requireVerCaja(caja);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("caja_movimientos")
    .select(
      "id, fecha, tipo, categoria, concepto, monto, medio, cliente_id, chofer_id, viaje_id, gasto_id, created_by",
      { count: "exact" }
    )
    .eq("caja", caja)
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
    };
  });

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * MOVIMIENTOS_PAGE_SIZE,
    count: count ?? 0,
  };
}

export type MisMovimientoRow = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  concepto: string;
  monto: number;
  medio: string;
};

/**
 * Modo operador (operar ≠ ver): quien puede cargar movimientos pero no tiene
 * caja_saldo solo ve SUS últimas cargas de la caja diaria — sin totales ni
 * saldo — para chequear que lo suyo quedó registrado.
 */
export async function getMisMovimientosRecientesAction(): Promise<
  MisMovimientoRow[] | { error: string }
> {
  const user = await requireArea("caja", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caja_movimientos")
    .select("id, fecha, tipo, categoria, concepto, monto, medio")
    .eq("caja", "diaria")
    .eq("created_by", user.id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error al obtener movimientos propios:", error);
    return { error: "No se pudieron cargar tus movimientos." };
  }

  return ((data ?? []) as MisMovimientoRow[]).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    categoria: m.categoria,
    concepto: m.concepto,
    monto: Number(m.monto),
    medio: m.medio,
  }));
}

export async function addIngresoAction(data: {
  concepto: string;
  monto: number;
  medio: "efectivo" | "transferencia" | "cheque" | "otro";
  categoria: "cobro_cliente" | "rendicion_vuelto" | "transferencia_interna" | "ajuste" | "otro";
  fecha: string;
  viaje_id?: string | null;
  cliente_id?: string | null;
  caja?: CajaId;
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
    viaje_id: data.viaje_id ?? null,
    cliente_id: data.cliente_id ?? null,
    moneda: "ARS",
    caja,
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

  // Si el ingreso es un cobro de flete vinculado a un viaje, marcamos el viaje
  // como cobrado para que no quede pendiente de cobro ni se cobre dos veces.
  // Solo aplica a la diaria: el cobro de fletes es operativo.
  if (caja === "diaria" && data.viaje_id && data.categoria === "cobro_cliente") {
    const { data: viajePrev } = await supabase
      .from("viajes")
      .select("cobrado, facturado")
      .eq("id", data.viaje_id)
      .single();

    // Sólo se puede marcar cobrado un viaje facturado (constraint en DB).
    if (viajePrev && viajePrev.facturado && !viajePrev.cobrado) {
      const cobroUpdate = { cobrado: true, fecha_cobro: data.fecha };
      await supabase.from("viajes").update(cobroUpdate).eq("id", data.viaje_id);
      await logAudit({
        accion: "cobrado",
        entidadTipo: "viaje",
        entidadId: data.viaje_id,
        usuarioId: user.id,
        valoresAnteriores: { cobrado: false, fecha_cobro: null },
        valoresNuevos: cobroUpdate,
        client: supabase,
      });
      revalidatePath("/viajes");
    }
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
