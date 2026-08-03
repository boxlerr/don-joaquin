"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireArea, requireSeccion } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import {
  ESTADOS_ORIGEN_EDITABLE,
  estadoAlCambiarOrigen,
  estadoInicial,
  validateTransicion,
  type ChequeEstado,
  type ChequeOrigen,
  type ChequeTipo,
} from "./transiciones";

export type { ChequeEstado, ChequeOrigen, ChequeTipo };

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

/**
 * Devuelve el id del banco a partir de su nombre. La lista nunca va a tener
 * todos los bancos del país, así que si el que se escribió no existe se crea
 * (queda disponible para la próxima carga y para el filtro del listado).
 */
async function resolveBancoId(
  supabase: ReturnType<typeof createAdminClient>,
  nombre?: string | null,
): Promise<string | null> {
  const limpio = nombre?.trim();
  if (!limpio) return null;

  // `ilike` sin comodines = comparación exacta sin distinguir mayúsculas.
  const patron = limpio.replace(/[\\%_*]/g, (c) => `\\${c}`);
  const buscar = async () => {
    const { data } = await supabase
      .from("bancos")
      .select("id")
      .ilike("nombre", patron)
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  };

  const existente = await buscar();
  if (existente) return existente;

  const { data: creado, error } = await supabase
    .from("bancos")
    .insert({ nombre: limpio, estado: "activo" })
    .select("id")
    .single();
  if (creado) return creado.id;

  // 23505 = otro alta simultánea lo creó primero (bancos.nombre es UNIQUE).
  if (error?.code === "23505") return buscar();

  console.error("Error al crear el banco:", error);
  return null;
}

/**
 * Deja el librador guardado en el catálogo para la próxima carga. Como la
 * lista nunca va a estar completa, lo que se escribe en el campo se guarda
 * solo (igual que los bancos). Si ya existe y ahora se cargó el CUIT, se lo
 * completa.
 *
 * `cheques.librador_nombre` es texto, no una FK: el catálogo son sugerencias,
 * así que borrar un librador de la lista nunca toca los cheques ya cargados.
 */
async function guardarLibrador(
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string,
  cuit: string | null,
  userId: string,
) {
  const limpio = nombre.trim();
  if (!limpio) return;
  const cuitLimpio = cuit?.trim() || null;

  // `ilike` sin comodines = comparación exacta sin distinguir mayúsculas.
  const patron = limpio.replace(/[\\%_*]/g, (c) => `\\${c}`);
  const { data: existente } = await supabase
    .from("libradores")
    .select("id, cuit")
    .ilike("nombre", patron)
    .limit(1)
    .maybeSingle();

  if (existente) {
    if (cuitLimpio && !existente.cuit) {
      await supabase.from("libradores").update({ cuit: cuitLimpio }).eq("id", existente.id);
    }
    return;
  }

  const { error } = await supabase
    .from("libradores")
    .insert({ nombre: limpio, cuit: cuitLimpio, created_by: userId });

  // 23505 = otra carga simultánea lo creó primero (nombre es UNIQUE).
  if (error && error.code !== "23505") {
    console.error("Error al guardar el librador:", error);
  }
}

/**
 * Saca un librador de las sugerencias. No toca los cheques: los que ya se
 * cargaron con ese nombre lo conservan.
 */
export async function eliminarLibradorAction(id: string) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { data: anterior } = await supabase
    .from("libradores")
    .select("nombre, cuit")
    .eq("id", id)
    .maybeSingle();

  if (!anterior) return { error: "Ese librador ya no está en la lista." };

  const { error } = await supabase.from("libradores").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar librador:", error);
    return { error: "No se pudo sacar el librador de la lista." };
  }

  await logAudit({
    accion: "eliminar",
    entidadTipo: "librador",
    entidadId: id,
    usuarioId: user.id,
    valoresAnteriores: anterior,
    valoresNuevos: null,
    client: supabase,
  });

  revalidatePath("/cheques");
  return { success: true };
}

