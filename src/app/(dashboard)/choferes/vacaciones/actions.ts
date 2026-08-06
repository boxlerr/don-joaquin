"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { UMBRAL_CLAVE, mergeUmbral, type UmbralConfig } from "./umbral";

/**
 * Guarda el tope de gente de vacaciones por semana. Va todo en una sola fila
 * JSON de `parametros_sistema` (mismo patrón que la config del ranking).
 * `mergeUmbral` normaliza antes de escribir, así lo guardado siempre es válido.
 */
export async function guardarUmbralConfigAction(config: UmbralConfig) {
  const user = await requireSeccion("choferes_vacaciones", "write");
  const supabase = createAdminClient();

  const limpia = mergeUmbral(config);
  const { error } = await supabase.from("parametros_sistema").upsert(
    {
      clave: UMBRAL_CLAVE,
      valor: JSON.stringify(limpia),
      tipo_dato: "json",
      categoria: "vacaciones",
      editable: true,
      updated_by: user.id,
    },
    { onConflict: "clave" },
  );
  if (error) {
    console.error("Error al guardar el tope de vacaciones:", error);
    return { error: "No se pudo guardar el tope de gente por semana." };
  }

  revalidatePath("/choferes/vacaciones");
  return { success: true };
}
