"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimitByEmail,
  checkRateLimitByIP,
  recordLoginAttempt,
  getClientIP,
} from "@/lib/rate-limit";
import {
  auditLoginSuccess,
  auditLoginFailure,
} from "@/lib/audit";

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

  // Obtener IP y User-Agent del cliente
  const headersList = await headers();

  // Extraer IP de headers (similar a getClientIP pero más simple)
  const forwardedFor = headersList.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : headersList.get("x-real-ip")
      ? headersList.get("x-real-ip")!
      : headersList.get("cf-connecting-ip")
        ? headersList.get("cf-connecting-ip")!
        : "unknown";

  const userAgent = headersList.get("user-agent") ?? undefined;

  // Verificar rate limit por email
  const emailLimit = await checkRateLimitByEmail(email);
  if (!emailLimit.allowed) {
    await recordLoginAttempt(email, ipAddress, false, "rate_limit_email", userAgent);
    await auditLoginFailure(email, ipAddress, "rate_limit_email", userAgent);
    return {
      error: "Demasiados intentos. Intenta de nuevo en 15 minutos.",
    };
  }

  // Verificar rate limit por IP
  const ipLimit = await checkRateLimitByIP(ipAddress);
  if (!ipLimit.allowed) {
    await recordLoginAttempt(email, ipAddress, false, "rate_limit_ip", userAgent);
    await auditLoginFailure(email, ipAddress, "rate_limit_ip", userAgent);
    return {
      error: "Demasiados intentos desde tu ubicación. Intenta de nuevo en 15 minutos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Registrar intento fallido
    await recordLoginAttempt(email, ipAddress, false, "wrong_password", userAgent);
    await auditLoginFailure(email, ipAddress, "wrong_password", userAgent);
    // Mensaje genérico para no filtrar info (existe usuario / no existe)
    return { error: "Credenciales inválidas." };
  }

  // Validar que el usuario tenga perfil activo en public.usuarios
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await recordLoginAttempt(email, ipAddress, false, "user_not_found", userAgent);
    await auditLoginFailure(email, ipAddress, "user_not_found", userAgent);
    return { error: "No se pudo iniciar sesión. Intentá de nuevo." };
  }

  const { data: profile } = await supabase
    .from("usuarios")
    .select("estado")
    .eq("id", user.id)
    .single();

  if (!profile || profile.estado !== "activo") {
    await supabase.auth.signOut();
    await recordLoginAttempt(email, ipAddress, false, "user_inactive", userAgent);
    await auditLoginFailure(email, ipAddress, "user_inactive", userAgent);
    return { error: "Tu usuario está inactivo. Contactá a un administrador." };
  }

  // Registrar intento exitoso en rate_limit y auditoría
  await recordLoginAttempt(email, ipAddress, true, undefined, userAgent);
  await auditLoginSuccess(user.id, email, ipAddress, userAgent);

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
