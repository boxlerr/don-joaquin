import { logAudit } from "@/lib/audit";

/**
 * Registra en audit_log una acción sobre un chofer (o su legajo).
 *
 * Por defecto la entidad es el chofer. Cuando la acción es sobre una fila
 * concreta de su legajo (un período de ausencia, el saldo de un año), pasá
 * `entidad` para que quede registrado ESO y no sólo la persona: si no, en
 * /auditoría no hay forma de saber qué período o qué año se tocó. El chofer
 * queda igual en `metadata.chofer_id`, así se sigue pudiendo filtrar por él.
 */
export async function logChoferAudit(
  choferId: string,
  accion: string,
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string | null,
  entidad?: { tipo: string; id: string },
): Promise<void> {
  await logAudit({
    accion,
    entidadTipo: entidad?.tipo ?? "chofer",
    entidadId: entidad?.id ?? choferId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
    metadata: entidad ? { chofer_id: choferId } : null,
  });
}
