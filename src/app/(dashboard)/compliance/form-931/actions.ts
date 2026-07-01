"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ensureProximoForm931 } from "./periodo";

// `form931_presentaciones` es tabla nueva; se accede con `as any` hasta regenerar database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Canal931 = "ypf" | "loma";

export type Form931Row = {
  id: string;
  periodo: string;
  fecha_limite: string;
  enviado_ypf: boolean;
  enviado_ypf_at: string | null;
  enviado_loma: boolean;
  enviado_loma_at: string | null;
  observaciones: string | null;
};

export async function getForm931Action(): Promise<Form931Row[]> {
  const user = await requireArea("compliance", "read");
  const supabase = createAdminClient();
  // Auto-genera el próximo período (día 20) si falta, para no cargarlo a mano.
  await ensureProximoForm931(supabase, user.id);
  const { data } = await (supabase as any)
    .from("form931_presentaciones")
    .select(
      "id, periodo, fecha_limite, enviado_ypf, enviado_ypf_at, enviado_loma, enviado_loma_at, observaciones",
    )
    .order("fecha_limite", { ascending: false });
  return (data ?? []) as Form931Row[];
}

/** Marca/desmarca el envío de un canal (YPF = Nico, Loma = Noelia). */
export async function toggleEnvioForm931Action(
  id: string,
  canal: Canal931,
  enviado: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();

  const prefijo = canal === "ypf" ? "enviado_ypf" : "enviado_loma";
  const { error } = await (supabase as any)
    .from("form931_presentaciones")
    .update({
      [prefijo]: enviado,
      [`${prefijo}_at`]: enviado ? new Date().toISOString() : null,
      [`${prefijo}_por`]: enviado ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el envío." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "form931",
    entidadId: id,
    valoresNuevos: { canal, enviado },
    metadata: { evento: enviado ? "marcado_enviado" : "desmarcado", canal },
  });

  revalidatePath("/compliance");
  return { ok: true };
}

export async function updateForm931Action(
  id: string,
  data: { periodo: string; fecha_limite: string; observaciones: string | null },
): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("compliance", "write");
  if (!data.periodo.trim()) return { error: "El período es obligatorio." };
  if (!data.fecha_limite) return { error: "La fecha límite es obligatoria." };

  const supabase = createAdminClient();

  const { data: previo } = await (supabase as any)
    .from("form931_presentaciones")
    .select("periodo, fecha_limite, observaciones")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any)
    .from("form931_presentaciones")
    .update({
      periodo: data.periodo.trim(),
      fecha_limite: data.fecha_limite,
      observaciones: data.observaciones?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el período." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "form931",
    entidadId: id,
    valoresAnteriores: previo ?? null,
    valoresNuevos: {
      periodo: data.periodo.trim(),
      fecha_limite: data.fecha_limite,
      observaciones: data.observaciones?.trim() || null,
    },
  });

  revalidatePath("/compliance");
  return { ok: true };
}

export async function createForm931Action(data: {
  periodo: string;
  fecha_limite: string;
  observaciones: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("compliance", "write");
  if (!data.periodo.trim()) return { error: "El período es obligatorio." };
  if (!data.fecha_limite) return { error: "La fecha límite es obligatoria." };

  const supabase = createAdminClient();
  const { data: inserted, error } = await (supabase as any)
    .from("form931_presentaciones")
    .insert({
      periodo: data.periodo.trim(),
      fecha_limite: data.fecha_limite,
      observaciones: data.observaciones?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    // 23505 = unique violation (período repetido)
    if ((error as { code?: string } | null)?.code === "23505") {
      return { error: "Ya existe un Formulario 931 para ese período." };
    }
    return { error: "No se pudo crear el período." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "form931",
    entidadId: inserted.id,
    valoresNuevos: {
      periodo: data.periodo.trim(),
      fecha_limite: data.fecha_limite,
      observaciones: data.observaciones?.trim() || null,
    },
  });

  revalidatePath("/compliance");
  return { ok: true };
}

export async function deleteForm931Action(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireArea("compliance", "write");
  const supabase = createAdminClient();

  const { data: previo } = await (supabase as any)
    .from("form931_presentaciones")
    .select("periodo, fecha_limite")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("form931_presentaciones").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el período." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "form931",
    entidadId: id,
    valoresAnteriores: previo ?? null,
  });

  revalidatePath("/compliance");
  return { ok: true };
}
