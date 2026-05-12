"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function addChoferAction(data: {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  localidad?: string;
  fecha_ingreso: string;
  estado: "activo" | "inactivo";
}) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("choferes").insert({
    nombre: data.nombre,
    apellido: data.apellido,
    dni: data.dni,
    telefono: data.telefono || null,
    localidad: data.localidad || null,
    fecha_ingreso: data.fecha_ingreso,
    estado: data.estado,
  });

  if (error) {
    console.error("Error al insertar chofer:", error);
    return { error: "No se pudo registrar el chofer. Verificá que el DNI no esté duplicado." };
  }

  revalidatePath("/choferes");
  return { success: true };
}

export async function updateChoferAction(id: string, data: {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  localidad?: string;
  estado: "activo" | "inactivo";
}) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("choferes")
    .update({
      nombre: data.nombre,
      apellido: data.apellido,
      dni: data.dni,
      telefono: data.telefono || null,
      localidad: data.localidad || null,
      estado: data.estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar chofer:", error);
    return { error: "No se pudo actualizar los datos del chofer." };
  }

  revalidatePath("/choferes");
  return { success: true };
}

export async function updateChoferEstadoAction(id: string, estado: "activo" | "inactivo") {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("choferes")
    .update({
      estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al cambiar estado de chofer:", error);
    return { error: "No se pudo cambiar el estado del chofer." };
  }

  revalidatePath("/choferes");
  return { success: true };
}

export async function deleteChoferAction(id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("choferes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar chofer:", error);
    return { error: "No se pudo eliminar el chofer. Es posible que tenga registros o viajes asociados." };
  }

  revalidatePath("/choferes");
  return { success: true };
}
