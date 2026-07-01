"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";

const NIVELES_VALIDOS: AreaNivel[] = ["none", "read", "write", "admin"];
const NIVEL_RANK: Record<AreaNivel, number> = { none: 0, read: 1, write: 2, admin: 3 };

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

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "usuarios",
    entidadId: usuario_id,
    valoresAnteriores: { rol_id: previo.rol_id },
    valoresNuevos: { rol_id },
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

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "crear",
    entidadTipo: "usuarios",
    entidadId: authData.user.id,
    valoresNuevos: { email, rol_id },
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

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "rol_areas",
    entidadId: null,
    valoresAnteriores: { rol_id, area_codigo, nivel: nivelAnterior },
    valoresNuevos: { rol_id, area_codigo, nivel },
    metadata: { rol_codigo: rol.codigo },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Override de subsección por rol (un nivel más fino que el área)
// ---------------------------------------------------------------------------

export async function updateRolSeccionAction(
  rol_id: string,
  seccion_codigo: SeccionCodigo,
  nivel: AreaNivel | "hereda",
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `rol_secciones` aún no está en los tipos generados
  const sb = supabase as any;

  const { data: rol } = await supabase
    .from("roles")
    .select("codigo")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inexistente" };
  if (rol.codigo === "admin") {
    return { error: "El rol admin ve todo: no se configura por subsección." };
  }

  const { data: previo } = (await sb
    .from("rol_secciones")
    .select("nivel")
    .eq("rol_id", rol_id)
    .eq("seccion_codigo", seccion_codigo)
    .maybeSingle()) as { data: { nivel: AreaNivel } | null };
  const nivelAnterior = previo?.nivel ?? null;

  // "hereda" = sin override: la subsección vuelve a seguir el nivel del área.
  if (nivel === "hereda") {
    if (!previo) return { ok: true };
    const { error } = await sb
      .from("rol_secciones")
      .delete()
      .eq("rol_id", rol_id)
      .eq("seccion_codigo", seccion_codigo);
    if (error) return { error: (error as { message: string }).message };

    await logAudit({
      client: supabase,
      usuarioId: admin.id,
      accion: "eliminar",
      entidadTipo: "rol_secciones",
      entidadId: null,
      valoresAnteriores: { rol_id, seccion_codigo, nivel: nivelAnterior },
      valoresNuevos: null,
      metadata: { rol_codigo: rol.codigo },
    });
    revalidatePath("/usuarios");
    return { ok: true };
  }

  if (!NIVELES_VALIDOS.includes(nivel)) {
    return { error: "Nivel inválido" };
  }

  // Para subsecciones NO confidenciales el override solo puede RESTRINGIR: nunca
  // igualar ni superar el nivel del área (eso ya es "Hereda del área"). Espeja el
  // cap de la resolución en auth.ts, así no se guardan estados que se ignorarían.
  // La confidencialidad es editable (tabla `secciones`), con fallback al catálogo.
  const sec = SECCION_BY_CODIGO[seccion_codigo];
  const { data: secRow } = (await sb
    .from("secciones")
    .select("confidencial")
    .eq("codigo", seccion_codigo)
    .maybeSingle()) as { data: { confidencial: boolean } | null };
  const esConfidencial = secRow?.confidencial ?? !!sec?.confidencial;
  if (sec && !esConfidencial) {
    const { data: ra } = await supabase
      .from("rol_areas")
      .select("nivel")
      .eq("rol_id", rol_id)
      .eq("area_codigo", sec.area)
      .maybeSingle();
    const areaLvl = (ra?.nivel as AreaNivel) ?? "none";
    if (NIVEL_RANK[nivel] >= NIVEL_RANK[areaLvl]) {
      return {
        error: 'El override no puede igualar ni superar el nivel del área. Para igualarlo usá "Hereda del área".',
      };
    }
  }

  if (nivelAnterior === nivel) return { ok: true };

  const { error } = (await sb.from("rol_secciones").upsert(
    { rol_id, seccion_codigo, nivel, updated_at: new Date().toISOString() },
    { onConflict: "rol_id,seccion_codigo" },
  )) as { error: { message: string } | null };
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "rol_secciones",
    entidadId: null,
    valoresAnteriores: nivelAnterior ? { rol_id, seccion_codigo, nivel: nivelAnterior } : null,
    valoresNuevos: { rol_id, seccion_codigo, nivel },
    metadata: { rol_codigo: rol.codigo },
  });
  revalidatePath("/usuarios");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Confidencialidad de subsección (global, no por rol)
// ---------------------------------------------------------------------------
//
// Marca/desmarca una subsección como "confidencial": arranca cerrada para todos
// los roles no-admin (hay que otorgarla explícitamente por rol). Editable acá
// para poder ajustar la lista sensible "sobre la marcha" sin un deploy.

export async function setSeccionConfidencialAction(
  seccion_codigo: SeccionCodigo,
  confidencial: boolean,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();

  const sec = SECCION_BY_CODIGO[seccion_codigo];
  if (!sec) return { error: "Subsección inexistente" };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `secciones` aún no está en los tipos generados
  const sb = supabase as any;

  // Upsert desde el catálogo de código: garantiza que la fila exista (las columnas
  // NOT NULL salen de SECCIONES) y deja `confidencial` con el valor pedido.
  const { error } = (await sb.from("secciones").upsert(
    {
      codigo: sec.codigo,
      area_codigo: sec.area,
      nombre: sec.nombre,
      orden: sec.orden,
      confidencial,
    },
    { onConflict: "codigo" },
  )) as { error: { message: string } | null };
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "secciones",
    entidadId: seccion_codigo,
    valoresNuevos: { seccion_codigo, confidencial },
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
      await logAudit({
        client: supabase,
        usuarioId: admin.id,
        accion: "eliminar",
        entidadTipo: "usuario_areas",
        entidadId: usuario_id,
        valoresAnteriores: { area_codigo, nivel: previo.nivel, vence_en: previo.vence_en },
        valoresNuevos: null,
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

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: previo ? "actualizar" : "crear",
    entidadTipo: "usuario_areas",
    entidadId: usuario_id,
    valoresAnteriores: previo
      ? { area_codigo, nivel: previo.nivel, vence_en: previo.vence_en }
      : null,
    valoresNuevos: { area_codigo, nivel, vence_en: vence_en ?? null },
    metadata: { otorgado_por: admin.id, motivo: motivo ?? null },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}
