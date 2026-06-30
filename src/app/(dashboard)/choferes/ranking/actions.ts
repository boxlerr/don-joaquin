"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getRankingCriterios } from "./lib";
import { CONFIG_CLAVE, mergeCriterios, type RankingCriterios } from "./criterios";

export async function getRankingCriteriosAction(): Promise<RankingCriterios> {
  await requireArea("logistica", "read");
  return getRankingCriterios();
}

export async function updateRankingCriteriosAction(criterios: RankingCriterios) {
  await requireArea("logistica", "write");
  const supabase = createAdminClient();

  // Normaliza/valida todo (topes >=0 enteros, %s entre 0 y 1, refs > 0) y guarda
  // la config completa en una sola fila JSON.
  const limpia = mergeCriterios(criterios);

  const { error } = await supabase.from("parametros_sistema").upsert(
    {
      clave: CONFIG_CLAVE,
      valor: JSON.stringify(limpia),
      tipo_dato: "json",
      categoria: "ranking",
      editable: true,
    },
    { onConflict: "clave" },
  );
  if (error) {
    console.error("Error al guardar criterios del ranking:", error);
    return { error: "No se pudieron guardar los criterios." };
  }

  revalidatePath("/choferes/ranking");
  return { success: true };
}
