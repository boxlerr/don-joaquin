import { createAdminClient } from "@/lib/supabase/admin";
import { type AreaNivel } from "@/lib/permisos-nivel";
import { getUsuariosConSeccionCon } from "@/lib/permisos-usuarios-query";
import { type SeccionCodigo } from "@/lib/secciones";

/**
 * Qué usuarios activos tienen una subsección en al menos `minNivel`.
 *
 * Es el reverso de `hasSeccion`: en vez del permiso del que mira, resuelve el
 * de los DEMÁS, con service role. Sirve para filtrar datos según quién los
 * cargó — p. ej. la caja diaria le oculta al operador los movimientos de quien
 * sí ve el saldo (dirección) — y para decidir a quién se le puede mandar un aviso
 * de una sección confidencial (lib/alertas-permisos.ts).
 *
 * La consulta vive en `permisos-usuarios-query.ts`, sin `server-only`, para que
 * los scripts la puedan usar con su propio cliente. Las reglas, en
 * `permisos-usuarios-core.ts`.
 */
export function getUsuariosConSeccion(
  seccion: SeccionCodigo,
  minNivel: AreaNivel,
): Promise<Set<string>> {
  return getUsuariosConSeccionCon(createAdminClient(), seccion, minNivel);
}
