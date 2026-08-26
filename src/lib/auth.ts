import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECCIONES, SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";

// ---------------------------------------------------------------------------
// Tipos de permisos por área (definidos en permisos-nivel.ts, sin server-only,
// para que la lógica pura de permisos sea testeable; se re-exportan acá porque
// el resto del código los importa históricamente desde auth).
// ---------------------------------------------------------------------------

import {
  NIVEL_RANK,
  AREAS_VACIAS,
  type AreaCodigo,
  type AreaNivel,
  type PermisosArea,
} from "@/lib/permisos-nivel";

export { NIVEL_RANK };
export type { AreaCodigo, AreaNivel, PermisosArea };

// ---------------------------------------------------------------------------
// Usuario actual
// ---------------------------------------------------------------------------

export type CurrentUser = {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  estado: "activo" | "inactivo" | "suspendido" | "eliminado";
  must_change_password: boolean;
  /**
   * La pantalla con la que arranca esta persona después del login. Null = el
   * dashboard. Existe porque el rol dice lo que PUEDE ver y no lo que viene a
   * hacer: Anabela tiene el mismo rol que media empresa y entra sólo a cargar
   * documentación.
   */
  pantalla_inicio: string | null;
  rol: {
    id: string;
    codigo: string;
    nombre: string;
  };
  permisos: PermisosArea;
  /** Nivel efectivo por subsección (override de rol > confidencial > nivel del área). */
  secciones: Record<SeccionCodigo, AreaNivel>;
};

// Memoizada por request (React cache): un mismo render que llame varias veces a
// requireArea/hasSeccion/getCurrentUser resuelve el usuario UNA sola vez, en vez
// de repetir ~7 consultas de auth por cada llamada. Cada Server Action es un
// request nuevo, así que tras una mutación se recomputa (semántica intacta).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // `as any`: `pantalla_inicio` es columna nueva y database.ts todavía no la
  // tiene (se regenera aparte). Mismo patrón que `camion_documentos.aseguradora`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error } = await (supabase as any)
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
      pantalla_inicio,
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

  // Overrides de subsección por rol: pisan el nivel heredado del área para
  // páginas puntuales (ej. cerrar "Sueldos" aunque el área Logística esté abierta).
  // `as any` porque `rol_secciones` es tabla nueva; se actualiza al regenerar database.ts
  type RolSeccionOverride = { seccion_codigo: string; nivel: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rolSecciones } = (await (supabase as any)
    .from("rol_secciones")
    .select("seccion_codigo, nivel")
    .eq("rol_id", rol.id)) as { data: RolSeccionOverride[] | null };

  const overrideSeccion = new Map<string, AreaNivel>();
  for (const row of rolSecciones ?? []) {
    overrideSeccion.set(row.seccion_codigo, row.nivel as AreaNivel);
  }

  // Confidencialidad efectiva: editable desde /usuarios (tabla `secciones`), con
  // fallback al catálogo de código. Así se puede marcar/desmarcar una sección como
  // sensible "sobre la marcha" sin un deploy. `as any`: `secciones` no está en los
  // tipos generados todavía.
  type SeccionConfRow = { codigo: string; confidencial: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seccionesDb } = (await (supabase as any)
    .from("secciones")
    .select("codigo, confidencial")) as { data: SeccionConfRow[] | null };
  const confidencialDb = new Map<string, boolean>();
  for (const row of seccionesDb ?? []) confidencialDb.set(row.codigo, !!row.confidencial);

  // Overrides de subsección por USUARIO individual: como `usuario_areas`, solo
  // SUMAN (nunca restan) y respetan `vence_en`. Permiten otorgar una sección
  // confidencial (ej. Préstamos) a un usuario puntual sin abrírsela a todo el rol.
  // `as any`: `usuario_secciones` es tabla nueva; se actualiza al regenerar database.ts
  type UsuarioSeccionOverride = { seccion_codigo: string; nivel: string; vence_en: string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userSecciones } = (await (supabase as any)
    .from("usuario_secciones")
    .select("seccion_codigo, nivel, vence_en")
    .eq("usuario_id", profile.id)) as { data: UsuarioSeccionOverride[] | null };

  const esAdmin = rol.codigo === "admin";
  const secciones = {} as Record<SeccionCodigo, AreaNivel>;
  for (const s of SECCIONES) {
    if (esAdmin) {
      secciones[s.codigo] = "admin";
      continue;
    }
    const ov = overrideSeccion.get(s.codigo);
    const esConfidencial = confidencialDb.get(s.codigo) ?? !!s.confidencial;
    if (esConfidencial) {
      // Confidencial: cerrada salvo que se otorgue explícitamente (puede darse sin el área).
      secciones[s.codigo] = ov ?? "none";
      continue;
    }
    // No confidencial: hereda el área. El override solo puede RESTRINGIR (nunca
    // superar el área), así "ocultar una página" no habilita acciones que siguen
    // protegidas a nivel área.
    const areaLvl = permisos[s.area];
    secciones[s.codigo] = ov && NIVEL_RANK[ov] < NIVEL_RANK[areaLvl] ? ov : areaLvl;
  }

  // Overrides de sección por usuario individual (aditivos, ya calculado el resto).
  // Suben el nivel de una sección puntual: abren una confidencial cerrada o dan
  // una no-confidencial por encima del nivel de su área. Nunca bajan (max).
  for (const row of userSecciones ?? []) {
    if (row.vence_en && new Date(row.vence_en).getTime() <= nowMs) continue;
    const cod = row.seccion_codigo as SeccionCodigo;
    if (!(cod in secciones)) continue;
    if (NIVEL_RANK[row.nivel as AreaNivel] > NIVEL_RANK[secciones[cod]]) {
      secciones[cod] = row.nivel as AreaNivel;
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
    pantalla_inicio: (profile as { pantalla_inicio?: string | null }).pantalla_inicio ?? null,
    rol: {
      id: rol.id,
      codigo: rol.codigo,
      nombre: rol.nombre,
    },
    permisos,
    secciones,
  };
});

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

// ---------------------------------------------------------------------------
// Permisos por subsección (un nivel más fino que el área)
// ---------------------------------------------------------------------------

export function hasSeccion(user: CurrentUser, seccion: SeccionCodigo, minNivel: AreaNivel): boolean {
  return NIVEL_RANK[user.secciones[seccion]] >= NIVEL_RANK[minNivel];
}

export async function requireSeccion(seccion: SeccionCodigo, minNivel: AreaNivel): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasSeccion(user, seccion, minNivel)) {
    const area = SECCION_BY_CODIGO[seccion].area;
    redirect(`/dashboard?error=area_required&area=${area}&nivel=${minNivel}`);
  }
  return user;
}
