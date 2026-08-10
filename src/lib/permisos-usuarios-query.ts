import { type AreaCodigo, type AreaNivel } from "@/lib/permisos-nivel";
import {
  mapaOverridesVigentes,
  resolverUsuariosConSeccion,
  type ResolverInput,
} from "@/lib/permisos-usuarios-core";
import { SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";

/**
 * La consulta de `getUsuariosConSeccion` con el cliente INYECTADO, y sin
 * `server-only`.
 *
 * Existe para que los scripts la puedan usar: `lib/permisos-usuarios.ts` importa
 * `supabase/admin`, que es `server-only` y revienta bajo `tsx`. El script de envío
 * de alertas reales arma su propio cliente y repartía correos sin mirar permisos —
 * mismo bug que tenía el envío de verdad, en la copia que nadie arregló. Mismo
 * criterio que `alertas-routing.ts`, que vive sin `server-only` justamente por esto.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- tablas de permisos aún fuera de database.ts, y el cliente lo pone el llamador */
export async function getUsuariosConSeccionCon(
  supabase: any,
  seccion: SeccionCodigo,
  minNivel: AreaNivel,
): Promise<Set<string>> {
  const area: AreaCodigo = SECCION_BY_CODIGO[seccion].area;

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
    supabase.from("secciones").select("confidencial").eq("codigo", seccion).maybeSingle(),
    supabase.from("rol_secciones").select("rol_id, nivel").eq("seccion_codigo", seccion),
    supabase
      .from("usuario_secciones")
      .select("usuario_id, nivel, vence_en")
      .eq("seccion_codigo", seccion),
    supabase.from("rol_areas").select("rol_id, nivel").eq("area_codigo", area),
    supabase.from("usuario_areas").select("usuario_id, nivel, vence_en").eq("area_codigo", area),
  ]);

  const ahoraMs = Date.now();
  const input: ResolverInput = {
    usuarios: (usuariosRes.data ?? []) as { id: string; rol_id: string | null }[],
    rolCodigo: new Map(
      ((rolesRes.data ?? []) as { id: string; codigo: string }[]).map((r) => [r.id, r.codigo]),
    ),
    // La confidencialidad es editable desde /usuarios; el catálogo es el fallback.
    // Si la consulta FALLA no se cae al catálogo: se asume confidencial. Un error de
    // red no puede ser la vía por la que se abre una sección cerrada.
    esConfidencial: seccionRes.error
      ? true
      : ((seccionRes.data as { confidencial: boolean } | null)?.confidencial ??
        !!SECCION_BY_CODIGO[seccion].confidencial),
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
/* eslint-enable @typescript-eslint/no-explicit-any */
