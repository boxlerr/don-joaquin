"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ChequeTipo = "comun" | "diferido" | "electronico";

export type CreateChequeInput = {
  numero: string;
  banco_id: string;
  sucursal_banco?: string | null;
  cuenta_corriente?: string | null;
  librador_nombre: string;
  librador_cuit?: string | null;
  cliente_id?: string | null;
  recibido_de?: string | null;
  tipo: ChequeTipo;
  importe: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_recepcion: string;
  concepto?: string | null;
  observaciones?: string | null;
};

export async function createChequeAction(input: CreateChequeInput) {
  const user = await requireUser();
  const supabase = createAdminClient();

  if (!input.numero?.trim()) return { error: "El número de cheque es obligatorio." };
  if (!input.banco_id) return { error: "Seleccioná un banco." };
  if (!input.librador_nombre?.trim()) return { error: "El librador es obligatorio." };
  if (!input.importe || isNaN(input.importe) || input.importe <= 0) {
    return { error: "El importe debe ser mayor a 0." };
  }
  if (!input.fecha_emision || !input.fecha_vencimiento || !input.fecha_recepcion) {
    return { error: "Las fechas son obligatorias." };
  }

  const { error } = await supabase.from("cheques").insert({
    numero: input.numero.trim(),
    banco_id: input.banco_id,
    sucursal_banco: input.sucursal_banco?.trim() || null,
    cuenta_corriente: input.cuenta_corriente?.trim() || null,
    librador_nombre: input.librador_nombre.trim(),
    librador_cuit: input.librador_cuit?.trim() || null,
    cliente_id: input.cliente_id || null,
    recibido_de: input.recibido_de?.trim() || null,
    tipo: input.tipo,
    importe: input.importe,
    moneda: "ARS",
    fecha_emision: input.fecha_emision,
    fecha_vencimiento: input.fecha_vencimiento,
    fecha_recepcion: input.fecha_recepcion,
    concepto: input.concepto?.trim() || null,
    observaciones: input.observaciones?.trim() || null,
    estado: "cartera",
    fecha_estado_actual: input.fecha_recepcion,
    created_by: user.id,
  });

  if (error) {
    console.error("Error al registrar cheque:", error);
    if (error.code === "23505") {
      return { error: "Ya existe un cheque con ese número en el mismo banco." };
    }
    return { error: "No se pudo registrar el cheque." };
  }

  revalidatePath("/cheques");
  return { success: true };
}
