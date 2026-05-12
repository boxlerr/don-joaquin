"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function addIngresoAction(data: {
  concepto: string;
  monto: number;
  medio: "efectivo" | "transferencia" | "cheque" | "otro";
  categoria: "cobro_cliente" | "rendicion_vuelto" | "transferencia_interna" | "ajuste" | "otro";
  fecha: string;
}) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("caja_movimientos").insert({
    tipo: "ingreso",
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    fecha: data.fecha,
    moneda: "ARS",
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
  const supabase = createAdminClient();

  const { error } = await supabase.from("caja_movimientos").insert({
    tipo: "egreso",
    concepto: data.concepto,
    monto: data.monto,
    medio: data.medio,
    categoria: data.categoria,
    gasto_id: data.tipo_gasto_id || null, // Lo asociamos si se seleccionó
    fecha: data.fecha,
    moneda: "ARS",
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
  const supabase = createAdminClient();

  // Buscar un responsable válido (el primer usuario disponible) como fallback robusto
  const { data: users } = await supabase.from("usuarios").select("id").limit(1);
  const responsable_entrega_id = users?.[0]?.id || "00000000-0000-0000-0000-000000000000";

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
  });

  if (cajaError) {
    console.error("Error al reflejar viático en caja:", cajaError);
  }

  revalidatePath("/caja");
  return { success: true };
}
