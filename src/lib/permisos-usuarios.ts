import { createAdminClient } from "@/lib/supabase/admin";
import { type AreaCodigo, type AreaNivel } from "@/lib/permisos-nivel";
import {
  mapaOverridesVigentes,
  resolverUsuariosConSeccion,
  type ResolverInput,
} from "@/lib/permisos-usuarios-core";
import { SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";

/**
 * Qué usuarios activos tienen una subsección en al menos `minNivel`.
 *
 * Es el reverso de `hasSeccion`: en vez del permiso del que mira, resuelve el
 * de los DEMÁS, con service role. Sirve para filtrar datos según quién los
 * cargó — p. ej. la caja diaria le oculta al operador los movimientos de quien
 * sí ve el saldo (dirección). Las reglas viven en permisos-usuarios-core.ts.
 */
export async function getUsuariosConSeccion(
  seccion: SeccionCodigo,
  minNivel: AreaNivel,
): Promise<Set<string>> {
  const supabase = createAdminClient();
  const area: AreaCodigo = SECCION_BY_CODIGO[seccion].area;

  /* eslint-disable @typescript-eslint/no-explicit-any -- tablas de permisos aún fuera de database.ts */
  const [
    usuariosRes,
    rolesRes,
    seccionRes,
    rolSeccionesRes,
    usuarioSeccionesRes,
    rolAreasRes,
    usuarioAreasRes,
  ] = await Promise.all([
    supabase.from("usuarios").select("id, rol_id").eq("estado", "activo"),
    supabase.from("roles").select("id, codigo"),
    (supabase as any).from("secciones").select("confidencial").eq("codigo", seccion).maybeSingle(),
    (supabase as any).from("rol_secciones").select("rol_id, nivel").eq("seccion_codigo", seccion),
    (supabase as any)
      .from("usuario_secciones")
      .select("usuario_id, nivel, vence_en")
      .eq("seccion_codigo", seccion),
    supabase.from("rol_areas").select("rol_id, nivel").eq("area_codigo", area),
    (supabase as any)
      .from("usuario_areas")
      .select("usuario_id, nivel, vence_en")
      .eq("area_codigo", area),
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const ahoraMs = Date.now();
  const input: ResolverInput = {
    usuarios: (usuariosRes.data ?? []) as { id: string; rol_id: string | null }[],
    rolCodigo: new Map(
      ((rolesRes.data ?? []) as { id: string; codigo: string }[]).map((r) => [r.id, r.codigo]),
    ),
    // La confidencialidad es editable desde /usuarios; el catálogo es el fallback.
    esConfidencial:
      (seccionRes.data as { confidencial: boolean } | null)?.confidencial ??
      !!SECCION_BY_CODIGO[seccion].confidencial,
    nivelPorRolSeccion: new Map(
      ((rolSeccionesRes.data ?? []) as { rol_id: string; nivel: AreaNivel }[]).map((r) => [
        r.rol_id,
        r.nivel,
      ]),
    ),
    nivelPorRolArea: new Map(
      ((rolAreasRes.data ?? []) as { rol_id: string; nivel: AreaNivel }[]).map((r) => [
        r.rol_id,
        r.nivel,
      ]),
    ),
    extraArea: mapaOverridesVigentes(usuarioAreasRes.data ?? [], ahoraMs),
    extraSeccion: mapaOverridesVigentes(usuarioSeccionesRes.data ?? [], ahoraMs),
  };

  return resolverUsuariosConSeccion(input, minNivel);
}
