import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export type AuditClient = SupabaseClient<Database>;

export type LogAuditOptions = {
  accion: string;
  entidadTipo: string;
  entidadId?: string | null;
  usuarioId?: string | null;
  valoresAnteriores?: Record<string, unknown> | null;
  valoresNuevos?: Record<string, unknown> | null;
  metadata?: Json | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Cliente Supabase a reutilizar. Por defecto se crea un admin (service role). */
  client?: AuditClient;
};

/**
 * Registro central de auditoría: inserta una fila en `audit_log`.
 *
 * Reemplaza a los helpers por módulo (logChoferAudit, logClienteAudit, etc.),
 * que ahora delegan acá. Si el insert falla, lo loguea pero NO propaga el
 * error: la auditoría nunca debe romper la operación de negocio.
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  const supabase = options.client ?? createAdminClient();
  const { error } = await supabase.from("audit_log").insert({
    accion: options.accion,
    entidad_tipo: options.entidadTipo,
    entidad_id: options.entidadId ?? null,
    usuario_id: options.usuarioId ?? null,
    valores_anteriores: (options.valoresAnteriores ?? null) as Json,
    valores_nuevos: (options.valoresNuevos ?? null) as Json,
    metadata: options.metadata ?? null,
    ip: options.ip ?? null,
    user_agent: options.userAgent ?? null,
  });
  if (error) {
    console.error(
      `[audit] no se pudo registrar ${options.entidadTipo}/${options.accion}:`,
      error.message,
    );
  }
}

export type AuditAction = "login" | "login_fallido" | "logout" | "alerta_login";

/**
 * Eventos de acceso (login/logout). Usan el server client porque ocurren en el
 * flujo de autenticación (con o sin sesión activa), no el admin.
 */
async function auditAcceso(options: {
  accion: AuditAction;
  usuarioId?: string | null;
  ip?: string;
  userAgent?: string;
  metadata?: Json;
}): Promise<void> {
  await logAudit({
    accion: options.accion,
    entidadTipo: "usuario",
    entidadId: options.usuarioId ?? null,
    usuarioId: options.usuarioId ?? null,
    ip: options.ip ?? null,
    userAgent: options.userAgent ?? null,
    metadata: options.metadata ?? null,
    client: await createClient(),
  });
}

/** Registra un login exitoso. */
export async function auditLoginSuccess(
  usuarioId: string,
  email: string,
  ip: string,
  userAgent?: string,
): Promise<void> {
  await auditAcceso({
    accion: "login",
    usuarioId,
    ip,
    userAgent,
    metadata: { email, evento: "login_exitoso" },
  });
}

/** Registra un intento de login fallido. */
export async function auditLoginFailure(
  email: string,
  ip: string,
  razon: string,
  userAgent?: string,
): Promise<void> {
  await auditAcceso({
    accion: "login_fallido",
    ip,
    userAgent,
    metadata: { email, razon, evento: "login_fallido" },
  });
}

/** Registra el envío de un email de alerta por múltiples intentos fallidos. */
export async function auditLoginAlert(
  email: string,
  ip: string,
  attempts: number,
  userAgent?: string,
): Promise<void> {
  await auditAcceso({
    accion: "alerta_login",
    ip,
    userAgent,
    metadata: { email, intentos: attempts, evento: "alerta_email_enviado" },
  });
}

/** Registra un logout. */
export async function auditLogout(
  usuarioId: string,
  ip: string,
  userAgent?: string,
): Promise<void> {
  await auditAcceso({
    accion: "logout",
    usuarioId,
    ip,
    userAgent,
    metadata: { evento: "logout" },
  });
}
