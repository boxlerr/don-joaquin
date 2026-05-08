import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Datos del usuario autenticado, enriquecidos con su perfil de `public.usuarios`.
 * Devuelve `null` si no hay sesión o si el usuario está inactivo/suspendido.
 */
export type CurrentUser = {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  estado: "activo" | "inactivo" | "suspendido";
  rol: {
    id: string;
    codigo: string;
    nombre: string;
  };
};

/**
 * Devuelve el usuario actual con su rol desde public.usuarios.
 *
 * Usar en Server Components / Route Handlers / Server Actions.
 * Devuelve `null` si:
 *  - No hay sesión activa
 *  - El usuario de auth no tiene fila en public.usuarios
 *  - El usuario está inactivo o suspendido
 */
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

  // Supabase devuelve la relación como array si la PK del lado N no es única.
  // Como rol_id apunta a roles.id (PK), devuelve objeto, pero TS lo tipa como array.
  // Normalizamos:
  const rol = Array.isArray(profile.rol) ? profile.rol[0] : profile.rol;
  if (!rol) return null;

  return {
    id: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    apellido: profile.apellido,
    telefono: profile.telefono,
    estado: profile.estado,
    rol: {
      id: rol.id,
      codigo: rol.codigo,
      nombre: rol.nombre,
    },
  };
}

/**
 * Exige que haya un usuario autenticado activo. Si no, redirige a /login.
 * Devuelve el CurrentUser para usar directamente.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Exige que el usuario sea admin. Si no, redirige al dashboard con error.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.rol.codigo !== "admin") {
    redirect("/dashboard?error=admin_required");
  }
  return user;
}

/**
 * Helper booleano para checks rápidos en componentes.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.rol.codigo === "admin";
}
