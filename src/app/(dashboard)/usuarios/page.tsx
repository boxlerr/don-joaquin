import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpenAuditButton } from "@/components/open-audit-button";
import { getCurrentUser, requireSeccion } from "@/lib/auth";
import RolesPermisosMatrix from "./RolesPermisosMatrix";
import RolSeccionesEditor from "./RolSeccionesEditor";
import SeccionesConfidencialEditor from "./SeccionesConfidencialEditor";
import UsuariosListaClient, { type UsuarioRow } from "./UsuariosListaClient";
import NuevoUsuarioDialog from "./NuevoUsuarioDialog";
import UsuarioPermisosOverrides from "./UsuarioPermisosOverrides";
import HelpUsuariosDialog from "./HelpUsuariosDialog";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { SECCIONES, type SeccionCodigo } from "@/lib/secciones";

export default async function UsuariosPage() {
  await requireSeccion("usuarios", "read");
  const supabase = createAdminClient();
  const currentUser = await getCurrentUser();
  const showMatriz = currentUser?.rol.codigo === "admin";

  const [
    { data: usuarios },
    { count: total },
    { count: admins },
    { count: operativos },
    rolesRes,
    areasRes,
    rolAreasRes,
    usuarioAreasRes,
    rolSeccionesRes,
    seccionesConfRes,
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("*, roles(codigo, nombre)")
      .order("created_at", { ascending: false }),
    supabase.from("usuarios").select("*", { count: "exact", head: true }),
    supabase
      .from("usuarios")
      .select("*, roles!inner(codigo)", { count: "exact", head: true })
      .eq("roles.codigo", "admin"),
    supabase
      .from("usuarios")
      .select("*, roles!inner(codigo)", { count: "exact", head: true })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rol_secciones aún no está en los tipos generados de Supabase
      ? (supabase as any)
          .from("rol_secciones")
          .select("rol_id, seccion_codigo, nivel")
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

  const matrizInicial: Record<string, Partial<Record<AreaCodigo, AreaNivel>>> = {};
  for (const ra of rolAreas) {
    if (!matrizInicial[ra.rol_id]) matrizInicial[ra.rol_id] = {};
    matrizInicial[ra.rol_id][ra.area_codigo] = ra.nivel;
  }

  const rolSecciones = (rolSeccionesRes.data ?? []) as {
    rol_id: string;
    seccion_codigo: SeccionCodigo;
    nivel: AreaNivel;
  }[];
  const rolSeccionesInicial: Record<string, Partial<Record<SeccionCodigo, AreaNivel>>> = {};
  for (const rs of rolSecciones) {
    if (!rolSeccionesInicial[rs.rol_id]) rolSeccionesInicial[rs.rol_id] = {};
    rolSeccionesInicial[rs.rol_id][rs.seccion_codigo] = rs.nivel;
  }

  // Confidencialidad efectiva por subsección: valor de la DB (editable) con
  // fallback al catálogo de código. Alimenta el editor de confidencialidad y hace
  // que "Permisos finos" muestre el candado según el estado real.
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
    };
  });

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Usuarios y Permisos"
        description="Acceso administrativo — choferes no acceden al sistema"
        action={
          <div className="flex items-center gap-2">
            <HelpUsuariosDialog />
            <OpenAuditButton />
            {showMatriz && <NuevoUsuarioDialog roles={roles} />}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
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
        <RolesPermisosMatrix roles={roles} areas={areas} initialMatriz={matrizInicial} />
      )}

      {showMatriz && areas.length > 0 && (
        <SeccionesConfidencialEditor areas={areas} initial={confidencialMap} />
      )}

      {showMatriz && roles.length > 0 && areas.length > 0 && (
        <RolSeccionesEditor
          roles={roles}
          areas={areas}
          matriz={matrizInicial}
          initial={rolSeccionesInicial}
          confidencial={confidencialMap}
        />
      )}

      {showMatriz && areas.length > 0 && (
        <UsuarioPermisosOverrides
          usuarios={usuariosFila}
          areas={areas}
          overrides={usuarioAreas}
        />
      )}
    </div>
  );
}
