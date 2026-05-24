"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";

const NIVELES_VALIDOS: AreaNivel[] = ["none", "read", "write", "admin"];

export async function updateRolAreaAction(
  rol_id: string,
  area_codigo: AreaCodigo,
  nivel: AreaNivel,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!NIVELES_VALIDOS.includes(nivel)) {
    return { error: "Nivel inválido" };
  }

  const supabase = createAdminClient();

  const { data: rol } = await supabase
    .from("roles")
    .select("codigo")
    .eq("id", rol_id)
    .single();

  if (!rol) return { error: "Rol inexistente" };

  if (rol.codigo === "admin") {
    return { error: "El rol admin no puede modificarse desde la matriz." };
  }

  const { data: previo } = await supabase
    .from("rol_areas" as never)
    .select("nivel")
    .eq("rol_id", rol_id)
    .eq("area_codigo", area_codigo)
    .maybeSingle();

  const nivelAnterior = (previo as { nivel: AreaNivel } | null)?.nivel ?? "none";

  if (nivelAnterior === nivel) return { ok: true };

  const { error } = await (supabase.from("rol_areas" as never) as unknown as {
    upsert: (
      values: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(
    { rol_id, area_codigo, nivel, updated_at: new Date().toISOString() },
    { onConflict: "rol_id,area_codigo" },
  );

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    usuario_id: admin.id,
    accion: "actualizar",
    entidad_tipo: "rol_areas",
    entidad_id: null,
    valores_anteriores: { rol_id, area_codigo, nivel: nivelAnterior },
    valores_nuevos: { rol_id, area_codigo, nivel },
    metadata: { rol_codigo: rol.codigo },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}
