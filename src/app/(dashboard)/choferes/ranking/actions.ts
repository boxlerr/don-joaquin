"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getRankingCriterios } from "./lib";
import { CRITERIO_CLAVE, type RankingCriterios } from "./criterios";

export async function getRankingCriteriosAction(): Promise<RankingCriterios> {
  await requireArea("logistica", "read");
  return getRankingCriterios();
}

export async function updateRankingCriteriosAction(criterios: RankingCriterios) {
  await requireArea("logistica", "write");
  const supabase = createAdminClient();

  // Un upsert por clave (la cantidad es chica). Valores >= 0.
  for (const k of Object.keys(CRITERIO_CLAVE) as (keyof RankingCriterios)[]) {
    const valor = Math.max(0, Math.round(Number(criterios[k]) || 0));
    const { error } = await supabase
      .from("parametros_sistema")
      .update({ valor: String(valor) })
      .eq("clave", CRITERIO_CLAVE[k]);
    if (error) {
      console.error("Error al guardar peso del ranking:", CRITERIO_CLAVE[k], error);
      return { error: "No se pudieron guardar los criterios." };
    }
  }

  revalidatePath("/choferes/ranking");
  return { success: true };
}
