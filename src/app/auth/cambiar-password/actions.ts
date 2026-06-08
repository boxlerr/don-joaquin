"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CambiarPasswordState = {
  error?: string;
} | null;

/**
 * Cambio de contraseña obligatorio para usuarios con `must_change_password = true`
 * (altas nuevas o reseteos hechos por un admin). Requiere sesión activa: el usuario
 * ya entró con la contraseña provisoria y acá define la suya.
 */
export async function cambiarPasswordObligatorioAction(
  _prevState: CambiarPasswordState,
  formData: FormData,
): Promise<CambiarPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || !confirm) {
    return { error: "Todos los campos son obligatorios." };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No se pudo cambiar la contraseña. Intentá de nuevo." };
  }

  // Limpiar el flag con el admin client (evita topes de RLS al tocar el propio perfil).
  const admin = createAdminClient();
  await admin
    .from("usuarios")
    .update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  redirect("/dashboard");
}
