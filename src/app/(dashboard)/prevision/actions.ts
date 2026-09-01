"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { cargarPrevision, type DatosPrevision } from "@/lib/prevision-datos";
import {
  mergeTopesFinanzas,
  TOPES_FINANZAS_CLAVE,
  type TopesFinanzas,
} from "@/domain/finanzas/proyeccion";
import { revalidatePath } from "next/cache";

export async function getPrevisionAction(): Promise<DatosPrevision> {
  // La sección tiene permiso propio: lo que muestra —masa salarial y deuda
  // bancaria en un solo número— no se lo damos a cualquiera que vea préstamos.
  await requireSeccion("prevision", "read");
  // La cuenta vive en `lib/prevision-datos` porque la comparte con el aviso que
  // sale por la campana y por mail: dos cuentas distintas terminarían diciendo
  // cosas distintas del mismo mes.
  return cargarPrevision();
}

/** Guarda los umbrales. Sin umbral no hay alerta: nunca se inventa uno. */
export async function guardarTopesFinanzasAction(
  config: TopesFinanzas,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("prevision", "write");
  const supabase = createAdminClient();
  const limpia = mergeTopesFinanzas(config);

  const { error } = await supabase.from("parametros_sistema").upsert(
    {
      clave: TOPES_FINANZAS_CLAVE,
      valor: JSON.stringify(limpia),
      tipo_dato: "json",
      categoria: "finanzas",
      editable: true,
      updated_by: user.id,
    },
    { onConflict: "clave" },
  );
  if (error) {
    console.error("Error al guardar los topes de la previsión:", error);
    return { error: "No se pudieron guardar los umbrales." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "parametro_sistema",
    entidadId: TOPES_FINANZAS_CLAVE,
    valoresNuevos: limpia,
    metadata: { origen: "prevision" },
  });

  revalidatePath("/prevision");
  return { ok: true };
}