export type CreateChequeInput = {
  numero?: string | null;
  banco_nombre?: string | null;
  sucursal_banco?: string | null;
  cuenta_corriente?: string | null;
  librador_nombre: string;
  librador_cuit?: string | null;
  cliente_id?: string | null;
  recibido_de?: string | null;
  origen?: ChequeOrigen;
  /** Sólo para los propios: a quién se le entregó (si ya se entregó). */
  entregado_a?: string | null;
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
  const origen: ChequeOrigen = input.origen ?? "recibido";
  const entregadoA = input.entregado_a?.trim() || null;

  const estado = estadoInicial(origen, entregadoA);

  const insertData = {
    numero: input.numero?.trim() || null,
    banco_id: await resolveBancoId(supabase, input.banco_nombre),
    sucursal_banco: input.sucursal_banco?.trim() || null,
    cuenta_corriente: input.cuenta_corriente?.trim() || null,
    librador_nombre: input.librador_nombre.trim(),
    librador_cuit: input.librador_cuit?.trim() || null,
    cliente_id: input.cliente_id || null,
    recibido_de: input.recibido_de?.trim() || null,
    origen,
    entregado_a: origen === "propio" ? entregadoA : null,
    fecha_entrega: origen === "propio" && entregadoA ? fechaRecepcion : null,
    tipo: (input.tipo ?? "electronico") as ChequeTipo,
    importe: input.importe,
    moneda: "ARS",
    fecha_emision: input.fecha_emision || null,
    fecha_vencimiento: input.fecha_vencimiento,
    fecha_recepcion: fechaRecepcion,
    concepto: input.concepto?.trim() || null,
    observaciones: input.observaciones?.trim() || null,
    estado,
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
    return { error: `No se pudo registrar el cheque: ${error.message}` };
  }

  await guardarLibrador(supabase, input.librador_nombre, input.librador_cuit ?? null, user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("cheque_historial_estado" as any).insert({
    cheque_id: inserted!.id,
    estado_anterior: null,
    estado_nuevo: estado,
    fecha: fechaRecepcion,
    motivo: origen === "propio" ? "Alta de cheque propio" : "Alta de cheque",
    observaciones: input.observaciones?.trim() || null,
    usuario_id: user.id,
  });

  await logChequeAudit(supabase, inserted!.id, "crear", null, insertData, user.id);

  revalidatePath("/cheques");
  return { success: true };
}

export type UpdateChequeInput = {
  id: string;
  numero?: string | null;
  banco_nombre?: string | null;
  sucursal_banco?: string | null;
  cuenta_corriente?: string | null;
  librador_nombre: string;
  librador_cuit?: string | null;
  origen?: ChequeOrigen;
  tipo?: ChequeTipo;
  importe: number;
  fecha_vencimiento: string;
  observaciones?: string | null;
};

/**
 * Corrige los datos de un cheque ya cargado. El estado NO se toca acá: se
 * cambia con las transiciones (entregar / depositar / …) para no perder el
 * historial.
 *
 * La excepción es el origen: si se cargó un cheque nuestro como recibido (o al
 * revés), corregirlo mueve también el estado a su equivalente del otro lado,
 * porque "en cartera" y "emitido" son el mismo punto de partida visto desde
 * cada lado. Sólo se permite mientras el cheque no arrancó a moverse.
 */
export async function updateChequeAction(input: UpdateChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.librador_nombre?.trim()) return { error: "El librador es obligatorio." };
  if (!input.importe || isNaN(input.importe) || input.importe <= 0) {
    return { error: "El importe debe ser mayor a 0." };
  }
  if (!input.fecha_vencimiento) {
    return { error: "La fecha de vencimiento es obligatoria." };
  }

  const { data: anterior } = await supabase
    .from("cheques")
    .select(
      "numero, banco_id, sucursal_banco, cuenta_corriente, librador_nombre, librador_cuit, tipo, importe, fecha_vencimiento, observaciones, estado, origen",
    )
    .eq("id", input.id)
    .single();

  if (!anterior) return { error: "Cheque no encontrado." };

  const origenAnterior = ((anterior as { origen?: ChequeOrigen }).origen ??
    "recibido") as ChequeOrigen;
  const estadoAnterior = anterior.estado as ChequeEstado;
  const origenNuevo = input.origen ?? origenAnterior;
  const cambiaOrigen = origenNuevo !== origenAnterior;

  if (cambiaOrigen && !ESTADOS_ORIGEN_EDITABLE.includes(estadoAnterior)) {
    return {
      error:
        "El cheque ya está en circulación: no se puede cambiar de lado. Si se cargó mal, borralo y cargalo de nuevo.",
    };
  }

  // Al cruzar de lado, el punto de partida cambia de nombre.
  const estadoTraducido = cambiaOrigen
    ? estadoAlCambiarOrigen(estadoAnterior, origenNuevo)
    : null;

  const updateData = {
    numero: input.numero?.trim() || null,
    banco_id: await resolveBancoId(supabase, input.banco_nombre),
    sucursal_banco: input.sucursal_banco?.trim() || null,
    cuenta_corriente: input.cuenta_corriente?.trim() || null,
    librador_nombre: input.librador_nombre.trim(),
    librador_cuit: input.librador_cuit?.trim() || null,
    origen: origenNuevo,
    tipo: (input.tipo ?? "electronico") as ChequeTipo,
    importe: input.importe,
    fecha_vencimiento: input.fecha_vencimiento,
    observaciones: input.observaciones?.trim() || null,
    ...(estadoTraducido ? { estado: estadoTraducido } : {}),
  };

  const { error } = await supabase.from("cheques").update(updateData).eq("id", input.id);

  if (error) {
    console.error("Error al editar cheque:", error);
    if (error.code === "23505") {
      return { error: "Ya existe un cheque con ese número en el mismo banco." };
    }
    return { error: `No se pudo guardar el cheque: ${error.message}` };
  }

  await guardarLibrador(supabase, input.librador_nombre, input.librador_cuit ?? null, user.id);

  if (estadoTraducido) {
    await registrarHistorial({
      cheque_id: input.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoTraducido,
      fecha: new Date().toISOString().split("T")[0],
      motivo:
        origenNuevo === "propio"
          ? "Corregido: es un cheque nuestro"
          : "Corregido: es un cheque que recibimos",
      usuario_id: user.id,
    });
  }

  await logChequeAudit(supabase, input.id, "actualizar", anterior, updateData, user.id);

  revalidatePath("/cheques");
  return { success: true };
}

