"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

const MOVIMIENTOS_PAGE_SIZE = 20;

async function logCajaAudit(
  supabase: ReturnType<typeof createAdminClient>,
  movimientoId: string,
  accion: "crear" | "actualizar" | "eliminar",
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    usuario_id: userId,
    accion,
    entidad_tipo: "caja",
    entidad_id: movimientoId,
    valores_anteriores: valoresAnteriores,
    valores_nuevos: valoresNuevos,
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

  const insertData = {
    tipo: "ingreso" as const,
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    fecha: data.fecha,
    moneda: "ARS",
    created_by: user.id,
  };

  const { data: inserted, error } = await supabase
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

  const insertData = {
    tipo: "egreso" as const,
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    gasto_id: gastoId,
    fecha: data.fecha,
    moneda: "ARS",
    created_by: user.id,
  };

  const { data: inserted, error } = await supabase
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

  const user = await requireUser();
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
