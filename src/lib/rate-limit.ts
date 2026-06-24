import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: Date;
};

export type LoginStatus = {
  status: "ok" | "alert" | "blocked";
  attempts: number;
};

const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
export const MAX_PER_EMAIL_BLOCK = 20;
export const MAX_PER_EMAIL_ALERT = 6;
const MAX_PER_IP = 20;

/**
 * Retorna el estado actual de intentos fallidos para un email en la ventana activa.
 * 'alert' se activa al llegar a MAX_PER_EMAIL_ALERT, 'blocked' al llegar a MAX_PER_EMAIL_BLOCK.
 */
export async function checkLoginStatus(email: string): Promise<LoginStatus> {
  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const { count, error } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact" })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("Login status check error:", error);
    return { status: "ok", attempts: 0 };
  }

  const attempts = count ?? 0;

  if (attempts >= MAX_PER_EMAIL_BLOCK) return { status: "blocked", attempts };
  if (attempts >= MAX_PER_EMAIL_ALERT) return { status: "alert", attempts };
  return { status: "ok", attempts };
}

/**
 * Verifica si la IP está bloqueada por rate limit.
 * Máximo 20 intentos en 5 minutos por IP.
 */
export async function checkRateLimitByIP(ipAddress: string): Promise<RateLimitResult> {
  const supabase = createAdminClient();
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

  const attempts = count ?? 0;
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
  const supabase = createAdminClient();

  const { error } = await supabase.from("login_attempts").insert({
    email,
    ip_address: ipAddress,
    user_agent: userAgent,
    success,
    reason,
  });

  if (error) {
    console.error("Failed to record login attempt:", error);
  }
}

/**
 * Extrae la IP real del cliente considerando proxies.
 */
export function getClientIP(request?: Request | null): string {
  if (request) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();

    const realIP = request.headers.get("x-real-ip");
    if (realIP) return realIP;

    const cf = request.headers.get("cf-connecting-ip");
    if (cf) return cf;
  }

  return "unknown";
}
