"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ChequeTipo = "comun" | "diferido" | "electronico";
export type ChequeEstado =
  | "cartera"
  | "entregado"
  | "depositado"
  | "acreditado"
  | "rechazado"
  | "anulado";
export type ChequeMotivoRechazo =
  | "sin_fondos"
  | "firma_no_corresponde"
  | "cuenta_cerrada"
  | "formal"
  | "otro";

async function logChequeAudit(
  supabase: ReturnType<typeof createAdminClient>,
  chequeId: string,
  accion: "crear" | "cambio_estado" | "actualizar" | "eliminar",
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string,
) {
  await logAudit({
    accion,
    entidadTipo: "cheque",
    entidadId: chequeId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
    client: supabase,
  });
}

const TRANSICIONES_VALIDAS: Record<ChequeEstado, ChequeEstado[]> = {
  cartera: ["entregado", "depositado", "rechazado", "anulado"],
  entregado: [],
  depositado: ["acreditado", "rechazado"],
  acreditado: [],
  rechazado: [],
  anulado: [],
};

export type CreateChequeInput = {
  numero?: string | null;
  banco_id?: string | null;
  sucursal_banco?: string | null;
  cuenta_corriente?: string | null;
  librador_nombre: string;
  librador_cuit?: string | null;
  cliente_id?: string | null;
  recibido_de?: string | null;
  tipo?: ChequeTipo;
  importe: number;
  fecha_emision?: string | null;
  fecha_vencimiento: string;
  fecha_recepcion?: string | null;
  concepto?: string | null;
  observaciones?: string | null;
};

export async function createChequeAction(input: CreateChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.librador_nombre?.trim()) return { error: "El librador es obligatorio." };
  if (!input.importe || isNaN(input.importe) || input.importe <= 0) {
    return { error: "El importe debe ser mayor a 0." };
  }
  if (!input.fecha_vencimiento) {
    return { error: "La fecha de vencimiento es obligatoria." };
  }

  // Los cheques de Loma Negra son siempre echeq diferidos electrónicos; el resto
  // de los campos es opcional. La fecha de recepción default es hoy (alta).
  const hoy = new Date().toISOString().split("T")[0];
  const fechaRecepcion = input.fecha_recepcion || hoy;

  const insertData = {
    numero: input.numero?.trim() || null,
    banco_id: input.banco_id || null,
    sucursal_banco: input.sucursal_banco?.trim() || null,
    cuenta_corriente: input.cuenta_corriente?.trim() || null,
    librador_nombre: input.librador_nombre.trim(),
    librador_cuit: input.librador_cuit?.trim() || null,
    cliente_id: input.cliente_id || null,
    recibido_de: input.recibido_de?.trim() || null,
    tipo: (input.tipo ?? "electronico") as ChequeTipo,
    importe: input.importe,
    moneda: "ARS",
    fecha_emision: input.fecha_emision || null,
    fecha_vencimiento: input.fecha_vencimiento,
    fecha_recepcion: fechaRecepcion,
    concepto: input.concepto?.trim() || null,
    observaciones: input.observaciones?.trim() || null,
    estado: "cartera" as ChequeEstado,
    fecha_estado_actual: fechaRecepcion,
    created_by: user.id,
  };

  const { data: inserted, error } = await supabase
    .from("cheques")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    console.error("Error al registrar cheque:", error);
    if (error.code === "23505") {
      return { error: "Ya existe un cheque con ese número en el mismo banco." };
    }
    return { error: "No se pudo registrar el cheque." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("cheque_historial_estado" as any).insert({
    cheque_id: inserted!.id,
    estado_anterior: null,
    estado_nuevo: "cartera",
    fecha: fechaRecepcion,
    motivo: "Alta de cheque",
    observaciones: input.observaciones?.trim() || null,
    usuario_id: user.id,
  });

  await logChequeAudit(supabase, inserted!.id, "crear", null, insertData, user.id);

  revalidatePath("/cheques");
  return { success: true };
}

async function fetchChequeEstado(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cheques")
    .select("estado")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data.estado as ChequeEstado;
}

function validateTransicion(actual: ChequeEstado, destino: ChequeEstado): string | null {
  const permitidas = TRANSICIONES_VALIDAS[actual];
  if (!permitidas.includes(destino)) {
    return `No se puede pasar de "${actual}" a "${destino}".`;
  }
  return null;
}

