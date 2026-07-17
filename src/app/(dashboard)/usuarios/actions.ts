"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";
import { esAdminPermanente } from "./admins-permanentes";

// La gestión de usuarios y permisos es exclusiva de los administradores dueños
// (Bárbara, Nicolás, Julián). requireAdmin ya frena a los no-admin; esto además
// frena a cualquier admin común que se creara a futuro.
async function requireDueño() {
  const user = await requireAdmin();
  if (!esAdminPermanente(user.id)) {
    redirect("/dashboard?error=admin_required");
  }
  return user;
}

const NIVELES_VALIDOS: AreaNivel[] = ["none", "read", "write", "admin"];
const NIVEL_RANK: Record<AreaNivel, number> = { none: 0, read: 1, write: 2, admin: 3 };

export async function updateUsuarioRolAction(
  usuario_id: string,
  rol_id: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();

  if (usuario_id === admin.id) {
    return { error: "No podés cambiar tu propio rol." };
  }

  // Los dueños son administradores permanentes: su rol no se cambia por nadie.
  if (esAdminPermanente(usuario_id)) {
    return { error: "Es administrador permanente: su rol no se puede cambiar." };
  }

  const supabase = createAdminClient();

  const { data: rol } = await supabase
    .from("roles")
    .select("id, codigo")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inválido" };

  // El rol Administrador NO se asigna desde la UI (ni el dueño): solo a mano en
  // la base de datos.
  if (rol.codigo === "admin") {
    return { error: "El rol Administrador solo se asigna manualmente en la base de datos." };
  }

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

/**
 * Excepción al bloqueo por horario laboral: "acceso 24 hs" por usuario.
 * Solo tiene efecto con el parámetro acceso_horario_activo prendido; los
 * admin entran siempre sin necesidad de esto.
 */
export async function setUsuarioAcceso24Action(
  usuario_id: string,
  valor: boolean,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columna nueva, database.ts sin regenerar
  const { data: previo } = await (supabase as any)
    .from("usuarios")
    .select("acceso_fuera_horario")
    .eq("id", usuario_id)
    .single();
  if (!previo) return { error: "Usuario inexistente" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columna nueva, database.ts sin regenerar
  const { error } = await (supabase as any)
    .from("usuarios")
    .update({ acceso_fuera_horario: valor, updated_at: new Date().toISOString() })
    .eq("id", usuario_id);
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "usuarios",
    entidadId: usuario_id,
    valoresAnteriores: { acceso_fuera_horario: previo.acceso_fuera_horario },
    valoresNuevos: { acceso_fuera_horario: valor },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function crearUsuarioAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();

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
    .select("id, codigo")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inválido" };

  // El rol Administrador NO se crea desde la UI (ni el dueño): solo a mano en la
  // base de datos.
  if (rol.codigo === "admin") {
    return { error: "El rol Administrador solo se asigna manualmente en la base de datos." };
  }

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
  const admin = await requireDueño();

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
// CRUD de roles: crear, renombrar y eliminar.
// El rol `admin` (Administrador) está protegido: no se renombra ni se elimina.
// Un rol solo se borra si no tiene usuarios asignados (primero reasignarlos).
// ---------------------------------------------------------------------------

/** Genera un código interno (slug) a partir del nombre visible. */
function slugRol(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sacar tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "rol";
}

export async function crearRolAction(
  nombre: string,
): Promise<{ ok: true; rol: { id: string; codigo: string; nombre: string } } | { error: string }> {
  const admin = await requireDueño();
  const limpio = nombre.trim();
  if (limpio.length < 2) return { error: "Poné un nombre de al menos 2 caracteres." };

  const supabase = createAdminClient();

  // Código único: slug base + sufijo numérico si ya existe. Nunca "admin".
  let codigo = slugRol(limpio);
  if (codigo === "admin") codigo = "rol_admin";
  const { data: existentes } = await supabase.from("roles").select("codigo");
  const usados = new Set((existentes ?? []).map((r) => r.codigo));
  if (usados.has(codigo)) {
    let i = 2;
    while (usados.has(`${codigo}_${i}`)) i++;
    codigo = `${codigo}_${i}`;
  }

  // Rol nuevo arranca sin permisos (todas las áreas en "none"): mínimo privilegio.
  const { data: creado, error } = await supabase
    .from("roles")
    .insert({ codigo, nombre: limpio })
    .select("id, codigo, nombre")
    .single();
  if (error || !creado) return { error: error?.message ?? "No se pudo crear el rol." };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "crear",
    entidadTipo: "roles",
    entidadId: creado.id,
    valoresNuevos: { codigo: creado.codigo, nombre: creado.nombre },
  });

  revalidatePath("/usuarios");
  return { ok: true, rol: creado };
}

export async function renombrarRolAction(
  rol_id: string,
  nombre: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();
  const limpio = nombre.trim();
  if (limpio.length < 2) return { error: "Poné un nombre de al menos 2 caracteres." };

  const supabase = createAdminClient();
  const { data: rol } = await supabase
    .from("roles")
    .select("codigo, nombre")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inexistente" };
  if (rol.codigo === "admin") {
    return { error: "El rol Administrador no se renombra." };
  }
  if (rol.nombre === limpio) return { ok: true };

  const { error } = await supabase
    .from("roles")
    .update({ nombre: limpio, updated_at: new Date().toISOString() })
    .eq("id", rol_id);
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "roles",
    entidadId: rol_id,
    valoresAnteriores: { nombre: rol.nombre },
    valoresNuevos: { nombre: limpio },
    metadata: { rol_codigo: rol.codigo },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function eliminarRolAction(
  rol_id: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();
  const supabase = createAdminClient();

  const { data: rol } = await supabase
    .from("roles")
    .select("codigo, nombre")
    .eq("id", rol_id)
    .single();
  if (!rol) return { error: "Rol inexistente" };
  if (rol.codigo === "admin") {
    return { error: "El rol Administrador no se puede eliminar." };
  }

  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol_id", rol_id);
  if ((count ?? 0) > 0) {
    return {
      error: `Tiene ${count} usuario(s) con este rol. Reasignalos a otro rol antes de borrarlo.`,
    };
  }

  // Limpiamos los permisos del rol antes de borrarlo (por si las FK no cascadean).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rol_secciones aún no está en los tipos generados
  await (supabase as any).from("rol_secciones").delete().eq("rol_id", rol_id);
  await supabase.from("rol_areas").delete().eq("rol_id", rol_id);

  const { error } = await supabase.from("roles").delete().eq("id", rol_id);
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "eliminar",
    entidadTipo: "roles",
    entidadId: rol_id,
    valoresAnteriores: { codigo: rol.codigo, nombre: rol.nombre },
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
  const admin = await requireDueño();

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
  const admin = await requireDueño();

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
  const admin = await requireDueño();

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

// Override de SUBSECCIÓN por usuario individual (aditivo). Permite otorgar una
// sección puntual —incluida una confidencial como Préstamos o Cheques— a un solo
// usuario, sin abrírsela a todo su rol. Solo suma sobre el permiso resuelto.
export async function setUsuarioSeccionAction(
  usuario_id: string,
  seccion_codigo: SeccionCodigo,
  nivel: AreaNivel | "quitar",
  vence_en: string | null, // ISO string o null (permanente)
  motivo?: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();

  const sec = SECCION_BY_CODIGO[seccion_codigo];
  if (!sec) return { error: "Sección inexistente" };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any; // `usuario_secciones` es nueva; se actualiza al regenerar database.ts
  type US = { nivel: string; vence_en: string | null };

  // Limpiar overrides vencidos como higiene oportunística
  await sb
    .from("usuario_secciones")
    .delete()
    .lt("vence_en", new Date().toISOString())
    .not("vence_en", "is", null);

  if (nivel === "quitar") {
    const { data: previo } = (await sb
      .from("usuario_secciones")
      .select("nivel, vence_en")
      .eq("usuario_id", usuario_id)
      .eq("seccion_codigo", seccion_codigo)
      .maybeSingle()) as { data: US | null };

    const { error } = await sb
      .from("usuario_secciones")
      .delete()
      .eq("usuario_id", usuario_id)
      .eq("seccion_codigo", seccion_codigo);

    if (error) return { error: (error as { message: string }).message };

    if (previo) {
      await logAudit({
        client: supabase,
        usuarioId: admin.id,
        accion: "eliminar",
        entidadTipo: "usuario_secciones",
        entidadId: usuario_id,
        valoresAnteriores: { seccion_codigo, nivel: previo.nivel, vence_en: previo.vence_en },
        valoresNuevos: null,
        metadata: { otorgado_por: admin.id, motivo: motivo ?? null },
      });
    }

    revalidatePath("/usuarios");
    return { ok: true };
  }

  // Un override que otorga tiene que sumar algo: "none" no es un otorgamiento.
  if (nivel === "none" || !NIVELES_VALIDOS.includes(nivel)) {
    return { error: "Nivel inválido" };
  }

  const { data: previo } = (await sb
    .from("usuario_secciones")
    .select("nivel, vence_en")
    .eq("usuario_id", usuario_id)
    .eq("seccion_codigo", seccion_codigo)
    .maybeSingle()) as { data: US | null };

  const { error } = await sb.from("usuario_secciones").upsert(
    {
      usuario_id,
      seccion_codigo,
      nivel,
      vence_en: vence_en ?? null,
      otorgado_por: admin.id,
      motivo: motivo ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "usuario_id,seccion_codigo" },
  ) as { error: { message: string } | null };

  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: previo ? "actualizar" : "crear",
    entidadTipo: "usuario_secciones",
    entidadId: usuario_id,
    valoresAnteriores: previo
      ? { seccion_codigo, nivel: previo.nivel, vence_en: previo.vence_en }
      : null,
    valoresNuevos: { seccion_codigo, nivel, vence_en: vence_en ?? null },
    metadata: { otorgado_por: admin.id, motivo: motivo ?? null },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Gestión del usuario en sí: editar datos, resetear contraseña, activar/
// desactivar y eliminar. Todo exclusivo de los dueños y con los admin
// permanentes protegidos (se gestionan a mano en la base).
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function editarUsuarioAction(
  usuario_id: string,
  datos: { nombre: string; apellido: string; email: string },
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();
  if (esAdminPermanente(usuario_id)) {
    return { error: "Es administrador permanente: se gestiona a mano en la base de datos." };
  }

  const nombre = datos.nombre.trim();
  const apellido = datos.apellido.trim();
  const email = datos.email.trim().toLowerCase();
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!EMAIL_RE.test(email)) return { error: "Email inválido." };

  const supabase = createAdminClient();
  const { data: previo } = await supabase
    .from("usuarios")
    .select("nombre, apellido, email")
    .eq("id", usuario_id)
    .single();
  if (!previo) return { error: "Usuario inexistente" };

  // Si cambió el email, hay que actualizar también el acceso (Supabase auth),
  // que es la identidad de login. Si no, quedaría desincronizado.
  if (email !== previo.email) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(usuario_id, {
      email,
      email_confirm: true,
    });
    if (authErr) return { error: `No se pudo actualizar el email de acceso: ${authErr.message}` };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({ nombre, apellido: apellido || null, email, updated_at: new Date().toISOString() })
    .eq("id", usuario_id);
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "usuarios",
    entidadId: usuario_id,
    valoresAnteriores: { nombre: previo.nombre, apellido: previo.apellido, email: previo.email },
    valoresNuevos: { nombre, apellido: apellido || null, email },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

/**
 * Genera un link de recuperación de contraseña para el usuario. Devuelve el link
 * para que el dueño se lo pase por el canal que use (así funciona aunque el
 * email de Supabase no esté configurado). También dispara el mail si lo está.
 */
export async function enviarResetPasswordAction(
  usuario_id: string,
): Promise<{ ok: true; link: string | null } | { error: string }> {
  const admin = await requireDueño();
  const supabase = createAdminClient();

  const { data: u } = await supabase
    .from("usuarios")
    .select("email")
    .eq("id", usuario_id)
    .single();
  if (!u) return { error: "Usuario inexistente" };

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const origin = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  const redirectTo = `${origin}/auth/callback?next=/auth/reset-password`;

  // generateLink: da el link sin depender del SMTP de Supabase.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: u.email,
    options: { redirectTo },
  });
  if (error || !data) {
    return { error: "No se pudo generar el link de recuperación." };
  }

  // Además intentamos mandarlo por mail (si el email está configurado en Supabase).
  const server = await createClient();
  await server.auth.resetPasswordForEmail(u.email, { redirectTo });

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "usuarios",
    entidadId: usuario_id,
    metadata: { accion_detalle: "reset_password", email: u.email },
  });

  return { ok: true, link: data.properties?.action_link ?? null };
}

