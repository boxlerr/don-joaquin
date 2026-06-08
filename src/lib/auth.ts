import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Tipos de permisos por área
// ---------------------------------------------------------------------------

export type AreaCodigo =
  | "logistica"
  | "viajes"
  | "flota"
  | "mantenimiento"
  | "combustible"
  | "comercial"
  | "finanzas"
  | "caja"
  | "rrhh"
  | "compliance"
  | "sistema";

export type AreaNivel = "none" | "read" | "write" | "admin";

const NIVEL_RANK: Record<AreaNivel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

export type PermisosArea = Record<AreaCodigo, AreaNivel>;

const AREAS_VACIAS: PermisosArea = {
  logistica: "none",
  viajes: "none",
  flota: "none",
  mantenimiento: "none",
  combustible: "none",
  comercial: "none",
  finanzas: "none",
  caja: "none",
  rrhh: "none",
  compliance: "none",
  sistema: "none",
};

// ---------------------------------------------------------------------------
// Usuario actual
// ---------------------------------------------------------------------------

export type CurrentUser = {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  estado: "activo" | "inactivo" | "suspendido";
  must_change_password: boolean;
  rol: {
    id: string;
    codigo: string;
    nombre: string;
  };
  permisos: PermisosArea;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("usuarios")
    .select(
      `
      id,
      email,
      nombre,
      apellido,
      telefono,
      estado,
      must_change_password,
      rol:roles!rol_id (
        id,
        codigo,
        nombre
      )
    `,
    )
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;
  if (profile.estado !== "activo") return null;

  const rol = Array.isArray(profile.rol) ? profile.rol[0] : profile.rol;
  if (!rol) return null;

  const { data: rolAreas } = await supabase
    .from("rol_areas")
    .select("area_codigo, nivel")
    .eq("rol_id", rol.id);

  const permisos: PermisosArea = { ...AREAS_VACIAS };
  for (const row of rolAreas ?? []) {
    permisos[row.area_codigo as AreaCodigo] = row.nivel as AreaNivel;
  }

  // Overrides por usuario individual: solo pueden SUMAR permisos, nunca restar.
  // Los overrides vencidos (vence_en < now) se ignoran.
  // `as any` porque `usuario_areas` es tabla nueva; se actualiza al regenerar database.ts
  type UsuarioAreaOverride = { area_codigo: string; nivel: string; vence_en: string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userAreas } = (await (supabase as any)
    .from("usuario_areas")
    .select("area_codigo, nivel, vence_en")
    .eq("usuario_id", profile.id)) as { data: UsuarioAreaOverride[] | null };

  const nowMs = Date.now();
  for (const row of userAreas ?? []) {
    if (row.vence_en && new Date(row.vence_en).getTime() <= nowMs) continue;
    const area = row.area_codigo as AreaCodigo;
    if (NIVEL_RANK[row.nivel as AreaNivel] > NIVEL_RANK[permisos[area]]) {
      permisos[area] = row.nivel as AreaNivel;
    }
  }

  return {
    id: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    apellido: profile.apellido,
    telefono: profile.telefono,
    estado: profile.estado,
    must_change_password: profile.must_change_password ?? false,
    rol: {
      id: rol.id,
      codigo: rol.codigo,
      nombre: rol.nombre,
    },
    permisos,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.rol.codigo !== "admin") {
    redirect("/dashboard?error=admin_required");
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.rol.codigo === "admin";
}

// ---------------------------------------------------------------------------
// Permisos por área
// ---------------------------------------------------------------------------

export function hasArea(user: CurrentUser, area: AreaCodigo, minNivel: AreaNivel): boolean {
  return NIVEL_RANK[user.permisos[area]] >= NIVEL_RANK[minNivel];
}

export async function requireArea(area: AreaCodigo, minNivel: AreaNivel): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasArea(user, area, minNivel)) {
    redirect(`/dashboard?error=area_required&area=${area}&nivel=${minNivel}`);
  }
  return user;
}
