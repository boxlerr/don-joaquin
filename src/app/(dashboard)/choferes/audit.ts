import { logAudit } from "@/lib/audit";

/** Registra en audit_log una acción sobre un chofer (o su legajo). */
export async function logChoferAudit(
  choferId: string,
  accion: string,
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string | null,
): Promise<void> {
  await logAudit({
    accion,
    entidadTipo: "chofer",
    entidadId: choferId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
  });
}
