import { logAudit } from "@/lib/audit";

/** Registra en audit_log una acción sobre una entrevista. */
export async function logEntrevistaAudit(
  entrevistaId: string,
  accion: string,
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string | null,
): Promise<void> {
  await logAudit({
    accion,
    entidadTipo: "entrevista",
    entidadId: entrevistaId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
  });
}
