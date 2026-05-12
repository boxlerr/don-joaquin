"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generarAlertas } from "@/lib/alertas";
import { revalidatePath } from "next/cache";

export async function marcarAlertaVista(alertaId: string) {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  await supabase
    .from("alertas")
    .update({
      estado: "vista",
      vista_en: new Date().toISOString(),
      vista_por: user?.id ?? null,
    })
    .eq("id", alertaId);

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function marcarTodasVistas() {
  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  await supabase
    .from("alertas")
    .update({
      estado: "vista",
      vista_en: new Date().toISOString(),
      vista_por: user?.id ?? null,
    })
    .eq("estado", "pendiente");

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function actualizarAlertas() {
  await generarAlertas();
  revalidatePath("/notificaciones");
  revalidatePath("/");
}
