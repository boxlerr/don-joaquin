import { createClient } from "@/lib/supabase/server";

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: Date;
};

const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_PER_EMAIL = 10;
const MAX_PER_IP = 20;

/**
 * Verifica si el email está bloqueado por rate limit.
 * Máximo 10 intentos en 5 minutos por email.
 */
export async function checkRateLimitByEmail(email: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const { count, error } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact" })
    .eq("email", email)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, remainingAttempts: MAX_PER_EMAIL, resetAt: new Date(Date.now() + WINDOW_MS) };
  }

  const attempts = count || 0;
  return {
    allowed: attempts < MAX_PER_EMAIL,
    remainingAttempts: Math.max(0, MAX_PER_EMAIL - attempts),
    resetAt: new Date(windowStart.getTime() + WINDOW_MS),
  };
}

/**
 * Verifica si la IP está bloqueada por rate limit.
 * Máximo 20 intentos en 5 minutos por IP.
 */
export async function checkRateLimitByIP(ipAddress: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const { count, error } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact" })
    .eq("ip_address", ipAddress)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, remainingAttempts: MAX_PER_IP, resetAt: new Date(Date.now() + WINDOW_MS) };
  }

  const attempts = count || 0;
  return {
    allowed: attempts < MAX_PER_IP,
    remainingAttempts: Math.max(0, MAX_PER_IP - attempts),
    resetAt: new Date(windowStart.getTime() + WINDOW_MS),
  };
}

/**
 * Registra un intento de login (fallido o exitoso).
 */
export async function recordLoginAttempt(
  email: string,
  ipAddress: string,
  success: boolean,
  reason?: string,
  userAgent?: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("login_attempts").insert({
    email,
    ip_address: ipAddress,
    user_agent: userAgent,
    success,
    reason,
  });

  if (error) {
    console.error("Failed to record login attempt:", error);
    // No fallar si no se puede registrar el intento
  }
}

/**
 * Extrae la IP real del cliente considerando proxies.
 * Desde Server Actions, usa headers() de Next.js directamente.
 */
export function getClientIP(
  request?: Request | null,
  headersFn?: () => Promise<import("next/headers").ReadonlyHeaders>,
): string {
  // Si tenemos una request, úsala
  if (request) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }

    const realIP = request.headers.get("x-real-ip");
    if (realIP) return realIP;

    const cf = request.headers.get("cf-connecting-ip");
    if (cf) return cf;
  }

  // Fallback para cuando no tenemos request (dev, etc)
  return "unknown";
}
