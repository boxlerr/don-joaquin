import { logAudit } from "@/lib/audit";

/** Registra en audit_log una acción sobre un cliente (o sus sub-recursos). */
export async function logClienteAudit(
  clienteId: string,
  accion: string,
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string | null,
): Promise<void> {
  await logAudit({
    accion,
    entidadTipo: "cliente",
    entidadId: clienteId,
    usuarioId: userId,
    valoresAnteriores,
    valoresNuevos,
  });
}
