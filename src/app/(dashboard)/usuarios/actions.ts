"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";

const NIVELES_VALIDOS: AreaNivel[] = ["none", "read", "write", "admin"];

export async function updateUsuarioRolAction(
  usuario_id: string,
  rol_id: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();

  if (usuario_id === admin.id) {
    return { error: "No podés cambiar tu propio rol." };
  }

  const supabase = createAdminClient();

  const { data: rol } = await supabase
    .from("roles")
    .select("id, codigo")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inválido" };

  const { data: previo } = await supabase
    .from("usuarios")
    .select("rol_id")
    .eq("id", usuario_id)
    .single();
  if (!previo) return { error: "Usuario inexistente" };
  if (previo.rol_id === rol_id) return { ok: true };

  const { error } = await supabase
    .from("usuarios")
    .update({ rol_id, updated_at: new Date().toISOString() })
    .eq("id", usuario_id);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    usuario_id: admin.id,
    accion: "actualizar",
    entidad_tipo: "usuarios",
    entidad_id: usuario_id,
    valores_anteriores: { rol_id: previo.rol_id },
    valores_nuevos: { rol_id },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function crearUsuarioAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const rol_id = String(formData.get("rol_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !nombre || !rol_id || !password) {
    return { error: "Completá email, nombre, rol y contraseña." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email inválido." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = createAdminClient();

  const { data: rol } = await supabase
    .from("roles")
    .select("id")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inválido" };

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return { error: authError?.message ?? "No se pudo crear el acceso del usuario." };
  }

  const { error: dbError } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    email,
    nombre,
    apellido: apellido || null,
    rol_id,
    estado: "activo",
    must_change_password: true,
    created_by: admin.id,
  });
  if (dbError) {
    // rollback del usuario de auth para no dejar un acceso huérfano
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: "No se pudo guardar el perfil del usuario." };
  }

  await supabase.from("audit_log").insert({
    usuario_id: admin.id,
    accion: "crear",
    entidad_tipo: "usuarios",
    entidad_id: authData.user.id,
    valores_nuevos: { email, rol_id },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

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
    .from("rol_areas")
    .select("nivel")
    .eq("rol_id", rol_id)
    .eq("area_codigo", area_codigo)
    .maybeSingle();

  const nivelAnterior = (previo?.nivel as AreaNivel | undefined) ?? "none";

  if (nivelAnterior === nivel) return { ok: true };

  const { error } = await supabase.from("rol_areas").upsert(
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

// ---------------------------------------------------------------------------
// Overrides de permiso por usuario individual
// ---------------------------------------------------------------------------

export async function setUsuarioAreaAction(
  usuario_id: string,
  area_codigo: AreaCodigo,
  nivel: AreaNivel | "quitar",
  vence_en: string | null, // ISO string o null (permanente)
  motivo?: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any; // `usuario_areas` es nueva; se actualiza al regenerar database.ts
  type UA = { nivel: string; vence_en: string | null };

  // Limpiar overrides vencidos como higiene oportunística
  await sb
    .from("usuario_areas")
    .delete()
    .lt("vence_en", new Date().toISOString())
    .not("vence_en", "is", null);

  if (nivel === "quitar") {
    // Eliminar el override (el usuario queda solo con el nivel de su rol)
    const { data: previo } = (await sb
      .from("usuario_areas")
      .select("nivel, vence_en")
      .eq("usuario_id", usuario_id)
      .eq("area_codigo", area_codigo)
      .maybeSingle()) as { data: UA | null };

    const { error } = await sb
      .from("usuario_areas")
      .delete()
      .eq("usuario_id", usuario_id)
      .eq("area_codigo", area_codigo);

    if (error) return { error: (error as { message: string }).message };

    if (previo) {
      await supabase.from("audit_log").insert({
        usuario_id: admin.id,
        accion: "eliminar",
        entidad_tipo: "usuario_areas",
        entidad_id: usuario_id,
        valores_anteriores: { area_codigo, nivel: previo.nivel, vence_en: previo.vence_en },
        valores_nuevos: null,
        metadata: { otorgado_por: admin.id, motivo: motivo ?? null },
      });
    }

    revalidatePath("/usuarios");
    return { ok: true };
  }

  if (!NIVELES_VALIDOS.includes(nivel)) {
    return { error: "Nivel inválido" };
  }

  // Leer estado anterior para auditoría
  const { data: previo } = (await sb
    .from("usuario_areas")
    .select("nivel, vence_en")
    .eq("usuario_id", usuario_id)
    .eq("area_codigo", area_codigo)
    .maybeSingle()) as { data: UA | null };

  const { error } = await sb.from("usuario_areas").upsert(
    {
      usuario_id,
      area_codigo,
      nivel,
      vence_en: vence_en ?? null,
      otorgado_por: admin.id,
      motivo: motivo ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "usuario_id,area_codigo" },
  ) as { error: { message: string } | null };

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    usuario_id: admin.id,
    accion: previo ? "actualizar" : "crear",
    entidad_tipo: "usuario_areas",
    entidad_id: usuario_id,
    valores_anteriores: previo
      ? { area_codigo, nivel: previo.nivel, vence_en: previo.vence_en }
      : null,
    valores_nuevos: { area_codigo, nivel, vence_en: vence_en ?? null },
    metadata: { otorgado_por: admin.id, motivo: motivo ?? null },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}
