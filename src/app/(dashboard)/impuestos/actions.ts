"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// `impuesto_vencimientos` es tabla nueva; se accede con `as any` hasta regenerar database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ImpuestoRow = {
  id: string;
  nombre: string;
  organismo: string | null;
  periodo: string | null;
  fecha_vencimiento: string;
  presentado: boolean;
  presentado_at: string | null;
  observaciones: string | null;
};

export async function getImpuestosAction(): Promise<ImpuestoRow[]> {
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("id, nombre, organismo, periodo, fecha_vencimiento, presentado, presentado_at, observaciones")
    .order("fecha_vencimiento", { ascending: true });
  return (data ?? []) as ImpuestoRow[];
}

export async function togglePresentadoImpuestoAction(
  id: string,
  presentado: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({
      presentado,
      presentado_at: presentado ? new Date().toISOString() : null,
      presentado_por: presentado ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el estado." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "impuesto",
    entidadId: id,
    valoresNuevos: { presentado },
    metadata: { evento: presentado ? "marcado_presentado" : "desmarcado" },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function updateImpuestoAction(
  id: string,
  data: { nombre: string; organismo: string | null; fecha_vencimiento: string; observaciones: string | null },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (!data.nombre.trim()) return { error: "El nombre es obligatorio." };
  if (!data.fecha_vencimiento) return { error: "La fecha de vencimiento es obligatoria." };

  const supabase = createAdminClient();

  const { data: previo } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, organismo, fecha_vencimiento, observaciones")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .update({
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
      observaciones: data.observaciones?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el impuesto." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "impuesto",
    entidadId: id,
    valoresAnteriores: previo ?? null,
    valoresNuevos: {
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
      observaciones: data.observaciones?.trim() || null,
    },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function createImpuestoAction(
  data: { nombre: string; organismo: string | null; periodo: string | null; fecha_vencimiento: string },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  if (!data.nombre.trim()) return { error: "El nombre es obligatorio." };
  if (!data.fecha_vencimiento) return { error: "La fecha de vencimiento es obligatoria." };

  const supabase = createAdminClient();
  const { data: inserted, error } = await (supabase as any)
    .from("impuesto_vencimientos")
    .insert({
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      periodo: data.periodo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "No se pudo crear el impuesto." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "impuesto",
    entidadId: inserted.id,
    valoresNuevos: {
      nombre: data.nombre.trim(),
      organismo: data.organismo?.trim() || null,
      periodo: data.periodo?.trim() || null,
      fecha_vencimiento: data.fecha_vencimiento,
    },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

export async function deleteImpuestoAction(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const { data: previo } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("nombre, organismo, fecha_vencimiento")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("impuesto_vencimientos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el impuesto." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "impuesto",
    entidadId: id,
    valoresAnteriores: previo ?? null,
  });

  revalidatePath("/impuestos");
  return { ok: true };
}
