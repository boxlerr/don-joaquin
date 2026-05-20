"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function logChoferAudit(
  choferId: string,
  accion: string,
  valoresAnteriores: Record<string, unknown> | null,
  valoresNuevos: Record<string, unknown> | null,
  userId: string | null,
): Promise<void> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    usuario_id: userId,
    accion,
    entidad_tipo: "chofer",
    entidad_id: choferId,
    valores_anteriores: valoresAnteriores,
    valores_nuevos: valoresNuevos,
  });
}
