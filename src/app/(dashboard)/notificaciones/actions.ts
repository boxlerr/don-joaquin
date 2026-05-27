"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { generarAlertas } from "@/lib/alertas";
import { revalidatePath } from "next/cache";

export async function marcarAlertaVista(alertaId: string) {
  const user = await requireUser();
  const supabase = createAdminClient();

  await supabase
    .from("alertas")
    .update({
      estado: "vista",
      vista_en: new Date().toISOString(),
      vista_por: user.id,
    })
    .eq("id", alertaId);

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function marcarAlertasVistas(alertaIds: string[]) {
  const user = await requireUser();
  const supabase = createAdminClient();

  if (!alertaIds || alertaIds.length === 0) return;

  await supabase
    .from("alertas")
    .update({
      estado: "vista",
      vista_en: new Date().toISOString(),
      vista_por: user.id,
    })
    .in("id", alertaIds);

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function marcarTodasVistas() {
  const user = await requireUser();
  const supabase = createAdminClient();

  await supabase
    .from("alertas")
    .update({
      estado: "vista",
      vista_en: new Date().toISOString(),
      vista_por: user.id,
    })
    .eq("estado", "pendiente");

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function actualizarAlertas() {
  await requireUser();
  await generarAlertas();
  revalidatePath("/notificaciones");
  revalidatePath("/");
}