async function registrarHistorial(params: {
  cheque_id: string;
  estado_anterior: ChequeEstado;
  estado_nuevo: ChequeEstado;
  fecha: string;
  motivo?: string | null;
  observaciones?: string | null;
  usuario_id: string;
}) {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("cheque_historial_estado" as any).insert({
    cheque_id: params.cheque_id,
    estado_anterior: params.estado_anterior,
    estado_nuevo: params.estado_nuevo,
    fecha: params.fecha,
    motivo: params.motivo ?? null,
    observaciones: params.observaciones ?? null,
    usuario_id: params.usuario_id,
  });
}

export type EntregarChequeInput = {
  id: string;
  entregado_a: string;
  fecha_entrega: string;
  observaciones?: string | null;
};

export async function entregarChequeAction(input: EntregarChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.entregado_a?.trim()) return { error: "Indicá a quién se entrega el cheque." };
  if (!input.fecha_entrega) return { error: "La fecha de entrega es obligatoria." };

  const estadoActual = await fetchChequeEstado(input.id);
  if (!estadoActual) return { error: "Cheque no encontrado." };
  const invalido = validateTransicion(estadoActual, "entregado");
  if (invalido) return { error: invalido };

  const { error } = await supabase
    .from("cheques")
    .update({
      estado: "entregado",
      entregado_a: input.entregado_a.trim(),
      fecha_entrega: input.fecha_entrega,
      fecha_estado_actual: input.fecha_entrega,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error al entregar cheque:", error);
    return { error: "No se pudo registrar la entrega." };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "entregado",
    fecha: input.fecha_entrega,
    motivo: `Entregado a ${input.entregado_a.trim()}`,
    observaciones: input.observaciones,
    usuario_id: user.id,
  });

  await logChequeAudit(
    supabase,
    input.id,
    "cambio_estado",
    { estado: estadoActual },
    {
      estado: "entregado",
      entregado_a: input.entregado_a.trim(),
      fecha_entrega: input.fecha_entrega,
      observaciones: input.observaciones?.trim() || null,
    },
    user.id,
  );

  revalidatePath("/cheques");
  return { success: true };
}

export type DepositarChequeInput = {
  id: string;
  banco_deposito: string;
  fecha_deposito: string;
  observaciones?: string | null;
};

export async function depositarChequeAction(input: DepositarChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.banco_deposito?.trim()) return { error: "Indicá el banco de depósito." };
  if (!input.fecha_deposito) return { error: "La fecha de depósito es obligatoria." };

  const estadoActual = await fetchChequeEstado(input.id);
  if (!estadoActual) return { error: "Cheque no encontrado." };
  const invalido = validateTransicion(estadoActual, "depositado");
  if (invalido) return { error: invalido };

  const { error } = await supabase
    .from("cheques")
    .update({
      estado: "depositado",
      banco_deposito: input.banco_deposito.trim(),
      fecha_deposito: input.fecha_deposito,
      fecha_estado_actual: input.fecha_deposito,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error al depositar cheque:", error);
    return { error: "No se pudo registrar el depósito." };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "depositado",
    fecha: input.fecha_deposito,
    motivo: `Depositado en ${input.banco_deposito.trim()}`,
    observaciones: input.observaciones,
    usuario_id: user.id,
  });

  await logChequeAudit(
    supabase,
    input.id,
    "cambio_estado",
    { estado: estadoActual },
    {
      estado: "depositado",
      banco_deposito: input.banco_deposito.trim(),
      fecha_deposito: input.fecha_deposito,
      observaciones: input.observaciones?.trim() || null,
    },
    user.id,
  );

  revalidatePath("/cheques");
  return { success: true };
}

export type AcreditarChequeInput = {
  id: string;
  fecha: string;
  observaciones?: string | null;
};

export async function acreditarChequeAction(input: AcreditarChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.fecha) return { error: "La fecha de acreditación es obligatoria." };

  const estadoActual = await fetchChequeEstado(input.id);
  if (!estadoActual) return { error: "Cheque no encontrado." };
  const invalido = validateTransicion(estadoActual, "acreditado");
  if (invalido) return { error: invalido };

  const { error } = await supabase
    .from("cheques")
    .update({
      estado: "acreditado",
      fecha_estado_actual: input.fecha,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error al acreditar cheque:", error);
    return { error: "No se pudo registrar la acreditación." };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "acreditado",
    fecha: input.fecha,
    motivo: "Acreditado en cuenta",
    observaciones: input.observaciones,
    usuario_id: user.id,
  });

  await logChequeAudit(
    supabase,
    input.id,
    "cambio_estado",
    { estado: estadoActual },
    {
      estado: "acreditado",
      fecha_estado_actual: input.fecha,
      observaciones: input.observaciones?.trim() || null,
    },
    user.id,
  );

  revalidatePath("/cheques");
  return { success: true };
}