async function fetchCheque(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cheques")
    .select("estado, origen")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return {
    estado: data.estado as ChequeEstado,
    origen: ((data as { origen?: ChequeOrigen }).origen ?? "recibido") as ChequeOrigen,
  };
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

  const cheque = await fetchCheque(input.id);
  if (!cheque) return { error: "Cheque no encontrado." };
  const estadoActual = cheque.estado;
  const invalido = validateTransicion(estadoActual, "entregado", cheque.origen);
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
    return { error: `No se pudo registrar la entrega: ${error.message}` };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "entregado",
    fecha: input.fecha_entrega,
    motivo:
      cheque.origen === "recibido"
        ? `Endosado a ${input.entregado_a.trim()}`
        : `Entregado a ${input.entregado_a.trim()}`,
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

  const cheque = await fetchCheque(input.id);
  if (!cheque) return { error: "Cheque no encontrado." };
  const estadoActual = cheque.estado;
  const invalido = validateTransicion(estadoActual, "depositado", cheque.origen);
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
    return { error: `No se pudo registrar el depósito: ${error.message}` };
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

  const cheque = await fetchCheque(input.id);
  if (!cheque) return { error: "Cheque no encontrado." };
  const estadoActual = cheque.estado;
  const invalido = validateTransicion(estadoActual, "acreditado", cheque.origen);
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
    return { error: `No se pudo registrar la acreditación: ${error.message}` };
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

export type DebitarChequeInput = {
  id: string;
  fecha: string;
  observaciones?: string | null;
};

/**
 * Cierra un cheque propio: lo cobraron y la plata salió de la cuenta. Es el
 * equivalente a "acreditado" del lado de los recibidos.
 */
export async function debitarChequeAction(input: DebitarChequeInput) {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  if (!input.fecha) return { error: "La fecha del débito es obligatoria." };

  const cheque = await fetchCheque(input.id);
  if (!cheque) return { error: "Cheque no encontrado." };
  const estadoActual = cheque.estado;
  const invalido = validateTransicion(estadoActual, "debitado", cheque.origen);
  if (invalido) return { error: invalido };

  const { error } = await supabase
    .from("cheques")
    .update({
      estado: "debitado",
      fecha_estado_actual: input.fecha,
    })
    .eq("id", input.id);

  if (error) {
    console.error("Error al debitar cheque:", error);
    return { error: `No se pudo registrar el débito: ${error.message}` };
  }

  await registrarHistorial({
    cheque_id: input.id,
    estado_anterior: estadoActual,
    estado_nuevo: "debitado",
    fecha: input.fecha,
    motivo: "Debitado de la cuenta",
    observaciones: input.observaciones,
    usuario_id: user.id,
  });

  await logChequeAudit(
    supabase,
    input.id,
    "cambio_estado",
    { estado: estadoActual },
    {
      estado: "debitado",
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

  const cheque = await fetchCheque(input.id);
  if (!cheque) return { error: "Cheque no encontrado." };
  const estadoActual = cheque.estado;
  const invalido = validateTransicion(estadoActual, "rechazado", cheque.origen);
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
    return { error: `No se pudo registrar el rechazo: ${error.message}` };
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

  const cheque = await fetchCheque(input.id);
  if (!cheque) return { error: "Cheque no encontrado." };
  const estadoActual = cheque.estado;
  const invalido = validateTransicion(estadoActual, "anulado", cheque.origen);
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
    return { error: `No se pudo anular el cheque: ${error.message}` };
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

/**
 * Borra un cheque que se cargó por error. Se lleva con él su historial de
 * estados (la FK es ON DELETE CASCADE), así que no queda nada colgado.
 *
 * No se borra si la plata ya se movió: si el cheque está enganchado a un
 * movimiento de caja, a la cuenta corriente de un cliente, al cobro de una
 * factura o es el reemplazo de otro cheque rechazado, borrarlo dejaría esos
 * registros sin respaldo. En ese caso el camino es anularlo.
 */
export async function eliminarChequeAction(id: string) {
  const user = await requireSeccion("cheques", "write");
  const supabase = createAdminClient();

  const { data: anterior } = await supabase
    .from("cheques")
    .select(
      "numero, banco_id, librador_nombre, librador_cuit, importe, tipo, estado, fecha_vencimiento, fecha_recepcion, concepto, observaciones",
    )
    .eq("id", id)
    .maybeSingle();

  if (!anterior) return { error: "Ese cheque ya no existe." };

  const [{ count: enCaja }, { count: enCtaCte }, { count: enCobros }, { count: reemplaza }] =
    await Promise.all([
      supabase
        .from("caja_movimientos")
        .select("id", { count: "exact", head: true })
        .eq("cheque_id", id),
      supabase
        .from("cta_cte_movimientos")
        .select("id", { count: "exact", head: true })
        .eq("cheque_id", id),
      supabase
        .from("pago_cliente_detalle")
        .select("id", { count: "exact", head: true })
        .eq("cheque_id", id),
      supabase
        .from("cheques")
        .select("id", { count: "exact", head: true })
        .eq("cheque_reemplazo_id", id),
    ]);

  const enganches = [
    enCaja ? "un movimiento de caja" : null,
    enCtaCte ? "la cuenta corriente de un cliente" : null,
    enCobros ? "el cobro de una factura" : null,
    reemplaza ? "otro cheque que reemplaza" : null,
  ].filter(Boolean);

  if (enganches.length > 0) {
    return {
      error: `No se puede borrar: el cheque ya está vinculado a ${enganches.join(", ")}. Anulalo en lugar de borrarlo.`,
    };
  }

  const { error } = await supabase.from("cheques").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar cheque:", error);
    return { error: `No se pudo borrar el cheque: ${error.message}` };
  }

  await logChequeAudit(supabase, id, "eliminar", anterior, null, user.id);

  revalidatePath("/cheques");
  return { success: true };
}

export type ChequeExportRow = {
  id: string;
  numero: string;
  tipo: ChequeTipo;
  origen: ChequeOrigen;
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
      "id, numero, tipo, origen, importe, moneda, fecha_emision, fecha_vencimiento, fecha_recepcion, estado, librador_nombre, librador_cuit, concepto, observaciones, banco:bancos(nombre), cliente:clientes(razon_social)"
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
