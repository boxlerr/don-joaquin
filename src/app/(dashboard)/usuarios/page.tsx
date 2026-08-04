import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpenAuditButton } from "@/components/open-audit-button";
import { getCurrentUser } from "@/lib/auth";
import { esAdminPermanente } from "./admins-permanentes";
import RolesPermisosMatrix from "./RolesPermisosMatrix";
import SeccionesConfidencialEditor from "./SeccionesConfidencialEditor";
import UsuariosListaClient, { type UsuarioRow } from "./UsuariosListaClient";
import NuevoUsuarioDialog from "./NuevoUsuarioDialog";
import UsuarioPermisosOverrides from "./UsuarioPermisosOverrides";
import HelpUsuariosDialog from "./HelpUsuariosDialog";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { SECCIONES, type SeccionCodigo } from "@/lib/secciones";

export default async function UsuariosPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  // La gestión de usuarios y permisos es exclusiva de los administradores
  // dueños (Bárbara, Nicolás, Julián). Ni siquiera otro admin la maneja.
  if (!esAdminPermanente(currentUser.id)) redirect("/dashboard");

  const supabase = createAdminClient();
  const showMatriz = true; // solo los dueños llegan hasta acá

  const [
    { data: usuarios },
    { count: total },
    { count: admins },
    { count: operativos },
    rolesRes,
    areasRes,
    rolAreasRes,
    usuarioAreasRes,
    usuarioSeccionesRes,
    seccionesConfRes,
  ] = await Promise.all([
    // Los eliminados quedan en la base solo para sostener el historial de lo que
    // hicieron (ver eliminarUsuarioAction): no se listan ni se cuentan.
    supabase
      .from("usuarios")
      .select("*, roles(codigo, nombre)")
      .neq("estado", "eliminado")
      .order("created_at", { ascending: false }),
    supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .neq("estado", "eliminado"),
    supabase
      .from("usuarios")
      .select("*, roles!inner(codigo)", { count: "exact", head: true })
      .neq("estado", "eliminado")
      .eq("roles.codigo", "admin"),
    supabase
      .from("usuarios")
      .select("*, roles!inner(codigo)", { count: "exact", head: true })
      .neq("estado", "eliminado")
      .eq("roles.codigo", "administrativo"),
    showMatriz
      ? supabase.from("roles").select("id, codigo, nombre").order("codigo")
      : Promise.resolve({ data: null }),
    showMatriz
      ? supabase.from("areas").select("codigo, nombre, orden").order("orden")
      : Promise.resolve({ data: null }),
    showMatriz
      ? supabase.from("rol_areas").select("rol_id, area_codigo, nivel")
      : Promise.resolve({ data: null }),
     
    showMatriz
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- usuario_areas aún no está en los tipos generados de Supabase
      ? (supabase as any)
          .from("usuario_areas")
          .select("usuario_id, area_codigo, nivel, vence_en, motivo")
      : Promise.resolve({ data: null }),
    showMatriz
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- usuario_secciones aún no está en los tipos generados de Supabase
      ? (supabase as any)
          .from("usuario_secciones")
          .select("usuario_id, seccion_codigo, nivel, vence_en, motivo")
      : Promise.resolve({ data: null }),
    showMatriz
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- secciones aún no está en los tipos generados de Supabase
      ? (supabase as any)
          .from("secciones")
          .select("codigo, confidencial")
      : Promise.resolve({ data: null }),
  ]);

  const roles = (rolesRes.data ?? []) as { id: string; codigo: string; nombre: string }[];
  const areas = (areasRes.data ?? []) as { codigo: AreaCodigo; nombre: string; orden: number }[];
  const rolAreas =
    (rolAreasRes.data ?? []) as { rol_id: string; area_codigo: AreaCodigo; nivel: AreaNivel }[];
  const usuarioAreas = (usuarioAreasRes.data ?? []) as {
    usuario_id: string;
    area_codigo: AreaCodigo;
    nivel: AreaNivel;
    vence_en: string | null;
    motivo: string | null;
  }[];
  const usuarioSecciones = (usuarioSeccionesRes.data ?? []) as {
    usuario_id: string;
    seccion_codigo: SeccionCodigo;
    nivel: AreaNivel;
    vence_en: string | null;
    motivo: string | null;
  }[];

  const matrizInicial: Record<string, Partial<Record<AreaCodigo, AreaNivel>>> = {};
  for (const ra of rolAreas) {
    if (!matrizInicial[ra.rol_id]) matrizInicial[ra.rol_id] = {};
    matrizInicial[ra.rol_id][ra.area_codigo] = ra.nivel;
  }

  // Confidencialidad efectiva por subsección: valor de la DB (editable) con
  // fallback al catálogo de código. Alimenta el editor de confidencialidad.
  const seccionesConf = (seccionesConfRes.data ?? []) as { codigo: string; confidencial: boolean }[];
  const confDb = new Map(seccionesConf.map((s) => [s.codigo, !!s.confidencial]));
  const confidencialMap = Object.fromEntries(
    SECCIONES.map((s) => [s.codigo, confDb.get(s.codigo) ?? !!s.confidencial]),
  ) as Record<SeccionCodigo, boolean>;

  const usuariosFila = (usuarios ?? []).map((u) => {
    const rol = (u.roles as unknown as { codigo: string; nombre: string } | null) ?? null;
    return {
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido as string | null,
      rol_nombre: rol?.nombre ?? null,
    };
  });

  // Cantidad de usuarios por rol (para la tarjeta de gestión de roles).
  const conteoPorRol: Record<string, number> = {};
  for (const u of usuarios ?? []) {
    if (u.rol_id) conteoPorRol[u.rol_id] = (conteoPorRol[u.rol_id] ?? 0) + 1;
  }

  const usuariosRows: UsuarioRow[] = (usuarios ?? []).map((u) => {
    const rol = (u.roles as unknown as { codigo: string; nombre: string } | null) ?? null;
    return {
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      rol_id: u.rol_id,
      rol_codigo: rol?.codigo ?? null,
      rol_nombre: rol?.nombre ?? null,
      estado: u.estado,
      last_login: u.last_login,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columna nueva, database.ts sin regenerar
      acceso_fuera_horario: Boolean((u as any).acceso_fuera_horario),
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Usuarios y Permisos"
        description="Acceso administrativo — choferes no acceden al sistema"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HelpUsuariosDialog />
            <OpenAuditButton />
            {showMatriz && <NuevoUsuarioDialog roles={roles} />}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Usuarios totales" value={String(total ?? 0)} color="brand" />
        <StatCard label="Administradores" value={String(admins ?? 0)} sub="Acceso total" color="warning" />
        <StatCard label="Operativos" value={String(operativos ?? 0)} sub="Carga y consulta" color="success" />
      </div>

      <UsuariosListaClient
        usuarios={usuariosRows}
        roles={roles}
        currentUserId={currentUser?.id ?? ""}
        canEdit={showMatriz}
      />

      {showMatriz && roles.length > 0 && areas.length > 0 && (
        <RolesPermisosMatrix roles={roles} areas={areas} initialMatriz={matrizInicial} conteoPorRol={conteoPorRol} />
      )}

      {showMatriz && (
        <SeccionesConfidencialEditor initial={confidencialMap} />
      )}

      {showMatriz && areas.length > 0 && (
        <UsuarioPermisosOverrides
          usuarios={usuariosFila}
          overrides={usuarioAreas}
          seccionOverrides={usuarioSecciones}
          confidencial={confidencialMap}
        />
      )}
    </div>
  );
}
