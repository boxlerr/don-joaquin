"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { Database } from "@/types/database";
import { logEntrevistaAudit } from "./audit";

type EntrevistaInsert = Database["public"]["Tables"]["entrevistas"]["Insert"];

const PREOCUPACIONAL_VALUES = ["no_aplica", "pendiente", "apto", "no_apto"] as const;
const RESULTADO_VALUES = ["pendiente", "ingresa", "no_ingresa"] as const;

export type EntrevistaFormData = {
  nombre: string;
  fecha_entrevista?: string;
  edad?: string;
  localidad?: string;
  telefono?: string;
  observaciones?: string;
  preocupacional: string;
  resultado: string;
};

function buildPayload(data: EntrevistaFormData): EntrevistaInsert | { error: string } {
  const nombre = data.nombre?.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  let edad: number | null = null;
  if (data.edad && data.edad.trim() !== "") {
    const n = Number(data.edad);
    if (!Number.isInteger(n) || n < 14 || n > 99) {
      return { error: "La edad debe ser un número entre 14 y 99." };
    }
    edad = n;
  }

  const preocupacional = PREOCUPACIONAL_VALUES.includes(data.preocupacional as never)
    ? data.preocupacional
    : "no_aplica";
  const resultado = RESULTADO_VALUES.includes(data.resultado as never)
    ? data.resultado
    : "pendiente";

  return {
    nombre,
    fecha_entrevista: data.fecha_entrevista || null,
    edad,
    localidad: data.localidad?.trim() || null,
    telefono: data.telefono?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    preocupacional,
    resultado,
  };
}

export async function addEntrevistaAction(data: EntrevistaFormData) {
  const user = await requireArea("rrhh", "write");
  const payload = buildPayload(data);
  if ("error" in payload) return payload;

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("entrevistas")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar entrevista:", error);
    return { error: "No se pudo registrar la entrevista." };
  }

  if (inserted?.id) {
    await logEntrevistaAudit(inserted.id, "crear", null, payload, user.id);
  }

  revalidatePath("/entrevistas");
  return { success: true };
}

export async function updateEntrevistaAction(id: string, data: EntrevistaFormData) {
  const user = await requireArea("rrhh", "write");
  const payload = buildPayload(data);
  if ("error" in payload) return payload;

  const supabase = createAdminClient();

  const { data: anterior } = await supabase
    .from("entrevistas")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("entrevistas")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar entrevista:", error);
    return { error: "No se pudo actualizar la entrevista." };
  }

  await logEntrevistaAudit(id, "editar", anterior ?? null, payload, user.id);

  revalidatePath("/entrevistas");
  return { success: true };
}

export async function deleteEntrevistaAction(id: string) {
  const user = await requireArea("rrhh", "admin");
  const supabase = createAdminClient();

  const { data: anterior } = await supabase
    .from("entrevistas")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("entrevistas").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar entrevista:", error);
    return { error: "No se pudo eliminar la entrevista." };
  }

  await logEntrevistaAudit(id, "eliminar", anterior ?? null, null, user.id);

  revalidatePath("/entrevistas");
  return { success: true };
}
