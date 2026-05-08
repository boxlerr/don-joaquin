"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
} | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje genérico para no filtrar info (existe usuario / no existe)
    return { error: "Credenciales inválidas." };
  }

  // Validar que el usuario tenga perfil activo en public.usuarios
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No se pudo iniciar sesión. Intentá de nuevo." };
  }

  const { data: profile } = await supabase
    .from("usuarios")
    .select("estado")
    .eq("id", user.id)
    .single();

  if (!profile || profile.estado !== "activo") {
    await supabase.auth.signOut();
    return { error: "Tu usuario está inactivo. Contactá a un administrador." };
  }

  // Whitelist de redirects internos para evitar open redirect
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/dashboard";

  redirect(safeRedirect);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