export type RechazarChequeInput = {
  id: string;
  motivo: ChequeMotivoRechazo;
  motivo_detalle?: string | null;
  fecha: string;
  observaciones?: string | null;
};

export async function rechazarChequeAction(input: RechazarChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.motivo) return { error: "Seleccioná el motivo del rechazo." };
  if (!input.fecha) return { error: "La fecha de rechazo es obligatoria." };

  const estadoActual = await fetchChequeEstado(input.id);
  if (!estadoActual) return { error: "Cheque no encontrado." };
  const invalido = validateTransicion(estadoActual, "rechazado");
  if (invalido) return { error: invalido };

  const { error } = await supabase
    .from("cheques")
    .update({
      estado: "rechazado",
      motivo_rechazo: input.motivo,
      motivo_rechazo_detalle: input.motivo_detalle?.trim() || null,
      fecha_rechazo: input.fecha,
      fecha_estado_actual: input.fecha,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error al rechazar cheque:", error);
    return { error: "No se pudo registrar el rechazo." };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "rechazado",
    fecha: input.fecha,
    motivo: `Rechazo: ${input.motivo}${input.motivo_detalle ? ` — ${input.motivo_detalle.trim()}` : ""}`,
    observaciones: input.observaciones,
    usuario_id: user.id,
  });

  await logChequeAudit(
    supabase,
    input.id,
    "cambio_estado",
    { estado: estadoActual },
    {
      estado: "rechazado",
      motivo_rechazo: input.motivo,
      motivo_rechazo_detalle: input.motivo_detalle?.trim() || null,
      fecha_rechazo: input.fecha,
      observaciones: input.observaciones?.trim() || null,
    },
    user.id,
  );

  revalidatePath("/cheques");
  return { success: true };
}

export type AnularChequeInput = {
  id: string;
  motivo: string;
  fecha: string;
  observaciones?: string | null;
};

export async function anularChequeAction(input: AnularChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.motivo?.trim()) return { error: "Indicá el motivo de la anulación." };
  if (!input.fecha) return { error: "La fecha de anulación es obligatoria." };

  const estadoActual = await fetchChequeEstado(input.id);
  if (!estadoActual) return { error: "Cheque no encontrado." };
  const invalido = validateTransicion(estadoActual, "anulado");
  if (invalido) return { error: invalido };

  const { error } = await supabase
    .from("cheques")
    .update({
      estado: "anulado",
      fecha_estado_actual: input.fecha,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error al anular cheque:", error);
    return { error: "No se pudo anular el cheque." };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "anulado",
    fecha: input.fecha,
    motivo: input.motivo.trim(),
    observaciones: input.observaciones,
    usuario_id: user.id,
  });

  await logChequeAudit(
    supabase,
    input.id,
    "cambio_estado",
    { estado: estadoActual },
    {
      estado: "anulado",
      motivo: input.motivo.trim(),
      fecha_estado_actual: input.fecha,
      observaciones: input.observaciones?.trim() || null,
    },
    user.id,
  );

  revalidatePath("/cheques");
  return { success: true };
}

export type ChequeExportRow = {
  id: string;
  numero: string;
  tipo: ChequeTipo;
  importe: number;
  moneda: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_recepcion: string;
  estado: ChequeEstado;
  librador_nombre: string;
  librador_cuit: string | null;
  concepto: string | null;
  observaciones: string | null;
  banco: { nombre: string } | null;
  cliente: { razon_social: string } | null;
};

export async function getAllChequesForExportAction(): Promise<ChequeExportRow[]> {
  await requireArea("finanzas", "read");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cheques")
    .select(
      "id, numero, tipo, importe, moneda, fecha_emision, fecha_vencimiento, fecha_recepcion, estado, librador_nombre, librador_cuit, concepto, observaciones, banco:bancos(nombre), cliente:clientes(razon_social)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener cheques para exportar:", error);
    return [];
  }

  return (data ?? []).map((c) => ({
    ...c,
    importe: Number(c.importe),
    banco: Array.isArray(c.banco) ? (c.banco[0] ?? null) : c.banco,
    cliente: Array.isArray(c.cliente) ? (c.cliente[0] ?? null) : c.cliente,
  })) as ChequeExportRow[];
}