export async function setUsuarioEstadoAction(
  usuario_id: string,
  activar: boolean,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();
  if (usuario_id === admin.id) return { error: "No podés desactivar tu propio usuario." };
  if (esAdminPermanente(usuario_id)) {
    return { error: "Es administrador permanente: no se puede desactivar." };
  }

  const supabase = createAdminClient();
  const nuevo = activar ? "activo" : "inactivo";
  const { data: previo } = await supabase
    .from("usuarios")
    .select("estado")
    .eq("id", usuario_id)
    .single();
  if (!previo) return { error: "Usuario inexistente" };
  if (previo.estado === nuevo) return { ok: true };

  const { error } = await supabase
    .from("usuarios")
    .update({ estado: nuevo, updated_at: new Date().toISOString() })
    .eq("id", usuario_id);
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "actualizar",
    entidadTipo: "usuarios",
    entidadId: usuario_id,
    valoresAnteriores: { estado: previo.estado },
    valoresNuevos: { estado: nuevo },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function eliminarUsuarioAction(
  usuario_id: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireDueño();
  if (usuario_id === admin.id) return { error: "No podés eliminar tu propio usuario." };
  if (esAdminPermanente(usuario_id)) {
    return { error: "Es administrador permanente: no se puede eliminar." };
  }

  const supabase = createAdminClient();
  const { data: previo } = await supabase
    .from("usuarios")
    .select("email, nombre, apellido")
    .eq("id", usuario_id)
    .single();
  if (!previo) return { error: "Usuario inexistente" };

  // Perfil primero, después el acceso de auth.
  const { error: dbErr } = await supabase.from("usuarios").delete().eq("id", usuario_id);
  if (dbErr) return { error: dbErr.message };
  const { error: authErr } = await supabase.auth.admin.deleteUser(usuario_id);

  await logAudit({
    client: supabase,
    usuarioId: admin.id,
    accion: "eliminar",
    entidadTipo: "usuarios",
    entidadId: usuario_id,
    valoresAnteriores: { email: previo.email, nombre: previo.nombre, apellido: previo.apellido },
    metadata: authErr ? { auth_delete_error: authErr.message } : undefined,
  });

  revalidatePath("/usuarios");
  return { ok: true };
}
