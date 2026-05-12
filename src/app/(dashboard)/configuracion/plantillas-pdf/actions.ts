"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { Database } from "@/types/database";

export type PlantillaTipo = Database["public"]["Enums"]["plantilla_tipo"];
export type PlantillaEstado = Database["public"]["Enums"]["plantilla_estado"];
export type Plantilla = Database["public"]["Tables"]["plantillas_pdf"]["Row"];

type Result = { success: true } | { error: string };

const createSchema = z.object({
  nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  tipo: z.enum(["remito", "factura", "gasoil", "liquidacion"]),
});

const TIPO_DESCRIPCION: Record<PlantillaTipo, string> = {
  remito: "Documento de entrega de mercadería",
  factura: "Factura estándar para servicios de transporte",
  gasoil: "Detalle de carga de combustible",
  liquidacion: "Resumen de pagos y descuentos",
};

export async function createPlantillaAction(input: unknown): Promise<Result> {
  const currentUser = await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("plantillas_pdf").insert({
    nombre: parsed.data.nombre,
    descripcion: TIPO_DESCRIPCION[parsed.data.tipo],
    tipo: parsed.data.tipo,
    estado: "desarrollo",
    created_by: currentUser.id,
  });

  if (error) {
    console.error("Error creando plantilla:", error);
    return { error: "No se pudo crear la plantilla" };
  }

  revalidatePath("/configuracion/plantillas-pdf");
  return { success: true };
}

export async function deletePlantillaAction(id: string): Promise<Result> {
  await requireAdmin();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "ID inválido" };
  }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("plantillas_pdf")
    .update({ estado: "eliminada", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("estado", "eliminada")
    .select("id");

  if (error) {
    console.error("Error eliminando plantilla:", error);
    return { error: "No se pudo eliminar la plantilla" };
  }
  if (count === 0) return { error: "Plantilla no encontrada" };

  revalidatePath("/configuracion/plantillas-pdf");
  return { success: true };
}
