import { createClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/rate-limit";
import type { Json } from "@/types/database";

export type AuditAction = "login" | "login_fallido" | "logout";

/**
 * Registra un evento de auditoría en audit_log.
 * Para logins: entidad_tipo="usuario", entidad_id=usuario_id
 */
export async function auditLog(options: {
  accion: AuditAction;
  usuarioId?: string | null;
  entidadTipo: string;
  entidadId?: string | null;
  ip?: string;
  userAgent?: string;
  metadata?: Json;
  valoresAnteriores?: Json;
  valoresNuevos?: Json;
}): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("audit_log").insert({
    accion: options.accion,
    usuario_id: options.usuarioId,
    entidad_tipo: options.entidadTipo,
    entidad_id: options.entidadId,
    ip: options.ip,
    user_agent: options.userAgent,
    metadata: options.metadata,
    valores_anteriores: options.valoresAnteriores,
    valores_nuevos: options.valoresNuevos,
  });

  if (error) {
    console.error("Audit log error:", error);
    // No fallar si no se puede registrar la auditoría
  }
}

/**
 * Registra un login exitoso.
 */
export async function auditLoginSuccess(
  usuarioId: string,
  email: string,
  ip: string,
  userAgent?: string,
): Promise<void> {
  await auditLog({
    accion: "login",
    usuarioId,
    entidadTipo: "usuario",
    entidadId: usuarioId,
    ip,
    userAgent,
    metadata: {
      email,
      evento: "login_exitoso",
    },
  });
}

/**
 * Registra un intento de login fallido.
 */
export async function auditLoginFailure(
  email: string,
  ip: string,
  razon: string,
  userAgent?: string,
): Promise<void> {
  await auditLog({
    accion: "login_fallido",
    entidadTipo: "usuario",
    ip,
    userAgent,
    metadata: {
      email,
      razon,
      evento: "login_fallido",
    },
  });
}

/**
 * Registra un logout.
 */
export async function auditLogout(
  usuarioId: string,
  ip: string,
  userAgent?: string,
): Promise<void> {
  await auditLog({
    accion: "logout",
    usuarioId,
    entidadTipo: "usuario",
    entidadId: usuarioId,
    ip,
    userAgent,
    metadata: {
      evento: "logout",
    },
  });
}
